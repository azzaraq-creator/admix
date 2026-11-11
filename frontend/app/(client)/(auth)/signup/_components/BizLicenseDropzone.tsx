"use client";

import { Button, Spinner } from "@heroui/react";
import { useRef, useState, type DragEvent } from "react";

import { FileIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import { UploadIcon } from "./signupIcons";
import { RADIUS } from "./signupUi";

/** 백엔드 LICENSE_ALLOWED_EXTENSIONS / LICENSE_MAX_UPLOAD_SIZE 와 같다. */
const BIZ_FILE_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg"];
const BIZ_FILE_MAX_BYTES = 10 * 1024 * 1024;

function bizFileError(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!BIZ_FILE_EXTENSIONS.some((ext) => name.endsWith(ext)))
    return "PDF, PNG, JPG 파일만 올릴 수 있습니다.";
  if (file.size > BIZ_FILE_MAX_BYTES)
    return "10MB 이하 파일만 올릴 수 있습니다.";
  return null;
}

/**
 * 사업자등록증 올리기 칸 — 회원가입 회원정보(대행사 · 매체사 · 광고주)와 기본협약 협약서 단계(제휴사)가 같은 모양을 쓴다(11-10 사용자).
 * 파일이 없으면 점선 드롭존(누르거나 끌어 놓기), 있으면 파일 이름 줄 + 오른쪽 버튼.
 * 버튼은 onRemove 가 있으면 "삭제"(가입 — 아직 안 보낸 파일), 없으면 "다시 올리기"(협약 — 이미 올린 파일).
 * 파일 검사(확장자 · 10MB)는 여기서 하고, 틀리면 onError 로 알린다. HeroUI에는 파일 드롭존이 없어 직접 만든다.
 */
export function BizLicenseDropzone({
  fileName,
  onPick,
  onError,
  onRemove,
  pending = false,
}: {
  /** 고른(또는 이미 올린) 파일 이름 — 없으면 드롭존. */
  fileName?: string | null;
  onPick: (file: File) => void;
  onError: (message: string) => void;
  onRemove?: () => void;
  /** 올리는 중 — 버튼 자리에 도는 표시. */
  pending?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = (file: File | undefined) => {
    if (!file) return;
    const error = bizFileError(file);
    if (error) onError(error);
    else onPick(file);
  };
  const open = () => inputRef.current?.click();
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    pick(event.dataTransfer.files?.[0]);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={BIZ_FILE_EXTENSIONS.join(",")}
        className="hidden"
        onChange={(event) => {
          pick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {fileName ? (
        <div
          className={cn(
            "flex h-[44px] w-full items-center justify-between gap-[10px] border border-tone-ececef pr-[4px] pl-[14px]",
            RADIUS.h44,
          )}
        >
          <div className="flex min-w-0 items-center gap-[8px]">
            <FileIcon className="size-[18px] shrink-0 text-gray-500" />
            <span className="truncate text-[13px] text-zinc-900">
              {fileName}
            </span>
          </div>
          {pending ? (
            <span className="flex h-[36px] shrink-0 items-center px-[12px]">
              <Spinner size="sm" aria-label="올리는 중" />
            </span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onPress={onRemove ?? open}
              className={cn(
                "h-[36px] shrink-0 px-[12px] text-[12px] text-gray-500 data-[hovered=true]:text-gray-900",
                RADIUS.h36,
              )}
            >
              {onRemove ? "삭제" : "다시 올리기"}
            </Button>
          )}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label="사업자등록증 파일 선택"
          onClick={open}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              open();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "flex h-[100px] w-full cursor-pointer flex-col items-center justify-center gap-[4px] rounded-[10px] border border-dashed text-gray-400 transition-colors",
            dragging
              ? "border-primary-500 bg-primary-50"
              : "border-gray-200 bg-zinc-50 hover:border-gray-300",
          )}
        >
          <UploadIcon className="size-[20px]" />
          <p className="text-[13px]">파일을 선택하거나 드래그하세요</p>
          <p className="text-[11px]">PDF, PNG, JPG 파일만 가능합니다.</p>
        </div>
      )}
    </>
  );
}
