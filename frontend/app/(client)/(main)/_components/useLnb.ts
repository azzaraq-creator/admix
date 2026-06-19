"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "lnb-expanded";

const listeners = new Set<() => void>();

const subscribe = (callback: () => void) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

const getSnapshot = () => localStorage.getItem(STORAGE_KEY) === "true";
const getServerSnapshot = () => false;

export function useLnbExpanded() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setLnbExpanded(value: boolean) {
  localStorage.setItem(STORAGE_KEY, String(value));
  listeners.forEach((listener) => listener());
}
