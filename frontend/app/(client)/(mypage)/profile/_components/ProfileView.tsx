"use client";

import {
  Button,
  Card,
  Chip,
  Input,
  Popover,
  Spinner,
  Switch,
  Tooltip,
} from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";

import {
  CircleCheckIcon,
  FileTypeIcon,
  KakaoBrandIcon,
  MailIcon,
  NaverBrandIcon,
  ProfileBadgeIcon,
  VerifiedBadgeIcon,
  XIcon,
} from "@/components/icons";
import {
  authKeys,
  useCancelBusinessRegistration,
  useMe,
  useUpdateProfile,
  useUploadBusinessRegistration,
  useWithdraw,
} from "@/hooks/auth";
import { useAlertConfirm } from "@/hooks/useAlertConfirm";
import { useSonner } from "@/hooks/useSonner";
import { API_BASE_URL } from "@/lib/api";
import { avatarColorClass } from "@/lib/avatarColor";
import { extractApiError } from "@/lib/apiError";
import { formatDate } from "@/lib/date";
import { MEMBER_CATEGORIES, type MemberCategory } from "@/lib/memberCategory";
import {
  formatPhone,
  formatPhoneInput,
  isValidPhone,
  PHONE_ERROR_MESSAGE,
  PHONE_INPUT_MAX_LENGTH,
} from "@/lib/phone";
import { clearUserToken } from "@/lib/userToken";
import { cn } from "@/lib/utils";

import { ContactEmailChangeModal } from "./ContactEmailChangeModal";
import { PasswordChangeModal } from "./PasswordChangeModal";

/*
 * 피그마 "10_My_Profile"(ADMIX Wireframe) 기준.
 * - 계정 정보: 가입 시 확인된 값(읽기 전용).
 * - 회원 정보: 이름·전화번호·회사 이름은 "수정"을 눌러 그 자리에서 고치고, 사업자등록증 파일과
 *   마케팅 수신 동의까지 모아 아래 "저장하기"로 한 번에 저장한다. 연락받을 이메일·비밀번호는
 *   인증이 필요해 기존 모달로 바꾼다.
 * 겉모양은 ADMIX 톤 — 연회색 바탕 위 둥근 흰 카드, 검색바와 같은 회색 입력칸(선택·수정 중엔 흰색),
 * 보라는 강조(아바타·저장하기·스위치·상태)에만 쓴다. 문구는 "~어요" 말투.
 * 곡률 규칙: 높이/2 - 3px (입력칸·큰 버튼 40px → 17px, 작은 버튼 32px → 13px).
 */

type EditableKey = "name" | "phone" | "company_name";

const FIELD_LABEL: Record<EditableKey, string> = {
  name: "이름",
  phone: "전화번호",
  company_name: "회사 이름",
};

type ChipColor = "default" | "accent" | "success" | "warning" | "danger";

// 회원 유형마다 배지 색을 달리한다.
const CATEGORY_COLOR: Record<MemberCategory, ChipColor> = {
  advertiser: "accent",
  agency: "success",
  media_owner: "warning",
  general: "default",
};

/** 파일 상태 — 저장 대기(아직 안 올림)·검토 중·인증 완료·인증 반려. */
type FileStatus = "waiting" | "reviewing" | "verified" | "rejected";

const BIZ_BADGE: Record<string, { label: string; status: FileStatus }> = {
  reviewing: { label: "검토 중", status: "reviewing" },
  verified: { label: "인증 완료", status: "verified" },
  rejected: { label: "인증 반려", status: "rejected" },
};

/** 가입 방법 아이콘 — 이메일 가입은 봉투, 카카오·네이버 가입은 각 브랜드 로고(브랜드 색 원). */
function SignupMethodIcon({ provider }: { provider: string | null }) {
  const circle =
    "flex size-[18px] shrink-0 items-center justify-center rounded-full";
  if (provider === "kakao")
    return (
      <span
        role="img"
        aria-label="카카오 가입"
        className={cn(circle, "bg-[#FEE500]")}
      >
        <KakaoBrandIcon className="size-[11px] text-[#3c1e1e]" />
      </span>
    );
  if (provider === "naver")
    return (
      <span
        role="img"
        aria-label="네이버 가입"
        className={cn(circle, "bg-[#03C75A]")}
      >
        <NaverBrandIcon className="size-[9px] text-white" />
      </span>
    );
  return (
    <span
      role="img"
      aria-label="이메일 가입"
      className={cn(circle, "bg-black-100")}
    >
      <MailIcon className="size-[11px] text-black-500" />
    </span>
  );
}

