"use client";

import { useState } from "react";

import { MediaSearchFilter } from "@/components/common/mediaFilter/MediaSearchFilter";
import {
  EMPTY_MEDIA_FILTER,
  buildFilterUi,
  toChipFilterParams,
  type MediaFilterState,
} from "@/components/common/mediaFilter/filterConfig";
import { MediaEmptyResults } from "@/components/common/MediaEmptyResults";
import { MobileMediaDetail } from "@/components/common/MobileMediaDetail";
import {
  useMediaDetail,
  useMovingFilterOptions,
  useMovingMediaList,
} from "@/hooks/media";
import { MediaDetailContent } from "../../media/[id]/_components/MediaDetailContent";
import { LocationSearchInput } from "../../_components/LocationSearchInput";
import { MovingMediaCard, type MovingMediaData } from "./MovingMediaCard";

function formatFee(krw: number | null): string {
  if (krw == null) return "최소집행금액 협의";
  return `최소집행금액 ${Math.round(krw / 10000).toLocaleString()}만원`;
}

export function MovingView() {
  const [filter, setFilter] = useState<MediaFilterState>(EMPTY_MEDIA_FILTER);
  const { data: opts } = useMovingFilterOptions();
  const { optionsByKey, price } = buildFilterUi(opts);
  const { data, isLoading } = useMovingMediaList(toChipFilterParams(filter));
  const mediaList: MovingMediaData[] = (data?.items ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    price: formatFee(item.minAdvertisementFeeKrw),
    image: item.thumbnailUrl ?? undefined,
    badge: item.badge ?? undefined,
  }));

  const [location, setLocation] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const selected =
    mediaList.find((media) => media.id === selectedId) ?? mediaList[0];

  const { data: detail } = useMediaDetail(selected?.id ?? null);
  const features = detail?.features.map(
    (f) => [f.label, f.value] as [string, string],
  );
  const planList = detail?.plans.map((p) => ({
    title: p.title,
    subtitle: p.subtitle ?? "",
    planNo: p.planNo,
  }));
  const detailImage = detail?.thumbnailUrl ?? detail?.imageUrls[0] ?? null;

  return (
    <div className="flex flex-1 overflow-hidden">
      <div
        className={`min-w-0 flex-1 flex-col sm:flex sm:border-r sm:border-[#e8e8e8] ${
          detailOpen ? "hidden" : "flex"
        }`}
      >
        <div className="border-b border-stroke px-[16px] py-[24px]">
          <LocationSearchInput
            value={location}
            onChange={setLocation}
            placeholder="지역명 또는 키워드 검색"
            className="w-full"
          />
        </div>
        <MediaSearchFilter
          value={filter}
          onChange={setFilter}
          optionsByKey={optionsByKey}
          price={price}
        />
        <div className="flex-1 overflow-y-auto">
          {!isLoading && mediaList.length === 0 ? (
            <MediaEmptyResults />
          ) : (
            <div className="grid grid-cols-2 sm:[grid-template-columns:repeat(auto-fill,minmax(228px,1fr))]">
              {mediaList.map((media) => (
                <MovingMediaCard
                  key={media.id}
                  data={media}
                  selected={media.id === selectedId}
                  onClick={() => {
                    setSelectedId(media.id);
                    setDetailOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        className={`min-w-0 flex-1 overflow-y-auto sm:block ${
          detailOpen ? "block" : "hidden"
        }`}
      >
        {!selected ? (
          <MediaEmptyResults iconOnly />
        ) : (
          <>
            <MobileMediaDetail
              name={selected.name}
              price={selected.price}
              badge={detail?.badge ?? null}
              description={detail?.description ?? undefined}
              features={features}
              mediaList={planList}
              size={detail?.sizeText ?? null}
              imageUrl={detailImage}
              onBack={() => setDetailOpen(false)}
              hidePopulation
              className="sm:hidden"
            />
            <MediaDetailContent
              mediaId={selected.id}
              name={selected.name}
              price={selected.price}
              badge={detail?.badge ?? null}
              description={detail?.description ?? undefined}
              features={features}
              mediaList={planList}
              sizeText={detail?.sizeText ?? null}
              imageUrl={detailImage}
              className="hidden px-[40px] py-[40px] sm:flex"
              hidePopulation
            />
          </>
        )}
      </div>
    </div>
  );
}
