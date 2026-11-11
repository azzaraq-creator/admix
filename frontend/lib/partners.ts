/** 콜라보 — 매체 찾기 카테고리·/partners 대시보드가 같이 쓰는 값. 백엔드 partners_service 와 같다. */

/** 매체 찾기에서 콜라보 매장이 쓰는 카테고리(대). */
export const PARTNERS_MEDIA_CATEGORY = "콜라보";
/** 매체 찾기에서 콜라보 매장이 쓰는 카테고리(소) — 백엔드 PARTNERS_MEDIA_SMALL 과 같다. */
export const PARTNERS_MEDIA_SMALL = "매장";

/** 매장 사진 — 분류를 합쳐 최대 30장(어드민에서만 올린다, 069 · 2026-11-10). 백엔드 partners_service.MAX_IMAGES 와 같다. */
export const PARTNERS_MAX_IMAGES = 30;
/** 사진 메모 길이 — 백엔드 PHOTO_MEMO_MAX_LEN 과 같다. */
export const PARTNERS_PHOTO_MEMO_MAX_LEN = 50;
/** 올리기 전에 브라우저에서 줄이는 긴 변(px) — 서버도 같은 크기로 한 번 더 줄인다(IMAGE_MAX_SIDE). */
export const PARTNERS_IMAGE_MAX_SIDE = 2000;
/**
 * 매장 어필은 개수 제한 없이 넣고(2026-11-09 사용자), 카드(매체 찾기 · 매장 목록)에서는 앞에서부터 이만큼만 보이고
 * 나머지는 "+N" 으로 줄인다. 매장 상세 · 어드민 폼은 모두 보인다.
 */
export const PARTNERS_CARD_TAGS = 3;

/** 카드에 보일 매장 어필과 숨긴 개수. */
export function cardTags(tags: string[] | null | undefined): {
  shown: string[];
  more: number;
} {
  const all = tags ?? [];
  return {
    shown: all.slice(0, PARTNERS_CARD_TAGS),
    more: Math.max(0, all.length - PARTNERS_CARD_TAGS),
  };
}

/**
 * 매장 사진 분류 — 백엔드 partners_service.PHOTO_KINDS 와 같은 순서 · 값(2026-11-10, 예전 좌석 · 화장실은 내관으로).
 * 분류마다 대표 사진이 하나씩 있고, 대표 사진은 매체 찾기 · 광고주 매장 카드에, 나머지는 매장 상세에서 보인다.
 */
export const PHOTO_KINDS = [
  "exterior",
  "interior",
  "counter",
  "menu",
  "etc",
] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];
export const PHOTO_KIND_LABEL: Record<PhotoKind, string> = {
  exterior: "외관",
  interior: "내관",
  counter: "카운터",
  menu: "메뉴",
  etc: "기타",
};
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
 * 조건 메모 톤 — "불가 · 안 됨 · 금지"가 들어가면 안 되는 것(빨강), "가능"이면 되는 것(초록), 그 밖은 회색.
 * 어드민이 자유롭게 적는 글이라 글자로만 가른다.
 */
export function noteTone(note: string): "no" | "ok" | "info" {
  if (/불가|안 ?됨|안돼|금지|없음/.test(note)) return "no";
  if (/가능|됨|OK|ok/.test(note)) return "ok";
  return "info";
}

/**
 * 매장 유형(카페 · 식당 …, 070) — 유형마다 "매장 어필" 칩 값과 자주 쓰는 "조건 메모" 값이 다르다.
 * 어드민 "콜라보 → 매장 항목"(/admin/collab/store-options)에서 관리하고, 매장 폼은 고른 유형의 값을 칩으로 보여 준다.
 */
export interface StoreType {
  id: number;
  name: string;
  sortOrder: number;
  /** 매장 어필 칩 값(해시태그처럼 짧게, 매장마다 개수 제한 없이 고른다). */
  tags: string[];
  /** 자주 쓰는 조건 메모 — 매장 폼에서 눌러 넣는다. */
  notes: string[];
  /** 이 유형인 매장 수(지울 때 안내). */
  storeCount: number;
}
/** 매장 어필 한 개 · 조건 메모 한 줄 길이(서버 TAG_MAX_LEN · NOTE_MAX_LEN 과 같다). */
export const PARTNERS_TAG_MAX_LEN = 20;
export const PARTNERS_NOTE_MAX_LEN = 60;

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