const SNS_LABEL: Record<string, string> = { kakao: "카카오", naver: "네이버" };

/** 백엔드 LICENSE_ALLOWED_EXTENSIONS / LICENSE_MAX_UPLOAD_SIZE 와 같다. */
const FILE_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg"];
const FILE_ACCEPT = "application/pdf,image/png,image/jpeg";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 회색 입력칸과 구분되게 흰 바탕 + 테두리(outline)로 둔다.
const SMALL_BUTTON =
  "h-[32px] min-w-0 shrink-0 rounded-[13px] border border-black-200 bg-white px-[12px] text-[13px] font-medium text-black-700 data-[hovered=true]:bg-black-50 max-sm:text-[12px]";
// 파일 선택은 "수정"(흰 바탕 테두리)과 구분되게 테두리 없는 회색 바탕으로 둔다.
const UPLOAD_BUTTON =
  "h-[32px] min-w-0 shrink-0 rounded-[13px] bg-black-200 px-[14px] text-[13px] font-medium text-black-800 data-[hovered=true]:bg-black-300 max-sm:h-[30px] max-sm:rounded-[12px] max-sm:text-[12px]";
// "수정"과 X(취소)가 같은 자리에서 바뀌므로 폭을 고정해 입력칸 폭이 흔들리지 않게 한다.
const EDIT_TOGGLE_WIDTH = "w-[56px] px-0";
// 입력칸 옆 버튼은 입력칸(40px)과 높이·곡률을 맞춘다.
// 모바일은 입력칸이 36px이라 같이 줄인다(곡률 36/2-3 = 15px).
const FIELD_BUTTON = cn(
  SMALL_BUTTON,
  "h-[40px] rounded-[17px] px-[14px] max-sm:h-[36px] max-sm:rounded-[15px] max-sm:px-[12px]",
);
const FOOTER_BUTTON =
  "h-[40px] rounded-[17px] text-[14px] font-semibold max-sm:h-[36px] max-sm:rounded-[15px] max-sm:text-[13px]";
// 읽기 전용일 땐 검색바처럼 회색 칸, 고치는 중엔 흰 바탕 + 옅은 보라 테두리.
const FIELD_INPUT =
  "h-[40px] w-full rounded-[17px] border px-[16px] text-[14px] text-black-900 transition-colors [box-shadow:none]! placeholder:text-black-400 max-sm:h-[36px] max-sm:rounded-[15px] max-sm:px-[14px] max-sm:text-[13px]";
const FIELD_READONLY = "cursor-default border-transparent bg-black-100";
const FIELD_EDITING = "border-primary-300 bg-white focus:border-focus";

/** 작은 배지 — HeroUI Chip(soft). */
function Badge({
  children,
  color = "default",
}: {
  children: ReactNode;
  color?: ChipColor;
}) {
  return (
    // 높이는 옆 사업자 인증 배지 아이콘(22px)과 맞춘다.
    <Chip
      size="sm"
      variant="soft"
      color={color}
      className="h-[22px] shrink-0 py-0"
    >
      {children}
    </Chip>
  );
}

/** 번지는 점 — 기다리는 상태(저장 대기·검토 중)를 보인다. */
function PulseDot({ ring, dot }: { ring: string; dot: string }) {
  return (
    <span aria-hidden className="relative flex size-[6px]">
      <span
        className={cn(
          "absolute inline-flex size-full animate-ping rounded-full opacity-75 [animation-duration:1.6s]",
          ring,
        )}
      />
      <span
        className={cn("relative inline-flex size-[6px] rounded-full", dot)}
      />
    </span>
  );
}

/**
 * 파일 상태 배지 — 칸·테두리 없이 아이콘과 글자만 보인다. 옆 휴지통 버튼(32px)과 높이를 맞춘다.
 * 기다리는 상태는 번지는 점(저장 대기 회색, 검토 중 노랑), 끝난 상태는 아이콘(인증 완료 초록 체크,
 * 인증 반려 빨간 X)으로 구분한다.
 */
