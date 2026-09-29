"use client";

import { toast } from "@heroui/react";
import { useCallback } from "react";

/**
 * 짧은 알림(토스트) — HeroUI Toast. 화면 위 가운데에 뜨고 3초 뒤 저절로 사라진다
 * (위치는 app/providers.tsx의 Toast.Provider).
 * 이름은 예전 sonner 시절 그대로 두어 호출하는 쪽(`const { success, error } = useSonner()`)은 바뀌지 않는다.
 */
export const TOAST_TIMEOUT = 3000;

export function useSonner() {
  // detail이 있으면 둘째 줄에 작게 — 제목엔 "어디서 무엇을 했는지/실패했는지",
  // detail엔 구체적인 내용(바뀐 항목, 원래 오류 예: Network Error).
  const success = useCallback(
    (message: string, detail?: string) =>
      toast.success(message, { description: detail, timeout: TOAST_TIMEOUT }),
    [],
  );
  const error = useCallback(
    (message: string, detail?: string) =>
      toast.danger(message, { description: detail, timeout: TOAST_TIMEOUT }),
    [],
  );
  return { success, error };
}
