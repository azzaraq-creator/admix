"use client";

import { Skeleton, Spinner } from "@heroui/react";
import { useState } from "react";

import { mediaSrc } from "@/lib/media";
import { cn } from "@/lib/utils";
import { MediaImage } from "@/components/common/MediaImage";

type MediaThumbnailProps = {
  src?: string;
  className?: string;
  /** Next Image sizes. 리스트 썸네일 기본 200px. */
  sizes?: string;
  fallback?: React.ReactNode;
  children?: React.ReactNode;
  /** 사진(img)에만 줄 클래스 — 예: 카드 hover 때 확대. 바깥 칸이 잘라 주므로 넘치지 않는다. */
  imageClassName?: string;
};

/**
 * 이미지 로딩 중 스켈레톤을 보여주고, 로드 완료 시 한 번에 페이드-인한다.
 * 0.6초가 넘도록 안 뜨면(느린 연결·큰 사진) 가운데에 스피너를 서서히 띄워 불러오는 중임을 알린다.
 */
export function MediaThumbnail({
  src,
  className,
  sizes = "200px",
  fallback,
  children,
  imageClassName,
}: MediaThumbnailProps) {
  const [loaded, setLoaded] = useState(false);
  const resolved = src ? mediaSrc(src) : null;

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-[#eee]",
        className,
      )}
    >
      {resolved ? (
        <>
          <MediaImage
            src={resolved}
            alt=""
            fill
            sizes={sizes}
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
            className={cn(
              "object-cover transition-[opacity,scale] duration-300",
              loaded ? "opacity-100" : "opacity-0",
              imageClassName,
            )}
          />
          {!loaded && (
            <>
              <Skeleton aria-hidden className="absolute inset-0 rounded-none" />
              {/* 금방 뜨는 사진엔 스피너가 번쩍이지 않게 0.6초 뒤에야 나타난다(globals.css admix-fade-in).
                  색은 회색 — 회색 스켈레톤 위에서 튀지 않게(color="current"로 글자색을 따른다). */}
              <span
                aria-hidden
                className="absolute inset-0 flex animate-[admix-fade-in_200ms_ease-out_600ms_both] items-center justify-center"
              >
                <Spinner size="sm" color="current" className="text-gray-400" />
              </span>
            </>
          )}
        </>
      ) : (
        fallback
      )}
      {children}
    </div>
  );
}
