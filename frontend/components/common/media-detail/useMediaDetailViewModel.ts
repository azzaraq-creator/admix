"use client";

import {
  type MediaDetail,
  type MediaPlanOption,
  type MediaPopulation,
  useMediaDetail,
} from "@/hooks/media";

export type MediaDetailAgeRatio = {
  label: string;
  value: number;
  bound?: "under" | "over";
};

export type MediaDetailPlan = {
  title: string;
  subtitle: string;
  planNo: number;
};

export type MediaDetailPopulationVM = {
  /** "실시간 인구"(서울시) / "월평균 유동인구"(직접 입력·서울시 상권) / "월평균 역 승하차"(지하철역 안 매체) */
  title: string;
  /** 제목 옆 작은 글씨 — "역삼역 · 15:05 기준" / "2025년 3분기" / "OO 상권 · 2025년 4분기" */
  caption: string;
  /** "80,000~82,000" — 서울시는 인구를 범위로 준다. */
  populationText: string;
  congestLevel: string | null;
  malePct: number;
  femalePct: number;
  ageRatios: MediaDetailAgeRatio[];
  mainAudience: { gender: string; age: string }[];
  genderRatio: { male: number; female: number };
  /** 월~일 하루 평균 — 서울시 상권(요일 값이 있을 때)·지하철역 승하차. */
  weekdayDaily: { label: string; value: number }[] | null;
  /** 숫자를 어떻게 셌는지 — 지하철역 승하차만(교통카드 기준). 없으면 null. */
  note: string | null;
  /** 출처 — 인구수·요일별(traffic)과 성별·연령(demographic). 직접 입력은 알 수 없어 null. */
  sources: { traffic: string | null; demographic: string | null };
};

export type MediaDetailViewModel = {
  id: string;
  name: string;
  /** 이동 매체 — 주소 자리에 운행 지역이 오고 앞에 "이동" 칩을 붙인다. */
  isMoving: boolean;
  price: string;
  adFeeKrw: number | null;
  productionFeeKrw: number | null;
  categoryLarge: string | null;
  categorySmall: string | null;
  salesType: string | null;
  oohType: string | null;
  badge: "popular" | "new" | null;
  description?: string;
  address?: string;
  /** 주소를 누르면 뜨는 위치 지도 — 좌표가 있는 고정 매체만. */
  location?: {
    lat: number;
    lng: number;
    direction: number | null;
    spread: number | null;
  };
  imageUrl: string | null;
  images: string[];
  sizeText: string | null;
  features: [string, string][];
  plans: MediaDetailPlan[];
  /** 매체 정보 팝업의 "안건" 옵션(플랜별 광고비·제작비·노출 조건). */
  planOptions: MediaPlanOption[];
  population: MediaDetailPopulationVM | null;
};

export function formatFee(krw: number | null): string {
  if (krw == null) return "최소집행금액 협의";
  return `최소집행금액 ${Math.round(krw / 10000).toLocaleString()}만원`;
}

/** 인구 카드 제목 — 지하철역 안 매체는 그 역의 승하차(한 달 환산)라 따로 부른다. */
const POPULATION_TITLE: Record<MediaPopulation["source"], string> = {
  realtime: "실시간 인구",
  manual: "월평균 유동인구",
  sangwon: "월평균 유동인구",
  station: "월평균 역 승하차",
};

const SANGWON_SOURCE = "서울시 상권분석서비스";

/** 지하철 승하차 집계 기준(서울시 교통카드 데이터) — 역 안에서 갈아타는 환승은 찍지 않아 빠진다. */
const STATION_NOTE =
  "교통카드를 찍고 타고 내린 사람만 세요. 환승은 세지 않아요.";

/** 인구 카드 출처 — 지하철역은 승하차에 성별·연령이 없어 비율만 상권 값을 쓴다. */
const POPULATION_SOURCES: Record<
  MediaPopulation["source"],
  MediaDetailPopulationVM["sources"]
