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

/** 광고비가 없는 매체(운영 원천 데이터 일부)에 "-" 대신 보여 주는 말. 제작비가 없을 때의 "-"는 "제작비 없음"이라 그대로 둔다. */
export const AD_FEE_INQUIRY = "별도 문의";

/**
 * 여러 매체의 합계 — 광고비가 없는(별도 문의) 매체가 섞였으면 숫자 뒤에 "+ @"를 붙인다.
 * 아는 금액이 하나도 없으면(0원) "별도 문의".
 */
export function formatTotalWithInquiry(total: number, hasInquiry: boolean): string {
  if (!hasInquiry) return `${total.toLocaleString()}원`;
  if (total === 0) return AD_FEE_INQUIRY;
  return `${total.toLocaleString()}원 + @`;
}

/** 담긴 매체 중 광고비가 없는(별도 문의) 매체가 있는지 — 기획안 목록 응답의 preview_items 로 본다. */
export function hasAdInquiry(
  items: { advertisement_fee: number | null }[] | null | undefined,
): boolean {
  return (items ?? []).some((it) => it.advertisement_fee == null);
}

/** 광고비 금액 — 없으면 "별도 문의". */
export function formatAdFee(value: number | null | undefined): string {
  return value == null ? AD_FEE_INQUIRY : `${value.toLocaleString()}원`;
}
