"use client";

import { FieldError, InputGroup, TextField } from "@heroui/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";

import { MatchCheckIcon } from "@/app/(client)/(auth)/signup/_components/signupIcons";
import { SignupShell } from "@/app/(client)/(auth)/signup/_components/SignupShell";
import {
  CardHeading,
  errorStatus,
  FieldLabel,
  FieldMessage,
  PasswordToggle,
  PrimaryAction,
  SignupCard,
} from "@/app/(client)/(auth)/signup/_components/signupUi";
import { LOGIN_HREF } from "@/app/(client)/(main)/_components/useLoginModal";
import {
  isPasswordValid,
  PasswordRuleChips,
} from "@/components/common/PasswordRuleChips";
import { CircleAlertIcon, CircleCheckIcon } from "@/components/icons";
import { useConfirmPasswordReset } from "@/hooks/auth";

/** 비밀번호 찾기(재설정 메일 보내기) 화면. */
const FIND_ACCOUNT_HREF = "/find-account";

/**
 * 비밀번호 재설정 — 재설정 메일의 링크(?token=)로 온다.
 * 11-23 사용자: 예전 화면(청록 바탕 · 맨 input · 확인 창) → 지금 admix 인증 화면 틀(SignupShell · SignupCard, HeroUI)로.
 * 비밀번호 찾기 · 회원가입과 같은 모양이고, 비밀번호 조건(영문 · 숫자 · 특수문자 · 8자 이상)도 회원가입과 같다.
 * 1) 새 비밀번호 · 확인 입력  2) 바꿈 완료 → 로그인 창  — 링크가 없거나 만료면 메일을 다시 받으러 비밀번호 찾기로.
 */
