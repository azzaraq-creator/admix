"use client";

import { type MediaDetail, useMediaDetail } from "@/hooks/media";

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
  monthlyFootTraffic: number;
  monthlyTrafficText: string;
  malePct: number;
  femalePct: number;
  ageRatios: MediaDetailAgeRatio[];
  mainAudience: { gender: string; age: string }[];
  genderRatio: { male: number; female: number };
};

export type MediaDetailViewModel = {
  id: string;
  name: string;
  price: string;
  badge: "popular" | "new" | null;
  description?: string;
  address?: string;
  imageUrl: string | null;
  images: string[];
  sizeText: string | null;
  features: [string, string][];
  plans: MediaDetailPlan[];
  population: MediaDetailPopulationVM | null;
};

export function formatFee(krw: number | null): string {
  if (krw == null) return "최소집행금액 협의";
  return `최소집행금액 ${Math.round(krw / 10000).toLocaleString()}만원`;
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
    price: formatFee(detail.minAdvertisementFeeKrw),
    badge: detail.badge,
    description: detail.description ?? undefined,
    address: detail.address ?? undefined,
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
    population: pop
      ? {
          monthlyFootTraffic: pop.monthlyFootTraffic,
          monthlyTrafficText: pop.monthlyFootTraffic.toLocaleString(),
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
        }
      : null,
  };
}

export function useMediaDetailViewModel(id: string | null) {
  const { data } = useMediaDetail(id);
  const vm = data ? toMediaDetailViewModel(data) : null;
  return { vm };
}
