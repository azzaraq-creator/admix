"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  FieldError,
  Input,
  InputOTP,
  Label,
  TextField,
} from "@heroui/react";
import { useEffect, useState } from "react";

import { OTP_SLOT_CLASS } from "@/components/common/otpSlotClass";
import { CircleCheckIcon } from "@/components/icons";
import { authApi, authKeys } from "@/hooks/auth";
import { useSonner } from "@/hooks/useSonner";
import { cn } from "@/lib/utils";

import {
  MODAL_ERROR_CLASS,
  MODAL_INPUT_CLASS,
  MODAL_LABEL_CLASS,
  ProfileModalShell,
} from "./ProfileModalShell";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** 백엔드가 발급하는 인증번호 자릿수(6자리 숫자). */
const CODE_LENGTH = 6;
/** 백엔드 EMAIL_CODE_TTL_SECONDS(600초)와 같게 센다. */
const CODE_TTL_MS = 10 * 60 * 1000;
/** 회원가입과 같이 재전송은 30초 뒤부터. */
const RESEND_COOLDOWN_MS = 30 * 1000;

// 입력칸 옆 버튼(40px → 곡률 17px) — 파일 선택 버튼처럼 테두리 없는 회색 바탕.
const SIDE_BUTTON =
  "h-[40px] w-[88px] shrink-0 rounded-[17px] bg-black-200 px-0 text-[13px] font-medium text-black-800 data-[hovered=true]:bg-black-300 data-[disabled=true]:opacity-100 data-[disabled=true]:bg-black-100 data-[disabled=true]:text-black-400 max-sm:h-[36px] max-sm:w-auto max-sm:min-w-[48px] max-sm:flex-1 max-sm:rounded-[15px] max-sm:text-[12px]";

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function errorDetail(caught: unknown): string | undefined {
  return (caught as { response?: { data?: { detail?: string } } })?.response
    ?.data?.detail;
}

