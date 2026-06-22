"use client";

import { useState } from "react";

import { MediaFilterBar } from "@/components/common/MediaFilterBar";
import { MobileMediaDetail } from "@/components/common/MobileMediaDetail";
import { useMovingMediaList } from "@/hooks/media";
import { MediaDetailContent } from "../../media/[id]/_components/MediaDetailContent";
import { LocationSearchInput } from "../../_components/LocationSearchInput";
import { MovingMediaCard, type MovingMediaData } from "./MovingMediaCard";

const FILTERS = [
  "카테고리",
  "가격 범위",
  "매체 판매 유형",
  "매체 타입",
  "설치 장소",
  "매체 형태",
];

function formatFee(krw: number | null): string {
  if (krw == null) return "최소집행금액 협의";
  return `최소집행금액 ${Math.round(krw / 10000).toLocaleString()}만원`;
}

export function MovingView() {
  const { data } = useMovingMediaList();
  const mediaList: MovingMediaData[] = (data?.items ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    price: formatFee(item.minAdvertisementFeeKrw),
  }));

  const [location, setLocation] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const selected =
    mediaList.find((media) => media.id === selectedId) ?? mediaList[0];

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
        <MediaFilterBar filters={FILTERS} />
        <div className="flex-1 overflow-y-auto p-[16px]">
          <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-3">
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
        </div>
      </div>

      <div
        className={`min-w-0 flex-1 overflow-y-auto sm:block ${
          detailOpen ? "block" : "hidden"
        }`}
      >
        {selected && (
          <>
            <MobileMediaDetail
              name={selected.name}
              price={selected.price}
              badge={selected.badge}
              onBack={() => setDetailOpen(false)}
              hidePopulation
              hideMediaList
              className="sm:hidden"
            />
            <MediaDetailContent
              name={selected.name}
              price={selected.price}
              className="hidden px-[40px] py-[40px] sm:flex"
              hidePopulation
            />
          </>
        )}
      </div>
    </div>
  );
}
