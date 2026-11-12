"use client";

import { useMemo } from "react";

import { useFavoriteIds } from "@/hooks/favorites";
import { usePartnersStores } from "@/hooks/partners";
import { refOfStore, type StoreRef } from "@/lib/advertiserPreview";
import type { PartnersStore } from "@/lib/partners";

/*
 * 관심 매장(11-11 사용자) — 매장 찾기 카드 · 지도 말풍선의 하트로 담는다. 따로 저장하지 않고 admix 관심 목록
 * (하트, 서버 /favorites — 매체 ID로 저장)을 그대로 쓰고, 그중 매장 찾기에 나오는 매장(제휴사 회원에 연결된 콜라보 매장,
 * /partners/stores)만 관심 매장으로 본다. 그래서 탭을 옮기거나 다시 로그인해도 남고, admix 매체 찾기 콜라보 탭에서 누른 하트도 같이 보인다.
 * (예전 "매장 담기"는 이 탭에만 남는 담은 매장(advStore cart)이었다 — cart 는 이제 의뢰서로 넘길 지정 희망 매장으로만 쓴다.)
 */

/** 관심 매장 — 최근에 담은 순(관심 목록 순서). byMedia 는 매체 ID → 콜라보 매장(등급 · 금액). */
export function useFavoriteStores() {
  const ids = useFavoriteIds();
  const stores = usePartnersStores({});

  const byMedia = useMemo(
    () =>
      new Map<string, PartnersStore>(
        (stores.data ?? [])
          .filter((s) => s.mediaId)
          .map((s) => [s.mediaId as string, s]),
      ),
    [stores.data],
  );

  const refs = useMemo<StoreRef[]>(
    () =>
      (ids.data ?? []).flatMap((id) => {
        const store = byMedia.get(id);
        return store ? [refOfStore(store)] : [];
      }),
    [ids.data, byMedia],
  );

  /** 관심 매장의 콜라보 매장 id(StoreRef.id) — 의뢰서 "관심 매장 고르기"는 이 매장만 보여 준다. */
  const storeIds = useMemo(() => new Set(refs.map((r) => r.id)), [refs]);

  return {
    refs,
    storeIds,
    byMedia,
    /** 관심 목록(매체 ID) — 다른 탭에서 누른 하트를 바로 가져오려면 refetch. */
    ids,
    isLoading: ids.isLoading || stores.isLoading,
  };
}
