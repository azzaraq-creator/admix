import { YearSelect } from "./YearSelect";

const MONTHS = [
  "1월", "2월", "3월", "4월", "5월", "6월",
  "7월", "8월", "9월", "10월", "11월", "12월",
];

const DIV = 5;
const W = 640;
const H = 340;
const PL = 44;
const PR = 16;
const PT = 24;
const PB = 44;
const PLOT_W = W - PL - PR;
const PLOT_H = H - PT - PB;
const SLOT = PLOT_W / MONTHS.length;
const BAR_W = 22;

export function ProposalBarChart({ values }: { values: number[] }) {
  const data = MONTHS.map((_, i) => values[i] ?? 0);
  const maxVal = Math.max(...data, 0);
  const max = Math.max(DIV, Math.ceil(maxVal / DIV) * DIV);
  const step = max / DIV;

  const yFor = (value: number) => PT + PLOT_H * (1 - value / max);
  const gridValues = Array.from({ length: DIV + 1 }, (_, i) => i * step);
  const peakIndex = data.reduce((best, v, i) => (v > data[best] ? i : best), 0);

  return (
    <div className="flex flex-col gap-[16px] rounded-[12px] border border-stroke p-[24px]">
      <div className="flex items-center justify-between">
        <p className="text-lg font-bold leading-[28px] text-black">
          연간 제안 건수
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
                {value}
              </text>
            </g>
          );
        })}

        {data.map((value, index) => {
          const x = PL + SLOT * index + SLOT / 2 - BAR_W / 2;
          const y = yFor(value);
          return (
            <rect
              key={MONTHS[index]}
              x={x}
              y={y}
              width={BAR_W}
              height={PT + PLOT_H - y}
              rx={2}
              fill="#00aaa4"
            />
          );
        })}

        {MONTHS.map((month, index) => (
          <text
            key={month}
            x={PL + SLOT * index + SLOT / 2}
            y={H - 20}
            textAnchor="middle"
            className="fill-[#9ca3af] text-[12px]"
          >
            {month}
          </text>
        ))}

        {maxVal > 0 && (
          <g>
            <rect
              x={PL + SLOT * peakIndex + SLOT / 2 - 26}
              y={yFor(data[peakIndex]) - 30}
              width={52}
              height={24}
              rx={4}
              fill="#2f3442"
            />
            <text
              x={PL + SLOT * peakIndex + SLOT / 2}
              y={yFor(data[peakIndex]) - 14}
              textAnchor="middle"
              className="fill-white text-[12px] font-medium"
            >
              {data[peakIndex].toLocaleString()}
            </text>
          </g>
        )}
      </svg>

      <div className="flex items-center justify-center gap-[6px]">
        <span className="size-[8px] rounded-[2px] bg-primary" />
        <span className="text-xs font-medium leading-[16px] text-disabled">
          제안 건수
        </span>
      </div>
    </div>
  );
}
