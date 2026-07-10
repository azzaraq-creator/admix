"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/common/buttons";
import { LicenseFileInfo } from "@/components/common/LicenseFileInfo";
import { KakaoBrandIcon, NaverBrandIcon, UserIcon } from "@/components/icons";
import { Switch } from "@/components/ui/switch";
import {
  authApi,
  authKeys,
  useCancelBusinessRegistration,
  useMe,
  useUpdateProfile,
  useWithdraw,
} from "@/hooks/auth";
import { useConfirm } from "@/hooks/useConfirm";
import { API_BASE_URL } from "@/lib/api";
import { clearUserToken, getRefreshToken } from "@/lib/userToken";

import { BusinessRegisterModal } from "./BusinessRegisterModal";
import { ContactEmailChangeModal } from "./ContactEmailChangeModal";
import { PasswordChangeModal } from "./PasswordChangeModal";
import { TextFieldModal } from "./TextFieldModal";

type ModalKey = "password" | "company" | "name" | "phone" | "business" | "email";

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

const ROW_CLASS =
  "flex items-center gap-[12px] border-b border-[#e8e8e8] py-[12px] sm:gap-[42px] sm:py-[28px]";
const LABEL_CLASS = "text-base font-semibold leading-[24px] text-black";
const VALUE_CLASS = "text-base font-medium leading-[24px] text-disabled";
const ACTION_CLASS =
  "shrink-0 cursor-pointer text-sm font-semibold leading-[20px] text-grey-500 underline sm:text-base sm:leading-[24px]";
const FIELD_CLASS = "flex min-w-0 flex-1 flex-col gap-[6px] sm:gap-[12px]";
const CHIP_CLASS =
  "rounded-[6px] px-[10px] py-[4px] text-xs font-medium leading-[16px] tracking-[0.0048px]";

const BIZ_BADGE: Record<string, { label: string; className: string }> = {
  unregistered: { label: "미등록", className: "bg-grey-50 text-[#545454]" },
  reviewing: { label: "검토중", className: "bg-[#fff3d3] text-[#ff920a]" },
  verified: { label: "검토 완료", className: "bg-[#e5f6f6] text-[#00aaa4]" },
  rejected: { label: "인증 반려", className: "bg-[#ffe1df] text-[#ff2c20]" },
};

