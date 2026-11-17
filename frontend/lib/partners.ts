import type { PlanBlock } from "@/lib/collabPlan";

/** 콜라보 — 매체 찾기 카테고리·/partners 대시보드가 같이 쓰는 값. 백엔드 partners_service 와 같다. */

/** 매체 찾기에서 콜라보 매장이 쓰는 카테고리(대). */
export const PARTNERS_MEDIA_CATEGORY = "콜라보";
/** 매체 찾기에서 콜라보 매장이 쓰는 카테고리(소) — 백엔드 PARTNERS_MEDIA_SMALL 과 같다. */
export const PARTNERS_MEDIA_SMALL = "매장";

/** 사진 메모 길이 — 백엔드 PHOTO_MEMO_MAX_LEN 과 같다. */
export const PARTNERS_PHOTO_MEMO_MAX_LEN = 50;
/** 올리기 전에 브라우저에서 줄이는 긴 변(px) — 서버도 같은 크기로 한 번 더 줄인다(IMAGE_MAX_SIDE). */
export const PARTNERS_IMAGE_MAX_SIDE = 2000;
/**
 * 매장 사진 분류 — 백엔드 partners_service.PHOTO_KINDS 와 같은 순서 · 값(2026-11-10, 예전 좌석 · 화장실은 내관으로).
 * DP 가능 공간 · 프로모션 공간은 2026-11-12 사용자 추가.
 * 분류마다 대표 사진이 하나씩 있고, 대표 사진은 매체 찾기 · 광고주 매장 카드에, 나머지는 매장 상세에서 보인다.
 */
export const PHOTO_KINDS = [
  "exterior",
  "interior",
  "counter",
  "dp_space",
  "promo_space",
  "menu",
  "etc",
] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];
export const PHOTO_KIND_LABEL: Record<PhotoKind, string> = {
  exterior: "외관",
  interior: "내관",
  counter: "카운터",
  dp_space: "DP 가능 공간",
  promo_space: "프로모션 공간",
  menu: "메뉴",
  etc: "기타",
};
/**
 * 어드민에서만 보는 분류 — 서버가 광고주 · 제휴사 화면과 매체 찾기에는 내보내지 않는다(2026-11-12 사용자).
 * 백엔드 partners_service.ADMIN_ONLY_PHOTO_KINDS 와 같다.
 */
export const ADMIN_ONLY_PHOTO_KINDS: readonly PhotoKind[] = ["menu"];
export interface StorePhoto {
  url: string;
  kind: PhotoKind;
  /** 분류별 대표 사진 — 분류마다 먼저 나오는 한 장(서버가 붙인다). */
  cover?: boolean;
  /** 사진 메모 — 어드민이 적고, 광고주 매장 상세에서 사진 설명으로 보인다. */
  memo?: string;
  /** 올린 때(ISO) — 서버가 처음 저장할 때 붙인다. 어드민 매장 폼 메모 아래에 날짜로 보인다. */
  uploadedAt?: string | null;
}

/** 사진 분류 화면 이름 — 모르는 값 · 없으면 undefined(카드 사진 이름표를 안 띄운다, 11-12). */
export function photoKindLabel(kind: string | null | undefined) {
  return kind && kind in PHOTO_KIND_LABEL
    ? PHOTO_KIND_LABEL[kind as PhotoKind]
    : undefined;
}

/** 카드(매체 찾기 · 광고주 매장 · 내 매장 미리보기)에 보일 분류별 대표 사진 — 분류 순. */
export function coverImageUrls(
  store: Pick<PartnersStore, "images" | "imageUrls">,
): string[] {
  const covers = (store.images ?? []).filter((p) => p.cover).map((p) => p.url);
  return covers.length ? covers : store.imageUrls.slice(0, 1);
}

/** 매장 상세 사진 순서 — 분류별 대표 사진 다음에 나머지 사진. */
export function detailImageUrls(
  store: Pick<PartnersStore, "images" | "imageUrls">,
): string[] {
  const covers = coverImageUrls(store);
  const shown = new Set(covers);
  return [...covers, ...store.imageUrls.filter((u) => !shown.has(u))];
}

/** 운영 시간 요일 구분 · 휴무일 — 백엔드 partners_service.HOURS_DAYS · CLOSED_DAYS 와 같다(073). */
export const HOURS_DAYS = [
  { value: "daily", label: "매일" },
  { value: "weekday", label: "평일" },
  { value: "weekend", label: "주말(공휴일)" },
] as const;
export type HoursDays = (typeof HOURS_DAYS)[number]["value"];
export const CLOSED_DAYS = [
  { value: "mon", label: "월요일" },
  { value: "tue", label: "화요일" },
  { value: "wed", label: "수요일" },
  { value: "thu", label: "목요일" },
  { value: "fri", label: "금요일" },
  { value: "sat", label: "토요일" },
  { value: "sun", label: "일요일" },
  { value: "holiday", label: "공휴일" },
] as const;
/** 운영 시간은 요일 구분별로 2개까지(평일 · 주말이 다를 수 있어서). */
export const MAX_HOURS_SLOTS = 2;
/** 운영 시간 입력값 — 시간은 "10:00" 처럼 24시간. 화면에 보이는 글(businessHours)은 서버가 이걸로 만든다. */
export interface StoreHours {
  slots: { days: HoursDays; open: string; close: string }[];
  closed: string[];
}

