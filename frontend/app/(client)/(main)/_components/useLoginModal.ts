"use client";

import { useSyncExternalStore } from "react";

let isOpen = false;

const listeners = new Set<() => void>();

const subscribe = (callback: () => void) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

const getSnapshot = () => isOpen;
const getServerSnapshot = () => false;

export function useLoginModalOpen() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setLoginModalOpen(value: boolean) {
  isOpen = value;
  listeners.forEach((listener) => listener());
}

export function openLoginModal() {
  setLoginModalOpen(true);
}
