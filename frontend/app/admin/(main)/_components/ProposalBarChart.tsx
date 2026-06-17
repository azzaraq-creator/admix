import { YearSelect } from "./YearSelect";

const MONTHS = [
  "1월", "2월", "3월", "4월", "5월", "6월",
  "7월", "8월", "9월", "10월", "11월", "12월",
];
const VALUES = [120, 150, 180, 220, 190, 250, 210, 240, 200, 230, 260, 280];

const MAX = 300;
const STEP = 50;
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

const yFor = (value: number) => PT + PLOT_H * (1 - value / MAX);
const gridValues = Array.from({ length: MAX / STEP + 1 }, (_, i) => i * STEP);

export function ProposalBarChart() {
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

        {VALUES.map((value, index) => {
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

        <g>
          <rect
            x={PL + SLOT * 0 + SLOT / 2 - 26}
            y={yFor(VALUES[0]) - 30}
            width={52}
            height={24}
            rx={4}
            fill="#2f3442"
          />
          <text
            x={PL + SLOT * 0 + SLOT / 2}
            y={yFor(VALUES[0]) - 14}
            textAnchor="middle"
            className="fill-white text-[12px] font-medium"
          >
            1,234
          </text>
        </g>
      </svg>

      <div className="flex items-center justify-center gap-[6px]">
        <span className="size-[8px] rounded-[2px] bg-[#00aaa4]" />
        <span className="text-xs font-medium leading-[16px] text-[#737586]">
          문의 건수
        </span>
      </div>
    </div>
  );
}
