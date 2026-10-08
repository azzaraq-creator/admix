"use client";

import { Upload } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef } from "react";

import { XIcon } from "@/components/icons";
import { API_BASE_URL } from "@/lib/api";
import {
  useDeleteMediaImage,
  useSetMediaThumbnail,
  useUploadMediaImage,
  type MediaImageItem,
} from "@/hooks/media";
import { cn } from "@/lib/utils";

const MAX_IMAGES = 50;

const toSrc = (url: string) =>
  url.startsWith("http") ? url : `${API_BASE_URL}${url}`;

export function MediaPhotoSection({
  mediaId,
  images,
  pendingFiles,
  onPendingChange,
}: {
  mediaId: string | null;
  images: MediaImageItem[];
  pendingFiles: File[];
  onPendingChange: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadMediaImage();
  const remove = useDeleteMediaImage();
  const setThumbnail = useSetMediaThumbnail();

  // 등록 모드: 로컬 대기 파일 미리보기 URL (변경 시 이전 URL revoke)
  const previews = useMemo(
    () => pendingFiles.map((f) => URL.createObjectURL(f)),
    [pendingFiles],
  );
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);

  const count = mediaId ? images.length : pendingFiles.length;
  const reachedMax = count >= MAX_IMAGES;
  const disabled = upload.isPending || reachedMax;

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    if (mediaId) {
      for (const file of arr) {
        await upload.mutateAsync({ id: mediaId, file });
      }
    } else {
      onPendingChange([...pendingFiles, ...arr]);
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <section className="flex flex-col gap-[16px]">
      <h2 className="text-lg font-bold leading-[28px] text-black">
        매체 사진 {count}/{MAX_IMAGES}
      </h2>
      <p className="text-sm font-medium leading-[20px] text-disabled">
        {mediaId ? "" : "저장 시 함께 등록됩니다. "}
        대표 이미지는 목록 카드·지도·기획안에 첫 사진으로 쓰입니다.
      </p>

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
            {mediaId
              ? images.map((img) => (
                  <Thumbnail
                    key={img.id}
                    src={toSrc(img.image_url)}
                    isThumbnail={img.is_thumbnail}
                    onSetThumbnail={() =>
                      setThumbnail.mutate({ id: mediaId, imageId: img.id })
                    }
                    onDelete={() =>
                      remove.mutate({ id: mediaId, imageId: img.id })
                    }
                  />
                ))
              : pendingFiles.map((file, i) => (
                  <Thumbnail
                    key={`${file.name}-${i}`}
                    src={previews[i]}
                    // 등록: 첫 번째로 올라가는 사진이 대표가 된다 — 고른 사진을 맨 앞으로 옮긴다.
                    isThumbnail={i === 0}
                    onSetThumbnail={() =>
                      onPendingChange([
                        file,
                        ...pendingFiles.filter((_, idx) => idx !== i),
                      ])
                    }
                    onDelete={() =>
                      onPendingChange(
                        pendingFiles.filter((_, idx) => idx !== i),
                      )
                    }
                  />
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

function Thumbnail({
  src,
  isThumbnail,
  onSetThumbnail,
  onDelete,
}: {
  src: string;
  isThumbnail: boolean;
  onSetThumbnail: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "relative flex size-[200px] shrink-0 flex-col items-end justify-between rounded-[8px] p-[16px]",
        isThumbnail && "ring-2 ring-primary",
      )}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes="200px"
        unoptimized={!src.includes("/uploads/")}
        className="pointer-events-none rounded-[8px] object-cover"
      />
      <button
        type="button"
        onClick={onDelete}
        className="relative flex items-center rounded-full bg-black/70 p-[8px] transition-opacity hover:opacity-90"
        aria-label="이미지 삭제"
      >
        <XIcon className="size-[18px] text-white" />
      </button>
      {isThumbnail ? (
        <span className="relative self-start rounded-[6px] bg-primary px-[10px] py-[4px] text-[12px] font-bold leading-[16px] text-white">
          대표 이미지
        </span>
      ) : (
        <button
          type="button"
          onClick={onSetThumbnail}
          className="relative self-start rounded-[6px] bg-black/70 px-[10px] py-[4px] text-[12px] font-bold leading-[16px] text-white transition-opacity hover:opacity-90"
        >
          대표로 지정
        </button>
      )}
    </div>
  );
}
