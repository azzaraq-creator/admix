import { useSyncExternalStore } from "react";

import { parseHours, type HoursRow } from "./PartnersHoursField";

/**
 * 매장 운영 시간 글자(business_hours, PartnersHoursField 가 만든 모양) → 요일별 시간 · 지금 영업 상태.
 * 내 매장 화면의 영업 상태 줄("영업 중 · 18:00까지")이 쓴다.
 * 공휴일은 달력이 없어 계산에 넣지 않는다.
 */

const DAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

/** 하루 영업 — 시간 · 정기 휴무 · 정해 두지 않음(null). */
export type DayHours = { open: string; close: string } | "closed" | null;

export type WeeklyHours = {
  /** Date.getDay() → 그날 영업. */
  days: Record<number, DayHours>;
  holidayClosed: boolean;
  /** 이 모양으로 못 읽은 예전 글자 — 표 대신 그대로 보여 준다. */
  legacy: string | null;
};

export function weeklyHours(text: string | null | undefined): WeeklyHours {
  const parsed = parseHours(text);
  const rows = parsed.rows.filter((r) => r.open && r.close);
  const pick = (kind: HoursRow["days"]) => rows.find((r) => r.days === kind);
  const days: Record<number, DayHours> = {};
  for (let d = 0; d < 7; d++) {
    if (parsed.closedDays.includes(DAY_LABEL[d])) {
      days[d] = "closed";
      continue;
    }
    const weekend = d === 0 || d === 6;
    // 평일 · 주말 줄이 매일 줄보다 먼저.
    const row = pick(weekend ? "weekend" : "weekday") ?? pick("daily");
    days[d] = row ? { open: row.open, close: row.close } : null;
  }
  return {
    days,
    holidayClosed: parsed.closedDays.includes("공휴일"),
    legacy: parsed.legacy,
  };
}

/** 시간이 하나라도 정해져 있는지(아니면 영업 상태를 말하지 않는다). */
export const hasAnyHours = (w: WeeklyHours) =>
  Object.values(w.days).some((h) => h && h !== "closed");

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** 시작 = 끝(00:00 ~ 00:00 등)이면 24시간 영업. */
const is24h = (h: { open: string; close: string }) => h.open === h.close;
/** 끝이 시작보다 이르면 자정을 넘긴다(18:00 ~ 02:00). */
const overnight = (h: { open: string; close: string }) =>
  toMin(h.close) < toMin(h.open);

export type OpenState =
  /** 영업 중 — until 이 null 이면 24시간 영업. */
  | { kind: "open"; until: string | null }
  /** 오늘 영업 전. */
  | { kind: "before"; at: string }
  /** 오늘 영업 끝. */
  | { kind: "after"; next: string | null }
  /** 오늘 정기 휴무. */
  | { kind: "dayoff"; next: string | null };

/** 다음 영업 시작 — "내일 10:00" · "월요일 10:00". 일주일 안에 없으면 null. */
function nextOpening(w: WeeklyHours, day: number): string | null {
  for (let k = 1; k <= 7; k++) {
    const d = (day + k) % 7;
    const h = w.days[d];
    if (h && h !== "closed") {
      return `${k === 1 ? "내일" : `${DAY_LABEL[d]}요일`} ${h.open}`;
    }
  }
  return null;
}

/**
 * 지금(한국 시각) 영업 상태. 오늘 시간을 정해 두지 않았으면 null(상태 줄을 숨긴다).
 * @param day Date.getDay() 값  @param min 자정부터 지난 분
 */
export function openStateAt(
  w: WeeklyHours,
  day: number,
  min: number,
): OpenState | null {
  if (w.legacy || !hasAnyHours(w)) return null;
  // 어제 자정을 넘겨 열었으면 아직 영업 중일 수 있다.
  const y = w.days[(day + 6) % 7];
  if (y && y !== "closed" && !is24h(y) && overnight(y) && min < toMin(y.close))
    return { kind: "open", until: y.close };

  const t = w.days[day];
  if (t === "closed") return { kind: "dayoff", next: nextOpening(w, day) };
  if (!t) return null;
  if (is24h(t)) return { kind: "open", until: null };
  const open = toMin(t.open);
  const close = toMin(t.close);
  if (min < open) return { kind: "before", at: t.open };
  if (overnight(t) || min < close) return { kind: "open", until: t.close };
  return { kind: "after", next: nextOpening(w, day) };
}

/** 상태 줄 글자 — [굵은 말, 뒤 설명]. 사장님이 보는 화면이라 사장님께 건네는 말투로. */
export function openStateText(s: OpenState): [string, string | null] {
  switch (s.kind) {
    case "open":
      return ["영업 중", s.until ? `${s.until}까지` : "24시간 영업"];
    case "before":
      return ["영업 준비 중", `${s.at}에 문을 열어요`];
    case "after":
      return ["오늘 영업 끝", "오늘도 수고 많으셨어요"];
    case "dayoff":
      return ["오늘은 쉬는 날", s.next && `${s.next}에 다시 열어요`];
  }
}

// ── 지금 시각(한국) — 1분마다 다시 그린다. 서버에서는 null(상태를 그리지 않는다). ──

const subscribeMinute = (fn: () => void) => {
  const t = window.setInterval(fn, 20_000);
  return () => window.clearInterval(t);
};
const currentMinute = () => Math.floor(Date.now() / 60_000);

/** 지금 한국 시각의 날짜(YYYY-MM-DD) · 요일 · 분. 서버 렌더 · 하이드레이션 중에는 null. */
export function useKstNow(): { date: string; day: number; min: number } | null {
  const minute = useSyncExternalStore<number | null>(
    subscribeMinute,
    currentMinute,
    () => null,
  );
  if (minute === null) return null;
  const d = new Date(minute * 60_000 + 9 * 3_600_000);
  return {
    date: d.toISOString().slice(0, 10),
    day: d.getUTCDay(),
    min: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}
