"use client";

import { Chip } from "@heroui/react";
import { useState } from "react";

import {
  DetailActions,
  DetailModalShell,
  ImageGallery,
  MediaDetailSkeleton,
} from "@/components/common/MediaDetailModal";
import { ImageLightbox } from "@/components/common/ImageLightbox";
import { MediaImageCarousel } from "@/components/common/MediaImageCarousel";
import { MediaLocationMapModal } from "@/components/common/media-detail/MediaLocationMapModal";
import { NearbyStations } from "@/components/common/media-detail/NearbyStations";
import {
  type MediaDetailViewModel,
  toMediaDetailViewModel,
} from "@/components/common/media-detail/useMediaDetailViewModel";
import {
  ChevronLeftIcon,
  ChevronRightBoldIcon,
  ChevronRightIcon,
  LocationFilledIcon,
} from "@/components/icons";
import { useMe } from "@/hooks/auth";
import { useFavorite } from "@/hooks/favorites";
import { useMediaDetail } from "@/hooks/media";
import { usePartnersStore } from "@/hooks/partners";
import {
  NOTE_TONE_CHIP,
  noteTone,
  PARTNERS_MEDIA_CATEGORY,
  type PartnersStore,
  photoKindLabel,
} from "@/lib/partners";
import { cn } from "@/lib/utils";

import { type CollabPick, collabFeeText, GradeBox } from "./collabPick";

/*
 * 콜라보 매장 정보 팝업 — 매체 찾기 · 광고주 매장 찾기(/partners/find) · 관심 매장에서 매장 카드나 지도 말풍선을 누르면 띄운다
 * (11-16 사용자: "매장을 누르면 페이지 이동이 되는데 admix처럼 상세 팝업이 뜨게"). 예전엔 매장 상세(/partners/stores/[id])를 새 탭으로 열었다.
 * 매체 정보 팝업과 같은 틀(DetailModalShell) — 왼쪽 사진(정사각형, 11-16 사용자: "매장 사진을 정사각형으로 보여줘" —
 * 팝업도 좁게 780px, 사진 · 오른쪽 칸 둘 다 360px: "너비를 좁혀도 될 듯"), 오른쪽 이름 · 주소(누르면 위치 지도) · 가까운 역 · 매장 유형 칩 · 태그 · 금액 · 매장 정보.
 * 매장 정보(운영 시간 · 전화번호 · 사장님)는 사진 옆 오른쪽 칸 안에 이름 ― 값 줄로(11-16 사용자: "아래 매장 정보를 예쁘게 배치해 줘" —
 * 처음엔 사진 아래 2칸 격자라 세 칸 중 한 자리가 비고 사진 옆은 비어 보였다). 버튼은 닫기 · 하트(기획안 담기는 없다).
 * 유동인구는 넣지 않는다(11-16 사용자: "매장 정보에는 유동인구 정보 빼줘") — 매체 상세(같은 매체 ID)에서는 가까운 역만 쓴다.
 * 콜라보 금액은 광고주에게만(11-16 사용자) — 비회원 · 제휴사 · 그 밖의 회원에겐 금액 칸 자체를 그리지 않는다(자물쇠 · 안내도 없이).
 * 서버도 광고주에게만 등급 · 금액을 준다(partners_service._pricing).
 * 사진은 분류(외관 · 내관 …)마다 대표 한 장씩 — 큰 사진 왼쪽 아래 분류 이름, 그 오른쪽에 설명(어드민 사진 메모),
 * 썸네일에도 분류 이름(11-16 사용자: "외관인지 내관인지 분류명이 왼쪽에 … 대표 이미지가 아닌 이미지들도").
 * 같은 분류 사진이 더 있으면 큰 사진 오른쪽 위 "펼쳐보기" — 누르면 그 분류 사진이 대표 사진 바로 뒤로 썸네일 줄
 * (모바일은 넘기기)에 이어 나오고 "접기"로 되돌린다. 한 번에 한 분류만(사용자: "펼치면 옆으로 쭈루룩" —
 * 처음엔 "내관 6장 보기"로 그 분류만 크게 보기를 열었다). 큰 사진을 누르면 지금 줄 그대로 크게 보기(분류 · 설명).
 * 매장 정보 줄 맨 아래 매장 조건(조건 메모 칩, 내 매장과 같은 색) · 매장 어필은 "# 뷰맛집"처럼 띄운다(11-16 사용자).
 */

