"use client";

import type { CrowdTransit } from "@/hooks/media";
import { cn } from "@/lib/utils";

/** 1234567 → "123.5만" — 하루 승하차는 수천~수십만이라 만 단위로 줄여 보인다. */
export function formatCount(n: number): string {
  if (n < 10000) return n.toLocaleString();
  const man = n / 10000;
  return `${man >= 100 ? Math.round(man).toLocaleString() : man.toFixed(1).replace(/\.0$/, "")}만`;
}

/** "20261010" → "10월 10일(토)" */
function dayLabel(date: string | null): string {
  if (!date) return "";
  const d = new Date(
    Number(date.slice(0, 4)),
    Number(date.slice(4, 6)) - 1,
    Number(date.slice(6, 8)),
  );
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${"일월화수목금토"[d.getDay()]})`;
}

// 서울 지하철 노선 색(공식 노선도 색). 1~9호선은 숫자 동그라미, 나머지는 짧은 이름표.
const NUMBER_LINE_COLORS: Record<string, string> = {
  "1": "#0052A4",
  "2": "#00A84D",
  "3": "#EF7C1C",
  "4": "#00A5DE",
  "5": "#996CAC",
  "6": "#CD7C2F",
  "7": "#747F00",
  "8": "#E6186C",
  "9": "#BDB092",
};

// 서울시 통계의 노선 이름 → 이름표. 1·3·4호선과 이어 달리는 국철 구간(경부선 등)은 그 호선으로 본다.
const NAMED_LINES: [RegExp, { label: string; color: string }][] = [
  [/^(경부|경인|경원|장항)선/, { label: "1", color: NUMBER_LINE_COLORS["1"] }],
  [/^일산선/, { label: "3", color: NUMBER_LINE_COLORS["3"] }],
  [/^(과천|안산|진접)선/, { label: "4", color: NUMBER_LINE_COLORS["4"] }],
  [/^신분당/, { label: "신분당", color: "#D4003B" }],
  [/^(경의|중앙)/, { label: "경의중앙", color: "#77C4A3" }],
  [/^(분당|수인)/, { label: "수인분당", color: "#F5A200" }],
  [/^공항철도/, { label: "공항", color: "#0090D2" }],
  [/^경춘/, { label: "경춘", color: "#0C8E72" }],
  [/^경강/, { label: "경강", color: "#003DA5" }],
  [/^서해/, { label: "서해", color: "#8FC31F" }],
  [/^우이신설/, { label: "우이신설", color: "#B0CE18" }],
  [/^신림/, { label: "신림", color: "#6789CA" }],
  [/^김포/, { label: "김포", color: "#A17800" }],
];

type LineBadgeInfo = { label: string; color: string };

function lineBadge(line: string): LineBadgeInfo {
  const num = line.match(/^(\d)호선/)?.[1];
  if (num) return { label: num, color: NUMBER_LINE_COLORS[num] };
  const named = NAMED_LINES.find(([re]) => re.test(line));
  return named
    ? named[1]
    : { label: line.replace(/선$/, ""), color: "#8b90a7" };
}

/** 같은 이름표(예: 1호선·경부선 → "1")는 한 번만. */
function lineBadges(lines: string[]): LineBadgeInfo[] {
  const out: LineBadgeInfo[] = [];
  for (const line of lines) {
    const badge = lineBadge(line);
    if (!out.some((b) => b.label === badge.label)) out.push(badge);
  }
  return out;
}

/** 밝은 노선 색(9호선 금색·수인분당 노랑 등) 위에는 흰 글씨가 안 보여 어두운 글씨를 쓴다. */
function textOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 170 ? "#1f1f1f" : "#ffffff";
}

function LineBadge({ label, color }: LineBadgeInfo) {
  const isNumber = /^\d$/.test(label);
  return (
    <span
      className={cn(
        "flex h-[18px] shrink-0 items-center justify-center rounded-full text-[10px] leading-none font-bold",
        isNumber ? "w-[18px] text-[11px]" : "px-[6px]",
      )}
      style={{ background: color, color: textOn(color) }}
    >
      {label}
    </span>
  );
}

/** 많은 곳 대비 비율 막대 — 역·정류장끼리 크기를 한눈에 비교하게. */
function ShareBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  return (
    <div className="h-[4px] w-full overflow-hidden rounded-full bg-tone-f1f1f4">
      <div
        className="h-full rounded-full"
        style={{
          width: `${max > 0 ? Math.max(4, (value / max) * 100) : 0}%`,
          background: color,
        }}
      />
    </div>
  );
}

function SectionHeader({
  title,
  date,
}: {
  title: string;
  date: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-[8px]">
      <h3 className="text-[13px] leading-[18px] font-bold text-zinc-900">
        {title}
      </h3>
      {date && (
        <span className="rounded-full bg-zinc-100 px-[8px] py-[2px] text-[11px] leading-[14px] font-medium text-zinc-500">
          {dayLabel(date)} 하루
        </span>
      )}
    </div>
  );
}

/** "11.7만명" — 숫자는 크게, "명"은 작게. */
function Count({ n, className }: { n: number; className?: string }) {
  return (
    <span className={cn("tabular-nums", className)}>
      {formatCount(n)}
      <span className="ml-[1px] text-[0.8em] font-medium">명</span>
    </span>
  );
}

const BUS_COLOR = "#3D5BF5";

/**
 * 실시간 인구 장소 카드의 지하철·버스 — 장소 범위(와 주변 200m) 안 역·정류장의 하루 승하차(서울시, 공개된 가장 최근 날).
 * 지하철은 역마다 호선 이름표(노선 색)·승하차 합계·비교 막대, 버스는 합계 칸 셋과 많이 타고 내리는 정류장 순위.
 */
export function CrowdTransitSections({ data }: { data: CrowdTransit }) {
  const { subway, bus } = data;
  const subwayMax = Math.max(
    0,
    ...subway.stations.map((s) => s.ride + s.alight),
  );
  const busMax = Math.max(0, ...bus.top.map((s) => s.ride + s.alight));
  return (
    <>
      <section className="flex flex-col gap-[10px]">
        <SectionHeader title="지하철" date={subway.date} />
        {subway.stations.length === 0 ? (
          <p className="text-[12px] text-zinc-500">
            이 범위엔 지하철역이 없어요.
          </p>
        ) : (
          <ul className="flex flex-col gap-[12px]">
            {subway.stations.map((s) => {
              const badges = lineBadges(s.lines);
              return (
                <li key={s.name} className="flex flex-col gap-[5px]">
                  <div className="flex items-center justify-between gap-[8px]">
                    <div className="flex min-w-0 items-center gap-[6px]">
                      <div className="flex shrink-0 items-center gap-[3px]">
                        {badges.map((b) => (
                          <LineBadge key={b.label} {...b} />
                        ))}
                      </div>
                      <span className="truncate text-[13px] leading-[18px] font-semibold text-zinc-900">
                        {s.name}
                      </span>
                    </div>
                    <Count
                      n={s.ride + s.alight}
                      className="shrink-0 text-[13px] font-bold text-zinc-900"
                    />
                  </div>
                  <ShareBar
                    value={s.ride + s.alight}
                    max={subwayMax}
                    color={badges[0]?.color ?? "#8b90a7"}
                  />
                  <span className="text-[11px] leading-[14px] text-zinc-500 tabular-nums">
                    승차 {formatCount(s.ride)} · 하차 {formatCount(s.alight)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="h-px w-full bg-tone-f1f1f4" />

      <section className="flex flex-col gap-[10px]">
        <SectionHeader title="버스" date={bus.date} />
        {bus.stopCount === 0 ? (
          <p className="text-[12px] text-zinc-500">
            이 범위엔 버스정류장이 없어요.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-[6px]">
              {[
                {
                  label: "정류장",
                  value: (
                    <span className="tabular-nums">
                      {bus.stopCount}
                      <span className="ml-[1px] text-[0.8em] font-medium">
                        곳
                      </span>
                    </span>
                  ),
                },
                { label: "승차", value: <Count n={bus.ride} /> },
                { label: "하차", value: <Count n={bus.alight} /> },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-[1px] rounded-[10px] bg-tone-f7f7f8 py-[7px]"
                >
                  <span className="text-[10px] leading-[14px] text-zinc-500">
                    {label}
                  </span>
                  <span className="text-[13px] leading-[18px] font-bold text-zinc-900">
                    {value}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] leading-[14px] font-medium text-zinc-500">
              많이 타고 내리는 정류장
            </p>
            <ol className="flex flex-col gap-[10px]">
              {bus.top.map((stop, i) => (
                <li
                  key={`${stop.name}-${stop.arsNo ?? i}`}
                  className="flex gap-[8px]"
                >
                  <span
                    className="mt-[1px] flex size-[16px] shrink-0 items-center justify-center rounded-full text-[10px] leading-none font-bold text-white"
                    style={{ background: BUS_COLOR }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
                    <div className="flex items-center justify-between gap-[8px]">
                      <span className="min-w-0 truncate text-[12px] leading-[17px] font-semibold text-zinc-800">
                        {stop.name}
                        {stop.arsNo && (
                          <span className="ml-[4px] text-[10px] font-medium text-zinc-400">
                            {stop.arsNo}
                          </span>
                        )}
                      </span>
                      <Count
                        n={stop.ride + stop.alight}
                        className="shrink-0 text-[12px] font-bold text-zinc-900"
                      />
                    </div>
                    <ShareBar
                      value={stop.ride + stop.alight}
                      max={busMax}
                      color={BUS_COLOR}
                    />
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      <p className="text-[10px] leading-[14px] text-zinc-400">
        서울시 교통카드 승하차 통계(장소 범위와 주변 200m) · 서울시가 사흘쯤
        뒤에 공개해 가장 최근 날 기준
      </p>
    </>
  );
}
