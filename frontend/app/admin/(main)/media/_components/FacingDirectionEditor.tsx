"use client";

import { Button, Input } from "@heroui/react";
import { useEffect, useRef, useState } from "react";

import {
  DEFAULT_FACING_SPREAD,
  MAX_FACING_SPREAD,
  MIN_FACING_SPREAD,
  createMarkElement,
  directionName,
  drawMediaMark,
  bearingDeg,
} from "@/components/common/media-detail/mediaFan";
import {
  type KakaoCustomOverlay,
  type KakaoMap,
  loadKakaoSdk,
} from "@/lib/kakaoMap";
import { cn } from "@/lib/utils";

type Status = "loading" | "ready" | "error";

const QUICK_DIRECTIONS: [number, string][] = [
  [0, "북"],
  [45, "북동"],
  [90, "동"],
  [135, "남동"],
  [180, "남"],
  [225, "남서"],
  [270, "서"],
  [315, "북서"],
];

/** 폼 값(문자열) → 숫자. 비었거나 숫자가 아니면 null. */
function toNum(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

/**
 * 각도 숫자 칸 — 치는 동안은 글자를 그대로 두고(범위 밖이어도), 범위 안이면 바로 반영한다.
 * 칸을 벗어나거나 Enter 를 누르면 범위에 맞춰 확정한다(비우면 null).
 * 한 글자마다 범위로 고치면 "120"을 치려다 "1"에서 10으로 바뀌어 버린다.
 */
function DraftNumberInput({
  ariaLabel,
  min,
  max,
  value,
  placeholder,
  disabled,
  onCommit,
}: {
  ariaLabel: string;
  min: number;
  max: number;
  value: number | null;
  placeholder?: string;
  disabled?: boolean;
  onCommit: (next: number | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft == null) return;
    const n = toNum(draft);
    onCommit(n == null ? null : clamp(Math.round(n), min, max));
    setDraft(null);
  };
  return (
    <Input
      variant="secondary"
      type="number"
      min={min}
      max={max}
      aria-label={ariaLabel}
      disabled={disabled}
      placeholder={placeholder}
      value={draft ?? (value == null ? "" : String(value))}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = toNum(e.target.value);
        if (n != null && n >= min && n <= max) onCommit(Math.round(n));
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      }}
      className="w-[80px]"
    />
  );
}

/**
 * 어드민 "매체 방향" — 매체 좌표 지도에서 부채꼴을 보며 방향·너비를 정한다.
 * 지도를 누르면 매체에서 그쪽으로 방향이 정해지고, 슬라이더·숫자·8방향 버튼으로도 고친다.
 * 사용자 매체 정보 팝업의 위치 지도와 같은 그림(mediaFan)이라 보이는 그대로 나간다.
 * 값은 폼 문자열로 주고받는다(방향 facing_direction, 너비 facing_spread — 둘 다 도).
 */
