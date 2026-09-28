/** 회원 유형 — 백엔드 users.member_category 값과 같다. */
export type MemberCategory =
  "advertiser" | "agency" | "media_owner" | "general";

/** 시안(00. 회원가입 - 회원 유형 선택)의 카드 순서·문구. */
export const MEMBER_CATEGORIES: {
  value: MemberCategory;
  label: string;
  description: string[];
}[] = [
  {
    value: "advertiser",
    label: "광고주",
    description: ["직접 광고를 집행하는", "기업 · 담당자"],
  },
  {
    value: "agency",
    label: "광고 대행사",
    description: ["광고주를 대신해 광고를", "기획하고 집행하는 대행사"],
  },
  {
    value: "media_owner",
    label: "매체사",
    description: ["옥외광고 매체를 등록하고", "관리하는 사업자"],
  },
  {
    value: "general",
    label: "일반",
    description: ["서비스를 둘러보고", "이용하려는 개인 사용자"],
  },
];

export const MEMBER_CATEGORY_LABEL: Record<MemberCategory, string> =
  Object.fromEntries(
    MEMBER_CATEGORIES.map((c) => [c.value, c.label]),
  ) as Record<MemberCategory, string>;

export function isMemberCategory(value: unknown): value is MemberCategory {
  return MEMBER_CATEGORIES.some((c) => c.value === value);
}
