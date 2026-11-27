/**
 * 사업자등록증 모아 보기(2026-11-26 사용자: "사업자등록증을 따로 모아서 볼 수 있는 메뉴") — admix · 콜라보 어드민이 같이 쓴다.
 * 서버: GET /admin/members/business-registrations(모든 회원) · /admin/collab/business-registrations(제휴사 · 광고주).
 */
export interface BizLicenseItem {
  memberId: string;
  name: string;
  loginId: string;
  /** 회원 유형 코드 — general · advertiser · agency · media_owner · partner */
  category: string | null;
  categoryLabel: string;
  partnerCode: string | null;
  companyName: string | null;
  /** reviewing · verified · rejected …(bizStatusLabel) */
  bizStatus: string;
  businessName: string | null;
  businessNo: string | null;
  representativeName: string | null;
  fileName: string | null;
  /** /uploads/business/… — 미리보기는 mediaSrc 로 */
  fileUrl: string;
  /** 내려받을 때 이름 — "제휴사_참커피_사업자등록증.jpg"(회원 유형_상호, 없으면 회원 이름). zip 안 이름과 같다. */
  downloadName: string;
  uploadedAt: string | null;
  verifiedAt: string | null;
}

export interface BizLicenseParams {
  page: number;
  page_size: number;
  category?: string;
  status?: string;
  keyword?: string;
}

/** 한꺼번에 내려받기(zip) 조건 — 목록 조건에서 쪽만 뺀 것. */
export type BizLicenseZipParams = Omit<BizLicenseParams, "page" | "page_size">;

export interface BizLicensePage {
  total: number;
  items: BizLicenseItem[];
}

/** 상태 조건 — 파일을 올린 회원만 나오므로 미등록은 없다. */
export const BIZ_LICENSE_STATUS_OPTIONS = [
  { value: "reviewing", label: "검토 대기" },
  { value: "verified", label: "검토 완료" },
  { value: "rejected", label: "인증 반려" },
];
