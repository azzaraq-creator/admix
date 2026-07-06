import { YearSelect } from "./YearSelect";

const MONTHS = [
  "1월", "2월", "3월", "4월", "5월", "6월",
  "7월", "8월", "9월", "10월", "11월", "12월",
];
const VALUES = [150, 300, 500, 750, 900, 1100, 1350, 1550, 1750, 2000, 2300, 2530];

const MAX = 3000;
const STEP = 500;
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
const yFor = (value: number) => PT + PLOT_H * (1 - value / MAX);
const gridValues = Array.from({ length: MAX / STEP + 1 }, (_, i) => i * STEP);
const points = VALUES.map((value, index) => `${xFor(index)},${yFor(value)}`).join(" ");

export function VisitorLineChart() {
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
                {value}
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

        {VALUES.map((value, index) => (
          <circle
            key={MONTHS[index]}
            cx={xFor(index)}
            cy={yFor(value)}
            r={4}
            fill="#ffffff"
            stroke="#00aaa4"
            strokeWidth={2}
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
      </svg>

      <div className="flex items-center justify-center gap-[6px]">
        <span className="h-[2px] w-[16px] rounded-full bg-primary" />
        <span className="size-[8px] rounded-full border-2 border-primary bg-white" />
        <span className="text-xs font-medium leading-[16px] text-disabled">
          문의
        </span>
      </div>
    </div>
  );
}
