"use client";

import { useRef, useState } from "react";

import { LicenseFileInfo } from "@/components/common/LicenseFileInfo";
import { CircleAlertIcon, XIcon } from "@/components/icons";
import { useUploadBusinessRegistration } from "@/hooks/auth";
import { extractApiError } from "@/lib/apiError";

import { ProfileModalShell } from "./ProfileModalShell";

const NOTICES = [
  "사업자등록증 정보는 계약 관련 용도로 사용됩니다.",
  "변경 시, 검토후 3영업일 이내 반영됩니다.",
];

const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPT = "application/pdf,image/png,image/jpeg";

export function BusinessRegisterModal({
  open,
  onOpenChange,
  mode = "change",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "register" | "change";
}) {
  const isRegister = mode === "register";
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadBusinessRegistration();
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickFile = (next: File | null) => {
    if (!next) return;
    if (next.size > MAX_SIZE) {
      setError("파일 크기는 10MB 이하만 가능합니다.");
      return;
    }
    setError(null);
    setFile(next);
  };

  const clearFile = () => {
    setFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!file) return;
    try {
      await upload.mutateAsync(file);
      clearFile();
      onOpenChange(false);
    } catch (err) {
      setError(extractApiError(err, "업로드 중 오류가 발생했습니다."));
    }
  };

  return (
    <ProfileModalShell
      open={open}
      onOpenChange={(value) => {
        if (!value) clearFile();
        onOpenChange(value);
      }}
      title={isRegister ? "사업자등록증 등록" : "사업자등록증 변경"}
      submitLabel={isRegister ? "등록하기" : "변경하기"}
      submitDisabled={!file || upload.isPending}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-[20px]">
        <div className="flex flex-col gap-[16px]">
          <p className="text-sm font-medium leading-[20px] text-grey-500">
            {isRegister
              ? "사업자등록증을 업로드해주세요."
              : "새로운 사업자등록증을 업로드해주세요."}
          </p>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
          />

          {file ? (
            <div className="flex w-full items-center gap-[12px] rounded-[8px] border border-stroke p-[16px]">
              <LicenseFileInfo
                name={file.name}
                uploadedAt={new Date(file.lastModified).toISOString()}
                className="flex-1"
              />
              <button
                type="button"
                aria-label="파일 삭제"
                onClick={clearFile}
                className="shrink-0 cursor-pointer text-grey-500"
              >
                <XIcon className="size-[24px]" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                pickFile(event.dataTransfer.files?.[0] ?? null);
              }}
              className={`flex h-[162px] w-full flex-col items-center justify-center gap-[12px] rounded-[8px] border border-dashed ${
                dragging ? "border-primary bg-primary-50" : "border-stroke"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/business-upload.svg"
                alt=""
                className="size-[80px]"
              />
              <div className="flex flex-col items-center gap-[6px]">
                <p className="text-sm font-medium leading-[20px] text-black">
                  파일을 드래그하거나 클릭하여 업로드
                </p>
                <p className="text-xs font-medium leading-[16px] text-disabled">
                  PDF 형식, 최대 10MB
                </p>
              </div>
            </button>
          )}

          {error && (
            <p className="text-sm font-medium leading-[20px] text-[#ff2c20]">
              {error}
            </p>
          )}
        </div>

        <div className="h-px w-full bg-stroke" />

        <div className="flex items-start gap-[8px] rounded-[8px] border border-stroke p-[16px]">
          <CircleAlertIcon className="size-[18px] shrink-0 text-primary" />
          <div className="flex flex-1 flex-col gap-[4px]">
            <p className="text-xs font-medium leading-[16px] tracking-[0.0048px] text-black">
              안내 사항
            </p>
            <div className="flex flex-col gap-[2px]">
              {NOTICES.map((notice) => (
                <div key={notice} className="flex items-center gap-[8px]">
                  <span className="size-[4px] shrink-0 rounded-full bg-[#737586]" />
                  <p className="text-xs font-medium leading-[16px] tracking-[0.0048px] text-[#737586]">
                    {notice}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ProfileModalShell>
  );
}
