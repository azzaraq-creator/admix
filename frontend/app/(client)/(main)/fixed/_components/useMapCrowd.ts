"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

import type { CrowdPlace } from "@/hooks/media";
import type {
  KakaoCustomOverlay,
  KakaoMap,
  KakaoPolygon,
} from "@/lib/kakaoMap";

/** 서울시 실시간 도시데이터의 혼잡도 색(서울시 지도와 같은 4단계). */
export const CROWD_LEVELS: { level: string; color: string; bg: string }[] = [
  { level: "여유", color: "#00b35c", bg: "#e8f8ef" },
  { level: "보통", color: "#f5a400", bg: "#fff6e0" },
  { level: "약간 붐빔", color: "#ff7a2e", bg: "#fff0e7" },
  { level: "붐빔", color: "#e5243b", bg: "#fff1f0" },
];
export const crowdColor = (level: string) =>
  CROWD_LEVELS.find((l) => l.level === level)?.color ?? "#9aa0b4";
export const crowdBg = (level: string) =>
  CROWD_LEVELS.find((l) => l.level === level)?.bg ?? "#f4f4f5";

// 서울시 주요 121장소 영역(백엔드 assets/geo 와 같은 파일) — 표시를 켰을 때 한 번만 받는다.
const PLACES_URL = "/geo/seoul-citydata-places.json";
type Rings = [number, number][][]; // [[경도, 위도], ...]
let ringsPromise: Promise<Map<string, Rings>> | null = null;
function loadRings(): Promise<Map<string, Rings>> {
  ringsPromise ??= fetch(PLACES_URL)
    .then((res) => (res.ok ? res.json() : { places: [] }))
    .then(
      (json: { places: { code: string; rings: Rings }[] }) =>
        new Map(json.places.map((p) => [p.code, p.rings])),
    )
    .catch(() => new Map<string, Rings>());
  return ringsPromise;
}

/** 장소 하나의 표시 — 색 점 + 장소 이름 + 혼잡도. */
function pill(
  place: CrowdPlace,
  onEnter: () => void,
  onLeave: () => void,
  onClick: () => void,
): HTMLElement {
  const color = crowdColor(place.level);
  const el = document.createElement("div");
  el.style.cssText = [
    "display:flex",
    "align-items:center",
    "gap:4px",
    "padding:3px 8px 3px 6px",
    "border-radius:999px",
    // 유리 스타일 — 반투명 바탕 + 흐림으로 뒤 지도가 비친다. 혼잡도 색은 점·글자로만(굵은 색 테두리는 유리 느낌을 가린다).
    "background:rgba(255,255,255,0.4)",
    "backdrop-filter:blur(6px) saturate(1.8)",
    "-webkit-backdrop-filter:blur(6px) saturate(1.8)",
    "border:0.5px solid rgba(255,255,255,0.5)",
    "box-shadow:0 2px 8px rgba(0,0,0,0.16)",
    "font-size:11px",
    "line-height:16px",
    "font-weight:600",
    "color:#18181b",
    "white-space:nowrap",
    "cursor:pointer",
  ].join(";");
  el.setAttribute("role", "button");
  el.setAttribute("aria-label", `${place.name} 실시간 인구 ${place.level}`);
  // 마우스를 올리면 작은 카드, 누르면(모바일도) 지하철·버스 승하차까지 담은 장소 카드를 띄운다.
  el.addEventListener("mouseenter", onEnter);
  el.addEventListener("mouseleave", onLeave);
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });

  const dot = document.createElement("span");
  dot.style.cssText = `width:8px;height:8px;border-radius:999px;background:${color};flex-shrink:0`;
  el.appendChild(dot);
  const name = document.createElement("span");
  name.textContent = place.name;
  el.appendChild(name);
  const level = document.createElement("span");
  level.textContent = place.level;
  level.style.color = color;
  el.appendChild(level);
  return el;
}

/**
 * 장소 범위 밖을 흑백으로 바꾸는 판 — 화면 3배 크기로 깔고, 범위 자리는 마스크로 뚫어 원래 색을 남긴다.
 * 판은 지도와 함께 움직이므로 끌 때는 그대로 두고, 멈출 때(idle)마다 지금 화면 기준으로 다시 맞춘다.
 * 새 마스크는 그림을 미리 풀어 둔 뒤 한 번에 바꿔 끼운다(바꾸는 순간 판이 비어 색이 번쩍이지 않게).
 * 확대·축소 중에는 판이 어긋나므로 숨기고, 그동안은 MapArea 가 지도 전체를 흑백으로 둔다.
 */
