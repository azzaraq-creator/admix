"use client";

import { FieldError, Input, Label, TextField } from "@heroui/react";
import { useState } from "react";

import {
  isPasswordValid,
  PasswordRuleChips,
} from "@/components/common/PasswordRuleChips";
import { useChangePassword } from "@/hooks/auth";
import { useSonner } from "@/hooks/useSonner";

import {
  MODAL_ERROR_CLASS,
  MODAL_INPUT_CLASS,
  MODAL_LABEL_CLASS,
  ProfileModalShell,
} from "./ProfileModalShell";

type FieldKey = "current" | "next" | "confirm";

export function PasswordChangeModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mutation = useChangePassword();
  const { success } = useSonner();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setErrors({});
  };

  const close = (value: boolean) => {
    if (!value) reset();
    onOpenChange(value);
  };

  const handleSubmit = async () => {
    const nextErrors: Partial<Record<FieldKey, string>> = {};
    if (!isPasswordValid(next)) {
      nextErrors.next =
        "영문, 숫자, 특수문자를 모두 포함해 8자 이상 입력해 주세요.";
    }
    if (next !== confirm) {
      nextErrors.confirm = "새 비밀번호가 일치하지 않습니다.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    try {
      await mutation.mutateAsync({
        currentPassword: current,
        newPassword: next,
      });
      success(
        "비밀번호를 바꿨어요",
        "다음 로그인부터 새 비밀번호를 써 주세요.",
      );
      reset();
      onOpenChange(false);
    } catch (caught) {
      const response = (
        caught as {
          response?: { status?: number; data?: { detail?: string } };
        }
      )?.response;
      const detail = response?.data?.detail ?? "";
      const wrongCurrent =
        response?.status === 400 || detail.includes("현재 비밀번호");
      setErrors({
        current: wrongCurrent
          ? "현재 비밀번호가 올바르지 않습니다."
          : "비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      });
    }
  };

  const fields: {
    key: FieldKey;
    label: string;
    value: string;
    set: (value: string) => void;
  }[] = [
    {
      key: "current",
      label: "현재 비밀번호",
      value: current,
      set: setCurrent,
    },
    {
      key: "next",
      label: "새 비밀번호",
      value: next,
      set: setNext,
    },
    {
      key: "confirm",
      label: "새 비밀번호 확인",
      value: confirm,
      set: setConfirm,
    },
  ];

  // 세 칸이 모두 채워지고 새 비밀번호가 조건 4가지를 다 맞춰야 누를 수 있다.
  const canSubmit = !!current && !!next && !!confirm && isPasswordValid(next);

  return (
    <ProfileModalShell
      open={open}
      onOpenChange={close}
      title="비밀번호 변경"
      submitLabel="변경하기"
      pendingLabel="변경 중"
      submitDisabled={!canSubmit}
      submitPending={mutation.isPending}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-[16px]">
        {fields.map((field) => {
          const fieldError = errors[field.key];
          return (
            <TextField
              key={field.key}
              type="password"
              value={field.value}
              onChange={(value) => {
                field.set(value);
                if (fieldError)
                  setErrors((prev) => ({ ...prev, [field.key]: undefined }));
              }}
              isInvalid={!!fieldError}
              autoComplete={
                field.key === "current" ? "current-password" : "new-password"
              }
              fullWidth
              className="flex flex-col gap-[6px]"
            >
              <Label className={MODAL_LABEL_CLASS}>{field.label}</Label>
              <Input className={MODAL_INPUT_CLASS} />
              {/* 새 비밀번호는 회원가입처럼 조건마다 맞는지 칩으로 바로 보여 준다. */}
              {/* 모바일은 칩 네 개가 한 줄에 가깝게 들어가도록 간격을 줄인다. */}
              {field.key === "next" && (
                <PasswordRuleChips
                  password={next}
                  className="max-sm:gap-x-[4px] max-sm:gap-y-[6px]"
                />
              )}
              <FieldError className={MODAL_ERROR_CLASS}>
                {fieldError}
              </FieldError>
            </TextField>
          );
        })}
      </div>
    </ProfileModalShell>
  );
}
