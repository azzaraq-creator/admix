"use client";

import { Button } from "@heroui/react";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { FixedMediaView } from "@/app/(client)/(main)/fixed/_components/FixedMediaView";
import type {
  CollabPick,
  MediaFindOnly,
} from "@/app/(client)/(main)/fixed/_components/collabPick";
import type { MoveTarget } from "@/app/(client)/(main)/fixed/_components/mapTypes";
import { LoadingState } from "@/components/common/RouteStates";
import type { MediaCardRow } from "@/hooks/media";
import { usePartnersStores } from "@/hooks/partners";
import { refOfStore } from "@/lib/advertiserPreview";
import { PARTNERS_MEDIA_CATEGORY, type PartnersStore } from "@/lib/partners";

import { advActions, useAdvState } from "./advStore";
import { ADV_NEW_HREF, eulReul, say } from "./advUi";

/*
 * /partners/find (광고주) — admix 매체 찾기 화면(목록 + 지도 · 검색 · 인구 분포 · 실시간 인구)을 그대로 쓰고
 * 콜라보 매장만 보이게 한다(11-09 사용자: "매체 찾기와 동일하게, 지도도 보여 주고 매장만").
 * 카드 · 지도 말풍선에 등급 · 1건 금액(어드민이 정한 값, 067)과 담기. 담은 매장은 의뢰서의 "지정 희망 매장"이 된다.
 * 카드를 누르면 매장 상세가 새 탭으로(매체 찾기에서 콜라보 매장을 누를 때와 같다).
 *
 * 매체 찾기 카드는 매체 ID(CF-0001)로 오고, 등급 · 금액은 콜라보 매장 목록(광고주에게만 금액이 내려온다)에서
 * 매체 ID로 찾아 붙인다.
 *
 * 콜라보 화면 본문 칸(가운데 1120px · 여백)을 쓰지 않고 본문 전체를 채운다 — 본문(main)이 relative 라 absolute inset-0.
 * 모바일 아래 탭 바 높이는 매체 찾기가 쓰는 --tabbar-space 로 넘긴다.
 */

/**
 * 처음 지도 위치 — 매체 찾기는 강남역에서 시작하지만, 콜라보 매장은 아직 몇 곳뿐이라 그 자리에 매장이 없으면
 * 빈 지도가 된다. 지도에 나오는 매장(매체 ID · 좌표가 있는 공개 매장)이 모두 들어오는 가운데 · 레벨로 연다.
 * 레벨은 모바일 지도 폭(약 350px)에 맞춰 어림한다 — 카카오 지도 레벨 4에서 1px ≈ 경도 0.000023° · 위도 0.000018°,
 * 레벨이 하나 오를 때마다 두 배. 너무 멀어지지 않게 레벨 4 ~ 12.
 */
function initialViewOf(stores: PartnersStore[]): MoveTarget | undefined {
  const pts = stores.filter(
    (s) => s.mediaId && s.latitude != null && s.longitude != null,
  );
  if (!pts.length) return undefined;
  const lats = pts.map((s) => s.latitude as number);
  const lngs = pts.map((s) => s.longitude as number);
  const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];
  const [minLng, maxLng] = [Math.min(...lngs), Math.max(...lngs)];
  const ratio = Math.max(
    (maxLng - minLng) / (280 * 0.000023),
    (maxLat - minLat) / (400 * 0.000018),
  );
  const level =
    ratio <= 1 ? 4 : Math.min(12, 4 + Math.ceil(Math.log2(ratio)));
  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2, level };
}

/** 탭 줄 오른쪽 — 담은 매장이 있으면 의뢰서로. */
function CartButton({ count }: { count: number }) {
  const router = useRouter();
  if (!count) return null;
  return (
    <Button
      size="sm"
      onPress={() => router.push(ADV_NEW_HREF)}
      className="h-[34px] gap-[4px] rounded-[14px] px-[12px] text-[13px] font-bold max-sm:h-[30px] max-sm:rounded-[12px] max-sm:px-[10px] max-sm:text-[12px]"
    >
      <span className="max-sm:hidden">담은 매장</span>
      {count}곳 · 의뢰하기
      <ArrowRight className="size-[14px]" />
    </Button>
  );
}

export function AdvStoreFinder() {
  const state = useAdvState();
  const { data: stores, isLoading } = usePartnersStores({});

  const byMedia = useMemo(
    () =>
      new Map(
        (stores ?? [])
          .filter((s) => s.mediaId)
          .map((s) => [s.mediaId as string, s]),
      ),
    [stores],
  );
  const cartIds = useMemo(
    () => new Set(state.cart.map((s) => s.id)),
    [state.cart],
  );

  const initialView = useMemo(() => initialViewOf(stores ?? []), [stores]);

  const only = useMemo<MediaFindOnly>(
    () => ({
      category: PARTNERS_MEDIA_CATEGORY,
      label: "콜라보 매장",
      initialView,
      toolbar: <CartButton count={state.cart.length} />,
      pickOf: (row: MediaCardRow): CollabPick | undefined => {
        const store = byMedia.get(row.id);
        if (!store) return undefined;
        const ref = refOfStore(store);
        const picked = cartIds.has(store.id);
        return {
          grade: ref.grade,
          fee: ref.fee,
          picked,
          onToggle: () => {
            advActions.toggleCart(ref);
            say(
              picked
                ? `${eulReul(store.name)} 뺐어요.`
                : `${eulReul(store.name)} 담았어요.`,
            );
          },
        };
      },
    }),
    [byMedia, cartIds, state.cart.length, initialView],
  );

  // 처음 지도 위치를 매장 자리로 잡으려면 매장 목록이 먼저 있어야 한다(지도는 처음 한 번만 위치를 읽는다).
  if (isLoading) return <LoadingState />;

  return (
    <div className="absolute inset-0 flex flex-col [--tabbar-space:var(--partners-tabbar-space,0px)]">
      <h1 className="sr-only">매장 찾기</h1>
      <FixedMediaView only={only} />
    </div>
  );
}