function grayBoard(map: KakaoMap) {
  const maps = window.kakao!.maps;
  // 크기 0인 기준점(화면 가운데)에 판을 붙이고 CSS로 왼쪽 위로 당긴다 — 카카오는 내용 크기를 처음에만
  // 재서(0) anchor 로는 가운데를 맞출 수 없고, 기준점이 화면 밖이면 판을 아예 그리지 않는다.
  const anchor = document.createElement("div");
  anchor.style.cssText =
    "position:relative;width:0;height:0;pointer-events:none";
  const el = document.createElement("div");
  anchor.appendChild(el);
  el.style.cssText = [
    "position:absolute",
    "visibility:hidden",
    "pointer-events:none",
    "backdrop-filter:grayscale(1)",
    "-webkit-backdrop-filter:grayscale(1)",
    "mask-size:100% 100%",
    "-webkit-mask-size:100% 100%",
  ].join(";");
  const overlay = new maps.CustomOverlay({
    position: map.getCenter(),
    content: anchor,
    xAnchor: 0,
    yAnchor: 0,
    // 장소 표시(0)·매체 핀(1~)보다 아래 — 판 위로 올라온 것은 색이 그대로 남는다.
    zIndex: -1,
  });
  overlay.setMap(map);
  // 카카오가 감싸는 바깥 상자도 마우스를 받지 않게(지도 끌기·핀 누르기가 판에 막히지 않게).
  if (anchor.parentElement) anchor.parentElement.style.pointerEvents = "none";

  let token = 0;
  /** 범위로 판을 다시 맞춘다. 판이 보이게 됐으면 true(그사이 확대·축소가 시작됐으면 false). */
  const update = async (ringsList: Rings): Promise<boolean> => {
    const my = ++token;
    const proj = map.getProjection();
    const bounds = map.getBounds();
    const ne = proj.containerPointFromCoords(bounds.getNorthEast());
    const sw = proj.containerPointFromCoords(bounds.getSouthWest());
    const w = Math.round(ne.x - sw.x);
    const h = Math.round(sw.y - ne.y);
    if (w <= 0 || h <= 0) return false;
    const d = ringsList
      .map(
        (ring) =>
          ring
            .map(([lng, lat], i) => {
              const pt = proj.containerPointFromCoords(
                new maps.LatLng(lat, lng),
              );
              return `${i ? "L" : "M"}${(pt.x + w).toFixed(1)} ${(pt.y + h).toFixed(1)}`;
            })
            .join("") + "Z",
      )
      .join("");
    // 범위끼리 겹쳐도(관광특구 안의 역 등) 모두 뚫리도록 SVG 마스크로 합친다. 뚫는 자리는 범위보다 조금
    // 넓게(굵은 선) — 범위 테두리 선이 판에 반쯤 덮여 회색으로 보이지 않게.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 3}" height="${h * 3}"><mask id="m"><rect width="100%" height="100%" fill="white"/><path d="${d}" fill="black" stroke="black" stroke-width="10" stroke-linejoin="round"/></mask><rect width="100%" height="100%" mask="url(#m)"/></svg>`;
    const src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    // 판은 위치(위경도)로 붙으므로 그림을 푸는 사이 지도를 끌어도 어긋나지 않는다.
    const position = proj.coordsFromContainerPoint(
      new maps.Point(w / 2, h / 2),
    );
    const img = new Image();
    img.src = src;
    await img.decode().catch(() => undefined);
    if (my !== token) return false;
    el.style.left = `${-1.5 * w}px`;
    el.style.top = `${-1.5 * h}px`;
    el.style.width = `${w * 3}px`;
    el.style.height = `${h * 3}px`;
    el.style.maskImage = `url("${src}")`;
    el.style.setProperty("-webkit-mask-image", `url("${src}")`);
    overlay.setPosition(position);
    el.style.visibility = "visible";
    return true;
  };
  const hide = () => {
    token++;
    el.style.visibility = "hidden";
  };
  return { update, hide, remove: () => overlay.setMap(null) };
}

// 장소 범위 모양 — 평소와 이름표에 마우스를 올렸을 때(더 진하고 굵게, 다른 범위보다 위로).
const RANGE_STYLE = {
  strokeWeight: 2,
  strokeOpacity: 0.9,
  fillOpacity: 0.14,
  zIndex: 0,
};
const RANGE_HIGHLIGHT = {
  strokeWeight: 4,
  strokeOpacity: 1,
  fillOpacity: 0.3,
  zIndex: 1,
};

