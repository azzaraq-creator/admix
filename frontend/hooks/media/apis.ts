import type { AdminListParams } from "@/lib/adminList";
import { api } from "@/lib/api";

export type MediaListSort = "created" | "updated" | "id";

export interface MediaListParams extends AdminListParams {
  type?: string;
  sort?: MediaListSort;
  order?: "asc" | "desc";
}

export interface MediaRow {
  no: string;
  mediaType: "고정" | "이동";
  name: string;
  region: string;
  category: string;
  product: string;
  adCost: string;
  saleType: string;
  updatedAt: string;
  createdAt: string;
}

export interface MediaListResponse {
  total: number;
  items: MediaRow[];
}

/** 이동매체 운행 지역 — 지도에 핀 대신 영역으로 그리고, 카드에 위치 대신 보여 준다. */
export interface OperatingArea {
  /** 카드·상세에 보여 줄 문구 — "서울 전역", "서울 강남구·서초구" */
  label: string;
  /** 운행 시·도(예: "서울특별시") */
  city: string | null;
  /** 운행 구 — 비어 있으면 city 전역 */
  districts: string[];
  /** 노선 설명 */
  route: string | null;
  /** 운행 범위 — 구 경계를 모르는 지역은 이 사각형으로 그린다. */
  bounds: { neLat: number; swLat: number; neLng: number; swLng: number } | null;
}

export interface MediaCardRow {
  id: string;
  name: string;
  minAdvertisementFeeKrw: number | null;
  /** 제작비 — 매체 찾기 카드의 "제작비 / 1회" 칸. null이면 "-". */
  minProductionFeeKrw: number | null;
  address: string | null;
  categoryLarge: string | null;
  categorySmall: string | null;
  /** 판매 유형(개별/패키지 등) — 카드 우측 칩. */
  salesType: string | null;
  thumbnailUrl: string | null;
  images: string[];
  badge: "popular" | "new" | null;
  lat: number | null;
  lng: number | null;
  /** 이동매체는 좌표가 없고 operatingArea로 운행 지역을 보여 준다. 지도 마커에서 만든 행은 비어 있다. */
  mediaSource?: "FIXED" | "MOVING";
  operatingArea?: OperatingArea | null;
}

/** 매체 찾기 탭 — 전체(null)·고정·이동. */
export type MediaFindSource = "fixed" | "moving";

export interface MediaCardListResponse {
  total: number;
  items: MediaCardRow[];
  /** 매체 찾기 탭별 매체 수 — 탭과 무관하게 같은 조건(지도 영역·검색어·필터)으로 센다. */
  sourceCounts?: { all: number; fixed: number; moving: number } | null;
}

export interface MediaFeature {
  label: string;
  value: string;
}

export interface MediaPlanRow {
  planNo: number;
  title: string;
  subtitle: string | null;
}

/** 매체 정보 팝업의 "안건" 한 줄 — 플랜별 광고비·제작비·노출 조건(기획안이 고르는 플랜과 같은 범위). */
export interface MediaPlanOption {
  planNo: number;
  title: string;
  adFeeKrw: number | null;
  productionFeeKrw: number | null;
  exposureSeconds: number | null;
  exposureCount: number | null;
  /** 일 송출 수 */
  dailyBroadcasts: number | null;
  /** "1개월" */
  durationText: string | null;
}

export interface MediaAgeRatio {
  label: string;
  value: number;
  bound: "under" | "over" | null;
}

/**
 * 매체 정보 팝업의 인구 카드.
 * realtime: 서울시 실시간 도시데이터(주요 121장소) — 매체와 이어진 장소 기준.
 * manual: 어드민에서 직접 입력한 월평균 유동인구(min = max).
 * sangwon: 서울시 상권 데이터의 월평균 유동인구(min = max).
 * station: 지하철역 안 매체 — 그 역의 최근 날들의 하루 평균 승하차를 한 달로 환산(min = max). 성별·연령은 상권 값.
 */
