"use client";

import { useState } from "react";

const RANGE_INPUT_CLASS =
  "pointer-events-none absolute left-0 top-0 h-[20px] w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-[16px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:border-solid [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-[16px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0px_1px_2px_rgba(0,0,0,0.2)]";

const STEP = 1_000_000; // 백만원 단위 이동

function priceLabel(n: number): string {
  return `₩${n.toLocaleString("ko-KR")}`;
}

// 저가 구간에 데이터가 몰려 선형 스케일이면 막대 하나만 커진다.
// 로그 스케일로 그려 작은 구간도 보이게 한다(분포가 다양해 보이도록).
function barHeightPct(count: number, maxCount: number): number {
  if (count <= 0) return 3;
  return Math.max(8, (Math.log(count + 1) / Math.log(maxCount + 1)) * 100);
}

export function PriceRangeFilter({
  min,
  max,
  histogram,
  valueMin,
  valueMax,
  onChange,
}: {
  min: number;
  max: number;
  histogram: number[];
  valueMin: number | null;
  valueMax: number | null;
  onChange: (lo: number, hi: number) => void;
}) {
  // 슬라이더 범위를 백만원 경계로 정렬(라벨이 정수 백만원으로 떨어지도록).
  const rmin = Math.floor(min / STEP) * STEP;
  const rmax = Math.max(rmin + STEP, Math.ceil(max / STEP) * STEP);

  // 드래그 중엔 로컬 상태로만 움직이고, 손을 뗄 때 1번만 onChange(→URL 갱신) 커밋한다.
  // (매 틱마다 router.replace 하면 운영에서 페이지가 계속 재요청돼 새로고침처럼 보임)
  // 외부 값(리셋 등)이 바뀌면 부모가 key 로 remount 하여 초깃값이 갱신된다.
  const [draft, setDraft] = useState(() => ({
    lo: valueMin ?? rmin,
    hi: valueMax ?? rmax,
  }));
  const { lo, hi } = draft;

  const span = Math.max(1, rmax - rmin);
  const loPct = ((lo - rmin) / span) * 100;
  const hiPct = ((hi - rmin) / span) * 100;
  const maxCount = Math.max(1, ...histogram);
  const buckets = histogram.length;

  const commit = () => onChange(draft.lo, draft.hi);

  return (
    <div className="flex flex-col gap-[16px] px-[16px] py-[16px]">
      {buckets > 0 && (
        <div className="flex h-[48px] items-end gap-[2px]">
          {histogram.map((count, i) => {
            const bStart = rmin + (i * span) / buckets;
            const bEnd = rmin + ((i + 1) * span) / buckets;
            const inRange = bEnd >= lo && bStart <= hi;
            return (
              <div
                key={i}
                className={`flex-1 rounded-t-[2px] ${inRange ? "bg-primary" : "bg-stroke"}`}
                style={{ height: `${barHeightPct(count, maxCount)}%` }}
              />
            );
          })}
        </div>
      )}

      <div className="relative h-[20px]">
        <div className="absolute inset-x-0 top-1/2 h-[4px] -translate-y-1/2 rounded-full bg-stroke" />
        <div
          className="absolute top-1/2 h-[4px] -translate-y-1/2 rounded-full bg-primary"
          style={{ left: `${loPct}%`, right: `${100 - hiPct}%` }}
        />
        <input
          type="range"
          min={rmin}
          max={rmax}
          step={STEP}
          value={lo}
          aria-label="최저 가격"
          onChange={(e) => {
            const v = Number(e.target.value);
            setDraft((d) => ({ ...d, lo: Math.min(v, d.hi) }));
          }}
          onPointerUp={commit}
          onTouchEnd={commit}
          onKeyUp={commit}
          className={RANGE_INPUT_CLASS}
        />
        <input
          type="range"
          min={rmin}
          max={rmax}
          step={STEP}
          value={hi}
          aria-label="최대 가격"
          onChange={(e) => {
            const v = Number(e.target.value);
            setDraft((d) => ({ ...d, hi: Math.max(v, d.lo) }));
          }}
          onPointerUp={commit}
          onTouchEnd={commit}
          onKeyUp={commit}
          className={RANGE_INPUT_CLASS}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-col items-center gap-[8px]">
          <span className="text-[14px] font-medium leading-[20px] text-grey-500">
            최저
          </span>
          <span className="rounded-full bg-platinum-100 px-[12px] py-[6px] text-[16px] font-medium leading-[24px] text-[#2f3442]">
            {priceLabel(lo)}
          </span>
        </div>
        <div className="flex flex-col items-center gap-[8px]">
          <span className="text-[14px] font-medium leading-[20px] text-grey-500">
            최대
          </span>
          <span className="rounded-full bg-platinum-100 px-[12px] py-[6px] text-[16px] font-medium leading-[24px] text-[#2f3442]">
            {priceLabel(hi)}
          </span>
        </div>
      </div>
    </div>
  );
}
