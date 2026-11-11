/**
 * 콜라보 어드민 전용 — 목록 조건 · 라벨 · 날짜 표시. 공용 타입은 lib/partners.ts.
 */
import type {
  BizStatusCode,
  CollabPhotoStep,
  ParticipantStatus,
} from "@/lib/partners";

export interface PageParams {
  page?: number;
  page_size?: number;
}

export interface Paged<T> {
  total: number;
  items: T[];
}

/** 제휴사 회원 목록 조건 — agreement done/none · biz 사업자 상태 · store yes/no. */
export interface CollabMemberListParams extends PageParams {
  keyword?: string;
  agreement?: string;
  biz?: string;
  store?: string;
}

/** 광고주 회원 목록 조건(11-10) — biz 사업자 상태 · brand/card yes/no(브랜드 · 명함 등록 여부). */
export interface CollabAdvertiserListParams extends PageParams {
  keyword?: string;
  biz?: string;
  brand?: string;
  card?: string;
}

/** 광고주 회원(읽기 전용) — 백엔드 collab_advertiser_service._summary. */
export interface AdminAdvertiserMember {
  id: string;
  loginId: string;
  email: string;
  name: string | null;
  phone: string | null;
  companyName: string | null;
  industry: string | null;
  /** 담당자 정보(068) — 이름 · 직함(position) · 소속팀 · 명함 */
  contactName: string | null;
  position: string | null;
  department: string | null;
  businessCardUrl: string | null;
  businessCardName: string | null;
  snsProvider: string | null;
  status: string;
  createdAt: string | null;
  bizStatus: BizStatusCode;
  bizName: string | null;
  bizNo: string | null;
  bizFileName: string | null;
  bizUploadedAt: string | null;
  bizVerifiedAt: string | null;
  bizRejectReason: string | null;
  brands: {
    id: string;
    name: string;
    imageUrl: string | null;
    createdAt: string | null;
  }[];
}

export interface CollabRequestListParams extends PageParams {
  status?: string;
  store_id?: string;
}

export interface CollabListParams extends PageParams {
  phase?: string;
  keyword?: string;
}

export type BizAction = "provisional" | "verify" | "reject" | "reset";

export const BIZ_STATUS_OPTIONS: { value: BizStatusCode; label: string }[] = [
  { value: "unregistered", label: "미등록" },
  { value: "reviewing", label: "검토 대기" },
  { value: "provisional", label: "임시 승인" },
  { value: "verified", label: "검토 완료" },
  { value: "rejected", label: "인증 반려" },
];

export const PARTICIPANT_STATUS_LABEL: Record<ParticipantStatus, string> = {
  applied: "신청",
  requested: "확정 요청",
  confirmed: "확정",
  declined: "미참여",
  cancelled: "취소",
};

/** 매장 화면과 같은 입장 이름 — 선정 후보 · 예비 등. */
export const STANDING_LABEL: Record<string, string> = {
  none: "-",
  blocked: "기간 겹침",
  candidate: "선정 후보",
  reserve: "예비",
  requested: "확정 요청",
  confirmed: "확정",
  declined: "미참여",
  cancelled: "취소",
};

export const PHOTO_STEP_LABEL: Record<CollabPhotoStep, string> = {
  install: "설치",
  check1: "1차 점검",
  check2: "2차 점검",
  check3: "3차 점검",
};
export const PHOTO_STEPS: CollabPhotoStep[] = [
  "install",
  "check1",
  "check2",
  "check3",
];

export const COLLAB_TYPE_LABEL: Record<"ready" | "made", string> = {
  ready: "준비형",
  made: "제작형",
};

export const COLLAB_STATUS_LABEL: Record<
  "draft" | "published" | "cancelled",
  string
> = {
  draft: "비공개(작성 중)",
  published: "공개",
  cancelled: "취소",
};

/** YYYY-MM-DD → 2026.11.09 */
export const dotDate = (ymd: string | null | undefined) =>
  ymd ? ymd.slice(0, 10).replaceAll("-", ".") : "-";

/** YYYY-MM-DD → 11.09 */
export const shortDate = (ymd: string | null | undefined) =>
  ymd ? ymd.slice(5, 10).replace("-", ".") : "-";

/** ISO 시각 → 2026.11.09 14:20 (브라우저 시간대, 한국에서 쓰므로 KST). */
export function dotDateTime(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** ISO 시각 → datetime-local 입력 값(YYYY-MM-DDTHH:mm, 브라우저 시간대). */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 고유번호 입력 정리 — p1 · 0001 · P0001 → P-0001(서버도 같은 규칙으로 찾는다). */
export function normalizeCode(raw: string, prefix: "P" | "S") {
  const t = raw.trim().toUpperCase().replaceAll(" ", "");
  if (!t) return "";
  const digits = t.replace(new RegExp(`^${prefix}-?`), "");
  return /^\d+$/.test(digits) ? `${prefix}-${digits.padStart(4, "0")}` : t;
}
