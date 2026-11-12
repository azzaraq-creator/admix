"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useSyncExternalStore } from "react";

import { partnersKeys, useMyCollabRequests } from "@/hooks/partners";
import {
  SEED_STATE,
  cancelCollab,
  collabOfRequest,
  confirmProceed,
  excludeStore,
  previewNow,
  requestDelay,
  type AdvCollab,
  type AdvState,
  type StoreRef,
} from "@/lib/advertiserPreview";
import type { CollabRequestMine } from "@/lib/partners";

/*
 * 광고주 콜라보 상태 — 대시보드 · 내 콜라보 · 상세 · 의뢰가 같이 본다. 11-10부터 빈 상태로 시작.
 * 이 탭(sessionStorage)에 남는다. 제휴사 쪽(previewStore, admix:partner-preview)과는 따로 둔다.
 * 보낸 의뢰는 서버에도 있어(081) useAdvServerSync 가 이 탭에 없는 것을 더한다 — 다른 탭 · 다시 로그인해도
 * 내 콜라보에 보인다(11-12 사용자: "내 콜라보 들어갔는데 아무 것도 안 떠"). 승인 뒤 진행 단계는 아직 예시.
 */

const KEY = "admix:advertiser-preview";
let state: AdvState = SEED_STATE;
let loaded = false;
/** 서버 의뢰를 한 번이라도 합쳤는지 — 상세 · 고치기가 그전엔 "찾는 콜라보가 없어요" 대신 로딩을 보인다. */
let synced = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded) return state;
  loaded = true;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as AdvState;
      // 버전이 다르면(11-10 전 예시 콜라보가 든 1 등) 버리고 빈 상태로.
      if (saved?.version === SEED_STATE.version && Array.isArray(saved.collabs))
        state = { ...SEED_STATE, ...saved };
    }
  } catch {
    // 저장소가 막혀 있으면 예시 원본으로.
  }
  return state;
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function useAdvState() {
  return useSyncExternalStore(subscribe, load, () => SEED_STATE);
}

/** 저장된 예시 상태를 읽을 수 있게 됐는지 — 서버 화면 · 첫 하이드레이션에서는 예시 원본(SEED_STATE)이 보인다.
 *  의뢰서처럼 처음 값을 상태에서 한 번만 가져가는 화면은 이게 true 가 된 뒤에 그린다. */
const noop = () => () => {};
export const useAdvReady = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

function update(fn: (s: AdvState) => AdvState) {
  state = fn(load());
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 저장이 안 되면 이 화면에서만 유지.
  }
  listeners.forEach((l) => l());
}

const patch = (id: string, fn: (c: AdvCollab) => AdvCollab) =>
  update((s) => ({
    ...s,
    collabs: s.collabs.map((c) => (c.id === id ? fn(c) : c)),
  }));