function StatusBadge({
  status,
  children,
}: {
  status: FileStatus;
  children: ReactNode;
}) {
  const icon = {
    waiting: <PulseDot ring="bg-black-300" dot="bg-black-400" />,
    reviewing: <PulseDot ring="bg-[#fbbf24]" dot="bg-[#f59e0b]" />,
    verified: <CircleCheckIcon aria-hidden className="size-[14px]" />,
    rejected: (
      <span
        aria-hidden
        className="flex size-[14px] items-center justify-center rounded-full bg-current"
      >
        <XIcon className="size-[9px] text-white" />
      </span>
    ),
  }[status];
  return (
    <Chip
      size="sm"
      variant="soft"
      className={cn(
        "h-[32px] shrink-0 gap-[6px] bg-transparent px-[4px]",
        status === "verified"
          ? "text-[#16a34a]"
          : status === "rejected"
            ? "text-[#dc2626]"
            : "text-black-600",
      )}
    >
      {icon}
      <Chip.Label>{children}</Chip.Label>
    </Chip>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="w-full gap-0 rounded-[20px] border border-black-200 bg-white px-[16px] pt-[16px] pb-[4px] shadow-none sm:px-[28px] sm:pt-[24px] sm:pb-[8px]">
      <h2 className="pb-[10px] text-[15px] leading-[20px] font-bold text-black-900 sm:pb-[12px] sm:text-[17px] sm:leading-[24px]">
        {title}
      </h2>
      {children}
    </Card>
  );
}

/** 한 줄 항목 — 왼쪽 150px 이름, 오른쪽 내용. 좁은 화면에선 위아래로 쌓는다. */
function Field({
  label,
  children,
  alignTop,
  required,
}: {
  label: string;
  children: ReactNode;
  alignTop?: boolean;
  required?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-[6px] border-t border-black-100 py-[12px] sm:flex-row sm:gap-[16px] sm:py-[16px]",
        alignTop ? "sm:items-start" : "sm:items-center",
      )}
    >
      <p
        className={cn(
          "shrink-0 text-[12px] font-medium text-black-500 sm:w-[140px] sm:text-[13px]",
          alignTop && "sm:pt-[12px]",
        )}
      >
        {label}
        {required && (
          <span className="ml-[4px] font-bold text-[#e23535]">*</span>
        )}
      </p>
      <div className="flex min-w-0 flex-1 items-center gap-[8px]">
        {children}
      </div>
    </div>
  );
}