export function ResetPasswordView() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const confirmMutation = useConfirmPasswordReset();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState("");
  /** 서버가 링크를 받지 않음(만료 · 이미 씀, 400). */
  const [expired, setExpired] = useState(false);
  const [done, setDone] = useState(false);

  const passwordOk = isPasswordValid(password);
  const matched = !!confirm && password === confirm;
  const confirmError = !confirm
    ? "비밀번호를 한번 더 입력해 주세요."
    : !matched
      ? "비밀번호가 일치하지 않습니다."
      : "";

  const handleSubmit = async () => {
    setSubmitted(true);
    if (!passwordOk || !matched) return;
    setServerError("");
    try {
      await confirmMutation.mutateAsync({ token, newPassword: password });
      setDone(true);
    } catch (error) {
      if (errorStatus(error) === 400) setExpired(true);
      else
        setServerError(
          "비밀번호를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.",
        );
    }
  };

  if (done) {
    return (
      <Notice
        icon={<CircleCheckIcon className="size-[24px]" />}
        title="비밀번호를 바꿨어요"
        description="새 비밀번호로 다시 로그인해 주세요."
        action="로그인하기"
        onAction={() => router.replace(LOGIN_HREF)}
      />
    );
  }

  if (!token || expired) {
    return (
      <Notice
        tone="error"
        icon={<CircleAlertIcon className="size-[24px]" />}
        title={token ? "링크가 만료되었어요" : "링크를 다시 확인해 주세요"}
        // 두 문장이 한 줄에 안 들어가 끝말만 떨어지지 않게 문장 사이에서 줄을 나눈다.
        description={
          <>
            {token
              ? "재설정 링크는 정해진 시간 안에 한 번만 쓸 수 있어요."
              : "재설정 메일의 링크로 들어와야 비밀번호를 바꿀 수 있어요."}
            <br />
            메일을 다시 받아 주세요.
          </>
        }
        action="재설정 메일 다시 받기"
        onAction={() => router.push(FIND_ACCOUNT_HREF)}
      />
    );
  }

  return (
    <SignupShell loginPrompt="비밀번호가 기억나셨나요?">
      <SignupCard>
        <CardHeading
          title="새 비밀번호를 입력해 주세요"
          description="비밀번호를 바꾸면 로그인되어 있던 다른 기기에서는 로그아웃돼요."
        />
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
          // 모바일은 카드가 화면 아래까지 늘어나므로 버튼을 맨 아래에 붙인다(PrimaryAction mt-auto).
          className="flex w-full flex-col gap-[16px] max-sm:flex-1"
        >
          <TextField
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(value) => {
              setPassword(value);
              setServerError("");
            }}
            isInvalid={submitted && !passwordOk}
            autoFocus
            fullWidth
            className="gap-[8px]"
          >
            <FieldLabel required>새 비밀번호</FieldLabel>
            <InputGroup fullWidth className="h-[44px] rounded-[19px]">
              <InputGroup.Input placeholder="영문, 숫자, 특수문자 포함 8자 이상" />
              <InputGroup.Suffix>
                <PasswordToggle
                  shown={showPassword}
                  onToggle={() => setShowPassword((prev) => !prev)}
                />
              </InputGroup.Suffix>
            </InputGroup>
            <PasswordRuleChips password={password} />
          </TextField>

          <TextField
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            value={confirm}
            onChange={(value) => {
              setConfirm(value);
              setServerError("");
            }}
            isInvalid={(submitted || !!confirm) && !!confirmError}
            fullWidth
            className="gap-[8px]"
          >
            <FieldLabel required>새 비밀번호 확인</FieldLabel>
            <InputGroup fullWidth className="h-[44px] rounded-[19px]">
              <InputGroup.Input placeholder="새 비밀번호를 한번 더 입력해 주세요." />
              <InputGroup.Suffix>
                <PasswordToggle
                  shown={showConfirm}
                  onToggle={() => setShowConfirm((prev) => !prev)}
                />
              </InputGroup.Suffix>
            </InputGroup>
            {matched ? (
              <div className="flex items-center justify-between">
                <FieldMessage tone="success">
                  비밀번호가 일치합니다.
                </FieldMessage>
                <MatchCheckIcon className="size-[14px] text-[#16a34a]" />
              </div>
            ) : (
              <FieldError>{confirmError}</FieldError>
            )}
          </TextField>

          {serverError && (
            <FieldMessage tone="error">{serverError}</FieldMessage>
          )}

          <PrimaryAction
            type="submit"
            label="비밀번호 바꾸기"
            pending={confirmMutation.isPending}
            disabled={!password || !confirm}
          />
        </form>
      </SignupCard>
    </SignupShell>
  );
}

/** 완료 · 링크 오류 안내 카드 — 비밀번호 찾기 "메일을 보냈어요"와 같은 모양(가운데 아이콘 + 제목 + 아래 버튼). */
function Notice({
  tone = "primary",
  icon,
  title,
  description,
  action,
  onAction,
}: {
  tone?: "primary" | "error";
  icon: ReactNode;
  title: string;
  description: ReactNode;
  action: string;
  onAction: () => void;
}) {
  return (
    <SignupShell loginPrompt="비밀번호가 기억나셨나요?">
      <SignupCard className="items-center">
        {/* 모바일은 카드가 화면 아래까지 늘어나므로 안내는 가운데, 버튼은 아래에 붙인다. */}
        <div className="flex w-full flex-col items-center gap-[16px] max-sm:flex-1 max-sm:justify-center max-sm:gap-[12px]">
          {/* 아이콘 칸 56px → 곡률 25px. */}
          <span
            className={
              tone === "error"
                ? "flex size-[56px] items-center justify-center rounded-[25px] bg-tone-fef2f2 text-[#dc2626]"
                : "flex size-[56px] items-center justify-center rounded-[25px] bg-primary-50 text-primary-500"
            }
          >
            {icon}
          </span>
          <CardHeading center title={title} description={description} />
        </div>
        <PrimaryAction label={action} onPress={onAction} />
      </SignupCard>
    </SignupShell>
  );
}
