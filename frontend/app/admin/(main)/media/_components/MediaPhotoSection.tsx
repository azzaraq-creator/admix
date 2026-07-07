"use client";

import { Upload } from "lucide-react";
import { useRef } from "react";

import { XIcon } from "@/components/icons";
import { API_BASE_URL } from "@/lib/api";
import {
  useDeleteMediaImage,
  useUploadMediaImage,
  type MediaImageItem,
} from "@/hooks/media";

const MAX_IMAGES = 50;

const toSrc = (url: string) =>
  url.startsWith("http") ? url : `${API_BASE_URL}${url}`;

export function MediaPhotoSection({
  mediaId,
  images,
}: {
  mediaId: string | null;
  images: MediaImageItem[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadMediaImage();
  const remove = useDeleteMediaImage();
  const reachedMax = images.length >= MAX_IMAGES;
  const disabled = !mediaId || upload.isPending || reachedMax;

  const handleFiles = async (files: FileList | null) => {
    if (!mediaId || !files) return;
    for (const file of Array.from(files)) {
      await upload.mutateAsync({ id: mediaId, file });
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <section className="flex flex-col gap-[16px]">
      <h2 className="text-lg font-bold leading-[28px] text-black">
        매체 사진 {images.length}/{MAX_IMAGES}
      </h2>
      {!mediaId && (
        <p className="text-sm font-medium leading-[20px] text-disabled">
          저장 후 이미지를 등록할 수 있습니다.
        </p>
      )}

      <div className="flex items-start gap-[10px]">
        {/* 업로드 박스 */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="flex size-[200px] shrink-0 flex-col items-center justify-center gap-[10px] rounded-[8px] bg-[#f9f9f9] p-[16px] transition-colors hover:bg-[#f0f0f0] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <div className="flex flex-1 flex-col items-center justify-center gap-[10px]">
            <Upload className="size-[24px] text-[#333333]" />
            <div className="flex flex-col items-center gap-[2px] text-center">
              <span className="text-[16px] font-semibold leading-[24px] text-black">
                이미지 업로드
              </span>
              <span className="text-[12px] font-medium leading-[16px] text-[#767676]">
                최대 {MAX_IMAGES}개 추가 가능합니다
              </span>
            </div>
          </div>
          <span className="flex w-full items-center justify-center rounded-[6px] bg-primary px-[24px] py-[8px] text-[14px] font-bold leading-[1.4] text-white">
            {upload.isPending ? "업로드 중..." : "업로드"}
          </span>
        </button>

        {/* 썸네일 스트립 */}
        <div className="flex min-w-0 flex-1 flex-col gap-[12px]">
          <div className="flex items-center gap-[10px] overflow-x-auto">
            {images.map((img) => (
              <div
                key={img.id}
                className="relative flex size-[200px] shrink-0 flex-col items-end rounded-[8px] p-[16px]"
              >
                <img
                  src={toSrc(img.image_url)}
                  alt=""
                  className="pointer-events-none absolute inset-0 size-full rounded-[8px] object-cover"
                />
                <button
                  type="button"
                  onClick={() =>
                    mediaId && remove.mutate({ id: mediaId, imageId: img.id })
                  }
                  className="relative flex items-center rounded-full bg-black/70 p-[8px] transition-opacity hover:opacity-90"
                  aria-label="이미지 삭제"
                >
                  <XIcon className="size-[18px] text-white" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
    </section>
  );
}
