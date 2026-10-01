"use client";

import { Skeleton } from "@heroui/react";
import Image from "next/image";
import { useState } from "react";

import { isOptimizable, mediaSrc } from "@/lib/media";
import { cn } from "@/lib/utils";

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

/** 이미지 로딩 중 스켈레톤을 보여주고, 로드 완료 시 한 번에 페이드-인한다. */
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
          <Image
            src={resolved}
            alt=""
            fill
            sizes={sizes}
            unoptimized={!isOptimizable(resolved)}
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
            className={cn(
              "object-cover transition-[opacity,scale] duration-300",
              loaded ? "opacity-100" : "opacity-0",
              imageClassName,
            )}
          />
          {!loaded && (
            <Skeleton aria-hidden className="absolute inset-0 rounded-none" />
          )}
        </>
      ) : (
        fallback
      )}
      {children}
    </div>
  );
}
