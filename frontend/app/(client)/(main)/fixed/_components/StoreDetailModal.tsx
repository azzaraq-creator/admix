"use client";

import { Button, Chip, Popover, Tooltip } from "@heroui/react";
import { Fragment, useState, type ReactNode } from "react";

import {
  DetailActions,
  DetailModalShell,
  ImageGallery,
  MediaDetailSkeleton,
} from "@/components/common/MediaDetailModal";
import { ImageLightbox } from "@/components/common/ImageLightbox";
import { useGoPartners } from "@/components/common/PartnersAccessNotice";
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
  SmallCheckIcon,
  SmallXIcon,
} from "@/components/icons";
import { useMe } from "@/hooks/auth";
import { useFavorite } from "@/hooks/favorites";
import { useMediaDetail } from "@/hooks/media";
import { usePartnersStore } from "@/hooks/partners";
import { useCanHover } from "@/hooks/useCanHover";
import {
  COLLAB_SCOPE_VALUE_LABEL,
  COLLAB_SCOPE_VALUES,
  PARTNERS_MEDIA_CATEGORY,
  type CollabScope,
  type PartnersStore,
  photoKindLabel,
  scopeEntries,
} from "@/lib/partners";
import { cn } from "@/lib/utils";

import { type CollabPick, collabFeeText, GradeBox } from "./collabPick";

/*
 * 콜라보 매장 정보 팝업 — 매체 찾기 · 광고주 매장 찾기(/partners/find) · 관심 매장에서 매장 카드나 지도 말풍선을 누르면 띄운다
 * (11-16 사용자: "매장을 누르면 페이지 이동이 되는데 admix처럼 상세 팝업이 뜨게"). 예전엔 매장 상세(/partners/stores/[id])를 새 탭으로 열었다.
 * 매체 정보 팝업과 같은 틀(DetailModalShell) — 왼쪽 사진(가로 4:3, 440px — 2026-11-19 사용자: "가로로 사진을 찍거든".
 * 11-16엔 정사각형 360px에 팝업도 780px로 좁혔다), 오른쪽 칸 360px에 이름 · 주소(누르면 위치 지도) · 가까운 역 · 매장 유형 칩 · 태그 · 금액 · 매장 정보.
 * 매장 정보는 사진 옆 오른쪽 칸 안에(11-16 사용자: "아래 매장 정보를 예쁘게 배치해 줘" — 처음엔 사진 아래 2칸 격자였다).
 * 11-17 사용자("주요 고객층 · 소개 · 규모도 보이게, 사장님 이름 · 전화번호는 빼줘, 가독성 좋게 깔끔하게"):
 * 이름 · 주소 · 가까운 역 아래에 소개(줄바꿈 그대로), 선 아래에 금액 → "매장 정보"(운영 시간 · 규모 · 주요 고객층, 이름표 열을 맞춘 줄)
 * → "가능 범위"(가능 · 불가능 두 줄에 항목 칩). 테두리 칸 · 색 칩을 줄이고 제목 · 이름표 · 값의 글자 단계로만 나눈다.
 * 11-17 사용자("오른쪽만 길어져 사진과 높이가 안 맞아 안 예쁘다 — 왼쪽 사진, 오른쪽 기본 정보, 하단에 가능 범위와 콜라보 금액"):
 * 위는 사진 | 기본 정보(유형 칩 · 이름 · 주소 · 가까운 역 · 소개 → 선 → 매장 정보 → 맨 아래 콜라보 금액(광고주만),
 * 금액이 PC에선 사진 칸 아래 끝에 맞춘다), 그 아래 전체 폭으로 가능 범위(항목 칸 PC 3열 · 휴대폰 2열).
 * (금액도 아래로 내려 봤더니 오른쪽 칸 가운데가 비고 팝업이 길어져 "더 예쁘게" — 금액만 오른쪽 칸 맨 아래로.) 칸 순서는 이 줄이 최신이다.
 * 버튼은 닫기 · 하트(기획안 담기는 없다).
 * 유동인구는 넣지 않는다(11-16 사용자: "매장 정보에는 유동인구 정보 빼줘") — 매체 상세(같은 매체 ID)에서는 가까운 역만 쓴다.
 * 콜라보 금액은 광고주에게만(11-16 사용자) — 비회원 · 제휴사 · 그 밖의 회원에겐 금액 칸 자체를 그리지 않는다(자물쇠 · 안내도 없이).
 * 서버도 광고주에게만 등급 · 금액을 준다(partners_service._pricing).
 * admix 매체 찾기에선 누구나(광고주 포함) 간단히 보기(brief, 2026-11-19 사용자: "눌러서 팝업까진 보게" →
 * "광고주도 admix 매체 찾기에선 다른 유형과 동일하게, 콜라보 페이지에서만 다 보게. 관심 매장도 콜라보 페이지에서만") —
 * 금액 · 가능 범위 없이 사진 · 기본 정보 · 매장 정보만, 하트 대신 "콜라보 바로 가기"(새 탭).
 * 서버도 광고주가 아니면 가능 범위 · 매장 ID를 빼고 준다. 콜라보 화면(매장 찾기 · 관심 매장 · 기획안)의 광고주만 다 본다.
 * 사진은 분류(외관 · 내관 …)마다 대표 한 장씩 — 큰 사진 왼쪽 아래 분류 이름, 그 오른쪽에 설명(어드민 사진 메모),
 * 썸네일에도 분류 이름(11-16 사용자: "외관인지 내관인지 분류명이 왼쪽에 … 대표 이미지가 아닌 이미지들도").
 * 같은 분류 사진이 더 있으면 큰 사진 오른쪽 위 "펼쳐보기" — 누르면 그 분류 사진이 대표 사진 바로 뒤로 썸네일 줄
 * (모바일은 넘기기)에 이어 나오고 "접기"로 되돌린다. 한 번에 한 분류만(사용자: "펼치면 옆으로 쭈루룩" —
 * 처음엔 "내관 6장 보기"로 그 분류만 크게 보기를 열었다). 큰 사진을 누르면 지금 줄 그대로 크게 보기(분류 · 설명).
 */

