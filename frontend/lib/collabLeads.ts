/**
 * 콜라보 영업 DB(071) — 가입 전 제휴사(매장) 영업 기록. 원본 영업 앱(sales_records · sales_settings)을 옮겨 왔다.
 * 칸 이름(key)은 원본 앱과 같고, 칸 이름표 · 순서 · 보이기는 서버의 칸 설정(meta.columns · customFields)을 따른다.
 */
import type { PageParams } from "@/lib/adminCollab";
import type { StorePhoto } from "@/lib/partners";

/** 기본 칸 설정 — 원본 sales_settings.columns 한 줄. */
export interface LeadColumn {
  key: string;
  label: string;
  visible: boolean;
}

/** 추가 항목(사용자 정의 칸) — 원본 sales_settings.customFields 한 줄. 값은 lead.custom[key]. */
export interface LeadCustomField {
  key: string;
  /** text · number · date · textarea */
  type: string;
  label: string;
  section?: string;
  visible: boolean;
  required?: boolean;
}

export type LeadFacetKey =
  "status" | "potential" | "grade" | "region" | "type" | "owner";

export interface CollabLeadMeta {
  columns: LeadColumn[];
  customFields: LeadCustomField[];
  /** 목록 조건에 고를 값 — 지금 들어 있는 값, 많은 순. */
  facets: Record<LeadFacetKey, string[]>;
  total: number;
}

/** 추가 항목 값 — 원본 그대로(숫자 칸에 글이 들어 있을 수 있다). */
export type LeadCustomValue = string | number;

export interface CollabLead {
  id: string;
  /** 원본 앱 id(cafe_20260918_001 …) — 어드민에서 새로 만든 줄은 "". */
  sourceId: string;
  /** 방문일 YYYY-MM-DD(없으면 "") */
  date: string;
  name: string;
  region: string;
  address: string;
  /** 업체 유형 */
  type: string;
  /** 기존 DB 등급 */
  grade: string;
  /** 방문 목적 */
  purposes: string[];
  /** 담당자 컨택 여부 */
  contacts: string[];
  /** 현장 반응 */
  reactions: string[];
  /** 영업 가능성 */
  potential: string;
  /** 진행 상태 */
  status: string;
  /** 후속 일정 YYYY-MM-DD */
  followupDate: string;
  /** 담당자(admix 영업 담당) */
  owner: string;
  note: string;
  revisit: boolean;
  contactName: string;
  contactTitle: string;
  contactPhone: string;
  contactEmail: string;
  contactOther: string;
  conversation: string;
  followupMemo: string;
  /** 원본 앱 사진 id — 사진 파일은 함께 오지 않았다. */
  photoIds: string[];
  /** 매장 사진(088) — 협업 확정 매장 사진과 같은 분류 · 모양. 협업 확정하면 매장 사진으로 옮겨진다. */
  photos: StorePhoto[];
  custom: Record<string, LeadCustomValue>;
  createdAt: string;
  updatedAt: string;
  /** 원본 파일에서 가져온 줄인지 */
  hasSource: boolean;
  /** 연결한 제휴사 회원 고유번호(P-0001, 072) — 없으면 "". 비워 저장하면 연결이 끊긴다. */
  partnerCode: string;
  /** 협업 확정으로 만든 매장 id(076) — 없으면 "". 확정해도 목록엔 그대로 남고 버튼 자리에 매장 번호가 뜬다(11-12). */
  storeId: string;
  /** 그 매장 ID(S-0001) — 없으면 "". */
  storeCode: string;
}

/** 협업 확정 때 같이 보내는 매장 위치 — 화면이 카카오 지도로 찾는다(서버 주소 검색은 키가 없거나 층 · 호수가 붙으면 못 찾음, 11-12). */
export interface CollabLeadLocation {
  latitude: number;
  longitude: number;
  city?: string;
  district?: string;
}

