"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { AddToProposalModal } from "@/components/common/AddToProposalModal";
import { MarkerMediaPopup } from "@/components/common/MarkerMediaPopup";
import {
  MediaDetailDrawer,
  type MediaDetail as DrawerDetail,
} from "@/components/common/MediaDetailDrawer";
import type { MediaItemData } from "@/components/common/MediaItem";
import { MobileMediaDetail } from "@/components/common/MobileMediaDetail";
import { ChevronLeftIcon, MapPinIcon } from "@/components/icons";
import { useMediaDetail } from "@/hooks/media";
import { ChatPanel } from "./ChatPanel";
import { MapArea, type MapMarker } from "./MapArea";

function toDrawerDetail(
  detail: ReturnType<typeof useMediaDetail>["data"],
): DrawerDetail | undefined {
  if (!detail) return undefined;
  const pop = detail.population;
  return {
    description: detail.description ?? undefined,
    address: detail.address ?? undefined,
    monthlyTraffic: pop ? pop.monthlyFootTraffic.toLocaleString() : undefined,
    mainAudience: pop
      ? [
          {
            gender: pop.malePct >= pop.femalePct ? "남성" : "여성",
            age: pop.ageRatios.reduce((top, cur) =>
              cur.value > top.value ? cur : top,
            ).label,
          },
        ]
      : undefined,
    genderRatio: pop ? { male: pop.malePct, female: pop.femalePct } : undefined,
    ageRatio: pop
      ? pop.ageRatios.map((a) => ({
          label: a.label,
          value: a.value,
          bound: a.bound ?? undefined,
        }))
      : undefined,
  };
}

function formatFee(krw: number | null): string {
  if (krw == null) return "최소집행금액 협의";
  return `최소집행금액 ${Math.round(krw / 10000).toLocaleString()}만원`;
}

const DRAWER_HALF_WIDTH = 192;

export function FixedMediaView() {
  const router = useRouter();
  const [chatOpen, setChatOpen] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<MediaItemData | null>(null);
  const [mobileMap, setMobileMap] = useState(false);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [focusId, setFocusId] = useState<string | undefined>(undefined);
  const [popupId, setPopupId] = useState<string | null>(null);
  const [addProposalMediaId, setAddProposalMediaId] = useState<string | null>(
    null,
  );

  const { data: detail } = useMediaDetail(selectedMedia?.id ?? null);
  const features = detail?.features.map(
    (f) => [f.label, f.value] as [string, string],
  );
  const planList = detail?.plans.map((p) => ({
    title: p.title,
    subtitle: p.subtitle ?? "",
  }));
  const detailImage = detail?.thumbnailUrl ?? detail?.imageUrls[0] ?? null;
  const population = detail?.population
    ? {
        malePct: detail.population.malePct,
        femalePct: detail.population.femalePct,
        ageRatios: detail.population.ageRatios.map((a) => ({
          label: a.label,
          value: a.value,
          bound: a.bound ?? undefined,
        })),
      }
    : null;

  const { data: popupDetail } = useMediaDetail(popupId);
  const popupItems: MediaItemData[] = popupId
    ? [
        {
          id: popupId,
          name:
            markers.find((m) => m.id === popupId)?.name ??
            popupDetail?.name ??
            "",
          price: formatFee(popupDetail?.minAdvertisementFeeKrw ?? null),
          images: popupDetail?.imageUrls ?? [],
          popular: popupDetail?.badge === "popular",
        },
      ]
    : [];

  const handleMarkerClick = (id: string) => setPopupId(id);

  // 새 추천 리스트 → 마커 갱신 + 포커스/팝업 해제(전체 범위로)
  const handleRecommendations = useCallback((mk: MapMarker[]) => {
    setMarkers(mk);
    setFocusId(undefined);
    setPopupId(null);
  }, []);

  const handleOpenDetail = (item: MediaItemData) => setSelectedMedia(item);

  return (
    <div className="relative h-full w-full overflow-hidden bg-white">
      <MapArea
        markers={markers}
        onMarkerClick={handleMarkerClick}
        focusId={focusId}
        focusOffsetX={selectedMedia ? DRAWER_HALF_WIDTH : 0}
        popupId={popupId}
        popupContent={
          popupId ? (
            <MarkerMediaPopup
              items={popupItems}
              onSelect={(item) => {
                setSelectedMedia(item);
                setPopupId(null);
              }}
              onAddProposal={(item) => setAddProposalMediaId(item.id)}
            />
          ) : null
        }
        onPopupClose={() => setPopupId(null)}
        className={`absolute inset-y-0 right-0 left-0 z-0 transition-[left] duration-300 ease-in-out sm:block ${
          chatOpen ? "sm:left-[384px]" : "sm:left-0"
        } ${mobileMap ? "block" : "hidden"}`}
      />

      <div
        className={`absolute inset-y-0 left-0 right-0 z-10 sm:right-auto sm:flex ${
          mobileMap ? "hidden" : "flex"
        }`}
      >
        {chatOpen && (
          <ChatPanel
            onSelectMedia={setSelectedMedia}
            selectedId={selectedMedia?.id}
            onRecommendations={handleRecommendations}
            onFocusMedia={setFocusId}
            onOpenDetail={handleOpenDetail}
            onAddProposal={(id) => setAddProposalMediaId(id)}
          />
        )}
        {chatOpen && selectedMedia && (
          <div className="hidden sm:block">
            <MediaDetailDrawer
              media={selectedMedia}
              detail={toDrawerDetail(detail)}
              onClose={() => setSelectedMedia(null)}
              onViewDetail={() => router.push(`/media/${selectedMedia.id}`)}
            />
          </div>
        )}
        <div className="hidden items-center sm:flex">
          <button
            type="button"
            onClick={() => setChatOpen((open) => !open)}
            aria-label={chatOpen ? "채팅 패널 접기" : "채팅 패널 펼치기"}
            className="flex h-[44px] w-[22px] items-center justify-center rounded-r-[4px] border-y border-r border-stroke bg-white text-black"
          >
            <ChevronLeftIcon
              className={`size-[16px] transition-transform duration-300 ${
                chatOpen ? "" : "rotate-180"
              }`}
            />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setMobileMap((value) => !value)}
        className="absolute bottom-[24px] left-1/2 z-20 flex -translate-x-1/2 items-center gap-[6px] rounded-full bg-primary px-[16px] py-[8px] text-white drop-shadow-[0px_2px_8px_rgba(0,0,0,0.2)] sm:hidden"
      >
        <MapPinIcon className="size-[18px]" />
        <span className="text-sm font-medium whitespace-nowrap">
          {mobileMap ? "목록보기" : "지도보기"}
        </span>
      </button>

      {selectedMedia && (
        <div className="absolute inset-0 z-30 overflow-y-auto bg-white sm:hidden">
          <MobileMediaDetail
            name={selectedMedia.name}
            price={formatFee(detail?.minAdvertisementFeeKrw ?? null)}
            badge={detail?.badge ?? null}
            description={detail?.description ?? undefined}
            features={features}
            mediaList={planList}
            size={detail?.sizeText ?? null}
            imageUrl={detailImage}
            population={population}
            onBack={() => setSelectedMedia(null)}
          />
        </div>
      )}

      {addProposalMediaId && (
        <AddToProposalModal
          mediaId={addProposalMediaId}
          onClose={() => setAddProposalMediaId(null)}
        />
      )}
    </div>
  );
}