/**
 * 매장 정보 줄(이름 ― 값) — 값이 없는 줄은 빼고, 다 없으면 묶음째 그리지 않는다(11-16 사용자: "더 예쁘게" —
 * 영업 기록 매장은 아직 다 비어 "-" 줄만 남았다). 전화번호 · 사장님은 뺐다(11-17 사용자). 줄 앞 아이콘은 없다(11-16 "아이콘은 빼줘").
 */
const storeRows = (store: PartnersStore): [string, string][] =>
  (
    [
      ["운영 시간", store.businessHours],
      ["규모", store.seats != null ? `좌석 ${store.seats}석` : null],
      ["주요 고객층", store.mainCustomers],
    ] as [string, string | null | undefined][]
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
  brief: briefProp = false,
}: {
  mediaId: string;
  onClose: () => void;
  /** 간단히 보기 — admix 매체 찾기(광고주도). 안 주면 광고주가 아닌 회원만 간단히 보기. */
  brief?: boolean;
}) {
  const { data: store, isError } = usePartnersStore(mediaId);
  // 가까운 역 — 매체 상세(같은 매체 ID). 둘 다 받은 뒤 그린다(나중에 오면 이름 아래 줄이 끼어들며 흔들린다).
  // 매체 상세를 못 받아도 매장 내용은 그대로 보인다.
  const media = useMediaDetail(mediaId);
  const vm = media.data ? toMediaDetailViewModel(media.data) : null;
  // 광고주만 금액 칸 · 하트는 "관심 매장"(관심 매장 메뉴는 광고주 화면).
  // 광고주가 아닌 회원은 간단히 보기 — 금액 · 가능 범위 없이, 하트 대신 "콜라보 바로 가기"(11-19).
  const { data: me } = useMe();
  const advertiser = me?.member_category === "advertiser";
  const brief = briefProp || (!!me && !advertiser);
  const likeLabel = advertiser ? "관심 매장" : "관심 매체";
  // 금액 — 콜라보 화면의 광고주만(admix 매체 찾기에선 광고주도 안 그린다).
  const showFee = advertiser && !brief;
  const { liked, setLiked } = useFavorite(mediaId, {
    notifyName: store?.name ?? "",
    label: likeLabel,
  });
  // 콜라보 바로 가기 — 광고주는 콜라보 매장 찾기에서 이 매장 자리로 옮기고 팝업을 바로 연다(11-19).
  const goPartners = useGoPartners({
    mediaId,
    lat: store?.latitude,
    lng: store?.longitude,
  });

  return (
    <DetailModalShell
      ariaLabel="매장 상세"
      title="매장 정보"
      hint={
        brief
          ? "콜라보 매장 정보를 간단히 볼 수 있어요."
          : `매장 정보를 확인하고 ${likeLabel}에 담을 수 있어요.`
      }
      onClose={onClose}
      narrow
      footer={
        store && (
          <DetailActions
            liked={liked}
            onLikedChange={setLiked}
            onClose={onClose}
            likeLabel={likeLabel}
            likeSlot={
              brief ? (
                // 하트 자리 — 꺼진 하트 버튼과 같은 흰 바탕 · 테두리, 새 탭 아이콘(export.svg)은 글자색.
                <Button
                  variant="ghost"
                  onPress={goPartners}
                  className="h-auto gap-[7px] rounded-[18px] border border-tone-ececef bg-surface px-[16px] py-[10px] text-[13px] font-medium text-zinc-900 data-[hovered=true]:bg-zinc-50 max-sm:min-w-0 max-sm:flex-1 max-sm:gap-[6px] max-sm:px-[8px] max-sm:text-[12px]"
                >
                  <span
                    aria-hidden
                    className="size-[13px] shrink-0 bg-current text-gray-500 [mask:url(/icons/export.svg)_center/contain_no-repeat] max-sm:size-[12px]"
                  />
                  콜라보 바로 가기
                </Button>
              ) : undefined
            }
          />
        )
      }
    >
      {store && !media.isPending ? (
        <StoreDetailBody
          store={store}
          vm={vm}
          showFee={showFee}
          showScope={!brief}
        />
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
  showScope,
}: {
  store: PartnersStore;
  vm: MediaDetailViewModel | null;
  /** 광고주만 — 아니면 금액 칸을 그리지 않는다. */
  showFee: boolean;
  /** 가능 범위 — 광고주가 아닌 회원의 간단히 보기엔 없다(11-19). */
  showScope: boolean;
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
  const info = storeRows(store);
  const hasScope = showScope && scopeEntries(store.scope).length > 0;

  return (
    <>
      <div className="flex flex-col items-center gap-[20px] max-sm:gap-[16px] md:flex-row md:items-stretch">
        <ImageGallery
          key={`gallery-${expanded}`}
          images={urls}
          landscape
          captions={overlays}
          thumbLabels={shown.map((s) => s.photo.label)}
          initialIndex={start}
          onOpen={setZoom}
        />
        <MediaImageCarousel
          key={`carousel-${expanded}`}
          slides={urls.length > 0 ? urls : [undefined]}
          sizes="100vw"
          className="aspect-[4/3] w-full shrink-0 rounded-[10px] sm:hidden"
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

        {/* 오른쪽 칸 — 기본 정보(매장 유형 · 이름 · 주소 · 가까운 역 · 소개)와 맨 아래 매장 정보를 가는 선으로 나눈다
            (11-16 사용자: "매장 상세 팝업을 더 예쁘게"). 강조는 글자 크기 · 굵기만, 색은 은은하게. */}
        <div className="flex w-full min-w-0 flex-1 flex-col">
          <div className="flex flex-col items-start gap-[8px]">
            {/* 매체 정보 팝업의 카테고리 칩과 같은 모양 — 콜라보 › 매장 유형. 이름 위에 작게. */}
            <Chip className="gap-0 rounded-[8px] bg-tone-ededef py-[3px] text-[11px] leading-[16.5px] text-zinc-500">
              {PARTNERS_MEDIA_CATEGORY}
              <ChevronRightBoldIcon className="size-[16px] shrink-0" />
              {store.storeType || "매장"}
            </Chip>
            {/* p 가 아니라 div — 협약 확정 표시의 Tooltip · Popover 트리거가 div 로 그려진다(p 안 div 는 잘못된 HTML). */}
            <div className="text-[20px] leading-[28px] font-bold break-keep text-black max-sm:text-[17px] max-sm:leading-[24px]">
              {store.name}
              {/* 협업 확정 매장이면 이름 뒤에 작은 초록 표시(public/icons/collabo.svg, 11-16 사용자) — 영업 기록 매장(unconfirmed)엔 없다.
                  글자 없는 이음 문자(U+2060)로 이름 끝 글자와 붙여 표시만 다음 줄로 넘어가지 않게 한다. */}
              {!store.unconfirmed && (
                <>
                  {"\u2060"}
                  <AgreedMark />
                </>
              )}
            </div>

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

            {/* 소개(2~3줄) — 어드민이 적은 줄바꿈 그대로. */}
            {store.intro && (
              <p className="mt-[4px] text-[13px] leading-[21px] break-keep whitespace-pre-line text-zinc-600">
                {store.intro}
              </p>
            )}
          </div>

          {/* 매장 정보(운영 시간 · 규모 · 주요 고객층)는 소개 바로 아래, 가는 선 하나로 나눈다. */}
          {info.length > 0 && (
            <div className="mt-[18px] border-t border-tone-ececef pt-[16px] max-sm:mt-[16px]">
              <StoreInfoRows rows={info} />
            </div>
          )}
          {/* 콜라보 금액(광고주만)은 오른쪽 칸 맨 아래 — PC는 사진 칸 아래 끝(썸네일 줄)과 높이를 맞춘다. */}
          {showFee && (
            <div className="mt-[16px] md:mt-auto md:pt-[16px]">
              <CollabPriceBox
                grade={store.collabGrade ?? null}
                fee={store.collabFee ?? null}
              />
            </div>
          )}
        </div>
      </div>

      {/* 아래 — 가능 범위는 사진 · 기본 정보 아래 전체 폭, 항목 칸 PC 3열(11-17 사용자: "하단에 가능 범위와 콜라보 금액" →
          금액까지 내리니 오른쪽 칸 가운데가 비고 팝업이 길어져 "더 예쁘게" — 금액은 오른쪽 칸 맨 아래로 올렸다). */}
      {hasScope && (
        <div className="mt-[20px] border-t border-tone-ececef pt-[20px] max-sm:mt-[16px] max-sm:pt-[16px]">
          <ScopeRows scope={store.scope} />
        </div>
      )}
    </>
  );
}

/** 협약 확정 표시 — 초록 마크(public/icons/collabo.svg). 다크 모드는 success 토큰이 밝은 초록으로 바뀐다. */
const AGREED_ICON =
  "block h-[16px] w-[15px] bg-current text-success [mask:url(/icons/collabo.svg)_center/contain_no-repeat] max-sm:h-[14px] max-sm:w-[13px]";
const AGREED_LABEL = "협약 확정 매장";

/**
 * 매장 이름 뒤 협약 확정 표시 — 이름 줄 높이(1lh)의 가운데에 둔다(11-17 사용자: "매장명이랑 협약 확정 마크를 중간에 오게").
 * 마우스가 있으면 올려서 Tooltip(눌러도 닫히지 않게), 터치 기기는 눌러서 Popover로 "협약 확정 매장"(11-17 사용자) —
 * 인기 · 신규 표시(MediaBadgeChip)와 같은 갈래: 화면 폭이 아니라 입력 방식(useCanHover)으로 나눈다.
 * 말풍선은 HeroUI 기본 모양 — 라이트 · 다크 모드에 맞춰 바탕 · 글자색이 바뀐다.
 * 말풍선은 표시 오른쪽에(11-17 사용자: "오른쪽에 뜨게") — 자리가 모자라면 HeroUI가 알아서 반대쪽으로 뒤집는다.
 */
function AgreedMark() {
  const canHover = useCanHover();
  // Tooltip 은 올려야만 열린다 — 마우스로 눌러도 열리게 열림을 직접 쥔다(올렸다 떼면 닫힘은 Tooltip 그대로).
  const [tipOpen, setTipOpen] = useState(false);
  const trigger =
    "ml-[5px] inline-flex h-[1lh] cursor-pointer items-center rounded-[4px] align-top outline-none focus-visible:ring-2 focus-visible:ring-primary/40 max-sm:ml-[4px]";
  const icon = <span aria-hidden className={AGREED_ICON} />;
  if (canHover) {
    return (
      <Tooltip
        delay={0}
        closeDelay={0}
        shouldCloseOnPress={false}
        isOpen={tipOpen}
        onOpenChange={setTipOpen}
      >
        <Tooltip.Trigger
          aria-label={AGREED_LABEL}
          className={trigger}
          onPointerUp={() => setTipOpen(true)}
        >
          {icon}
        </Tooltip.Trigger>
        <Tooltip.Content
          showArrow
          placement="right"
          className="px-[10px] py-[6px] text-[12px] leading-[1.5] font-semibold whitespace-nowrap"
        >
          <Tooltip.Arrow />
          {AGREED_LABEL}
        </Tooltip.Content>
      </Tooltip>
    );
  }
  return (
    <Popover>
      <Popover.Trigger aria-label={AGREED_LABEL} className={trigger}>
        {icon}
      </Popover.Trigger>
      <Popover.Content placement="right" className="max-w-[240px]">
        <Popover.Dialog className="px-[12px] py-[8px] text-[13px] leading-[1.5] font-semibold whitespace-nowrap text-gray-900">
          {AGREED_LABEL}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
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

/** 묶음 — 작은 제목 아래 이름표 | 값 줄(이름표 열 너비를 맞춰 값이 한 줄로 읽히게). */
function InfoGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-[10px]">
      <h3 className="text-[13px] leading-[20px] font-bold text-zinc-900">
        {title}
      </h3>
      <dl className="grid grid-cols-[72px_minmax(0,1fr)] items-baseline gap-x-[12px] gap-y-[8px]">
        {children}
      </dl>
    </section>
  );
}

/** 매장 정보 — 운영 시간 · 규모 · 주요 고객층. 값이 길면 그 칸 안에서 줄을 바꾼다. 다 비면 그리지 않는다. */
function StoreInfoRows({ rows }: { rows: [string, string][] }) {
  if (rows.length === 0) return null;
  return (
    <InfoGroup title="매장 정보">
      {rows.map(([label, value]) => (
        <Fragment key={label}>
          <dt className="text-[12px] leading-[20px] text-zinc-500">{label}</dt>
          <dd className="text-[13px] leading-[20px] font-medium break-keep text-zinc-800">
            {value}
          </dd>
        </Fragment>
      ))}
    </InfoGroup>
  );
}

/** 가능 범위 칸 색 — 가능은 옅은 초록 칸 + 초록 체크, 불가능은 회색 칸 + 회색 엑스(빨강은 쓰지 않는다 — 은은하게). */
const SCOPE_TILE = {
  ok: {
    tile: "border-emerald-100 bg-emerald-50/50 dark:border-success/20 dark:bg-success-bg/60",
    mark: "bg-emerald-100 text-emerald-600 dark:bg-success/15 dark:text-success",
    label: "text-zinc-800",
    desc: "text-zinc-500",
  },
  no: {
    tile: "border-tone-ececef bg-tone-f7f7f8",
    mark: "bg-zinc-200/70 text-zinc-400 dark:bg-zinc-200",
    // 불가능도 설명은 읽혀야 한다 — 이름은 한 단계 진하게.
    label: "text-zinc-500",
    desc: "text-zinc-400",
  },
} as const;

/**
 * 가능 범위 — 항목마다 작은 칸(체크 · 엑스 + 이름 + 설명), 두 열로(11-17 사용자: "보기 좋게 리디자인, 각각 상세 설명도 —
 * 뭐가 뭔지 모를 수 있으니까. 예: 브랜딩 제작물 가능이면 '포스터, 소형 출력물'"). 설명은 COLLAB_SCOPE_ITEMS.desc(고르는 칸과 같은 글).
 * 가능한 항목을 먼저, 그다음 불가능. 제목 오른쪽에 "가능 n · 불가능 n"이 범례를 겸한다.
 * 고르지 않은 항목은 빼고, 다 비면 그리지 않는다.
 */
function ScopeRows({ scope }: { scope: CollabScope | undefined }) {
  const entries = scopeEntries(scope);
  if (entries.length === 0) return null;
  const sorted = COLLAB_SCOPE_VALUES.flatMap((v) =>
    entries.filter((e) => e.value === v),
  );
  const count = (v: (typeof COLLAB_SCOPE_VALUES)[number]) =>
    entries.filter((e) => e.value === v).length;
  return (
    <section className="flex flex-col gap-[10px]">
      <div className="flex items-baseline justify-between gap-[8px]">
        <h3 className="text-[13px] leading-[20px] font-bold text-zinc-900">
          가능 범위
        </h3>
        <p className="flex items-center gap-[6px] text-[12px] leading-[20px] text-zinc-400">
          {COLLAB_SCOPE_VALUES.filter((v) => count(v) > 0).map((v, i) => (
            <Fragment key={v}>
              {i > 0 && <span aria-hidden>·</span>}
              <span
                className={cn(
                  v === "ok" &&
                    "font-semibold text-emerald-600 dark:text-success",
                )}
              >
                {COLLAB_SCOPE_VALUE_LABEL[v]} {count(v)}
              </span>
            </Fragment>
          ))}
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-[6px] md:grid-cols-3">
        {sorted.map((e) => {
          const tone = SCOPE_TILE[e.value];
          const Mark = e.value === "ok" ? SmallCheckIcon : SmallXIcon;
          return (
            <li
              key={e.key}
              className={cn(
                "flex min-w-0 gap-[8px] rounded-[12px] border px-[10px] py-[9px]",
                tone.tile,
              )}
            >
              <span
                role="img"
                aria-label={COLLAB_SCOPE_VALUE_LABEL[e.value]}
                className={cn(
                  "mt-[1px] flex size-[18px] shrink-0 items-center justify-center rounded-full",
                  tone.mark,
                )}
              >
                <Mark className="size-[11px]" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span
                  className={cn(
                    "text-[13px] leading-[20px] font-semibold break-keep",
                    tone.label,
                  )}
                >
                  {e.label}
                </span>
                <span
                  className={cn(
                    "text-[11.5px] leading-[17px] break-keep",
                    tone.desc,
                  )}
                >
                  {e.desc}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
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
