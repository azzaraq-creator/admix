"use client";

import { FieldError, Input, InputOTP, TextField } from "@heroui/react";
import { useEffect, useState } from "react";

import { authApi } from "@/hooks/auth";
import { cn } from "@/lib/utils";

import { MatchCheckIcon } from "./signupIcons";

import {
  CardHeading,
  FieldLabel,
  FieldMessage,
  INPUT_CLASS,
  PrimaryAction,
  RADIUS,
  SideButton,
  SignupCard,
  errorDetail,
} from "./signupUi";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** 백엔드 EMAIL_CODE_TTL_SECONDS(600초)와 같게 센다. */
const CODE_TTL_MS = 10 * 60 * 1000;
/** 시안 주석: 재전송 후 30초 동안 비활성, 재전송은 5번까지. */
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_RESENDS = 5;
/**
 * 인증번호 칸 — 선택 전에도 칸이 또렷하게 보이도록 테두리를 진하게 준다.
 * 기본: 회색 테두리 / 입력 중: 보라 테두리 + 연보라 링 / 입력됨: 진한 회색 테두리 /
 * 전송 전(비활성): 회색 바탕.
 * 색 스타일은 모두 "오류가 아닐 때(not-data-invalid)"만 적용해, 틀렸을 때는 HeroUI 기본 오류 스타일을 쓴다.
 */
const OTP_SLOT_CLASS = cn(
  "h-[44px] border text-[16px] text-black-900 shadow-none",
  "not-data-[invalid=true]:border-black-300 not-data-[invalid=true]:bg-white",
  "not-data-[invalid=true]:hover:border-black-400 not-data-[invalid=true]:data-[hovered=true]:border-black-400",
  "not-data-[invalid=true]:data-[filled=true]:border-black-400",
  "not-data-[invalid=true]:data-[active=true]:border-primary-500 not-data-[invalid=true]:data-[active=true]:ring-2 not-data-[invalid=true]:data-[active=true]:ring-primary-100",
  "data-[disabled=true]:opacity-100 not-data-[invalid=true]:data-[disabled=true]:border-black-200 not-data-[invalid=true]:data-[disabled=true]:bg-[#f4f4f5]",
);

