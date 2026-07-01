"use client";

const RANGE_INPUT_CLASS =
  "pointer-events-none absolute left-0 top-0 h-[20px] w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-[16px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#00aaa4] [&::-moz-range-thumb]:border-solid [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-[16px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#00aaa4] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0px_1px_2px_rgba(0,0,0,0.2)]";

const STEP = 1_000_000; // 백만원 단위 이동

function priceLabel(n: number): string {
  return `${Math.round(n / STEP).toLocaleString("ko-KR")}백만원`;
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
  const lo = valueMin ?? rmin;
  const hi = valueMax ?? rmax;
  const span = Math.max(1, rmax - rmin);
  const loPct = ((lo - rmin) / span) * 100;
  const hiPct = ((hi - rmin) / span) * 100;
  const maxCount = Math.max(1, ...histogram);
  const buckets = histogram.length;

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
                className={`flex-1 rounded-t-[2px] ${inRange ? "bg-[#00aaa4]" : "bg-[#e4e5ee]"}`}
                style={{ height: `${barHeightPct(count, maxCount)}%` }}
              />
            );
          })}
        </div>
      )}

      <div className="relative h-[20px]">
        <div className="absolute inset-x-0 top-1/2 h-[4px] -translate-y-1/2 rounded-full bg-[#e4e5ee]" />
        <div
          className="absolute top-1/2 h-[4px] -translate-y-1/2 rounded-full bg-[#00aaa4]"
          style={{ left: `${loPct}%`, right: `${100 - hiPct}%` }}
        />
        <input
          type="range"
          min={rmin}
          max={rmax}
          step={STEP}
          value={lo}
          aria-label="최저 가격"
          onChange={(e) => onChange(Math.min(Number(e.target.value), hi), hi)}
          className={RANGE_INPUT_CLASS}
        />
        <input
          type="range"
          min={rmin}
          max={rmax}
          step={STEP}
          value={hi}
          aria-label="최대 가격"
          onChange={(e) => onChange(lo, Math.max(Number(e.target.value), lo))}
          className={RANGE_INPUT_CLASS}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-[2px]">
          <span className="text-[12px] font-medium leading-[16px] text-[#757575]">
            최저
          </span>
          <span className="text-[16px] font-medium leading-[24px] text-[#2f3442]">
            {priceLabel(lo)}
          </span>
        </div>
        <div className="flex flex-col items-end gap-[2px]">
          <span className="text-[12px] font-medium leading-[16px] text-[#757575]">
            최대
          </span>
          <span className="text-[16px] font-medium leading-[24px] text-[#2f3442]">
            {priceLabel(hi)}
          </span>
        </div>
      </div>
    </div>
  );
}
