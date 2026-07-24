"use client";

import { useParams } from "next/navigation";

import { useMediaDetailViewModel } from "@/components/common/media-detail/useMediaDetailViewModel";
import { MediaDetailContent } from "./MediaDetailContent";

export function MediaDetailView() {
  const params = useParams<{ id: string }>();
  const { vm } = useMediaDetailViewModel(params.id ?? null);

  if (!vm) return null;

  return (
    <MediaDetailContent
      mediaId={vm.id}
      name={vm.name}
      price={vm.price}
      badge={vm.badge}
      description={vm.description}
      features={vm.features}
      mediaList={vm.plans}
      sizeText={vm.sizeText}
      imageUrl={vm.imageUrl}
      population={
        vm.population
          ? {
              monthlyFootTraffic: vm.population.monthlyFootTraffic,
              malePct: vm.population.malePct,
              femalePct: vm.population.femalePct,
              ageRatios: vm.population.ageRatios,
            }
          : null
      }
    />
  );
}
