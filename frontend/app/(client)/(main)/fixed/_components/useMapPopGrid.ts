"use client";

import {
  type RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

import type { PopCell } from "@/hooks/popGrid";
import type {
  KakaoCustomOverlay,
  KakaoMap,
  KakaoMouseEvent,
} from "@/lib/kakaoMap";

/**
 * 인구 분포 격자 색 — 연노랑 → 주황 → 빨강 → 진한 빨강(ColorBrewer YlOrRd, 맨 끝은 옅게 칠해도 보랏빛이 돌지 않게 따뜻한 빨강). 한 색의 진하기만 바꾸면 단계가 잘 안 갈려서
 * 단계마다 색 자체가 바뀌게 했다. 화면의 서비스 보라와도 섞이지 않는다. 하위 60%는 거의 비치게, 자료 없음은 옅은 회색.
 * short — 범례 칸 아래 글자.
 */
export const POP_LEVELS: { label: string; short: string; color: string }[] = [
  { label: "하위 60%", short: "그 외", color: "#ffeda0" },
  { label: "상위 40%", short: "40%", color: "#fed976" },
  { label: "상위 20%", short: "20%", color: "#feb24c" },
  { label: "상위 10%", short: "10%", color: "#fd8d3c" },
  { label: "상위 5%", short: "5%", color: "#e31a1c" },
  { label: "상위 1%", short: "1%", color: "#a8121c" },
];
// 가까이 보면 칸이 커서 지도 글씨를 덮는다 — 진한 단계도 아래 지도가 비치게.
const LEVEL_ALPHA = [0.12, 0.5, 0.56, 0.62, 0.66, 0.74];
// 실시간 인구를 함께 켰을 때 — 장소 구역이 잘 보이게 연하게. 너무 옅으면 아래 지도(회색·푸른 건물)가 비쳐
// 진한 빨강이 보랏빛이 된다 — 상위 단계는 0.6 넘게.
const LEVEL_ALPHA_SOFT = [0.1, 0.38, 0.44, 0.5, 0.56, 0.64];
const NO_DATA = "rgba(120,120,128,0.14)";
// 칸 숫자 — 칸이 이만큼(px) 넘게 보일 때만 적는다. 그보다 작으면 숫자가 칸을 덮어 색이 안 읽힌다.
const LABEL_MIN_CELL = 46;
// 상위 5%·1%(진한 빨강) 칸은 흰 글씨, 나머지는 진한 갈색 글씨.
const LABEL_LIGHT_FROM = 4;

/** 칸 숫자 — 짧게: 822 · 2.5천 · 1.2만. */
export function shortCount(v: number): string {
  if (v < 1000) return String(Math.round(v));
  if (v < 10000) return `${+(v / 1000).toFixed(1)}천`;
  return `${+(v / 10000).toFixed(1)}만`;
}

export function popLevel(v: number | null, breaks: number[]): number {
  if (v == null) return -1;
  let lv = 0;
  for (const b of breaks) if (v >= b) lv++;
  return lv;
}

// 마우스 자리 → 칸 찾기용 묶음(약 250m 크기 상자). 칸 중심으로 넣고 이웃 상자까지 본다.
const BUCKET_LAT = 0.00225;
const BUCKET_LNG = 0.0028;
const bucketKey = (lat: number, lng: number) =>
  `${Math.floor(lat / BUCKET_LAT)}:${Math.floor(lng / BUCKET_LNG)}`;

/** 네 모서리 사각형 안에 점이 있는지(볼록 사각형 — 변마다 같은 쪽인지). */
function inQuad(c: number[], lat: number, lng: number): boolean {
  let sign = 0;
  for (let k = 0; k < 4; k++) {
    const y1 = c[k * 2];
    const x1 = c[k * 2 + 1];
    const y2 = c[((k + 1) % 4) * 2];
    const x2 = c[((k + 1) % 4) * 2 + 1];
    const cross = (x2 - x1) * (lat - y1) - (y2 - y1) * (lng - x1);
    const s = Math.sign(cross);
    if (s === 0) continue;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

function cellIndex(cells: PopCell[]) {
  const buckets = new Map<string, number[]>();
  cells.forEach((cell, i) => {
    const c = cell[3];
    const key = bucketKey((c[0] + c[4]) / 2, (c[1] + c[5]) / 2);
    const list = buckets.get(key);
    if (list) list.push(i);
    else buckets.set(key, [i]);
  });
  return (lat: number, lng: number): number | null => {
    const bi = Math.floor(lat / BUCKET_LAT);
    const bj = Math.floor(lng / BUCKET_LNG);
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++) {
        const list = buckets.get(`${bi + di}:${bj + dj}`);
        if (!list) continue;
        for (const i of list) if (inQuad(cells[i][3], lat, lng)) return i;
      }
    return null;
  };
}

/**
 * 격자 판 — 화면 3배 크기 그림판(canvas)을 지도에 붙여 칸을 칠한다(useMapCrowd 흑백 판과 같은 방식).
 * 판은 지도와 함께 움직이므로 끌 때는 그대로 두고, 멈출 때(idle)마다 지금 화면 기준으로 다시 그린다.
 * 확대·축소 중에는 판이 어긋나므로 숨긴다. 칸 8,617개를 Polygon 으로 그리면 지도가 버벅여서 그림판에 그린다.
 * 위경도 → 화면 자리는 화면 세 점으로 맞춘 1차 변환(서울 범위·화면 3배 안에서 1~2px 이내).
 */
function gridBoard(map: KakaoMap) {
  const maps = window.kakao!.maps;
  const anchor = document.createElement("div");
  anchor.style.cssText =
    "position:relative;width:0;height:0;pointer-events:none";
  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:absolute;visibility:hidden;pointer-events:none";
  anchor.appendChild(canvas);
  // 실시간 판 — 도로 현황 선·실시간 인구 범위. 카카오 Polyline·Polygon 은 이 그림판(CustomOverlay)보다 아래 층이라
  // 격자 색에 덮이므로, 인구 분포를 켠 동안 격자 위에 같은 모양을 다시 그린다(누르기·마우스는 아래 원래 도형이 받는다).
  const ov = document.createElement("canvas");
  ov.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
  anchor.appendChild(ov);
  // 강조 판 — 누른 칸·마우스를 올린 칸 테두리. 카카오 Polygon 은 이 그림판(CustomOverlay)보다 아래 층에 그려져
  // 격자 색에 덮여 흐려지므로, 격자 판 바로 위에 같은 크기 판을 하나 더 두고 칸 두 개만 다시 그린다.
  const hl = document.createElement("canvas");
  hl.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
  anchor.appendChild(hl);
  let tx: {
    toX: (lat: number, lng: number) => number;
    toY: (lat: number, lng: number) => number;
  } | null = null;
  const overlay: KakaoCustomOverlay = new maps.CustomOverlay({
    position: map.getCenter(),
    content: anchor,
    xAnchor: 0,
    yAnchor: 0,
    // 실시간 인구 판(-1)·도로(-1)와 같은 층, 매체 핀보다 아래.
    zIndex: -2,
  });
  overlay.setMap(map);
  if (anchor.parentElement) anchor.parentElement.style.pointerEvents = "none";

  const draw = (
    cells: PopCell[],
    values: (number | null)[],
    breaks: number[],
    soft = false,
    labels: (number | null)[] | null = null,
  ) => {
    const proj = map.getProjection();
    const bounds = map.getBounds();
    const ne = proj.containerPointFromCoords(bounds.getNorthEast());
    const sw = proj.containerPointFromCoords(bounds.getSouthWest());
    const w = Math.round(ne.x - sw.x);
    const h = Math.round(sw.y - ne.y);
    if (w <= 0 || h <= 0) return false;

    // 화면 세 점(왼위·오른위·왼아래)으로 위경도 → 그림판 좌표 1차 변환을 맞춘다.
    const p0 = proj.coordsFromContainerPoint(new maps.Point(0, 0));
    const p1 = proj.coordsFromContainerPoint(new maps.Point(w, 0));
    const p2 = proj.coordsFromContainerPoint(new maps.Point(0, h));
    const [a0, b0] = [p0.getLat(), p0.getLng()];
    const dLat1 = p1.getLat() - a0;
    const dLng1 = p1.getLng() - b0;
    const dLat2 = p2.getLat() - a0;
    const dLng2 = p2.getLng() - b0;
    const det = dLng1 * dLat2 - dLat1 * dLng2;
    if (!det) return false;
    // (lat, lng) → (x, y): [lng-b0, lat-a0] = u·[dLng1, dLat1] + v·[dLng2, dLat2], x = w·u, y = h·v
    const toX = (lat: number, lng: number) =>
      (((lng - b0) * dLat2 - (lat - a0) * dLng2) / det) * w + w;
    const toY = (lat: number, lng: number) =>
      ((dLng1 * (lat - a0) - dLat1 * (lng - b0)) / det) * h + h;

    canvas.width = w * 3;
    canvas.height = h * 3;
    hl.width = w * 3;
    hl.height = h * 3;
    ov.width = w * 3;
    ov.height = h * 3;
    tx = { toX, toY };
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    // 단계마다 경로 하나로 모아 한 번에 칠한다.
    const paths = POP_LEVELS.map(() => new Path2D());
    const noData = new Path2D();
    const maxX = w * 3;
    const maxY = h * 3;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i][3];
      const x0 = toX(c[0], c[1]);
      const y0 = toY(c[0], c[1]);
      if (x0 < -50 || y0 < -50 || x0 > maxX + 50 || y0 > maxY + 50) continue;
      const lv = popLevel(values[i] ?? null, breaks);
      const path = lv < 0 ? noData : paths[lv];
      path.moveTo(x0, y0);
      for (let k = 1; k < 4; k++)
        path.lineTo(toX(c[k * 2], c[k * 2 + 1]), toY(c[k * 2], c[k * 2 + 1]));
      path.closePath();
    }
    ctx.clearRect(0, 0, maxX, maxY);
    ctx.fillStyle = NO_DATA;
    ctx.fill(noData);
    paths.forEach((path, lv) => {
      ctx.globalAlpha = (soft ? LEVEL_ALPHA_SOFT : LEVEL_ALPHA)[lv];
      ctx.fillStyle = POP_LEVELS[lv].color;
      ctx.fill(path);
    });
    ctx.globalAlpha = 1;
    const cellPx = Math.abs(
      toX(cells[0][3][0], cells[0][3][3]) - toX(cells[0][3][0], cells[0][3][1]),
    );
    // 칸이 크게 보일 때(약 12px 넘게)만 칸 사이 얇은 선 — 멀리서 보면 선이 색을 덮는다.
    if (cellPx > 12) {
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 0.5;
      paths.forEach((path) => ctx.stroke(path));
    }
    // 칸 숫자 — 충분히 확대했을 때만, 자료 없는 칸은 비운다. 작고 굵지 않은 글씨로 색을 가리지 않게.
    if (labels && cellPx >= LABEL_MIN_CELL) {
      ctx.font = `600 ${cellPx >= 80 ? 12 : 11}px ${getComputedStyle(document.body).fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let i = 0; i < cells.length; i++) {
        const n = labels[i];
        if (n == null) continue;
        const c = cells[i][3];
        const x = (toX(c[0], c[1]) + toX(c[4], c[5])) / 2;
        const y = (toY(c[0], c[1]) + toY(c[4], c[5])) / 2;
        if (x < 0 || y < 0 || x > maxX || y > maxY) continue;
        const light = popLevel(values[i] ?? null, breaks) >= LABEL_LIGHT_FROM;
        ctx.fillStyle = light ? "rgba(255,255,255,0.95)" : "rgba(66,36,8,0.82)";
        ctx.fillText(shortCount(n), x, y);
      }
    }

    // 기준점은 화면 가운데 — 카카오는 기준점이 화면 밖이면 판을 그리지 않아, 끌어도 오래 남게 가운데에 둔다.
    for (const el of [canvas, ov, hl]) {
      el.style.left = `${-1.5 * w}px`;
      el.style.top = `${-1.5 * h}px`;
      el.style.width = `${w * 3}px`;
      el.style.height = `${h * 3}px`;
    }
    overlay.setPosition(
      proj.coordsFromContainerPoint(new maps.Point(w / 2, h / 2)),
    );
    canvas.style.visibility = "visible";
    ov.style.visibility = "visible";
    hl.style.visibility = "visible";
    return true;
  };
  /** 실시간 판 다시 그리기 — 지도를 옮길 때(draw 뒤)와 실시간 자료가 바뀔 때만(마우스 움직임엔 안 그린다). */
  const drawRealtime = (rt: PopRealtime | null) => {
    const ctx = ov.getContext("2d");
    if (!ctx || !tx) return;
    const { toX, toY } = tx;
    ctx.clearRect(0, 0, ov.width, ov.height);
    if (!rt) return;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const area of rt.areas) {
      const p = new Path2D();
      for (const ring of area.rings) {
        ring.forEach(([lng, lat], i) =>
          i
            ? p.lineTo(toX(lat, lng), toY(lat, lng))
            : p.moveTo(toX(lat, lng), toY(lat, lng)),
        );
        p.closePath();
      }
      // 테두리 없이 혼잡도 색 반투명 채우기 — 붐비는 장소가 보이면서 안쪽 격자 색도 비치게.
      ctx.globalAlpha = 0.38;
      ctx.fillStyle = area.color;
      ctx.fill(p);
      ctx.globalAlpha = 1;
    }
    // 도로 선 — 소통 색(원활·서행·정체)을 얇고 옅게(격자·장소 구역보다 앞서 보이지 않게).
    for (const line of rt.lines) {
      if (line.path.length < 2) continue;
      ctx.beginPath();
      line.path.forEach(([lat, lng], i) =>
        i
          ? ctx.lineTo(toX(lat, lng), toY(lat, lng))
          : ctx.moveTo(toX(lat, lng), toY(lat, lng)),
      );
      ctx.strokeStyle = line.color;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalAlpha = 1;
  };
  /** 강조 판 다시 그리기 — 누른 칸(흰 바탕 굵은 테두리 + 파란 테두리, 안을 옅게 밝힘)·마우스를 올린 칸(얇은 파랑). */
  const highlight = (
    cells: PopCell[],
    selected: number | null,
    hovered: number | null,
  ) => {
    const ctx = hl.getContext("2d");
    if (!ctx || !tx) return;
    const { toX, toY } = tx;
    ctx.clearRect(0, 0, hl.width, hl.height);
    const quad = (i: number) => {
      const c = cells[i][3];
      const p = new Path2D();
      p.moveTo(toX(c[0], c[1]), toY(c[0], c[1]));
      for (let k = 1; k < 4; k++)
        p.lineTo(toX(c[k * 2], c[k * 2 + 1]), toY(c[k * 2], c[k * 2 + 1]));
      p.closePath();
      return p;
    };
    ctx.lineJoin = "round";
    if (hovered != null && hovered !== selected) {
      ctx.strokeStyle = OUTLINE_BLUE;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 2;
      ctx.stroke(quad(hovered));
    }
    if (selected != null) {
      const p = quad(selected);
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#ffffff";
      ctx.fill(p);
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 8;
      ctx.stroke(p);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = OUTLINE_BLUE;
      ctx.lineWidth = 3.5;
      ctx.stroke(p);
    }
    ctx.globalAlpha = 1;
  };
  const hide = () => {
    canvas.style.visibility = "hidden";
    ov.style.visibility = "hidden";
    hl.style.visibility = "hidden";
  };
  return {
    draw,
    drawRealtime,
    highlight,
    hide,
    remove: () => overlay.setMap(null),
  };
}

/** 격자 위에 다시 그릴 실시간 자료 — 도로 선(위도, 경도)·장소 범위(경도, 위도 고리). */
export interface PopRealtime {
  lines: { path: [number, number][]; color: string }[];
  areas: { rings: [number, number][][]; color: string }[];
}

// 테두리 파랑 — 노랑~빨강 격자의 반대 색이라 어느 단계 위에서도, 라이트·다크 지도 어디서도 눈에 띈다.
const OUTLINE_BLUE = "#1f6bff";

/**
 * 매체 찾기 지도 "유동인구" — 서울 250m 격자를 값의 서울 순위(상위 1·5·10·20·40%)로 칠한다.
 * 마우스를 올린 칸은 얇은 테두리(onHover 로 칸 번호·화면 자리), 누른 칸은 굵은 테두리(onSelect).
 */
export function useMapPopGrid({
  mapRef,
  mapReady,
  cells,
  values,
  breaks,
  labels = null,
  selected,
  realtime = null,
  soft = false,
  onHover,
  onSelect,
  onViewChange,
}: {
  mapRef: RefObject<KakaoMap | null>;
  mapReady: boolean;
  /** null 이면 층을 내린다 */
  cells: PopCell[] | null;
  values: (number | null)[] | null;
  breaks: number[];
  /** 칸에 적을 숫자(격자 순서) — 확대했을 때만 보인다 */
  labels?: (number | null)[] | null;
  selected: number | null;
  /** 도로 현황·실시간 인구 — 격자 위에 다시 그린다 */
  realtime?: PopRealtime | null;
  /** 실시간 인구를 함께 켬 — 격자를 연하게 */
  soft?: boolean;
  onHover: (hit: { index: number; x: number; y: number } | null) => void;
  /** 누른 칸 번호와 지도 안 화면 자리·좌표 */
  onSelect: (
    index: number | null,
    point?: { x: number; y: number; lat: number; lng: number },
  ) => void;
  /** 지도를 끌거나 확대·축소하기 시작함 — 화면 자리에 붙인 팝오버를 닫는 데 쓴다. */
  onViewChange?: () => void;
}) {
  const active = !!cells;
  const boardRef = useRef<ReturnType<typeof gridBoard> | null>(null);
  // 지도 이벤트 쪽에서 들고 있는 "마우스를 올린 칸" — 값·선택이 바뀌어 강조 판을 다시 그릴 때 쓴다.
  const hoveredRef = useRef<() => number | null>(() => null);
  const dataRef = useRef({ cells, values, breaks, labels, selected });
  const realtimeRef = useRef(realtime);
  const softRef = useRef(soft);
  const handlersRef = useRef({ onHover, onSelect, onViewChange });
  const find = useMemo(() => (cells ? cellIndex(cells) : null), [cells]);
  const findRef = useRef(find);
  // 지도 이벤트 손잡이는 한 번만 달고, 최신 값·콜백은 ref 로 본다.
  useLayoutEffect(() => {
    dataRef.current = { cells, values, breaks, labels, selected };
    realtimeRef.current = realtime;
    softRef.current = soft;
    handlersRef.current = { onHover, onSelect, onViewChange };
    findRef.current = find;
  });

  // 판 만들기 + 멈출 때마다 다시 그리기 + 마우스.
  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (!mapReady || !maps || !map || !active) return;
    const board = gridBoard(map);
    boardRef.current = board;
    let hovered: number | null = null;
    hoveredRef.current = () => hovered;
    const redraw = () => {
      const {
        cells: c,
        values: v,
        breaks: b,
        labels: l,
        selected: sel,
      } = dataRef.current;
      if (c && v && board.draw(c, v, b, softRef.current, l)) {
        board.drawRealtime(realtimeRef.current);
        board.highlight(c, sel, hovered);
      } else if (!v) board.hide();
    };
    const onZoomStart = () => {
      board.hide();
      handlersRef.current.onViewChange?.();
    };
    const onDragStart = () => handlersRef.current.onViewChange?.();
    let frame = 0;
    const onMove = (e?: KakaoMouseEvent) => {
      if (!e) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const idx =
          findRef.current?.(e.latLng.getLat(), e.latLng.getLng()) ?? null;
        const c = dataRef.current.cells;
        if (idx !== hovered) {
          hovered = idx;
          if (c) board.highlight(c, dataRef.current.selected, hovered);
        }
        if (idx == null) handlersRef.current.onHover(null);
        else {
          const pt = map.getProjection().containerPointFromCoords(e.latLng);
          handlersRef.current.onHover({ index: idx, x: pt.x, y: pt.y });
        }
      });
    };
    const onOut = () => {
      cancelAnimationFrame(frame);
      hovered = null;
      const c = dataRef.current.cells;
      if (c) board.highlight(c, dataRef.current.selected, null);
      handlersRef.current.onHover(null);
    };
    const onClick = (e?: KakaoMouseEvent) => {
      if (!e) return;
      const pt = map.getProjection().containerPointFromCoords(e.latLng);
      const lat = e.latLng.getLat();
      const lng = e.latLng.getLng();
      handlersRef.current.onSelect(findRef.current?.(lat, lng) ?? null, {
        x: pt.x,
        y: pt.y,
        lat,
        lng,
      });
    };
    redraw();
    maps.event.addListener(map, "idle", redraw);
    maps.event.addListener(map, "zoom_start", onZoomStart);
    maps.event.addListener(map, "dragstart", onDragStart);
    maps.event.addListener(map, "mousemove", onMove);
    maps.event.addListener(map, "mouseout", onOut);
    maps.event.addListener(map, "click", onClick);
    return () => {
      cancelAnimationFrame(frame);
      maps.event.removeListener(map, "idle", redraw);
      maps.event.removeListener(map, "zoom_start", onZoomStart);
      maps.event.removeListener(map, "dragstart", onDragStart);
      maps.event.removeListener(map, "mousemove", onMove);
      maps.event.removeListener(map, "mouseout", onOut);
      maps.event.removeListener(map, "click", onClick);
      board.remove();
      boardRef.current = null;
      handlersRef.current.onHover(null);
    };
  }, [mapRef, mapReady, active]);

  // 값이 바뀌면 지금 화면 그대로 다시 칠한다.
  useEffect(() => {
    const board = boardRef.current;
    if (!board || !cells) return;
    if (values && board.draw(cells, values, breaks, soft, labels)) {
      board.drawRealtime(realtimeRef.current);
      board.highlight(cells, selected, hoveredRef.current());
    } else if (!values) board.hide();
    // 누른 칸이 바뀔 때는 강조 판만 — selected 는 아래 효과가 맡는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, values, breaks, soft, labels]);

  // 실시간 자료가 바뀌면 실시간 판만 다시.
  useEffect(() => {
    boardRef.current?.drawRealtime(realtime);
  }, [realtime]);

  // 누른 칸이 바뀌면 강조 판만 다시 그린다.
  useEffect(() => {
    const board = boardRef.current;
    if (!board || !cells) return;
    board.highlight(cells, selected, hoveredRef.current());
  }, [cells, selected]);
}
