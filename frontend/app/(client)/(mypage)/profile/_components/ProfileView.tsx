"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/common/buttons";
import { UserIcon } from "@/components/icons";
import { Switch } from "@/components/ui/switch";
import { authKeys, useMe } from "@/hooks/auth";
import { useConfirm } from "@/hooks/useConfirm";
import { clearUserToken } from "@/lib/userToken";

import { BusinessRegisterModal } from "./BusinessRegisterModal";
import { PasswordChangeModal } from "./PasswordChangeModal";
import { TextFieldModal } from "./TextFieldModal";

type ModalKey = "password" | "company" | "name" | "business";

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
const VALUE_CLASS = "text-base font-medium leading-[24px] text-[#737586]";
const ACTION_CLASS =
  "shrink-0 text-sm font-semibold leading-[20px] text-[#757575] underline sm:text-base sm:leading-[24px]";
const FIELD_CLASS = "flex min-w-0 flex-1 flex-col gap-[6px] sm:gap-[12px]";

export function ProfileView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const { confirm, confirmDialog } = useConfirm();
  const [marketingOverride, setMarketingOverride] = useState<boolean | null>(
    null,
  );
  const [openModal, setOpenModal] = useState<ModalKey | null>(null);

  const marketing = marketingOverride ?? me?.marketing_consent ?? false;

  const name = me?.name?.trim() ? me.name : "";
  const email = me?.email ?? "";
  const companyName = me?.company_name ?? "";
  const phone = formatPhone(me?.phone);

  const accountRows: { label: string; value: string; modal: ModalKey | null }[] =
    [
      { label: "비밀번호", value: "**********", modal: "password" },
      { label: "회사이름", value: companyName, modal: "company" },
      { label: "이름", value: name, modal: "name" },
      { label: "전화번호", value: phone, modal: null },
    ];

  const closeModal = () => setOpenModal(null);

  const handleLogout = () => {
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
    if (ok) router.push("/");
  };

  return (
    <div className="mx-auto flex w-full max-w-[1016px] flex-col gap-[16px] px-[16px] pb-[24px] pt-[24px] sm:gap-[24px] sm:px-[20px] sm:pb-[40px] sm:pt-[80px]">
      <div className="flex flex-col gap-[4px]">
        <p className="text-[20px] font-semibold leading-[28px] tracking-[-0.08px] text-black sm:text-[24px] sm:leading-[32px] sm:tracking-[-0.1px]">
          계정 정보
        </p>
        <p className="text-sm font-medium leading-[20px] text-[#737586] sm:text-base sm:leading-[24px]">
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
            <p className="truncate text-sm font-medium leading-[20px] text-[#737586] sm:text-base sm:leading-[24px]">
              {email}
            </p>
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
        <div className="flex flex-col gap-[6px] border-b border-[#e8e8e8] py-[12px] sm:gap-[12px] sm:py-[28px]">
          <p className={LABEL_CLASS}>아이디</p>
          <p className={VALUE_CLASS}>{email}</p>
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
          <div className={FIELD_CLASS}>
            <div className="flex items-center gap-[12px]">
              <p className={LABEL_CLASS}>사업자등록증</p>
              <span className="rounded-[6px] bg-[#f6f6f6] px-[10px] py-[4px] text-xs font-medium leading-[16px] tracking-[0.0048px] text-[#545454]">
                미등록
              </span>
            </div>
            <p className="text-sm font-medium leading-[20px] text-[#737586]">
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
        </div>

        <div className="flex items-center gap-[12px] py-[12px] sm:gap-[42px] sm:py-[28px]">
          <div className="flex min-w-0 flex-1 flex-col gap-[6px] sm:gap-[12px]">
            <p className={LABEL_CLASS}>마케팅 정보 수신 동의</p>
            <p className="text-sm font-medium leading-[20px] text-[#737586]">
              (신규 매체, 이벤트 및 서비스 소식을 받아보실 수 있습니다.)
            </p>
          </div>
          <Switch checked={marketing} onCheckedChange={setMarketingOverride} />
        </div>
      </div>

      <div className="flex flex-col gap-[12px] rounded-[12px] border border-stroke p-[16px] sm:flex-row sm:items-center sm:gap-[24px] sm:px-[24px] sm:py-[32px]">
        <div className="flex min-w-0 flex-1 flex-col gap-[8px]">
          <p className="text-[18px] font-semibold leading-[28px] tracking-[-0.04px] text-black sm:text-[24px] sm:leading-[32px] sm:tracking-[-0.1px]">
            회원 탈퇴
          </p>
          <p className="text-sm font-medium leading-[20px] text-[#737586] sm:text-base sm:leading-[24px]">
            계정을 삭제하면 모든 데이터를 복구할 수 없게 됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={handleWithdraw}
          className="w-full shrink-0 rounded-[8px] border border-[#ff6c64] bg-white px-[12px] py-[8px] text-sm font-medium text-[#ff6c64] sm:w-auto sm:px-[16px] sm:py-[12px] sm:text-base"
        >
          회원 탈퇴
        </button>
      </div>

      <PasswordChangeModal
        open={openModal === "password"}
        onOpenChange={(value) => !value && closeModal()}
      />
      <TextFieldModal
        open={openModal === "company"}
        onOpenChange={(value) => !value && closeModal()}
        title="회사 이름 변경"
        placeholder="회사 이름을 입력해 주세요"
        defaultValue={companyName}
      />
      <TextFieldModal
        open={openModal === "name"}
        onOpenChange={(value) => !value && closeModal()}
        title="이름 변경"
        placeholder="이름을 입력해 주세요"
        defaultValue={name}
      />
      <BusinessRegisterModal
        open={openModal === "business"}
        onOpenChange={(value) => !value && closeModal()}
      />

      {confirmDialog}
    </div>
  );
}
