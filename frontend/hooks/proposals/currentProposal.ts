"use client";

import { useSyncExternalStore } from "react";

import { isDraftProposal } from "./apis";
import { useMyProposals } from "./queries";

/**
 * "담는 제안서" — 장바구니처럼 화면 어디서든 같은 제안서를 본다.
 * 고른 제안서 id는 브라우저(localStorage)에 두고, 패널 열림은 메모리에 둔다.
 * 둘 다 작은 외부 저장소라 사이드바 버튼·모바일 헤더 버튼·패널이 같은 값을 본다.
 */
const STORAGE_KEY = "admix.currentProposalId";

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

function readStoredId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setCurrentProposalId(id: string | null): void {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 저장 못 해도(사생활 보호 모드 등) 이번 화면에서는 아래 알림으로 반영된다.
  }
  notify();
}

let panelOpen = false;

export function setCurrentProposalPanelOpen(open: boolean): void {
  // 닫을 때 이번에 본 제안서의 "N" 표시를 지운다.
  if (panelOpen && !open) clearViewedNew();
  panelOpen = open;
  notify();
}

export function useCurrentProposalPanelOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => panelOpen,
    () => false,
  );
}

/**
 * 새로 담긴 제안서 — 담는 제안서 패널의 제안서 목록에 "N" 표시를 붙인다.
 * 패널에서 본 제안서는 기억해 두었다가(markProposalViewed) 패널을 닫을 때 한꺼번에 지운다 —
 * 열려 있는 동안은 방금 담긴 제안서들이 무엇인지 계속 보인다. 이번 방문 동안만 기억한다(메모리).
 */
let newProposalIds: readonly string[] = [];
const viewedWhileOpen = new Set<string>();

export function markProposalsNew(ids: string[]): void {
  newProposalIds = [...new Set([...newProposalIds, ...ids])];
  notify();
}

/** 패널에서 이 제안서를 봤다 — 패널이 닫히면 "N"이 지워진다. 여러 번 불러도 같다. */
export function markProposalViewed(id: string): void {
  viewedWhileOpen.add(id);
}

function clearViewedNew(): void {
  if (viewedWhileOpen.size === 0) return;
  const next = newProposalIds.filter((id) => !viewedWhileOpen.has(id));
  viewedWhileOpen.clear();
  if (next.length !== newProposalIds.length) newProposalIds = next;
}

export function useNewProposalIds(): readonly string[] {
  return useSyncExternalStore(
    subscribe,
    () => newProposalIds,
    () => EMPTY_IDS,
  );
}
const EMPTY_IDS: readonly string[] = [];

/**
 * 담기 알림 말풍선 — "OOO 제안서에 담았습니다" + 매체명. 담는 제안서 버튼에서
 * 화살표로 가리키며 잠깐 떴다가 사라진다(같은 버튼 Badge가 늘어난 걸 함께 보게).
 */
export type ProposalCallout = { key: number; title: string; detail?: string };

const CALLOUT_MS = 3500;
let callout: ProposalCallout | null = null;
let calloutTimer: ReturnType<typeof setTimeout> | null = null;

export function showProposalCallout(title: string, detail?: string): void {
  callout = { key: Date.now(), title, detail };
  if (calloutTimer) clearTimeout(calloutTimer);
  calloutTimer = setTimeout(hideProposalCallout, CALLOUT_MS);
  notify();
}

export function hideProposalCallout(): void {
  if (calloutTimer) clearTimeout(calloutTimer);
  calloutTimer = null;
  if (!callout) return;
  callout = null;
  notify();
}

export function useProposalCallout(): ProposalCallout | null {
  return useSyncExternalStore(
    subscribe,
    () => callout,
    () => null,
  );
}

/**
 * 제안서에 담은 뒤 공통 처리 — 담기 창·믹시 대화(직접 담기·제안서 고르기 카드)가 같이 쓴다.
 * 1) 담는 제안서 버튼에서 "A, B 제안서에 담았습니다" + 매체명 말풍선
 * 2) 담는 제안서를 방금 담은 제안서로 바꾼다(여러 개면 마지막 것)
 * 3) 담는 제안서 패널의 제안서 목록에 "N"(새로 담김) 표시
 */
export function notifyProposalsAdded(
  proposals: { id: string; title: string }[],
  mediaNames: string[],
): void {
  if (proposals.length === 0) return;
  showProposalCallout(
    `${proposals.map((p) => p.title).join(", ")} 제안서에 담았습니다`,
    mediaNames.length > 1
      ? `${mediaNames[0]} 외 ${mediaNames.length - 1}개`
      : mediaNames[0],
  );
  setCurrentProposalId(proposals[proposals.length - 1].id);
  markProposalsNew(proposals.map((p) => p.id));
}

/**
 * 담는 제안서 — 고른 것이 없거나 더는 작성 중이 아니면(삭제·제출 등) 가장 최근 작성 중 제안서.
 * drafts: 바꿔 볼 수 있는 작성 중 제안서 목록(최근 순).
 */
export function useCurrentProposal() {
  const storedId = useSyncExternalStore(subscribe, readStoredId, () => null);
  const { data, isLoading } = useMyProposals();
  const drafts = (data ?? []).filter((p) => isDraftProposal(p.status));
  const current = drafts.find((p) => p.id === storedId) ?? drafts[0] ?? null;
  return { current, drafts, isLoading };
}
