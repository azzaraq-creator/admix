"use client";

import { Drawer, ScrollShadow } from "@heroui/react";
import {
  type RefObject,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { ChevronDownIcon, InfoIcon, XIcon } from "@/components/icons";
import {
  type PopAge,
  type PopBand,
  type PopMetric,
  type PopSex,
  usePopCellTrend,
  usePopGridCells,
  usePopGridMonths,
  usePopGridValues,
} from "@/hooks/popGrid";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import type { KakaoMap } from "@/lib/kakaoMap";
import { cn } from "@/lib/utils";

import { POP_LEVELS, type PopRealtime, useMapPopGrid } from "./useMapPopGrid";

const METRICS: { key: PopMetric; label: string; desc: string }[] = [
  {
    key: "flow",
    label: "종합",
    desc: "생활·체류인구·보행(통신 70%)과 지하철·버스 승하차(교통카드 30%)를 합쳐 서울에서 많은 순으로 칠해요 — 성별·연령은 생활·체류에 걸려요",
  },
  {
    key: "people",
    label: "생활·체류인구",
    desc: "생활인구(그 시각 있던 사람)와 체류인구(머물기 시작한 사람)를 같은 점수로 바꿔 2:1로 합쳐요",
  },
  {
    key: "subway",
    label: "지하철",
    desc: "지하철역 승하차 인원(시간당) — 역 반경 300m 칸에 나눠 담았어요",
  },
  {
    key: "walk",
    label: "보행",
    desc: "상권 골목길 유동인구(분기 값) — 크기를 견주는 상대값이에요",
  },
];
const BANDS: { key: PopBand; label: string }[] = [
  { key: "all", label: "하루 전체" },
  { key: "am", label: "출근 7~9시" },
  { key: "day", label: "낮 10~16시" },
  { key: "pm", label: "퇴근 17~19시" },
  { key: "night", label: "야간 20~23시" },
];
const SEXES: { key: PopSex; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "M", label: "남성" },
  { key: "F", label: "여성" },
];
const AGES: { key: PopAge; label: string }[] = [
  { key: "10", label: "10대" },
  { key: "20", label: "20대" },
  { key: "30", label: "30대" },
  { key: "40", label: "40대" },
  { key: "50", label: "50대" },
  { key: "60", label: "60대 이상" },
];
// 성·연령을 고를 수 없는 자료와 그 이유 — 막기만 하지 않고 조건 창에 설명한다.
const NO_SEG_REASON: Partial<Record<PopMetric, string>> = {
  subway:
    "지하철은 교통카드 승하차 자료라 성별·연령 정보가 없어요. 전체 승하차 인원으로 보여요.",
  walk: "보행 자료는 성별과 연령이 따로따로만 있어 '20대 남성'처럼 함께 고를 수 없어요. 전체 인원으로 보여요.",
};
// 성·연령 구분이 있는 자료
const SEG_METRICS = new Set<PopMetric>(["flow", "people"]);

const monthLabel = (ym: string) => `${Number(ym.slice(4))}월`;

/** 고른 대상 한 줄 — "20·30대 남성", "여성", "전체". */
function targetLabel(sex: PopSex, ages: PopAge[]): string {
  const sexText = sex === "M" ? "남성" : sex === "F" ? "여성" : "";
  if (!ages.length) return sexText || "전체";
  const sorted = AGES.filter((a) => ages.includes(a.key));
  const ageText =
    sorted.length === 1
      ? sorted[0].label
      : `${sorted.map((a) => a.key).join("·")}대${sorted.some((a) => a.key === "60") ? " 이상" : ""}`;
  return [ageText, sexText].filter(Boolean).join(" ");
}

function monthsLabel(year: string, picked: string[], all: string[]): string {
  if (picked.length === all.length) return `${year}년 전체`;
  return `${year}년 ${picked.map(monthLabel).join("·")}`;
}

/** 칸 값 한 줄 — 자료마다 단위가 다르다. 유동인구(종합)는 합친 점수라 숫자 없이 서울 순위만 보여 준다. */
function valueText(metric: PopMetric, v: number | null): string {
  if (v == null) return "자료 없음";
  const n = v >= 10 ? Math.round(v).toLocaleString() : v.toFixed(1);
  // 종합은 여러 자료를 합친 순위라 이름 없이 "20대 남성 · 서울 상위 9%"처럼.
  if (metric === "flow") return "";
  if (metric === "people") return "생활·체류인구";
  if (metric === "live") return `약 ${n}명`;
  if (metric === "subway") return `시간당 약 ${n}명 승하차`;
  return `보행 ${n}`;
}

