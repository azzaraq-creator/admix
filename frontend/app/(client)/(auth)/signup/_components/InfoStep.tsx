"use client";

import {
  Button,
  Chip,
  Description,
  FieldError,
  Input,
  InputGroup,
  Separator,
  TextField,
} from "@heroui/react";
import { useState } from "react";

import {
  PASSWORD_RULES,
  RuleChip,
} from "@/components/common/PasswordRuleChips";
import { EyeIcon, InfoIcon } from "@/components/icons";
import { authApi, type ProfileUpdatePayload } from "@/hooks/auth";
import {
  PHONE_INPUT_MAX_LENGTH,
  formatPhoneInput,
  isValidPhone,
} from "@/lib/phone";
import { cn } from "@/lib/utils";

import { BizLicenseDropzone } from "./BizLicenseDropzone";
import { MatchCheckIcon, SmallCheckIcon } from "./signupIcons";
import {
  CardHeading,
  FieldLabel,
  FieldMessage,
  PrimaryAction,
  RADIUS,
  SignupCard,
} from "./signupUi";

export type SignupInfo = {
  password: string;
  passwordConfirm: string;
  name: string;
  phone: string;
  company: string;
  file: File | null;
  /**
   * 광고주 담당자 정보(선택) — 직함 · 소속팀. 가입 뒤 내 정보에 저장한다(명함은 내 정보에서).
   * 담당자 이름은 위 "이름" 칸과 겹쳐 가입에서는 받지 않는다(11-11 사용자) — 내 정보에서 적는다.
   */
  position: string;
  department: string;
};

export const EMPTY_SIGNUP_INFO: SignupInfo = {
  password: "",
  passwordConfirm: "",
  name: "",
  phone: "",
  company: "",
  file: null,
  position: "",
  department: "",
};

/** 가입 뒤 내 정보에 저장할 담당자 정보 — 적은 칸만(없으면 null, 저장 요청을 보내지 않는다). */
export function contactOf(info: SignupInfo): ContactInfo | null {
  const out: ContactInfo = {};
  if (info.position.trim()) out.position = info.position.trim();
  if (info.department.trim()) out.department = info.department.trim();
  return Object.keys(out).length ? out : null;
}

export type ContactInfo = Pick<ProfileUpdatePayload, "position" | "department">;

/** 비밀번호 칸 오른쪽 보기·숨기기 버튼 — InputGroup.Suffix 안에 둔다. */
function PasswordToggle({
  shown,
  onToggle,
}: {
  shown: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      isIconOnly
      variant="ghost"
      size="sm"
      aria-label={shown ? "비밀번호 숨기기" : "비밀번호 보기"}
      onPress={onToggle}
      className="size-[28px] min-w-0 rounded-[11px] text-zinc-400 data-[hovered=true]:text-zinc-900"
    >
      <EyeIcon off={shown} className="size-[16px]" />
    </Button>
  );
}

