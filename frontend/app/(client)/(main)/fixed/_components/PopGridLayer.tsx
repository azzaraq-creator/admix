"use client";

import {
  Button,
  Drawer,
  ListBox,
  ScrollShadow,
  Select,
  Switch,
} from "@heroui/react";
import {
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { createPortal } from "react-dom";

import {
  ChevronDownIcon,
  InfoIcon,
  RotateLeftIcon,
  PopulationGridIcon,
  XIcon,
} from "@/components/icons";
import type { CrowdPlace } from "@/hooks/media";
import {
  type PopAge,
  type PopCell,
  type PopBand,
  type PopMetric,
  type PopSex,
  usePopCellTrend,
  usePopGridCells,
  usePopGridMonths,
  usePopGridValues,
  usePopGridValuesList,
} from "@/hooks/popGrid";
import { useCloseOnBack } from "@/hooks/useCloseOnBack";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import type { KakaoMap } from "@/lib/kakaoMap";
import { cn } from "@/lib/utils";

import { crowdColor } from "./useMapCrowd";
import {
  cellGroups,
  type GroupOverlay,
  POP_LEVELS,
  type PopRealtime,
  popLevel,
  useMapPopGrid,
} from "./useMapPopGrid";

const METRICS: { key: PopMetric; label: string; desc: string }[] = [
  {
    key: "live",
    label: "생활인구",
    desc: "그 시각에 그 칸에 있던 사람 수(고른 기간·시간대의 한 시각 평균) — 사는 사람·일하는 사람·지나는 사람을 모두 세요",
  },
  {
    key: "household",
    label: "거주인구",
    desc: "행정안전부 주민등록 세대수(행정동) — 동마다 값 하나라 그 동의 칸을 모두 같은 색으로 칠해요",
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
  household:
    "거주인구는 행정안전부 주민등록 세대수라 성별·연령 구분이 없어요. 동 전체 세대수로 보여요.",
  walk: "보행 자료는 성별과 연령이 따로따로만 있어 '20대 남성'처럼 함께 고를 수 없어요. 전체 인원으로 보여요.",
};
// 성·연령 구분이 있는 자료
const SEG_METRICS = new Set<PopMetric>(["flow", "people", "live"]);
// 자료마다 출처(짧게) — 인구 분포 창 맨 아래·누른 칸 정보 카드.
const SOURCES: Record<PopMetric, string> = {
  flow: "서울시 생활인구·교통카드·상권분석서비스",
  people: "서울시 생활인구 (KT 통신데이터)",
  live: "서울시 생활인구 (KT 통신데이터)",
  household: "행정안전부 주민등록 세대수",
  subway: "서울시 지하철 승하차 (교통카드)",
  walk: "서울시 상권분석서비스",
};
// 시간대를 고르지 않는 자료 — 시간대 카드에 값과 이유를 보여 준다.
const FIXED_BAND: Partial<Record<PopMetric, [string, string]>> = {
  household: ["구분 없음", "거주인구(주민등록 세대수)는 시간대 구분이 없어요."],
};
// 사람 수 자료 — 함께 고르면 격자 칸 숫자를 더해 적는다(보행은 상대값, 거주인구는 세대수라 빼고).
const PEOPLE_METRICS = new Set<PopMetric>(["live", "subway"]);
// 여러 자료를 함께 골랐을 때 첫 자료(칸 색·숫자·기간 기준)로 삼는 순서.
const PRIMARY_ORDER: PopMetric[] = ["live", "subway", "walk", "household"];
// 자료가 있는 달 — /months 의 metrics 에 이 이름이 있어야 고를 수 있다.
const MONTH_NEED: Record<PopMetric, string> = {
  flow: "live",
  people: "live",
  live: "live",
  household: "household",
  subway: "subway",
  walk: "walk",
};
const NO_MONTH_TEXT: Partial<Record<PopMetric, string>> = {
  household:
    "거주인구 자료가 아직 없어요 — 어드민에서 행정안전부 세대수 CSV를 올린 달부터 보여요.",
};
/** 출처 한 줄 — 유동인구 창 맨 아래와 모바일 시트 색 띠 아래. */
/** 출처 한 줄(짧게) — 여러 자료를 함께 고르면 출처를 다 적는다. */
function PopSource({
  metric,
  extras = [],
}: {
  metric: PopMetric;
  extras?: PopMetric[];
}) {
  return (
    <p className="text-[10px] leading-[14px] text-zinc-500 dark:text-[#a4a5af]">
      출처: {[metric, ...extras].map((m) => SOURCES[m]).join(" · ")}
    </p>
  );
}

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
  if (metric === "people") return "생활인구";
  if (metric === "live") return `약 ${n}명`;
  if (metric === "household") return `${Math.round(v).toLocaleString()}세대`;
  if (metric === "subway") return `시간당 약 ${n}명 승하차`;
  return `보행 ${n}`;
}

/** 칸 → 동 묶음(동 경계·동 이름). 동 이름은 숫자를 적는 가운데 칸에만. */
function dongGroups(cells: PopCell[], labelCells: number[]) {
  const names: (string | null)[] = cells.map(() => null);
  labelCells.forEach((i) => (names[i] = cells[i][2]));
  return cellGroups(
    cells,
    cells.map((c) => (c[2] ? `${c[1]} ${c[2]}` : null)),
    names,
  );
}

/** 함께 고른 자료 — 지도에 겹쳐 칠할 값(자료마다 한 장)과, 거주인구가 있으면 옅은 동 경계. */
function useOverlay(state: PopGridState, cells: PopCell[] | undefined) {
  const grids = usePopGridValuesList(state.overlayLayers.map((l) => l.query));
  // 고른 자료 이름 — 조건 목록은 그릴 때마다 새로 만들어져 값으로 견준다.
  const metricsKey = state.overlayLayers.map((l) => l.metric).join(",");
  return useMemo<GroupOverlay | null>(() => {
    const metrics = metricsKey.split(",");
    const got = grids.flatMap((g, i) =>
      g && metrics[i] ? [{ ...g, metric: metrics[i] }] : [],
    );
    if (!cells || !state.overlay || !got.length) return null;
    const dong = got.find((g) => g.labelCells)?.labelCells;
    return {
      layers: got.map((g) => ({
        metric: g.metric,
        values: g.values,
        breaks: g.breaks,
      })),
      groups: dong ? dongGroups(cells, dong) : null,
    };
  }, [cells, state.overlay, metricsKey, grids]);
}

/** 모바일 칸 말풍선의 값 한 줄 — 생활인구는 빼고(시트의 월별 막대로), 거주인구는 세대수만. 서울 순위는 보이지 않는다. */
function tapValueText(metric: PopMetric, v: number | null): string {
  if (v == null) return "자료 없음";
  if (metric === "live") return "";
  return `${metric === "household" ? "주민등록 " : ""}${valueText(metric, v)}`;
}

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
        // 흰 카드(OptionCard) 위 — 고르기 전엔 옅은 회색, 고르면 흰 바탕에 회색 테두리·진한 글자(무채색으로 무난하게).
        "h-[32px] shrink-0 rounded-full border px-[12px] text-[13px] whitespace-nowrap transition-colors max-sm:h-[30px] max-sm:px-[11px] max-sm:text-[12px]",
        on
          ? "border-zinc-400 bg-surface font-semibold text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:border-white/40 dark:bg-white/[0.14] dark:text-white"
          : "border-transparent font-normal bg-zinc-900/[0.05] text-zinc-700 hover:bg-zinc-900/[0.09] dark:bg-white/[0.08] dark:text-[#c9cad3] dark:hover:bg-white/[0.12]",
        (disabled || locked) &&
          "opacity-40 hover:bg-zinc-900/[0.05] dark:hover:bg-white/[0.08]",
        disabled && "cursor-not-allowed",
      )}
    >
      {children}
    </button>
  );
}