export function ProfileView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const updateProfile = useUpdateProfile();
  const uploadBiz = useUploadBusinessRegistration();
  const cancelBiz = useCancelBusinessRegistration();
  const withdraw = useWithdraw();
  const { confirm, confirmDialog } = useAlertConfirm();
  const { success, error: toastError } = useSonner();

  const [modal, setModal] = useState<"password" | "email" | null>(null);

  // 저장 전 고친 값(수정 중인 항목만 담긴다). 저장하거나 취소하면 비운다.
  const [drafts, setDrafts] = useState<Partial<Record<EditableKey, string>>>(
    {},
  );
  const [marketingDraft, setMarketingDraft] = useState<boolean | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRefs = useRef<Partial<Record<EditableKey, HTMLInputElement>>>({});

  const snsProvider = me?.sns_provider ?? null;
  const saved: Record<EditableKey, string> = {
    name: me?.name?.trim() ?? "",
    phone: me?.phone ?? "",
    company_name: me?.company_name ?? "",
  };
  const savedMarketing = me?.marketing_consent ?? false;
  const marketing = marketingDraft ?? savedMarketing;

  const category = MEMBER_CATEGORIES.find(
    (c) => c.value === me?.member_category,
  );
  // 일반 회원은 사업자가 아니라 사업자등록증 항목을 숨긴다.
  const isGeneral = me?.member_category === "general";
  const bizReg = me?.business_registration ?? null;
  const bizStatus = bizReg?.status ?? "unregistered";
  const bizFileUrl = bizReg?.license_file_url
    ? `${API_BASE_URL}${bizReg.license_file_url}`
    : null;

  const changedFields = (Object.keys(drafts) as EditableKey[]).filter(
    (key) => (drafts[key] ?? "").trim() !== saved[key],
  );
  const dirty =
    changedFields.length > 0 ||
    (marketingDraft !== null && marketingDraft !== savedMarketing) ||
    pendingFile !== null;
  const saving = updateProfile.isPending || uploadBiz.isPending;

  const startEdit = (key: EditableKey) => {
    setDrafts((prev) => ({
      ...prev,
      [key]:
        prev[key] ??
        (key === "phone" ? saved.phone.replace(/\D/g, "") : saved[key]),
    }));
    // 읽기 전용이 풀린 뒤 바로 입력할 수 있게 포커스를 옮긴다.
    requestAnimationFrame(() => inputRefs.current[key]?.focus());
  };

  const cancelEdit = (key: EditableKey) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (key === "phone") setPhoneError(null);
  };

  const resetAll = () => {
    setDrafts({});
    setMarketingDraft(null);
    setPendingFile(null);
    setFileError(null);
    setPhoneError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const pickFile = (file: File | null) => {
    if (!file) return;
    // 끌어다 놓은 파일은 MIME이 비어 있을 수 있어 확장자로 확인한다.
    const name = file.name.toLowerCase();
    if (!FILE_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      setFileError("PDF, PNG, JPG 파일만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError("파일 크기는 10MB 이하만 가능합니다.");
      return;
    }
    setFileError(null);
    setPendingFile(file);
  };

  const handleSave = async () => {
    const payload: {
      name?: string;
      phone?: string;
      company_name?: string;
      marketing_consent?: boolean;
    } = {};
    for (const key of changedFields) payload[key] = (drafts[key] ?? "").trim();
    if (payload.phone !== undefined && !isValidPhone(payload.phone)) {
      setPhoneError(PHONE_ERROR_MESSAGE);
      return;
    }
    if (marketingDraft !== null && marketingDraft !== savedMarketing)
      payload.marketing_consent = marketingDraft;

    // 토스트 둘째 줄에 무엇이 바뀌었는지 적는다(예: "이름, 전화번호, 마케팅 정보 수신 동의").
    const savedItems = [
      ...changedFields.map((key) => FIELD_LABEL[key]),
      ...(payload.marketing_consent === undefined
        ? []
        : [
            payload.marketing_consent
              ? "마케팅 정보 수신 동의"
              : "마케팅 정보 수신 동의 철회",
          ]),
      ...(pendingFile ? ["사업자등록증(검토 요청)"] : []),
    ];

    try {
      if (Object.keys(payload).length > 0)
        await updateProfile.mutateAsync(payload);
      if (pendingFile) await uploadBiz.mutateAsync(pendingFile);
      await queryClient.invalidateQueries({ queryKey: authKeys.me });
      resetAll();
      success("회원 정보를 저장했어요", savedItems.join(", "));
    } catch (caught) {
      const status = (caught as { response?: { status?: number } })?.response
        ?.status;
      if (status === 409) setPhoneError("이미 사용 중인 전화번호입니다.");
      else
        toastError(
          "회원 정보를 저장하지 못했어요",
          extractApiError(caught, "잠시 후 다시 시도해 주세요."),
        );
    }
  };

  const handleCancelBiz = async () => {
    const ok = await confirm({
      title: "사업자등록증을 삭제할까요?",
      description: (
        <p>
          검토가 취소되고 업로드한 파일이 삭제돼요.
          <br />
          다시 등록해야 합니다.
        </p>
      ),
      confirmText: "삭제",
      destructive: true,
    });
    if (!ok) return;
    try {
      await cancelBiz.mutateAsync();
    } catch {
      await confirm({
        title: "삭제에 실패했습니다.",
        description: "잠시 후 다시 시도해 주세요.",
        alertOnly: true,
      });
    }
  };

  const handleWithdraw = async () => {
    const ok = await confirm({
      title: "정말 탈퇴하시겠어요?",
      description: (
        <>
          탈퇴하면 계정을{" "}
          <span className="text-danger">다시 되돌릴 수 없어요.</span>
          <br />
          모든 데이터는 <span className="text-black-800">30일 이내</span>에
          완전히 지워져요.
        </>
      ),
      confirmText: "탈퇴하기",
      destructive: true,
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
        alertOnly: true,
      });
    }
  };

  /** 이름·전화번호·회사 이름 — 평소엔 읽기 전용, "수정"을 누르면 그 자리에서 고친다. */
  const editableField = (
    key: EditableKey,
    label: string,
    options?: { numeric?: boolean; placeholder?: string; required?: boolean },
  ) => {
    const editing = drafts[key] !== undefined;
    // 전화번호는 숫자만 담아 두고, 보여 줄 때만 '-'를 넣는다(입력 중에도 자릿수에 맞춰 바로).
    const value =
      key === "phone"
        ? editing
          ? formatPhoneInput(drafts.phone ?? "")
          : formatPhone(saved.phone)
        : editing
          ? (drafts[key] ?? "")
          : saved[key];
    const invalid = key === "phone" && !!phoneError;
    return (
      <Field label={label} required={options?.required}>
        <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
          <Input
            ref={(el) => {
              if (el) inputRefs.current[key] = el;
            }}
            aria-label={label}
            value={value}
            readOnly={!editing}
            placeholder={options?.placeholder ?? "미입력"}
            inputMode={options?.numeric ? "numeric" : undefined}
            maxLength={key === "phone" ? PHONE_INPUT_MAX_LENGTH : undefined}
            onChange={(event) => {
              const next =
                key === "phone"
                  ? formatPhoneInput(event.target.value).replace(/\D/g, "")
                  : event.target.value;
              setDrafts((prev) => ({ ...prev, [key]: next }));
              if (key === "phone") setPhoneError(null);
            }}
            className={cn(
              FIELD_INPUT,
              editing ? FIELD_EDITING : FIELD_READONLY,
              invalid && "border-danger bg-white",
            )}
          />
          {invalid && (
            <p className="text-[12px] text-danger max-sm:text-[11px]">
              {phoneError}
            </p>
          )}
        </div>
        {/* 고치는 중엔 같은 자리에 X(취소) — 이 항목만 저장된 값으로 되돌린다. */}
        {editing ? (
          <Button
            isIconOnly
            variant="outline"
            aria-label={`${label} 수정 취소`}
            onPress={() => cancelEdit(key)}
            className={cn(FIELD_BUTTON, EDIT_TOGGLE_WIDTH)}
          >
            <XIcon className="size-[16px] text-black-500" />
          </Button>
        ) : (
          <Button
            variant="outline"
            onPress={() => startEdit(key)}
            className={cn(FIELD_BUTTON, EDIT_TOGGLE_WIDTH)}
          >
            수정
          </Button>
        )}
      </Field>
    );
  };

  // 회원 정보를 불러오기 전이나 로그아웃 직후(캐시가 비워진 뒤 홈으로 넘어가기 전)엔
  // 가입 방법을 몰라 아바타가 기본 보라로 잠깐 보인다. 그동안은 로딩만 보여 준다.
  if (!me) {
    return (
      <div className="flex min-h-full items-center justify-center bg-black-50">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-black-50">
      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-[12px] px-[16px] py-[16px] sm:gap-[16px] sm:px-[24px] sm:pt-[56px] sm:pb-[64px]">
        <header className="flex flex-col gap-[4px] pb-[4px] sm:gap-[6px] sm:pb-[8px]">
          <h1 className="text-[20px] leading-[28px] font-bold text-black-900 sm:text-[26px] sm:leading-[34px]">
            회원 정보
          </h1>
          <p className="text-[12px] text-black-500 sm:text-[14px]">
            계정과 회원 정보를 확인하고 바꿀 수 있어요.
          </p>
        </header>

        {/* 계정 정보 — 가입 때 정해진 값(읽기 전용)을 프로필 카드로 보여 준다. */}
        <Card className="w-full gap-0 rounded-[20px] border border-black-200 bg-white p-[16px] shadow-none sm:p-[28px]">
          <div className="flex items-center gap-[12px] sm:gap-[20px]">
            <ProfileBadgeIcon
              aria-hidden
              className={cn(
                "size-[48px] shrink-0 sm:size-[68px]",
                avatarColorClass(snsProvider),
              )}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-[4px] sm:gap-[6px]">
              <div className="flex min-w-0 flex-wrap items-center gap-[6px] sm:gap-[8px]">
                <p className="truncate text-[15px] leading-[20px] font-bold text-black-900 sm:text-[20px] sm:leading-[28px]">
                  {saved.name || "이름 미입력"}
                </p>
                <Badge
                  color={category ? CATEGORY_COLOR[category.value] : "default"}
                >
                  {category?.label ?? "-"}
                </Badge>
                {/* 사업자 인증 완료 — 초록 인증 배지 아이콘만 두고 설명은 툴팁으로. 키보드로도 열리게 포커스를 받는다.
                    터치 기기(모바일)는 hover가 없어 툴팁이 뜨지 않으므로, 눌러서 여는 팝오버로 대신한다. */}
                {bizStatus === "verified" && (
                  <>
                    <Tooltip delay={0}>
                      <Tooltip.Trigger
                        tabIndex={0}
                        aria-label="사업자 인증 완료"
                        className="flex shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a]/40 max-sm:hidden"
                      >
                        <VerifiedBadgeIcon className="size-[22px] text-[#16a34a]" />
                      </Tooltip.Trigger>
                      <Tooltip.Content>사업자 인증 완료</Tooltip.Content>
                    </Tooltip>
                    <Popover>
                      <Button
                        isIconOnly
                        variant="ghost"
                        aria-label="사업자 인증 완료"
                        className="size-[18px] min-w-0 shrink-0 rounded-full p-0 data-[hovered=true]:bg-transparent sm:hidden"
                      >
                        <VerifiedBadgeIcon className="m-0 size-[18px] text-[#16a34a]" />
                      </Button>
                      <Popover.Content
                        placement="top"
                        className="rounded-[12px]"
                      >
                        <Popover.Dialog className="px-[10px] py-[6px] text-[12px] font-medium text-black-900">
                          사업자 인증 완료
                        </Popover.Dialog>
                      </Popover.Content>
                    </Popover>
                  </>
                )}
              </div>
              <div className="flex min-w-0 items-center gap-[6px]">
                <SignupMethodIcon provider={snsProvider} />
                <p className="min-w-0 truncate text-[13px] leading-[18px] text-black-600 sm:text-[14px] sm:leading-[24px]">
                  {me?.login_id ?? "-"}
                </p>
              </div>
              {me?.created_at && (
                <p className="text-[11px] leading-[16px] text-black-400 sm:text-[12px] sm:leading-[24px]">
                  {formatDate(me.created_at)} 가입
                </p>
              )}
            </div>
          </div>
        </Card>

        <SectionCard title="회원 정보">
          <Field label="연락받을 이메일" required>
            <Input
              aria-label="연락받을 이메일"
              value={me?.email ?? ""}
              readOnly
              className={cn(FIELD_INPUT, FIELD_READONLY)}
            />
            {/* 이메일 가입 계정은 연락받을 이메일 = 가입 아이디라 변경 불가. SNS 계정만 인증 후 변경. */}
            {snsProvider && (
              <Button
                variant="outline"
                onPress={() => setModal("email")}
                className={cn(FIELD_BUTTON, EDIT_TOGGLE_WIDTH)}
              >
                수정
              </Button>
            )}
          </Field>

          {editableField("name", "이름", { required: true })}

          {/* SNS 로그인 계정은 비밀번호가 없어 안내만 보여 주고 변경 버튼은 숨긴다. */}
          <Field label="비밀번호">
            <Input
              aria-label="비밀번호"
              value={snsProvider ? "" : "••••••••"}
              placeholder={
                snsProvider
                  ? `${SNS_LABEL[snsProvider] ?? "SNS"} 로그인 계정은 비밀번호가 없어요`
                  : undefined
              }
              readOnly
              className={cn(
                FIELD_INPUT,
                FIELD_READONLY,
                !snsProvider && "tracking-[2px]",
              )}
            />
            {!snsProvider && (
              <Button
                variant="outline"
                onPress={() => setModal("password")}
                className={FIELD_BUTTON}
              >
                비밀번호 변경
              </Button>
            )}
          </Field>

          {editableField("phone", "전화번호", {
            numeric: true,
            placeholder: "숫자만 입력해 주세요",
            required: true,
          })}
          {editableField("company_name", "회사 이름")}

          {!isGeneral && (
            <Field label="사업자등록증" alignTop>
              <div className="flex min-w-0 flex-1 flex-col gap-[10px]">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={FILE_ACCEPT}
                  className="hidden"
                  onChange={(event) =>
                    pickFile(event.target.files?.[0] ?? null)
                  }
                />
                {/* 끌어다 놓거나 "파일 선택"으로 고른다. 고른 파일은 "저장하기" 때 올라간다. */}
                <div
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    pickFile(event.dataTransfer.files?.[0] ?? null);
                  }}
                  className={cn(
                    "flex w-full flex-col items-center gap-[4px] rounded-[18px] border border-dashed px-[14px] py-[16px] text-center transition-colors sm:gap-[6px] sm:px-[20px] sm:py-[22px]",
                    dragging
                      ? "border-primary-300 bg-primary-50"
                      : "border-black-200 bg-black-50",
                  )}
                >
                  <span className="flex size-[36px] items-center justify-center rounded-full bg-white sm:size-[44px]">
                    <Image
                      src="/icons/upload.svg"
                      alt=""
                      width={16}
                      height={20}
                    />
                  </span>
                  <p className="text-[13px] font-semibold text-black-900 sm:text-[14px]">
                    사업자등록증 파일을 올려 주세요
                  </p>
                  <p className="pb-[6px] text-[11px] text-black-400 sm:text-[12px]">
                    끌어다 놓거나 파일을 골라 주세요 · 최대 10MB, PDF·PNG·JPG만
                    가능해요
                  </p>
                  <Button
                    variant="secondary"
                    onPress={() => fileInputRef.current?.click()}
                    className={UPLOAD_BUTTON}
                  >
                    파일 선택
                  </Button>
                </div>

                {pendingFile ? (
                  <FileRow
                    name={pendingFile.name}
                    meta={formatSize(pendingFile.size)}
                    badge={{ label: "저장 대기", status: "waiting" }}
                    onRemove={() => {
                      setPendingFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    removeLabel="삭제"
                  />
                ) : (
                  bizReg?.license_file_name && (
                    <FileRow
                      name={bizReg.license_file_name}
                      href={bizFileUrl}
                      meta={
                        bizReg.license_uploaded_at
                          ? formatDate(bizReg.license_uploaded_at)
                          : undefined
                      }
                      badge={BIZ_BADGE[bizStatus]}
                      // 검토 중일 때만 취소(삭제)할 수 있다. 인증·반려 뒤엔 새 파일로 바꾼다.
                      onRemove={
                        bizStatus === "reviewing" ? handleCancelBiz : undefined
                      }
                      removeLabel="삭제"
                      removeDisabled={cancelBiz.isPending}
                    />
                  )
                )}

                {fileError && (
                  <p className="text-[12px] text-danger max-sm:text-[11px]">
                    {fileError}
                  </p>
                )}
                {bizStatus === "rejected" && bizReg?.reject_reason && (
                  <p className="text-[12px] text-danger max-sm:text-[11px]">
                    반려 사유: {bizReg.reject_reason}
                  </p>
                )}
                <p className="text-[11px] text-black-400 sm:text-[12px]">
                  저장하면 검토 후 3영업일 이내에 반영돼요.
                </p>
              </div>
            </Field>
          )}

          <Field label="마케팅 정보 수신 동의">
            {/* 켜짐 손잡이 색(accent-foreground)이 globals.css에서 shadcn 진보라로 덮여 있어
                흰색으로 되돌린다(간략히보기 토글과 같은 처리). */}
            {/* 모바일은 스위치 옆엔 제목만 두고, 설명은 그 아래 한 줄로 폭 전체를 쓴다. */}
            <div className="flex min-w-0 flex-col gap-[6px]">
              <Switch
                isSelected={marketing}
                onChange={setMarketingDraft}
                className="group gap-[12px]"
              >
                <Switch.Content className="items-center gap-[12px]">
                  <Switch.Control className="bg-[#d4d4d8]! group-data-[selected=true]:bg-primary!">
                    <Switch.Thumb className="bg-white!" />
                  </Switch.Control>
                  <span className="flex flex-col gap-[2px] text-left">
                    <span className="text-[13px] font-medium text-black-900 sm:text-[14px]">
                      마케팅 정보 수신에 동의해요
                    </span>
                    <span className="text-[11px] text-black-400 max-sm:hidden sm:text-[12px]">
                      새로운 매체와 프로모션 소식을 이메일로 받아볼 수 있어요.
                    </span>
                  </span>
                </Switch.Content>
              </Switch>
              <p className="text-[11px] text-black-400 sm:hidden">
                새로운 매체와 프로모션 소식을 이메일로 받아볼 수 있어요.
              </p>
            </div>
          </Field>

          <div className="flex justify-end gap-[8px] border-t border-black-100 py-[12px] sm:py-[16px]">
            <Button
              variant="tertiary"
              isDisabled={!dirty || saving}
              onPress={resetAll}
              // 모바일은 취소:저장 = 3:7로 폭을 꽉 채운다.
              className={cn(
                FOOTER_BUTTON,
                "w-[96px] max-sm:w-auto max-sm:flex-[3]",
              )}
            >
              취소
            </Button>
            <Button
              variant="primary"
              isDisabled={!dirty}
              isPending={saving}
              onPress={handleSave}
              className={cn(
                FOOTER_BUTTON,
                "w-[120px] bg-primary text-white max-sm:w-auto max-sm:flex-[7]",
              )}
            >
              저장하기
            </Button>
          </div>
        </SectionCard>

        {/* 회원 탈퇴는 눈에 띄지 않게 카드 아래 작은 글자 링크로 둔다. 자세한 안내는 확인창에서. */}
        <div className="flex justify-end px-[4px]">
          <button
            type="button"
            onClick={handleWithdraw}
            className="text-[12px] text-black-400 underline underline-offset-[3px] sm:text-[13px] transition-colors hover:text-black-600"
          >
            회원 탈퇴
          </button>
        </div>

        <PasswordChangeModal
          open={modal === "password"}
          onOpenChange={(open) => !open && setModal(null)}
        />
        <ContactEmailChangeModal
          open={modal === "email"}
          onOpenChange={(open) => !open && setModal(null)}
        />
        {confirmDialog}
      </div>
    </div>
  );
}

/** 파일 이름의 확장자를 아이콘용 글자로 — "a.jpeg" → "JPG". */
function fileExt(name: string): string {
  const ext = name.split(".").pop()?.toUpperCase() ?? "";
  return ext === "JPEG" ? "JPG" : ext.slice(0, 4);
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)}MB`
    : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

/** 파일 한 줄 — 파일 아이콘·이름·부가 정보, 오른쪽 상태 배지와 휴지통(삭제) 버튼. */
function FileRow({
  name,
  href,
  meta,
  badge,
  onRemove,
  removeLabel,
  removeDisabled,
}: {
  name: string;
  href?: string | null;
  meta?: string;
  badge?: { label: string; status: FileStatus };
  onRemove?: () => void;
  removeLabel: string;
  removeDisabled?: boolean;
}) {
  const title = (
    <span className="min-w-0 truncate text-[12px] font-medium text-black-900 sm:text-[13px]">
      {name}
    </span>
  );
  return (
    // 모바일은 폭이 좁아 첫 줄엔 아이콘·파일 이름만 두고, 용량·상태·삭제는 둘째 줄로 내린다.
    <div className="flex w-full items-center gap-[10px] rounded-[18px] border border-black-200 bg-white py-[10px] pr-[10px] pl-[12px] max-sm:flex-wrap max-sm:gap-y-[4px]">
      <div className="flex min-w-0 items-center gap-[10px] max-sm:basis-full">
        <span className="flex size-[36px] shrink-0 items-center justify-center rounded-[13px] bg-black-100 text-black-500">
          <FileTypeIcon ext={fileExt(name)} className="size-[26px]" />
        </span>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 truncate hover:underline"
          >
            {title}
          </a>
        ) : (
          title
        )}
      </div>
      {meta && (
        <span className="shrink-0 text-[11px] text-black-400 sm:text-[12px]">
          {meta}
        </span>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-[8px]">
        {badge && (
          <StatusBadge status={badge.status}>{badge.label}</StatusBadge>
        )}
        {onRemove && (
          <Button
            isIconOnly
            variant="ghost"
            aria-label={removeLabel}
            onPress={onRemove}
            isDisabled={removeDisabled}
            className="size-[32px] min-w-0 shrink-0 rounded-[13px] p-0 data-[hovered=true]:bg-[#fef2f2]"
          >
            <Image src="/icons/trash.svg" alt="" width={18} height={18} />
          </Button>
        )}
      </div>
    </div>
  );
}