/** 4단계 — 시안(00. 회원가입 - 회원정보 입력). */
export function InfoStep({
  email,
  needPassword,
  showBizCert,
  partner = false,
  advertiser = false,
  initial,
  serverError,
  onNext,
}: {
  email: string;
  /** 카카오·네이버 가입은 비밀번호를 받지 않는다(시안 주석). */
  needPassword: boolean;
  /** 일반 회원에게는 사업자등록증 칸을 보이지 않는다. */
  showBizCert: boolean;
  /**
   * 제휴사(콜라보) — "정보 추가 입력"(회사명) · 사업자등록증 칸 없이 이름 · 연락처까지만.
   * 사업자등록증은 기본협약 협약서 단계에서 같은 모양(BizLicenseDropzone)으로 올린다(11-10 사용자).
   */
  partner?: boolean;
  /**
   * 광고주 — "정보 추가 입력" 상자 없이 회사명 · 직함 · 소속팀 · 사업자등록증을 다른 칸과 같은 모양으로
   * 잇는다(연락처 아래와 사업자등록증 위에 구분선). 모두 선택이라 * 도 "(선택)"도 붙이지 않고, 사업자등록증 아래에
   * 올리면 모든 기능을 쓸 수 있다고 잘 보이게, 검토 · 승인 최대 3일은 작게 알린다(11-09 · 11-11 사용자).
   * 브랜드 사진은 콜라보 "내 브랜드"로 옮겨 여기서 받지 않는다.
   */
  advertiser?: boolean;
  initial: SignupInfo;
  /** 가입 요청에서 돌아온 오류(예: 이미 가입된 전화번호). */
  serverError?: { field: "phone"; message: string } | null;
  onNext: (values: SignupInfo) => void;
}) {
  const [values, setValues] = useState<SignupInfo>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [fileError, setFileError] = useState("");
  // "다음"에서 확인한 전화번호 중복 결과 — 확인한 번호와 같을 때만 보여 준다.
  const [duplicatePhone, setDuplicatePhone] = useState<string | null>(null);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const set = <K extends keyof SignupInfo>(key: K, value: SignupInfo[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const passwordOk = PASSWORD_RULES.every((rule) => rule.test(values.password));
  const confirmFilled = values.passwordConfirm.length > 0;
  const passwordMatch =
    confirmFilled && values.password === values.passwordConfirm;

  const errors = {
    password:
      needPassword && !passwordOk ? "비밀번호 조건을 모두 충족해 주세요." : "",
    passwordConfirm:
      needPassword && !passwordMatch
        ? confirmFilled
          ? "비밀번호가 일치하지 않습니다."
          : "비밀번호를 한번 더 입력해 주세요."
        : "",
    name: values.name.trim() ? "" : "이름을 입력해 주세요.",
    // 공용 PHONE_ERROR_MESSAGE는 "'-' 없이"라 자동 '-' 입력칸과 맞지 않아 따로 쓴다.
    phone: isValidPhone(values.phone)
      ? ""
      : "전화번호를 9~11자리 숫자로 입력해 주세요.",
  };
  const valid = !Object.values(errors).some(Boolean);

  const handleNext = async () => {
    setSubmitted(true);
    if (!valid || checkingPhone) return;
    // 전화번호 중복을 약관 단계(가입 요청)까지 미루지 않고 여기서 먼저 확인한다.
    setCheckingPhone(true);
    try {
      if (!(await authApi.checkPhoneAvailable(values.phone))) {
        setDuplicatePhone(values.phone);
        return;
      }
    } catch {
      // 확인 요청이 실패하면 막지 않는다 — 가입 요청에서 한 번 더 검사한다.
    } finally {
      setCheckingPhone(false);
    }
    setDuplicatePhone(null);
    onNext(values);
  };

  const phoneServerError =
    duplicatePhone !== null && values.phone === duplicatePhone
      ? "이미 가입된 전화번호입니다."
      : serverError?.field === "phone" && values.phone === initial.phone
        ? serverError.message
        : "";

  /** 사업자등록증 칸 — 대행사 · 매체사는 "정보 추가 입력" 상자 안, 광고주는 다른 칸과 같은 이름표. 제휴사(콜라보)는 없다(기본협약에서 올린다). */
  const bizCert = (
    <div className="flex w-full flex-col gap-[8px]">
      {advertiser ? (
        <FieldLabel>사업자등록증</FieldLabel>
      ) : (
        <p className="flex items-center gap-[6px] text-[13px] font-medium text-gray-900">
          사업자등록증
        </p>
      )}
      <BizLicenseDropzone
        fileName={values.file?.name}
        onPick={(file) => {
          setFileError("");
          set("file", file);
        }}
        onError={setFileError}
        onRemove={() => set("file", null)}
      />
      {fileError && <FieldMessage tone="error">{fileError}</FieldMessage>}
      {advertiser ? (
        // 광고주 — 올리면 무엇이 좋은지 보라 글씨로(상자 없이, 안내 아이콘 = public/icons/info.svg 와 같은 도형),
        // 걸리는 시간은 그 아래 작게(11-11 사용자).
        <div className="flex flex-col gap-[4px]">
          <p className="flex items-start gap-[6px] text-[13px] leading-[20px] font-semibold break-keep text-primary-500">
            <InfoIcon aria-hidden className="mt-[3px] size-[14px] shrink-0" />
            사업자등록증을 올리면 admix의 모든 기능을 이용할 수 있습니다.
          </p>
          <p className="pl-[20px] text-[12px] break-keep text-gray-400">
            검토 및 승인까지 최대 3일이 걸립니다.
          </p>
        </div>
      ) : fileError ? null : (
        <FieldMessage>
          사업자등록증은 검토 후 3영업일 이내 담당자가 확인 후 반영이 됩니다.
        </FieldMessage>
      )}
    </div>
  );

  return (
    <SignupCard>
      <CardHeading
        title="회원정보를 입력해 주세요"
        description="가입 후 회원 정보에서 언제든 수정할 수 있습니다."
      />

      <form
        noValidate
        className="flex w-full flex-col gap-[16px]"
        onSubmit={(event) => {
          event.preventDefault();
          void handleNext();
        }}
      >
        <TextField value={email} isReadOnly fullWidth className="gap-[8px]">
          <FieldLabel required>이메일</FieldLabel>
          <InputGroup fullWidth className="h-[44px] rounded-[19px]">
            <InputGroup.Input />
            <InputGroup.Suffix>
              {/* 배지 20px → 곡률 7px. */}
              <Chip
                className={cn(
                  "h-[20px] gap-[4px] bg-tone-f0fdf4 py-0 pr-[10px] pl-[8px] text-[11px] font-semibold text-[#16a34a]",
                  RADIUS.h20,
                )}
              >
                인증 완료
                <SmallCheckIcon className="size-[10px]" />
              </Chip>
            </InputGroup.Suffix>
          </InputGroup>
        </TextField>

        {needPassword && (
          <>
            <TextField
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={values.password}
              onChange={(value) => set("password", value)}
              isInvalid={submitted && !!errors.password}
              fullWidth
              className="gap-[8px]"
            >
              <FieldLabel required>비밀번호</FieldLabel>
              <InputGroup fullWidth className="h-[44px] rounded-[19px]">
                <InputGroup.Input placeholder="영문, 숫자, 특수문자 포함 8자 이상" />
                <InputGroup.Suffix>
                  <PasswordToggle
                    shown={showPassword}
                    onToggle={() => setShowPassword((prev) => !prev)}
                  />
                </InputGroup.Suffix>
              </InputGroup>
              <div className="flex flex-wrap gap-[8px]">
                {PASSWORD_RULES.map((rule) => (
                  <RuleChip
                    key={rule.label}
                    label={rule.label}
                    state={
                      values.password
                        ? rule.test(values.password)
                          ? "ok"
                          : "fail"
                        : "idle"
                    }
                  />
                ))}
              </div>
            </TextField>

            <TextField
              type={showPasswordConfirm ? "text" : "password"}
              autoComplete="new-password"
              value={values.passwordConfirm}
              onChange={(value) => set("passwordConfirm", value)}
              isInvalid={
                (submitted || confirmFilled) && !!errors.passwordConfirm
              }
              fullWidth
              className="gap-[8px]"
            >
              <FieldLabel required>비밀번호 확인</FieldLabel>
              <InputGroup fullWidth className="h-[44px] rounded-[19px]">
                <InputGroup.Input placeholder="비밀번호를 한번 더 입력해 주세요." />
                <InputGroup.Suffix>
                  <PasswordToggle
                    shown={showPasswordConfirm}
                    onToggle={() => setShowPasswordConfirm((prev) => !prev)}
                  />
                </InputGroup.Suffix>
              </InputGroup>
              {passwordMatch ? (
                <div className="flex items-center justify-between">
                  <FieldMessage tone="success">
                    비밀번호가 일치합니다.
                  </FieldMessage>
                  <MatchCheckIcon className="size-[14px] text-[#16a34a]" />
                </div>
              ) : (
                <FieldError>{errors.passwordConfirm}</FieldError>
              )}
            </TextField>
          </>
        )}

        <TextField
          autoComplete="name"
          value={values.name}
          onChange={(value) => set("name", value)}
          isInvalid={submitted && !!errors.name}
          fullWidth
          className="gap-[8px]"
        >
          <FieldLabel required>이름</FieldLabel>
          <Input
            placeholder="이름을 입력해 주세요."
            className="h-[44px] rounded-[19px]"
          />
          <FieldError>{errors.name}</FieldError>
        </TextField>

        <TextField
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          maxLength={PHONE_INPUT_MAX_LENGTH}
          // 화면에는 '-'를 넣어 보여 주고, 값(전송·검사)은 숫자만 둔다.
          value={formatPhoneInput(values.phone)}
          // 02 번호는 10자리까지만 나뉘므로 화면에 보이는 숫자를 그대로 값으로 쓴다.
          onChange={(value) =>
            set("phone", formatPhoneInput(value).replace(/\D/g, ""))
          }
          isInvalid={(submitted && !!errors.phone) || !!phoneServerError}
          fullWidth
          className="gap-[8px]"
        >
          <FieldLabel required>연락처</FieldLabel>
          <Input
            placeholder="010-1234-5678"
            className="h-[44px] rounded-[19px]"
          />
          <FieldError>{phoneServerError || errors.phone}</FieldError>
          {!phoneServerError && !(submitted && errors.phone) && (
            <Description>
              {"숫자만 입력하면 '-'는 자동으로 들어갑니다."}
            </Description>
          )}
        </TextField>

        {/* 제휴사(콜라보)는 회사명 · 사업자등록증을 받지 않는다 — 사업자등록증은 기본협약 협약서 단계에서 올린다(11-10 사용자). */}
        {/* 광고주 — 구분선 · 회사명 · 담당자 정보(직함 · 소속팀) · 구분선 · 사업자등록증 순(11-11 사용자). */}
        {partner ? null : advertiser ? (
          <>
            <Separator className="my-[4px] bg-tone-ececef" />
            <TextField
              autoComplete="organization"
              value={values.company}
              onChange={(value) => set("company", value)}
              fullWidth
              className="gap-[8px]"
            >
              <FieldLabel>회사명</FieldLabel>
              <Input
                placeholder="회사명을 입력해 주세요."
                className="h-[44px] rounded-[19px]"
              />
            </TextField>
            <TextField
              autoComplete="organization-title"
              value={values.position}
              onChange={(value) => set("position", value)}
              fullWidth
              className="gap-[8px]"
            >
              <FieldLabel>직함</FieldLabel>
              <Input
                placeholder="직함을 입력해 주세요."
                maxLength={50}
                className="h-[44px] rounded-[19px]"
              />
            </TextField>
            <TextField
              autoComplete="off"
              value={values.department}
              onChange={(value) => set("department", value)}
              fullWidth
              className="gap-[8px]"
            >
              <FieldLabel>소속팀</FieldLabel>
              <Input
                placeholder="소속팀을 입력해 주세요."
                maxLength={50}
                className="h-[44px] rounded-[19px]"
              />
            </TextField>
            <Separator className="my-[4px] bg-tone-ececef" />
            {bizCert}
          </>
        ) : (
          <div className="flex w-full flex-col gap-[12px] rounded-[10px] border border-tone-ececef bg-surface p-[16px]">
            <p className="text-[13px] font-semibold text-zinc-900">
              정보 추가 입력
            </p>
            <TextField
              aria-label="회사명"
              autoComplete="organization"
              value={values.company}
              onChange={(value) => set("company", value)}
              fullWidth
            >
              <Input placeholder="회사명" className="h-[44px] rounded-[19px]" />
            </TextField>

            {showBizCert && bizCert}
          </div>
        )}

        <PrimaryAction type="submit" label="다음" pending={checkingPhone} />
      </form>
    </SignupCard>
  );
}