/** 지도에 올라가 있는 장소 하나 — 표시(이름표)와 범위. */
type Drawn = {
  level: string;
  name: string;
  overlay: KakaoCustomOverlay;
  polygons: KakaoPolygon[];
  rings: Rings;
};

/**
 * 매체 찾기 지도 "실시간 인구" — 서울시 주요 장소 위치에 실시간 혼잡도를 띄운다.
 * 표시는 매체 핀·말풍선보다 아래(zIndex 0)에 깔아 매체 선택을 가리지 않는다.
 * 켜면 장소 범위를 혼잡도 색으로 칠해 두고, 범위 밖은 흑백으로 바꾼다(grayBoard).
 * 판이 아직 없거나 확대·축소 중이면 boardShown=false — MapArea 가 그동안 지도 전체를 흑백으로 둔다.
 * 마우스를 올리면 정보 카드를 띄울 자리(hoverEl)를 돌려준다 — 카드 내용은 MapArea 가 React(HeroUI)로 그려 넣는다.
 * 이름표를 누르면 onSelect(장소), 지도 빈 곳을 누르면 onSelect(null) — 고른 장소(selectedCode)는 범위를 강조해 둔다.
 */
export function useMapCrowd({
  mapRef,
  mapReady,
  places,
  gray = true,
  selectedCode,
  onSelect,
}: {
  mapRef: RefObject<KakaoMap | null>;
  mapReady: boolean;
  places?: CrowdPlace[] | null;
  /** 범위 밖을 흑백으로(끄면 판을 내린다). */
  gray?: boolean;
  /** 이름표를 눌러 고른 장소 */
  selectedCode?: string | null;
  onSelect?: (place: CrowdPlace | null) => void;
}) {
  const [hovered, setHovered] = useState<CrowdPlace | null>(null);
  const [hoverEl, setHoverEl] = useState<HTMLDivElement | null>(null);
  const [rings, setRings] = useState<Map<string, Rings> | null>(null);
  const active = !!places?.length;
  /** 장소 코드 → 가장 최근에 받은 데이터(정보 카드는 늘 최신 값으로). */
  const latestRef = useRef(new Map<string, CrowdPlace>());
  const drawnRef = useRef(new Map<string, Drawn>());
  const [boardShown, setBoardShown] = useState(false);
  const refreshBoardRef = useRef<(() => void) | null>(null);
  // 이름표는 한 번 그려 두고 다시 쓰므로, 누를 때 부를 함수는 늘 최신 것을 쓰게 ref 로 둔다.
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  // 표시를 켜면 범위 파일을 받는다(범위를 바로 칠한다).
  useEffect(() => {
    if (!active || rings) return;
    let cancelled = false;
    loadRings().then((loaded) => {
      if (!cancelled) setRings(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [active, rings]);

  // 지도 빈 곳을 누르면(모바일) 정보 카드를 닫는다.
  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (!mapReady || !maps || !map || !active) return;
    const close = () => {
      setHovered(null);
      onSelectRef.current?.(null);
    };
    maps.event.addListener(map, "click", close);
    return () => maps.event.removeListener(map, "click", close);
  }, [mapReady, mapRef, active]);

  // 지도를 옮길 때마다 목록이 새로 오지만, 이미 올린 장소는 그대로 두고 바뀐 것만 고친다
  // (전부 지웠다 다시 그리면 이름표·범위가 깜빡인다). 화면 밖으로 나간 장소도 끌 때까지 남겨 둔다
  // — 다시 돌아왔을 때 사라졌다 나타나지 않게.
  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (!mapReady || !maps || !map || !places?.length) return;
    const drawn = drawnRef.current;
    places.forEach((place) => {
      latestRef.current.set(place.code, place);
      const cur = drawn.get(place.code);
      // 범위 파일이 장소보다 늦게 왔으면 범위 없이 올라간 장소는 다시 그린다.
      const missingRings =
        cur?.polygons.length === 0 && !!rings?.has(place.code);
      if (
        cur &&
        cur.level === place.level &&
        cur.name === place.name &&
        !missingRings
      )
        return;
      const color = crowdColor(place.level);
      if (cur) {
        cur.overlay.setMap(null);
        cur.polygons.forEach((polygon) => polygon.setMap(null));
      }
      const overlay = new maps.CustomOverlay({
        position: new maps.LatLng(place.lat, place.lng),
        content: pill(
          place,
          () => setHovered(latestRef.current.get(place.code) ?? place),
          () => setHovered((h) => (h?.code === place.code ? null : h)),
          () => {
            setHovered(null);
            onSelectRef.current?.(latestRef.current.get(place.code) ?? place);
          },
        ),
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: 0,
      });
      overlay.setMap(map);
      const polygons = (rings?.get(place.code) ?? []).map((ring) => {
        const polygon = new maps.Polygon({
          path: ring.map(([lng, lat]) => new maps.LatLng(lat, lng)),
          ...RANGE_STYLE,
          strokeColor: color,
          fillColor: color,
        });
        polygon.setMap(map);
        return polygon;
      });
      drawn.set(place.code, {
        level: place.level,
        name: place.name,
        overlay,
        polygons,
        rings: rings?.get(place.code) ?? [],
      });
    });
    refreshBoardRef.current?.();
  }, [mapRef, mapReady, places, rings]);

  // 범위 밖 흑백 판 — 켜 둔 동안 하나만 두고, 멈출 때마다·장소가 바뀔 때마다 다시 맞춘다.
  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (!mapReady || !maps || !map || !active || !gray) return;
    const board = grayBoard(map);
    const refresh = () => {
      const ringsList = [...drawnRef.current.values()].flatMap((d) => d.rings);
      board.update(ringsList).then((ok) => {
        if (ok) setBoardShown(true);
      });
    };
    const onZoomStart = () => {
      board.hide();
      setBoardShown(false);
    };
    refreshBoardRef.current = refresh;
    refresh();
    maps.event.addListener(map, "idle", refresh);
    maps.event.addListener(map, "zoom_start", onZoomStart);
    return () => {
      maps.event.removeListener(map, "idle", refresh);
      maps.event.removeListener(map, "zoom_start", onZoomStart);
      refreshBoardRef.current = null;
      board.hide();
      board.remove();
      setBoardShown(false);
    };
  }, [mapRef, mapReady, active, gray]);

  // 끄면(또는 지도를 떠나면) 모두 내린다.
  useEffect(() => {
    if (!active) return;
    const drawn = drawnRef.current;
    const latest = latestRef.current;
    return () => {
      drawn.forEach((d) => {
        d.overlay.setMap(null);
        d.polygons.forEach((polygon) => polygon.setMap(null));
      });
      drawn.clear();
      latest.clear();
    };
  }, [active]);

  const shown = active ? hovered : null;

  // 이름표에 마우스를 올린 장소(없으면 눌러 고른 장소)의 범위를 강조한다. 목록이 새로 와 범위를 다시 그려도
  // 다시 강조되게 places 도 본다.
  const shownCode = shown?.code ?? (active ? selectedCode : null);
  useEffect(() => {
    if (!shownCode) return;
    const polygons = drawnRef.current.get(shownCode)?.polygons ?? [];
    polygons.forEach((polygon) => polygon.setOptions(RANGE_HIGHLIGHT));
    return () => polygons.forEach((polygon) => polygon.setOptions(RANGE_STYLE));
  }, [shownCode, places, rings]);

  // 정보 카드 자리.
  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (!mapReady || !maps || !map || !shown) return;
    // 카드 자리 — 크기 0인 기준점(장소 위치)에 붙이고, 카드는 CSS로 표시 바로 위 가운데에 띄운다.
    // (카드 내용은 나중에 React가 넣어 카카오가 크기를 0으로 잡으므로 anchor 로는 위치가 어긋난다.)
    // 카드는 마우스를 받지 않아 표시에서 마우스를 떼면 바로 닫힌다.
    const anchor = document.createElement("div");
    anchor.style.cssText =
      "position:relative;width:0;height:0;pointer-events:none";
    const el = document.createElement("div");
    el.style.cssText =
      "position:absolute;left:0;bottom:18px;transform:translateX(-50%);pointer-events:none";
    anchor.appendChild(el);
    const card = new maps.CustomOverlay({
      position: new maps.LatLng(shown.lat, shown.lng),
      content: anchor,
      xAnchor: 0,
      yAnchor: 0,
      zIndex: 20,
    });
    card.setMap(map);
    // 카카오가 카드를 감싸는 바깥 상자도 마우스를 받지 않게 — 받으면 표시 위를 덮어 마우스가 떠난 것으로
    // 잡혀 카드가 닫혔다 열렸다 깜빡인다.
    if (anchor.parentElement) anchor.parentElement.style.pointerEvents = "none";
    setHoverEl(el);
    return () => {
      card.setMap(null);
      setHoverEl(null);
    };
  }, [mapRef, mapReady, shown]);

  return { hovered: shown, hoverEl, boardShown };
}
