/** 콜라보 — 매체 찾기 카테고리·/partners 대시보드가 같이 쓰는 값. 백엔드 partners_service 와 같다. */

/** 매체 찾기에서 콜라보 매장이 쓰는 카테고리(대). */
export const PARTNERS_MEDIA_CATEGORY = "콜라보";

export const PARTNERS_MAX_IMAGES = 10;
export const PARTNERS_MAX_TAGS = 3;

/** 매장 어필 선택지 — 인스타그램 해시태그처럼 짧게(최대 3개). */
export const PARTNERS_TAG_OPTIONS = [
  "뷰맛집",
  "디저트맛집",
  "커피맛집",
  "브런치",
  "넓은공간",
  "작업하기좋은",
  "포토존",
  "감성인테리어",
  "루프탑",
  "테라스",
  "주차가능",
  "반려동물동반",
  "대형매장",
  "로스터리",
  "역세권",
  "24시간",
] as const;

/** 매장 상세 화면 주소 — 매장 id 또는 매체 찾기 media_id(CF-0001). */
export const partnersStoreHref = (key: string) =>
  `/partners/stores/${encodeURIComponent(key)}`;

export interface PartnersStore {
  id: string;
  mediaId: string | null;
  name: string;
  address: string;
  addressDetail: string | null;
  city: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  imageUrls: string[];
  phone: string | null;
  ownerName: string | null;
  tags: string[];
  businessHours: string | null;
  status: "active" | "hidden";
  createdAt: string | null;
  updatedAt: string | null;
  /** 상세 조회 때만 — 내가 등록한 매장인지. */
  isMine?: boolean;
}

/** 어드민 조회 — 주인 회원·메모가 더 붙는다. */
export interface AdminPartnersStore extends PartnersStore {
  adminMemo: string | null;
  ownerUserId: string | null;
  ownerLoginId: string | null;
  ownerMemberName: string | null;
  ownerCompanyName: string | null;
  ownerBizStatus: string | null;
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
  status?: "active" | "hidden";
  admin_memo?: string | null;
  owner_login_id?: string | null;
}

// 사진 주소(/uploads/... 상대경로 포함)는 lib/media 의 mediaSrc 로 바꿔 쓴다.

/** 제휴사(콜라보) 매장용 대시보드 — admix 화면에서 제휴사로 로그인하면 여기로 간다. */
export const PARTNERS_DASHBOARD_HREF = "/partners/dashboard";
