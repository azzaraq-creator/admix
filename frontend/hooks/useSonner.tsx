"use client";

import { toast } from "@heroui/react";
import Image from "next/image";
import { useCallback } from "react";

import {
  CircleMinusIcon,
  CirclePlusIcon,
  CircleXIcon,
} from "@/components/icons";

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
  // 더한 알림(관심 매체에 담았어요 등) — 성공과 같은 초록 톤에 동그라미 "+"로, 아래 "-"와 짝을 이룬다.
  const added = useCallback(
    (message: string, detail?: string) =>
      toast.success(message, {
        description: detail,
        timeout: TOAST_TIMEOUT,
        indicator: <CirclePlusIcon className="size-4" />,
      }),
    [],
  );
  // 덜어 낸 알림(관심 매체에서 뺐어요 등) — 오류는 아니지만 빨간 동그라미 "-"로 성공(초록 체크)과 구분한다.
  const removed = useCallback(
    (message: string, detail?: string) =>
      toast.danger(message, {
        description: detail,
        timeout: TOAST_TIMEOUT,
        indicator: <CircleMinusIcon className="size-4" />,
      }),
    [],
  );
  // 막힌 동작 알림(비회원이 관심 매체를 누름 등) — 빨간 동그라미 "X".
  const blocked = useCallback(
    (message: string, detail?: string) =>
      toast.danger(message, {
        description: detail,
        timeout: TOAST_TIMEOUT,
        indicator: <CircleXIcon className="size-4" />,
      }),
    [],
  );
  // 지운 알림(제안서 삭제 등) — 삭제 확인창과 같은 빨간 휴지통(public/icons/trash.svg), 빨간 톤.
  const deleted = useCallback(
    (message: string, detail?: string) =>
      toast.danger(message, {
        description: detail,
        timeout: TOAST_TIMEOUT,
        indicator: (
          <Image src="/icons/trash.svg" alt="" width={18} height={18} />
        ),
      }),
    [],
  );
  return {
    success,
    error,
    added,
    removed,
    blocked,
    deleted,
  };
}