/**
 * 가능 범위(093, 2026-11-17 사용자: 조건 메모 대신 "유형마다 radio로 가능, 불가능") — 정해진 항목마다 가능 · 불가능.
 * 고르지 않은 항목은 비워 둔다. 백엔드 partners_service.SCOPE_ITEMS 와 같은 순서 · 키. 예전 조건 메모(notes)는 DB 칸만 남았다.
 */
export const COLLAB_SCOPE_ITEMS = [
  { key: "print", label: "브랜딩 제작물", desc: "포스터, 소형 출력물" },
  { key: "goods", label: "브랜드 굿즈", desc: "사은품, 샘플" },
  { key: "supplies", label: "브랜딩 소모품", desc: "컵홀더, 스티커" },
  { key: "dp", label: "DP 및 체험", desc: "진열 및 제품 체험" },
  { key: "menu", label: "협업 메뉴", desc: "한정 메뉴, 패키지" },
  { key: "space", label: "공간 활용", desc: "소규모 팝업, 브랜드존 구성" },
] as const;
export type CollabScopeKey = (typeof COLLAB_SCOPE_ITEMS)[number]["key"];
export const COLLAB_SCOPE_VALUES = ["ok", "no"] as const;
export type CollabScopeValue = (typeof COLLAB_SCOPE_VALUES)[number];
export const COLLAB_SCOPE_VALUE_LABEL: Record<CollabScopeValue, string> = {
  ok: "가능",
  no: "불가능",
};
export type CollabScope = Partial<Record<CollabScopeKey, CollabScopeValue>>;

/** 가능 범위 칩 색 — 가능 초록 · 불가능 빨강(내 매장 · 매장 정보 팝업이 같이 쓴다). */
export const SCOPE_TONE_CHIP: Record<CollabScopeValue, string> = {
  ok: "bg-emerald-50 text-emerald-700 dark:bg-success-bg dark:text-success",
  no: "bg-red-50 text-red-600 dark:bg-error-bg dark:text-error",
};

/** 고른 항목만 순서대로. */
export function scopeEntries(scope: CollabScope | null | undefined) {
  return COLLAB_SCOPE_ITEMS.flatMap((it) => {
    const value = scope?.[it.key];
    return value === "ok" || value === "no" ? [{ ...it, value }] : [];
  });
}

/** 화면 글 — "브랜딩 제작물 가능, 브랜드 굿즈 불가능"(서버 scope_text 와 같다). 고른 게 없으면 null. */
export function scopeText(scope: CollabScope | null | undefined): string | null {
  return (
    scopeEntries(scope)
      .map((e) => `${e.label} ${COLLAB_SCOPE_VALUE_LABEL[e.value]}`)
      .join(", ") || null
  );
}

/**
 * 매장 유형(카페 · 식당 …, 070) — 어드민 "콜라보 → 매장 유형 관리"(/admin/collab/store-options)에서 이름만 추가 · 수정 · 삭제한다.
 * 유형별 매장 어필 칩 · 자주 쓰는 조건 메모는 2026-11-17 사용자 요청으로 없앴다(DB 칸만 남음).
 */
export interface StoreType {
  id: number;
  name: string;
  sortOrder: number;
  /** 이 유형인 매장 수(지울 때 안내). */
  storeCount: number;
}

/**
 * 콜라보 등급 — S · A · B · C. 어드민 "콜라보 → 매장"에서 정한다(067). 등급 기준(크기 · 기준 금액)은 아직 정하지 않았다(2026-11-09 사용자).
 * 매장(제휴사) 화면에는 보이지 않고 광고주 · 어드민만 본다. 백엔드 partners_service.COLLAB_GRADES 와 같다.
 */
export const COLLAB_GRADES = ["S", "A", "B", "C"] as const;
export type CollabGrade = (typeof COLLAB_GRADES)[number];
export const COLLAB_GRADE_LABEL: Record<CollabGrade, string> = {
  S: "S",
  A: "A",
  B: "B",
  C: "C",
};
/**
 * 등급 점수 항목(077, 2026-11-10 사용자) — 만점이 곧 비중(합쳐 100점). 항목마다 점수와 이유 · 값 메모를 적는다.
 * 등급(S · A · B · C)은 점수를 보고 어드민이 고른다(기준 점수는 아직 없다). 백엔드 partners_service.GRADE_CRITERIA 와 같다.
 */