/** 유동인구 창 항목 하나 — 흰 카드에 제목·지금 고른 값(오른쪽)·고르는 칩. 칩 묶음이 둘이면 줄을 나눠 넘긴다. */
function OptionCard({
  lead,
  title,
  hint,
  value,
  children,
}: {
  /** 제목 앞 — 기간처럼 연도 Select("2025년 기간") */
  lead?: React.ReactNode;
  title: string;
  /** 제목 옆 작은 설명(예: 여러 달은 평균) */
  hint?: string;
  /** 오른쪽 — 지금 고른 값(회색 글자), 또는 기간처럼 연도 Select. */
  value: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-[10px] rounded-[16px] bg-surface p-[14px] dark:bg-white/[0.05]">
      <div className="flex items-baseline justify-between gap-[8px]">
        <h3 className="flex min-w-0 items-baseline gap-[6px]">
          {lead}
          <span className="shrink-0 text-[14px] font-bold text-zinc-900 max-sm:text-[13px]">
            {title}
          </span>
          {hint && (
            <span className="truncate text-[11px] text-zinc-500 dark:text-[#a9aab4]">
              {hint}
            </span>
          )}
        </h3>
        {typeof value === "string" ? (
          <span className="shrink-0 text-[13px] font-semibold text-zinc-600 max-sm:text-[12px] dark:text-[#c9cad3]">
            {value}
          </span>
        ) : (
          value
        )}
      </div>
      {children}
    </section>
  );
}

