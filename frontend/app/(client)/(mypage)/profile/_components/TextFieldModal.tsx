"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { authKeys, useUpdateProfile } from "@/hooks/auth";
import { useSonner } from "@/hooks/useSonner";
import { cn } from "@/lib/utils";

import { MODAL_INPUT_CLASS, ProfileModalShell } from "./ProfileModalShell";

export function TextFieldModal({
  open,
  onOpenChange,
  title,
  placeholder,
  field,
  defaultValue = "",
  validate,
  inputMode,
  maxLength,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  placeholder: string;
  field: "name" | "company_name" | "phone";
  defaultValue?: string;
  validate?: (value: string) => string | null;
  inputMode?: "text" | "numeric";
  maxLength?: number;
}) {
  const mutation = useUpdateProfile();
  const { success } = useSonner();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  const close = (next: boolean) => {
    if (!next) {
      setValue(defaultValue);
      setError(null);
    }
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    const trimmed = value.trim();
    if (validate) {
      const message = validate(trimmed);
      if (message) {
        setError(message);
        return;
      }
    }
    setError(null);
    try {
      await mutation.mutateAsync({ [field]: trimmed });
      await queryClient.invalidateQueries({ queryKey: authKeys.me });
      success("변경되었습니다.");
      onOpenChange(false);
    } catch (caught) {
      const status = (caught as { response?: { status?: number } })?.response
        ?.status;
      setError(
        status === 409
          ? "이미 사용 중인 전화번호입니다."
          : "변경에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      );
    }
  };

  const canSubmit =
    value.trim().length > 0 &&
    value.trim() !== defaultValue &&
    !mutation.isPending;

  return (
    <ProfileModalShell
      open={open}
      onOpenChange={close}
      title={title}
      submitLabel="변경하기"
      submitDisabled={!canSubmit}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-[6px]">
        <input
          type="text"
          inputMode={inputMode}
          maxLength={maxLength}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
          placeholder={placeholder}
          className={cn(
            MODAL_INPUT_CLASS,
            error && "border-[#ff2c20] bg-[#fff2f1]",
          )}
        />
        {error && (
          <p className="text-sm font-medium leading-[20px] text-[#ff2c20]">
            {error}
          </p>
        )}
      </div>
    </ProfileModalShell>
  );
}