export const GRADE_CRITERIA = [
  {
    key: "sales",
    title: "매출",
    desc: "작년 1년 또는 최근 3개월 영수증 수량",
    max: 50,
    placeholder: "예: 최근 3개월 영수증 4,200건",
  },
  {
    key: "seats",
    title: "규모",
    desc: "좌석 수",
    max: 20,
    placeholder: "예: 1층 24석 · 2층 16석",
  },
  {
    key: "collab",
    title: "공간 활용",
    desc: "협업 방식",
    max: 30,
    placeholder: "예: 포스터 · 테이블 POP 가능, 신메뉴 협업 가능",
  },
] as const;
export type GradeCriterionKey = (typeof GRADE_CRITERIA)[number]["key"];
export const GRADE_MEMO_MAX_LEN = 300;
export type GradeScores = Partial<
  Record<GradeCriterionKey, { score: number | null; memo: string }>
>;

/** 광고주 예시 데이터(lib/advertiserPreview)가 쓰는 등급별 예시 금액(1건, 원) — 실제 기준 금액은 아직 없다. */
export const COLLAB_GRADE_FEE: Record<CollabGrade, number> = {
  S: 2_000_000,
  A: 1_500_000,
  B: 1_000_000,
  C: 600_000,
};
/** 1,500,000 → "150만 원" · 1,234,000 → "123.4만 원" · 만 원 아래는 원 단위. */
export function wonLabel(n: number): string {
  if (n >= 10_000) {
    const man = Math.round(n / 1_000) / 10;
    return `${man.toLocaleString("ko-KR")}만 원`;
  }
  return `${n.toLocaleString("ko-KR")}원`;
}

/** 매장 상세 화면 주소 — 매장 id 또는 매체 찾기 media_id(CF-0001). */
export const partnersStoreHref = (key: string) =>
  `/partners/stores/${encodeURIComponent(key)}`;

/**
 * 매장 ID(094) — S-XXXX-XXXX, 헷갈리는 0 · O · 1 · I · L 을 뺀 숫자 · 대문자 8자(11-17 사용자: "매장ID를 좀 어렵게").
 * 서버 partners_service.normalize_store_code 와 같은 규칙.
 */
export const STORE_CODE_PREFIX = "S-";
const STORE_CODE_BODY_LEN = 8;

/**
 * 매장 ID 입력 다듬기 — 칸 안 글(머리 "S-"는 칸 앞에 따로 보인다). 소문자는 대문자로, 4자 뒤 하이픈은 저절로
 * (11-17 사용자: "소문자로 입력해도 자동으로 대문자로, -도 자동으로"). 머리까지 치거나 붙여 넣은 "s7kq2…" · "S-7KQ2-M9XD"도 머리를 뗀다
 * — 매장 ID 본문은 S 로 시작하지 않는다(서버 STORE_CODE_FIRST).
 */
export function formatStoreCodeInput(raw: string): string {
  let t = raw.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (t.startsWith("S")) t = t.slice(1);
  t = t.slice(0, STORE_CODE_BODY_LEN);
  return t.length > 4 ? `${t.slice(0, 4)}-${t.slice(4)}` : t;
}

/** 다 친 매장 ID(S-7KQ2-M9XD) — 칸 안 글이 8자가 아니면 null. */
export function storeCodeFromInput(body: string): string | null {
  const t = body.replace(/-/g, "");
  return t.length === STORE_CODE_BODY_LEN
    ? `${STORE_CODE_PREFIX}${t.slice(0, 4)}-${t.slice(4)}`
    : null;
}

/** 매장 연결 요청(094) — 매장 ID로 이미 등록된 매장에 연결을 요청하고, 어드민이 승인하면 연결된다. */
export interface StoreLinkLookup {
  storeCode: string;
  name: string;
  address: string;
  /** 이미 연결된 매장 */
  linked: boolean;
  /** 이미 요청해 두고 기다리는 중 */
  pending: boolean;
}

export interface StoreLinkRequest {
  id: string;
  storeCode: string | null;
  storeName: string | null;
  address: string | null;
  status: StoreRequestStatus;
  adminReply: string | null;
  createdAt: string | null;
  handledAt: string | null;
}

/** 어드민 매장 연결 회원(094) — 먼저 연결한 순. */
export interface AdminStoreMember {
  userId: string;
  loginId: string;
  partnerCode: string | null;
  name: string | null;
  companyName: string | null;
  bizStatus: string | null;
  /** admin 담당자 연결 · request 연결 요청 승인 · lead 영업 기록 */
  via: "admin" | "request" | "lead";
  linkedAt: string | null;
}

export const STORE_MEMBER_VIA_LABEL: Record<AdminStoreMember["via"], string> = {
  admin: "담당자 연결",
  request: "연결 요청",
  lead: "영업 기록",
};

