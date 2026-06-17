"use client";

import { useState } from "react";

import { MODAL_INPUT_CLASS, ProfileModalShell } from "./ProfileModalShell";

const FIELDS = [
  { key: "current", label: "현재 비밀번호", placeholder: "현재 비밀번호를 입력해 주세요" },
  { key: "next", label: "새 비밀번호", placeholder: "새 비밀번호를 입력해 주세요" },
  { key: "confirm", label: "새 비밀번호 확인", placeholder: "새 비밀번호를 다시 입력해 주세요" },
];

export function PasswordChangeModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});

  const handleSubmit = () => {
    setValues({});
    onOpenChange(false);
  };

  return (
    <ProfileModalShell
      open={open}
      onOpenChange={(value) => {
        if (!value) setValues({});
        onOpenChange(value);
      }}
      title="비밀번호 변경"
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-[20px]">
        {FIELDS.map((field) => (
          <label key={field.key} className="flex flex-col gap-[12px]">
            <span className="text-base font-medium leading-[24px] text-black">
              {field.label}
            </span>
            <input
              type="password"
              value={values[field.key] ?? ""}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, [field.key]: event.target.value }))
              }
              placeholder={field.placeholder}
              className={MODAL_INPUT_CLASS}
            />
          </label>
        ))}
      </div>
    </ProfileModalShell>
  );
}
