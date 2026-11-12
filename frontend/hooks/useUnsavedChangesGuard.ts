"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

const GUARD_STATE = { unsavedChangesGuard: true };

/**
 * 저장하지 않은 수정 내용이 있을 때 페이지를 떠나기 전에 확인한다.
 *
 * - 브라우저 뒤로 가기: 수정이 생기면 같은 주소 기록을 하나 더 쌓아 둔다. 뒤로 가기를 누르면
 *   그 기록만 빠지고 화면은 그대로라, 그때 confirmLeave 를 띄워 나가기면 한 번 더 뒤로 간다.
 * - 화면 안 버튼: leave(href)로 이동하면 같은 확인을 거친다. 보내기 · 저장을 마친 뒤처럼 묻지 않고 떠날 땐
 *   leave(href, { force: true }) — 쌓아 둔 확인용 기록 자리를 바꿔 이동한다. replace: true 면 지금 기록을
 *   바꿔 끼워 이동한다(수정 화면 "취소"처럼 뒤로 가기로 이 화면에 다시 오지 않게).
 * - 새로고침·탭 닫기: 브라우저 기본 확인창(beforeunload)만 띄울 수 있다.
 * - interceptLinks: 메뉴 · 로고 같은 같은 사이트 링크(Next Link 포함)를 눌러도 같은 확인을 거친다.
 *   새 탭으로 여는 링크 · 보조키(⌘ · Ctrl · Shift · Alt)를 누른 클릭은 그대로 둔다.
 * - release(href): 저장 · 삭제처럼 묻지 않고 떠날 때 — 쌓아 둔 확인용 기록을 먼저 걷어 내,
 *   다음 뒤로 가기가 같은 화면에서 헛돌지 않게 한다. release(undefined, { back: true }) 는 걷어 낸 뒤
 *   한 번 더 뒤로 가 들어오기 전 화면으로 돌아간다(상세 → 수정 → 저장 뒤 상세처럼 기록을 쌓지 않을 때).
 */
export function useUnsavedChangesGuard(
  when: boolean,
  confirmLeave: () => Promise<boolean>,
  { interceptLinks = false }: { interceptLinks?: boolean } = {},
) {
  const router = useRouter();
  const whenRef = useRef(when);
  const confirmRef = useRef(confirmLeave);
  // 지금 쌓아 둔 확인용 기록이 맨 위에 있는지
  const guardedRef = useRef(false);
  // release 가 확인용 기록을 걷어 낸 뒤(popstate) 이어 할 일
  const pendingRef = useRef<(() => void) | null>(null);

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
    const onBack = async () => {
      const pending = pendingRef.current;
      if (pending) {
        pendingRef.current = null;
        pending();
        return;
      }
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
    // 일부 Chromium(Orca 내장 브라우저 등)은 같은 주소 기록 사이를 오갈 때 popstate 를 보내지 않는다(주소가 다르면 보냄).
    // 확인용 기록은 같은 주소라, Navigation API 의 currententrychange(traverse)로 한 번 더 받는다 — 같은 작업 안에
    // popstate 가 왔으면 그쪽이 이미 처리했으니 건너뛴다(두 번 묻지 않게).
    let lastPopAt = 0;
    const onPopState = () => {
      lastPopAt = Date.now();
      void onBack();
    };
    const onEntryChange = (event: Event) => {
      if ((event as Event & { navigationType?: string }).navigationType !== "traverse") return;
      window.setTimeout(() => {
        if (Date.now() - lastPopAt > 100) void onBack();
      }, 0);
    };
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!whenRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("popstate", onPopState);
    navigation?.addEventListener("currententrychange", onEntryChange);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("popstate", onPopState);
      navigation?.removeEventListener("currententrychange", onEntryChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  // 확인용 기록이 남아 있으면 그 자리를 바꿔 이동해, 이동한 뒤 뒤로 가기가 같은 페이지를 두 번 거치지 않게 한다.
  const leave = useCallback(
    async (
      href: string,
      {
        force = false,
        replace = false,
      }: { force?: boolean; replace?: boolean } = {},
    ) => {
      if (!force && whenRef.current && !(await confirmRef.current())) return;
      if (guardedRef.current || replace) {
        guardedRef.current = false;
        router.replace(href);
      } else {
        router.push(href);
      }
    },
    [router],
  );

  const release = useCallback(
    (
      href?: string,
      { replace = false, back = false }: { replace?: boolean; back?: boolean } = {},
    ) => {
      const go = () => {
        if (back) {
          router.back();
          return;
        }
        if (!href) return;
        if (replace) router.replace(href);
        else router.push(href);
      };
      if (!guardedRef.current) {
        go();
        return;
      }
      guardedRef.current = false;
      pendingRef.current = go;
      window.history.back();
    },
    [router],
  );

  useEffect(() => {
    if (!interceptLinks) return;
    const onClick = (event: MouseEvent) => {
      if (!whenRef.current || event.defaultPrevented) return;
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (
        (anchor.target && anchor.target !== "_self") ||
        anchor.hasAttribute("download")
      )
        return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // 같은 화면 안 이동(#…)은 막지 않는다.
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      )
        return;
      // 캡처 단계에서 멈춰 Next Link 의 이동(onClick)까지 가지 않게 한다.
      event.preventDefault();
      event.stopPropagation();
      void leave(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [interceptLinks, leave]);

  return { leave, release };
}
