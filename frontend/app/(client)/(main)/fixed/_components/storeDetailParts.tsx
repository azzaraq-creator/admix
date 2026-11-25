"use client";

import { Popover, Tooltip } from "@heroui/react";
import { useState } from "react";

import { useCanHover } from "@/hooks/useCanHover";
import { type PartnersStore, photoKindLabel } from "@/lib/partners";

/*
 * 매장 정보 팝업 두 갈래가 같이 쓰는 조각 — admix 매체 찾기의 간단히 보기(StoreDetailModal, 매체 정보 팝업과 같은 틀)와
 * 콜라보 화면의 팜플렛(StorePamphlet, 11-24 사용자: "팜플렛처럼 보여졌으면").
 */

/**
 * 매장 정보 줄(이름 ― 값) — 값이 없는 줄은 빼고, 다 없으면 묶음째 그리지 않는다(11-16 사용자: "더 예쁘게" —
 * 영업 기록 매장은 아직 다 비어 "-" 줄만 남았다). 전화번호 · 사장님은 뺐다(11-17 사용자). 줄 앞 아이콘은 없다(11-16 "아이콘은 빼줘").
 */
export const storeRows = (store: PartnersStore): [string, string][] =>
  (
    [
      ["운영 시간", store.businessHours],
      ["규모", store.seats != null ? `좌석 ${store.seats}석` : null],
      ["주요 고객층", store.mainCustomers],
    ] as [string, string | null | undefined][]
  ).filter((r): r is [string, string] => !!r[1]?.trim());

export type StorePhotoView = { url: string; label?: string; memo?: string };

/**
 * 분류별 사진 묶음 — 분류 순(서버 순서), 묶음마다 대표 사진이 맨 앞. 분류 정보가 없는 예전 사진은 한 장씩 따로.
 * 메뉴 사진은 서버가 광고주 · 제휴사에게 내보내지 않는다.
 */
export function photoGroups(store: PartnersStore): StorePhotoView[][] {
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
export function AgreedMark() {
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

/** 크게 보기 왼쪽 위 — 분류 이름 + 그 오른쪽 설명. */
export function PhotoCaption({ photo }: { photo: StorePhotoView }) {
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

/** 가능 범위 색 — 가능은 옅은 초록 칸 + 초록 체크, 불가능은 회색 칸 + 회색 엑스(빨강은 쓰지 않는다 — 은은하게). */
export const SCOPE_TILE = {
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
