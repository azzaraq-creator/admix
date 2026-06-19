"use client";

import { useState } from "react";

import { MediaFilterBar } from "@/components/common/MediaFilterBar";
import { MediaDetailContent } from "../../media/[id]/_components/MediaDetailContent";
import { LocationSearchInput } from "../../_components/LocationSearchInput";
import { MovingMediaCard, type MovingMediaData } from "./MovingMediaCard";

const MOVING_MEDIA: MovingMediaData[] = [
  { id: "m1", name: "서울 버스 TV", price: "최소집행금액 1,400만원 / 1일", badge: "new" },
  { id: "m2", name: "MOAD", price: "최소집행금액 800만원 / 1주", badge: "popular" },
  { id: "m3", name: "대전 버스외부광고", price: "최소집행금액 500만원 / 1달" },
  { id: "m4", name: "서울버스외부광고", price: "최소집행금액 900만원 / 1달", badge: "popular" },
  { id: "m5", name: "경기 광역버스 광고", price: "최소집행금액 600만원 / 1달" },
  { id: "m6", name: "경기 지선버스 광고", price: "최소집행금액 450만원 / 1달" },
  { id: "m7", name: "인천 시내버스 광고", price: "최소집행금액 400만원 / 1달" },
  { id: "m8", name: "택시 디지털 광고", price: "최소집행금액 700만원 / 1주", badge: "new" },
];

const FILTERS = [
  "카테고리",
  "가격 범위",
  "매체 판매 유형",
  "매체 타입",
  "설치 장소",
  "매체 형태",
];

export function MovingView() {
  const [location, setLocation] = useState("");
  const [selectedId, setSelectedId] = useState(MOVING_MEDIA[0].id);

  const selected =
    MOVING_MEDIA.find((media) => media.id === selectedId) ?? MOVING_MEDIA[0];

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col border-r border-[#e8e8e8]">
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
          <div className="grid grid-cols-3 gap-[12px]">
            {MOVING_MEDIA.map((media) => (
              <MovingMediaCard
                key={media.id}
                data={media}
                selected={media.id === selectedId}
                onClick={() => setSelectedId(media.id)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto">
        <MediaDetailContent
          name={selected.name}
          price={selected.price}
          className="px-[40px] py-[40px]"
          hidePopulation
        />
      </div>
    </div>
  );
}
