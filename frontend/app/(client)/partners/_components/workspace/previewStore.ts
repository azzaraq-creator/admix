"use client";

import { useSyncExternalStore } from "react";

import {
  PREVIEW_TODAY,
  SEED_STATE,
  type PhotoStep,
  type PreviewState,
  kst,
} from "@/lib/partnersPreview";

/*
 * 매장 화면 예시 상태 — 대시보드 · 콜라보 · 참여 이력 · 대화 · 문서함이 같이 본다.
 * 서버 없이 이 탭(sessionStorage)에만 남는다. 실제 기능은 사용자가 정해 주면 서버로 옮긴다.
 */

const KEY = "admix:partner-preview";
let state: PreviewState = SEED_STATE;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded) return state;
  loaded = true;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) state = { ...SEED_STATE, ...(JSON.parse(raw) as PreviewState) };
  } catch {
    // 저장소가 막혀 있으면 예시 원본으로.
  }
  return state;
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function usePreviewState() {
  return useSyncExternalStore(subscribe, load, () => SEED_STATE);
}

function update(fn: (s: PreviewState) => PreviewState) {
  state = fn(load());
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 저장이 안 되면 이 화면에서만 유지.
  }
  listeners.forEach((l) => l());
}

/** 지금 시각(예시 기준일 + 실제 시각) — 새로 남기는 기록에 쓴다. */
const nowIso = () => {
  const t = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(11, 16);
  return kst(PREVIEW_TODAY, t);
};

const patch = (
  id: string,
  fn: (c: PreviewState["collabs"][number]) => PreviewState["collabs"][number],
) =>
  update((s) => ({
    ...s,
    collabs: s.collabs.map((c) => (c.id === id ? fn(c) : c)),
  }));

export const previewActions = {
  /** 선착순 신청 — 자리가 남으면 선정 후보, 찼으면 예비. */
  apply(id: string) {
    patch(id, (c) => {
      const full = c.appliedStores >= c.targetStores;
      return {
        ...c,
        appliedStores: c.appliedStores + 1,
        standing: full ? "reserve" : "candidate",
        slotNo: full
          ? c.appliedStores - c.targetStores + 1
          : c.appliedStores + 1,
      };
    });
  },
  withdraw(id: string) {
    patch(id, (c) => ({
      ...c,
      appliedStores: Math.max(0, c.appliedStores - 1),
      standing: "none",
      slotNo: undefined,
    }));
  },
  confirm(id: string, confirmer: string, checked: number) {
    const no = `CF-${PREVIEW_TODAY.replaceAll("-", "")}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    patch(id, (c) => ({
      ...c,
      standing: "confirmed",
      confirmNo: no,
      confirmedAt: nowIso(),
      confirmer,
      checkedItems: checked,
    }));
    return no;
  },
  addPhoto(id: string, step: PhotoStep, thumb?: string) {
    patch(id, (c) => ({
      ...c,
      photos: [
        ...c.photos.filter((p) => p.step !== step),
        { step, at: nowIso(), by: "cafe", thumb },
      ],
    }));
  },
  readNotice(noticeId: string) {
    update((s) => ({ ...s, reads: [...new Set([...s.reads, noticeId])] }));
  },
  restock(id: string) {
    update((s) => ({ ...s, restocks: [...new Set([...s.restocks, id])] }));
  },
  sendMessage(text: string) {
    update((s) => ({
      ...s,
      messages: [
        ...s.messages,
        {
          id: `m${Date.now()}`,
          author: "cafe",
          name: "우리 매장",
          text,
          at: nowIso(),
        },
      ],
    }));
  },
  reset() {
    update(() => SEED_STATE);
  },
};

/** 사진을 480px 이하로 줄여 data URL로(외부 전송 없음) — 상세 · 대시보드의 "사진 올리기"가 같이 쓴다. */
export async function toThumb(file: File): Promise<string | undefined> {
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = url;
    });
    const k = Math.min(1, 480 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    return c.toDataURL("image/jpeg", 0.7);
  } catch {
    return undefined;
  }
}
