"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

import { isOptimizable } from "@/lib/media";

type MediaImageProps = Omit<ImageProps, "src" | "unoptimized"> & {
  src: string;
};

/**
 * 매체 사진 — 우리 S3·/uploads 사진은 Next 이미지 최적화(/_next/image)로 줄여 보여 주고,
 * 최적화가 실패하면 원본 주소로 한 번 더 불러온다.
 *
 * 운영 이미지 최적화(Amplify)는 가로·세로 9000px 넘는 원본을 거부한다(2026-10-13, 압구정로데오 H1 등 8장).
 * 새로 올리는 사진은 백엔드가 긴 변 4000px로 줄여 저장하지만, 예전 사진이 빈칸으로 남지 않게 여기서 한 번 더 막는다.
 * onError 는 원본까지 실패했을 때만 부른다.
 */
export function MediaImage({ src, alt, onError, ...props }: MediaImageProps) {
  // 최적화에 실패한 주소 — 주소가 바뀌면 다시 최적화부터 시도한다.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const optimize = isOptimizable(src) && failedSrc !== src;
  return (
    <Image
      {...props}
      src={src}
      alt={alt}
      unoptimized={!optimize}
      onError={(e) => {
        if (optimize) {
          setFailedSrc(src);
          return;
        }
        onError?.(e);
      }}
    />
  );
}