/** 기간 카드 제목 앞 연도 Select — 작은 회색 알약 버튼, 누르면 아래로 연도 목록. */
function YearSelect({
  years,
  value,
  onChange,
}: {
  years: string[];
  value: string;
  onChange: (year: string) => void;
}) {
  return (
    <Select
      aria-label="연도"
      selectedKey={value}
      onSelectionChange={(key) => {
        if (key != null) onChange(String(key));
      }}
      className="-my-[4px] shrink-0"
    >
      <Select.Trigger className="flex h-[28px] min-h-0 items-center gap-[4px] rounded-full border-0 bg-zinc-900/[0.05] pr-[8px] pl-[12px] text-[13px] font-semibold text-zinc-900 shadow-none hover:bg-zinc-900/[0.09] data-[open=true]:bg-zinc-900/[0.09] max-sm:text-[12px] dark:bg-white/[0.08] dark:text-white">
        <Select.Value className="text-[13px] font-semibold whitespace-nowrap text-zinc-900 max-sm:text-[12px] dark:text-white">
          {value}년
        </Select.Value>
        <Select.Indicator className="static size-[14px] shrink-0 text-zinc-500" />
      </Select.Trigger>
      <Select.Popover placement="bottom start" className="w-[140px]">
        <ListBox>
          {years.map((y) => (
            <ListBox.Item key={y} id={y} textValue={`${y}년`}>
              {y}년
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/** 카드 안 칩 한 묶음 */
function ChipRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-[6px]">{children}</div>;
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

// 고른 조건(자료·해·달·시간대·성별·연령) — 새로고침해도 그대로 보이게 이 브라우저에 기억한다.
const POP_GRID_QUERY_KEY = "admix.map.pop-grid.query";

interface StoredPopQuery {
  metric: PopMetric;
  /** 함께 고른 자료 */
  extras: PopMetric[];
  /** 예전 저장값(거주인구만 함께 고를 수 있던 때) — 읽기만 한다 */
  residentOn?: boolean;
  year: string | null;
  pickedMonths: string[];
  band: PopBand;
  sex: PopSex;
  ages: PopAge[];
}

/** 저장해 둔 조건 — 지금 없는 선택지 값은 버린다. 없거나 깨졌으면 null. */
function loadPopQuery(): Partial<StoredPopQuery> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(POP_GRID_QUERY_KEY);
    if (!raw) return null;
    const q = JSON.parse(raw) as Partial<StoredPopQuery>;
    const ym = (v: unknown) => typeof v === "string" && /^\d{6}$/.test(v);
    return {
      metric: METRICS.some((m) => m.key === q.metric) ? q.metric : undefined,
      extras: Array.isArray(q.extras)
        ? q.extras.filter((k) => METRICS.some((m) => m.key === k))
        : q.residentOn === true
          ? ["household"]
          : [],
      year:
        typeof q.year === "string" && /^\d{4}$/.test(q.year) ? q.year : null,
      pickedMonths: Array.isArray(q.pickedMonths)
        ? q.pickedMonths.filter(ym)
        : [],
      band: BANDS.some((b) => b.key === q.band) ? q.band : undefined,
      sex: SEXES.some((x) => x.key === q.sex) ? q.sex : undefined,
      ages: Array.isArray(q.ages)
        ? q.ages.filter((a) => AGES.some((x) => x.key === a))
        : [],
    };
  } catch {
    return null;
  }
}

const noopSubscribe = () => () => {};

function savePopQuery(q: StoredPopQuery) {
  try {
    window.localStorage.setItem(POP_GRID_QUERY_KEY, JSON.stringify(q));
  } catch {
    // 저장이 막힌 브라우저(사생활 보호 창 등)는 기억하지 않는다.
  }
}

/**
 * 유동인구 층의 켜짐·조건 — 위쪽 줄 "유동인구" 창(PopGridTargetPanel)과 지도 층(PopGridLayer)이 함께 쓴다.
 * 매체 찾기 화면(FixedMediaView)에서 한 번 만들어 둘 다에 넘긴다.
 */
export function usePopGridState() {
  const on = usePopGridOn();
  // 유동인구 창 — 위쪽 줄 버튼, PC 인구 분포 카드·모바일 시트의 "유동인구" 버튼으로 연다.
  const [targetOpen, setTargetOpen] = useState(false);
  // 지도에서 누른 격자 칸(격자 순서 번호) — 카드에 그 칸 정보를 붙인다.
  const [selected, setSelected] = useState<number | null>(null);
  // 모바일 유동인구 시트(Drawer) — 지도 위 "유동인구" 버튼·칸 누르기·켜기로 연다.
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data: monthList } = usePopGridMonths(true);

  const [metric, setMetric] = useState<PopMetric>("live");
  // 함께 고른 자료(METRICS 순서) — 첫 자료(metric) 칸 색 위에 반투명으로 겹쳐 칠한다.
  const [extras, setExtras] = useState<PopMetric[]>([]);
  const overlay = extras.length > 0;
  const picked = [metric, ...extras];
  // 고른 자료가 없는 달은 뺀다(거주인구는 따로 올린 달에만 있다).
  const years = useMemo(() => {
    const map = new Map<string, string[]>();
    (monthList ?? []).forEach((m) => {
      if (!m.metrics.includes(MONTH_NEED[metric])) return;
      const y = m.ym.slice(0, 4);
      map.set(y, [...(map.get(y) ?? []), m.ym]);
    });
    return map;
  }, [monthList, metric]);
  const latestYear = [...years.keys()].sort().at(-1) ?? null;

  const [year, setYear] = useState<string | null>(null);
  const shownYear = year && years.has(year) ? year : latestYear;
  const yearMonths = shownYear ? (years.get(shownYear) ?? []) : [];
  // 빈 배열 = 그해 전체.
  const [pickedMonths, setPickedMonths] = useState<string[]>([]);
  const months = pickedMonths.filter((m) => yearMonths.includes(m));
  const activeMonths = months.length ? months : yearMonths;

  const [band, setBand] = useState<PopBand>("all");
  const [sex, setSex] = useState<PopSex>("all");
  const [ages, setAges] = useState<PopAge[]>([]);

  // 기억해 둔 조건(새로고침 전 값) — 서버 그림과 맞추려고 화면이 뜬 뒤 한 번 불러온다(그리는 중에 바로 고쳐 깜빡임 없이).
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const [restored, setRestored] = useState(false);
  if (hydrated && !restored) {
    setRestored(true);
    const q = loadPopQuery();
    if (q) {
      if (q.metric) setMetric(q.metric);
      setExtras(q.extras ?? []);
      setYear(q.year ?? null);
      setPickedMonths(q.pickedMonths ?? []);
      if (q.band) setBand(q.band);
      if (q.sex) setSex(q.sex);
      setAges(q.ages ?? []);
    }
  }

  // 불러온 다음부터 바뀔 때마다 기억한다.
  useEffect(() => {
    if (restored)
      savePopQuery({ metric, extras, year, pickedMonths, band, sex, ages });
  }, [restored, metric, extras, year, pickedMonths, band, sex, ages]);

  const segOk = SEG_METRICS.has(metric);
  const query = shownYear
    ? {
        months: activeMonths,
        metric,
        // 거주인구(세대수)는 시간대 구분이 없다.
        band: FIXED_BAND[metric] ? ("all" as PopBand) : band,
        sex: segOk ? sex : ("all" as PopSex),
        ages: segOk ? ages : [],
      }
    : null;
  // 자료마다 들어 있는 달.
  const monthsOf = useMemo(() => {
    const map = new Map<string, string[]>();
    (monthList ?? []).forEach((m) =>
      m.metrics.forEach((k) => map.set(k, [...(map.get(k) ?? []), m.ym])),
    );
    return map;
  }, [monthList]);
  // 함께 고른 자료의 지도 — 고른 달 가운데 그 자료가 있는 달, 없으면 그 자료의 가장 최근 달(fallback).
  // 시간대는 첫 자료와 같이(거주인구는 구분 없음), 성·연령은 첫 자료(생활인구)에만 건다.
  const overlayLayers = extras.flatMap((m) => {
    const all = monthsOf.get(MONTH_NEED[m]) ?? [];
    const inPicked = activeMonths.filter((x) => all.includes(x));
    const ms = inPicked.length ? inPicked : all.slice(-1);
    if (!ms.length) return [];
    return [
      {
        metric: m,
        fallback: !inPicked.length,
        query: {
          months: ms,
          metric: m,
          band: FIXED_BAND[m] ? ("all" as PopBand) : band,
          sex: "all" as PopSex,
          ages: [] as PopAge[],
        },
      },
    ];
  });
  const target = segOk
    ? targetLabel(sex, ages)
    : metric === "household"
      ? "주민등록"
      : "전체(성·연령 구분 없음)";
  const metricInfo = METRICS.find((m) => m.key === metric)!;
  const bandLabel = BANDS.find((b) => b.key === band)!.label;
  // 지금 조건 — 항목 이름(유동인구 창 카드 제목과 같다)을 붙여 "생활인구"·"전체"가 무엇의 값인지 알게 한다.
  // 시간대는 하루 전체면, 성별·연령은 고를 수 없는 자료면 뺀다.
  const pickedLabel = picked
    .map((k) => METRICS.find((m) => m.key === k)?.label ?? k)
    .join(" + ");
  const summaryParts = [
    { label: "자료", value: pickedLabel },
    // 고른 달에 함께 고른 자료가 없어 다른 달로 겹쳐 볼 때 — 그 달을 밝혀 둔다.
    ...overlayLayers
      .filter((l) => l.fallback)
      .map((l) => ({
        label: METRICS.find((m) => m.key === l.metric)?.label ?? l.metric,
        value: `${l.query.months[0].slice(0, 4)}년 ${monthLabel(l.query.months[0])} 기준`,
      })),
    {
      label: "기간",
      value: shownYear ? monthsLabel(shownYear, activeMonths, yearMonths) : "",
    },
    {
      label: "시간대",
      value: FIXED_BAND[metric] || band === "all" ? "" : bandLabel,
    },
    { label: "성별·연령", value: segOk ? target : "" },
  ].filter((p) => p.value);
  const summary = summaryParts.map((p) => `${p.label} ${p.value}`).join(" · ");

  // 처음 조건(생활인구·최근 해 전체·하루 전체·성별·연령 전체)에서 바꾼 게 있는지 — 유동인구 창 초기화를 잠글지.
  const changed =
    metric !== "live" ||
    overlay ||
    shownYear !== latestYear ||
    months.length > 0 ||
    band !== "all" ||
    sex !== "all" ||
    ages.length > 0;

  return {
    on,
    /** 지도 스위치 — 모바일 시트는 켤 때 저절로 올리지 않는다(지도부터 보게) — 끌 때만 닫는다. */
    toggle: (next: boolean) => {
      setPopGridOn(next);
      if (!next) setSheetOpen(false);
      if (!next) setSelected(null);
    },
    setOn: setPopGridOn,
    targetOpen,
    setTargetOpen,
    changed,
    /** 조건을 처음으로 — 켜짐은 그대로 둔다. */
    reset: () => {
      setYear(null);
      setPickedMonths([]);
      setMetric("live");
      setExtras([]);
      setBand("all");
      setSex("all");
      setAges([]);
    },
    selected,
    setSelected,
    sheetOpen,
    setSheetOpen,
    /** 매체 찾기 가이드 예시 — 모바일에서 누른 칸 팝오버를 지도를 누르지 않아도 띄운다(useGuidePopGrid). */
    demo: false,
    /** 올린 달이 하나도 없음 */
    empty: !!monthList && monthList.length === 0,
    /** 고른 자료(거주인구)가 있는 달이 없음 — 따로 올리는 자료라 올린 달이 있어도 없을 수 있다 */
    noMonthsForMetric: !!monthList?.length && years.size === 0,
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
    setMetric: (key: PopMetric) => {
      setMetric(key);
      setExtras([]);
    },
    /**
     * 자료 칩 누르기 — 여러 개를 함께 고를 수 있다(누르면 넣고 빼기). 하나는 늘 골라져 있어야 해서 마지막 하나는 빠지지 않는다.
     * 첫 자료(칸 색·숫자·기간·성·연령 기준)는 생활인구 → 지하철 → 보행 → 거주인구 순 — 거주인구는 동 단위라 혼자일 때만 첫 자료.
     */
    pickMetric: (key: PopMetric) => {
      const next = picked.includes(key)
        ? picked.filter((k) => k !== key)
        : [...picked, key];
      if (!next.length) return;
      const first = PRIMARY_ORDER.find((k) => next.includes(k)) ?? next[0];
      setMetric(first);
      setExtras(
        METRICS.map((m) => m.key).filter(
          (k) => k !== first && next.includes(k),
        ),
      );
    },
    isPicked: (key: PopMetric) => picked.includes(key),
    overlay,
    extras,
    /** 함께 고른 자료 — 지도에 겹쳐 칠할 값을 받을 조건, 누른 칸 정보의 자료 칸 */
    overlayLayers,
    pickedLabel,
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
    summaryParts,
  };
}

export type PopGridState = ReturnType<typeof usePopGridState>;

const noop = () => {};

/**
 * 매체 찾기 가이드 — 인구 분포 단계 동안 쓰는 예시 상태. 진짜 켜짐·고른 칸은 건드리지 않고 켠 것처럼 보이게 한다.
 * "conditions"는 유동인구 창을 연 것(PC), "cell"은 서울에서 값이 가장 큰 칸을 누른 것처럼 칸 정보를 띄운다.
 * "off"는 끈 스위치만 보여 준다(실시간 인구 단계 — 스위치 묶음 모양이 늘 같게).
 */
export function useGuidePopGrid(
  state: PopGridState,
  step: "conditions" | "cell" | "off" | null,
): PopGridState {
  const { data: grid } = usePopGridValues(step === "cell" ? state.query : null);
  // 모바일은 지도 위 인구 분포 버튼을 밝히므로 유동인구 창을 열지 않는다(열면 지도를 가린다).
  const isDesktop = useIsDesktop();
  const top = useMemo(() => {
    let best: number | null = null;
    (grid?.values ?? []).forEach((v, i) => {
      if (v != null && (best == null || v > (grid?.values[best] ?? 0)))
        best = i;
    });
    return best;
  }, [grid]);
  if (!step) return state;
  return {
    ...state,
    on: step !== "off",
    toggle: noop,
    targetOpen: step === "conditions" && isDesktop,
    setTargetOpen: noop,
    selected: step === "cell" ? top : null,
    setSelected: noop,
    sheetOpen: false,
    setSheetOpen: noop,
    demo: step === "cell",
  };
}

/** 인구 분포 조건 고르기 — 자료·기간·시간대·성별·연령. 유동인구 창(PopGridTargetPanel) 안에 둔다. */
function PopGridControls({ state }: { state: PopGridState }) {
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
    <div className="flex flex-col gap-[10px]">
      {s.empty ? (
        <p className="text-[12px] text-zinc-600 dark:text-[#b4b5bf]">
          아직 올린 인구 분포 자료가 없어요.
        </p>
      ) : (
        <>
          <OptionCard
            title="자료"
            hint=""
            value={s.overlay ? `${s.extras.length + 1}개 함께` : s.pickedLabel}
          >
            <ChipRow>
              {METRICS.map((m) => (
                <ChipButton
                  key={m.key}
                  on={s.isPicked(m.key)}
                  onClick={() => s.pickMetric(m.key)}
                >
                  {m.label}
                </ChipButton>
              ))}
            </ChipRow>
          </OptionCard>

          <OptionCard
            // 연도는 제목 앞 Select("2025년 기간") — 어드민이 올린 달이 있는 해만(다음 해 자료를 올리면 저절로 늘어난다).
            lead={
              s.shownYear && (
                <YearSelect
                  years={[...s.years.keys()].sort().reverse()}
                  value={s.shownYear}
                  onChange={s.setYear}
                />
              )
            }
            title="기간"
            hint="여러 달은 평균"
            value={
              !s.months.length
                ? "1년 전체"
                : s.months.length <= 3
                  ? s.months.map(monthLabel).join("·")
                  : `${s.months.length}개월`
            }
          >
            <ChipRow>
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
            </ChipRow>
          </OptionCard>

          {FIXED_BAND[s.metric] ? (
            <OptionCard title="시간대" value={FIXED_BAND[s.metric]![0]}>
              <p className="text-[12px] leading-[17px] text-zinc-600 dark:text-[#b4b5bf]">
                {FIXED_BAND[s.metric]![1]}
              </p>
            </OptionCard>
          ) : (
            <OptionCard
              title="시간대"
              value={BANDS.find((b) => b.key === s.band)!.label}
            >
              <ChipRow>
                {BANDS.map((b) => (
                  <ChipButton
                    key={b.key}
                    on={s.band === b.key}
                    onClick={() => s.setBand(b.key)}
                  >
                    {b.label}
                  </ChipButton>
                ))}
              </ChipRow>
            </OptionCard>
          )}

          <OptionCard
            title="성별·연령"
            value={s.segOk ? targetLabel(s.sex, s.ages) : "구분 없음"}
          >
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
                      고른 {targetLabel(s.sex, s.ages)}은 생활인구에서 그대로
                      적용돼요.{" "}
                      <button
                        type="button"
                        onClick={() => s.setMetric("live")}
                        className="font-semibold text-zinc-900 underline underline-offset-2 dark:text-white"
                      >
                        생활인구로 보기
                      </button>
                    </span>
                  )}
                </div>
              </div>
            )}
            <ChipRow>
              {SEXES.map((x) => (
                <ChipButton
                  key={x.key}
                  on={s.segOk && s.sex === x.key}
                  locked={!s.segOk}
                  onClick={() => (s.segOk ? s.setSex(x.key) : showReason())}
                >
                  {/* 성별·연령이 한 카드라 "전체"가 둘 — 어느 쪽 전체인지 붙인다. */}
                  {x.key === "all" ? "전체 성별" : x.label}
                </ChipButton>
              ))}
            </ChipRow>
            <ChipRow>
              <ChipButton
                on={s.segOk && !s.ages.length}
                locked={!s.segOk}
                onClick={() => (s.segOk ? s.setAges([]) : showReason())}
              >
                전체 연령
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
            </ChipRow>
          </OptionCard>
          {s.noMonthsForMetric && NO_MONTH_TEXT[s.metric] && (
            <p className="text-[12px] text-amber-700">
              {NO_MONTH_TEXT[s.metric]}
            </p>
          )}
          <PopSource metric={s.metric} extras={s.extras} />
        </>
      )}
    </div>
  );
}