export interface PartnersStore {
  id: string;
  /** 매장 ID(S-XXXX-XXXX) — 담당자가 회원과 잇고, 다른 회원이 이 번호로 연결을 요청한다(069 · 094). */
  storeCode: string | null;
  mediaId: string | null;
  name: string;
  /** 매장 유형(카페 · 식당 …, 070) — 미지정이면 null. */
  storeTypeId?: number | null;
  storeType?: string | null;
  address: string;
  addressDetail: string | null;
  city: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  imageUrls: string[];
  /** 사진과 분류 · 대표(imageUrls 순서 — 분류 순, 분류마다 첫 장이 대표). */
  images: StorePhoto[];
  phone: string | null;
  ownerName: string | null;
  /** 주요 고객층 · 소개(2~3줄) · 규모(좌석 수) — 093, 어드민이 매장 정보 탭에서 적는다. */
  mainCustomers?: string | null;
  intro?: string | null;
  seats?: number | null;
  /** 가능 범위(093) — 항목마다 가능 · 불가능, 고르지 않은 항목은 없다. */
  scope: CollabScope;
  businessHours: string | null;
  /** 운영 시간 입력값(073) — 예전에 글로만 적은 매장은 null. */
  hours?: StoreHours | null;
  status: "active" | "hidden";
  createdAt: string | null;
  updatedAt: string | null;
  /** 상세 조회 때만 — 내가 등록한 매장인지. */
  isMine?: boolean;
  /** 협업 확정 전 매장(영업 기록, 090) — 광고주 지도에 매장처럼 뜬다. 등급 · 금액 · 운영 시간 · 연락처가 아직 없다. */
  unconfirmed?: boolean;
  /** 콜라보 등급 · 매장별 금액(1건, 원) — 광고주 · 어드민에게만 온다(매장 화면에는 없다). */
  collabGrade?: CollabGrade | null;
  collabFee?: number | null;
  /** 내 매장(제휴사)만 — 이 매장에 연결된 회원 이름(나 표시, 094). */
  linkedMembers?: { name: string; isMe: boolean }[];
}

/** 어드민 조회 — 연결 회원 · 메모가 더 붙는다. */
export interface AdminPartnersStore extends PartnersStore {
  adminMemo: string | null;
  /** 연결 회원(094) — 매장 하나에 여럿, 먼저 연결한 순. */
  members: AdminStoreMember[];
  /** 등급 점수(077) — 항목별 점수 · 이유 메모. */
  gradeScores?: GradeScores;
  /** 상세 조회 때만 — 처리 전 수정 요청 수. */
  requestsPending?: number;
  /** 목록 조회 때만 — 콜라보 응답 수(11-12). */
  collabResponses?: StoreCollabCounts;
}

/**
 * 매장의 콜라보 응답(11-12 사용자) — 새 콜라보마다 참여 / 미참여를 묻고, 모집이 끝날 때까지 답이 없으면 무응답.
 * joined 참여(신청한 적 있음) · passed 미참여 · silent 무응답 · waiting 모집 중이라 답 기다림.
 */
export type StoreCollabResponse = "joined" | "passed" | "silent" | "waiting";
export type StoreCollabCounts = Record<StoreCollabResponse, number>;

/** 어드민 매장 상세 "콜라보 참여"(GET /admin/partners/stores/{id}/collabs). */
export interface AdminStoreCollabs {
  counts: StoreCollabCounts;
  /** 이 매장이 답할 수 있게 된 날(매장 등록 · 회원 협약 중 늦은 날) — 연결 회원이 없거나 협약 전이면 null. */
  since: string | null;
  items: {
    collabId: string;
    brandName: string;
    title: string;
    phase: CollabPhase;
    recruitStart: string;
    recruitEnd: string;
    startDate: string;
    endDate: string;
    response: StoreCollabResponse;
    /** 참여 줄 상태(참여 · 미참여만) */
    status: ParticipantStatus | null;
    appliedAt: string | null;
    answeredAt: string | null;
    confirmNo: string | null;
  }[];
}

/** 저장 요청 — 백엔드 PartnersStoreIn(snake_case). */
export interface PartnersStorePayload {
  name?: string;
  address?: string;
  address_detail?: string | null;
  city?: string | null;
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  image_urls?: string[];
  phone?: string | null;
  owner_name?: string | null;
  business_hours?: string | null;
}

export interface AdminPartnersStorePayload extends PartnersStorePayload {
  /** 매장 유형 — null 이면 미지정. */
  store_type_id?: number | null;
  status?: "active" | "hidden";
  admin_memo?: string | null;
  /** 연결 회원 고유번호(P-0001) 목록(094) — 보내면 이 목록대로, 빈 목록이면 모두 끊는다. */
  member_codes?: string[];
  /** 사진과 분류 · 대표 · 메모 — 보내면 image_urls 대신 이것으로 정한다. */
  images?: StorePhoto[];
  /** 운영 시간 입력값 — 보내면 운영 시간 글도 서버가 다시 만든다. null 이면 둘 다 지운다. */
  hours?: StoreHours | null;
  /** 가능 범위 — 보내면 통째로 바꾼다. */
  scope?: CollabScope;
  main_customers?: string | null;
  intro?: string | null;
  seats?: number | null;
  collab_grade?: CollabGrade | null;
  collab_fee?: number | null;
  grade_scores?: GradeScores;
}

