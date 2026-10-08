"use client";

import { Button, FieldError, Input, TextField } from "@heroui/react";
import { isAxiosError } from "axios";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SignupShell } from "@/app/(client)/(auth)/signup/_components/SignupShell";
import {
  CardHeading,
  FieldLabel,
  INPUT_CLASS,
  PrimaryAction,
  SignupCard,
} from "@/app/(client)/(auth)/signup/_components/signupUi";
import { LOGIN_HREF } from "@/app/(client)/(main)/_components/useLoginModal";
import { EmailIcon } from "@/components/icons";
import { useRequestPasswordReset } from "@/hooks/auth";
import { useSonner } from "@/hooks/useSonner";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 비밀번호 찾기 — 로그인 창의 "비밀번호 재설정"에서 온다.
 * 회원가입과 같은 ADMIX 인증 화면 틀(흰 상단 바·회색 바탕·가운데 흰 카드, HeroUI)을 쓴다.
 * 1) 이메일 입력 → 재설정 메일 전송  2) 전송 완료 안내(다시 보내기·로그인으로).
 */
export default function FindAccountPage() {
  const router = useRouter();
  const requestMutation = useRequestPasswordReset();
  const { success } = useSonner();

  const [email, setEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const send = async (target: string): Promise<boolean> => {
    try {
      await requestMutation.mutateAsync(target);
      return true;
    } catch (err) {
      // 미등록 이메일(404)이면 안내, 그 외는 일반 실패 메시지.
      setErrorMsg(
        isAxiosError(err) && err.response?.status === 404
          ? "가입되지 않은 이메일입니다."
          : "전송에 실패했어요. 잠시 후 다시 시도해 주세요.",
      );
      return false;
    }
  };

  const handleSubmit = async () => {
    const target = email.trim();
    if (!target) {
      setErrorMsg("이메일을 입력해 주세요.");
      return;
    }
    if (!EMAIL_PATTERN.test(target)) {
      setErrorMsg("이메일 형식이 올바르지 않습니다.");
      return;
    }
    setErrorMsg(null);
    if (await send(target)) setSentTo(target);
  };

  const handleResend = async () => {
    if (!sentTo || requestMutation.isPending) return;
    if (await send(sentTo)) success("재설정 메일을 다시 보냈어요", sentTo);
  };

  if (sentTo) {
    return (
      <SignupShell loginPrompt="비밀번호가 기억나셨나요?">
        <SignupCard className="items-center">
          {/* 모바일은 카드가 화면 아래까지 늘어나므로 안내는 가운데, 버튼은 아래에 붙인다. */}
          <div className="flex w-full flex-col items-center gap-[16px] max-sm:flex-1 max-sm:justify-center max-sm:gap-[12px]">
            {/* 아이콘 칸 56px → 곡률 25px. */}
            <span className="flex size-[56px] items-center justify-center rounded-[25px] bg-primary-50 text-primary-500">
              <EmailIcon className="size-[24px]" />
            </span>
            <CardHeading
              center
              title="메일을 보냈어요"
              description="받은 메일의 링크를 눌러 새 비밀번호를 설정해 주세요."
            />
            {/* 보낸 주소 — 요약 줄 52px → 곡률 23px. */}
            <div className="flex w-full flex-col items-center gap-[4px] rounded-[23px] bg-primary-50 px-[16px] py-[14px] text-center">
              <span className="text-[12px] text-gray-500">받는 이메일</span>
              <span className="max-w-full text-[15px] font-bold break-all text-gray-900">
                {sentTo}
              </span>
            </div>
            <p className="flex flex-wrap items-center justify-center gap-x-[6px] text-[12px] text-[#a1a1aa]">
              메일이 오지 않았나요? 스팸함을 확인하거나
              <Button
                variant="ghost"
                size="sm"
                onPress={() => void handleResend()}
                isDisabled={requestMutation.isPending}
                className="h-auto min-w-0 p-0 text-[12px] font-semibold text-primary-500 underline data-[hovered=true]:bg-transparent"
              >
                {requestMutation.isPending ? "보내는 중…" : "다시 보내기"}
              </Button>
            </p>
            {errorMsg && (
              <p className="text-[12px] text-[#dc2626]">{errorMsg}</p>
            )}
          </div>
          <PrimaryAction
            label="로그인으로 돌아가기"
            onPress={() => router.push(LOGIN_HREF)}
          />
        </SignupCard>
      </SignupShell>
    );
  }

  return (
    <SignupShell loginPrompt="비밀번호가 기억나셨나요?">
      <SignupCard>
        <CardHeading
          title="비밀번호를 잊으셨나요?"
          description="가입한 이메일 주소를 입력하시면 비밀번호 재설정 안내 메일을 보내드려요."
        />
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
          // 모바일은 카드가 화면 아래까지 늘어나므로 버튼을 맨 아래에 붙인다(PrimaryAction mt-auto).
          className="flex w-full flex-col gap-[24px] max-sm:flex-1 max-sm:gap-[16px]"
        >
          <TextField
            type="email"
            autoComplete="email"
            value={email}
            onChange={(value) => {
              setEmail(value);
              if (errorMsg) setErrorMsg(null);
            }}
            isInvalid={!!errorMsg}
            autoFocus
            fullWidth
            className="gap-[8px]"
          >
            <FieldLabel required>이메일</FieldLabel>
            <Input className={INPUT_CLASS} />
            <FieldError className="text-[11px] text-[#dc2626]">
              {errorMsg}
            </FieldError>
          </TextField>
          <PrimaryAction
            type="submit"
            label="재설정 메일 보내기"
            pending={requestMutation.isPending}
            disabled={!email.trim()}
          />
        </form>
      </SignupCard>
    </SignupShell>
  );
}
