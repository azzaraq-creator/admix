"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { authApi, authKeys } from "@/hooks/auth";
import { useSonner } from "@/hooks/useSonner";
import { cn } from "@/lib/utils";

import { MODAL_INPUT_CLASS, ProfileModalShell } from "./ProfileModalShell";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [codeSent, setCodeSent] = useState(false);
  const [sendPending, setSendPending] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reset = () => {
    setEmail("");
    setCode("");
    setCodeSent(false);
    setSendPending(false);
    setSubmitPending(false);
    setError("");
    setNotice("");
  };

  const close = (value: boolean) => {
    if (!value) reset();
    onOpenChange(value);
  };

  const handleSend = async () => {
    if (!EMAIL_PATTERN.test(email)) {
      setError("이메일 형식이 올바르지 않습니다.");
      return;
    }
    setSendPending(true);
    setError("");
    try {
      await authApi.requestEmailVerification(email);
      setCodeSent(true);
      setNotice("인증번호를 전송했습니다. 메일함을 확인해 주세요.");
    } catch {
      setError("인증번호 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSendPending(false);
    }
  };

  const handleSubmit = async () => {
    if (!codeSent) {
      setError("이메일 인증번호를 전송해 주세요.");
      return;
    }
    if (!code) {
      setError("인증번호를 입력해 주세요.");
      return;
    }
    setSubmitPending(true);
    setError("");
    try {
      await authApi.changeContactEmail(email, code);
      await queryClient.invalidateQueries({ queryKey: authKeys.me });
      success("연락받을 이메일이 변경되었습니다.");
      reset();
      onOpenChange(false);
    } catch (caught) {
      const detail = (
        caught as { response?: { data?: { detail?: string } } }
      )?.response?.data?.detail;
      setError(detail ?? "이메일 변경에 실패했습니다. 다시 시도해 주세요.");
      setSubmitPending(false);
    }
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setError("");
    setNotice("");
    if (codeSent) {
      setCodeSent(false);
      setCode("");
    }
  };

  const canSubmit = codeSent && !!code && !submitPending;

  return (
    <ProfileModalShell
      open={open}
      onOpenChange={close}
      title="연락받을 이메일 변경"
      submitLabel="변경하기"
      submitDisabled={!canSubmit}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-[12px]">
        <div className="flex gap-[8px]">
          <input
            type="email"
            value={email}
            onChange={(event) => handleEmailChange(event.target.value)}
            placeholder="이메일을 입력해 주세요"
            className={cn(
              MODAL_INPUT_CLASS,
              "flex-1",
              error && !notice && "border-[#ff2c20] bg-[#fff2f1]",
            )}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sendPending}
            className="flex h-[56px] shrink-0 items-center justify-center rounded-[8px] bg-platinum-100 px-[24px] text-base font-semibold text-black disabled:opacity-60"
          >
            {sendPending ? "전송 중" : codeSent ? "재전송" : "전송"}
          </button>
        </div>
        <input
          type="text"
          inputMode="numeric"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setError("");
          }}
          placeholder="인증번호를 입력해 주세요"
          disabled={!codeSent}
          className={cn(MODAL_INPUT_CLASS, "disabled:bg-[#fafafc]")}
        />
        {error && (
          <p className="text-sm font-medium leading-[20px] text-[#ff2c20]">
            {error}
          </p>
        )}
        {notice && !error && (
          <p className="text-sm font-medium leading-[20px] text-primary">
            {notice}
          </p>
        )}
      </div>
    </ProfileModalShell>
  );
}
