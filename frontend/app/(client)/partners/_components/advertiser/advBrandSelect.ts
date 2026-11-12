"use client";

import { useMemo, useSyncExternalStore } from "react";

import { useMe } from "@/hooks/auth";
import { useMyBrands } from "@/hooks/partners";
import type { AdvCollab } from "@/lib/advertiserPreview";
import type { AdvertiserBrand } from "@/lib/partners";

import { useAdvState } from "./advStore";

/*
 * 광고주 브랜드 전환(11-12 사용자) — 브랜드가 여러 개면 사이드바(모바일은 프로필 메뉴)에서 하나를 골라
 * 대시보드 · 내 콜라보를 그 브랜드 것만 본다. "모든 브랜드"(null)를 고르면 전처럼 전부.
 * 고른 브랜드는 이 브라우저에 회원마다 남긴다(localStorage) — 다시 열어도 그대로. 다른 기기와는 나누지 않는다.
 */

const KEY = "admix:adv-brand";
const listeners = new Set<() => void>();

function read(key: string | null): string | null {
  if (!key) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string | null, id: string | null) {
  if (!key) return;
  try {
    if (id) localStorage.setItem(key, id);
    else localStorage.removeItem(key);
    memory.delete(key);
  } catch {
    // 저장이 막혀 있으면 이번 화면에서만 기억한다.
    memory.set(key, id);
  }
  listeners.forEach((l) => l());
}

/** 저장이 막힌 브라우저에서 고른 브랜드 — 이번 화면 동안만. */
const memory = new Map<string, string | null>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  // 같은 브라우저의 다른 탭에서 바꿔도 따라간다.
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith(KEY)) fn();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

/** 이 콜라보가 고른 브랜드 것인지 — 고른 브랜드가 없으면(모든 브랜드) 모두. */
export function inBrand(c: AdvCollab, brand: AdvertiserBrand | null) {
  if (!brand) return true;
  return c.brandId ? c.brandId === brand.id : c.brand === brand.name;
}

/**
 * 브랜드 전환 상태 — brands: 내 브랜드, canSwitch: 둘 이상일 때만 전환 버튼을 보인다,
 * selected: 고른 브랜드(없거나 지운 브랜드면 null = 모든 브랜드), select(id | null).
 */
export function useBrandSelect() {
  const { data: me } = useMe();
  const isAdvertiser = me?.member_category === "advertiser";
  const { data } = useMyBrands();
  const brands = useMemo(() => (isAdvertiser ? (data ?? []) : []), [isAdvertiser, data]);
  const key = isAdvertiser && me ? `${KEY}:${me.id}` : null;
  const savedId = useSyncExternalStore(
    subscribe,
    () => (key && memory.has(key) ? memory.get(key)! : read(key)),
    () => null,
  );
  const canSwitch = brands.length > 1;
  const selected = canSwitch ? (brands.find((b) => b.id === savedId) ?? null) : null;
  return {
    brands,
    canSwitch,
    selected,
    select: (id: string | null) => write(key, id),
  };
}

/** 대시보드 · 내 콜라보가 보는 콜라보 — 고른 브랜드 것만. */
export function useBrandCollabs() {
  const state = useAdvState();
  const { selected } = useBrandSelect();
  return useMemo(
    () => state.collabs.filter((c) => inBrand(c, selected)),
    [state.collabs, selected],
  );
}
