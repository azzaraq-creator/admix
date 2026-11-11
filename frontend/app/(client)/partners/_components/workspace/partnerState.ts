"use client";

import { useMemo } from "react";

import { useMe } from "@/hooks/auth";
import {
  useCollabActions,
  useSelectedPartnerStore,
  useStoreCollabs,
} from "@/hooks/partners";
import { useSonner } from "@/hooks/useSonner";
import { extractApiError } from "@/lib/apiError";
import {
  categoryOf,
  todayKst,
  type PhotoStep,
  type PreviewState,
} from "@/lib/partnersPreview";
import { shrinkImage } from "@/lib/shrinkImage";

/*
 * 매장 화면 상태 — 대시보드 · 콜라보 참여 · 상세 · 참여 이력 · 알림이 같이 본다(서버, 069).
 * 고른 매장(useSelectedPartnerStore)이 보는 콜라보를 예전 예시 화면과 같은 모양(PreviewState)으로 돌려준다.
 */

const EMPTY: PreviewState = { collabs: [], reads: [], restocks: [] };

/** 고른 매장 · 그 매장의 콜라보 · 오늘(서버 KST). */
export function usePartnerWorkspace() {
  const { data: me } = useMe();
  const sel = useSelectedPartnerStore();
  const collabs = useStoreCollabs(sel.store?.id);
  const items = collabs.data?.items;
  const state = useMemo<PreviewState>(
    () =>
      items
        ? {
            collabs: items,
            reads: items.flatMap((c) => c.readNoticeIds ?? []),
            restocks: items.filter((c) => c.restockRequested).map((c) => c.id),
          }
        : EMPTY,
    [items],
  );
  return {
    ...sel,
    /** 기본협약에 동의했는지 — 안 했으면 신청 대신 협약 안내. */
    agreed: Boolean(me?.partner_agreed_at),
    state,
    today: collabs.data?.today ?? todayKst(),
    /** 매장 목록 · (매장이 있으면) 콜라보를 받는 중. */
    isLoading: sel.isPending || (Boolean(sel.store) && collabs.isPending),
    isError: sel.isError || collabs.isError,
    refetch: collabs.refetch,
  };
}

/** 지금 신청할 수 있는 모집 중 콜라보 수 — 메뉴 "콜라보 참여" 옆 숫자. */
export function useRecruitingCount() {
  const { store } = useSelectedPartnerStore();
  const { data } = useStoreCollabs(store?.id);
  if (!data) return undefined;
  return data.items.filter(
    (c) => categoryOf(c, data.today) === "recruiting" && c.standing === "none",
  ).length;
}

/** 콜라보 사진은 긴 변 1600px(서버 COLLAB_PHOTO_MAX_SIDE)로 줄여 올린다. */
const PHOTO_MAX_SIDE = 1600;

/**
 * 콜라보 동작 — 고른 매장으로 서버에 보내고, 실패하면 서버 문구를 토스트로.
 * 성공 알림은 부르는 쪽이 정한다(창 닫기 · 확정서 열기 같은 다음 동작이 달라서). 실패하면 false/undefined.
 */
export function useCollabCommands() {
  const { store } = useSelectedPartnerStore();
  const actions = useCollabActions(store?.id);
  const { error } = useSonner();
  const run = async <T>(p: Promise<T>, fallback: string) => {
    try {
      return await p;
    } catch (e) {
      error(extractApiError(e, fallback));
      return undefined;
    }
  };
  return {
    pending:
      actions.apply.isPending ||
      actions.withdraw.isPending ||
      actions.confirm.isPending ||
      actions.photo.isPending ||
      actions.restock.isPending,
    photoPending: actions.photo.isPending,
    apply: (id: string) =>
      run(actions.apply.mutateAsync(id), "신청하지 못했어요."),
    withdraw: (id: string) =>
      run(actions.withdraw.mutateAsync(id), "신청을 취소하지 못했어요."),
    confirm: async (id: string, confirmer: string, checked: number) =>
      (
        await run(
          actions.confirm.mutateAsync({ id, confirmer, checked }),
          "확정하지 못했어요.",
        )
      )?.confirmNo,
    addPhoto: async (id: string, step: PhotoStep, file: File) =>
      run(
        shrinkImage(file, { maxSide: PHOTO_MAX_SIDE }).then((f) =>
          actions.photo.mutateAsync({ id, step, file: f }),
        ),
        "사진을 올리지 못했어요.",
      ),
    restock: (id: string) =>
      run(actions.restock.mutateAsync(id), "재입고를 요청하지 못했어요."),
    readNotice: (id: string, noticeId: string) =>
      actions.readNotice.mutate({ id, noticeId }),
  };
}
