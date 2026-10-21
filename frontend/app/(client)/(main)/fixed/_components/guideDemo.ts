import { toMediaDetailViewModel } from "@/components/common/media-detail/useMediaDetailViewModel";
import type {
  CrowdPlace,
  CrowdTransit,
  MediaCardRow,
  MediaDetail,
} from "@/hooks/media";

/**
 * 매체 찾기 가이드에서만 보여 주는 예시(더미) 데이터 — 실제 매체·서울시 데이터가 아니다.
 * 가이드가 떠 있는 동안 목록 맨 위 카드, 지도의 실시간 인구 장소 카드, 매체 정보 창에 쓴다.
 * 가이드 판이 화면을 막고 있어 눌러서 쓸 수는 없다(보여 주기만).
 */
const DEMO_ID = "guide-demo";
const DEMO_NAME = "[예시] 강남역 사거리 옥상 빌보드";
const DEMO_IMAGE = "/guide/demo-billboard.svg";
const DEMO_ADDRESS = "서울 강남구 강남대로 396 (역삼동)";

export const GUIDE_DEMO_ROW: MediaCardRow = {
  id: DEMO_ID,
  name: DEMO_NAME,
  minAdvertisementFeeKrw: 15_000_000,
  minProductionFeeKrw: 1_200_000,
  address: DEMO_ADDRESS,
  categoryLarge: "전광판/빌보드",
  categorySmall: "빌보드",
  salesType: "단품",
  thumbnailUrl: DEMO_IMAGE,
  images: [DEMO_IMAGE],
  badge: "popular",
  lat: null,
  lng: null,
  mediaSource: "FIXED",
};

const DEMO_DETAIL: MediaDetail = {
  id: DEMO_ID,
  name: DEMO_NAME,
  mediaSource: "FIXED",
  badge: "popular",
  minAdvertisementFeeKrw: 15_000_000,
  maxAdvertisementFeeKrw: 22_000_000,
  minProductionFeeKrw: 1_200_000,
  categoryLarge: "전광판/빌보드",
  categorySmall: "빌보드",
  salesType: "단품",
  oohType: "OOH",
  description:
    "강남역 11번 출구 앞 사거리 건물 옥상에 있는 대형 빌보드예요. 강남대로를 오가는 차량과 보행자 모두에게 크게 보여요. (가이드용 예시 매체)",
  address: DEMO_ADDRESS,
  // 좌표가 있어야 주소에 밑줄이 생긴다(누르면 위치·방향 지도) — 가이드 "위치·방향 지도" 단계가 밝힌다.
  latitude: 37.4979,
  longitude: 127.0276,
  facingDirection: 315,
  facingSpread: 90,
  thumbnailUrl: DEMO_IMAGE,
  imageUrls: [],
  // 매체 정보 칸은 아래 네 줄만(sizeText가 있으면 "매체 크기" 칸이 하나 더 붙어 비운다).
  sizeText: null,
  features: [
    { label: "설치 장소", value: "외부형" },
    { label: "기기 수량", value: "1기" },
    { label: "규격 사이즈(m)", value: "20 × 10" },
    { label: "운영 시간", value: "06:00 ~ 24:00" },
  ],
  plans: [
    { planNo: 1, title: "기본 상품", subtitle: "1면 / 1개월" },
    {
      planNo: 2,
      title: "프리미엄 상품 (야간 조명 연장)",
      subtitle: "1면 / 1개월",
    },
  ],
  planOptions: [
    {
      planNo: 1,
      title: "기본 상품",
      adFeeKrw: 15_000_000,
      productionFeeKrw: 1_200_000,
      exposureSeconds: null,
      exposureCount: null,
      dailyBroadcasts: null,
      durationText: "1개월",
    },
    {
      planNo: 2,
      title: "프리미엄 상품 (야간 조명 연장)",
      adFeeKrw: 22_000_000,
      productionFeeKrw: 1_200_000,
      exposureSeconds: null,
      exposureCount: null,
      dailyBroadcasts: null,
      durationText: "1개월",
    },
  ],
  population: {
    source: "sangwon",
    placeName: "강남역 상권 · 예시",
    congestLevel: null,
    populationMin: 2_480_000,
    populationMax: 2_480_000,
    malePct: 48,
    femalePct: 52,
    ageRatios: [
      { label: "10", value: 9, bound: "under" },
      { label: "20대", value: 27, bound: null },
      { label: "30대", value: 25, bound: null },
      { label: "40대", value: 19, bound: null },
      { label: "50대", value: 12, bound: null },
      { label: "60", value: 8, bound: "over" },
    ],
    measuredAt: null,
    weekdayDaily: [
      { label: "월", value: 84_000 },
      { label: "화", value: 87_000 },
      { label: "수", value: 88_000 },
      { label: "목", value: 90_000 },
      { label: "금", value: 98_000 },
      { label: "토", value: 79_000 },
      { label: "일", value: 62_000 },
    ],
  },
};

export const GUIDE_DEMO_DETAIL = toMediaDetailViewModel(DEMO_DETAIL);

/** "YYYY-MM-DD HH:MM" — 장소 카드의 기준 시각은 지금으로. */
function nowText(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 지도 기본 위치(강남역)와 같은 서울시 주요 장소 — 범위(rings)는 실제 강남역 것을 그린다. */
export function guideDemoPlace(): CrowdPlace {
  return {
    code: "POI014",
    name: "강남역",
    lat: 37.497942,
    lng: 127.027621,
    level: "붐빔",
    populationMin: 36_000,
    populationMax: 38_000,
    measuredAt: nowText(),
  };
}

/** "YYYYMMDD" — n일 전. 서울시 승하차는 며칠 늦게 공개돼 날짜를 조금 앞당긴다. */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const p = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

export function guideDemoTransit(): CrowdTransit {
  return {
    name: "강남역",
    subway: {
      date: daysAgo(4),
      stations: [
        {
          name: "강남",
          lines: ["2호선", "신분당선"],
          ride: 86_000,
          alight: 84_500,
        },
        {
          name: "신논현",
          lines: ["9호선", "신분당선"],
          ride: 32_800,
          alight: 32_900,
        },
        { name: "역삼", lines: ["2호선"], ride: 41_200, alight: 40_100 },
      ],
    },
    bus: {
      date: daysAgo(3),
      stopCount: 52,
      ride: 50_500,
      alight: 45_700,
      top: [
        {
          name: "지하철2호선강남역",
          arsNo: "22012",
          ride: 9_500,
          alight: 5_500,
        },
        {
          name: "지하철2호선강남역",
          arsNo: "22011",
          ride: 6_100,
          alight: 7_300,
        },
        { name: "신분당선강남역", arsNo: "22009", ride: 4_800, alight: 5_300 },
        { name: "신분당선강남역", arsNo: "22010", ride: 5_600, alight: 4_100 },
        {
          name: "래미안아파트.파이낸셜뉴스",
          arsNo: "22007",
          ride: 2_300,
          alight: 3_500,
        },
      ],
    },
  };
}
