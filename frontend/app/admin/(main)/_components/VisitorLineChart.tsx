"use client";

import { useState } from "react";

import { YearSelect } from "./YearSelect";

const MONTHS = [
  "1월", "2월", "3월", "4월", "5월", "6월",
  "7월", "8월", "9월", "10월", "11월", "12월",
];

const DIV = 5;
const W = 640;
const H = 340;
const PL = 48;
const PR = 16;
const PT = 24;
const PB = 44;
const PLOT_W = W - PL - PR;
const PLOT_H = H - PT - PB;
const SLOT = PLOT_W / MONTHS.length;

const xFor = (index: number) => PL + SLOT * index + SLOT / 2;

export function VisitorLineChart({ values }: { values: number[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const data = MONTHS.map((_, i) => values[i] ?? 0);
  const maxVal = Math.max(...data, 0);
  const max = Math.max(DIV, Math.ceil(maxVal / DIV) * DIV);
  const step = max / DIV;

  const yFor = (value: number) => PT + PLOT_H * (1 - value / max);
  const gridValues = Array.from({ length: DIV + 1 }, (_, i) => i * step);
  const points = data.map((value, index) => `${xFor(index)},${yFor(value)}`).join(" ");

  // 호버한 지점의 값 툴팁 — 위 공간이 부족하면 포인트 위→아래로 뒤집어 잘림 방지.
  const cx = hover !== null ? xFor(hover) : 0;
  const pointTop = hover !== null ? yFor(data[hover]) : 0;
  const above = pointTop - 30 >= 0;
  const tipRectY = above ? pointTop - 30 : pointTop + 8;
  const tipTextY = above ? pointTop - 14 : pointTop + 24;

  return (
    <div className="flex flex-col gap-[16px] rounded-[12px] border border-stroke p-[24px]">
      <div className="flex items-center justify-between">
        <p className="text-lg font-bold leading-[28px] text-black">
          연간 방문자 수
        </p>
        <YearSelect />
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
        {gridValues.map((value) => {
          const y = yFor(value);
          return (
            <g key={value}>
              <line
                x1={PL}
                y1={y}
                x2={W - PR}
                y2={y}
                stroke="#e4e5ee"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text
                x={PL - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-[#9ca3af] text-[12px]"
              >
                {value.toLocaleString()}
              </text>
            </g>
          );
        })}

        <polyline
          points={points}
          fill="none"
          stroke="#00aaa4"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {data.map((value, index) => (
          <circle
            key={MONTHS[index]}
            cx={xFor(index)}
            cy={yFor(value)}
            r={hover === index ? 5 : 4}
            fill="#ffffff"
            stroke="#00aaa4"
            strokeWidth={2}
          />
        ))}

        {/* 투명 히트영역 — 값 0인 달 포함 컬럼 전체 호버 가능 */}
        {MONTHS.map((month, index) => (
          <rect
            key={`hit-${month}`}
            x={PL + SLOT * index}
            y={PT}
            width={SLOT}
            height={PLOT_H}
            fill="transparent"
            onMouseEnter={() => setHover(index)}
            onMouseLeave={() => setHover((h) => (h === index ? null : h))}
          />
        ))}

        {MONTHS.map((month, index) => (
          <text
            key={month}
            x={xFor(index)}
            y={H - 20}
            textAnchor="middle"
            className="fill-[#9ca3af] text-[12px]"
          >
            {month}
          </text>
        ))}

        {hover !== null && (
          <g pointerEvents="none">
            <rect x={cx - 26} y={tipRectY} width={52} height={24} rx={4} fill="#2f3442" />
            <text
              x={cx}
              y={tipTextY}
              textAnchor="middle"
              className="fill-white text-[12px] font-medium"
            >
              {data[hover].toLocaleString()}
            </text>
          </g>
        )}
      </svg>

      <div className="flex items-center justify-center gap-[6px]">
        <span className="h-[2px] w-[16px] rounded-full bg-primary" />
        <span className="size-[8px] rounded-full border-2 border-primary bg-white" />
        <span className="text-xs font-medium leading-[16px] text-disabled">
          방문자 수
        </span>
      </div>
    </div>
  );
}
