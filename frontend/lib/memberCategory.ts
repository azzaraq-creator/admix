/** 회원 유형 — 백엔드 users.member_category 값과 같다. */
export type MemberCategory =
  "general" | "advertiser" | "agency" | "media_owner" | "partner";

/**
 * 회원 유형 카드 순서·문구 — 일반 · 광고주 · 대행사 · 매체사 · 제휴사(콜라보).
 * 가입 화면은 한 줄씩 세로로 두고 일반 | 광고주 · 대행사 | 매체사 · 제휴사(콜라보) 사이에 구분선을 둔다(CategoryStep).
 * 유형별 이용 범위는 플랜 비교 표(components/common/MemberPlanModal)에 정리한다.
 */
export const MEMBER_CATEGORIES: {
  value: MemberCategory;
  label: string;
  description: string[];
}[] = [
  {
    value: "general",
    label: "일반",
    description: ["서비스를 둘러보고", "이용하려는 개인 사용자"],
  },
  {
    value: "advertiser",
    label: "광고주",
    description: ["직접 광고를 집행하는", "기업 · 담당자"],
  },
  {
    value: "agency",
    label: "대행사",
    description: ["광고주를 대신해 광고를", "기획하고 집행하는 대행사"],
  },
  {
    value: "media_owner",
    label: "매체사",
    description: ["옥외광고 매체를 등록하고", "관리하는 사업자"],
  },
  {
    value: "partner",
    label: "제휴사(콜라보)",
    description: ["매장을 등록하고", "광고주와 콜라보하는 제휴사"],
  },
];

export const MEMBER_CATEGORY_LABEL: Record<MemberCategory, string> =
  Object.fromEntries(
    MEMBER_CATEGORIES.map((c) => [c.value, c.label]),
  ) as Record<MemberCategory, string>;

export function isMemberCategory(value: unknown): value is MemberCategory {
  return MEMBER_CATEGORIES.some((c) => c.value === value);
}

/** 콜라보 메뉴(/partners)를 쓸 수 있는 유형 — 광고주는 콜라보 매장 찾기, 제휴사(콜라보)는 매장 관리. */
export const PARTNERS_CATEGORIES: MemberCategory[] = ["advertiser", "partner"];

export function canUsePartners(category: MemberCategory | null | undefined) {
  return !!category && PARTNERS_CATEGORIES.includes(category);
}