/**
 * 매장 수정 요청 항목(074) — 내 매장 "우리 매장 정보"에서 줄을 골라 새 값을 보낸다.
 * 백엔드 partners_service.REQUEST_FIELDS 와 같다. 매장명 · 주소는 비울 수 없다.
 */
export const STORE_REQUEST_FIELDS = {
  name: "매장명",
  address: "주소",
  hours: "운영 시간",
  phone: "매장 번호",
  owner_name: "사장님",
  scope: "가능 범위",
} as const;
export type StoreRequestField = keyof typeof STORE_REQUEST_FIELDS;

/**
 * 추가 요청 · 문의(11-12) — 위 항목 말고 사진 · 매장 유형 · 콜라보 같은 것도 글로 보낸다.
 * 백엔드 partners_service.INQUIRY_FIELD · INQUIRY_LABEL · INQUIRY_MAX_LEN 과 같다. 반영할 값이 없어 어드민은 답하고 처리 완료한다.
 */
export const STORE_INQUIRY_FIELD = "inquiry";
export const STORE_INQUIRY_LABEL = "추가 요청 · 문의";
export const STORE_INQUIRY_MAX_LEN = 1000;

/**
 * 매장 추가 요청(11-16 사용자: "제휴사도 매장을 여러 개 — 내 매장에서 매장 추가 요청, 매장명으로").
 * 백엔드 partners_service.ADD_STORE_FIELD · ADD_STORE_LABEL 과 같다. value 는 새 매장명, 화면엔 after 로 온다.
 * 보낸 매장의 수정 기록에 같이 쌓이고, 어드민이 매장을 등록해 이 회원에게 연결한 뒤 처리 완료한다.
 */
export const STORE_ADD_FIELD = "add_store";
export const STORE_ADD_LABEL = "매장 추가";
export const STORE_ADD_NAME_MAX_LEN = 200;

/**
 * 매장 연결 요청(094, 11-17 사용자) — 기본협약을 마친 회원이 매장 ID로 이미 등록된 매장에 연결을 요청한다.
 * 백엔드 partners_service.LINK_STORE_FIELD 와 같다. 어드민 "수정 요청"에서 연결 승인(처리 완료)하면 연결 회원이 된다.
 */
export const STORE_LINK_FIELD = "link_store";

/** 연결 회원 한 줄 — "P-0001 이름"(이름이 없으면 상호 · 아이디). */
export const storeMemberLabel = (m: AdminStoreMember) =>
  `${m.partnerCode ?? "-"} ${m.name || m.companyName || m.loginId}`;

/** 연결 회원 요약 — 첫 회원과 "외 N명". 없으면 null. */
export const storeMembersSummary = (members: AdminStoreMember[]) =>
  members.length
    ? `${storeMemberLabel(members[0])}${members.length > 1 ? ` 외 ${members.length - 1}명` : ""}`
    : null;

/** 항목(매장명 · 주소 …)을 바꿔 달라는 요청인지 — 아니면 글로 보낸 요청(추가 요청 · 문의, 예전 자유 입력)이다. */
export function isFieldRequest<T extends Pick<StoreRequest, "field">>(
  r: T,
): r is T & { field: StoreRequestField } {
  return r.field != null && r.field in STORE_REQUEST_FIELDS;
}

