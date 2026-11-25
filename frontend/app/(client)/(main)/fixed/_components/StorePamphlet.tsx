"use client";

import { Chip, Modal, Skeleton, Tabs } from "@heroui/react";
import { Fragment, useState, type ReactNode } from "react";

import { ImageLightbox } from "@/components/common/ImageLightbox";
import { MediaThumbnail } from "@/components/common/MediaThumbnail";
import { SkeletonLoading } from "@/components/common/SkeletonLoading";
import { MediaLocationMapModal } from "@/components/common/media-detail/MediaLocationMapModal";
import { NearbyStations } from "@/components/common/media-detail/NearbyStations";
import type { MediaDetailViewModel } from "@/components/common/media-detail/useMediaDetailViewModel";
import {
  ChevronRightBoldIcon,
  CloseMediumIcon,
  LocationFilledIcon,
  SmallCheckIcon,
  SmallXIcon,
} from "@/components/icons";
import {
  ADMIN_ONLY_PHOTO_KINDS,
  COLLAB_SCOPE_ITEMS,
  COLLAB_SCOPE_VALUE_LABEL,
  COLLAB_SCOPE_VALUES,
  type CollabScope,
  type CollabScopeValue,
  type PartnersStore,
  PARTNERS_MEDIA_CATEGORY,
  PHOTO_KIND_LABEL,
  PHOTO_KINDS,
  photoKindLabel,
} from "@/lib/partners";
import { cn } from "@/lib/utils";

import { GradeBox } from "./collabPick";
import {
  AgreedMark,
  PhotoCaption,
  SCOPE_TILE,
  type StorePhotoView,
} from "./storeDetailParts";

/*
 * 콜라보 매장 정보 팝업 — 팜플렛(2026-11-24 사용자: "매장 정보 팝업의 형태와 내용의 UI를 아예 바꾸려고 해. 팜플렛처럼 보여졌으면").
 * 콜라보 화면(매장 찾기 · 관심 매장 · 기획안 지정 매장)에서 뜬다. admix 매체 찾기의 간단히 보기는 예전 틀(StoreDetailModal) 그대로.
 *
 * 3단으로 접힌 리플렛을 펼친 모양 — PC는 세 칸을 나란히, 칸 사이는 가는 선(11-24 사용자 "영역 안에 있는 그림자 없애줘" — 처음엔 선 + 안쪽으로 옅어지는 접힌 그림자).
 * 태블릿 · 휴대폰은 칸을 위아래로 쌓는다(접힌 자리는 위쪽에).
 *  1. 표지 — "콜라보 › 카페" 칩(11-24 사용자 "카테고리를 Chip으로") · 이름(협약 확정 표시) · 썸네일 사진 · 소개,
 *     맨 아래 주소(누르면 위치 지도) · 가까운 역. 썸네일은 매장 사진과 따로 받을 사진 — 아직 없어 자리만 비워 둔다
 *     (11-24 사용자: "첫 장엔 외관 사진이 아닌 썸네일 사진이 들어갈 건데 지금은 없으니 영역만 표시하고 비워줘").
 *  2. 매장 둘러보기 — 분류 탭(전체 + 사진 있는 분류) → 큰 사진 → 그 탭 사진 작은 줄(11-24 사용자: "사진이 없으면 휑해 보일 것
 *     같은데, 탭으로 분류를 나눠서 전체 보게" — 잠깐 분류 여섯 자리 2열 3줄 바둑판이었다).
 *  3. 매장 정보(운영 시간 · 규모 · 주요 고객층) | 콜라보 가능 범위(체크 목록) | 맨 아래 콜라보 금액(광고주만) — 서로 구분되게
 *     (11-24 사용자 "매장 정보와 가능 범위, 금액은 서로 구분이 되게"): 정보 · 범위 사이는 가는 선, 금액은 옅은 회색 판.
 *     금액은 가안 — 하루 기준 · 3일 · 7일 · 한 달(FEE_PLANS).
 * 세 칸 · 자리는 늘 같다 — 사진 · 매장 정보가 아직 없어도 자리는 그리고 값만 비운다(11-24 사용자: "입력되어 있지 않아도
 * 영역은 뜨게 해줘. 대신 값을 비워줘" — 처음엔 빈 칸을 빼고 팝업 폭을 줄였다). 사진이 하나도 없으면 탭 없이 큰 사진 자리만 빈 칸.
 * 매장 정보 세 줄은 이름표 옆에 흐린 "-", 가능 범위 여섯 항목은 고르지 않은 항목도 흐리게(미정) 이름 · 설명만.
 * 휴대폰은 3번(정보)을 사진 칸보다 먼저 — 한 손으로 내려 볼 때 정보가 먼저 나오게.
 * 강조는 글자 크기 · 굵기로만, 색은 은은하게. 선 · 장식은 줄이고 여백으로 나눈다(11-24 "깔끔한 느낌이 없어").
 */