export function FacingDirectionEditor({
  lat,
  lng,
  direction: directionRaw,
  spread: spreadRaw,
  onDirectionChange,
  onSpreadChange,
  disabled,
}: {
  /** 매체 좌표 — 없으면 지도 대신 "주소를 먼저 골라 주세요" */
  lat: number | null;
  lng: number | null;
  direction: string;
  spread: string;
  onDirectionChange: (next: string) => void;
  onSpreadChange: (next: string) => void;
  disabled?: boolean;
}) {
  const direction = toNum(directionRaw);
  const spreadValue = toNum(spreadRaw);
  const spread = spreadValue ?? DEFAULT_FACING_SPREAD;
  const hasCoords = lat != null && lng != null;

  const setDirection = (deg: number | null) =>
    onDirectionChange(
      deg == null ? "" : String(((Math.round(deg) % 360) + 360) % 360),
    );
  // 방향을 처음 정할 때 너비도 기본값으로 함께 채운다(비워 두면 사용자 화면도 기본 너비라 같지만, 값으로 남긴다).
  const pickDirection = (deg: number) => {
    setDirection(deg);
    if (spreadValue == null) onSpreadChange(String(DEFAULT_FACING_SPREAD));
  };

  return (
    <div className="flex flex-col gap-[12px]">
      {hasCoords ? (
        <FacingMap
          lat={lat}
          lng={lng}
          direction={direction}
          spread={spread}
          onPick={disabled ? undefined : pickDirection}
        />
      ) : (
        <p className="flex h-[120px] items-center justify-center rounded-[8px] bg-gray-50 text-[13px] text-gray-500">
          주소를 골라 위도·경도가 채워지면 지도에서 방향을 정할 수 있어요.
        </p>
      )}

      <div className="flex flex-col gap-[10px]">
        <div className="flex flex-wrap items-center gap-[10px]">
          <span className="w-[48px] shrink-0 text-[13px] font-semibold text-gray-700">
            방향
          </span>
          <input
            type="range"
            min={0}
            max={359}
            step={1}
            disabled={disabled}
            aria-label="매체 방향(도)"
            value={direction ?? 0}
            onChange={(e) => pickDirection(Number(e.target.value))}
            className={cn(
              "min-w-[160px] flex-1 accent-(--color-primary)",
              direction == null && "opacity-40",
            )}
          />
          <div className="flex items-center gap-[4px]">
            <DraftNumberInput
              ariaLabel="매체 방향 각도"
              min={0}
              max={359}
              value={direction}
              placeholder="없음"
              disabled={disabled}
              onCommit={(n) =>
                n == null ? setDirection(null) : pickDirection(n)
              }
            />
            <span className="w-[56px] text-[13px] text-gray-500">
              °{direction != null && ` (${directionName(direction)})`}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-[6px] pl-[58px] max-sm:pl-0">
          {QUICK_DIRECTIONS.map(([deg, label]) => (
            <Button
              key={deg}
              size="sm"
              variant={direction === deg ? "primary" : "tertiary"}
              isDisabled={disabled}
              onPress={() => pickDirection(deg)}
            >
              {label}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            isDisabled={disabled || direction == null}
            onPress={() => {
              setDirection(null);
              onSpreadChange("");
            }}
          >
            방향 지우기
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-[10px]">
          <span className="w-[48px] shrink-0 text-[13px] font-semibold text-gray-700">
            너비
          </span>
          <input
            type="range"
            min={MIN_FACING_SPREAD}
            max={MAX_FACING_SPREAD}
            step={1}
            disabled={disabled || direction == null}
            aria-label="부채꼴 너비(도)"
            value={spread}
            onChange={(e) => onSpreadChange(e.target.value)}
            className="min-w-[160px] flex-1 accent-(--color-primary) disabled:opacity-40"
          />
          <div className="flex items-center gap-[4px]">
            <DraftNumberInput
              ariaLabel="부채꼴 너비 각도"
              min={MIN_FACING_SPREAD}
              max={MAX_FACING_SPREAD}
              value={spread}
              disabled={disabled || direction == null}
              // 비우면 기본 너비로 돌아간다.
              onCommit={(n) => onSpreadChange(n == null ? "" : String(n))}
            />
            <span className="w-[56px] text-[13px] text-gray-500">°</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 편집용 지도 — 값이 바뀌면 지도는 그대로 두고 매체 표시만 다시 그린다. */
function FacingMap({
  lat,
  lng,
  direction,
  spread,
  onPick,
}: {
  lat: number;
  lng: number;
  direction: number | null;
  spread: number;
  onPick?: (deg: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const overlayRef = useRef<KakaoCustomOverlay | null>(null);
  const markRef = useRef<HTMLDivElement | null>(null);
  // 지도 click 핸들러는 처음 한 번만 단다 — 최신 onPick·좌표는 ref 로 본다.
  const pickRef = useRef(onPick);
  const posRef = useRef({ lat, lng });
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    pickRef.current = onPick;
    posRef.current = { lat, lng };
  });

  // 지도는 한 번 만든다.
  useEffect(() => {
    let cancelled = false;
    loadKakaoSdk()
      .then(() => {
        const maps = window.kakao?.maps;
        if (!maps || cancelled) return;
        maps.load(() => {
          const container = ref.current;
          if (cancelled || !container) return;
          container.replaceChildren();
          const { lat: la, lng: ln } = posRef.current;
          const position = new maps.LatLng(la, ln);
          const map = new maps.Map(container, { center: position, level: 3 });
          const mark = createMarkElement();
          const overlay = new maps.CustomOverlay({
            position,
            content: mark,
            xAnchor: 0.5,
            yAnchor: 0.5,
          });
          overlay.setMap(map);
          maps.event.addListener(map, "click", (e) => {
            if (!e || !pickRef.current) return;
            const { lat: a, lng: b } = posRef.current;
            pickRef.current(
              bearingDeg(a, b, e.latLng.getLat(), e.latLng.getLng()),
            );
          });
          mapRef.current = map;
          overlayRef.current = overlay;
          markRef.current = mark;
          setStatus("ready");
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      overlayRef.current?.setMap(null);
      mapRef.current = null;
      overlayRef.current = null;
      markRef.current = null;
    };
  }, []);

  // 탭이 바뀌는 중처럼 칸 크기가 덜 잡힌 채 지도가 만들어질 수 있어, 칸 크기가 바뀌면 지도를 다시 맞추고 매체를 가운데로.
  useEffect(() => {
    const container = ref.current;
    const maps = window.kakao?.maps;
    if (status !== "ready" || !container || !maps) return;
    const ro = new ResizeObserver(() => {
      const map = mapRef.current;
      if (!map) return;
      map.relayout();
      map.setCenter(new maps.LatLng(posRef.current.lat, posRef.current.lng));
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [status]);

  // 주소를 다시 골라 좌표가 바뀌면 지도와 표시를 옮긴다.
  useEffect(() => {
    const maps = window.kakao?.maps;
    if (status !== "ready" || !maps) return;
    const position = new maps.LatLng(lat, lng);
    overlayRef.current?.setPosition(position);
    mapRef.current?.setCenter(position);
  }, [lat, lng, status]);

  useEffect(() => {
    if (status === "ready" && markRef.current)
      drawMediaMark(markRef.current, direction, spread);
  }, [direction, spread, status]);

  return (
    <div className="relative h-[360px] overflow-hidden rounded-[8px] bg-gray-50 max-sm:h-[280px]">
      <div ref={ref} className="h-full w-full" />
      {status !== "ready" ? (
        <p className="absolute inset-0 flex items-center justify-center text-[13px] text-gray-500">
          {status === "loading"
            ? "지도를 불러오는 중…"
            : "지도를 불러오지 못했어요."}
        </p>
      ) : (
        onPick && (
          <span className="pointer-events-none absolute top-[10px] left-[10px] z-[2] rounded-full bg-white/90 px-[10px] py-[4px] text-[12px] font-medium text-gray-700 shadow-[0px_2px_8px_rgba(0,0,0,0.15)]">
            지도를 누르면 매체에서 그쪽으로 방향이 정해져요
          </span>
        )
      )}
    </div>
  );
}