/** 백엔드가 발급하는 인증번호 자릿수(6자리 숫자). */
const CODE_LENGTH = 6;

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/** 3단계 — 시안(00. 회원가입 - 이메일 인증). */
export function EmailVerifyStep({
  initialEmail = "",
  verifiedEmail,
  checkDuplicate,
  onVerified,
  onNext,
}: {
  initialEmail?: string;
  /** 이미 인증을 마친 이메일(이전 단계로 돌아왔다 다시 온 경우). */
  verifiedEmail: string | null;
  /** 이메일 가입은 이미 가입된 아이디인지 먼저 확인한다(SNS 가입은 확인하지 않음). */
  checkDuplicate: boolean;
  onVerified: (email: string) => void;
  onNext: () => void;
}) {
  const [email, setEmail] = useState(verifiedEmail ?? initialEmail);
  const [code, setCode] = useState("");
  const [sendCount, setSendCount] = useState(verifiedEmail ? 1 : 0);
  const [sendPending, setSendPending] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);
  const [expiresAt, setExpiresAt] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [emailError, setEmailError] = useState("");
  const [codeError, setCodeError] = useState("");

  const verified = verifiedEmail !== null && verifiedEmail === email;
  const sent = sendCount > 0;
  const resendsLeft = MAX_RESENDS - (sendCount - 1);
  const cooldownLeft = cooldownUntil - now;
  const remaining = expiresAt - now;
  const expired = sent && !verified && remaining <= 0;

  // 전송 후에만 1초마다 남은 시간·재전송 대기를 갱신한다.
  useEffect(() => {
    if (!sent || verified) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [sent, verified]);

  const handleSend = async () => {
    if (!EMAIL_PATTERN.test(email)) {
      setEmailError("이메일 형식이 올바르지 않습니다.");
      return;
    }
    setSendPending(true);
    setEmailError("");
    setCodeError("");
    try {
      if (checkDuplicate && !(await authApi.checkEmailAvailable(email))) {
        setEmailError("이미 가입된 이메일입니다.");
        return;
      }
      await authApi.requestEmailVerification(email);
      const at = Date.now();
      setSendCount((count) => count + 1);
      setExpiresAt(at + CODE_TTL_MS);
      setCooldownUntil(at + RESEND_COOLDOWN_MS);
      setNow(at);
      setCode("");
    } catch {
      setEmailError(
        "인증번호 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setSendPending(false);
    }
  };

  const handleConfirm = async () => {
    if (code.length < CODE_LENGTH) {
      setCodeError("인증번호 6자리를 입력해 주세요.");
      return;
    }
    setConfirmPending(true);
    setCodeError("");
    try {
      await authApi.confirmEmailVerification(email, code);
      onVerified(email);
    } catch (error) {
      setCodeError(errorDetail(error) ?? "인증번호가 올바르지 않습니다.");
    } finally {
      setConfirmPending(false);
    }
  };

  const sendLabel = sendPending
    ? "전송 중…"
    : !sent
      ? "인증번호 전송"
      : cooldownLeft > 0
        ? `재전송 (${Math.ceil(cooldownLeft / 1000)}초)`
        : "재전송";
  const sendDisabled =
    sendPending || verified || (sent && (cooldownLeft > 0 || resendsLeft <= 0));

  return (
    <SignupCard>
      <CardHeading
        title="이메일을 인증해 주세요"
        description="입력하신 이메일로 인증번호를 보내드립니다."
      />

      <TextField
        type="email"
        autoComplete="email"
        value={email}
        // 인증번호를 보낸 뒤에는 이메일을 고정한다(바꾸려면 이전 단계로).
        isReadOnly={sent}
        isInvalid={!!emailError}
        onChange={(value) => {
          setEmail(value);
          setEmailError("");
        }}
        fullWidth
        className="gap-[8px]"
      >
        <FieldLabel>이메일</FieldLabel>
        <div className="flex w-full gap-[12px]">
          <Input
            placeholder="이메일을 입력해 주세요."
            className={INPUT_CLASS}
          />
          <SideButton onPress={handleSend} isDisabled={sendDisabled}>
            {sendLabel}
          </SideButton>
        </div>
        <FieldError className="text-[11px] text-[#dc2626]">
          {emailError}
        </FieldError>
      </TextField>
      {sent && !verified && resendsLeft <= 0 && (
        <FieldMessage tone="error">
          재전송 횟수(5회)를 모두 사용했습니다. 잠시 후 다시 시도해 주세요.
        </FieldMessage>
      )}

      <div className="flex w-full flex-col gap-[8px]">
        <FieldLabel>인증번호</FieldLabel>
        <div className="flex w-full gap-[12px]">
          {/* HeroUI InputOTP — 숫자 6칸. 칸 높이는 옆 버튼과 같은 44px(곡률 19px). */}
          <InputOTP
            aria-label="인증번호"
            maxLength={CODE_LENGTH}
            pattern="^\d+$"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(value) => {
              setCode(value);
              setCodeError("");
            }}
            isDisabled={!sent || verified}
            isInvalid={!!codeError}
            // 전송 전(비활성)에도 칸이 흐려지지 않게 HeroUI 기본 반투명을 끈다.
            className="min-w-0 flex-1 data-[disabled=true]:opacity-100"
          >
            <InputOTP.Group className="w-full gap-[6px]">
              {Array.from({ length: CODE_LENGTH }, (_, index) => (
                <InputOTP.Slot
                  key={index}
                  index={index}
                  className={cn(OTP_SLOT_CLASS, RADIUS.h44)}
                />
              ))}
            </InputOTP.Group>
          </InputOTP>
          <SideButton
            tone={verified ? "success" : "soft"}
            onPress={handleConfirm}
            isDisabled={!sent || verified || expired || confirmPending}
          >
            {verified ? (
              <>
                <MatchCheckIcon className="size-[14px]" />
                인증 완료
              </>
            ) : confirmPending ? (
              "확인 중…"
            ) : (
              "확인"
            )}
          </SideButton>
        </div>
        {codeError ? (
          <FieldMessage tone="error">{codeError}</FieldMessage>
        ) : verified ? (
          <FieldMessage tone="success">
            이메일 인증이 완료되었습니다.
          </FieldMessage>
        ) : expired ? (
          <FieldMessage tone="error">
            인증번호가 만료되었습니다. 재전송을 눌러 새 인증번호를 받아 주세요.
          </FieldMessage>
        ) : (
          sent && (
            <div className="flex w-full items-center justify-between gap-[8px] text-[11px]">
              <FieldMessage>
                인증번호가 발송되었습니다. 메일이 오지 않으면 스팸함을
                확인해주세요.
              </FieldMessage>
              <span className="shrink-0 font-semibold text-[#333]">
                {formatRemaining(remaining)}
              </span>
            </div>
          )
        )}
      </div>

      <PrimaryAction
        label="다음"
        note="이메일 인증을 완료해야 다음 단계로 넘어갈 수 있습니다."
        disabled={!verified}
        onPress={onNext}
      />
    </SignupCard>
  );
}