/**
 * 매장 정보 줄 — 매장 상세 화면과 같은 항목(이름 ― 값). 값이 없는 줄은 빼고, 다 없으면 칸째 그리지 않는다
 * (11-16 사용자: "더 예쁘게" — 영업 기록 매장은 아직 다 비어 "-" 네 줄만 남았다). 매장 조건은 이 칸 맨 아래 따로(StoreInfoCard).
 * 줄 앞 아이콘은 뺐다(11-16 사용자: "아이콘은 빼줘").
 */
const storeRows = (store: PartnersStore): [string, string][] =>
  (
    [
      ["운영 시간", store.businessHours],
      ["전화번호", store.phone],
      ["사장님", store.ownerName],
    ] as [string, string | null][]
  ).filter((r): r is [string, string] => !!r[1]?.trim());

type StorePhotoView = { url: string; label?: string; memo?: string };
/** 줄에 보이는 사진 한 장과 그 분류 묶음 번호. */
type ShownPhoto = { photo: StorePhotoView; group: number };

/** 줄에 보일 사진 — 분류마다 대표 한 장, 펼친 분류만 그 분류 사진 전부(대표가 맨 앞). */
const shownPhotos = (
  groups: StorePhotoView[][],
  expanded: number | null,
): ShownPhoto[] =>
  groups.flatMap((g, group) =>
    (group === expanded ? g : g.slice(0, 1)).map((photo) => ({
      photo,
      group,
    })),
  );

/**
 * 분류별 사진 묶음 — 분류 순(서버 순서), 묶음마다 대표 사진이 맨 앞. 분류 정보가 없는 예전 사진은 한 장씩 따로.
 * 메뉴 사진은 서버가 광고주 · 제휴사에게 내보내지 않는다.
 */
function photoGroups(store: PartnersStore): StorePhotoView[][] {
  const photos = store.images ?? [];
  if (photos.length === 0) return store.imageUrls.map((url) => [{ url }]);
  const byKind = new Map<string, StorePhotoView[]>();
  for (const p of photos) {
    const list = byKind.get(p.kind) ?? [];
    const view = {
      url: p.url,
      label: photoKindLabel(p.kind),
      memo: p.memo?.trim() || undefined,
    };
    if (p.cover) list.unshift(view);
    else list.push(view);
    byKind.set(p.kind, list);
  }
  return [...byKind.values()];
}

/** 닫히면 부모가 바로 언마운트한다(매체 정보 팝업과 같다). mediaId 는 매체 찾기 카드의 매체 ID(CF-0001). */
export function StoreDetailModal({
  mediaId,
  onClose,
}: {
  mediaId: string;
  onClose: () => void;
}) {
  const { data: store, isError } = usePartnersStore(mediaId);
  // 가까운 역 — 매체 상세(같은 매체 ID). 둘 다 받은 뒤 그린다(나중에 오면 이름 아래 줄이 끼어들며 흔들린다).
  // 매체 상세를 못 받아도 매장 내용은 그대로 보인다.
  const media = useMediaDetail(mediaId);
  const vm = media.data ? toMediaDetailViewModel(media.data) : null;
  // 광고주만 금액 칸 · 하트는 "관심 매장"(관심 매장 메뉴는 광고주 화면). 그 밖의 회원은 admix "관심 매체".
  const { data: me } = useMe();
  const advertiser = me?.member_category === "advertiser";
  const likeLabel = advertiser ? "관심 매장" : "관심 매체";
  const { liked, setLiked } = useFavorite(mediaId, {
    notifyName: store?.name ?? "",
    label: likeLabel,
  });

  return (
    <DetailModalShell
      ariaLabel="매장 상세"
      title="매장 정보"
      hint={`매장 정보를 확인하고 ${likeLabel}에 담을 수 있어요.`}
      onClose={onClose}
      narrow
      footer={
        store && (
          <DetailActions
            liked={liked}
            onLikedChange={setLiked}
            onClose={onClose}
            likeLabel={likeLabel}
          />
        )
      }
    >
      {store && !media.isPending ? (
        <StoreDetailBody store={store} vm={vm} showFee={advertiser} />
      ) : isError ? (
        <p className="py-[64px] text-center text-[14px] font-semibold break-keep text-gray-600">
          지금은 매장 정보를 볼 수 없어요. 비공개로 바뀌었거나 콜라보를 쉬는
          매장일 수 있어요.
        </p>
      ) : (
        <MediaDetailSkeleton />
      )}
    </DetailModalShell>
  );
}