/** 서울 칸 가운데 몇 % 안에 드는지 — 값이 있는 칸 기준. */
function useRank(values: (number | null)[] | undefined) {
  return useMemo(() => {
    const sorted = (values ?? [])
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b);
    return (v: number | null): number | null => {
      if (v == null || !sorted.length) return null;
      let lo = 0;
      let hi = sorted.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (sorted[mid] <= v) lo = mid + 1;
        else hi = mid;
      }
      return Math.max(0.1, ((sorted.length - lo) / sorted.length) * 100);
    };
  }, [values]);
}

const rankText = (r: number | null) =>
  r == null ? "" : `서울 상위 ${r < 1 ? r.toFixed(1) : Math.round(r)}%`;

function ChipButton({
  on,
  disabled,
  locked,
  onClick,
  children,
}: {
  on: boolean;
  disabled?: boolean;
  /** 이 자료에선 고를 수 없음 — 흐리게 두되 눌리면 onClick(이유 안내)을 부른다. */
  locked?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={on}
      aria-disabled={locked || undefined}
      onClick={onClick}
      className={cn(
        // 고르기 전엔 회색 바탕, 고르면 흰 바탕(탭 "전체·고정·이동"과 같은 느낌).
        "h-[26px] shrink-0 rounded-full border px-[9px] text-[12px] font-semibold whitespace-nowrap transition-colors",
        on
          ? "border-transparent bg-surface text-zinc-900"
          : "border-transparent bg-zinc-900/[0.06] text-zinc-600 hover:bg-zinc-900/10 dark:bg-white/10 dark:text-[#c9cad3]",
        (disabled || locked) &&
          "opacity-40 hover:bg-zinc-900/[0.06] dark:hover:bg-white/10",
        disabled && "cursor-not-allowed",
      )}
    >
      {children}
    </button>
  );
}

function Row({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[6px]">
      <span className="text-[11px] font-bold text-zinc-600 dark:text-[#b4b5bf]">
        {title}
      </span>
      <div className="flex flex-wrap gap-[4px]">{children}</div>
    </div>
  );
}

// "유동인구" 켜 둔 상태 — 실시간 인구와 같이 이 브라우저에 기억한다. 기본은 끔.
const POP_GRID_STORAGE_KEY = "admix.map.pop-grid";
const POP_GRID_EVENT = "admix:pop-grid-setting";

function usePopGridOn(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(POP_GRID_EVENT, onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(POP_GRID_EVENT, onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => window.localStorage.getItem(POP_GRID_STORAGE_KEY) === "1",
    () => false,
  );
}

function setPopGridOn(on: boolean) {
  window.localStorage.setItem(POP_GRID_STORAGE_KEY, on ? "1" : "0");
  window.dispatchEvent(new Event(POP_GRID_EVENT));
}

/**
 * 유동인구 층의 켜짐·조건 — 위쪽 줄 "유동인구" 버튼의 조건 창(PopGridControls)과 지도 층(PopGridLayer)이 함께 쓴다.
 * 매체 찾기 화면(FixedMediaView)에서 한 번 만들어 둘 다에 넘긴다.
 */
export function usePopGridState() {
  const on = usePopGridOn();
  // 유동인구 지도 창 펼침 — 지도 스위치로 켜면 펼쳐서 연다. 제목 줄로 접고 펼친다.
  const [panelOpen, setPanelOpen] = useState(false);
  // 지도에서 누른 격자 칸(격자 순서 번호) — 카드에 그 칸 정보를 붙인다.
  const [selected, setSelected] = useState<number | null>(null);
  // 모바일 유동인구 시트(Drawer) — 지도 위 "유동인구" 버튼·칸 누르기·켜기로 연다.
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data: monthList } = usePopGridMonths(true);

  const years = useMemo(() => {
    const map = new Map<string, string[]>();
    (monthList ?? []).forEach((m) => {
      const y = m.ym.slice(0, 4);
      map.set(y, [...(map.get(y) ?? []), m.ym]);
    });
    return map;
  }, [monthList]);
  const latestYear = [...years.keys()].sort().at(-1) ?? null;

  const [year, setYear] = useState<string | null>(null);
  const shownYear = year && years.has(year) ? year : latestYear;
  const yearMonths = shownYear ? (years.get(shownYear) ?? []) : [];
  // 빈 배열 = 그해 전체.
  const [pickedMonths, setPickedMonths] = useState<string[]>([]);
  const months = pickedMonths.filter((m) => yearMonths.includes(m));
  const activeMonths = months.length ? months : yearMonths;

  const [metric, setMetric] = useState<PopMetric>("flow");
  const [band, setBand] = useState<PopBand>("all");
  const [sex, setSex] = useState<PopSex>("all");
  const [ages, setAges] = useState<PopAge[]>([]);

  const segOk = SEG_METRICS.has(metric);
  const query = shownYear
    ? {
        months: activeMonths,
        metric,
        band,
        sex: segOk ? sex : ("all" as PopSex),
        ages: segOk ? ages : [],
      }
    : null;
  const target = segOk ? targetLabel(sex, ages) : "전체(성·연령 구분 없음)";
  const metricInfo = METRICS.find((m) => m.key === metric)!;
  const bandLabel = BANDS.find((b) => b.key === band)!.label;
  const summary = [
    metricInfo.label,
    shownYear ? monthsLabel(shownYear, activeMonths, yearMonths) : "",
    band === "all" ? "" : bandLabel,
    segOk ? target : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    on,
    /** 지도 스위치 — 켜면 유동인구 지도 창을 펼친다. */
    toggle: (next: boolean) => {
      setPopGridOn(next);
      setPanelOpen(next);
      // 모바일 시트는 켤 때 저절로 올리지 않는다(지도부터 보게) — 끌 때만 닫는다.
      if (!next) setSheetOpen(false);
      if (!next) setSelected(null);
    },
    setOn: setPopGridOn,
    panelOpen,
    setPanelOpen,
    selected,
    setSelected,
    sheetOpen,
    setSheetOpen,
    /** 올린 달이 하나도 없음 */
    empty: !!monthList && monthList.length === 0,
    years,
    shownYear,
    setYear: (y: string) => {
      setYear(y);
      setPickedMonths([]);
    },
    yearMonths,
    months,
    activeMonths,
    pickMonth: (ym: string) => {
      // 그해 전체를 보던 중이면 그 달만, 아니면 더하고 빼기. 다 빼면 다시 전체.
      if (!months.length) setPickedMonths([ym]);
      else
        setPickedMonths(
          months.includes(ym)
            ? months.filter((m) => m !== ym)
            : [...months, ym].sort(),
        );
    },
    clearMonths: () => setPickedMonths([]),
    metric,
    setMetric,
    metricInfo,
    band,
    setBand,
    sex,
    setSex,
    ages,
    setAges,
    toggleAge: (a: PopAge) =>
      setAges((cur) =>
        cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a],
      ),
    segOk,
    query,
    target,
    summary,
  };
}

