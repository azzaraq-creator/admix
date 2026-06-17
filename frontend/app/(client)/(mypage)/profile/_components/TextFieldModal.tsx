"use client";

import { useState } from "react";

import { MODAL_INPUT_CLASS, ProfileModalShell } from "./ProfileModalShell";

export function TextFieldModal({
  open,
  onOpenChange,
  title,
  placeholder,
  defaultValue = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  placeholder: string;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue);

  const handleSubmit = () => onOpenChange(false);

  return (
    <ProfileModalShell
      open={open}
      onOpenChange={(next) => {
        if (!next) setValue(defaultValue);
        onOpenChange(next);
      }}
      title={title}
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