function StoreDetailBody({
  store,
  vm,
  showFee,
}: {
  store: PartnersStore;
  vm: MediaDetailViewModel | null;
  /** 광고주만 — 아니면 금액 칸을 그리지 않는다. */
  showFee: boolean;
}) {
  const groups = photoGroups(store);
  // 펼친 분류(묶음 번호) — 그 분류 사진이 대표 사진 바로 뒤로 이어 나온다. 한 번에 한 분류만.
  const [expanded, setExpanded] = useState<number | null>(null);
  // 펼치기 · 접기 뒤 처음 고를 장 — 그 분류 대표 사진 자리(줄 · 넘기기를 key 로 새로 그리며 넘긴다).
  const [start, setStart] = useState(0);
  const shown = shownPhotos(groups, expanded);
  const urls = shown.map((s) => s.photo.url);
  const toggleGroup = (group: number) => {
    const next = expanded === group ? null : group;
    setStart(shownPhotos(groups, next).findIndex((s) => s.group === group));
    setExpanded(next);
  };

  const address = [store.address, store.addressDetail]
    .filter(Boolean)
    .join(" ");
  const location =
    store.latitude != null && store.longitude != null
      ? { lat: store.latitude, lng: store.longitude }
      : null;

  // 크게 보기 — 지금 줄(펼친 분류 포함) 그대로, 누른 장부터(닫혀 있으면 null).
  const [zoom, setZoom] = useState<number | null>(null);
  const overlays = shown.map((s) => (
    <PhotoOverlay
      key={s.photo.url}
      photo={s.photo}
      expandable={groups[s.group].length > 1}
      expanded={s.group === expanded}
      onToggle={() => toggleGroup(s.group)}
    />
  ));
  // 주소를 누르면 여는 위치 지도.
  const [mapOpen, setMapOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col items-center gap-[20px] max-sm:gap-[16px] md:flex-row md:items-stretch">
        <ImageGallery
          key={`gallery-${expanded}`}
          images={urls}
          square
          captions={overlays}
          thumbLabels={shown.map((s) => s.photo.label)}
          initialIndex={start}
          onOpen={setZoom}
        />
        <MediaImageCarousel
          key={`carousel-${expanded}`}
          slides={urls.length > 0 ? urls : [undefined]}
          sizes="100vw"
          className="aspect-square w-full shrink-0 rounded-[10px] sm:hidden"
          captions={overlays}
          initialIndex={start}
          onSlideClick={setZoom}
        />
        {zoom != null && (
          <ImageLightbox
            images={urls}
            initialIndex={zoom}
            captions={shown.map((s) => (
              <PhotoCaption key={s.photo.url} photo={s.photo} />
            ))}
            onClose={() => setZoom(null)}
          />
        )}

        {/* 오른쪽 칸 — 머리(매장 유형 · 이름 · 주소 · 가까운 역 · 어필 태그)와 아래 정보(금액 · 매장 정보)를 가는 선으로 나눈다
            (11-16 사용자: "매장 상세 팝업을 더 예쁘게"). 강조는 글자 크기 · 굵기만, 색은 은은하게. */}
        <div className="flex w-full min-w-0 flex-1 flex-col">
          <div className="flex flex-col items-start gap-[8px]">
            {/* 매체 정보 팝업의 카테고리 칩과 같은 모양 — 콜라보 › 매장 유형. 이름 위에 작게. */}
            <Chip className="gap-0 rounded-[8px] bg-tone-ededef py-[3px] text-[11px] leading-[16.5px] text-zinc-500">
              {PARTNERS_MEDIA_CATEGORY}
              <ChevronRightBoldIcon className="size-[16px] shrink-0" />
              {store.storeType || "매장"}
            </Chip>
            <p className="text-[20px] leading-[28px] font-bold break-keep text-black max-sm:text-[17px] max-sm:leading-[24px]">
              {store.name}
              {/* 협업 확정 매장이면 이름 뒤에 작은 초록 표시(public/icons/collabo.svg, 11-16 사용자) — 영업 기록 매장(unconfirmed)엔 없다.
                  글자 없는 이음 문자(U+2060)로 이름 끝 글자와 붙여 표시만 다음 줄로 넘어가지 않게 한다. */}
              {!store.unconfirmed && (
                <>
                  {"\u2060"}
                  <span
                    role="img"
                    aria-label="협업 확정 매장"
                    title="협업 확정 매장"
                    className="ml-[5px] inline-block h-[16px] w-[15px] bg-current align-[-2px] text-success [mask:url(/icons/collabo.svg)_center/contain_no-repeat] max-sm:ml-[4px] max-sm:h-[14px] max-sm:w-[13px]"
                  />
                </>
              )}
            </p>

            {/* 위치가 있으면 주소를 누르면 위치 지도(매체 정보 팝업과 같다 — 매장은 방향이 없다). */}
            {location ? (
              <button
                type="button"
                onClick={() => setMapOpen(true)}
                className="group flex items-center gap-[3px] text-left"
              >
                <LocationFilledIcon className="size-[14px] shrink-0 text-tone-6c757d group-hover:text-black" />
                <span className="text-[12px] text-tone-6c757d underline underline-offset-2 group-hover:text-black">
                  {address || "지도에서 위치 보기"}
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-[3px]">
                <LocationFilledIcon className="size-[14px] shrink-0 text-tone-6c757d" />
                <span className="text-[12px] text-tone-6c757d">
                  {address || "-"}
                </span>
              </div>
            )}
            {mapOpen && location && (
              <MediaLocationMapModal
                name={store.name}
                address={address}
                lat={location.lat}
                lng={location.lng}
                direction={null}
                spread={null}
                onClose={() => setMapOpen(false)}
              />
            )}

            <NearbyStations stations={vm?.nearbyStations ?? []} />
          </div>

          {/* 매장 어필 — 테두리 없는 연한 알약, "# 뷰맛집"처럼 띄어 쓴다(11-16 사용자). */}
          {store.tags.length > 0 && (
            <div className="mt-[14px] flex flex-wrap gap-[6px]">
              {store.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-gray-100 px-[10px] text-[12px] leading-[26px] font-medium text-gray-600"
                >
                  # {t}
                </span>
              ))}
            </div>
          )}

          <div className="mt-[18px] flex flex-col gap-[10px] border-t border-tone-ececef pt-[18px] max-sm:mt-[16px] max-sm:pt-[16px]">
            {showFee && (
              <CollabPriceBox
                grade={store.collabGrade ?? null}
                fee={store.collabFee ?? null}
              />
            )}
            <StoreInfoCard rows={storeRows(store)} notes={store.notes} />
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * 큰 사진 위 — 왼쪽 아래 분류 이름 + 그 오른쪽 설명(길면 두 줄까지, 아래 어둡게 깔아 읽히게),
 * 같은 분류 사진이 더 있으면 오른쪽 위 "펼쳐보기"(펼친 분류의 사진에선 "접기").
 * 사진 위에 겹치기만 하고(pointer-events-none) 버튼만 눌린다 — 나머지를 누르면 크게 보기.
 */