export type PopGridState = ReturnType<typeof usePopGridState>;

/**
 * 위쪽 줄 "유동인구" 버튼을 누르면 열리는 조건 창 — 켜기·자료·기간·시간대·성별·연령.
 * 지도 위를 가리지 않게 필터 창처럼 검색 줄 아래에 띄운다(MediaFindPanel).
 */
export function PopGridControls({ state }: { state: PopGridState }) {
  const s = state;
  // 흐린 성별·연령 칩을 누르면 이유 상자를 잠깐 깜빡인다.
  const [flash, setFlash] = useState(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showReason = () => {
    setFlash((n) => n + 1);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(0), 900);
  };
  const reason = NO_SEG_REASON[s.metric];
  const picked = s.sex !== "all" || s.ages.length > 0;
  return (
    <div className="flex flex-col gap-[14px]">
      {s.empty ? (
        <p className="text-[12px] text-zinc-600 dark:text-[#b4b5bf]">
          아직 올린 인구 분포 자료가 없어요.
        </p>
      ) : (
        <>
          <Row title="자료">
            {METRICS.map((m) => (
              <ChipButton
                key={m.key}
                on={s.metric === m.key}
                onClick={() => s.setMetric(m.key)}
              >
                {m.label}
              </ChipButton>
            ))}
          </Row>

          <Row
            title={
              s.years.size > 1
                ? "기간 (여러 달은 평균)"
                : `기간 · ${s.shownYear ?? ""}년 (여러 달은 평균)`
            }
          >
            {s.years.size > 1 &&
              [...s.years.keys()].sort().map((y) => (
                <ChipButton
                  key={y}
                  on={y === s.shownYear}
                  onClick={() => s.setYear(y)}
                >
                  {y}년
                </ChipButton>
              ))}
            <ChipButton on={!s.months.length} onClick={s.clearMonths}>
              1년 전체
            </ChipButton>
            {Array.from({ length: 12 }, (_, i) => {
              const ym = `${s.shownYear}${String(i + 1).padStart(2, "0")}`;
              return (
                <ChipButton
                  key={ym}
                  on={s.months.includes(ym)}
                  disabled={!s.yearMonths.includes(ym)}
                  onClick={() => s.pickMonth(ym)}
                >
                  {i + 1}월
                </ChipButton>
              );
            })}
          </Row>

          <Row title="시간대">
            {BANDS.map((b) => (
              <ChipButton
                key={b.key}
                on={s.band === b.key}
                onClick={() => s.setBand(b.key)}
              >
                {b.label}
              </ChipButton>
            ))}
          </Row>

          {reason && (
            // 성별·연령을 고를 수 없는 이유 + 이미 고른 조건이 있으면 그 조건이 걸리는 자료로 바로 넘어가기.
            <div
              key={flash}
              role="note"
              className={cn(
                "flex gap-[8px] rounded-[12px] bg-zinc-900/[0.05] px-[12px] py-[10px] text-[12px] leading-[17px] text-zinc-700 dark:bg-white/[0.07] dark:text-[#c9cad3]",
                flash > 0 && "animate-[pop-grid-flash_0.9s_ease-out]",
              )}
            >
              <InfoIcon className="mt-[1px] size-[15px] shrink-0 text-zinc-600 dark:text-[#b4b5bf]" />
              <div className="flex flex-col gap-[6px]">
                <span>{reason}</span>
                {picked && (
                  <span className="text-zinc-500 dark:text-[#a9aab4]">
                    고른 {targetLabel(s.sex, s.ages)}은 종합·생활·체류인구에서
                    그대로 적용돼요.{" "}
                    <button
                      type="button"
                      onClick={() => s.setMetric("flow")}
                      className="font-semibold text-zinc-900 underline underline-offset-2 dark:text-white"
                    >
                      종합으로 보기
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}
          <Row title="성별">
            {SEXES.map((x) => (
              <ChipButton
                key={x.key}
                on={s.segOk && s.sex === x.key}
                locked={!s.segOk}
                onClick={() => (s.segOk ? s.setSex(x.key) : showReason())}
              >
                {x.label}
              </ChipButton>
            ))}
          </Row>
          <Row title="연령">
            <ChipButton
              on={s.segOk && !s.ages.length}
              locked={!s.segOk}
              onClick={() => (s.segOk ? s.setAges([]) : showReason())}
            >
              전체
            </ChipButton>
            {AGES.map((a) => (
              <ChipButton
                key={a.key}
                on={s.segOk && s.ages.includes(a.key)}
                locked={!s.segOk}
                onClick={() => (s.segOk ? s.toggleAge(a.key) : showReason())}
              >
                {a.label}
              </ChipButton>
            ))}
          </Row>
        </>
      )}
    </div>
  );
}

/**
 * 유동인구 카드 — 유동인구에 관한 것은 모두 여기 한 곳에 모은다(지도 위엔 격자 색과 스위치만).
 * 위에서부터 ① 제목·지금 조건(누르면 접기·펼치기) ② 색 띠(늘 보임) ③ 누른 칸 정보(칸을 눌렀을 때)
 * ④ 조건 고르기(펼쳤을 때). PC는 검색 줄 아래 오른쪽에 띄우고, 모바일은 탭 줄과 지도 사이에 자리를 잡는다
 * (MediaFindPanel). 뒤가 비치는 유리(반투명 + 흐림).
 */
export function PopGridPanel({ state }: { state: PopGridState }) {
  const open = state.panelOpen;
  const { data: cells } = usePopGridCells(true);
  const { data: grid, isFetching } = usePopGridValues(state.query);
  const rank = useRank(grid?.values);
  const sel = state.selected;
  const value = sel != null ? (grid?.values[sel] ?? null) : null;
  return (
    // 모바일은 펼친 조건을 카드 아래에 겹쳐 띄운다(지도를 밀어내지 않게) — 그래서 카드가 넘침을 자르지 않는다.
    <div className="relative flex flex-col rounded-[20px] border-[0.5px] border-white/50 bg-surface/75 shadow-[0px_8px_24px_0px_rgba(0,0,0,0.12)] backdrop-blur-[14px] backdrop-saturate-[1.8] sm:overflow-hidden">
      <button
        type="button"
        onClick={() => state.setPanelOpen(!open)}
        aria-expanded={open}
        aria-label={open ? "인구 분포 조건 접기" : "인구 분포 조건 펼치기"}
        className="flex shrink-0 items-center gap-[8px] px-[20px] pt-[12px] pb-[6px] text-left max-sm:px-[16px]"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[14px] leading-[20px] font-bold text-zinc-900">
            인구 분포
          </span>
          <span className="truncate text-[12px] leading-[17px] text-zinc-700 dark:text-[#c9cad3]">
            {isFetching ? "불러오는 중…" : state.summary}
          </span>
        </span>
        <ChevronDownIcon
          className={cn(
            "size-[16px] shrink-0 text-zinc-700 dark:text-[#c9cad3] transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <PopLegend
        breaks={grid?.breaks ?? []}
        metric={state.metric}
        missingMonths={grid?.missingMonths ?? []}
      />

      {sel != null && cells && (
        <PopCellSection
          cell={cells[sel]}
          value={value}
          rankValue={rank(value)}
          metric={state.metric}
          query={{
            metric: state.metric,
            band: state.band,
            sex: state.segOk ? state.sex : "all",
            ages: state.segOk ? state.ages : [],
          }}
          target={state.target}
          activeMonths={state.activeMonths}
          onClose={() => state.setSelected(null)}
        />
      )}

      {open && (
        // 모바일은 카드 아래에 겹쳐 띄우는 상자(지도를 밀어내지 않게, "목록 보기" 버튼 위까지). PC는 카드 안에 이어 붙는다.
        <div className="border-t border-zinc-900/5 max-sm:absolute max-sm:inset-x-0 max-sm:top-[calc(100%+6px)] max-sm:overflow-hidden max-sm:rounded-[20px] max-sm:border-[0.5px] max-sm:border-white/50 max-sm:bg-surface/90 max-sm:shadow-[0px_8px_24px_0px_rgba(0,0,0,0.14)] max-sm:backdrop-blur-[14px]">
          <ScrollShadow
            size={24}
            className="max-h-[min(520px,calc(100dvh-360px))] px-[20px] pt-[14px] pb-[16px] max-sm:max-h-[calc(100dvh-470px)] max-sm:px-[16px]"
          >
            <PopGridControls state={state} />
          </ScrollShadow>
        </div>
      )}
    </div>
  );
}

/**
 * 모바일 지도 오른쪽 위 "유동인구" 버튼 — 지금 조건 한 줄 + 색 띠. 누르면 유동인구 시트(PopGridSheet)를 연다.
 * 모바일은 지도가 작아 카드를 늘 띄우면 지도를 가려서, 버튼 하나로 접어 둔다.
 */
export function PopGridMobileButton({ state }: { state: PopGridState }) {
  return (
    <button
      type="button"
      onClick={() => state.setSheetOpen(true)}
      aria-label="인구 분포 조건 열기"
      // "지도 표시" 버튼(또는 펼친 스위치 묶음) 바로 밑 — --map-legend-top 은 MapArea 가 정한다.
      className="absolute top-(--map-legend-top) left-[12px] z-[2] flex max-w-[calc(100%-24px)] flex-col gap-[5px] rounded-[14px] border-[0.5px] border-white/50 bg-surface/75 px-[10px] py-[7px] text-left shadow-[0px_4px_16px_rgba(0,0,0,0.14)] backdrop-blur-[10px] backdrop-saturate-[1.8] sm:hidden"
    >
      <span className="flex min-w-0 items-center gap-[4px]">
        <span className="truncate text-[11px] leading-[14px] font-bold text-zinc-900">
          {state.summary}
        </span>
        <ChevronDownIcon className="size-[12px] shrink-0 -rotate-90 text-zinc-600 dark:text-[#b4b5bf]" />
      </span>
      <span className="flex gap-[2px]">
        {POP_LEVELS.map((lv) => (
          <span
            key={lv.label}
            className="h-[5px] w-[14px] rounded-[2px]"
            style={{ background: lv.color }}
          />
        ))}
      </span>
    </button>
  );
}

/**
 * 모바일 유동인구 시트 — 아래에서 올라오는 Drawer(손잡이를 끌어내리거나 바깥을 눌러 닫는다).
 * PC 유동인구 카드와 같은 내용: 지금 조건·색 띠·누른 칸 정보·조건 고르기.
 */
export function PopGridSheet({ state }: { state: PopGridState }) {
  const { data: cells } = usePopGridCells(true);
  const { data: grid, isFetching } = usePopGridValues(state.query);
  const rank = useRank(grid?.values);
  const sel = state.selected;
  const value = sel != null ? (grid?.values[sel] ?? null) : null;
  return (
    <Drawer
      isOpen={state.sheetOpen}
      onOpenChange={(open) => state.setSheetOpen(open)}
    >
      <Drawer.Backdrop>
        <Drawer.Content placement="bottom">
          {/* 높이는 내용만큼, 길면 보이는 높이(dvh)의 80%까지 — 실시간 인구 시트와 같다. */}
          <Drawer.Dialog
            aria-label="인구 분포"
            // 바탕은 옅은 회색 — 고른 칩(흰 바탕)이 시트 바탕과 구분되게(다크는 칩보다 한 단계 밝은 회색).
            className="flex max-h-[80dvh] w-full flex-col gap-0 rounded-t-[24px] bg-[#f3f3f6] p-0 pt-[10px] dark:bg-[#24252b]"
          >
            <Drawer.Handle />
            <div className="flex shrink-0 items-start justify-between gap-[8px] px-[16px] pt-[8px] pb-[10px]">
              <div className="flex min-w-0 flex-col gap-[2px]">
                <span className="text-[17px] leading-[24px] font-bold text-zinc-900">
                  인구 분포
                </span>
                <span className="truncate text-[13px] leading-[18px] text-zinc-700 dark:text-[#c9cad3]">
                  {isFetching ? "불러오는 중…" : state.summary}
                </span>
              </div>
              <button
                type="button"
                onClick={() => state.setSheetOpen(false)}
                aria-label="닫기"
                className="-mr-[6px] flex size-[32px] shrink-0 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-900/5 dark:text-[#b4b5bf]"
              >
                <XIcon className="size-[20px]" />
              </button>
            </div>
            <PopLegend
              breaks={grid?.breaks ?? []}
              metric={state.metric}
              missingMonths={grid?.missingMonths ?? []}
            />
            <ScrollShadow
              size={32}
              className="flex min-h-0 flex-1 flex-col pb-[calc(20px+env(safe-area-inset-bottom))]"
            >
              {sel != null && cells && (
                <div>
                  <PopCellSection
                    cell={cells[sel]}
                    value={value}
                    rankValue={rank(value)}
                    metric={state.metric}
                    query={{
                      metric: state.metric,
                      band: state.band,
                      sex: state.segOk ? state.sex : "all",
                      ages: state.segOk ? state.ages : [],
                    }}
                    target={state.target}
                    activeMonths={state.activeMonths}
                    onClose={() => state.setSelected(null)}
                  />
                </div>
              )}
              <div className="border-t border-zinc-900/5 px-[16px] pt-[14px] dark:border-white/10">
                <PopGridControls state={state} />
              </div>
            </ScrollShadow>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

/**
 * 매체 찾기 지도 "유동인구" 층 — 격자 칠하기와 마우스를 올린 칸의 작은 이름표(PC)만. 범례·누른 칸 정보·조건은
 * 유동인구 카드(PopGridPanel)에 있다. 칸을 누르면 카드에 그 칸 정보가 붙는다.
 */
export function PopGridLayer({
  mapRef,
  mapReady,
  state,
  realtime = null,
}: {
  mapRef: RefObject<KakaoMap | null>;
  mapReady: boolean;
  state: PopGridState;
  /** 도로 현황·실시간 인구 — 격자 위에 다시 그린다 */
  realtime?: PopRealtime | null;
}) {
  const isDesktop = useIsDesktop();
  const { data: cells } = usePopGridCells(true);
  const { data: grid } = usePopGridValues(state.query);
  const rank = useRank(grid?.values);
  const [hover, setHover] = useState<{
    index: number;
    x: number;
    y: number;
  } | null>(null);
  // 모바일 — 칸을 눌러 팝오버를 띄웠는지(자리는 지도 아래쪽 고정). 지도를 움직이면 닫는다.
  const [tap, setTap] = useState<{ x: number; y: number } | null>(null);

  useMapPopGrid({
    mapRef,
    mapReady,
    cells: cells ?? null,
    values: grid?.values ?? null,
    breaks: grid?.breaks ?? [],
    selected: state.selected,
    realtime,
    onHover: isDesktop ? setHover : () => {},
    onSelect: (i, point) => {
      state.setSelected(i);
      // 모바일은 누른 자리에 칸 정보 팝오버 — "자세히 보기"로 시트를 연다.
      setTap(!isDesktop && i != null && point ? point : null);
    },
    onViewChange: () => setTap(null),
  });

  const hovered = hover && cells ? cells[hover.index] : null;
  const hoverValue = hover ? (grid?.values[hover.index] ?? null) : null;
  const sel = state.selected;
  if (!isDesktop && tap && sel != null && cells) {
    const v = grid?.values[sel] ?? null;
    return (
      <div
        role="dialog"
        aria-label={`${cells[sel][1]} ${cells[sel][2]} 인구 분포`}
        // 모바일 지도는 낮아 누른 자리에 붙이면 "목록 보기" 버튼·지도 밖으로 넘친다 — 그 버튼 바로 위에 고정.
        className="absolute inset-x-[12px] bottom-[76px] z-[3] flex flex-col overflow-hidden rounded-[18px] border-[0.5px] border-white/50 bg-surface/85 shadow-[0px_8px_24px_0px_rgba(0,0,0,0.18)] backdrop-blur-[14px] backdrop-saturate-[1.8] [&>div:first-child]:border-t-0 [&>div:first-child]:px-[14px]"
      >
        <PopCellSection
          cell={cells[sel]}
          value={v}
          rankValue={rank(v)}
          metric={state.metric}
          query={{
            metric: state.metric,
            band: state.band,
            sex: state.segOk ? state.sex : "all",
            ages: state.segOk ? state.ages : [],
          }}
          target={state.target}
          activeMonths={state.activeMonths}
          onClose={() => {
            setTap(null);
            state.setSelected(null);
          }}
        />
        <button
          type="button"
          onClick={() => {
            setTap(null);
            state.setSheetOpen(true);
          }}
          className="flex h-[40px] shrink-0 items-center justify-center gap-[4px] border-t border-zinc-900/5 text-[13px] font-semibold text-zinc-900 dark:border-white/10"
        >
          자세히 보기
          <ChevronDownIcon className="size-[12px] -rotate-90" />
        </button>
      </div>
    );
  }
  if (!hovered || !hover) return null;
  return (
    <div
      className="pointer-events-none absolute z-[3] flex flex-col gap-[1px] rounded-[10px] bg-scrim/70 px-[10px] py-[6px] text-white shadow-[0px_3px_10px_rgba(0,0,0,0.2)] backdrop-blur-[6px]"
      style={{ left: hover.x + 14, top: hover.y + 14 }}
    >
      <span className="text-[12px] leading-[16px] font-bold whitespace-nowrap">
        {hovered[1]} {hovered[2]}
      </span>
      <span className="text-[11px] leading-[15px] whitespace-nowrap tabular-nums">
        {state.target} {valueText(state.metric, hoverValue)}
        {hoverValue != null && (
          <span className="ml-[4px] text-white/60">
            · {rankText(rank(hoverValue))}
          </span>
        )}
      </span>
    </div>
  );
}

/** 색 띠 — 단계마다 색 칸과 "서울 상위 몇 %"(오른쪽으로 갈수록 많은 곳). 칸에 마우스를 올리면 경계 값. */
function PopLegend({
  breaks,
  metric,
  missingMonths,
}: {
  breaks: number[];
  metric: PopMetric;
  missingMonths: string[];
}) {
  // 합친 점수(유동인구·생활·체류인구)는 경계 값을 보이지 않는다.
  const unit =
    metric === "flow" || metric === "people"
      ? null
      : metric === "walk"
        ? ""
        : metric === "live"
          ? "명"
          : "명/시간";
  return (
    <div className="flex flex-col gap-[4px] px-[20px] pb-[12px] max-sm:px-[16px]">
      <div className="flex items-center gap-[8px]">
        <span className="shrink-0 text-[11px] font-semibold text-zinc-600 dark:text-[#b4b5bf]">
          서울 상위
        </span>
        <div className="flex min-w-0 flex-1 gap-[3px]">
          {POP_LEVELS.map((lv, i) => (
            <div
              key={lv.label}
              className="flex min-w-0 flex-1 flex-col items-center gap-[3px]"
              title={
                unit != null && i > 0 && breaks[i - 1] != null
                  ? `${lv.label} — ${Math.round(breaks[i - 1]).toLocaleString()}${unit} 이상`
                  : lv.label
              }
            >
              <span
                className="h-[10px] w-full rounded-[3px]"
                style={{ background: lv.color }}
              />
              <span className="text-[10px] leading-[12px] font-medium text-zinc-700 dark:text-[#c9cad3] tabular-nums">
                {lv.short}
              </span>
            </div>
          ))}
        </div>
      </div>
      {missingMonths.length > 0 && (
        <span className="text-[10px] text-amber-700">
          {missingMonths.map(monthLabel).join("·")}은 자료가 없어 빼고
          계산했어요
        </span>
      )}
    </div>
  );
}

function PopCellSection({
  cell,
  value,
  rankValue,
  metric,
  query,
  target,
  activeMonths,
  onClose,
}: {
  cell: [string, string, string, number[]];
  value: number | null;
  rankValue: number | null;
  metric: PopMetric;
  query: { metric: PopMetric; band: PopBand; sex: PopSex; ages: PopAge[] };
  target: string;
  activeMonths: string[];
  onClose: () => void;
}) {
  const { data: trend } = usePopCellTrend(cell[0], query);
  // 막대에 올리면 그달 인구 수 — 유동인구·생활·체류인구는 합친 점수라 같은 칸·성·연령의 생활인구 수를 따로 받는다.
  const scored = metric === "flow" || metric === "people";
  const countMetric: PopMetric = scored ? "live" : metric;
  const { data: countTrend } = usePopCellTrend(scored ? cell[0] : null, {
    ...query,
    metric: "live",
  });
  const counts = new Map(
    ((scored ? countTrend : trend)?.months ?? []).map((m) => [m.ym, m.value]),
  );
  const [tip, setTip] = useState<string | null>(null);
  const shown = (trend?.months ?? []).filter((m) =>
    activeMonths.some((a) => a.slice(0, 4) === m.ym.slice(0, 4)),
  );
  const max = Math.max(1, ...shown.map((m) => m.value ?? 0));
  const best = shown.reduce<{ ym: string; value: number | null } | null>(
    (a, m) =>
      m.value != null && (a?.value == null || m.value > a.value) ? m : a,
    null,
  );
  return (
    <div className="flex flex-col gap-[8px] border-t border-zinc-900/5 px-[20px] pt-[10px] pb-[12px] max-sm:px-[16px]">
      <div className="flex items-start justify-between gap-[8px]">
        <div className="flex min-w-0 flex-col gap-[2px]">
          <span className="truncate text-[14px] leading-[20px] font-bold text-zinc-900">
            {cell[1]} {cell[2]}
          </span>
          <span className="text-[12px] leading-[16px] text-zinc-700 dark:text-[#c9cad3] tabular-nums">
            {target} {valueText(metric, value)}
            {value != null && (
              <span className="ml-[4px] text-zinc-500 dark:text-[#a4a5af]">
                · {rankText(rankValue)}
              </span>
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="-mt-[2px] -mr-[4px] flex size-[24px] shrink-0 items-center justify-center rounded-full text-zinc-600 dark:text-[#b4b5bf] hover:bg-zinc-900/5"
        >
          <XIcon className="size-[16px]" />
        </button>
      </div>
      {shown.length > 0 && (
        <div className="flex flex-col gap-[4px]">
          <span className="text-[11px] font-bold text-zinc-600 dark:text-[#b4b5bf]">
            달별
            {best?.value != null && ` · 가장 많은 달 ${monthLabel(best.ym)}`}
          </span>
          {/* 모바일은 지도를 덜 밀어내게 막대를 낮게. 높이는 막대 칸 안 비율(%)로.
              막대에 마우스를 올리면(모바일은 누르면) 그달 인구 수 툴팁. */}
          <div
            className="relative flex h-[48px] items-end gap-[3px] max-sm:h-[34px]"
            onMouseLeave={() => setTip(null)}
          >
            {shown.map((m, i) => {
              const on = activeMonths.includes(m.ym);
              const count = counts.get(m.ym) ?? null;
              const label = `${monthLabel(m.ym)} · ${valueText(countMetric, count)}${scored ? " (생활인구)" : ""}`;
              return (
                <button
                  type="button"
                  key={m.ym}
                  aria-label={label}
                  onMouseEnter={() => setTip(m.ym)}
                  onFocus={() => setTip(m.ym)}
                  onBlur={() => setTip(null)}
                  onClick={() => setTip(tip === m.ym ? null : m.ym)}
                  className="relative flex h-full flex-1 flex-col items-center justify-end gap-[2px] outline-none"
                >
                  <div className="flex min-h-0 w-full flex-1 items-end">
                    <div
                      className={cn(
                        "w-full rounded-t-[3px] transition-colors",
                        // 블루그레이(slate) — 지도 색 띠(노랑~빨강)와 겹치지 않는 무난한 색. 고른 달은 진하게,
                        // 나머지는 한 단계 옅게(너무 밝으면 막대가 바탕에 묻힌다), 올린 달은 더 진하게.
                        m.value == null
                          ? "bg-zinc-200"
                          : tip === m.ym
                            ? "bg-slate-700 dark:bg-slate-300"
                            : on
                              ? "bg-slate-500 dark:bg-slate-400"
                              : "bg-slate-300 dark:bg-slate-600",
                      )}
                      style={{
                        height: `${m.value == null ? 8 : Math.max(8, (m.value / max) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-[9px] leading-[10px] text-zinc-600 dark:text-[#b4b5bf] tabular-nums">
                    {Number(m.ym.slice(4))}
                  </span>
                  {tip === m.ym && (
                    // 양 끝 막대는 툴팁이 카드 밖으로 나가지 않게 한쪽으로 붙인다.
                    <span
                      role="tooltip"
                      className={cn(
                        "pointer-events-none absolute bottom-[calc(100%+4px)] z-10 rounded-[8px] bg-scrim/80 px-[8px] py-[4px] text-[11px] leading-[15px] font-semibold whitespace-nowrap text-white tabular-nums shadow-[0px_3px_10px_rgba(0,0,0,0.2)]",
                        i < 2
                          ? "left-0"
                          : i > shown.length - 3
                            ? "right-0"
                            : "left-1/2 -translate-x-1/2",
                      )}
                    >
                      {label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