export interface MediaPopulation {
  source: "realtime" | "manual" | "sangwon" | "station";
  /** realtime: 장소 이름, manual: 입력한 기준(예: "2025년 3분기"), sangwon: "OO 상권 · 2025년 4분기" */
  placeName: string;
  /** 여유 / 보통 / 약간 붐빔 / 붐빔 */
  congestLevel: string | null;
  populationMin: number;
  populationMax: number;
  malePct: number;
  femalePct: number;
  ageRatios: MediaAgeRatio[];
  /** 서울시 기준 시각 "YYYY-MM-DD HH:MM" */
  measuredAt: string | null;
  /** 월~일 하루 평균 — sangwon: 같은 분기 유동인구, station: 같은 요일 날들의 승하차. 없으면 null. */
  weekdayDaily?: { label: string; value: number }[] | null;
}

export interface MediaDetail {
  id: string;
  name: string;
  /** 고정 / 이동 — 이동 매체면 팝업에 "이동" 칩 */
  mediaSource?: "FIXED" | "MOVING";
  badge: "popular" | "new" | null;
  minAdvertisementFeeKrw: number | null;
  maxAdvertisementFeeKrw: number | null;
  /** 제작비 — 상세 팝업의 "제작비 / 1회". */
  minProductionFeeKrw: number | null;
  categoryLarge: string | null;
  categorySmall: string | null;
  salesType: string | null;
  /** 매체 유형 태그(예: "OOH (지면)"). */
  oohType: string | null;
  description: string | null;
  address: string | null;
  thumbnailUrl: string | null;
  imageUrls: string[];
  sizeText: string | null;
  features: MediaFeature[];
  plans: MediaPlanRow[];
  planOptions: MediaPlanOption[];
  population: MediaPopulation | null;
}

export interface MediaFilterParams {
  category?: string[];
  /** 지역 — "서울특별시"(시·도 전체) 또는 "서울특별시 강남구". 여러 개면 OR. */
  region?: string[];
  oohType?: string[];
  exposureType?: string[];
  mediaShape?: string[];
  productMasterType?: string[];
  priceMin?: number | null;
  priceMax?: number | null;
  /** "별도 협의"(광고비 없는 매체) 빼기. 기본(포함)이면 보내지 않는다. */
  excludePriceInquiry?: boolean;
  neLat?: number | null;
  swLat?: number | null;
  neLng?: number | null;
  swLng?: number | null;
  keyword?: string | null;
  /** 목록 정렬(MediaSortKey). 기본(최신순)이면 보내지 않는다. 개수·지도 조회에는 넣지 않는다. */
  sort?: string | null;
  /** 매체 찾기 탭 — 목록·개수·가격 그래프에만 건다. null이면 전체(고정+이동). */
  source?: MediaFindSource | null;
}

export interface MapBounds {
  neLat: number;
  swLat: number;
  neLng: number;
  swLng: number;
  zoom: number;
}

export interface MediaMarkerDto {
  id: string;
  lat: number;
  lng: number;
  name: string;
  categoryLarge: string | null;
  categorySmall: string | null;
  address: string | null;
  minAdvertisementFeeKrw: number | null;
  minProductionFeeKrw: number | null;
  thumbnailUrl: string | null;
  images: string[];
  badge: "popular" | "new" | null;
}

export interface MediaClusterDto {
  lat: number;
  lng: number;
  count: number;
}

export interface MediaClusterResponse {
  clusters: MediaClusterDto[];
  markers: MediaMarkerDto[];
}

/** 가격 필터 그래프 — 가로축은 MediaFilterOptions.price_min~max, 막대는 지금 목록 기준. */
export interface PriceHistogramResponse {
  histogram: number[];
}

/** 지역 필터 선택지 — 시·도와 그 안의 구·군(고정매체 위치 + 이동매체 운행 지역). */
export interface RegionOption {
  /** 공식 이름 — 필터 값으로 보낸다("서울특별시") */
  sido: string;
  /** 짧은 이름 — 화면 표시("서울") */
  label: string;
  districts: string[];
}