/** 주소 수정 요청 값 — 좌표는 못 찾았으면 비워 보낸다(반영할 때 서버가 주소로 찾는다). */
export interface StoreAddressValue {
  address: string;
  address_detail: string | null;
  city: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** 처리 상태 — pending 확인 중 · done 반영 완료 · rejected 처리 불가(사유는 adminReply). */
export type StoreRequestStatus = "pending" | "done" | "rejected";

/**
 * 매장 수정 요청(069 → 074 항목별) — 제휴사가 내 매장에서 보내고, 어드민 "수정 요청"에서 반영하거나 처리 불가로 답한다.
 * before → after 는 서버가 만든 화면 글(null 이면 비어 있음). 같은 항목을 확인 중에 다시 보내면 그 요청이 바뀐다.
 */
export interface StoreRequest {
  id: string;
  storeId: string;
  /** 추가 요청 · 문의면 "inquiry", 예전 자유 입력 요청이면 null — 둘 다 after 가 요청 글(isFieldRequest). 매장 추가 요청은 "add_store"(after 가 새 매장명). */
  field:
    | StoreRequestField
    | typeof STORE_INQUIRY_FIELD
    | typeof STORE_ADD_FIELD
    | typeof STORE_LINK_FIELD
    | null;
  fieldLabel: string;
  before: string | null;
  after: string | null;
  /** 반영할 값 그대로(주소는 StoreAddressValue, 운영 시간은 StoreHours, 가능 범위는 CollabScope). */
  value: unknown;
  /** 담당자에게 남긴 메모(선택). */
  memo: string | null;
  status: StoreRequestStatus;
  adminReply: string | null;
  createdAt: string | null;
  /** 마지막으로 바뀐 때 — 보냄 · 다시 보냄 · 처리. */
  updatedAt: string | null;
  handledAt: string | null;
}

/** 수정 요청 보내기 — 백엔드 StoreRequestIn. 추가 요청 · 문의는 value 가 글. */
export interface StoreRequestPayload {
  field:
    StoreRequestField | typeof STORE_INQUIRY_FIELD | typeof STORE_ADD_FIELD;
  value: unknown;
  memo?: string | null;
}

/** 어드민 수정 요청 목록 — 매장 · 회원이 붙는다. */
export interface AdminStoreRequest extends StoreRequest {
  storeName: string | null;
  storeCode: string | null;
  userId: string | null;
  userName: string | null;
  userLoginId: string | null;
  partnerCode: string | null;
}

/** 사업자 상태 — provisional 은 어드민 임시 승인(069). */
export type BizStatusCode =
  "unregistered" | "reviewing" | "verified" | "rejected" | "provisional";

/**
 * 내 정보 사업자등록증 칸 id — 주소 끝 #이 값으로 열면 그 칸으로 스크롤(ProfileView).
 * 임시 승인 안내 창(partners ProvisionalGate)의 "내 정보로 이동"이 쓴다(11-16).
 */
export const BIZ_LICENSE_ANCHOR = "biz-license";

/**
 * 광고주 사업자 인증 잠금(2026-11-17 사용자) — 사업자등록증 인증(verified)을 마치기 전 광고주는 대시보드 · 매장 찾기만 본다.
 * 매장 찾기 카드는 눌리지 않고 금액 · 가능 범위가 흐려지며 관심(하트)도 못 누른다. 나머지 메뉴(내 콜라보 · 관심 매장 · 내 브랜드)는 메뉴에서 빠지고,
 * 주소로 들어오면 안내만 보인다. 서버도 금액을 내려 주지 않고 새 의뢰를 막는다(partners_service.is_verified_advertiser).
 * 임시 승인(provisional)은 광고주에겐 승인이 아니다 — 미등록과 같이 본다. 광고주가 아니거나 인증을 마쳤으면 null.
 */
export type AdvBizLock = "unregistered" | "reviewing" | "rejected";
export function advBizLockOf(
  me:
    | {
        member_category?: string | null;
        business_registration?: { status: string } | null;
      }
    | null
    | undefined,
): AdvBizLock | null {
  if (me?.member_category !== "advertiser") return null;
  const status = me.business_registration?.status;
  if (status === "verified") return null;
  if (status === "reviewing" || status === "rejected") return status;
  return "unregistered";
}

/** 어드민 제휴사 회원(069). */
export interface AdminPartnerMember {
  id: string;
  partnerCode: string | null;
  loginId: string;
  email: string;
  name: string | null;
  phone: string | null;
  companyName: string | null;
  snsProvider: string | null;
  createdAt: string | null;
  /** 마지막 업데이트 — 회원 정보 · 사업자 등록 중 늦은 쪽. */
  updatedAt: string | null;
  /** 마지막 로그인(091) — 기록이 없으면 null. */
  lastLoginAt: string | null;
  agreedAt: string | null;
  agreementVersion: string | null;
  /** 기본협약 전자 서명(078) — 서명자 이름 · 구분(representative/delegate) · 손 서명 그림 · 동의 때 IP. 서명 도입 전 동의면 비어 있다. */
  signerName: string | null;
  signerRole: string | null;
  signatureUrl: string | null;
  signedIp: string | null;
  bizStatus: BizStatusCode;
  bizFileName: string | null;
  bizUploadedAt: string | null;
  bizProvisionalAt: string | null;
  bizVerifiedAt: string | null;
  bizRejectReason: string | null;
  /** 가입 때 적은 매장 정보(089, 11-13) — 상호 · 사업자 번호(000-00-00000) · 대표자명 · 주소 · 상세 주소. 그 전에 가입한 회원은 비어 있다. */
  bizName?: string | null;
  bizNo?: string | null;
  bizRepresentative?: string | null;
  bizAddress?: string | null;
  bizAddressDetail?: string | null;
  stores: {
    id: string;
    storeCode: string | null;
    name: string;
    status: "active" | "hidden";
  }[];
}

/** 콜라보 진행 항목 한 줄 — 예: 샘플링 · 구매 시 증정. */
export interface CollabItem {
  label: string;
  note: string;
  /** 누가 준비하나(어드민만, 11-12) — ready 브랜드 보유 · made 브랜드 제작 · admix admix 제작. 매장 화면엔 안 온다. */
  prep?: "ready" | "made" | "admix";
}

/** 어드민 콜라보 단계 — 백엔드 collab_service.phase_of. */
export type CollabPhase =
  | "draft"
  | "scheduled"
  | "recruiting"
  | "selecting"
  | "running"
  | "done"
  | "cancelled";
export const COLLAB_PHASE_LABEL: Record<CollabPhase, string> = {
  draft: "비공개",
  scheduled: "모집 전",
  recruiting: "모집 중",
  selecting: "선정 · 확정 중",
  running: "진행 중",
  done: "완료",
  cancelled: "취소",
};
/** 매장 참여 상태 — applied 신청 · requested 확정 요청 · confirmed 확정 · declined 미참여 · cancelled 취소. */
/** passed — 매장이 모집 기간에 "미참여"로 답함(11-12). declined 는 신청한 뒤 확정 요청 전에 빠진 것(어드민 처리). */
export type ParticipantStatus =
  "applied" | "requested" | "confirmed" | "declined" | "cancelled" | "passed";
export type CollabPhotoStep = "install" | "check1" | "check2" | "check3";

/** 어드민 콜라보(069). */
export interface AdminCollab {
  id: string;
  brandName: string;
  brandImageUrl: string | null;
  title: string;
  summary: string | null;
  type: "ready" | "made";
  recruitStart: string;
  recruitEnd: string;
  confirmDue: string | null;
  installDate: string;
  startDate: string;
  endDate: string;
  removalDate: string;
  checks: { step: CollabPhotoStep; date: string; day: number }[];
  task: string | null;
  items: CollabItem[];
  space: string | null;
  quantity: number | null;
  benefit: string | null;
  staffScript: string | null;
  targetStores: number;
  status: "draft" | "published" | "cancelled";
  phase: CollabPhase;
  adminMemo: string | null;
  counts: Record<ParticipantStatus, number>;
  /** 결과 보고서 파일 수(086) — 목록(GET /admin/collab/collabs)에만. */
  reportFileCount?: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdminCollabParticipant {
  id: string;
  storeId: string;
  storeCode: string | null;
  storeName: string | null;
  storeAddress: string | null;
  ownerName: string | null;
  ownerLoginId: string | null;
  partnerCode: string | null;
  ownerPhone: string | null;
  status: ParticipantStatus;
  /** 매장 화면과 같은 입장 — candidate 후보 · reserve 예비 · requested · confirmed · declined · cancelled. */
  standing: string;
  slotNo: number | null;
  rank: number | null;
  appliedAt: string | null;
  requestedAt: string | null;
  confirmedAt: string | null;
  confirmNo: string | null;
  confirmer: string | null;
  checkedItems: number | null;
  closedAt: string | null;
  restockRequestedAt: string | null;
  adminMemo: string | null;
  photos: {
    id: string;
    step: CollabPhotoStep;
    url: string;
    by: "admix" | "cafe";
    at: string | null;
  }[];
}

export interface AdminCollabDetail extends AdminCollab {
  participants: AdminCollabParticipant[];
  notices: {
    id: string;
    title: string;
    body: string;
    author: string;
    createdAt: string | null;
  }[];
  /** 결과 보고서 파일(086) — 콜라보 결과에서 올려 모아 둔다. 올린 순. */
  reportFiles: CollabReportFile[];
}

/** 결과 보고서 파일 한 개(086). 받기는 GET /admin/collab/reports/{id}/file. */
export interface CollabReportFile {
  id: string;
  name: string;
  size: number;
  uploadedBy: string | null;
  createdAt: string | null;
}

/** 어드민 콜라보 저장 — 백엔드 CollabIn(snake_case, 날짜는 YYYY-MM-DD, 확정 기한은 ISO). */
export interface AdminCollabPayload {
  brand_name?: string;
  brand_image_url?: string | null;
  title?: string;
  summary?: string | null;
  collab_type?: "ready" | "made";
  recruit_start?: string;
  recruit_end?: string;
  confirm_due?: string | null;
  install_date?: string | null;
  start_date?: string;
  end_date?: string;
  removal_date?: string | null;
  task?: string | null;
  items?: CollabItem[];
  space?: string | null;
  quantity?: number | null;
  benefit?: string | null;
  staff_script?: string | null;
  target_stores?: number;
  status?: "draft" | "published" | "cancelled";
  admin_memo?: string | null;
}

/** 콜라보 어드민 첫 화면 숫자 — 백엔드 collab_service.admin_summary. */
export interface CollabAdminSummary {
  today: string;
  members: {
    total: number;
    notAgreed: number;
    noStore: number;
    bizReviewing: number;
    bizProvisional: number;
  };
  /** 광고주 회원 — 사업자등록증 검토 대기 수(사이드 메뉴 "광고주 회원" 옆 숫자). */
  advertisers: { bizReviewing: number };
  stores: { total: number; unlinked: number; hidden: number };
  requestsPending: number;
  collabs: Partial<Record<CollabPhase, number>>;
  confirmWaiting: number;
  restockOpen: number;
  photoDue: number;
  /** 접수된 광고주 콜라보 의뢰 수(081) — 사이드 메뉴 "콜라보 의뢰" 옆 숫자. */
  collabRequestsSubmitted?: number;
  /** 광고주 콜라보 의뢰 중 어드민이 아직 안 연 것 — 바뀌면 사이드 메뉴가 의뢰 목록을 다시 불러온다. */
  collabRequestsNew?: number;
}

/** 광고주 브랜드(068) — 콜라보 화면 "내 브랜드". 한 광고주가 여러 개, 먼저 등록한 것이 앞. */
export interface AdvertiserBrand {
  id: string;
  name: string;
  /** 사진(/uploads/brand/… 또는 S3) — 없으면 화면에 기본 "C". */
  imageUrl: string | null;
  /** 브랜드 담당자 정보(079, 모두 선택) — 전화번호는 숫자만. */
  contactName?: string | null;
  contactTitle?: string | null;
  /** 직책 또는 부서. */
  contactDept?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  createdAt: string | null;
}

/** 브랜드 저장 요청 — 백엔드 AdvertiserBrandIn. image_url 을 null 로 보내면 사진을 지운다. 담당자 칸은 빈 값이면 지운다. */
export interface AdvertiserBrandPayload {
  name?: string;
  image_url?: string | null;
  contact_name?: string | null;
  contact_title?: string | null;
  contact_dept?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
}

/** 브랜드 이름 최대 글자 수 — 백엔드 advertiser_brand_service.NAME_MAX, 의뢰서 브랜드 칸과 같다. */
export const BRAND_NAME_MAX = 40;

/** 광고주 콜라보 의뢰 보내기(081) — 백엔드 CollabRequestIn. 글자 수는 서버도 의뢰서와 같은 규칙으로 본다. */
export interface CollabRequestPayload {
  brand_id: string;
  title: string;
  summary: string | null;
  start_date: string;
  end_date: string;
  contact: { name: string; phone: string; role: string };
  items: { key: string; prep: "ready" | "made" | "admix"; note: string }[];
  extra_plan: string | null;
  course: string;
  min_stores: number;
  target_stores: number;
  preferred_store_ids: string[];
  memo: string | null;
  /** 화면이 보여 준 예상 비용 · 일정(참고용). */
  estimate: { total: number; preferred: number; rest: number; avg: number; negotiable: number };
  schedule: Record<string, string | number | boolean>;
  /** 고쳐 다시 보낼 때 — false 면 올려 둔 첨부를 지운다. */
  keep_plan_file?: boolean;
}

/**
 * 내가 보낸 의뢰 한 건 전부(GET /partners/me/collab-requests) — 내 콜라보 · 상세 · 고쳐 다시 보내기를 다시 그린다.
 * 위 칸들은 처음 보낸 의뢰서(0차) 그대로, 고친 내용은 기획안 차수(original · rounds · confirmedAt, 085)에 있다.
 */
export interface CollabRequestMine extends CollabRequestSaved, PlanBlock {
  brandId: string | null;
  brandName: string;
  brandImageUrl: string | null;
  title: string;
  summary: string | null;
  startDate: string;
  endDate: string;
  contact: { name: string; phone: string; role: string };
  items: { key: string; prep: "ready" | "made" | "admix"; note: string }[];
  extraPlan: string | null;
  planFile: { name: string; size: number } | null;
  course: string;
  minStores: number;
  targetStores: number;
  /** 의뢰 당시 매장 이름 · 지역 · 등급 · 금액. */
  preferred: {
    id: string;
    code?: string | null;
    name: string;
    area: string;
    grade: string | null;
    fee: number | null;
  }[];
  memo: string | null;
  estimate: { total?: number; preferred?: number; rest?: number; avg?: number; negotiable?: number } | null;
}

/** 보낸 의뢰 — 문서 번호(CR-YYMMDD-NN). */
export interface CollabRequestSaved {
  id: string;
  code: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  /** 광고주가 취소한 때(084) — 취소해도 지우지 않고 남긴다. */
  cancelledAt: string | null;
  planFileName: string | null;
}

// 사진 주소(/uploads/... 상대경로 포함)는 lib/media 의 mediaSrc 로 바꿔 쓴다.

/** 제휴사(콜라보) 매장용 대시보드 — admix 화면에서 제휴사로 로그인하면 여기로 간다. */
export const PARTNERS_DASHBOARD_HREF = "/partners/dashboard";
