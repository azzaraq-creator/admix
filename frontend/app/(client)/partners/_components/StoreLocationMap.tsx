"use client";

import { useEffect, useRef, useState } from "react";

import {
  bubbleCss,
  markerSrc,
} from "@/app/(client)/(main)/fixed/_components/useMapMarkers";
import { loadKakaoSdk } from "@/lib/kakaoMap";
import { PARTNERS_MEDIA_CATEGORY, PARTNERS_MEDIA_SMALL } from "@/lib/partners";
import { cn } from "@/lib/utils";

// 홈 지도 핀(32px)보다 한 단계 크게 — 주변 가게 · 건물 아이콘 사이에서 우리 매장이 먼저 보이게.
const PIN_SIZE = 40;

/**
 * 우리 매장 핀 — 홈 지도에서 고른 매장과 같은 모양(진한 커피색 포커스 핀 + 매장명 말풍선)에
 * 흰 테두리와 퍼지는 물결을 더해 눈에 띄게 한다. 움직임 줄이기를 켠 사용자는 물결 대신 옅은 원만.
 * 기준점은 핀 원 가운데(CustomOverlay xAnchor · yAnchor 0.5).
 */
function createStorePin() {
  const el = document.createElement("div");
  el.style.cssText = `position:relative;width:${PIN_SIZE}px;height:${PIN_SIZE}px;pointer-events:none;`;

  // 퍼지는 물결 — 핀 원(지름 32px)과 같은 크기에서 시작한다.
  const halo = document.createElement("div");
  halo.style.cssText =
    "position:absolute;inset:4px;border-radius:9999px;background:rgba(156,91,46,0.45);";
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (reduceMotion) {
    halo.style.transform = "scale(1.7)";
    halo.style.opacity = "0.35";
  } else {
    halo.animate(
      [
        { transform: "scale(1)", opacity: 0.6 },
        { transform: "scale(2.4)", opacity: 0 },
      ],
      {
        duration: 1800,
        iterations: Infinity,
        easing: "cubic-bezier(0, 0, 0.2, 1)",
      },
    );
  }

  // 흰 테두리 — 핀 원보다 2px 크게 깔아 지도 위에서 또렷하게.
  const ring = document.createElement("div");
  ring.style.cssText =
    "position:absolute;inset:2px;border-radius:9999px;background:#ffffff;box-shadow:0 2px 8px rgba(26,16,37,0.28);";

  const img = document.createElement("img");
  img.src = markerSrc(
    {
      categoryLarge: PARTNERS_MEDIA_CATEGORY,
      categorySmall: PARTNERS_MEDIA_SMALL,
    },
    true,
  );
  img.alt = "";
  img.draggable = false;
  img.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";

  // 매장명 말풍선 — 홈 지도 선택 말풍선과 같은 진한 커피색, 핀 바로 위.
  const css = bubbleCss(true, PARTNERS_MEDIA_CATEGORY);
  const bubble = document.createElement("div");
  bubble.style.cssText = `${css.wrap}position:absolute;left:50%;bottom:100%;transform:translateX(-50%);cursor:default;`;
  const label = document.createElement("div");
  label.style.cssText = css.box;
  const tail = document.createElement("div");
  tail.style.cssText = css.tail;
  bubble.append(label, tail);

  el.append(halo, ring, img, bubble);
  return { el, label };
}

/**
 * 내 매장 위치 지도 — 홈 지도와 같은 콜라보 핀(커피색 원 + 커피잔)을 고른 매장처럼 강조해 매장 자리에 꽂는다.
 * 그림처럼 보기만 한다(끌기 · 휠 확대 없음). 좌표가 바뀌면(주소를 고치는 중) 다시 그리고,
 * 매장명은 지도를 다시 그리지 않고 말풍선 글자만 바꾼다(입력하는 중에도).
 */
export function StoreLocationMap({
  latitude,
  longitude,
  name,
  level = 4,
  className,
}: {
  latitude: number;
  longitude: number;
  name: string;
  level?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const nameRef = useRef(name);
  const labelRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  // 지도보다 먼저 선언 — 처음 그릴 때 이미 지금 이름을 알고 있게.
  useEffect(() => {
    nameRef.current = name;
    const label = labelRef.current;
    if (label) {
      label.textContent = name;
      label.title = name;
    }
  }, [name]);

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    loadKakaoSdk()
      .then(() => {
        const maps = window.kakao?.maps;
        const container = ref.current;
        if (cancelled || !maps || !container) return;
        maps.load(() => {
          if (cancelled || !container) return;
          container.innerHTML = "";
          const center = new maps.LatLng(latitude, longitude);
          const map = new maps.Map(container, {
            center,
            level,
            draggable: false,
            scrollwheel: false,
            disableDoubleClickZoom: true,
          });
          const pin = createStorePin();
          pin.label.textContent = nameRef.current;
          pin.label.title = nameRef.current;
          labelRef.current = pin.label;
          new maps.CustomOverlay({
            position: center,
            content: pin.el,
            xAnchor: 0.5,
            yAnchor: 0.5,
            zIndex: 10,
          }).setMap(map);
          // 카드 폭이 바뀌면(화면 크기 · 사이드바 접기) 다시 맞추고 매장을 가운데로.
          observer = new ResizeObserver(() => {
            map.relayout();
            map.setCenter(center);
          });
          observer.observe(container);
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      observer?.disconnect();
      labelRef.current = null;
    };
  }, [latitude, longitude, level]);

  return (
    <div className={cn("relative bg-gray-100", className)}>
      <div ref={ref} className="absolute inset-0" />
      {failed && (
        <p className="absolute inset-0 flex items-center justify-center text-[13px] text-gray-400">
          지도를 불러오지 못했어요.
        </p>
      )}
    </div>
  );
}
