import { API_BASE_URL } from "@/lib/api";

/** media_image 상대경로(/uploads/...)를 백엔드 절대 URL로. 외부 URL은 그대로. */
export function mediaSrc(url: string): string {
  if (!url) return url;
  if (url.startsWith("/uploads")) return `${API_BASE_URL}${url}`;
  return url;
}

/** 우리 이미지 호스트(S3 퍼블릭 버킷) — next.config remotePatterns 와 일치. */
const S3_IMAGE_HOST = "ooh-image-public.s3.ap-northeast-2.amazonaws.com";

/** Next Image 최적화 대상 여부(우리 /uploads·S3 이미지). 그 외 외부 URL은 unoptimized 통과. */
export function isOptimizable(url: string): boolean {
  return url.includes("/uploads/") || url.includes(S3_IMAGE_HOST);
}