> = {
  realtime: {
    traffic: "서울시 실시간 도시데이터",
    demographic: "서울시 실시간 도시데이터",
  },
  manual: { traffic: null, demographic: null },
  sangwon: { traffic: SANGWON_SOURCE, demographic: SANGWON_SOURCE },
  station: {
    traffic: "서울시 지하철 역별 승하차 인원",
    demographic: SANGWON_SOURCE,
  },
};

/** 인구 카드 제목 옆 설명 — 실시간은 "장소 · 시:분 기준", 월평균은 기준(시기·상권). */
function populationCaption(pop: MediaPopulation): string {
  if (pop.source !== "realtime") return pop.placeName;
  const time = pop.measuredAt?.slice(11, 16);
  return time ? `${pop.placeName} · ${time} 기준` : pop.placeName;
}

/** 인구 범위 — "80,000~82,000". 두 값이 같으면 하나만. */
export function formatPopulationRange(min: number, max: number): string {
  return min === max
    ? max.toLocaleString()
    : `${min.toLocaleString()}~${max.toLocaleString()}`;
}

export function toMediaDetailViewModel(
  detail: MediaDetail,
): MediaDetailViewModel {
  const pop = detail.population;
  // 썸네일 우선 + 상세 이미지, 중복 제거 (디테일패널 개수 기반 배치용).
  const images: string[] = [];
  for (const url of [detail.thumbnailUrl, ...detail.imageUrls]) {
    if (url && !images.includes(url)) images.push(url);
  }
  return {
    id: detail.id,
    name: detail.name,
    isMoving: detail.mediaSource === "MOVING",
    price: formatFee(detail.minAdvertisementFeeKrw),
    adFeeKrw: detail.minAdvertisementFeeKrw,
    productionFeeKrw: detail.minProductionFeeKrw ?? null,
    categoryLarge: detail.categoryLarge ?? null,
    categorySmall: detail.categorySmall ?? null,
    salesType: detail.salesType ?? null,
    oohType: detail.oohType ?? null,
    badge: detail.badge,
    description: detail.description ?? undefined,
    address: detail.address ?? undefined,
    location:
      detail.latitude != null && detail.longitude != null
        ? {
            lat: detail.latitude,
            lng: detail.longitude,
            direction: detail.facingDirection ?? null,
            spread: detail.facingSpread ?? null,
          }
        : undefined,
    imageUrl: detail.thumbnailUrl ?? detail.imageUrls[0] ?? null,
    images,
    sizeText: detail.sizeText,
    features: detail.features.map(
      (f) => [f.label, f.value] as [string, string],
    ),
    plans: detail.plans.map((p) => ({
      title: p.title,
      subtitle: p.subtitle ?? "",
      planNo: p.planNo,
    })),
    planOptions: detail.planOptions ?? [],
    population: pop
      ? {
          populationText: formatPopulationRange(
            pop.populationMin,
            pop.populationMax,
          ),
          title: POPULATION_TITLE[pop.source],
          caption: populationCaption(pop),
          congestLevel: pop.congestLevel,
          malePct: pop.malePct,
          femalePct: pop.femalePct,
          ageRatios: pop.ageRatios.map((a) => ({
            label: a.label,
            value: a.value,
            bound: a.bound ?? undefined,
          })),
          mainAudience: [
            {
              gender: pop.malePct >= pop.femalePct ? "남성" : "여성",
              age: pop.ageRatios.reduce((top, cur) =>
                cur.value > top.value ? cur : top,
              ).label,
            },
          ],
          genderRatio: { male: pop.malePct, female: pop.femalePct },
          weekdayDaily: pop.weekdayDaily?.length ? pop.weekdayDaily : null,
          note: pop.source === "station" ? STATION_NOTE : null,
          sources: POPULATION_SOURCES[pop.source],
        }
      : null,
  };
}

export function useMediaDetailViewModel(id: string | null) {
  const { data } = useMediaDetail(id);
  const vm = data ? toMediaDetailViewModel(data) : null;
  return { vm };
}