export type CollabLeadPayload = Partial<
  Omit<
    CollabLead,
    | "id"
    | "sourceId"
    | "createdAt"
    | "updatedAt"
    | "hasSource"
    | "photoIds"
    | "storeId"
    | "storeCode"
  >
> & {
  /** 이 저장으로 협업 확정될 때(회원을 처음 이을 때) 매장 위치 — 저장 값은 아니다. */
  location?: CollabLeadLocation | null;
};

export interface CollabLeadListParams extends PageParams {
  keyword?: string;
  status?: string;
  potential?: string;
  grade?: string;
  region?: string;
  type?: string;
  owner?: string;
  sort?: string;
}

/** 목록 정렬 — 서버 collab_lead_service.SORTS 와 같다. */
export const LEAD_SORT_OPTIONS = [
  { value: "visit", label: "방문일순" },
  { value: "updated", label: "수정순" },
  { value: "name", label: "업체명순" },
  { value: "source", label: "원본순" },
];

/** 칸 설정이 비었을 때(원본 파일을 아직 안 가져왔을 때) 쓰는 기본 칸 — 원본 sales_settings 와 같은 이름표. */
export const DEFAULT_LEAD_COLUMNS: LeadColumn[] = [
  { key: "date", label: "방문일", visible: true },
  { key: "name", label: "업체명", visible: true },
  { key: "region", label: "지역", visible: true },
  { key: "address", label: "주소", visible: true },
  { key: "type", label: "업체 유형", visible: true },
  { key: "grade", label: "기존 DB 등급", visible: true },
  { key: "purposes", label: "방문 목적", visible: true },
  { key: "contacts", label: "담당자 컨택 여부", visible: true },
  { key: "reactions", label: "현장 반응", visible: true },
  { key: "potential", label: "영업 가능성", visible: true },
  { key: "status", label: "진행 상태", visible: true },
  { key: "followupDate", label: "후속 일정", visible: true },
  { key: "owner", label: "담당자", visible: true },
  { key: "note", label: "비고", visible: true },
];

/** 칸 설정에 없는 원본 칸 — 상세 화면에서 이 이름표로 보인다. */
export const LEAD_EXTRA_LABEL = {
  revisit: "재방문",
  contactName: "매장 담당자 이름",
  contactTitle: "직함",
  contactPhone: "연락처",
  contactEmail: "이메일",
  contactOther: "기타 연락",
  conversation: "대화 내용",
  followupMemo: "후속 메모",
  photoIds: "사진",
} as const;

/**
 * 추가 항목 "지번주소" — 상세에서 카카오 주소 검색으로 기본 주소를 고르고 상세 주소는 따로 적는다(2026-11-12 사용자).
 * 기본은 원본 칸(cf_lot_address) 그대로, 상세는 같은 추가 항목 안 새 키에 둔다(칸 설정 · DB 구조는 그대로).
 */
export const LEAD_LOT_ADDRESS_KEY = "cf_lot_address";
export const LEAD_LOT_DETAIL_KEY = "cf_lot_address_detail";

/** 협업 확정 매장에 옮길 주소 — 서버(_store_address_of)와 같다: "주소", 비었으면 지번주소(기본). */
export const storeAddressOf = (lead: Pick<CollabLead, "address" | "custom">) =>
  lead.address.trim() || String(lead.custom[LEAD_LOT_ADDRESS_KEY] ?? "").trim();

/** 지번주소 한 줄(기본 + 상세) — 목록 칸에서. */
export const lotAddressOf = (custom: Record<string, LeadCustomValue>) =>
  [custom[LEAD_LOT_ADDRESS_KEY], custom[LEAD_LOT_DETAIL_KEY]]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .join(" ");

/** 목록 칸(방문 목적 · 컨택 여부 · 현장 반응)과 날짜 칸. */
export const LEAD_LIST_KEYS = ["purposes", "contacts", "reactions"] as const;
export const LEAD_DATE_KEYS = ["date", "followupDate"] as const;

export const isUrl = (v: unknown): v is string =>
  typeof v === "string" && /^https?:\/\//i.test(v.trim());