/** 팜플렛 사진 자리 — 광고주에게 보이는 분류 순(메뉴는 어드민 전용). 모두 매장 둘러보기 칸에. */
const PHOTO_SLOTS = PHOTO_KINDS.filter(
  (k) => !ADMIN_ONLY_PHOTO_KINDS.includes(k),
);
type PhotoSlot = { label: string; photos: StorePhotoView[] };

/**
 * 분류 자리마다 사진 — 대표 사진이 맨 앞. 없는 분류는 빈 자리.
 * 분류 정보가 없는 예전 사진(imageUrls 만)은 첫 장을 외관, 나머지를 기타로 둔다.
 */
function photoSlots(store: PartnersStore): PhotoSlot[] {
  const byKind = new Map<string, StorePhotoView[]>();
  const photos = store.images ?? [];
  if (photos.length > 0) {
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
  } else if (store.imageUrls.length > 0) {
    const [first, ...rest] = store.imageUrls;
    byKind.set("exterior", [{ url: first, label: PHOTO_KIND_LABEL.exterior }]);
    if (rest.length > 0)
      byKind.set(
        "etc",
        rest.map((url) => ({ url, label: PHOTO_KIND_LABEL.etc })),
      );
  }
  return PHOTO_SLOTS.map((kind) => ({
    label: PHOTO_KIND_LABEL[kind],
    photos: byKind.get(kind) ?? [],
  }));
}

/** 매장 정보 세 줄 — 값이 없으면 null(이름표 옆에 흐린 "-"). 전화번호 · 사장님은 뺐다(11-17 사용자). */
const infoRows = (store: PartnersStore): [string, string | null][] => [
  ["운영 시간", store.businessHours?.trim() || null],
  ["규모", store.seats != null ? `좌석 ${store.seats}석` : null],
  ["주요 고객층", store.mainCustomers?.trim() || null],
];

