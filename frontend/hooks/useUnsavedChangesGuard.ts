"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

const GUARD_STATE = { unsavedChangesGuard: true };

/**
 * 저장하지 않은 수정 내용이 있을 때 페이지를 떠나기 전에 확인한다.
 *
 * - 브라우저 뒤로 가기: 수정이 생기면 같은 주소 기록을 하나 더 쌓아 둔다. 뒤로 가기를 누르면
 *   그 기록만 빠지고 화면은 그대로라, 그때 confirmLeave 를 띄워 나가기면 한 번 더 뒤로 간다.
 * - 화면 안 버튼: leave(href)로 이동하면 같은 확인을 거친다.
 * - 새로고침·탭 닫기: 브라우저 기본 확인창(beforeunload)만 띄울 수 있다.
 */
export function useUnsavedChangesGuard(
  when: boolean,
  confirmLeave: () => Promise<boolean>,
) {
  const router = useRouter();
  const whenRef = useRef(when);
  const confirmRef = useRef(confirmLeave);
  // 지금 쌓아 둔 확인용 기록이 맨 위에 있는지
  const guardedRef = useRef(false);

  useEffect(() => {
    whenRef.current = when;
    confirmRef.current = confirmLeave;
  });

  useEffect(() => {
    if (when && !guardedRef.current) {
      window.history.pushState(GUARD_STATE, "", window.location.href);
      guardedRef.current = true;
    }
  }, [when]);

  useEffect(() => {
    const onPopState = async () => {
      if (!guardedRef.current) return;
      guardedRef.current = false;
      // 그사이 저장했으면 묻지 않고 원래 하려던 뒤로 가기를 이어 간다.
      if (!whenRef.current) {
        window.history.back();
        return;
      }
      if (await confirmRef.current()) {
        window.history.back();
      } else {
        window.history.pushState(GUARD_STATE, "", window.location.href);
        guardedRef.current = true;
      }
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!whenRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  // 확인용 기록이 남아 있으면 그 자리를 바꿔 이동해, 이동한 뒤 뒤로 가기가 같은 페이지를 두 번 거치지 않게 한다.
  const leave = useCallback(
    async (href: string) => {
      if (whenRef.current && !(await confirmRef.current())) return;
      if (guardedRef.current) {
        guardedRef.current = false;
        router.replace(href);
      } else {
        router.push(href);
      }
    },
    [router],
  );

  return { leave };
}