export interface MediaFilterOptions {
  categories: string[];
  ooh_types: string[];
  exposure_types: string[];
  media_shapes: string[];
  product_master_types: string[];
  price_min: number | null;
  price_max: number | null;
  price_histogram: number[];
  regions?: RegionOption[];
}

function appendFilters(q: URLSearchParams, f?: MediaFilterParams): void {
  f?.category?.forEach((v) => q.append("category", v));
  f?.region?.forEach((v) => q.append("region", v));
  f?.oohType?.forEach((v) => q.append("ooh_type", v));
  f?.exposureType?.forEach((v) => q.append("exposure_type", v));
  f?.mediaShape?.forEach((v) => q.append("media_shape", v));
  f?.productMasterType?.forEach((v) => q.append("product_master_type", v));
  if (f?.priceMin != null) q.set("price_min", String(f.priceMin));
  if (f?.priceMax != null) q.set("price_max", String(f.priceMax));
  if (f?.excludePriceInquiry) q.set("exclude_price_inquiry", "true");
  if (f?.keyword) q.set("keyword", f.keyword);
  if (f?.sort && f.sort !== "latest") q.set("sort", f.sort);
}

function appendBounds(q: URLSearchParams, f?: MediaFilterParams): void {
  if (
    f?.neLat != null &&
    f?.swLat != null &&
    f?.neLng != null &&
    f?.swLng != null
  ) {
    q.set("north_east_latitude", String(f.neLat));
    q.set("south_west_latitude", String(f.swLat));
    q.set("north_east_longitude", String(f.neLng));
    q.set("south_west_longitude", String(f.swLng));
  }
}

function buildFixedQuery(
  limit: number,
  offset: number,
  f?: MediaFilterParams,
): string {
  const q = new URLSearchParams();
  q.set("limit", String(limit));
  q.set("offset", String(offset));
  // 탭이 없으면 전체(고정매체 + 지도 영역을 다니는 이동매체). 백엔드 기본값(고정만)은 예전 호출용이다.
  q.set("source", f?.source ?? "all");
  appendFilters(q, f);
  appendBounds(q, f);
  return q.toString();
}

/** 검색어·필터만 담은 쿼리(지도 영역·페이지 없음) — 관심 매체 목록이 쓴다. */
export function buildMediaFilterQuery(f?: MediaFilterParams): string {
  const q = new URLSearchParams();
  appendFilters(q, f);
  return q.toString();
}

/** 이동매체 목록 쿼리 — 지도 영역을 주면 운행 범위가 그 영역과 겹치는 매체만 온다. */
function buildMovingQuery(f?: MediaFilterParams): string {
  const q = new URLSearchParams();
  appendFilters(q, f);
  appendBounds(q, f);
  return q.toString();
}

/** 가격 그래프 쿼리 — 목록과 같은 조건(지도 영역·검색어·필터)에서 가격·정렬만 뺀다. */
export function buildPriceHistogramQuery(f?: MediaFilterParams): string {
  const q = new URLSearchParams();
  appendFilters(q, {
    ...f,
    priceMin: null,
    priceMax: null,
    excludePriceInquiry: false,
    sort: null,
  });
  appendBounds(q, f);
  if (f?.source) q.set("source", f.source);
  return q.toString();
}

function buildClusterQuery(zoom: number, f?: MediaFilterParams): string {
  const q = new URLSearchParams();
  q.set("zoom_level", String(zoom));
  appendFilters(q, f);
  appendBounds(q, f);
  return q.toString();
}

/** 매체 찾기 지도 "실시간 인구" — 서울시 주요 장소 실시간 혼잡도 한 곳. */
export interface CrowdPlace {
  code: string;
  name: string;
  lat: number;
  lng: number;
  /** 서울시 혼잡도 — "여유" · "보통" · "약간 붐빔" · "붐빔" */
  level: string;
  populationMin: number;
  populationMax: number;
  /** "2026-10-13 14:15" */
  measuredAt: string | null;
}

