import type { MediaNearbyStation } from "@/hooks/media";

// 노선 색 — 수도권 전철 노선도 색. 없는 노선은 회색.
const LINE_COLOR: Record<string, string> = {
  "1호선": "#0052A4",
  "2호선": "#00A84D",
  "3호선": "#EF7C1C",
  "4호선": "#00A5DE",
  "5호선": "#996CAC",
  "6호선": "#CD7C2F",
  "7호선": "#747F00",
  "8호선": "#E6186C",
  "9호선": "#BDB092",
  신분당선: "#D4003B",
  수인분당선: "#F5A200",
  경의중앙선: "#77C4A3",
  공항철도: "#0090D2",
  경춘선: "#0C8E72",
  경강선: "#0054A6",
  서해선: "#8FC31F",
  우이신설선: "#B0CE18",
  신림선: "#6789CA",
  김포골드라인: "#A17800",
  인천1호선: "#7CA8D5",
  인천2호선: "#ED8B00",
  에버라인: "#509F22",
  의정부경전철: "#FDA600",
  "GTX-A": "#9A6292",
};

// 노선 표시 — "2호선"은 동그라미 안 숫자, 그 밖은 짧은 이름 알약.
function lineShort(line: string): string {
  const n = /^(\d)호선$/.exec(line);
  if (n) return n[1];
  return line
    .replace(/^인천(\d)호선$/, "인천$1")
    .replace(/(선|라인|경전철)$/, "")
    .replace(/^공항철도$/, "공항");
}

function LineBadge({ line }: { line: string }) {
  const short = lineShort(line);
  return (
    <span
      title={line}
      className={
        short.length === 1
          ? "flex size-[16px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
          : "flex h-[16px] shrink-0 items-center rounded-full px-[5px] text-[10px] font-bold whitespace-nowrap text-white"
      }
      style={{ background: LINE_COLOR[line] ?? "#8a8f98" }}
    >
      {short}
    </span>
  );
}

/**
 * 매체 상세 "가까운 역" — 매체 좌표에서 1km 안 가장 가까운 지하철역(두 역 사이면 2개까지), 노선 색 표시와 직선 거리.
 * 걸어가는 길이 아니라 직선 거리라 "직선"을 붙인다.
 */
export function NearbyStations({
  stations,
}: {
  stations: MediaNearbyStation[];
}) {
  if (!stations.length) return null;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-[12px] gap-y-[6px]">
      <span className="text-[12px] font-semibold text-tone-6c757d">
        가까운 역
      </span>
      {stations.map((s) => (
        <span key={s.name} className="flex items-center gap-[4px]">
          <span className="flex items-center gap-[2px]">
            {s.lines.map((l) => (
              <LineBadge key={l} line={l} />
            ))}
          </span>
          <span className="text-[12px] font-semibold whitespace-nowrap text-zinc-800">
            {s.name}
          </span>
          <span
            className="text-[12px] whitespace-nowrap text-tone-6c757d tabular-nums"
            title="매체 위치에서 직선 거리"
          >
            직선 {s.distanceM.toLocaleString()}m
          </span>
        </span>
      ))}
    </div>
  );
}
