"use client";

import { useEffect } from "react";

import { hasBackButton } from "@/hooks/useCloseOnBack";
import { registerBackClose } from "@/lib/backClose";

/** HeroUI Drawer·Modal(AlertDialog 포함)의 바깥 판 — 화면에 붙은 것을 열린 팝업으로 본다. */
const BACKDROP_SELECTOR = [
  '[data-slot="drawer-backdrop"]',
  '[data-slot="modal-backdrop"]',
  '[data-slot="alert-dialog-backdrop"]',
].join(",");

/** 닫기 버튼처럼 Escape 키를 보내 닫는다 — 팝업마다 닫는 함수를 따로 연결하지 않아도 된다. */
function sendEscape(backdrop: Element) {
  const target =
    backdrop.querySelector('[role="dialog"], [role="alertdialog"]') ??
    backdrop;
  target.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      bubbles: true,
      cancelable: true,
    }),
  );
}

const isClosing = (el: Element) =>
  !el.isConnected || el.hasAttribute("data-exiting");

/**
 * 화면 틀에 한 번 둔다 — 안드로이드 휴대폰에서 Drawer·Modal이 열려 있을 때 뒤로가기를 누르면 페이지를 옮기지 않고
 * 맨 위 팝업을 닫는다. 팝업이 화면에 붙고 떨어지는 것을 지켜보므로 팝업 쪽은 고칠 필요가 없다.
 */
export function BackCloseOverlays() {
  useEffect(() => {
    if (!hasBackButton()) return;
    const opened = new Map<Element, () => void>();

    const sync = () => {
      for (const [el, release] of opened) {
        if (!isClosing(el)) continue;
        opened.delete(el);
        release();
      }
      document.querySelectorAll(BACKDROP_SELECTOR).forEach((el) => {
        if (opened.has(el) || isClosing(el)) return;
        const release = registerBackClose(() => {
          sendEscape(el);
          // Escape로 닫히지 않는 팝업이면 다시 뒤로가기를 받도록 기록을 새로 쌓는다.
          setTimeout(() => {
            if (opened.get(el) !== release || isClosing(el)) return;
            opened.delete(el);
            sync();
          }, 150);
        });
        opened.set(el, release);
      });
    };

    sync();
    // 팝업은 body 바로 아래에 붙는다 — 지도 타일처럼 안쪽에서 잦게 바뀌는 것은 건너뛴다.
    const observer = new MutationObserver((records) => {
      if (
        records.some(
          (record) =>
            record.type === "attributes" || record.target === document.body,
        )
      )
        sync();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-exiting"],
    });
    return () => {
      observer.disconnect();
      opened.forEach((release) => release());
    };
  }, []);

  return null;
}
