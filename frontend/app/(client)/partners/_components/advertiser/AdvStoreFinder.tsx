"use client";

import { useMemo } from "react";

import { FixedMediaView } from "@/app/(client)/(main)/fixed/_components/FixedMediaView";
import type {
  CollabPick,
  MediaFindOnly,
} from "@/app/(client)/(main)/fixed/_components/collabPick";
import type { MoveTarget } from "@/app/(client)/(main)/fixed/_components/mapTypes";
import { LoadingState } from "@/components/common/RouteStates";
import type { MediaCardRow } from "@/hooks/media";
import { useStoreTypeNames } from "@/hooks/partners";
import { PARTNERS_MEDIA_CATEGORY } from "@/lib/partners";

import { useFavoriteStores } from "./favoriteStores";

/*
 * /partners/find (광고주) — admix 매체 찾기 화면(목록 + 지도 · 검색 · 인구 분포 · 실시간 인구)을 그대로 쓰고
 * 콜라보 매장만 보이게 한다(11-09 사용자: "매체 찾기와 동일하게, 지도도 보여 주고 매장만").
 * 탭은 "콜라보 매장" 하나 대신 매장 유형(전체 · 카페 · 식당 …, 어드민 "매장 유형 관리" 순서, 11-11 사용자).
 * 카드 · 지도 말풍선에 등급 · 1건 금액(어드민이 정한 값, 067). 하트를 누르면 관심 매장(/partners/favorites)에 담긴다 —
 * 예전 "매장 담기" 버튼은 11-11 사용자가 없앴다(관심 매장에서 골라 의뢰하거나, 의뢰서의 "관심 매장 고르기"로 지정 희망 매장을 고른다).
 * 탭 줄 오른쪽 "관심 매장 N곳 →" 바로 가기 · 지도 실시간 정보(실시간 인구 · 도로 현황)도 11-11 사용자가 뺐다 — 관심 매장은 왼쪽 메뉴로.
 * 지도 핀은 늘 매장 이름표, 같은 자리에 겹쳐도 숫자로 묶지 않는다(MapArea namePins).
 * 카드를 누르면 매장 상세가 새 탭으로(매체 찾기에서 콜라보 매장을 누를 때와 같다).
 *
 * 매체 찾기 카드는 매체 ID(CF-0001)로 오고, 등급 · 금액은 콜라보 매장 목록(광고주에게만 금액이 내려온다)에서
 * 매체 ID로 찾아 붙인다.
 *
 * 콜라보 화면 본문 칸(가운데 1120px · 여백)을 쓰지 않고 본문 전체를 채운다 — 본문(main)이 relative 라 absolute inset-0.
 * 모바일 아래 탭 바 높이는 매체 찾기가 쓰는 --tabbar-space 로 넘긴다.
 */

/**
 * 처음 지도 위치 — 성수역(2호선)에서 연다(11-11 사용자). 콜라보 매장이 성수에 모여 있다.
 * 레벨은 매체 찾기 첫 화면(강남역)과 같은 4. 주소에 조회 영역이 있으면(새로고침 · 뒤로 가기) 그 영역이 먼저다.
 * 예전엔 지도에 나오는 매장이 모두 들어오는 가운데 · 레벨을 매장 목록으로 계산했다.
 */
const SEONGSU_STATION: MoveTarget = {
  lat: 37.544581,
  lng: 127.055961,
  level: 4,
};

export function AdvStoreFinder() {
  // 매장 유형 탭 — 못 받아 오면 예전처럼 "콜라보 매장" 탭 하나.
  const { data: storeTypes, isLoading: typesLoading } = useStoreTypeNames();
  const favorites = useFavoriteStores();
  const byMedia = favorites.byMedia;

  const only = useMemo<MediaFindOnly>(
    () => ({
      category: PARTNERS_MEDIA_CATEGORY,
      label: "콜라보 매장",
      storeTypes,
      // 제휴사 회원에 연결된 매장만 — 연결 전 매장은 콜라보를 받을 사람이 없다(11-11 사용자).
      linkedOnly: true,
      initialView: SEONGSU_STATION,
      pickOf: (row: MediaCardRow): CollabPick | undefined => {
        const store = byMedia.get(row.id);
        if (!store) return undefined;
        return {
          grade: store.collabGrade ?? null,
          fee: store.collabFee ?? null,
        };
      },
    }),
    [byMedia, storeTypes],
  );

  // 매장 유형을 기다린다 — 탭이 "콜라보 매장"으로 잠깐 보였다가 바뀌지 않게.
  if (typesLoading) return <LoadingState />;

  return (
    <div className="absolute inset-0 flex flex-col [--tabbar-space:var(--partners-tabbar-space,0px)]">
      <h1 className="sr-only">매장 찾기</h1>
      <FixedMediaView only={only} />
    </div>
  );
}