export function StorePamphletModal({
  store,
  vm,
  isError,
  showFee,
  showScope,
  footer,
  onClose,
}: {
  /** 매장 · 매체 상세를 다 받기 전엔 비어 있다(뼈대). */
  store: PartnersStore | undefined;
  vm: MediaDetailViewModel | null;
  isError: boolean;
  /** 광고주만 — 아니면 금액 칸을 그리지 않는다. */
  showFee: boolean;
  /** 가능 범위 — 광고주가 아닌 회원의 간단히 보기엔 없다. */
  showScope: boolean;
  footer: ReactNode;
  onClose: () => void;
}) {
  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      variant="opaque"
    >
      <Modal.Container
        placement="center"
        // 세 칸 1100px(한 칸 ~360px), PC 아래는 쌓아서 600px.
        className="sm:w-full sm:max-w-[600px] sm:p-[20px] lg:max-w-[1100px]"
      >
        {/* 종이 한 장 — 모서리는 조금만 둥글게, 바깥 그림자는 매체 정보 팝업과 같다. */}
        <Modal.Dialog
          aria-label="매장 상세"
          className="relative w-full max-w-full gap-0 overflow-hidden rounded-[14px] bg-surface p-0 shadow-[0px_4px_60px_0px_rgba(0,0,0,0.25)]"
        >
          {/* 닫기는 종이 위에 붙어 같이 올라간다 — 휴대폰에서 내려 볼 때 글을 가리지 않게(아래 버튼 줄에도 닫기가 있다). */}
          <Modal.Body className="relative m-0 p-0">
            <Modal.CloseTrigger className="top-[16px] right-[16px] z-10 size-[28px] rounded-[11px] border border-tone-ececef bg-tone-eaeaeb p-0 text-tone-70707a">
              <CloseMediumIcon className="size-[24px]" />
            </Modal.CloseTrigger>
            {store ? (
              <PamphletSheet
                store={store}
                vm={vm}
                showFee={showFee}
                showScope={showScope}
              />
            ) : isError ? (
              <p className="px-[24px] py-[72px] text-center text-[14px] font-semibold break-keep text-gray-600">
                지금은 매장 정보를 볼 수 없어요. 비공개로 바뀌었거나 콜라보를
                쉬는 매장일 수 있어요.
              </p>
            ) : (
              <PamphletSkeleton />
            )}
          </Modal.Body>

          {footer && (
            <Modal.Footer className="mt-0 gap-[8px] border-t border-gray-100 px-[20px] py-[14px] max-sm:px-[16px] max-sm:py-[12px]">
              {footer}
            </Modal.Footer>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function PamphletSheet({
  store,
  vm,
  showFee,
  showScope,
}: {
  store: PartnersStore;
  vm: MediaDetailViewModel | null;
  showFee: boolean;
  showScope: boolean;
}) {
  return (
    <div className="grid lg:grid-cols-3">
      <CoverPanel store={store} vm={vm} />

      <Panel fold className="max-lg:order-last">
        <PhotoBrowser slots={photoSlots(store)} />
      </Panel>

      {/* PC에서 닫기 버튼은 이 칸 위 — 첫 제목 줄 오른쪽을 비운다(inset). */}
      <Panel fold>
        <section>
          <PanelTitle title="매장 정보" inset />
          <dl className="mt-[14px] grid grid-cols-[76px_minmax(0,1fr)] gap-x-[12px] gap-y-[10px]">
            {infoRows(store).map(([label, value]) => (
              <Fragment key={label}>
                <dt className="text-[13px] leading-[20px] text-gray-500">
                  {label}
                </dt>
                {/* 값이 없으면 흐린 "-"(11-24 사용자 "빈값보단 흐린 - 이걸 넣어줘" — 처음엔 값 칸을 비웠다). */}
                <dd className="text-[13px] leading-[20px] font-medium break-keep text-gray-900">
                  {value ?? (
                    <span className="text-gray-300" aria-label="정보 없음">
                      -
                    </span>
                  )}
                </dd>
              </Fragment>
            ))}
          </dl>
        </section>
        {showScope && (
          <ScopeList
            scope={store.scope}
            fill={showFee}
            className={cn("mt-[24px]", DIVIDER)}
          />
        )}
        {/* 금액은 칸 맨 아래 — 사진 칸 · 표지 아래 끝과 맞춘다. PC는 가능 범위 목록이 늘어나 그 사이를 채운다. */}
        {showFee && (
          <div className="mt-auto pt-[24px]">
            <FeePlans grade={store.collabGrade ?? null} />
          </div>
        )}
      </Panel>
    </div>
  );
}

/** 한 칸(접힌 면) — fold 면 앞 칸과 사이에 가는 선. PC는 왼쪽, 쌓으면 위쪽. */
function Panel({
  fold = false,
  className,
  children,
}: {
  fold?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "relative flex min-w-0 flex-col p-[24px] max-sm:p-[20px] lg:p-[32px]",
        fold && "border-t border-gray-100 lg:border-t-0 lg:border-l",
        className,
      )}
    >
      {children}
    </section>
  );
}

/**
 * 칸 안 제목 — 굵은 작은 글, 오른쪽 끝에 짧은 덧말(11-24 사용자 "깔끔한 느낌이 없어" — 제목 뒤 가는 선을 뺐다).
 * inset 은 PC 맨 오른쪽 칸 첫 제목 — 닫기 버튼 자리만큼 오른쪽을 비운다.
 */
function PanelTitle({
  title,
  note,
  inset = false,
}: {
  title: string;
  note?: ReactNode;
  inset?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-[10px]",
        inset && "lg:pr-[36px]",
      )}
    >
      <h3 className="shrink-0 text-[14px] leading-[20px] font-bold text-gray-900">
        {title}
      </h3>
      {note && (
        <span className="shrink-0 text-[12px] leading-[20px] text-gray-500">
          {note}
        </span>
      )}
    </div>
  );
}

