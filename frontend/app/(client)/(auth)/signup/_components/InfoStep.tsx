"use client";

import {
  Button,
  Chip,
  Description,
  FieldError,
  Input,
  TextField,
} from "@heroui/react";
import { useRef, useState, type DragEvent } from "react";

import {
  PASSWORD_RULES,
  RuleChip,
} from "@/components/common/PasswordRuleChips";
import { FileIcon } from "@/components/icons";
import { authApi } from "@/hooks/auth";
import {
  PHONE_INPUT_MAX_LENGTH,
  formatPhoneInput,
  isValidPhone,
} from "@/lib/phone";
import { cn } from "@/lib/utils";

import { MatchCheckIcon, SmallCheckIcon, UploadIcon } from "./signupIcons";
import {
  CardHeading,
  FieldLabel,
  FieldMessage,
  INPUT_CLASS,
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
};

export const EMPTY_SIGNUP_INFO: SignupInfo = {
  password: "",
  passwordConfirm: "",
  name: "",
  phone: "",
  company: "",
  file: null,
};

/** 백엔드 LICENSE_ALLOWED_EXTENSIONS / LICENSE_MAX_UPLOAD_SIZE 와 같다. */
const BIZ_FILE_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg"];
const BIZ_FILE_MAX_BYTES = 10 * 1024 * 1024;

function bizFileError(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!BIZ_FILE_EXTENSIONS.some((ext) => name.endsWith(ext)))
    return "PDF, PNG, JPG 파일만 올릴 수 있습니다.";
  if (file.size > BIZ_FILE_MAX_BYTES)
    return "10MB 이하 파일만 올릴 수 있습니다.";
  return null;
}

const FIELD_ERROR = "text-[11px] text-[#dc2626]";

