"use client";

import { Modal } from "@heroui/react";
import { useEffect, useRef, useState } from "react";

import { CloseMediumIcon } from "@/components/icons";
import { type KakaoMap, loadKakaoSdk } from "@/lib/kakaoMap";
import { cn } from "@/lib/utils";

import {
  MAX_FACING_SPREAD,
  createMarkElement,
  directionName,
  drawMediaMark,
} from "./mediaFan";
import {
  CURRENT_ID,
  type BubbleOverlay,
  type PackageMember,
  MemberList,
  addNameBubble,
  focusMember,
  memberPoints,
} from "./packageMapParts";

type Status = "loading" | "ready" | "error";

/**
 * 매체 위치 지도 — 매체 정보 팝업에서 주소를 누르면 그 위에 띄운다.
 * 매체 자리에 동그라미를, 매체 방향(어드민 "매체 방향")이 있으면 그쪽으로 정한 너비만큼 부채꼴을 그린다.
 * 패키지 매체면 같은 패키지에 묶인 매체들도 이름 말풍선으로 함께 보이고, 아래 목록에서 누르면 그 자리로 간다.
 * 닫히면 부모가 바로 언마운트한다.
 */
export function MediaLocationMapModal({
  name,
  address,
  lat,
  lng,
  direction,
  spread,
  members = [],
  onClose,
}: {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  direction: number | null;
  /** 부채꼴 너비(전체 각도, 도) — 없으면 기본 너비. */
  spread: number | null;
  /** 같은 패키지에 묶인 매체(이 매체 빼고) — 없으면 이 매체만. */
  members?: PackageMember[];
  onClose: () => void;
}) {
  const [focusId, setFocusId] = useState<string | null>(null);
  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      variant="opaque"
    >
      <Modal.Container
        placement="center"
        className="sm:w-full sm:max-w-[720px] sm:p-[20px]"
      >
        <Modal.Dialog
          aria-label="매체 위치"
          className="max-h-[min(860px,calc(100dvh-80px))] w-full max-w-full gap-[12px] rounded-[20px] bg-surface p-[20px] shadow-[0px_4px_60px_0px_rgba(0,0,0,0.25)] max-sm:p-[16px]"
        >
          <Modal.CloseTrigger className="top-[20px] right-[20px] z-10 size-[28px] rounded-[11px] border border-tone-ececef bg-tone-eaeaeb p-0 text-tone-70707a max-sm:top-[16px] max-sm:right-[16px]">
            <CloseMediumIcon className="size-[24px]" />
          </Modal.CloseTrigger>

          <div className="flex min-w-0 flex-col gap-[2px] pr-[40px]">
            <p className="truncate text-[16px] font-semibold text-black">
              {name}
            </p>
            {address && (
              <p className="truncate text-[12px] text-tone-6c757d">
                {address}
              </p>
            )}
          </div>

          <Modal.Body className="m-0 flex min-h-0 flex-1 flex-col gap-[8px] overflow-hidden p-0">
            <LocationMap
              name={name}
              lat={lat}
              lng={lng}
              direction={direction}
              spread={spread}
              members={members}
              focusId={focusId}
            />
            {members.length > 0 && (
              <MemberList
                current={{ id: CURRENT_ID, name, lat, lng }}
                members={members}
                focusId={focusId}
                onFocus={setFocusId}
              />
            )}
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function LocationMap({
  name,
  lat,
  lng,
  direction,
  spread,
  members,
  focusId,
}: {
  name: string;
  lat: number;
  lng: number;
  direction: number | null;
  spread: number | null;
  members: PackageMember[];
  focusId: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const allAround = spread != null && spread >= MAX_FACING_SPREAD;
  // 팝업이 열려 있는 동안 패키지 목록은 그대로라 처음 값으로 그린다.
  const pointsRef = useRef(memberPoints(members));
  const mapRef = useRef<KakaoMap | null>(null);
  const overlaysRef = useRef(new Map<string, BubbleOverlay>());

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    loadKakaoSdk()
      .then(() => {
        const maps = window.kakao?.maps;
        if (!maps || cancelled) return;
        maps.load(() => {
          const container = ref.current;
          if (cancelled || !container) return;
          container.replaceChildren();
          const position = new maps.LatLng(lat, lng);
          const map = new maps.Map(container, { center: position, level: 3 });
          const mark = createMarkElement();
          drawMediaMark(mark, direction, spread);
          new maps.CustomOverlay({
            position,
            content: mark,
            xAnchor: 0.5,
            yAnchor: 0.5,
          }).setMap(map);
          mapRef.current = map;
          const others = pointsRef.current;
          if (others.length > 0) {
            // 패키지 매체 — 이 매체와 함께 모두 보이게 맞추고, 팝업 크기가 바뀌면 다시 맞춘다.
            // 말풍선이 점 위로 서 있으니 위쪽 여백을 더 준다.
            // 말풍선이 겹치면 이 매체를 찾기 어려워 보라 말풍선도 단다.
            addNameBubble(
              maps,
              map,
              { id: CURRENT_ID, name, lat, lng, current: true },
              overlaysRef.current,
            );
            const bounds = new maps.LatLngBounds();
            bounds.extend(position);
            for (const p of others) {
              bounds.extend(new maps.LatLng(p.lat, p.lng));
              addNameBubble(maps, map, p, overlaysRef.current);
            }
            const fit = () => {
              map.relayout();
              map.setBounds(bounds, 48, 24, 16, 24);
            };
            fit();
            observer = new ResizeObserver(fit);
            observer.observe(container);
          }
          setStatus("ready");
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [name, lat, lng, direction, spread]);

  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    const point =
      focusId === CURRENT_ID
        ? { id: CURRENT_ID, name, lat, lng }
        : pointsRef.current.find((p) => p.id === focusId);
    if (maps && map && point) {
      focusMember(maps, map, overlaysRef.current, point);
    }
  }, [focusId, name, lat, lng]);

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-[12px] bg-tone-ededef",
        members.length > 0
          ? "h-[280px] max-sm:h-[33vh]"
          : "h-[440px] max-sm:h-[60vh]",
      )}
    >
      <div ref={ref} className="h-full w-full" />
      {status !== "ready" && (
        <p className="absolute inset-0 flex items-center justify-center text-[13px] text-tone-6c757d">
          {status === "loading"
            ? "지도를 불러오는 중…"
            : "지도를 불러오지 못했어요."}
        </p>
      )}
      {/* 방향 안내 — 지도 왼쪽 위. */}
      {status === "ready" && direction != null && (
        <span className="pointer-events-none absolute top-[12px] left-[12px] z-[2] flex h-[28px] items-center gap-[6px] rounded-full border-[0.5px] border-white/40 bg-surface/80 px-[10px] text-[12px] font-medium text-black shadow-[0px_4px_16px_rgba(0,0,0,0.14)] backdrop-blur-[6px]">
          {/* 너비 360°는 사방에서 보이는 매체 — 화살표 대신 점으로. */}
          {allAround ? (
            <span className="size-[8px] rounded-full bg-red-500" aria-hidden />
          ) : (
            <svg
              viewBox="0 0 16 16"
              className="size-[14px] text-red-500"
              style={{ transform: `rotate(${direction}deg)` }}
              aria-hidden
            >
              <path d="M8 1.5 13 13 8 10.2 3 13Z" fill="currentColor" />
            </svg>
          )}
          {allAround
            ? "모든 방향에서 보이는 매체예요"
            : `${directionName(direction)}쪽을 바라보는 매체예요`}
        </span>
      )}
    </div>
  );
}
