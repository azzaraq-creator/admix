"use client";

import { Modal } from "@heroui/react";
import { useEffect, useRef, useState } from "react";

import { CloseMediumIcon } from "@/components/icons";
import { loadKakaoSdk } from "@/lib/kakaoMap";

import {
  MAX_FACING_SPREAD,
  createMarkElement,
  directionName,
  drawMediaMark,
} from "./mediaFan";

type Status = "loading" | "ready" | "error";

/**
 * 매체 위치 지도 — 매체 정보 팝업에서 주소를 누르면 그 위에 띄운다.
 * 매체 자리에 동그라미를, 매체 방향(어드민 "매체 방향")이 있으면 그쪽으로 정한 너비만큼 부채꼴을 그린다.
 * 닫히면 부모가 바로 언마운트한다.
 */
export function MediaLocationMapModal({
  name,
  address,
  lat,
  lng,
  direction,
  spread,
  onClose,
}: {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  direction: number | null;
  /** 부채꼴 너비(전체 각도, 도) — 없으면 기본 너비. */
  spread: number | null;
  onClose: () => void;
}) {
  return (
    <Modal
      isOpen
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Modal.Backdrop variant="opaque">
        <Modal.Container
          placement="center"
          className="sm:w-full sm:max-w-[720px] sm:p-[20px]"
        >
          <Modal.Dialog
            aria-label="매체 위치"
            className="w-full max-w-full gap-[12px] rounded-[20px] bg-surface p-[20px] shadow-[0px_4px_60px_0px_rgba(0,0,0,0.25)] max-sm:p-[16px]"
          >
            <Modal.CloseTrigger className="top-[20px] right-[20px] z-10 size-[28px] rounded-[14px] border border-tone-ececef bg-tone-eaeaeb p-0 text-tone-70707a max-sm:top-[16px] max-sm:right-[16px]">
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

            <Modal.Body className="m-0 p-0">
              <LocationMap
                lat={lat}
                lng={lng}
                direction={direction}
                spread={spread}
              />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function LocationMap({
  lat,
  lng,
  direction,
  spread,
}: {
  lat: number;
  lng: number;
  direction: number | null;
  spread: number | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const allAround = spread != null && spread >= MAX_FACING_SPREAD;

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
          setStatus("ready");
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [lat, lng, direction, spread]);

  return (
    <div className="relative h-[440px] overflow-hidden rounded-[12px] bg-tone-ededef max-sm:h-[60vh]">
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
