"use client";

import { useCallback, useState } from "react";

import { cn } from "@/lib/utils";

type MediaThumbnailProps = {
  src?: string;
  className?: string;
  fallback?: React.ReactNode;
  children?: React.ReactNode;
};

/** 이미지 로딩 중 스켈레톤을 보여주고, 로드 완료 시 한 번에 페이드-인한다. */
export function MediaThumbnail({
  src,
  className,
  fallback,
  children,
}: MediaThumbnailProps) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const loaded = !!src && loadedSrc === src;

  // ref 콜백은 src가 바뀔 때마다 새로 실행되므로, 캐시된 이미지(onLoad 미발화)도 즉시 표시된다.
  const handleImgRef = useCallback(
    (node: HTMLImageElement | null) => {
      if (node?.complete) setLoadedSrc(src ?? null);
    },
    [src],
  );

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-[#eee]",
        className,
      )}
    >
      {src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={handleImgRef}
            src={src}
            alt=""
            onLoad={() => setLoadedSrc(src)}
            onError={() => setLoadedSrc(src)}
            className={cn(
              "size-full object-cover transition-opacity duration-300",
              loaded ? "opacity-100" : "opacity-0",
            )}
          />
          {!loaded && (
            <span
              className="absolute inset-0 animate-pulse bg-[#eee]"
              aria-hidden
            />
          )}
        </>
      ) : (
        fallback
      )}
      {children}
    </div>
  );
}
