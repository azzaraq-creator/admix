"use client";

import { Slider } from "@heroui/react";
import { useState } from "react";

const STEP = 1_000_000; // 백만원 단위 이동

const THUMB_CLASS =
  "size-[22px]! rounded-full border-2 border-primary bg-white shadow-[0px_2px_6px_rgba(163,59,209,0.35)] after:hidden data-[dragging=true]:scale-110 data-[focus-visible=true]:ring-4 data-[focus-visible=true]:ring-primary/20 max-sm:size-[20px]!";

// 백만원 단위라 "1,200만원", "1억 2,000만원"처럼 만원·억으로 읽기 쉽게 적는다.
function priceLabel(n: number): string {
  if (n <= 0) return "0원";
  const man = Math.round(n / 10_000);
  const eok = Math.floor(man / 10_000);
  const rest = man % 10_000;
  if (eok === 0) return `${rest.toLocaleString("ko-KR")}만원`;
  return rest === 0
    ? `${eok.toLocaleString("ko-KR")}억원`
    : `${eok.toLocaleString("ko-KR")}억 ${rest.toLocaleString("ko-KR")}만원`;
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
  // 외부 값(리셋 등)이 바뀌면 로컬 값도 따라간다(필터 패널은 초기화 후에도 열려 있다).
  const [draft, setDraft] = useState(() => ({
    lo: valueMin ?? rmin,
    hi: valueMax ?? rmax,
  }));
  const [prevValue, setPrevValue] = useState({ valueMin, valueMax });
  if (prevValue.valueMin !== valueMin || prevValue.valueMax !== valueMax) {
    setPrevValue({ valueMin, valueMax });
    setDraft({ lo: valueMin ?? rmin, hi: valueMax ?? rmax });
  }
  const { lo, hi } = draft;

  const span = Math.max(1, rmax - rmin);
  const maxCount = Math.max(1, ...histogram);
  const buckets = histogram.length;

  return (
    <div className="flex flex-col gap-[20px] px-[16px] py-[16px] max-sm:gap-[16px] max-sm:px-[4px] max-sm:py-[4px]">
      {/* 최저·최대 — 고른 두 값을 한 줄에 나란히 보여 준다. */}
      <div className="flex items-center gap-[8px]">
        <PriceBox label="최저" value={priceLabel(lo)} />
        <span className="shrink-0 text-[14px] text-gray-400">–</span>
        <PriceBox label="최대" value={priceLabel(hi)} />
      </div>

      {/* 분포 막대와 슬라이더를 한 덩어리로 붙인다. 슬라이더 트랙은 손잡이 자리로 양옆 12px을
          비워 두므로, 막대도 같은 여백을 줘 가격 위치가 위아래로 맞게 한다. */}
      <div className="flex flex-col">
        {buckets > 0 && (
          <div className="flex h-[56px] items-end gap-[3px] px-[12px] max-sm:h-[44px] max-sm:gap-[2px]">
            {histogram.map((count, i) => {
              const bStart = rmin + (i * span) / buckets;
              const bEnd = rmin + ((i + 1) * span) / buckets;
              const inRange = bEnd > lo && bStart < hi;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-t-[3px] transition-colors duration-150 ${inRange ? "bg-primary-300" : "bg-gray-100"}`}
                  style={{ height: `${barHeightPct(count, maxCount)}%` }}
                />
              );
            })}
          </div>
        )}

        <Slider
          aria-label="가격 범위"
          minValue={rmin}
          maxValue={rmax}
          step={STEP}
          value={[lo, hi]}
          onChange={(v) => {
            const [nextLo, nextHi] = v as number[];
            setDraft({ lo: nextLo, hi: nextHi });
          }}
          onChangeEnd={(v) => {
            const [nextLo, nextHi] = v as number[];
            onChange(nextLo, nextHi);
          }}
        >
          {/* 트랙은 얇은 4px 선으로, 손잡이는 흰 원 + 브랜드색 테두리로 바꾼다.
              (손잡이 세로 가운데는 React Aria 가 translate(-50%, -50%)로 맞춘다.) */}
          <Slider.Track className="h-[4px]! rounded-full bg-gray-100 my-[10px]">
            <Slider.Fill className="rounded-full bg-primary" />
            <Slider.Thumb
              index={0}
              aria-label="최저 가격"
              className={THUMB_CLASS}
            />
            <Slider.Thumb
              index={1}
              aria-label="최대 가격"
              className={THUMB_CLASS}
            />
          </Slider.Track>
        </Slider>

        <div className="flex justify-between px-[2px] text-[12px] text-gray-400 max-sm:text-[10px]">
          <span>{priceLabel(rmin)}</span>
          <span>{priceLabel(rmax)}</span>
        </div>
      </div>
    </div>
  );
}

function PriceBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-[2px] rounded-[14px] border border-gray-200 px-[14px] py-[10px] max-sm:rounded-[12px] max-sm:px-[12px] max-sm:py-[8px]">
      <span className="text-[12px] font-medium text-gray-500 max-sm:text-[10px]">
        {label}
      </span>
      <span className="truncate text-[16px] font-bold tabular-nums text-black max-sm:text-[13px]">
        {value}
      </span>
    </div>
  );
}