function PhotoOverlay({
  photo,
  expandable,
  expanded,
  onToggle,
}: {
  photo: StorePhotoView;
  /** 같은 분류 사진이 더 있는지. */
  expandable: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Chevron = expanded ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <>
      {(photo.label || photo.memo) && (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 flex items-start gap-[6px] p-[10px]",
            photo.memo &&
              "bg-gradient-to-t from-black/60 via-black/30 to-transparent pt-[32px]",
          )}
        >
          {photo.label && (
            <span className="shrink-0 rounded-[6px] bg-black/55 px-[6px] text-[11px] leading-[18px] font-semibold text-white">
              {photo.label}
            </span>
          )}
          {photo.memo && (
            <p className="line-clamp-2 min-w-0 text-left text-[12px] leading-[18px] font-medium break-keep text-white">
              {photo.memo}
            </p>
          )}
        </div>
      )}
      {expandable && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggle}
          className="absolute top-[10px] right-[10px] flex items-center gap-[1px] rounded-[7px] bg-black/55 py-0 pr-[4px] pl-[8px] text-[12px] leading-[24px] font-semibold text-white transition-colors hover:bg-black/75"
        >
          {expanded ? "접기" : "펼쳐보기"}
          <Chevron aria-hidden className="size-[14px] shrink-0" />
        </button>
      )}
    </>
  );
}

