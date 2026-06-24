"use client";

import { useState } from "react";

import { useChangePassword } from "@/hooks/auth";
import { useSonner } from "@/hooks/useSonner";
import { cn } from "@/lib/utils";

import { MODAL_INPUT_CLASS, ProfileModalShell } from "./ProfileModalShell";

const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

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
    if (!PASSWORD_PATTERN.test(next)) {
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
      await mutation.mutateAsync({ currentPassword: current, newPassword: next });
      success("비밀번호가 변경되었습니다.");
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
    placeholder: string;
    value: string;
    set: (value: string) => void;
  }[] = [
    {
      key: "current",
      label: "현재 비밀번호",
      placeholder: "현재 비밀번호를 입력해 주세요",
      value: current,
      set: setCurrent,
    },
    {
      key: "next",
      label: "새 비밀번호",
      placeholder: "새 비밀번호를 입력해 주세요",
      value: next,
      set: setNext,
    },
    {
      key: "confirm",
      label: "새 비밀번호 확인",
      placeholder: "새 비밀번호를 다시 입력해 주세요",
      value: confirm,
      set: setConfirm,
    },
  ];

  const canSubmit = !!current && !!next && !!confirm && !mutation.isPending;

  return (
    <ProfileModalShell
      open={open}
      onOpenChange={close}
      title="비밀번호 변경"
      submitLabel="변경하기"
      submitDisabled={!canSubmit}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-[12px] sm:gap-[20px]">
        {fields.map((field) => {
          const fieldError = errors[field.key];
          return (
            <label key={field.key} className="flex flex-col gap-[12px]">
              <span className="text-base font-medium leading-[24px] text-black">
                {field.label}
              </span>
              <div className="flex flex-col gap-[6px]">
                <input
                  type="password"
                  value={field.value}
                  onChange={(event) => {
                    field.set(event.target.value);
                    if (fieldError) {
                      setErrors((prev) => ({ ...prev, [field.key]: undefined }));
                    }
                  }}
                  placeholder={field.placeholder}
                  className={cn(
                    MODAL_INPUT_CLASS,
                    fieldError && "border-[#ff2c20] bg-[#fff2f1]",
                  )}
                />
                {fieldError && (
                  <p className="text-sm font-medium leading-[20px] text-[#ff2c20]">
                    {fieldError}
                  </p>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </ProfileModalShell>
  );
}