export interface CrowdResponse {
  /** 서버에 서울시 키가 없으면 false */
  enabled: boolean;
  places: CrowdPlace[];
  /** 아직 불러오는 중인 장소 수 — 0이 될 때까지 잠시 뒤 다시 묻는다 */
  pending: number;
}

/**
 * 매체 찾기 지도 "도로 현황" — 서울시 실시간 도로 소통 정보(TOPIS)의 도로 구간(링크) 하나.
 * level 은 속도로 정한 "원활" · "서행" · "정체", path 는 [위도, 경도] 목록.
 */
export interface TrafficLink {
  id: string;
  road: string;
  level: string;
  speed: number;
  path: [number, number][];
}

export interface TrafficResponse {
  /** 서버에 서울시 키가 없으면 false */
  enabled: boolean;
  links: TrafficLink[];
  /** 아직 불러오는 구간 수 — 0이 될 때까지 잠시 뒤 다시 묻는다 */
  pending: number;
}

/** 실시간 인구 장소를 눌렀을 때 — 그 범위 안 지하철역·버스정류장의 하루 승하차 인원(서울시, 공개된 가장 최근 날). */
export interface CrowdTransit {
  name: string;
  subway: {
    /** "20261010" — 아직 데이터가 없으면 null. 서울시가 사흘쯤 뒤에 공개해 지하철·버스 날짜가 다를 수 있다. */
    date: string | null;
    /** 승하차가 많은 순 */
    stations: {
      name: string;
      lines: string[];
      ride: number;
      alight: number;
    }[];
  };
  bus: {
    date: string | null;
    stopCount: number;
    ride: number;
    alight: number;
    /** 승하차가 많은 정류장(최대 5곳) */
    top: { name: string; arsNo: string | null; ride: number; alight: number }[];
  };
}

export interface CrowdBounds {
  neLat: number;
  swLat: number;
  neLng: number;
  swLng: number;
}

export const mediaApi = {
  crowd: (b: CrowdBounds) =>
    api.get<CrowdResponse>("/media/crowd", { params: b }).then((r) => r.data),
  traffic: (b: CrowdBounds) =>
    api
      .get<TrafficResponse>("/media/traffic", { params: b })
      .then((r) => r.data),
  crowdTransit: (code: string) =>
    api
      .get<CrowdTransit>(`/media/crowd/${encodeURIComponent(code)}/transit`)
      .then((r) => r.data),
  list: (params?: MediaListParams) =>
    api.get<MediaListResponse>("/admin/media", { params }).then((r) => r.data),
  exportExcel: () =>
    api
      .get<Blob>("/admin/media/export", { responseType: "blob" })
      .then((r) => r.data),
  downloadTemplate: () =>
    api
      .get<Blob>("/admin/media/template", { responseType: "blob" })
      .then((r) => r.data),
  movingList: (filters?: MediaFilterParams, signal?: AbortSignal) => {
    const qs = buildMovingQuery(filters);
    return api
      .get<MediaCardListResponse>(`/media/moving${qs ? `?${qs}` : ""}`, {
        signal,
      })
      .then((r) => r.data);
  },
  movingFilterOptions: () =>
    api
      .get<MediaFilterOptions>("/media/moving/filter-options")
      .then((r) => r.data),
  fixedList: (
    limit: number,
    offset: number,
    filters?: MediaFilterParams,
    signal?: AbortSignal,
  ) =>
    api
      .get<MediaCardListResponse>(
        `/media/fixed?${buildFixedQuery(limit, offset, filters)}`,
        { signal },
      )
      .then((r) => r.data),
  fixedClusters: (
    zoom: number,
    filters?: MediaFilterParams,
    signal?: AbortSignal,
  ) =>
    api
      .get<MediaClusterResponse>(
        `/media/fixed/clusters?${buildClusterQuery(zoom, filters)}`,
        { signal },
      )
      .then((r) => r.data),
  fixedPriceHistogram: (filters?: MediaFilterParams, signal?: AbortSignal) => {
    const qs = buildPriceHistogramQuery(filters);
    return api
      .get<PriceHistogramResponse>(
        `/media/fixed/price-histogram${qs ? `?${qs}` : ""}`,
        { signal },
      )
      .then((r) => r.data.histogram);
  },
  /** 고정·이동 매체 전체 기준 필터 옵션 — 매체 찾기·관심 매체가 쓴다. */
  filterOptions: () =>
    api.get<MediaFilterOptions>("/media/filter-options").then((r) => r.data),
  detail: (id: string, signal?: AbortSignal) =>
    api.get<MediaDetail>(`/media/${id}`, { signal }).then((r) => r.data),
};