/**
 * "유동인구" — 인구 분포 조건 고르기(켜고 끄기는 지도 위 스위치). 지도를 가리지 않고 함께 보게 한다:
 * PC·태블릿은 목록 칸 자리를 이 칸으로 바꾸고(MediaFindPanel) 지도를 눌러도 닫지 않는다(칸을 눌러 보며 고르게).
 * 모바일은 화면 끝까지 올라오는 Drawer — 손잡이를 끌어내리거나 완료·닫기·뒤로가기로 닫는다.
 * 고르는 즉시 지도에 반영하고, 인구 분포가 꺼져 있으면 조건을 고를 때 함께 켠다.
 */
export function PopGridTargetPanel({ state }: { state: PopGridState }) {
  const isDesktop = useIsDesktop();
  const close = () => state.setTargetOpen(false);
  // 휴대폰 뒤로가기로도 닫는다.
  useCloseOnBack(state.targetOpen, close);

  // 조건을 고르면 꺼져 있던 인구 분포를 켠다 — 고른 결과가 지도에 바로 보이게.
  const withOn =
    <A extends unknown[]>(fn: (...args: A) => void) =>
    (...args: A) => {
      if (!state.on) state.setOn(true);
      fn(...args);
    };
  const picking: PopGridState = {
    ...state,
    setMetric: withOn(state.setMetric),
    setYear: withOn(state.setYear),
    pickMonth: withOn(state.pickMonth),
    clearMonths: withOn(state.clearMonths),
    setBand: withOn(state.setBand),
    setSex: withOn(state.setSex),
    setAges: withOn(state.setAges),
    toggleAge: withOn(state.toggleAge),
  };

  // 끝까지 넘긴 뒤 스크롤이 뒤 화면으로 넘어가지 않게(overscroll-contain).
  const scroll = (
    <ScrollShadow
      size={24}
      className="min-h-0 flex-1 overscroll-contain border-t border-zinc-900/5 px-[20px] pt-[14px] pb-[16px] max-sm:px-[16px] dark:border-white/10"
    >
      <PopGridControls state={picking} />
    </ScrollShadow>
  );
  const body = (
    <>
      <div className="flex shrink-0 items-center gap-[12px] px-[20px] pt-[16px] pb-[12px] max-sm:px-[16px] max-sm:pt-[8px]">
        <span className="min-w-0 flex-1 text-[15px] leading-[21px] font-bold text-zinc-900 max-sm:text-[16px] max-sm:leading-[22px]">
          인구 분포
        </span>
        {/* 완료 버튼은 없다 — 고르는 즉시 지도에 반영되고, 닫기는 X로. 초기화는 조건이 바뀌었을 때만 누를 수 있다. */}
        <Button
          variant="ghost"
          isDisabled={!state.changed}
          onPress={state.reset}
          className="-mr-[4px] flex h-[32px] min-w-0 shrink-0 items-center gap-[4px] rounded-full px-[10px] text-[13px] font-medium text-zinc-600 hover:bg-zinc-900/5 max-sm:text-[12px] dark:text-[#b4b5bf]"
        >
          <RotateLeftIcon className="m-0 size-[16px] shrink-0 max-sm:size-[14px]" />
          초기화
        </Button>
        <button
          type="button"
          onClick={close}
          aria-label="인구 분포 닫기"
          className="-mr-[6px] flex size-[32px] shrink-0 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-900/5 dark:text-[#b4b5bf]"
        >
          <XIcon className="size-[20px]" />
        </button>
      </div>
      {/* 인구 분포 켜기·끄기 — 지도 왼쪽 위 카드의 스위치와 같다(조건을 고르면 저절로 켜진다). */}
      <div className="shrink-0 px-[20px] pb-[12px] max-sm:px-[16px]">
        <Switch
          size="sm"
          isSelected={state.on}
          onChange={state.toggle}
          aria-label="지도에 인구 분포 보기"
          className="w-full rounded-[14px] bg-surface px-[14px] py-[11px] dark:bg-white/[0.05] [--switch-control-bg-checked:var(--color-primary)] [--switch-control-bg-checked-hover:var(--color-primary-600)]"
        >
          <Switch.Content className="w-full justify-between gap-[8px] text-[14px] font-bold text-zinc-900 max-sm:text-[13px]">
            <span>
              지도에 인구 분포 보기
              <span className="ml-[4px] text-[12px] font-medium text-zinc-500">
                (서울)
              </span>
            </span>
            <Switch.Control>
              <Switch.Thumb className="bg-surface!" />
            </Switch.Control>
          </Switch.Content>
        </Switch>
      </div>
      {isDesktop ? (
        scroll
      ) : (
        // 모바일 Drawer는 본문(Drawer.Body) 밖을 끌면 시트째 끌려 내려간다 — 스크롤 칸을 본문에 넣어 안쪽만 움직이게.
        <>
          <Drawer.Body className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden p-0 text-inherit">
            {scroll}
          </Drawer.Body>
          {/* 모바일은 시트가 화면을 다 덮어 닫을 곳이 X뿐이라, 엄지가 닿는 아래에 완료를 고정한다(PC는 지도와 함께 보므로 없다). */}
          <div className="shrink-0 border-t border-zinc-900/5 px-[16px] pt-[10px] pb-[calc(10px+env(safe-area-inset-bottom))] dark:border-white/10">
            <Button
              variant="ghost"
              onPress={close}
              className="flex h-[46px] w-full items-center justify-center rounded-[16px] bg-primary text-[15px] font-bold text-white hover:bg-primary-600 data-[pressed=true]:bg-primary-600"
            >
              완료
            </Button>
          </div>
        </>
      )}
    </>
  );

  // 바탕은 옅은 회색 — 고른 칩(흰 바탕)이 구분되게(모바일 인구 분포 시트와 같다).
  // data-tour — 매체 찾기 가이드가 밝히는 자리(인구 분포 조건).
  if (isDesktop)
    return (
      <div
        data-tour="pop-panel"
        // 높이는 내용만큼(바깥 창이 화면 아래까지로 막는다) — 넘치면 안쪽 칸이 스크롤.
        className="flex max-h-full min-h-0 flex-col overflow-hidden rounded-[20px] border border-gray-200 bg-[#f3f3f6] dark:border-white/10 dark:bg-[#24252b]"
      >
        {body}
      </div>
    );
  // 모바일 — 화면 끝까지 올라오는 Drawer(인구 분포 시트와 같은 바탕·손잡이).
  return (
    <Drawer
      isOpen={state.targetOpen}
      onOpenChange={(open) => state.setTargetOpen(open)}
    >
      <Drawer.Backdrop>
        <Drawer.Content placement="bottom">
          <Drawer.Dialog
            aria-label="인구 분포"
            className="flex h-dvh max-h-dvh w-full flex-col gap-0 rounded-t-[24px] bg-[#f3f3f6] p-0 pt-[calc(10px+env(safe-area-inset-top))] dark:bg-[#24252b]"
          >
            <Drawer.Handle />
            {body}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

/**
 * 지도 왼쪽 위 — 인구 분포를 켰을 때만, 고른 조건(예: 자료 생활인구 · 기간 2025년 전체 · 성별·연령 20대). 누르면 유동인구 창이 열린다.
 * 오른쪽 위 실시간 정보 버튼과 겹치지 않게 폭을 줄이고(--map-right-top-w), 넘치면 항목 단위로 줄을 바꾼다.
 * 높이는 MapArea가 재서 실시간 인구 장소 카드를 그 밑에 붙인다(cardRef).
 * 켜기·끄기는 유동인구 창 맨 위 스위치에서.
 */
export function PopGridMapCard({
  state,
  cardRef,
}: {
  state: PopGridState;
  cardRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={cardRef}
      type="button"
      // 창이 열려 있으면 한 번 더 눌러 닫는다.
      onClick={() => state.setTargetOpen(!state.targetOpen)}
      aria-label={
        state.targetOpen ? "인구 분포 조건 닫기" : "인구 분포 조건 열기"
      }
      aria-expanded={state.targetOpen}
      // 유동인구 창이 바깥 누름으로 닫힐 때 이 버튼은 빼 둔다(눌러서 닫은 뒤 다시 열리지 않게).
      data-filter-toggle
      // data-tour — 매체 찾기 가이드가 밝히는 자리(모바일 인구 분포).
      data-tour="pop-mobile"
      className="absolute top-[12px] left-[12px] z-[2] flex min-h-[30px] max-w-[calc(100%-24px-var(--map-right-top-w,0px))] items-center gap-[4px] rounded-[15px] border-[0.5px] border-white/50 bg-surface/75 py-[6px] pr-[8px] pl-[12px] text-left shadow-[0px_4px_16px_rgba(0,0,0,0.14)] backdrop-blur-[10px] backdrop-saturate-[1.8] transition-colors hover:bg-surface/90"
    >
      {/* 항목 이름은 옅게, 값은 진하게 — 예: 자료 생활인구 · 기간 2025년 전체 · 성별·연령 20대 */}
      {/* 모바일은 폭이 좁아 항목 단위로 줄을 바꾸므로 사이 점(·)을 빼고 간격만 둔다(줄 앞에 점이 오지 않게). */}
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-[5px] text-[12px] leading-[17px] text-zinc-900 max-sm:gap-x-[8px]">
        {state.summaryParts.map((p, i) => (
          <span
            key={p.label}
            className="flex items-baseline gap-[5px] whitespace-nowrap"
          >
            {i > 0 && <span className="text-zinc-400 max-sm:hidden">·</span>}
            <span className="font-medium text-zinc-500 dark:text-[#a9aab4]">
              {p.label}
            </span>
            <span className="-ml-[2px] font-bold">{p.value}</span>
          </span>
        ))}
      </span>
      <ChevronDownIcon className="size-[12px] shrink-0 -rotate-90 text-zinc-600 dark:text-[#b4b5bf]" />
    </button>
  );
}

/**
 * 모바일 유동인구 시트 — 아래에서 올라오는 Drawer(손잡이를 끌어내리거나 바깥을 눌러 닫는다).
 * PC 유동인구 카드와 같은 내용: 지금 조건·색 띠·누른 칸 정보. 조건은 "유동인구"으로 위쪽 줄 창을 열어 바꾼다.
 */
export function PopGridSheet({ state }: { state: PopGridState }) {
  const { data: cells } = usePopGridCells(true);
  const { data: grid, isFetching } = usePopGridValues(state.query);
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
              extras={state.extras}
            />
            {/* 본문(Drawer.Body) 안이어야 내용을 밀 때 시트째 끌려 내려가지 않는다. */}
            <Drawer.Body className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden p-0 text-inherit">
              <ScrollShadow
                size={32}
                className="flex min-h-0 flex-1 flex-col overscroll-contain pb-[calc(20px+env(safe-area-inset-bottom))]"
              >
                {sel != null && cells && (
                  <div>
                    <PopCellSection
                      cell={cells[sel]}
                      value={value}
                      metric={state.metric}
                      query={{
                        metric: state.metric,
                        band: state.band,
                        sex: state.segOk ? state.sex : "all",
                        ages: state.segOk ? state.ages : [],
                      }}
                      activeMonths={state.activeMonths}
                      extras={state.overlay ? state.overlayLayers : null}
                      onClose={() => state.setSelected(null)}
                    />
                  </div>
                )}
                <div className="border-t border-zinc-900/5 px-[16px] pt-[14px] dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      state.setSheetOpen(false);
                      state.setTargetOpen(true);
                    }}
                    className="flex h-[40px] w-full items-center justify-center gap-[6px] rounded-[17px] bg-surface text-[13px] font-semibold text-zinc-900"
                  >
                    <PopulationGridIcon className="size-[17px]" />
                    인구 분포 조건 바꾸기
                  </button>
                </div>
              </ScrollShadow>
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

/**
 * 가이드 "칸별 인구" 단계 — 고른 격자 칸 자리를 가이드 어둠 위에서 따로 밝힌다. 가이드 밝힘은 한 자리(칸 정보 카드)만
 * 감싸서, 칸 자리엔 가이드 판(z-70) 위에 작은 창을 띄우고 뒤를 2배 밝게(backdrop brightness) 해 어둠을 걷어낸다.
 */
function GuideCellSpot({
  mapRef,
  mapEl,
  corners,
}: {
  mapRef: RefObject<KakaoMap | null>;
  mapEl: RefObject<HTMLElement | null>;
  corners: number[];
}) {
  const [box, setBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const map = mapRef.current;
      const el = mapEl.current;
      const maps = window.kakao?.maps;
      if (map && el && maps) {
        const proj = map.getProjection();
        const r = el.getBoundingClientRect();
        const pts = [0, 1, 2, 3].map((j) =>
          proj.containerPointFromCoords(
            new maps.LatLng(corners[j * 2], corners[j * 2 + 1]),
          ),
        );
        const xs = pts.map((p) => p.x);
        const ys = pts.map((p) => p.y);
        const next = {
          left: Math.round(r.left + Math.min(...xs)),
          top: Math.round(r.top + Math.min(...ys)),
          width: Math.round(Math.max(...xs) - Math.min(...xs)),
          height: Math.round(Math.max(...ys) - Math.min(...ys)),
        };
        setBox((prev) =>
          prev &&
          prev.left === next.left &&
          prev.top === next.top &&
          prev.width === next.width &&
          prev.height === next.height
            ? prev
            : next,
        );
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [mapRef, mapEl, corners]);
  if (!box) return null;
  return createPortal(
    // PC — 가이드 밝힘(칸 정보 카드) 밖이라 직접 어둠을 걷는다. 모바일 — 이 상자가 곧 가이드 대상(data-tour)이라 밝기는 가이드가.
    <div
      aria-hidden
      data-tour="pop-cell-map"
      className="pointer-events-none fixed z-[71] rounded-[4px] sm:ring-2 sm:ring-white/70 sm:backdrop-brightness-200"
      style={{
        left: box.left - 6,
        top: box.top - 6,
        width: box.width + 12,
        height: box.height + 12,
      }}
    />,
    document.body,
  );
}

/** 가이드 "칸별 인구" 단계에서만 — 예시로 고른 칸 자리를 밝힌다(MapArea). */
export function PopGridGuideSpot({
  mapRef,
  mapEl,
  state,
}: {
  mapRef: RefObject<KakaoMap | null>;
  mapEl: RefObject<HTMLElement | null>;
  state: PopGridState;
}) {
  const { data: cells } = usePopGridCells(state.demo);
  const sel = state.selected;
  if (!state.demo || sel == null || !cells) return null;
  return (
    <GuideCellSpot mapRef={mapRef} mapEl={mapEl} corners={cells[sel][3]} />
  );
}

/**
 * 매체 찾기 지도 "유동인구" 층 — 격자 칠하기와 누른 칸 정보(PC는 지도 오른쪽 아래 카드, 모바일은 누른 자리 팝오버).
 * 조건은 위쪽 줄 유동인구 창, 범례는 지도 왼쪽 위 카드(PopGridMapCard)에 있다.
 */
export function PopGridLayer({
  mapRef,
  mapReady,
  state,
  realtime = null,
  soft = false,
  placeAt,
  onPickPlace,
}: {
  mapRef: RefObject<KakaoMap | null>;
  mapReady: boolean;
  state: PopGridState;
  /** 도로 현황·실시간 인구 — 격자 위에 다시 그린다 */
  realtime?: PopRealtime | null;
  /** 실시간 인구를 함께 켬 — 격자를 연하게 */
  soft?: boolean;
  /** 모바일 — 누른 자리의 실시간 인구 장소(인구 분포와 함께 켰을 때만). 칸과 겹치면 둘 중 고르게 한다. */
  placeAt?: (lat: number, lng: number) => CrowdPlace | null;
  /** 실시간 인구 장소를 골랐을 때 — 장소 시트를 연다 */
  onPickPlace?: (place: CrowdPlace) => void;
}) {
  const isDesktop = useIsDesktop();
  const { data: cells } = usePopGridCells(true);
  const { data: grid } = usePopGridValues(state.query);
  // 칸 숫자 — 종합·생활·체류인구는 합친 점수라 같은 조건의 생활인구 수를 따로 받아 적는다.
  const scored =
    state.query?.metric === "flow" || state.query?.metric === "people";
  const { data: countGrid } = usePopGridValues(
    scored && state.query ? { ...state.query, metric: "live" } : null,
  );
  // 거주인구(세대수)는 동마다 값이 같아 동 가운데 칸 하나에만 숫자를 적는다.
  const overlay = useOverlay(state, cells);
  const labels = useMemo(() => {
    if (scored) return countGrid?.values;
    if (!grid?.labelCells) {
      // 함께 고른 자료 가운데 사람 수(생활인구·지하철)는 칸 숫자에 더한다 — 보행(상대값)·거주인구(세대수)는 색으로만.
      const add = PEOPLE_METRICS.has(state.metric)
        ? (overlay?.layers ?? []).filter((l) =>
            PEOPLE_METRICS.has(l.metric as PopMetric),
          )
        : [];
      if (!add.length || !grid) return grid?.values;
      return grid.values.map((v, i) => {
        const parts = [v, ...add.map((l) => l.values[i])].filter(
          (x): x is number => x != null,
        );
        return parts.length ? parts.reduce((a, b) => a + b, 0) : null;
      });
    }
    const out: (number | null)[] = grid.values.map(() => null);
    grid.labelCells.forEach((i) => (out[i] = grid.values[i]));
    return out;
  }, [scored, countGrid, grid, overlay, state.metric]);
  // 동 단위 자료(거주인구) — 동 경계선·동 이름·누른 동 강조. 동 이름은 숫자를 적는 가운데 칸에만.
  const labelCells = grid?.labelCells;
  const groups = useMemo(
    () => (cells && labelCells ? dongGroups(cells, labelCells) : null),
    [cells, labelCells],
  );
  // 모바일 — 칸을 눌러 팝오버를 띄웠는지(자리는 지도 아래쪽 고정). 지도를 움직이면 닫는다.
  // place 가 있으면 누른 자리에 실시간 인구 장소도 겹쳐 있어 먼저 둘 중 볼 것을 고르게 한다(인구 분포를 고르면 바로 시트).
  const [tap, setTap] = useState<{
    x: number;
    y: number;
    place: CrowdPlace | null;
  } | null>(null);

  useMapPopGrid({
    mapRef,
    mapReady,
    cells: cells ?? null,
    values: grid?.values ?? null,
    breaks: grid?.breaks ?? [],
    labels: labels ?? null,
    groups,
    overlay,
    selected: state.selected,
    realtime,
    soft,
    // 마우스를 올린 칸은 지도에 테두리만 — 툴팁은 띄우지 않는다(칸 숫자·누른 칸 카드로 충분).
    onHover: () => {},
    onSelect: (i, point) => {
      const place =
        !isDesktop && point ? (placeAt?.(point.lat, point.lng) ?? null) : null;
      // 격자 밖 장소 범위 — 고를 것 없이 장소 시트.
      if (place && i == null) {
        state.setSelected(null);
        setTap(null);
        onPickPlace?.(place);
        return;
      }
      state.setSelected(i);
      // 모바일은 누른 자리에 칸 정보 팝오버 — "자세히 보기"로 시트를 연다.
      setTap(
        !isDesktop && i != null && point
          ? { x: point.x, y: point.y, place }
          : null,
      );
    },
    onViewChange: () => setTap(null),
  });

  const sel = state.selected;
  if (!isDesktop && tap?.place && sel != null && cells) {
    const place = tap.place;
    const v = grid?.values[sel] ?? null;
    const lv = popLevel(v, grid?.breaks ?? []);
    const close = () => {
      setTap(null);
      state.setSelected(null);
    };
    return (
      <div
        role="dialog"
        aria-label="볼 정보 고르기"
        className="absolute inset-x-[12px] bottom-[76px] z-[3] flex flex-col overflow-hidden rounded-[18px] border-[0.5px] border-white/50 bg-surface/85 shadow-[0px_8px_24px_0px_rgba(0,0,0,0.18)] backdrop-blur-[14px] backdrop-saturate-[1.8]"
      >
        <div className="flex items-center justify-between px-[14px] pt-[8px] pb-[2px]">
          <span className="text-[12px] leading-[16px] text-zinc-500 dark:text-[#a4a5af]">
            어떤 정보를 볼까요?
          </span>
          <button
            type="button"
            onClick={close}
            aria-label="닫기"
            className="-mr-[4px] flex size-[24px] shrink-0 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-900/5 dark:text-[#b4b5bf]"
          >
            <XIcon className="size-[16px]" />
          </button>
        </div>
        <TapChoice
          color={crowdColor(place.level)}
          kind="실시간 인구"
          title={place.name}
          detail={place.level}
          onClick={() => {
            close();
            onPickPlace?.(place);
          }}
        />
        <TapChoice
          color={lv < 0 ? undefined : POP_LEVELS[lv].color}
          kind="인구 분포"
          title={`${cells[sel][1]} ${cells[sel][2]}`}
          detail={tapValueText(state.metric, v)}
          onClick={() => {
            setTap(null);
            state.setSheetOpen(true);
          }}
        />
      </div>
    );
  }
  // 가이드 예시(state.demo)는 모바일에선 팝오버를 띄우지 않고 칸 자리만 밝힌다(PopGridGuideSpot).
  if (!isDesktop && tap && !state.demo && sel != null && cells) {
    // 모바일 — PC 마우스 이름표와 같은 작은 검은 카드를 누른 자리에, "자세히 보기"로 시트를 연다.
    // 지도를 움직이면 닫힌다(onViewChange). 화면 오른쪽·아래로 넘치지 않게 누른 자리 왼쪽·위로도 붙인다.
    const v = grid?.values[sel] ?? null;
    const flipX = tap.x > 180;
    const flipY = tap.y > 260;
    return (
      <div
        data-tour="pop-cell"
        role="dialog"
        aria-label={`${cells[sel][1]} ${cells[sel][2]} 인구 분포`}
        className="absolute z-[3] flex flex-col gap-[1px] rounded-[10px] bg-scrim/80 px-[10px] pt-[6px] pb-[4px] text-white shadow-[0px_3px_10px_rgba(0,0,0,0.2)] backdrop-blur-[6px]"
        style={{
          left: flipX ? undefined : tap.x + 10,
          right: flipX ? `calc(100% - ${tap.x - 10}px)` : undefined,
          top: flipY ? undefined : tap.y + 10,
          bottom: flipY ? `calc(100% - ${tap.y - 10}px)` : undefined,
        }}
      >
        <span className="text-[12px] leading-[16px] font-bold whitespace-nowrap">
          {cells[sel][1]} {cells[sel][2]}
        </span>
        {tapValueText(state.metric, v) && (
          <span className="text-[11px] leading-[15px] whitespace-nowrap tabular-nums">
            {tapValueText(state.metric, v)}
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            setTap(null);
            state.setSheetOpen(true);
          }}
          className="-mx-[4px] mt-[2px] flex h-[26px] items-center justify-center gap-[3px] rounded-[7px] bg-white/15 px-[8px] text-[11px] font-semibold text-white active:bg-white/25"
        >
          자세히 보기
          <ChevronDownIcon className="size-[10px] -rotate-90" />
        </button>
      </div>
    );
  }
  if (isDesktop && sel != null && cells) {
    // PC — 누른 칸 정보를 지도에 띄운다(칸을 누를 때만, X로 닫는다). 왼쪽 아래 — 오른쪽은 인구 분포 창이 열리면 가려서. 카카오 로고·축척은 가리지 않게 그 위로 띄운다.
    // data-tour — 매체 찾기 가이드가 밝히는 자리(칸 정보).
    const v = grid?.values[sel] ?? null;
    return (
      <div
        data-tour="pop-cell"
        className="absolute bottom-[36px] left-[12px] z-[3] flex max-h-[calc(100%-48px)] w-[360px] flex-col overflow-hidden rounded-[20px] border-[0.5px] border-white/50 bg-surface/85 shadow-[0px_8px_24px_0px_rgba(0,0,0,0.14)] backdrop-blur-[14px] backdrop-saturate-[1.8]"
      >
        <ScrollShadow size={24} className="min-h-0 flex-1">
          <PopCellSection
            cell={cells[sel]}
            value={v}
            metric={state.metric}
            query={{
              metric: state.metric,
              band: state.band,
              sex: state.segOk ? state.sex : "all",
              ages: state.segOk ? state.ages : [],
            }}
            activeMonths={state.activeMonths}
            extras={state.overlay ? state.overlayLayers : null}
            onClose={() => state.setSelected(null)}
          />
        </ScrollShadow>
      </div>
    );
  }
  return null;
}

/** 모바일 — 장소 범위와 격자 칸이 겹친 자리를 눌렀을 때 고르는 줄 하나. */
function TapChoice({
  color,
  kind,
  title,
  detail,
  onClick,
}: {
  color?: string;
  kind: string;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-[10px] border-t border-zinc-900/5 px-[14px] py-[10px] text-left first-of-type:border-t-0 active:bg-zinc-900/5 dark:border-white/10"
    >
      <span
        aria-hidden
        className="size-[10px] shrink-0 rounded-full bg-zinc-300"
        style={color ? { backgroundColor: color } : undefined}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-[1px]">
        <span className="truncate text-[14px] leading-[20px] font-bold text-zinc-900">
          {title}
        </span>
        <span className="truncate text-[12px] leading-[16px] text-zinc-700 dark:text-[#c9cad3]">
          {detail ? `${kind} · ${detail}` : kind}
        </span>
      </span>
      <ChevronDownIcon className="size-[12px] shrink-0 -rotate-90 text-zinc-500" />
    </button>
  );
}

/** 색 띠 — 단계마다 색 칸과 "서울 상위 몇 %"(오른쪽으로 갈수록 많은 곳). 칸에 마우스를 올리면 경계 값. */
function PopLegend({
  breaks,
  metric,
  missingMonths,
  extras,
}: {
  breaks: number[];
  metric: PopMetric;
  missingMonths: string[];
  /** 함께 고른 자료 */
  extras: PopMetric[];
}) {
  // 합친 점수(유동인구·생활·체류인구)는 경계 값을 보이지 않는다.
  const unit =
    metric === "flow" || metric === "people"
      ? null
      : metric === "walk"
        ? ""
        : metric === "live"
          ? "명"
          : metric === "household"
            ? "세대"
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
      <PopSource metric={metric} extras={extras} />
    </div>
  );
}

/** 누른 칸 정보에 함께 보일 자료 — 그 자료 지도를 받은 조건(달·시간대). */
interface ExtraInfo {
  metric: PopMetric;
  query: { months: string[]; band: PopBand };
}

// 월별 막대 색 — 자료마다 다른 색으로 갈라 보인다.
const BAR_STYLE: Record<PopMetric, { color: string; tint: string }> = {
  flow: { color: "#f0822f", tint: "bg-[#fff4ea] dark:bg-[#3a2a1c]" },
  people: { color: "#f0822f", tint: "bg-[#fff4ea] dark:bg-[#3a2a1c]" },
  live: { color: "#f0822f", tint: "bg-[#fff4ea] dark:bg-[#3a2a1c]" },
  household: { color: "#5b74d6", tint: "bg-[#eef1fc] dark:bg-[#232a40]" },
  subway: { color: "#2a9d6e", tint: "bg-[#eaf6f0] dark:bg-[#1c3329]" },
  walk: { color: "#9a5bd0", tint: "bg-[#f4edfb] dark:bg-[#2f2440]" },
};
const BAR_UNIT: Record<PopMetric, string> = {
  flow: "월별 인구(명)",
  people: "월별 인구(명)",
  live: "월별 인구(명)",
  household: "월별 주민등록 세대수",
  subway: "월별 승하차(시간당 명)",
  walk: "월별 보행",
};
const metricLabel = (k: PopMetric) =>
  METRICS.find((m) => m.key === k)?.label ?? "생활인구";
const inYear = (picked: string[]) => (m: { ym: string }) =>
  picked.some((a) => a.slice(0, 4) === m.ym.slice(0, 4));

/**
 * 누른 칸 정보 — 칸(동) 이름, 고른 자료의 월별 막대·출처.
 * 여러 자료를 함께 고르면 자료마다 이름·색을 달리한 칸을 위아래로 보인다.
 */
function PopCellSection({
  cell,
  value,
  metric,
  query,
  activeMonths,
  extras = null,
  onClose,
}: {
  cell: [string, string, string, number[]];
  value: number | null;
  metric: PopMetric;
  query: { metric: PopMetric; band: PopBand; sex: PopSex; ages: PopAge[] };
  activeMonths: string[];
  /** 함께 고른 자료 */
  extras?: ExtraInfo[] | null;
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
  const shown = ((scored ? countTrend : trend)?.months ?? []).filter(
    inYear(activeMonths),
  );
  const multi = !!extras?.length;
  return (
    // PC 카드는 위·아래·양옆 여백을 16px로 같게. 모바일 시트는 그대로.
    <div className="flex flex-col gap-[8px] border-t border-zinc-900/5 p-[16px] max-sm:px-[16px] max-sm:pt-[10px] max-sm:pb-[12px]">
      <div className="flex items-start justify-between gap-[8px]">
        <div className="flex min-w-0 flex-col gap-[2px]">
          <span className="truncate text-[14px] leading-[20px] font-bold text-zinc-900">
            {cell[1]} {cell[2]}
          </span>
          {/* 값 줄 — 생활인구는 월별 막대로 충분해 빼고, 거주인구는 세대수만. 서울 순위는 보이지 않는다. */}
          {!multi && metric !== "live" && value != null && (
            <span className="text-[12px] leading-[16px] text-zinc-700 dark:text-[#c9cad3] tabular-nums">
              {metric === "household" && "주민등록 "}
              {valueText(metric, value)}
            </span>
          )}
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
      <MonthBarsCard
        {...BAR_STYLE[countMetric]}
        title={metricLabel(countMetric)}
        unit={BAR_UNIT[countMetric]}
        source={SOURCES[metric]}
        months={shown}
        activeMonths={activeMonths}
        metric={countMetric}
      />
      {extras?.map((x) => (
        <ExtraBars key={x.metric} code={cell[0]} extra={x} />
      ))}
    </div>
  );
}

/** 함께 고른 자료 한 칸 — 그 자료의 칸 추이를 따로 받아 막대로. */
function ExtraBars({ code, extra }: { code: string; extra: ExtraInfo }) {
  const { data } = usePopCellTrend(code, {
    metric: extra.metric,
    band: extra.query.band,
    sex: "all",
    ages: [],
  });
  return (
    <MonthBarsCard
      {...BAR_STYLE[extra.metric]}
      title={metricLabel(extra.metric)}
      unit={BAR_UNIT[extra.metric]}
      source={SOURCES[extra.metric]}
      months={(data?.months ?? []).filter(inYear(extra.query.months))}
      activeMonths={extra.query.months}
      metric={extra.metric}
    />
  );
}

/**
 * 누른 칸 정보의 자료 한 칸 — 자료마다 이름·색을 달리해 갈라 보이고,
 * 월별 값을 0부터 세운 막대로 보인다(달마다 차이가 얼마나 작은지 그대로 보이게).
 */
function MonthBarsCard({
  title,
  unit,
  color,
  tint,
  months,
  activeMonths,
  metric,
  source,
}: {
  title: string;
  unit: string;
  /** 자료 출처 — 막대 밑에 작게 */
  source: string;
  /** 막대 색 */
  color: string;
  /** 칸 바탕(Tailwind 클래스) */
  tint: string;
  months: { ym: string; value: number | null }[];
  activeMonths: string[];
  /** 툴팁 값 단위 */
  metric: PopMetric;
}) {
  const [tip, setTip] = useState<string | null>(null);
  const hi = Math.max(0, ...months.map((m) => m.value ?? 0));
  const best = months.find((m) => m.value != null && m.value === hi) ?? null;
  return (
    <div
      className={cn("flex flex-col gap-[8px] rounded-[12px] p-[10px]", tint)}
    >
      <div className="flex items-center justify-between gap-[8px]">
        <span className="flex min-w-0 items-center gap-[6px]">
          <span
            className="size-[8px] shrink-0 rounded-full"
            style={{ background: color }}
          />
          <b className="text-[13px] leading-[18px] font-bold text-zinc-900">
            {title}
          </b>
          <span className="truncate text-[11px] leading-[14px] text-zinc-500 dark:text-[#a4a5af]">
            {unit}
          </span>
        </span>
        {best && hi > 0 && (
          <span className="shrink-0 text-[11px] leading-[14px] text-zinc-500 dark:text-[#a4a5af]">
            가장 많은 달{" "}
            <b className="font-bold text-zinc-900">{monthLabel(best.ym)}</b>
          </span>
        )}
      </div>
      {months.length === 0 ? (
        <span className="text-[12px] text-zinc-500">자료 없음</span>
      ) : (
        <div
          className="relative flex gap-[3px]"
          onMouseLeave={() => setTip(null)}
        >
          {months.map((m, i) => {
            const on = activeMonths.includes(m.ym);
            const pct = m.value != null && hi > 0 ? (m.value / hi) * 100 : 0;
            const label = `${monthLabel(m.ym)} · ${valueText(metric, m.value)}`;
            return (
              <button
                type="button"
                key={m.ym}
                aria-label={label}
                onMouseEnter={() => setTip(m.ym)}
                onFocus={() => setTip(m.ym)}
                onBlur={() => setTip(null)}
                onClick={() => setTip(tip === m.ym ? null : m.ym)}
                className="relative flex flex-1 flex-col items-center gap-[3px] outline-none"
              >
                <span className="flex h-[52px] w-full items-end">
                  <span
                    className={cn(
                      "w-full rounded-t-[3px] transition-opacity",
                      !on && "opacity-35",
                      tip === m.ym && "ring-2 ring-zinc-900/60",
                    )}
                    style={{
                      height: m.value != null ? `max(2px, ${pct}%)` : 0,
                      background: color,
                    }}
                  />
                </span>
                <span
                  className={cn(
                    "text-[10px] leading-[12px] font-semibold text-zinc-600 tabular-nums dark:text-[#b4b5bf]",
                    !on && "opacity-50",
                  )}
                >
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
                        : i > months.length - 3
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
      )}
      <p className="text-[10px] leading-[14px] text-zinc-500 dark:text-[#a4a5af]">
        출처: {source}
      </p>
    </div>
  );
}
