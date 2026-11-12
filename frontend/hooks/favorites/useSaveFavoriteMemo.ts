"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { favoritesApi } from "./apis";
import { favoritesKeys } from "./keys";

/**
 * 관심 목록 메모 저장(광고주 관심 매장 카드 아래 메모 칸). 저장되면 메모 목록 캐시를 바로 고친다
 * (관심 목록 전체를 다시 받지 않는다 — 카드 목록 · 하트는 그대로).
 */
export function useSaveFavoriteMemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mediaId, memo }: { mediaId: string; memo: string }) =>
      favoritesApi.setMemo(mediaId, memo),
    onSuccess: (saved, { mediaId }) => {
      qc.setQueryData<Record<string, string>>(favoritesKeys.memos(), (old = {}) => {
        const next = { ...old };
        if (saved) next[mediaId] = saved;
        else delete next[mediaId];
        return next;
      });
    },
  });
}
