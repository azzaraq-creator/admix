"use client";

import { Button } from "@heroui/react";
import { Check, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/*
 * 손 서명 칸 — 마우스 · 손가락 · 펜으로 그린다(기본협약 협약서 단계, 2026-11-10 사용자).
 * 그린 선(점 목록)을 들고 있다가 칸 크기가 바뀌면 다시 그린다(캔버스는 크기가 바뀌면 지워진다).
 * 그리고 "완료"를 누르면 투명 바탕 PNG(data URL)를 onChange 로 넘기고 칸을 잠근다(11-10 사용자: "완료 버튼을 넣어서 완료가 되면 서명 완료").
 * 너무 짧은 선(점 하나 등)은 서명으로 치지 않아 "완료"가 꺼져 있다. 다시 하려면 "다시 그리기"(지우고 onChange(null)).
 * 내보내는 그림은 화면 배율과 상관없이 칸 크기의 2배로 맞춘다(파일 크기를 일정하게).
 * 바탕은 다크 모드에서도 흰 종이 — 잉크(짙은 남색)를 그대로 저장해 계약서 · 인쇄에 쓴다.
 * defaultValue(전에 완료한 PNG)를 주면 그 그림을 깔고 완료된 채로 시작한다 — 단계를 오가도 서명이 남아 보이게.
 */

type Point = { x: number; y: number };

const INK = "#161a2e";
const LINE_WIDTH = 2.4;
const EXPORT_SCALE = 2;
/** 선 길이 합이 이보다 짧으면(px) 서명으로 치지 않는다. */
const MIN_INK_LENGTH = 40;

function drawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Point[][],
  scale: number,
) {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = LINE_WIDTH;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const pts of strokes) {
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, LINE_WIDTH / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    // 점 사이 가운데를 이어 부드럽게(quadratic).
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }
  ctx.restore();
}

/** 깔아 둔 전 서명 — 내보낸 크기(EXPORT_SCALE배)라 칸 좌표로는 1/EXPORT_SCALE 로 그린다. */
function drawBase(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  scale: number,
) {
  if (!img) return;
  const k = scale / EXPORT_SCALE;
  ctx.drawImage(img, 0, 0, img.naturalWidth * k, img.naturalHeight * k);
}

const inkLength = (strokes: Point[][]) =>
  strokes.reduce(
    (sum, pts) =>
      sum +
      pts
        .slice(1)
        .reduce((s, p, i) => s + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0),
    0,
  );

export function SignaturePad({
  defaultValue,
  onChange,
  className,
  height = 160,
  label = "서명",
  completeDisabled = false,
}: {
  /** 전에 그린 서명(PNG data URL) — 처음에 깔아 둔다. */
  defaultValue?: string | null;
  /** "완료"를 누르면 PNG data URL, "다시 그리기"면 null. */
  onChange: (dataUrl: string | null) => void;
  /** 서명 말고 다른 것이 남아 "완료"를 막을 때(예: 서명자 이름이 비었다). */
  completeDisabled?: boolean;
  className?: string;
  height?: number;
  label?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const drawing = useRef<number | null>(null);
  /** 깔아 둔 전 서명 그림. */
  const base = useRef<HTMLImageElement | null>(null);
  const [empty, setEmpty] = useState(!defaultValue);
  /** 서명으로 칠 만큼 그렸는지 — "완료"를 켠다. */
  const [hasInk, setHasInk] = useState(!!defaultValue);
  /** 완료 — 칸을 잠그고 그림을 넘긴 상태. */
  const [done, setDone] = useState(!!defaultValue);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBase(ctx, base.current, dpr);
    drawStrokes(ctx, strokes.current, dpr);
  }, [height]);

  // 전 서명 — 처음 한 번만 깐다(그 뒤 바뀌는 값은 이 칸이 내보낸 것).
  const initial = useRef(defaultValue);
  useEffect(() => {
    if (!initial.current) return;
    const img = new Image();
    img.onload = () => {
      base.current = img;
      redraw();
    };
    img.src = initial.current;
  }, [redraw]);

  useEffect(() => {
    redraw();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => redraw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [redraw]);

  const pointOf = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const exportPng = (): string | null => {
    const wrap = wrapRef.current;
    if (!wrap) return null;
    if (!base.current && inkLength(strokes.current) < MIN_INK_LENGTH)
      return null;
    const out = document.createElement("canvas");
    out.width = Math.round(wrap.clientWidth * EXPORT_SCALE);
    out.height = Math.round(height * EXPORT_SCALE);
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    drawBase(ctx, base.current, EXPORT_SCALE);
    drawStrokes(ctx, strokes.current, EXPORT_SCALE);
    return out.toDataURL("image/png");
  };

  const finish = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawing.current !== e.pointerId) return;
    drawing.current = null;
    setHasInk(inkLength(strokes.current) >= MIN_INK_LENGTH);
  };

  const complete = () => {
    const png = exportPng();
    if (!png) return;
    setDone(true);
    onChange(png);
  };

  const clear = () => {
    strokes.current = [];
    base.current = null;
    setEmpty(true);
    setHasInk(false);
    setDone(false);
    redraw();
    onChange(null);
  };

  return (
    <div className={cn("flex flex-col gap-[8px]", className)}>
      <div
        ref={wrapRef}
        className={cn(
          "relative w-full overflow-hidden rounded-[19px] border bg-white transition-colors",
          done ? "border-gray-100" : "border-gray-200",
        )}
        style={{ height }}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={
            done
              ? `${label} 완료`
              : `${label} 칸 — 마우스나 손가락으로 그려 주세요`
          }
          // 손가락으로 그릴 때 화면이 같이 움직이지 않게. 완료하면 더 그리지 않는다.
          className={cn(
            "absolute inset-0 touch-none",
            done ? "cursor-default" : "cursor-crosshair",
          )}
          onPointerDown={(e) => {
            if (done || drawing.current !== null) return;
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = e.pointerId;
            strokes.current.push([pointOf(e)]);
            setEmpty(false);
            redraw();
          }}
          onPointerMove={(e) => {
            if (drawing.current !== e.pointerId) return;
            const pts = strokes.current[strokes.current.length - 1];
            const p = pointOf(e);
            const prev = pts[pts.length - 1];
            if (Math.hypot(p.x - prev.x, p.y - prev.y) < 1) return;
            pts.push(p);
            redraw();
          }}
          onPointerUp={finish}
          onPointerCancel={finish}
        />
        {/* 서명 기준선 · 안내 — 그리기 시작하면 안내 글은 사라진다. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-[20px] bottom-[34px] border-b border-dashed border-gray-300"
        />
        {empty && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] text-gray-400"
          >
            여기에 서명해 주세요
          </span>
        )}
      </div>
      <div className="flex items-center justify-end gap-[8px]">
        <Button size="sm" variant="tertiary" isDisabled={empty} onPress={clear}>
          <RotateCcw className="size-[14px]" />
          다시 그리기
        </Button>
        {!done && (
          <Button
            size="sm"
            variant="primary"
            isDisabled={!hasInk || completeDisabled}
            onPress={complete}
          >
            <Check className="size-[14px]" />
            완료
          </Button>
        )}
      </div>
    </div>
  );
}
