"use client";

import { Button } from "@heroui/react";
import { useRef } from "react";

import { BrandAvatar } from "@/components/common/BrandAvatar";
import { useDeleteBrandImage, useUploadBrandImage } from "@/hooks/auth";
import { useSonner } from "@/hooks/useSonner";
import { extractApiError } from "@/lib/apiError";

const ACCEPT = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const MAX_BYTES = 10 * 1024 * 1024;
const BUTTON =
  "h-[32px] min-w-0 shrink-0 rounded-[13px] max-sm:h-[30px] max-sm:rounded-[12px]";

/**
 * 내 정보 — 광고주 브랜드 사진. 고르면 바로 올라간다("저장하기"와 따로).
 * 없으면 콜라보 화면에 기본 이미지(C)가 보인다.
 */
export function BrandImageRow({ url }: { url: string | null | undefined }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadBrandImage();
  const remove = useDeleteBrandImage();
  const { success, error } = useSonner();
  const busy = upload.isPending || remove.isPending;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!ACCEPT.some((ext) => name.endsWith(ext)))
      return error("올릴 수 없는 파일이에요", "JPG·PNG·WEBP·GIF만 가능해요.");
    if (file.size > MAX_BYTES)
      return error("올릴 수 없는 파일이에요", "10MB 이하만 가능해요.");
    try {
      await upload.mutateAsync(file);
      success("브랜드 사진을 바꿨어요");
    } catch (caught) {
      error(
        "브랜드 사진을 올리지 못했어요",
        extractApiError(caught, "잠시 후 다시 시도해 주세요."),
      );
    }
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-[14px]">
      <BrandAvatar src={url} className="size-[56px] rounded-[18px]" />
      <div className="flex min-w-0 flex-col gap-[6px]">
        <div className="flex gap-[6px]">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT.join(",")}
            className="hidden"
            onChange={(event) => {
              void pick(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <Button
            variant="secondary"
            isPending={upload.isPending}
            isDisabled={busy}
            onPress={() => inputRef.current?.click()}
            className={BUTTON}
          >
            {url ? "사진 바꾸기" : "사진 올리기"}
          </Button>
          {url && (
            <Button
              variant="ghost"
              isDisabled={busy}
              onPress={async () => {
                try {
                  await remove.mutateAsync();
                  success("브랜드 사진을 지웠어요");
                } catch (caught) {
                  error(
                    "브랜드 사진을 지우지 못했어요",
                    extractApiError(caught, "잠시 후 다시 시도해 주세요."),
                  );
                }
              }}
              className={BUTTON}
            >
              삭제
            </Button>
          )}
        </div>
        <p className="text-[11px] break-keep text-gray-400 sm:text-[12px]">
          콜라보 화면의 브랜드 아이콘이에요. 없으면 기본 이미지(C)가 보여요 ·
          JPG·PNG·WEBP·GIF, 10MB 이하
        </p>
      </div>
    </div>
  );
}
