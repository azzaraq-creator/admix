"use client";

import type { KakaoCustomOverlay, KakaoMap, KakaoMaps } from "@/lib/kakaoMap";
import { cn } from "@/lib/utils";

/**
 * 패키지 매체를 지도에 이름 말풍선으로 올리는 조각 — 패키지 팝업(PackageMembers)과
 * 매체 위치 지도(MediaLocationMapModal)가 함께 쓴다.
 */

/** 지도에 올릴 매체 — 지금 보고 있는 매체(current)는 보라 말풍선으로. */
export type MapPoint = {
  id?: string;
  name: string;
  lat: number;
  lng: number;
  current?: boolean;
};

/** 목록·지도에 보일 패키지 매체 — 좌표가 없으면 목록에만 보이고 누를 수 없다. */
export type PackageMember = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
};

// 맨 앞 말풍선 순서 — 패키지 매체 < 지금 보는 매체 < 마우스를 올리거나 목록에서 고른 매체.
const Z_MEMBER = 1;
const Z_CURRENT = 2;
const Z_FRONT = 3;

/** 지도에 올린 말풍선 — 목록에서 고르면 맨 앞으로 올리고 테두리를 바꾼다. */
export type BubbleOverlay = {
  overlay: KakaoCustomOverlay;
  box: HTMLElement;
  tail: SVGPathElement;
  /** 고르지 않았을 때 순서 */
  base: number;
};

/** 지금 보고 있는 매체의 목록·말풍선 키 — 패키지 매체 id 와 겹치지 않는다. */
export const CURRENT_ID = "__current__";

// 목록에서 고른 말풍선(연한 보라 바탕·보라 글씨) ↔ 보통 말풍선(흰 바탕).
const SELECTED_LOOK = ["border-primary-200", "bg-primary-100", "text-primary"];
const NORMAL_LOOK = ["border-tone-ececef", "bg-surface", "text-black"];

/** 좌표가 있는 패키지 매체만 지도 점으로. */
export function memberPoints(members: PackageMember[]): MapPoint[] {
  return members.flatMap((m) =>
    m.lat != null && m.lng != null
      ? [{ id: m.id, name: m.name, lat: m.lat, lng: m.lng }]
      : [],
  );
}

/** 이름 말풍선을 지도에 올린다 — 마우스를 올리면 맨 앞으로. id 가 있으면 overlays 에 담는다. */
export function addNameBubble(
  maps: KakaoMaps,
  map: KakaoMap,
  p: MapPoint,
  overlays: Map<string, BubbleOverlay>,
) {
  const base = p.current ? Z_CURRENT : Z_MEMBER;
  const { el: content, box, tail } = nameBubble(p);
  const overlay = new maps.CustomOverlay({
    position: new maps.LatLng(p.lat, p.lng),
    content,
    xAnchor: 0.5,
    yAnchor: 1,
    zIndex: base,
  });
  overlay.setMap(map);
  content.addEventListener("mouseenter", () => overlay.setZIndex(Z_FRONT));
  content.addEventListener("mouseleave", () => overlay.setZIndex(base));
  if (p.id) overlays.set(p.id, { overlay, box, tail, base });
}

/** 목록에서 고른 매체로 지도를 옮기고 그 말풍선을 맨 앞에, 연한 보라 바탕으로. */
export function focusMember(
  maps: KakaoMaps,
  map: KakaoMap,
  overlays: Map<string, BubbleOverlay>,
  point: MapPoint,
) {
  for (const [id, { overlay, box, tail, base }] of overlays) {
    const selected = id === point.id;
    overlay.setZIndex(selected ? Z_FRONT : base);
    // 지금 보는 매체는 늘 보라 바탕이라 바꾸지 않는다.
    if (id === CURRENT_ID) continue;
    box.classList.remove(...(selected ? NORMAL_LOOK : SELECTED_LOOK));
    box.classList.add(...(selected ? SELECTED_LOOK : NORMAL_LOOK));
    tailLook(tail, selected);
  }
  map.setCenter(new maps.LatLng(point.lat, point.lng));
  if (map.getLevel() > 3) map.setLevel(3);
}

