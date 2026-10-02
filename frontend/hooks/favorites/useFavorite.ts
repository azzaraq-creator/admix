"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSonner } from "@/hooks/useSonner";

import { useMe } from "../auth";
import { favoritesApi } from "./apis";
import { favoritesKeys } from "./keys";
import { useFavoriteIds } from "./queries";

/**
 * 매체 한 개의 하트 상태와 토글 — 매체 찾기 카드·지도 팝업·매체 정보 팝업·관심 매체 페이지가 같이 쓴다.
 * - 비회원: 누르면 위쪽 알림(빨간 X)으로 로그인 후 담을 수 있다고 알린다(관심 매체는 회원 전용).
 * - 회원: 누르는 즉시 하트를 바꾸고(낙관적 갱신) 서버에 저장한다. 실패하면 되돌리고 알린다.
 * - notifyName을 주면 저장이 끝난 뒤 위쪽 알림(Toast)으로 담았다/뺐다를 알린다(매체 찾기 목록).
 */
export function useFavorite(
  mediaId: string,
  { notifyName }: { notifyName?: string } = {},
) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: ids } = useFavoriteIds();
  const { added, removed, blocked, error } = useSonner();
  const liked = !!ids?.includes(mediaId);

  const mutation = useMutation({
    mutationFn: (next: boolean) =>
      next ? favoritesApi.add(mediaId) : favoritesApi.remove(mediaId),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: favoritesKeys.ids() });
      const prev = qc.getQueryData<string[]>(favoritesKeys.ids());
      qc.setQueryData<string[]>(favoritesKeys.ids(), (old = []) =>
        next
          ? [mediaId, ...old.filter((id) => id !== mediaId)]
          : old.filter((id) => id !== mediaId),
      );
      return { prev };
    },
    onSuccess: (_data, next) => {
      if (notifyName == null) return;
      // 담으면 초록 동그라미 "+", 빼면 빨간 동그라미 "-".
      if (next) added("관심 매체에 담았어요", notifyName);
      else removed("관심 매체에서 뺐어요", notifyName);
    },
    onError: (_err, next, ctx) => {
      qc.setQueryData(favoritesKeys.ids(), ctx?.prev);
      error(
        next ? "관심 매체에 담지 못했어요" : "관심 매체에서 빼지 못했어요",
        "잠시 후 다시 시도해 주세요.",
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: favoritesKeys.all });
    },
  });

  const setLiked = (next: boolean) => {
    if (!me) {
      blocked("로그인 후 관심 매체에 담을 수 있어요");
      return;
    }
    mutation.mutate(next);
  };

  return { liked, setLiked, toggle: () => setLiked(!liked) };
}
