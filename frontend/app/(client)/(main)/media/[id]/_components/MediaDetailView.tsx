"use client";

import { useParams } from "next/navigation";

import { useMediaDetail } from "@/hooks/media";
import { MediaDetailContent } from "./MediaDetailContent";

function formatFee(krw: number | null): string {
  if (krw == null) return "최소집행금액 협의";
  return `최소집행금액 ${Math.round(krw / 10000).toLocaleString()}만원`;
}

export function MediaDetailView() {
  const params = useParams<{ id: string }>();
  const { data: detail } = useMediaDetail(params.id ?? null);

  if (!detail) return null;

  const features = detail.features.map(
    (f) => [f.label, f.value] as [string, string],
  );
  const mediaList = detail.plans.map((p) => ({
    title: p.title,
    subtitle: p.subtitle ?? "",
  }));
  const population = detail.population
    ? {
        monthlyFootTraffic: detail.population.monthlyFootTraffic,
        malePct: detail.population.malePct,
        femalePct: detail.population.femalePct,
        ageRatios: detail.population.ageRatios.map((a) => ({
          label: a.label,
          value: a.value,
          bound: a.bound ?? undefined,
        })),
      }
    : null;

  return (
    <MediaDetailContent
      name={detail.name}
      price={formatFee(detail.minAdvertisementFeeKrw)}
      badge={detail.badge ?? null}
      description={detail.description ?? undefined}
      features={features}
      mediaList={mediaList}
      sizeText={detail.sizeText ?? null}
      imageUrl={detail.thumbnailUrl ?? detail.imageUrls[0] ?? null}
      population={population}
    />
  );
}
