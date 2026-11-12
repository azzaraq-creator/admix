/**
 * 콜라보 어드민 전용 — 목록 조건 · 라벨 · 날짜 표시. 공용 타입은 lib/partners.ts.
 */
import type { CollabRequestStatus, PlanAuthor, PlanBlock } from "@/lib/collabPlan";
import type {
  AdminCollab,
  BizStatusCode,
  CollabItem,
  StoreCollabCounts,
  CollabPhase,
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
  /** 콜라보 수 — 보낸 의뢰 중 취소만 뺀 수(목록 응답에만, 11-12). */
  collabCount?: number;
}

export interface CollabRequestListParams extends PageParams {
  status?: string;
  store_id?: string;
}

/**
 * 광고주 콜라보 의뢰(081) 목록 조건 — status: new(아직 안 연 것) · viewed(연 것) · cancelled(광고주가 취소, 084) ·
 * 기획안 상태(085: submitted · proposed · revised · confirmed).
 */
export interface AdvCollabRequestListParams extends PageParams {
  keyword?: string;
  status?: "new" | "viewed" | "cancelled" | "submitted" | "proposed" | "revised" | "confirmed";
}

/** 의뢰 상태 이름 · 색(085) — 목록 칩 · 상세 머리. admix 차례(접수 · 광고주 수정)는 보라, 광고주 차례는 회색. */
export const ADV_REQUEST_STATUS: Record<
  CollabRequestStatus,
  { label: string; color: "accent" | "default" | "success" | "warning" | "danger" }
> = {
  submitted: { label: "접수", color: "accent" },
  proposed: { label: "광고주 확인 중", color: "default" },
  revised: { label: "광고주 수정", color: "warning" },
  confirmed: { label: "확정", color: "success" },
  cancelled: { label: "취소", color: "default" },
};

export const advRequestStatusOf = (status: string) =>
  ADV_REQUEST_STATUS[status as CollabRequestStatus] ?? ADV_REQUEST_STATUS.submitted;

/** 광고주 콜라보 의뢰 — 어드민 목록 한 줄(백엔드 collab_request_service._admin_row). */
export interface AdminAdvCollabRequest {
  id: string;
  /** 문서 번호 CR-YYMMDD-NN. */
  code: string;
  /** submitted(접수) · proposed(admix 기획안 보냄) · revised(광고주가 고쳐 보냄) · confirmed(확정) · cancelled(취소, 084). */
  status: string;
  /** 어드민이 아직 열어 보지 않음 — 취소한 의뢰는 늘 false. */
  isNew: boolean;
  /** 광고주가 의뢰를 취소한 때(084) — 지우지 않고 "취소"로 남긴다. */
  cancelledAt: string | null;
  brandName: string;
  brandImageUrl: string | null;
  title: string;
  startDate: string;
  endDate: string;
  course: "standard" | "rush";
  minStores: number;
  targetStores: number;
  itemKeys: string[];
  preferredCount: number;
  estimateTotal: number | null;
  estimateNegotiable: number;
  contactName: string;
  advertiser: {
    id: string;
    loginId: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    companyName: string | null;
    contactName: string | null;
    position: string | null;
    department: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  /** 기획안 차수(085) — 몇 차까지 오갔는지 · 마지막에 보낸 쪽 · 광고주가 확정한 때. */
  roundCount: number;
  lastRoundAuthor: PlanAuthor | null;
  confirmedAt: string | null;
}

/** 의뢰서 한 장 — 보낸 내용 전부 + 그때 계산한 예상 비용 · 일정(참고용) + 기획안 차수(085). */
export interface AdminAdvCollabRequestDetail extends AdminAdvCollabRequest, PlanBlock {
  summary: string | null;
  contact: { name: string; phone: string; role: string };
  items: { key: string; prep: "ready" | "made" | "admix"; note: string }[];
  extraPlan: string | null;
  planFile: { name: string; size: number | null } | null;
  /** 지정 희망 매장 — 의뢰 당시 매장 값. fee 가 없으면 금액 협의. */
  preferred: {
    id: string;
    code: string | null;
    name: string;
    area: string;
    grade: string | null;
    fee: number | null;
  }[];
  memo: string | null;
  estimate: {
    total: number;
    preferred: number;
    rest: number;
    avg: number;
    negotiable: number;
  } | null;
  schedule: {
    requestDate?: string;
    reviewEnd?: string;
    noticeDate?: string;
    recruitEnd?: string;
    confirmDue?: string;
    installStart?: string;
    installDays?: number;
    startDate?: string;
    endDate?: string;
    removalDate?: string;
    prepBusinessDays?: number;
    makeItems?: boolean;
    /** 준비 기간이 빠듯한데 권한 날짜(recommendedStart)보다 일찍 진행하는 데 동의(광고주 확인 창 체크, 11-12). */
    earlyStartAgreed?: boolean;
    recommendedStart?: string;
  } | null;
  brand: { id: string; name: string; imageUrl: string | null } | null;
  viewedAt: string | null;
}

export interface CollabListParams extends PageParams {
  phase?: string;
  keyword?: string;
}

/**
 * 대시보드 콜라보 일정 달력 한 줄(GET /admin/collab/calendar) — 기간과 겹치는 콜라보(취소 제외).
 * 날짜는 모두 YYYY-MM-DD(한국 날짜). confirmDue 는 확정 마감 시각을 날짜로 바꾼 것(비었으면 서버 기본값 — 모집 마감 4일 뒤).
 */
export interface CollabCalendarItem {
  id: string;
  brandName: string;
  title: string;
  status: "draft" | "published" | "cancelled";
  phase: CollabPhase;
  recruitStart: string;
  recruitEnd: string;
  confirmDue: string;
  installDate: string;
  startDate: string;
  endDate: string;
  removalDate: string;
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
  // 매장이 모집 기간에 "미참여"로 답함(11-12) — declined(신청 뒤 빠짐, 어드민 처리)와 나눈다.
  passed: "미참여 응답",
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
  passed: "미참여 응답",
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

/** 진행 항목 준비 주체 — 광고주 의뢰서 items.prep 과 같은 값(콜라보 진행 화면 "admix가 만들 것"). */
export type CollabItemPrep = NonNullable<CollabItem["prep"]>;
export const ITEM_PREP_LABEL: Record<CollabItemPrep, string> = {
  ready: "브랜드 보유",
  made: "브랜드 제작",
  admix: "admix 제작",
};
export const ITEM_PREPS: CollabItemPrep[] = ["admix", "made", "ready"];

/** 콜라보 진행 한 줄(GET /admin/collab/progress) — 끝나지 않은 콜라보 + 다음 일정 · 확정 매장 사진 · 재입고 수. */
export interface AdminCollabProgress extends AdminCollab {
  progress: {
    /** 매장 응답 수(11-12) — 답할 수 있는 매장 기준. waiting 은 모집 중이라 아직 답 안 함. */
    responses: StoreCollabCounts;
    nextDate: string | null;
    nextLabel: string | null;
    /** 설치 사진을 올린 확정 매장 수 */
    installed: number;
    /** 점검일이 지났는데 사진이 없는 확정 매장 수 */
    photoDue: number;
    /** 재입고를 누른 확정 매장 수 */
    restock: number;
  };
}

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