/** 이름 말풍선 — 아래 꼬리 끝이 매체 자리. 지금 보는 매체는 보라 바탕. */
function nameBubble(p: MapPoint): {
  el: HTMLElement;
  box: HTMLElement;
  tail: SVGPathElement;
} {
  const el = document.createElement("div");
  el.className = "flex cursor-default flex-col items-center";
  const box = document.createElement("span");
  box.className = cn(
    "max-w-[180px] truncate rounded-[8px] px-[8px] py-[4px] text-[12px] leading-[16px] font-semibold whitespace-nowrap shadow-[0px_2px_8px_rgba(0,0,0,0.18)]",
    p.current
      ? "bg-primary text-white"
      : "border border-tone-ececef bg-surface text-black",
  );
  box.textContent = p.name;
  // 꼬리는 SVG 삼각형 — 양옆 선만 그어 말풍선 테두리와 이어지고, 위로 겹쳐 그 사이 테두리를 덮는다.
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "14");
  svg.setAttribute("height", "9");
  svg.setAttribute("viewBox", "0 0 14 9");
  svg.style.cssText = "display:block;margin-top:-1px;overflow:visible;";
  const tail = document.createElementNS(SVG_NS, "path");
  tail.setAttribute("d", "M0 0 L7 8 L14 0");
  tail.setAttribute("stroke-linejoin", "round");
  if (p.current) tail.setAttribute("fill", "var(--color-primary)");
  else tailLook(tail, false);
  svg.append(tail);
  el.append(box, svg);
  return { el, box, tail };
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** 꼬리 색 — 말풍선 몸통과 같은 바탕·테두리(고르면 연한 보라, 아니면 흰 바탕·회색 선). */
function tailLook(tail: SVGPathElement, selected: boolean) {
  tail.setAttribute(
    "fill",
    selected ? "var(--color-primary-100)" : "var(--color-surface)",
  );
  tail.setAttribute(
    "stroke",
    selected ? "var(--color-primary-200)" : "var(--color-tone-ececef)",
  );
}

/**
 * 지도 아래 패키지 매체 목록 — 맨 위는 지금 보는 매체("현재 매체"), 누르면 지도가 그 매체로 간다.
 * 팝업 안에서 이 목록만 스크롤한다(지도는 그대로).
 */
export function MemberList({
  current,
  members,
  focusId,
  onFocus,
}: {
  /** 지금 보는 매체 — 좌표가 없으면 목록에만 보이고 누를 수 없다. */
  current: PackageMember | null;
  members: PackageMember[];
  focusId: string | null;
  onFocus: (id: string) => void;
}) {
  const rows = [
    ...(current ? [{ ...current, id: CURRENT_ID }] : []),
    ...members,
  ];
  return (
    <>
      <p className="shrink-0 pt-[4px] text-[12px] font-semibold text-tone-6c757d">
        함께 묶인 매체 {members.length.toLocaleString()}개
      </p>
      <ul className="flex min-h-0 flex-1 flex-col divide-y divide-tone-ececef overflow-y-auto overscroll-contain">
        {rows.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              disabled={m.lat == null || m.lng == null}
              onClick={() => onFocus(m.id)}
              className={cn(
                "flex w-full items-center gap-[6px] py-[8px] text-left text-[13px] text-black enabled:hover:text-primary",
                focusId === m.id && "font-semibold text-primary",
              )}
            >
              {m.id === CURRENT_ID && (
                <span className="shrink-0 rounded-[4px] bg-primary px-[5px] py-px text-[11px] leading-[16px] font-semibold text-white">
                  현재 매체
                </span>
              )}
              <span className="min-w-0">{m.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