/** 표지 — 유형 · 이름 · 대표 사진 · 소개, 맨 아래 주소 · 가까운 역. */
function CoverPanel({
  store,
  vm,
}: {
  store: PartnersStore;
  vm: MediaDetailViewModel | null;
}) {
  // 닫기 버튼 자리 — 쌓인 화면에선 표지가 맨 위라 오른쪽을 비운다.
  const pad = "max-lg:pr-[40px]";
  const [mapOpen, setMapOpen] = useState(false);
  const address = [store.address, store.addressDetail]
    .filter(Boolean)
    .join(" ");
  const location =
    store.latitude != null && store.longitude != null
      ? { lat: store.latitude, lng: store.longitude }
      : null;
  const stations = vm?.nearbyStations ?? [];

  return (
    <Panel>
      {/* 매체 정보 팝업의 카테고리 칩과 같은 모양 — 콜라보 › 매장 유형. */}
      <div className={pad}>
        <Chip className="gap-0 rounded-[8px] bg-tone-ededef py-[3px] text-[11px] leading-[16.5px] text-zinc-500">
          {PARTNERS_MEDIA_CATEGORY}
          <ChevronRightBoldIcon className="size-[16px] shrink-0" />
          {store.storeType || "매장"}
        </Chip>
      </div>
      {/* div — 협약 확정 표시의 Tooltip · Popover 트리거가 div 로 그려진다(제목 태그 안 div 는 잘못된 HTML). */}
      <div
        role="heading"
        aria-level={2}
        className={cn(
          "mt-[10px] text-[28px] leading-[1.3] font-bold tracking-[-0.03em] break-keep text-gray-900 max-sm:text-[24px]",
          pad,
        )}
      >
        {store.name}
        {/* 협업 확정 매장이면 이름 뒤 초록 표시 — 이음 문자(U+2060)로 끝 글자와 붙여 표시만 다음 줄로 넘어가지 않게. */}
        {!store.unconfirmed && (
          <>
            {"⁠"}
            <AgreedMark />
          </>
        )}
      </div>

      {/* 썸네일 사진 자리 — 아직 받는 칸이 없어 비워 둔다(11-24 사용자). */}
      <div aria-hidden className="mt-[18px] aspect-[4/3] w-full rounded-[8px] bg-gray-50" />

      {store.intro && (
        <p className="mt-[18px] text-[14px] leading-[1.75] break-keep whitespace-pre-line text-gray-600">
          {store.intro}
        </p>
      )}

      {/* 주소 · 가까운 역 — 표지 맨 아래(리플렛 뒷면 연락처 자리처럼). */}
      <div className="mt-auto pt-[28px]">
        <div className="flex flex-col gap-[8px]">
          {location ? (
            <button
              type="button"
              onClick={() => setMapOpen(true)}
              className="group flex items-start gap-[4px] text-left"
            >
              <LocationFilledIcon className="mt-[2px] size-[14px] shrink-0 text-gray-500 group-hover:text-gray-900" />
              <span className="text-[13px] leading-[18px] break-keep text-gray-700 underline decoration-gray-300 underline-offset-[3px] group-hover:text-gray-900">
                {address || "지도에서 위치 보기"}
              </span>
            </button>
          ) : (
            <div className="flex items-start gap-[4px]">
              <LocationFilledIcon className="mt-[2px] size-[14px] shrink-0 text-gray-500" />
              <span className="text-[13px] leading-[18px] break-keep text-gray-700">
                {address || "-"}
              </span>
            </div>
          )}
          <NearbyStations stations={stations} />
        </div>
      </div>
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
    </Panel>
  );
}

/**
 * 매장 둘러보기 — 분류 탭(전체 + 사진 있는 분류, 장 수) → 큰 사진 한 장(왼쪽 아래 분류 이름, 누르면 크게 보기)
 * → 그 탭 사진 작은 줄(3칸, 다 펼침). 작은 사진을 누르면 큰 사진이 바뀐다
 * (고른 장은 그대로, 나머지는 흐리게 — 매체 정보 팝업과 같다). 탭은 내 매장 사진첩(StoreFront)과 같은 HeroUI 탭.
 * 사진이 하나도 없으면 탭 · 작은 줄 없이 큰 사진 자리만 빈 칸.
 */