export const advActions = {
  // cart — 새 의뢰서로 넘길 지정 희망 매장. 매장 찾기의 "매장 담기"는 11-11에 없앴고(하트 = 관심 매장, favoriteStores.ts),
  // 의뢰서의 "관심 매장 고르기"가 채운다(관심 매장 화면의 "이 매장들로 의뢰하기"는 11-11에 없앴다).
  removeFromCart(id: string) {
    update((s) => ({ ...s, cart: s.cart.filter((x) => x.id !== id) }));
  },
  /** 지정 희망 매장을 바꾼다 — 의뢰서 "관심 매장 고르기" 팝업(11-11). */
  setCart(stores: StoreRef[]) {
    update((s) => ({ ...s, cart: stores }));
  },
  clearCart() {
    update((s) => ({ ...s, cart: [] }));
  },
  /** 의뢰 보내기 — 새 의뢰면 담은 매장을 비우고, 고친 의뢰(검토 중 · 보완 요청)면 다시 검토 중으로. */
  submit(next: AdvCollab, editing: boolean) {
    const now = previewNow();
    const sent: AdvCollab = {
      ...next,
      status: "requested",
      requestedAt: now,
      reviewNote: undefined,
    };
    update((s) => ({
      ...s,
      collabs: editing
        ? s.collabs.map((c) => (c.id === sent.id ? sent : c))
        : [sent, ...s.collabs],
      cart: editing ? s.cart : [],
    }));
  },
  /** 검토 중인 의뢰 취소(비용 없음). */
  withdrawRequest(id: string) {
    patch(id, (c) =>
      c.status === "requested" || c.status === "returned"
        ? cancelCollab(c, previewNow())
        : c,
    );
  },
  decide(id: string, option: string) {
    patch(id, (c) => ({ ...c, decision: { option, at: previewNow() } }));
  },
  setReservesPreApproved(id: string, on: boolean) {
    patch(id, (c) => ({ ...c, reservesPreApproved: on }));
  },
  exclude(id: string, storeId: string) {
    patch(id, (c) => excludeStore(c, storeId, previewNow()));
  },
  proceed(id: string) {
    patch(id, (c) => confirmProceed(c, previewNow()));
  },
  cancel(id: string) {
    patch(id, (c) => cancelCollab(c, previewNow()));
  },
  requestDelay(id: string, newStart: string) {
    patch(id, (c) => requestDelay(c, newStart, previewNow()));
  },
  withdrawDelay(id: string) {
    patch(id, (c) =>
      c.delay && c.delay.status !== "applied" ? { ...c, delay: undefined } : c,
    );
  },
  reset() {
    update(() => SEED_STATE);
  },
  /**
   * 서버에 보낸 의뢰를 합친다 — 이 탭에 없는 의뢰는 서버 값으로 더하고, 이 탭에 있는 의뢰는 그대로 둔다(예시 진행 단계 유지).
   * 다만 기획안이 오가면(085) 그 의뢰는 서버 값(마지막 차수)으로 바꾼다.
   * 서버에 없는 보낸 의뢰(지운 의뢰 · 같은 탭에서 다른 광고주로 다시 로그인)는 뺀다.
   */
  syncRequests(list: CollabRequestMine[]) {
    const s = load();
    const onServer = new Set(list.map((r) => r.id));
    const known = new Set(s.collabs.map((c) => c.requestId));
    // 다른 탭 · 기기에서 취소한 의뢰는 이 탭에서도 취소로(084).
    const cancelledAt = new Map(
      list
        .filter((r) => r.status === "cancelled")
        .map((r) => [r.id, r.cancelledAt ?? previewNow()]),
    );
    const byId = new Map(list.map((r) => [r.id, r]));
    let changed = false;
    const kept = s.collabs
      .filter((c) => !c.requestId || onServer.has(c.requestId))
      .map((c) => {
        const at = c.requestId ? cancelledAt.get(c.requestId) : undefined;
        if (at) {
          if (c.status === "cancelled") return c;
          changed = true;
          return { ...cancelCollab(c, at), cancelledAt: at };
        }
        // 기획안이 오갔으면(085 — admix가 보냄 · 내가 고쳐 보냄 · 확정) 서버 값으로 새로 — 주소가 그대로이게 id 는 둔다.
        const r = c.requestId ? byId.get(c.requestId) : undefined;
        if (!r || !planMoved(c, r)) return c;
        changed = true;
        return { ...collabOfRequest(r), id: c.id };
      });
    const added = list.filter((r) => !known.has(r.id)).map(collabOfRequest);
    if (!synced) {
      synced = true;
      listeners.forEach((l) => l());
    }
    if (!changed && !added.length && kept.length === s.collabs.length) return;
    update((x) => ({ ...x, collabs: [...added, ...kept] }));
  },
};

/** 서버에서 기획안 차례가 바뀌었는지 — 상태 · 차수 수 · 확정한 때. 처음 보낸 그대로면 이 탭 값을 둔다. */
function planMoved(c: AdvCollab, r: CollabRequestMine) {
  return (
    (c.requestStatus ?? "submitted") !== r.status ||
    (c.plan?.rounds.length ?? 0) !== (r.rounds?.length ?? 0) ||
    (c.plan?.confirmedAt ?? null) !== (r.confirmedAt ?? null)
  );
}

const isSynced = () => synced;

/**
 * 서버에 보낸 의뢰(081)를 이 탭 상태에 합친다 — 대시보드 · 내 콜라보 · 상세 · 고치기에서 부른다.
 * 돌려주는 값: 합쳤거나(또는 받지 못했거나) 더 기다릴 게 없으면 true.
 */
export function useAdvServerSync() {
  const q = useMyCollabRequests();
  useEffect(() => {
    if (q.data) advActions.syncRequests(q.data);
  }, [q.data]);
  const merged = useSyncExternalStore(subscribe, isSynced, () => false);
  return merged || q.isError;
}

/**
 * 의뢰를 보내거나 고쳐 다시 보낸 뒤 — 받은 의뢰로 목록 캐시를 바로 고친다.
 * 오래된 캐시로 다시 합치다가 방금 보낸 의뢰를 "서버에 없는 의뢰"로 빼지 않게.
 */
export function useRememberSentRequest() {
  const queryClient = useQueryClient();
  return useCallback(
    (saved: CollabRequestMine) => {
      queryClient.setQueryData<CollabRequestMine[]>(
        partnersKeys.collabRequests(),
        (old) => (old ? [saved, ...old.filter((r) => r.id !== saved.id)] : old),
      );
      void queryClient.invalidateQueries({
        queryKey: partnersKeys.collabRequests(),
      });
    },
    [queryClient],
  );
}
