"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { favoritesApi } from "./apis";
import { favoritesKeys } from "./keys";

/**
 * 여러 매체를 관심 매체에서 한 번에 뺀다(관심 매체 페이지의 "위시 취소").
 * 누르는 즉시 하트 목록에서 빼고(카드가 바로 사라진다), 실패하면 되돌린다.
 */
export function useRemoveFavorites() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mediaIds: string[]) =>
      Promise.all(mediaIds.map((id) => favoritesApi.remove(id))),
    onMutate: async (mediaIds) => {
      await qc.cancelQueries({ queryKey: favoritesKeys.ids() });
      const prev = qc.getQueryData<string[]>(favoritesKeys.ids());
      qc.setQueryData<string[]>(favoritesKeys.ids(), (old = []) =>
        old.filter((id) => !mediaIds.includes(id)),
      );
      return { prev };
    },
    onError: (_err, _ids, ctx) => {
      qc.setQueryData(favoritesKeys.ids(), ctx?.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: favoritesKeys.all });
    },
  });
}