/** 4단계 — 시안(00. 회원가입 - 회원정보 입력). */
export function InfoStep({
  email,
  needPassword,
  showBizCert,
  initial,
  serverError,
  onNext,
}: {
  email: string;
  /** 카카오·네이버 가입은 비밀번호를 받지 않는다(시안 주석). */
  needPassword: boolean;
  /** 일반 회원에게는 사업자등록증 칸을 보이지 않는다. */
  showBizCert: boolean;
  initial: SignupInfo;
  /** 가입 요청에서 돌아온 오류(예: 이미 가입된 전화번호). */
  serverError?: { field: "phone"; message: string } | null;
  onNext: (values: SignupInfo) => void;
}) {
  const [values, setValues] = useState<SignupInfo>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [fileError, setFileError] = useState("");
  const [dragging, setDragging] = useState(false);
  // "다음"에서 확인한 전화번호 중복 결과 — 확인한 번호와 같을 때만 보여 준다.
  const [duplicatePhone, setDuplicatePhone] = useState<string | null>(null);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    const error = bizFileError(file);
    setFileError(error ?? "");
    if (!error) set("file", file);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    pickFile(event.dataTransfer.files?.[0]);
  };

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
          <div className="relative">
            <Input className={cn(INPUT_CLASS, "pr-[96px]")} />
            {/* 배지 20px → 곡률 7px. */}
            <Chip
              className={cn(
                "absolute top-1/2 right-[14px] h-[20px] -translate-y-1/2 gap-[4px] bg-[#f0fdf4] py-0 pr-[10px] pl-[8px] text-[11px] font-semibold text-[#16a34a]",
                RADIUS.h20,
              )}
            >
              인증 완료
              <SmallCheckIcon className="size-[10px]" />
            </Chip>
          </div>
        </TextField>

        {needPassword && (
          <>
            <TextField
              type="password"
              autoComplete="new-password"
              value={values.password}
              onChange={(value) => set("password", value)}
              isInvalid={submitted && !!errors.password}
              fullWidth
              className="gap-[8px]"
            >
              <FieldLabel required>비밀번호</FieldLabel>
              <Input
                placeholder="영문, 숫자, 특수문자 포함 8자 이상"
                className={INPUT_CLASS}
              />
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
              type="password"
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
              <Input
                placeholder="비밀번호를 한번 더 입력해 주세요."
                className={INPUT_CLASS}
              />
              {passwordMatch ? (
                <div className="flex items-center justify-between">
                  <FieldMessage tone="success">
                    비밀번호가 일치합니다.
                  </FieldMessage>
                  <MatchCheckIcon className="size-[14px] text-[#16a34a]" />
                </div>
              ) : (
                <FieldError className={FIELD_ERROR}>
                  {errors.passwordConfirm}
                </FieldError>
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
          <Input placeholder="이름을 입력해 주세요." className={INPUT_CLASS} />
          <FieldError className={FIELD_ERROR}>{errors.name}</FieldError>
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
          <Input placeholder="010-1234-5678" className={INPUT_CLASS} />
          <FieldError className={FIELD_ERROR}>
            {phoneServerError || errors.phone}
          </FieldError>
          {!phoneServerError && !(submitted && errors.phone) && (
            <Description className="text-[11px] text-[#a1a1aa]">
              {"숫자만 입력하면 '-'는 자동으로 들어갑니다."}
            </Description>
          )}
        </TextField>

        <div className="flex w-full flex-col gap-[12px] rounded-[10px] border border-[#ececef] bg-white p-[16px]">
          <p className="text-[13px] font-semibold text-[#18181b]">
            정보 추가 입력
          </p>
          <TextField
            aria-label="회사명"
            autoComplete="organization"
            value={values.company}
            onChange={(value) => set("company", value)}
            fullWidth
          >
            <Input placeholder="회사명" className={INPUT_CLASS} />
          </TextField>

          {showBizCert && (
            <div className="flex w-full flex-col gap-[8px]">
              <p className="text-[13px] font-medium text-gray-900">
                사업자등록증
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={BIZ_FILE_EXTENSIONS.join(",")}
                className="hidden"
                onChange={(event) => {
                  pickFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              {values.file ? (
                <div
                  className={cn(
                    "flex h-[44px] w-full items-center justify-between gap-[10px] border border-[#ececef] pr-[4px] pl-[14px]",
                    RADIUS.h44,
                  )}
                >
                  <div className="flex min-w-0 items-center gap-[8px]">
                    <FileIcon className="size-[18px] shrink-0 text-gray-500" />
                    <span className="truncate text-[13px] text-[#18181b]">
                      {values.file.name}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => set("file", null)}
                    className={cn(
                      "h-[36px] shrink-0 px-[12px] text-[12px] text-gray-500 data-[hovered=true]:text-gray-900",
                      RADIUS.h36,
                    )}
                  >
                    삭제
                  </Button>
                </div>
              ) : (
                // HeroUI에는 파일 드롭존 컴포넌트가 없어 이 영역만 직접 만든다.
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="사업자등록증 파일 선택"
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  className={cn(
                    "flex h-[100px] w-full cursor-pointer flex-col items-center justify-center gap-[4px] rounded-[10px] border border-dashed text-gray-400 transition-colors",
                    dragging
                      ? "border-primary-500 bg-primary-50"
                      : "border-gray-200 bg-[#fafafa] hover:border-gray-300",
                  )}
                >
                  <UploadIcon className="size-[20px]" />
                  <p className="text-[13px]">파일을 선택하거나 드래그하세요</p>
                  <p className="text-[11px]">
                    PDF, PNG, JPG 파일만 가능합니다.
                  </p>
                </div>
              )}
              {fileError ? (
                <FieldMessage tone="error">{fileError}</FieldMessage>
              ) : (
                <FieldMessage>
                  사업자등록증은 검토 후 3영업일 이내 담당자가 확인 후 반영이
                  됩니다.
                </FieldMessage>
              )}
            </div>
          )}
        </div>

        <PrimaryAction type="submit" label="다음" pending={checkingPhone} />
      </form>
    </SignupCard>
  );
}