/** 크게 보기 왼쪽 위 — 분류 이름 + 그 오른쪽 설명. */
function PhotoCaption({ photo }: { photo: StorePhotoView }) {
  if (!photo.label && !photo.memo) return null;
  return (
    <div className="flex items-start gap-[8px]">
      {photo.label && (
        <span className="shrink-0 rounded-[7px] bg-white/15 px-[8px] text-[13px] leading-[24px] font-semibold text-white">
          {photo.label}
        </span>
      )}
      {photo.memo && (
        <p className="min-w-0 text-[14px] leading-[24px] font-medium break-keep text-white/90">
          {photo.memo}
        </p>
      )}
    </div>
  );
}

/**
 * 매장 정보 칸 — 금액 칸 아래, 테두리만 있는 칸. 줄마다 이름 ― 값(값이 길면 줄을 바꾼다).
 * 맨 아래 매장 조건 줄은 이름 아래에 조건 메모 칩(내 매장과 같은 색)을 왼쪽부터 늘어놓는다. 줄도 조건도 없으면 칸째 그리지 않는다.
 */
function StoreInfoCard({
  rows,
  notes,
}: {
  rows: [string, string][];
  notes: string[];
}) {
  if (rows.length === 0 && notes.length === 0) return null;
  const line = "flex border-t border-tone-ececef py-[11px] first:border-t-0";
  const label = (text: string) => (
    <dt className="shrink-0 text-[12px] leading-[20px] font-semibold text-zinc-400">
      {text}
    </dt>
  );
  return (
    <dl className="flex w-full flex-col rounded-[14px] border border-tone-ececef px-[14px]">
      {rows.map(([text, value]) => (
        <div
          key={text}
          className={cn(line, "items-start justify-between gap-[16px]")}
        >
          {label(text)}
          <dd className="min-w-0 text-right text-[13px] leading-[20px] font-semibold break-keep text-zinc-900">
            {value}
          </dd>
        </div>
      ))}
      {notes.length > 0 && (
        <div className={cn(line, "flex-col gap-[8px]")}>
          {label("매장 조건")}
          <dd className="flex flex-wrap gap-[4px]">
            {notes.map((n) => (
              <span
                key={n}
                className={cn(
                  "rounded-[8px] px-[7px] text-[12px] leading-[22px] font-semibold",
                  NOTE_TONE_CHIP[noteTone(n)],
                )}
              >
                {n}
              </span>
            ))}
          </dd>
        </div>
      )}
    </dl>
  );
}

/** 금액 칸 — 매체 정보 팝업의 가격 칸(광고비)과 같은 모양, "콜라보 금액 / 1건" + 등급 · 금액(없으면 "금액 협의"). */
function CollabPriceBox({
  grade,
  fee,
}: {
  grade: CollabPick["grade"];
  fee: number | null;
}) {
  return (
    <div className="flex w-full items-center justify-between rounded-[12px] border border-tone-ececef bg-tone-f7f7f8 p-[12px] whitespace-nowrap">
      <div className="flex items-center gap-[3px] text-[12px] text-zinc-400">
        <span className="font-semibold">콜라보 금액</span>
        <span>/ 1건</span>
      </div>
      <span className="flex items-center gap-[6px]">
        <GradeBox grade={grade} />
        <span
          className={cn(
            "text-[18px] font-bold max-sm:text-[15px]",
            fee ? "text-zinc-900" : "text-gray-500",
          )}
        >
          {collabFeeText(fee)}
        </span>
      </span>
    </div>
  );
}
