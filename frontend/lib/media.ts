import { API_BASE_URL } from "@/lib/api";

/** media_image 상대경로(/uploads/...)를 백엔드 절대 URL로. 외부 URL은 그대로. */
export function mediaSrc(url: string): string {
  if (!url) return url;
  if (url.startsWith("/uploads")) return `${API_BASE_URL}${url}`;
  return url;
}

/** Next Image 최적화 대상 여부(로컬 /uploads 이미지). 외부 레거시 URL은 unoptimized 통과. */
export function isOptimizable(url: string): boolean {
  return url.includes("/uploads/");
}
