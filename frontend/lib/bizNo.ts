/** 사업자번호 숫자 자릿수 — 000-00-00000. */
export const BIZ_NO_DIGITS = 10;

/**
 * admix 사업자번호(11-18 사용자) — 협약서 당사자 정보 · 사이트 아래 회사 정보에 쓰고,
 * 제휴사 가입 매장 정보에 넣으면 막는다(백엔드 auth_service.ADMIX_BUSINESS_REGISTRATION_NO 와 같은 값).
 */
export const ADMIX_BIZ_NO = "533-81-03199";

/** admix 사업자번호인지 — 숫자만 견준다. */
export const isAdmixBizNo = (value: string) =>
  value.replace(/\D/g, "") === ADMIX_BIZ_NO.replace(/\D/g, "");

/** 사업자번호 입력 — 숫자만 10자리까지 받아 000-00-00000 으로 나눠 보여 준다(가입 · 어드민 광고주 상세가 같이 쓴다). */
export function formatBizNoInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, BIZ_NO_DIGITS);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

/** 숫자 10자리를 다 채웠는지. */
export const isBizNoComplete = (value: string) =>
  value.replace(/\D/g, "").length === BIZ_NO_DIGITS;
