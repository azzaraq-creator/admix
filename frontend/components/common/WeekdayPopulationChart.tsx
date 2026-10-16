"use client";

import {
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";

export type WeekdayPopulation = { label: string; value: number };

/** 선 색 — 인구 카드가 보라 일색이 되지 않게 파랑(성별 분홍·파랑, 연령 남색과 함께 색각 검증함). */
const LINE = "#2a78d6";

/** 점 위 숫자 — 1만 이상은 "2.7만", 그 아래는 "8,400". */
function compact(value: number): string {
  if (value >= 10_000) {
    const man = value / 10_000;
    return `${man >= 100 ? Math.round(man) : man.toFixed(1).replace(/\.0$/, "")}만`;
  }
  return value.toLocaleString();
}

/** 마우스를 올린 요일 — 흰 팝업 위라 검정 바탕으로. "하루 평균"은 제목 옆에 있어 요일·숫자만. */
function DarkTooltip({
  active,
  payload,
  label,
}: Partial<TooltipContentProps<ValueType, NameType>>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[8px] bg-[#18181b]/90 px-[10px] py-[6px] text-[12px] leading-[1.4] shadow-[0_4px_12px_rgba(0,0,0,0.18)]">
      <p className="font-medium text-white/60">{label}요일</p>
      <p className="font-semibold text-white">
        {Number(payload[0].value).toLocaleString()}명
      </p>
    </div>
  );
}

/**
 * 요일별 하루 평균 유동인구 선 그래프 — 가장 많은 요일(공동 포함)의 점만 파랑으로 채우고 크게.
 * 마우스를 올리면 정확한 숫자를 띄운다. 누를 것이 없어 클릭·키보드 포커스(보라 테두리)는 끈다.
 * 매체 정보 팝업의 인구 카드가 요일별 값이 있을 때만 불러온다(지연 로드).
 */
export default function WeekdayPopulationChart({
  data,
  height = 120,
}: {
  data: WeekdayPopulation[];
  height?: number;
}) {
  const values = data.map((d) => d.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  // 요일 차이가 보이도록 세로축을 0이 아니라 최솟값 조금 아래부터 잡는다(위는 숫자 자리).
  const pad = Math.max((max - min) * 0.25, max * 0.03);

  return (
    <div className="[&_*]:outline-none">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          accessibilityLayer={false}
          margin={{ top: 22, right: 14, bottom: 0, left: 14 }}
        >
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            interval={0}
            tick={{ fontSize: 11, fill: "#71717a", fontWeight: 500 }}
          />
          <YAxis hide domain={[Math.max(0, min - pad), max + pad]} />
          <Tooltip
            cursor={{ stroke: "#e4e4e7", strokeDasharray: "3 3" }}
            content={(props) => <DarkTooltip {...props} />}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={LINE}
            strokeWidth={2}
            isAnimationActive={false}
            dot={({ cx, cy, payload }) => {
              const top = payload.value === max;
              return (
                <circle
                  key={payload.label}
                  cx={cx}
                  cy={cy}
                  r={top ? 5 : 3.5}
                  fill={top ? LINE : "#fff"}
                  stroke={LINE}
                  strokeWidth={2}
                />
              );
            }}
            activeDot={{ r: 5, fill: LINE, stroke: "#fff", strokeWidth: 2 }}
          >
            <LabelList
              dataKey="value"
              position="top"
              offset={10}
              formatter={(v) => compact(Number(v))}
              style={{ fontSize: 11, fill: "#71717a", fontWeight: 500 }}
            />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
