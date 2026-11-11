"use client";

import { useSyncExternalStore } from "react";

import {
  SEED_STATE,
  cancelCollab,
  confirmProceed,
  excludeStore,
  previewNow,
  requestDelay,
  type AdvCollab,
  type AdvState,
  type StoreRef,
} from "@/lib/advertiserPreview";

/*
 * 광고주 콜라보 상태 — 대시보드 · 내 콜라보 · 상세 · 의뢰 · 매장 찾기(담기)가 같이 본다. 11-10부터 빈 상태로 시작.
 * 서버 없이 이 탭(sessionStorage)에만 남는다. 제휴사 쪽(previewStore, admix:partner-preview)과는 따로 둔다.
 */

const KEY = "admix:advertiser-preview";
let state: AdvState = SEED_STATE;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded) return state;
  loaded = true;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as AdvState;
      // 버전이 다르면(11-10 전 예시 콜라보가 든 1 등) 버리고 빈 상태로.
      if (saved?.version === SEED_STATE.version && Array.isArray(saved.collabs)) state = { ...SEED_STATE, ...saved };
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
export const useAdvReady = () => useSyncExternalStore(noop, () => true, () => false);

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
  update((s) => ({ ...s, collabs: s.collabs.map((c) => (c.id === id ? fn(c) : c)) }));

export const advActions = {
  /** 매장 담기 · 빼기(실제 매장). */
  toggleCart(store: StoreRef) {
    update((s) => ({
      ...s,
      cart: s.cart.some((x) => x.id === store.id)
        ? s.cart.filter((x) => x.id !== store.id)
        : [...s.cart, store],
    }));
  },
  removeFromCart(id: string) {
    update((s) => ({ ...s, cart: s.cart.filter((x) => x.id !== id) }));
  },
  clearCart() {
    update((s) => ({ ...s, cart: [] }));
  },
  /** 의뢰 보내기 — 새 의뢰면 담은 매장을 비우고, 고친 의뢰(검토 중 · 보완 요청)면 다시 검토 중으로. */
  submit(next: AdvCollab, editing: boolean) {
    const now = previewNow();
    const sent: AdvCollab = { ...next, status: "requested", requestedAt: now, reviewNote: undefined };
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
    patch(id, (c) => (c.status === "requested" || c.status === "returned" ? cancelCollab(c, previewNow()) : c));
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
    patch(id, (c) => (c.delay && c.delay.status !== "applied" ? { ...c, delay: undefined } : c));
  },
  reset() {
    update(() => SEED_STATE);
  },
};