function PhotoBrowser({ slots }: { slots: PhotoSlot[] }) {
  const all = slots.flatMap((s) => s.photos);
  const kinds = slots.filter((s) => s.photos.length > 0);
  const [tab, setTab] = useState("all");
  const shown =
    tab === "all" ? all : (kinds.find((k) => k.label === tab)?.photos ?? all);
  const [index, setIndex] = useState(0);
  const current = shown[Math.min(index, shown.length - 1)];
  const [zoom, setZoom] = useState<number | null>(null);
  const tabs = [
    { id: "all", label: "전체", count: all.length },
    ...kinds.map((k) => ({
      id: k.label,
      label: k.label,
      count: k.photos.length,
    })),
  ];

  return (
    <>
      {/* 사진 장 수는 쓰지 않는다 — 전체 탭에 이미 있다(11-24 사용자 "사진 n장 이건 없애줘"). */}
      <PanelTitle title="매장 둘러보기" />
      {all.length > 0 && (
        <Tabs
          selectedKey={tab}
          onSelectionChange={(key) => {
            setTab(String(key));
            setIndex(0);
          }}
          className="mt-[14px]"
        >
          {/* 칸 폭을 넘으면 좌우로 넘긴다(HeroUI 기본 — 끝에 흐림 · 화살표). 11-24 사용자 "탭은 좌우로 스크롤이 되게" —
              잠깐 다음 줄로 넘기기였다. */}
          <Tabs.ListContainer className="w-fit max-w-full overflow-x-auto rounded-[14px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Tabs.List aria-label="사진 분류">
              {tabs.map((t) => (
                <Tabs.Tab
                  key={t.id}
                  id={t.id}
                  className="gap-[3px] rounded-[11px] px-[10px] text-[12px] whitespace-nowrap"
                >
                  {t.label}
                  <span className="text-[11px] opacity-60">{t.count}</span>
                  <Tabs.Indicator className="rounded-[11px]" />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      )}

      <div className="mt-[12px]">
        {current ? (
          <button
            type="button"
            aria-label={`${current.label ?? "사진"} 크게 보기`}
            onClick={() => setZoom(Math.min(index, shown.length - 1))}
            className="group relative block w-full cursor-zoom-in overflow-hidden rounded-[8px] outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <MediaThumbnail
              src={current.url}
              sizes="(max-width: 1023px) 100vw, 360px"
              eager
              className="aspect-[4/3] w-full"
              imageClassName="group-hover:scale-[1.03]"
            />
            {current.label && (
              <span className="pointer-events-none absolute bottom-[8px] left-[8px] rounded-[6px] bg-black/55 px-[6px] text-[11px] leading-[18px] font-semibold text-white">
                {current.label}
              </span>
            )}
          </button>
        ) : (
          <div
            aria-hidden
            className="aspect-[4/3] w-full rounded-[8px] bg-gray-50"
          />
        )}
      </div>

      {/* 작은 사진은 다 펼쳐 보인다(11-24 사용자 "영역이 중간에 잘렸어" — 두 줄 높이로 자르고 안에서 스크롤했었다).
          한 줄 3칸(11-24 사용자 "작은 이미지들의 사이즈를 더 키워줘" — 처음엔 4칸). */}
      {shown.length > 1 && (
        <ul className="mt-[8px] grid grid-cols-3 gap-[8px]">
          {shown.map((p, i) => {
            const on = i === Math.min(index, shown.length - 1);
            return (
              <li key={p.url}>
                <button
                  type="button"
                  aria-label={`${i + 1}번째 사진`}
                  aria-pressed={on}
                  onClick={() => setIndex(i)}
                  className={cn(
                    "block w-full overflow-hidden rounded-[6px] transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    !on && "opacity-50 hover:opacity-100",
                  )}
                >
                  <MediaThumbnail
                    src={p.url}
                    sizes="(max-width: 1023px) 33vw, 120px"
                    className="aspect-[4/3] w-full"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {zoom != null && (
        <ImageLightbox
          images={shown.map((p) => p.url)}
          initialIndex={zoom}
          captions={shown.map((p) => <PhotoCaption key={p.url} photo={p} />)}
          onClose={() => setZoom(null)}
        />
      )}
    </>
  );
}

/**
 * 콜라보 가능 범위 — 여섯 항목 체크 목록(가능 먼저, 불가능, 고르지 않은 항목 순). 줄마다 표시 · 이름, 바로 옆에 짧은 설명.
 * 고르지 않은 항목은 줄째 흐리게 + 점선 동그라미(11-24 사용자 "값이 없을 경우엔 흐리게" — 처음엔 빈 동그라미만).
 * 제목 줄 끝 "가능 n · 불가능 n · 미정 n"이 범례를 겸한다.
 */
function ScopeList({
  scope,
  fill = false,
  className,
}: {
  scope: CollabScope | undefined;
  /** PC에서 칸 남는 높이만큼 목록 줄 사이를 벌려 아래 금액 판까지 채운다. */
  fill?: boolean;
  className?: string;
}) {
  const items = COLLAB_SCOPE_ITEMS.map((it) => ({
    ...it,
    value: scope?.[it.key],
  }));
  const order = (v: CollabScopeValue | undefined) =>
    v === "ok" ? 0 : v === "no" ? 1 : 2;
  const sorted = [...items].sort((a, b) => order(a.value) - order(b.value));
  const count = (v: CollabScopeValue | undefined) =>
    items.filter((e) => e.value === v).length;
  // 범례 — 가능 · 불가능 · 미정(값 없는 항목) 중 있는 것만.
  const legend = [...COLLAB_SCOPE_VALUES, undefined].filter(
    (v) => count(v) > 0,
  );
  return (
    <section className={cn(className, fill && "lg:flex lg:flex-1 lg:flex-col")}>
      <PanelTitle
        title="콜라보 가능 범위"
        note={legend.map((v, i) => (
          <Fragment key={v ?? "unset"}>
            {i > 0 && <span aria-hidden> · </span>}
            <span
              className={cn(
                v === "ok" && "font-semibold text-emerald-600 dark:text-success",
                !v && "text-gray-400",
              )}
            >
              {v ? COLLAB_SCOPE_VALUE_LABEL[v] : SCOPE_UNSET_LABEL} {count(v)}
            </span>
          </Fragment>
        ))}
      />
      {/* PC는 목록이 남는 높이를 채운다 — 줄 사이를 고르게 벌려 금액 판 위와 끝을 맞춘다(11-24 사용자 "PC에서 콜라보 가능 범위가
          리스트 높이를 맞춰줬으면" — 목록 아래가 비어 보였다). 사진이 아주 많아 칸이 길면 너무 벌어지지 않게 높이 상한. */}
      <ul
        className={cn(
          "mt-[12px] flex flex-col gap-[10px]",
          fill && "lg:max-h-[320px] lg:flex-1 lg:justify-between",
        )}
      >
        {sorted.map((e) => {
          const tone = e.value ? SCOPE_TILE[e.value] : null;
          const Mark = e.value === "ok" ? SmallCheckIcon : SmallXIcon;
          return (
            // 값이 없는 항목은 줄째 흐리게(11-24 사용자 "가능 범위 값이 없을 경우엔 흐리게 한다던지").
            <li
              key={e.key}
              className={cn("flex items-start gap-[10px]", !e.value && "opacity-45")}
            >
              {e.value && tone ? (
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
              ) : (
                // 미정 — 점선 동그라미 가운데 짧은 줄.
                <span
                  role="img"
                  aria-label={SCOPE_UNSET_LABEL}
                  className="mt-[1px] flex size-[18px] shrink-0 items-center justify-center rounded-full border border-dashed border-gray-400"
                >
                  <span className="h-[1.5px] w-[7px] rounded-full bg-gray-400" />
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-[6px]">
                <span
                  className={cn(
                    "text-[13px] leading-[20px] font-semibold break-keep",
                    tone?.label ?? "text-zinc-600",
                  )}
                >
                  {e.label}
                </span>
                <span
                  className={cn(
                    "text-[12px] leading-[20px] break-keep",
                    tone?.desc ?? "text-zinc-400",
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

/** 가능 범위에서 값을 고르지 않은 항목 이름(범례 · 표시 읽기). */
const SCOPE_UNSET_LABEL = "미정";

/**
 * 마지막 장 묶음 사이 — 가는 선 위로 여백(11-24 사용자 "서로 구분이 되게").
 * 휴대폰은 선을 칸 끝까지 — 칸 사이 선(전체 폭)과 같은 길이로 맞춘다(11-24 사용자 "분리한 선을 모바일로 보면 어색해" —
 * 칸 사이는 전체 폭, 이 선만 안쪽 폭이라 들쭉날쭉했다). 휴대폰 칸 안 여백(20px)만큼 밖으로.
 */
const DIVIDER =
  "border-t border-gray-100 pt-[24px] max-sm:-mx-[20px] max-sm:px-[20px]";

/**
 * 콜라보 금액 가안(11-24 사용자: "최소 3일, 하루 기준 금액을 작게, 3일 · 7일 · 한 달 여러 금액, 7일은 10% 할인 · 한 달은 15% 할인 —
 * 일단 가안으로, 전체 매장 하루 50만 원"). 매장별 금액(collabFee)은 아직 쓰지 않는다. 한 달은 30일로 셈한다.
 */
const DRAFT_DAY_FEE = 500_000;
const FEE_PLANS = [
  { label: "3일", days: 3, off: 0 },
  { label: "7일", days: 7, off: 10 },
  { label: "한 달", days: 30, off: 15 },
] as const;

/**
 * 콜라보 금액 — 옅은 회색 판 안에 제목 줄(등급 · 오른쪽 끝 "하루 500,000원 · 최소 3일"), 아래 기간별 금액 줄(할인은 작은 이름표).
 * 11-24 처음엔 1건 금액 한 줄(점선 쿠폰 칸 → 옅은 회색 판 → 묶음 사이 선 → 다시 회색 판)이었다.
 */
function FeePlans({ grade }: { grade: Parameters<typeof GradeBox>[0]["grade"] }) {
  return (
    // 옅은 회색 판(11-24 사용자 "콜라보 금액은 그 전 UI처럼 배경 있는 게 좋은 것 같아") — 판이 위 묶음과 나눠 주니 가는 선은 없다.
    <section className="rounded-[12px] bg-gray-50 px-[16px] py-[14px]">
      <div className="flex items-baseline justify-between gap-[10px]">
        <span className="flex items-center gap-[6px]">
          <h3 className="text-[14px] leading-[20px] font-bold text-gray-900">
            콜라보 금액
          </h3>
          <GradeBox grade={grade} />
        </span>
        <span className="text-[12px] leading-[20px] whitespace-nowrap text-gray-500">
          하루 {DRAFT_DAY_FEE.toLocaleString()}원 · 최소 3일
        </span>
      </div>
      <dl className="mt-[12px] flex flex-col gap-[8px]">
        {FEE_PLANS.map((p) => (
          <div
            key={p.label}
            className="flex items-center justify-between gap-[12px] whitespace-nowrap"
          >
            <dt className="flex items-center gap-[6px] text-[13px] leading-[20px] text-gray-600">
              {p.label}
              {p.off > 0 && (
                <span className="rounded-[6px] bg-primary-100 px-[6px] text-[11px] leading-[18px] font-semibold text-primary-700">
                  {p.off}% 할인
                </span>
              )}
            </dt>
            <dd className="text-[15px] leading-[22px] font-bold text-gray-900">
              {((DRAFT_DAY_FEE * p.days * (100 - p.off)) / 100).toLocaleString()}
              원
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** 불러오는 동안 — 세 칸 뼈대(쌓인 화면은 표지 칸만). */
function PamphletSkeleton() {
  return (
    <SkeletonLoading>
      <div className="grid lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              "flex flex-col gap-[12px] p-[28px] max-sm:p-[20px]",
              i > 0 && "border-l border-gray-100 max-lg:hidden",
            )}
          >
            <Skeleton className="h-[14px] w-[40%] rounded-[6px]" />
            <Skeleton className="h-[30px] w-[70%] rounded-[6px]" />
            <Skeleton className="aspect-[4/3] w-full rounded-[6px]" />
            <Skeleton className="h-[14px] w-full rounded-[6px]" />
            <Skeleton className="h-[14px] w-[80%] rounded-[6px]" />
          </div>
        ))}
      </div>
    </SkeletonLoading>
  );
}