// ===== admin 매체 상세/등록 (media 전 컬럼) =====

export interface MediaImageItem {
  id: string;
  image_url: string;
  sort_order: number;
  is_thumbnail: boolean;
}

/** 어드민 매체 상품(media_plan) — 폼에서 추가·수정·삭제하는 칸만. */
export interface AdminMediaPlan {
  /** 기획안이 상품을 가리키는 번호. 새 상품은 null(서버가 매긴다). */
  plan_no: number | null;
  product_display_name: string | null;
  product_master_type: string | null;
  contractual_duration: number | null;
  contractual_duration_type: string | null;
  advertisement_fee: number | null;
  production_fee: number | null;
  exposure_duration_seconds: number | null;
  broadcasts_count_manual: number | null;
  default_device_quantity: number | null;
  default_surface_quantity: number | null;
}

/** 유동인구 단계 — tier 는 1~5(높을수록 붐빔), 매기지 않으면 excluded 에 이유. tiers 는 단계 기준표(높은 단계부터). */
export interface PopulationTier {
  tier: number | null;
  monthly: number | null;
  place: string | null;
  excluded: string | null;
  tiers: { tier: number; min: number; max: number | null }[];
}

export interface AdminMediaDetail {
  media_id: string;
  thumbnail_url: string | null;
  images: MediaImageItem[];
  plans?: AdminMediaPlan[];
  /** 노출·검색 구역 보기 전용 — 자동 추천 타깃, 믹시 검색 태그(저장된 값 기준) */
  ai_preview?: {
    auto_targets: string;
    in_index: boolean;
    groups: {
      key: string;
      label: string;
      values: { label: string; origin: "auto" | "manual" | "source" }[];
    }[];
  };
  /** 노출·검색 구역 보기 전용 — 인기 점수(최근 90일 제출·담기·관심 + 인기 매체 표시) */
  popularity?: {
    score: number;
    rank: number | null;
    total: number;
    top_pct: number | null;
    badge: boolean;
    forced?: boolean;
    badge_top_pct?: number;
    breakdown: {
      key: string;
      label: string;
      people: number | null;
      weight: number;
      points: number;
    }[];
  };
  /** 노출·검색 구역 "신규 매체" 안내 — auto: 자동(값 비움), until: 자동 신규가 끝나는 날(YYYY-MM-DD) */
  new_badge?: {
    auto: boolean;
    is_new: boolean;
    until: string | null;
    days: number;
  };
  /** 위치·인구 탭 안내 — 서울시 상권 월평균 유동인구(직접 입력이 없을 때 팝업에 대신 보이는 값) */
  sangwon_population?: {
    placeName: string;
    populationMax: number;
    femalePct: number;
    malePct: number;
    /** 10대 이하 → 60대 이상 순 6구간(%) */
    ageRatios: { label: string; value: number; bound: string | null }[];
  } | null;
  /** 등급·추천 탭 "유동인구 단계" — 서울 고정 매체(야립 제외)의 월평균 유동인구로 자동(백엔드 population_tier) */
  population_tier?: PopulationTier;
  /** 등급·추천 탭 "자동 추천" — 질문 ID → 추천 답·근거(도로 데이터·설명글, 백엔드 grade_suggest). 등급·추천 탭을 열면 빈 질문에 넣는다. */
  grade_suggestions?: GradeSuggestions;
  [key: string]: unknown;
}

