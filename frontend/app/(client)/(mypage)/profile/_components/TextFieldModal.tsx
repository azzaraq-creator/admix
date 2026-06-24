"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { authKeys, useUpdateProfile } from "@/hooks/auth";
import { useSonner } from "@/hooks/useSonner";

import { MODAL_INPUT_CLASS, ProfileModalShell } from "./ProfileModalShell";

export function TextFieldModal({
  open,
  onOpenChange,
  title,
  placeholder,
  field,
  defaultValue = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  placeholder: string;
  field: "name" | "company_name";
  defaultValue?: string;
}) {
  const mutation = useUpdateProfile();
  const { success } = useSonner();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(defaultValue);

  const close = (next: boolean) => {
    if (!next) setValue(defaultValue);
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    try {
      await mutation.mutateAsync({ [field]: value.trim() });
      await queryClient.invalidateQueries({ queryKey: authKeys.me });
      success("변경되었습니다.");
      onOpenChange(false);
    } catch {
      return;
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
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className={MODAL_INPUT_CLASS}
      />
    </ProfileModalShell>
  );
}