export function ContactEmailChangeModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { success } = useSonner();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [sendPending, setSendPending] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);
  const [expiresAt, setExpiresAt] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [emailError, setEmailError] = useState("");
  const [codeError, setCodeError] = useState("");

  const cooldownLeft = cooldownUntil - now;
  const remaining = expiresAt - now;
  const expired = sent && !verified && remaining <= 0;

  // 전송 후에만 1초마다 남은 시간·재전송 대기를 갱신한다.
  useEffect(() => {
    if (!sent || verified) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [sent, verified]);

  const reset = () => {
    setEmail("");
    setCode("");
    setSent(false);
    setVerified(false);
    setSendPending(false);
    setConfirmPending(false);
    setSubmitPending(false);
    setExpiresAt(0);
    setCooldownUntil(0);
    setEmailError("");
    setCodeError("");
  };

  const close = (value: boolean) => {
    if (!value) reset();
    onOpenChange(value);
  };

  const handleSend = async () => {
    if (!EMAIL_PATTERN.test(email)) {
      setEmailError("이메일 형식이 올바르지 않습니다.");
      return;
    }
    setSendPending(true);
    setEmailError("");
    setCodeError("");
    try {
      await authApi.requestEmailVerification(email);
      const at = Date.now();
      setSent(true);
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
      setVerified(true);
    } catch (caught) {
      setCodeError(errorDetail(caught) ?? "인증번호가 올바르지 않습니다.");
    } finally {
      setConfirmPending(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitPending(true);
    try {
      await authApi.changeContactEmail(email, code);
      await queryClient.invalidateQueries({ queryKey: authKeys.me });
      success("연락받을 이메일을 바꿨어요", email);
      reset();
      onOpenChange(false);
    } catch (caught) {
      setCodeError(
        errorDetail(caught) ??
          "이메일 변경에 실패했습니다. 다시 시도해 주세요.",
      );
      setSubmitPending(false);
    }
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setEmailError("");
  };

  // 모바일은 버튼이 좁아 기다리는 동안엔 남은 초만 보여 준다("30초" → 끝나면 "재전송").
  const sendLabel = !sent ? (
    "전송"
  ) : cooldownLeft > 0 ? (
    <>
      <span className="max-sm:hidden">재전송 </span>
      {Math.ceil(cooldownLeft / 1000)}초
    </>
  ) : (
    "재전송"
  );

  return (
    <ProfileModalShell
      open={open}
      onOpenChange={close}
      title="연락받을 이메일 변경"
      submitLabel="변경하기"
      pendingLabel="변경 중"
      // 회원가입처럼 인증번호 "확인"을 받아야 누를 수 있다.
      submitDisabled={!verified}
      submitPending={submitPending}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-[16px] max-sm:gap-[14px]">
        <TextField
          type="email"
          value={email}
          onChange={handleEmailChange}
          isInvalid={!!emailError}
          // 인증번호를 보낸 뒤엔 이메일을 잠근다(회원가입과 같음). 바꾸려면 창을 닫고 다시 연다.
          // disabled 대신 readOnly — 보낸 주소를 또렷하게 읽고 복사할 수 있게.
          isReadOnly={sent}
          autoComplete="email"
          fullWidth
          className="flex flex-col gap-[6px]"
        >
          <Label className={MODAL_LABEL_CLASS}>새 이메일</Label>
          <div className="flex gap-[8px]">
            <Input
              className={cn(
                MODAL_INPUT_CLASS,
                // 모바일은 아래 인증번호 6칸(최대 36×6 + 4×5 = 236px)과 폭을 맞춘다.
                // 화면이 넓으면 남는 폭은 버튼이 채우고, 좁으면 입력칸이 줄어든다(버튼은 최소 48px).
                "max-sm:w-auto max-sm:flex-[0_1_236px]",
                // 잠긴 칸은 올리거나 눌러도 흰색으로 바뀌지 않게 회색 그대로 둔다.
                sent && "cursor-default bg-black-100!",
              )}
            />
            <Button
              variant="secondary"
              onPress={handleSend}
              isPending={sendPending}
              isDisabled={!email || verified || (sent && cooldownLeft > 0)}
              className={SIDE_BUTTON}
            >
              {sendLabel}
            </Button>
          </div>
          <FieldError className={MODAL_ERROR_CLASS}>{emailError}</FieldError>
        </TextField>

        <div className="flex flex-col gap-[6px]">
          <Label className={MODAL_LABEL_CLASS}>인증번호</Label>
          <div className="flex gap-[8px]">
            {/* HeroUI InputOTP — 회원가입 인증번호와 같은 숫자 6칸. */}
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
              className="min-w-0 flex-1 data-[disabled=true]:opacity-100 max-sm:flex-[0_1_236px]"
            >
              <InputOTP.Group className="w-full gap-[6px] max-sm:gap-[4px]">
                {Array.from({ length: CODE_LENGTH }, (_, index) => (
                  <InputOTP.Slot
                    key={index}
                    index={index}
                    className={cn(
                      OTP_SLOT_CLASS,
                      // 모바일은 화면이 넓어도 칸이 옆으로 늘어나지 않게 정사각형(36px)까지만 키운다.
                      // 화면이 좁으면 그보다 줄어든다.
                      "h-[40px] rounded-[14px] text-[15px] max-sm:h-[36px] max-sm:max-w-[36px] max-sm:rounded-[12px] max-sm:text-[14px]",
                    )}
                  />
                ))}
              </InputOTP.Group>
            </InputOTP>
            <Button
              variant="secondary"
              onPress={handleConfirm}
              isPending={confirmPending}
              isDisabled={!sent || verified || expired}
              className={cn(
                SIDE_BUTTON,
                "gap-[4px]",
                verified &&
                  "data-[disabled=true]:bg-[#f0fdf4] data-[disabled=true]:text-[#16a34a]",
              )}
            >
              {verified ? (
                <>
                  <CircleCheckIcon className="size-[14px] max-sm:size-[12px]" />
                  인증
                  <span className="max-sm:hidden"> 완료</span>
                </>
              ) : (
                "확인"
              )}
            </Button>
          </div>

          {codeError ? (
            <p className={MODAL_ERROR_CLASS}>{codeError}</p>
          ) : expired ? (
            <p className={MODAL_ERROR_CLASS}>
              인증번호가 만료되었어요. 재전송을 눌러 새 인증번호를 받아 주세요.
            </p>
          ) : (
            sent &&
            !verified && (
              <div className="flex items-center justify-between gap-[8px] text-[12px] max-sm:text-[11px]">
                <p className="text-black-500">
                  인증번호를 보냈어요. 메일이 안 보이면 스팸함을 확인해 주세요.
                </p>
                <span className="shrink-0 font-semibold text-black-700 tabular-nums">
                  {formatRemaining(remaining)}
                </span>
              </div>
            )
          )}
        </div>
      </div>
    </ProfileModalShell>
  );
}