export type GradeSuggestions = Record<
  string,
  { value: string; reason: string }
>;

/** 어드민 매체 폼 저장 전 미리보기 — 지금 입력한 값으로 계산(백엔드 preview_admin_media). */
export type AdminMediaPreview = Required<
  Pick<
    AdminMediaDetail,
    "sangwon_population" | "population_tier" | "grade_suggestions"
  >
>;

export type AdminMediaPayload = Record<string, unknown>;

export interface MediaImportError {
  row: number;
  media_id: string;
  reason: string;
}

export interface MediaImportResult {
  total: number;
  inserted: number;
  skipped: number;
  failed: number;
  errors: MediaImportError[];
}

/** 어드민 매체 폼 선택지 — 지금 매체들에 들어 있는 값 기준. */
/**
 * 어드민 매체 폼 — 이 좌표로 서울시 실시간 인구를 가져올 수 있는지.
 * available: 가져옴 / no_coords: 좌표 없음 / out_of_range: 121장소에서 멂 / unavailable: 키 없음·호출 실패
 */
export interface AdminRealtimePopulationCheck {
  status: "available" | "no_coords" | "out_of_range" | "unavailable";
  population: MediaPopulation | null;
  /** out_of_range일 때 가장 가까운 장소(서울 밖처럼 멀면 null) */
  nearest: { name: string; distanceM: number } | null;
  /** 실시간이 안 될 때 — 직접 입력이 없으면 대신 보이는 서울시 상권 월평균 유동인구 */
  sangwon: MediaPopulation | null;
}

export interface AdminMediaFieldOptions {
  /** 대분류 → 소분류 목록 */
  categories: Record<string, string[]>;
  /** 등급 산정 방식 */
  grade_methods: string[];
  /** 믹시 키워드 사전 — 인기 업종(값: 사전 첫 낱말) */
  industries?: { value: string; label: string }[];
  /** 믹시 키워드 사전 — 타깃(값: 사전 코드) */
  targets?: { value: string; label: string }[];
}

export const adminMediaApi = {
  get: (id: string) =>
    api.get<AdminMediaDetail>(`/admin/media/${id}`).then((r) => r.data),
  fieldOptions: () =>
    api
      .get<AdminMediaFieldOptions>("/admin/media/field-options")
      .then((r) => r.data),
  realtimePopulation: (
    lat: number | null,
    lng: number | null,
    mediaId: string | null,
  ) =>
    api
      .get<AdminRealtimePopulationCheck>("/admin/media/realtime-population", {
        params: {
          ...(lat != null && lng != null ? { lat, lng } : {}),
          ...(mediaId ? { media_id: mediaId } : {}),
        },
      })
      .then((r) => r.data),
  preview: (values: Record<string, string>, mediaId: string | null) =>
    api
      .post<AdminMediaPreview>("/admin/media/preview", values, {
        params: mediaId ? { media_id: mediaId } : {},
      })
      .then((r) => r.data),
  setThumbnail: (id: string, imageId: string) =>
    api
      .put<AdminMediaDetail>(`/admin/media/${id}/images/${imageId}/thumbnail`)
      .then((r) => r.data),
  create: (payload: AdminMediaPayload) =>
    api.post<AdminMediaDetail>("/admin/media", payload).then((r) => r.data),
  update: (id: string, payload: AdminMediaPayload) =>
    api
      .patch<AdminMediaDetail>(`/admin/media/${id}`, payload)
      .then((r) => r.data),
  remove: (id: string) =>
    api.delete(`/admin/media/${id}`).then(() => undefined),
  uploadImage: (id: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api
      .post<AdminMediaDetail>(`/admin/media/${id}/images`, fd)
      .then((r) => r.data);
  },
  deleteImage: (id: string, imageId: string) =>
    api
      .delete<AdminMediaDetail>(`/admin/media/${id}/images/${imageId}`)
      .then((r) => r.data),
  bulkImport: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api
      .post<MediaImportResult>("/admin/media/import", fd)
      .then((r) => r.data);
  },
};