export interface PartnersStore {
  id: string;
  /** 매장 ID(S-0001) — 담당자가 제휴사 회원 고유번호(P-0001)와 이 번호로 잇는다(069). */
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
  tags: string[];
  /** 조건 메모 — "포스터 부착 불가", "신규 메뉴 가능" …(어드민이 적는다). */
  notes: string[];
  businessHours: string | null;
  /** 운영 시간 입력값(073) — 예전에 글로만 적은 매장은 null. */
  hours?: StoreHours | null;
  status: "active" | "hidden";
  createdAt: string | null;
  updatedAt: string | null;
  /** 상세 조회 때만 — 내가 등록한 매장인지. */
  isMine?: boolean;
  /** 콜라보 등급 · 매장별 금액(1건, 원) — 광고주 · 어드민에게만 온다(매장 화면에는 없다). */
  collabGrade?: CollabGrade | null;
  collabFee?: number | null;
}

/** 어드민 조회 — 주인 회원·메모가 더 붙는다. */
export interface AdminPartnersStore extends PartnersStore {
  adminMemo: string | null;
  ownerUserId: string | null;
  ownerLoginId: string | null;
  ownerPartnerCode: string | null;
  ownerMemberName: string | null;
  ownerCompanyName: string | null;
  ownerBizStatus: string | null;
  /** 등급 점수(077) — 항목별 점수 · 이유 메모. */
  gradeScores?: GradeScores;
  /** 상세 조회 때만 — 처리 전 수정 요청 수. */
  requestsPending?: number;
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
  tags?: string[];
  business_hours?: string | null;
}

export interface AdminPartnersStorePayload extends PartnersStorePayload {
  /** 매장 유형 — null 이면 미지정. */
  store_type_id?: number | null;
  status?: "active" | "hidden";
  admin_memo?: string | null;
  owner_login_id?: string | null;
  /** 제휴사 회원 고유번호(P-0001) — null · "" 이면 연결을 끊는다. */
  owner_code?: string | null;
  /** 사진과 분류 · 대표 · 메모 — 보내면 image_urls 대신 이것으로 정한다. */
  images?: StorePhoto[];
  /** 운영 시간 입력값 — 보내면 운영 시간 글도 서버가 다시 만든다. null 이면 둘 다 지운다. */
  hours?: StoreHours | null;
  notes?: string[];
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
  tags: "매장 특징",
  notes: "조건",
} as const;
export type StoreRequestField = keyof typeof STORE_REQUEST_FIELDS;

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
  /** 예전 자유 입력 요청이면 null — 그때는 after 가 요청 글. */
  field: StoreRequestField | null;
  fieldLabel: string;
  before: string | null;
  after: string | null;
  /** 반영할 값 그대로(주소는 StoreAddressValue, 운영 시간은 StoreHours, 특징 · 조건은 글 목록). */
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

/** 수정 요청 보내기 — 백엔드 StoreRequestIn. */
export interface StoreRequestPayload {
  field: StoreRequestField;
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
export type ParticipantStatus =
  "applied" | "requested" | "confirmed" | "declined" | "cancelled";
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
  stores: { total: number; unlinked: number; hidden: number };
  requestsPending: number;
  collabs: Partial<Record<CollabPhase, number>>;
  confirmWaiting: number;
  restockOpen: number;
  photoDue: number;
}

/** 광고주 브랜드(068) — 콜라보 화면 "내 브랜드". 한 광고주가 여러 개, 먼저 등록한 것이 앞. */
export interface AdvertiserBrand {
  id: string;
  name: string;
  /** 사진(/uploads/brand/… 또는 S3) — 없으면 화면에 기본 "C". */
  imageUrl: string | null;
  createdAt: string | null;
}

/** 브랜드 저장 요청 — 백엔드 AdvertiserBrandIn. image_url 을 null 로 보내면 사진을 지운다. */
export interface AdvertiserBrandPayload {
  name?: string;
  image_url?: string | null;
}

/** 브랜드 이름 최대 글자 수 — 백엔드 advertiser_brand_service.NAME_MAX, 의뢰서 브랜드 칸과 같다. */
export const BRAND_NAME_MAX = 40;

// 사진 주소(/uploads/... 상대경로 포함)는 lib/media 의 mediaSrc 로 바꿔 쓴다.

/** 제휴사(콜라보) 매장용 대시보드 — admix 화면에서 제휴사로 로그인하면 여기로 간다. */
export const PARTNERS_DASHBOARD_HREF = "/partners/dashboard";
