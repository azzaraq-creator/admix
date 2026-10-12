"use client";

import { Button, Card, Chip, Spinner } from "@heroui/react";
import { ImagePlus, Trash2 } from "lucide-react";
import Image from "next/image";
import { type DragEvent, useEffect, useMemo, useRef, useState } from "react";

import { API_BASE_URL } from "@/lib/api";
import {
  useDeleteMediaImage,
  useSetMediaThumbnail,
  useUploadMediaImage,
  type MediaImageItem,
} from "@/hooks/media";
import { useSonner } from "@/hooks/useSonner";
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
  const { error } = useSonner();
  const [dragging, setDragging] = useState(false);
  // 수정 화면에서 여러 장을 한 장씩 올리는 동안의 진행 상황(올린 수/전체)
  const [progress, setProgress] = useState<{ done: number; total: number }>();

  // 등록 모드: 로컬 대기 파일 미리보기 URL (변경 시 이전 URL revoke)
  const previews = useMemo(
    () => pendingFiles.map((f) => URL.createObjectURL(f)),
    [pendingFiles],
  );
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);

  const count = mediaId ? images.length : pendingFiles.length;
  const remaining = MAX_IMAGES - count;
  const uploading = progress !== undefined;
  const disabled = uploading || remaining <= 0;

  const addFiles = async (list: FileList | File[] | null) => {
    if (!list || disabled) return;
    const all = Array.from(list);
    const imagesOnly = all.filter((f) => f.type.startsWith("image/"));
    if (imagesOnly.length < all.length) {
      error("이미지 파일만 올릴 수 있습니다.");
    }
    const files = imagesOnly.slice(0, remaining);
    if (imagesOnly.length > files.length) {
      error(
        `사진은 최대 ${MAX_IMAGES}장까지예요. ${files.length}장만 추가합니다.`,
      );
    }
    if (files.length === 0) return;

    if (!mediaId) {
      onPendingChange([...pendingFiles, ...files]);
      return;
    }
    let failed = 0;
    setProgress({ done: 0, total: files.length });
    for (const [i, file] of files.entries()) {
      try {
        await upload.mutateAsync({ id: mediaId, file });
      } catch {
        failed += 1;
      }
      setProgress({ done: i + 1, total: files.length });
    }
    setProgress(undefined);
    if (failed > 0)
      error(`${failed}장을 올리지 못했습니다. 다시 시도해 주세요.`);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    void addFiles(e.dataTransfer.files);
  };

  return (
    <section className="flex flex-col gap-[16px]">
      <div className="flex flex-col gap-[4px]">
        <div className="flex items-center gap-[8px]">
          <h2 className="text-lg font-bold leading-[28px] text-black">
            매체 사진
          </h2>
          <Chip size="sm" color={remaining <= 0 ? "danger" : "default"}>
            {count}/{MAX_IMAGES}
          </Chip>
        </div>
        <p className="text-sm font-medium leading-[20px] text-disabled">
          {mediaId ? "" : "저장할 때 함께 등록됩니다. "}
          대표 사진은 목록 카드·지도·기획안의 첫 사진으로 쓰입니다.
        </p>
      </div>

      {/* 올리기 칸 + 사진 — 한 줄로 놓고 넘치면 가로 스크롤 */}
      <div className="flex items-stretch gap-[12px] overflow-x-auto pb-[4px]">
        {/* 올리기 — 끌어다 놓거나 [사진 선택] */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex w-[200px] shrink-0 flex-col items-center justify-center gap-[10px] rounded-[12px] border-2 border-dashed px-[16px] py-[20px] text-center transition-colors",
            dragging
              ? "border-primary bg-primary-50"
              : "border-stroke bg-[#fafafc]",
            disabled && !uploading && "opacity-60",
          )}
        >
          {uploading ? (
            <>
              <Spinner size="md" />
              <p className="text-sm font-semibold leading-[20px] text-black">
                업로드 중… {progress.done}/{progress.total}
              </p>
            </>
          ) : (
            <>
              <ImagePlus className="size-[28px] text-[#71717a]" />
              <div className="flex flex-col gap-[2px]">
                <p className="text-sm font-semibold leading-[20px] text-black">
                  {remaining <= 0
                    ? `사진을 최대 ${MAX_IMAGES}장까지 올렸습니다`
                    : "사진을 끌어다 놓거나"}
                </p>
                {remaining > 0 && (
                  <p className="text-xs font-medium leading-[16px] text-disabled">
                    여러 장 선택 가능 · {remaining}장 더
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="primary"
                isDisabled={disabled}
                onPress={() => inputRef.current?.click()}
              >
                사진 선택
              </Button>
            </>
          )}
        </div>

        {mediaId
          ? images.map((img) => (
              <PhotoCard
                key={img.id}
                src={toSrc(img.image_url)}
                isThumbnail={img.is_thumbnail}
                isBusy={uploading}
                onSetThumbnail={() =>
                  setThumbnail.mutate({ id: mediaId, imageId: img.id })
                }
                onDelete={() => remove.mutate({ id: mediaId, imageId: img.id })}
              />
            ))
          : pendingFiles.map((file, i) => (
              <PhotoCard
                key={`${file.name}-${file.lastModified}-${i}`}
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
                  onPendingChange(pendingFiles.filter((_, idx) => idx !== i))
                }
              />
            ))}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </section>
  );
}

function PhotoCard({
  src,
  isThumbnail,
  isBusy = false,
  onSetThumbnail,
  onDelete,
}: {
  src: string;
  isThumbnail: boolean;
  isBusy?: boolean;
  onSetThumbnail: () => void;
  onDelete: () => void;
}) {
  return (
    <Card
      className={cn(
        "relative w-[200px] shrink-0 gap-0 overflow-hidden border p-0 shadow-none",
        isThumbnail ? "border-transparent" : "border-stroke",
      )}
    >
      {/* 대표 사진 테두리 — 카드 안쪽에 그려 사진 위에 겹친다(바깥으로 두꺼워지지 않게). */}
      {isThumbnail && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] border-2 border-primary"
        />
      )}
      <div className="relative aspect-[4/3] w-full bg-[#f4f4f5]">
        <Image
          src={src}
          alt=""
          fill
          sizes="240px"
          unoptimized={!src.includes("/uploads/")}
          className="pointer-events-none object-cover"
        />
        {isThumbnail && (
          <Chip
            size="sm"
            color="accent"
            variant="primary"
            className="absolute left-[8px] top-[8px]"
          >
            대표 사진
          </Chip>
        )}
        <Button
          isIconOnly
          size="sm"
          variant="tertiary"
          aria-label="이미지 삭제"
          isDisabled={isBusy}
          onPress={onDelete}
          className="absolute right-[8px] top-[8px] bg-white/90"
        >
          <Trash2 className="size-[16px]" />
        </Button>
      </div>
      <Card.Footer className="p-[8px]">
        <Button
          fullWidth
          size="sm"
          variant={isThumbnail ? "ghost" : "secondary"}
          isDisabled={isThumbnail || isBusy}
          onPress={onSetThumbnail}
        >
          {isThumbnail ? "대표 사진" : "대표로 지정"}
        </Button>
      </Card.Footer>
    </Card>
  );
}