export function ProfileView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const updateProfile = useUpdateProfile();
  const withdraw = useWithdraw();
  const { confirm, confirmDialog } = useConfirm();
  const [marketingOverride, setMarketingOverride] = useState<boolean | null>(
    null,
  );
  const [openModal, setOpenModal] = useState<ModalKey | null>(null);

  const marketing = marketingOverride ?? me?.marketing_consent ?? false;

  const handleMarketing = (checked: boolean) => {
    setMarketingOverride(checked);
    updateProfile.mutate(
      { marketing_consent: checked },
      {
        onSuccess: () =>
          queryClient.invalidateQueries({ queryKey: authKeys.me }),
        onError: () => setMarketingOverride(!checked),
      },
    );
  };

  const name = me?.name?.trim() ? me.name : "";
  const email = me?.email ?? "";
  const loginId = me?.login_id ?? "";
  const snsProvider = me?.sns_provider ?? null;
  const companyName = me?.company_name ?? "";
  const rawPhone = me?.phone ?? "";
  const phone = formatPhone(me?.phone);

  const bizReg = me?.business_registration ?? null;
  const bizStatus = bizReg?.status ?? "unregistered";
  const bizBadge = BIZ_BADGE[bizStatus] ?? BIZ_BADGE.unregistered;
  const bizFileUrl = bizReg?.license_file_url
    ? `${API_BASE_URL}${bizReg.license_file_url}`
    : null;
  const bizFileName = bizReg?.license_file_name ?? "사업자등록증";

  const cancelBiz = useCancelBusinessRegistration();
  const handleCancelBiz = async () => {
    const ok = await confirm({
      title: "사업자등록증 검토를 취소하시겠습니까?",
      description: "취소하면 업로드한 파일이 삭제되며 다시 등록해야 합니다.",
      confirmText: "취소하기",
    });
    if (!ok) return;
    try {
      await cancelBiz.mutateAsync();
    } catch {
      await confirm({
        title: "취소에 실패했습니다.",
        description: "잠시 후 다시 시도해 주세요.",
        confirmText: "확인",
      });
    }
  };

  const accountRows: { label: string; value: string; modal: ModalKey | null }[] =
    [
      // SNS 로그인 계정은 비밀번호가 없어(통제 불가) 비밀번호 행 미표시. 이메일 가입만.
      ...(snsProvider
        ? []
        : [
            {
              label: "비밀번호",
              value: "**********",
              modal: "password" as ModalKey,
            },
          ]),
      { label: "회사이름", value: companyName, modal: "company" },
      { label: "이름", value: name, modal: "name" },
      { label: "전화번호", value: phone, modal: "phone" },
    ];

  const closeModal = () => setOpenModal(null);

  const handleLogout = async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken); // 서버에서 refresh 토큰 폐기 (best-effort)
      } catch {
        // 폐기 실패해도 로컬 로그아웃은 진행
      }
    }
    clearUserToken();
    queryClient.removeQueries({ queryKey: authKeys.me });
    router.push("/");
  };

  const handleWithdraw = async () => {
    const ok = await confirm({
      title: "회원 탈퇴를 하시겠습니까?",
      description:
        "계정 삭제는 영구적이며 돌이킬 수 없습니다. 사용자님의 데이터는 30일 이내에 삭제됩니다.",
      confirmText: "탈퇴",
    });
    if (!ok) return;
    try {
      await withdraw.mutateAsync();
      clearUserToken();
      queryClient.removeQueries({ queryKey: authKeys.me });
      router.push("/");
    } catch {
      await confirm({
        title: "회원 탈퇴에 실패했습니다.",
        description: "잠시 후 다시 시도해 주세요.",
        confirmText: "확인",
      });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1016px] flex-col gap-[16px] px-[16px] pb-[24px] pt-[24px] sm:gap-[24px] sm:px-[20px] sm:pb-[40px] sm:pt-[80px]">
      <div className="flex flex-col gap-[4px]">
        <p className="text-[20px] font-semibold leading-[28px] tracking-[-0.08px] text-black sm:text-[24px] sm:leading-[32px] sm:tracking-[-0.1px]">
          계정 정보
        </p>
        <p className="text-sm font-medium leading-[20px] text-disabled sm:text-base sm:leading-[24px]">
          회원 정보 및 계정 설정을 관리할 수 있습니다.
        </p>
      </div>

      <div className="flex flex-col gap-[12px] rounded-[12px] border border-stroke p-[16px] sm:flex-row sm:items-center sm:gap-[24px] sm:px-[24px] sm:py-[32px]">
        <div className="flex min-w-0 flex-1 items-center gap-[12px] sm:gap-[24px]">
          <div className="flex shrink-0 items-center justify-center rounded-full bg-primary p-[8px] sm:p-[12px]">
            <UserIcon className="size-[26px] text-white sm:size-[40px]" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-[8px]">
            <p className="truncate text-[18px] font-semibold leading-[28px] tracking-[-0.04px] text-black sm:text-[24px] sm:leading-[32px] sm:tracking-[-0.1px]">
              {name}
            </p>
            <div className="flex items-center gap-[6px]">
              {snsProvider === "kakao" && (
                <span className="flex shrink-0 items-center justify-center rounded-full bg-[#ffe400] p-[4px]">
                  <KakaoBrandIcon className="size-[16px] text-[#3c1e1e]" />
                </span>
              )}
              {snsProvider === "naver" && (
                <span className="flex shrink-0 items-center justify-center rounded-full bg-[#00cb4b] p-[4px]">
                  <NaverBrandIcon className="size-[16px] text-white" />
                </span>
              )}
              <p className="truncate text-sm font-medium leading-[20px] text-disabled sm:text-base sm:leading-[24px]">
                {loginId}
              </p>
            </div>
          </div>
        </div>
        <Button
          variant="secondary"
          size="md"
          onClick={handleLogout}
          className="w-full shrink-0 sm:w-auto"
        >
          로그아웃
        </Button>
      </div>

      <div className="flex flex-col rounded-[12px] border border-stroke px-[16px] sm:px-[24px]">
        <div className={ROW_CLASS}>
          <div className={FIELD_CLASS}>
            <p className={LABEL_CLASS}>연락받을 이메일</p>
            <p className={VALUE_CLASS}>{email}</p>
          </div>
          {/* 이메일 가입 계정은 연락받을 이메일 = 가입 아이디라 변경 불가. SNS 계정만 변경. */}
          {snsProvider && (
            <button
              type="button"
              onClick={() => setOpenModal("email")}
              className={ACTION_CLASS}
            >
              변경
            </button>
          )}
        </div>

        {accountRows.map((row) => (
          <div key={row.label} className={ROW_CLASS}>
            <div className={FIELD_CLASS}>
              <p className={LABEL_CLASS}>{row.label}</p>
              <p className={VALUE_CLASS}>{row.value}</p>
            </div>
            <button
              type="button"
              onClick={() => row.modal && setOpenModal(row.modal)}
              className={ACTION_CLASS}
            >
              변경
            </button>
          </div>
        ))}

        <div className={ROW_CLASS}>
          {bizStatus === "unregistered" ? (
            <>
              <div className={FIELD_CLASS}>
                <div className="flex items-center gap-[12px]">
                  <p className={LABEL_CLASS}>사업자등록증</p>
                  <span className={`${CHIP_CLASS} ${bizBadge.className}`}>
                    {bizBadge.label}
                  </span>
                </div>
                <p className="text-sm font-medium leading-[20px] text-disabled">
                  등록된 사업자등록증이 없습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenModal("business")}
                className={ACTION_CLASS}
              >
                등록
              </button>
            </>
          ) : (
            <>
              <div className="flex min-w-0 flex-1 flex-col gap-[12px]">
                <div className="flex items-center gap-[12px]">
                  <p className={LABEL_CLASS}>사업자등록증</p>
                  <span className={`${CHIP_CLASS} ${bizBadge.className}`}>
                    {bizBadge.label}
                  </span>
                </div>
                <div className="flex flex-col gap-[6px]">
                  <a
                    href={bizFileUrl ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-fit"
                  >
                    <LicenseFileInfo
                      name={bizFileName}
                      uploadedAt={bizReg?.license_uploaded_at ?? null}
                    />
                  </a>
                  {bizStatus === "reviewing" && (
                    <p className="text-xs font-medium leading-[16px] tracking-[0.0048px] text-grey-500">
                      변경시, 검토 후 3영업일 이내 담당자가 확인 후 반영이 됩니다.
                    </p>
                  )}
                  {bizStatus === "rejected" && bizReg?.reject_reason && (
                    <p className="text-xs font-medium leading-[16px] tracking-[0.0048px] text-[#ff6c64]">
                      인증 반려 사유 : {bizReg.reject_reason}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={
                  bizStatus === "reviewing"
                    ? handleCancelBiz
                    : () => setOpenModal("business")
                }
                disabled={bizStatus === "reviewing" && cancelBiz.isPending}
                className={ACTION_CLASS}
              >
                {bizStatus === "reviewing" ? "취소" : "변경"}
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-[12px] py-[12px] sm:gap-[42px] sm:py-[28px]">
          <div className="flex min-w-0 flex-1 flex-col gap-[6px] sm:gap-[12px]">
            <p className={LABEL_CLASS}>마케팅 정보 수신 동의</p>
            <p className="text-sm font-medium leading-[20px] text-disabled">
              (신규 매체, 이벤트 및 서비스 소식을 받아보실 수 있습니다.)
            </p>
          </div>
          <Switch
            checked={marketing}
            onCheckedChange={handleMarketing}
            disabled={updateProfile.isPending}
          />
        </div>
      </div>

      <div className="flex flex-col gap-[12px] rounded-[12px] border border-stroke p-[16px] sm:flex-row sm:items-center sm:gap-[24px] sm:px-[24px] sm:py-[32px]">
        <div className="flex min-w-0 flex-1 flex-col gap-[8px]">
          <p className="text-[18px] font-semibold leading-[28px] tracking-[-0.04px] text-black sm:text-[24px] sm:leading-[32px] sm:tracking-[-0.1px]">
            회원 탈퇴
          </p>
          <p className="text-sm font-medium leading-[20px] text-disabled sm:text-base sm:leading-[24px]">
            계정을 삭제하면 모든 데이터를 복구할 수 없게 됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={handleWithdraw}
          className="w-full shrink-0 cursor-pointer rounded-[8px] border border-red-400 bg-white px-[12px] py-[8px] text-sm font-medium text-red-400 sm:w-auto sm:px-[16px] sm:py-[12px] sm:text-base"
        >
          회원 탈퇴
        </button>
      </div>

      <PasswordChangeModal
        open={openModal === "password"}
        onOpenChange={(value) => !value && closeModal()}
      />
      <TextFieldModal
        key={`company-${companyName}`}
        open={openModal === "company"}
        onOpenChange={(value) => !value && closeModal()}
        title="회사 이름 변경"
        placeholder="회사 이름을 입력해 주세요"
        field="company_name"
        defaultValue={companyName}
      />
      <TextFieldModal
        key={`name-${name}`}
        open={openModal === "name"}
        onOpenChange={(value) => !value && closeModal()}
        title="이름 변경"
        placeholder="이름을 입력해 주세요"
        field="name"
        defaultValue={name}
      />
      <TextFieldModal
        key={`phone-${rawPhone}`}
        open={openModal === "phone"}
        onOpenChange={(value) => !value && closeModal()}
        title="전화번호 변경"
        placeholder="전화번호를 입력해 주세요 (- 없이 11자리)"
        field="phone"
        defaultValue={rawPhone}
        validate={(value) =>
          /^\d{11}$/.test(value)
            ? null
            : "전화번호는 '-' 없이 11자리 숫자로 입력해 주세요."
        }
        inputMode="numeric"
        maxLength={11}
      />
      <BusinessRegisterModal
        open={openModal === "business"}
        onOpenChange={(value) => !value && closeModal()}
        mode={bizStatus === "unregistered" ? "register" : "change"}
      />
      <ContactEmailChangeModal
        open={openModal === "email"}
        onOpenChange={(value) => !value && closeModal()}
      />

      {confirmDialog}
    </div>
  );
}
