"use client";

import {
  Autocomplete,
  Button,
  CloseButton,
  EmptyState,
  I18nProvider,
  ListBox,
  SearchField,
  Select,
  Tag,
  TagGroup,
  TimeField,
  useFilter,
} from "@heroui/react";
import { parseTime, type Time } from "@internationalized/date";

/**
 * 매장 운영 시간 · 휴무일 입력.
 * 서버에는 지금처럼 글자 한 줄(business_hours)로 저장한다 — 이 화면에서 만든 모양만 다시 읽어 들인다.
 *   예) "평일 09:00 ~ 21:00 / 주말 10:00 ~ 20:00 · 휴무 월·공휴일"
 */

export const HOURS_DAYS = [
  { id: "daily", label: "매일" },
  { id: "weekday", label: "평일" },
  { id: "weekend", label: "주말" },
] as const;
export type HoursDays = (typeof HOURS_DAYS)[number]["id"];

export const CLOSED_DAY_OPTIONS = [
  "월",
  "화",
  "수",
  "목",
  "금",
  "토",
  "일",
  "공휴일",
] as const;

/** 운영 시간 한 줄 — 시간은 "HH:MM"(아직 안 정했으면 ""). */
export type HoursRow = { days: HoursDays; open: string; close: string };

export type PartnersHours = {
  rows: HoursRow[];
  closedDays: string[];
  /** 이 화면 모양이 아닌 예전 글자(직접 적은 운영 시간) — 손대지 않으면 그대로 다시 저장한다. */
  legacy: string | null;
};

const EMPTY_ROW: HoursRow = { days: "daily", open: "", close: "" };
const MAX_ROWS = HOURS_DAYS.length;

const labelOf = (days: HoursDays) =>
  HOURS_DAYS.find((d) => d.id === days)?.label ?? "";

/** 저장된 글자 → 입력 모양. 못 읽으면 빈 칸 한 줄 + 예전 글자를 legacy 로 들고 있는다. */
export function parseHours(text: string | null | undefined): PartnersHours {
  const raw = (text ?? "").trim();
  if (!raw) return { rows: [EMPTY_ROW], closedDays: [], legacy: null };
  const [timesPart, closedPart] = raw.split(/(?:^|\s*·\s*)휴무\s+/);
  const rows: HoursRow[] = [];
  for (const piece of (timesPart ?? "").split(/\s*\/\s*/)) {
    const m = piece.match(
      /^(매일|평일|주말)\s+(\d{2}:\d{2})\s*[~-]\s*(\d{2}:\d{2})$/,
    );
    if (!m) {
      if (piece) return { rows: [EMPTY_ROW], closedDays: [], legacy: raw };
      continue;
    }
    const days = HOURS_DAYS.find((d) => d.label === m[1])!.id;
    rows.push({ days, open: m[2], close: m[3] });
  }
  const closedDays = (closedPart ?? "")
    .split("·")
    .map((d) => d.trim())
    .filter((d) => (CLOSED_DAY_OPTIONS as readonly string[]).includes(d));
  return { rows: rows.length ? rows : [EMPTY_ROW], closedDays, legacy: null };
}

/** 입력 모양 → 저장할 글자. 시작·끝을 다 고른 줄만 쓴다. 아무것도 없으면 null. */
export function formatHours(hours: PartnersHours): string | null {
  const times = hours.rows
    .filter((r) => r.open && r.close)
    .map((r) => `${labelOf(r.days)} ${r.open} ~ ${r.close}`)
    .join(" / ");
  const closed = CLOSED_DAY_OPTIONS.filter((d) =>
    hours.closedDays.includes(d),
  ).join("·");
  const text = [times, closed && `휴무 ${closed}`].filter(Boolean).join(" · ");
  return text || hours.legacy || null;
}

const toTime = (v: string): Time | null => {
  try {
    return v ? parseTime(v) : null;
  } catch {
    return null;
  }
};
const fromTime = (t: Time | null) =>
  t
    ? `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`
    : "";

/** 운영 시간 줄들 — 요일(매일·평일·주말) Select + 시작·끝 TimeField, 줄 추가·빼기. */
export function PartnersHoursRows({
  hours,
  onChange,
}: {
  hours: PartnersHours;
  onChange: (next: PartnersHours) => void;
}) {
  const { rows } = hours;
  const setRow = (i: number, patch: Partial<HoursRow>) =>
    onChange({
      ...hours,
      legacy: null,
      rows: rows.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    });
  const addRow = () => {
    const used = new Set(rows.map((r) => r.days));
    // 매일 다음엔 평일 · 주말로 나누는 경우가 많다 — 아직 안 쓴 것 중 평일 → 주말 → 매일 순.
    const days =
      (["weekday", "weekend", "daily"] as const).find((d) => !used.has(d)) ??
      "daily";
    onChange({
      ...hours,
      legacy: null,
      rows: [...rows, { days, open: "", close: "" }],
    });
  };
  const removeRow = (i: number) =>
    onChange({ ...hours, legacy: null, rows: rows.filter((_, j) => j !== i) });

  return (
    <div className="flex flex-col gap-[8px]">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-[4px] sm:gap-[8px]">
          <Select
            aria-label="운영 요일"
            selectedKey={row.days}
            onSelectionChange={(key) => {
              if (key) setRow(i, { days: key as HoursDays });
            }}
            // 다른 줄에서 고른 요일은 겹치지 않게 막는다.
            disabledKeys={rows.filter((_, j) => j !== i).map((r) => r.days)}
            className="w-[92px] shrink-0 max-sm:w-[68px]"
          >
            <Select.Trigger className="h-[44px] items-center rounded-[19px]">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {HOURS_DAYS.map((d) => (
                  <ListBox.Item key={d.id} id={d.id} textValue={d.label}>
                    {d.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          <HourInput
            label={`${labelOf(row.days)} 여는 시간`}
            value={row.open}
            onChange={(open) => setRow(i, { open })}
          />
          <span aria-hidden className="shrink-0 text-gray-400">
            ~
          </span>
          <HourInput
            label={`${labelOf(row.days)} 닫는 시간`}
            value={row.close}
            onChange={(close) => setRow(i, { close })}
          />
          {rows.length > 1 && (
            <CloseButton
              aria-label="이 운영 시간 빼기"
              onPress={() => removeRow(i)}
              className="size-[28px] min-w-0 shrink-0 rounded-full bg-transparent text-gray-400 data-[hovered=true]:bg-gray-100 data-[hovered=true]:text-gray-700 [&_svg]:size-[14px]"
            />
          )}
        </div>
      ))}
      {rows.length < MAX_ROWS && (
        <Button
          variant="ghost"
          size="sm"
          onPress={addRow}
          className="h-auto min-w-0 self-start px-[4px] py-[2px] text-[13px] font-semibold text-gray-600 underline-offset-2 data-[hovered=true]:bg-transparent data-[hovered=true]:text-gray-900 data-[hovered=true]:underline"
        >
          + 운영 시간 추가
        </Button>
      )}
    </div>
  );
}

function HourInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    // 오전 · 오후를 고르는 12시간제 — 브라우저 언어와 상관없이 늘 "오전/오후"로 보이게 한국어로 고정한다.
    <I18nProvider locale="ko-KR">
      <TimeField
        aria-label={label}
        hourCycle={12}
        value={toTime(value)}
        onChange={(t) => onChange(fromTime(t))}
        className="min-w-0 flex-1"
      >
        <TimeField.Group fullWidth className="h-[44px] rounded-[19px]">
          <TimeField.Input>
            {(segment) => <TimeField.Segment segment={segment} />}
          </TimeField.Input>
        </TimeField.Group>
      </TimeField>
    </I18nProvider>
  );
}

/** 휴무일 — 여러 요일을 고르는 Autocomplete(HeroUI 문서의 여러 개 고르기 예제 구조 그대로, 고른 요일은 칸 안에 태그로). */
export function PartnersClosedDays({
  hours,
  onChange,
}: {
  hours: PartnersHours;
  onChange: (next: PartnersHours) => void;
}) {
  const { contains } = useFilter({ sensitivity: "base" });
  const setDays = (days: string[]) =>
    onChange({
      ...hours,
      legacy: null,
      // 고른 순서가 아니라 월 → 일 → 공휴일 순으로 맞춘다.
      closedDays: CLOSED_DAY_OPTIONS.filter((d) => days.includes(d)),
    });

  return (
    <Autocomplete
      aria-label="휴무일"
      selectionMode="multiple"
      placeholder="휴무 요일을 골라 주세요"
      value={hours.closedDays}
      onChange={(keys) => setDays((keys as string[]) ?? [])}
      onClear={() => setDays([])}
      fullWidth
    >
      <Autocomplete.Trigger className="min-h-[44px] items-center rounded-[19px]">
        <Autocomplete.Value>
          {({ defaultChildren, isPlaceholder }) =>
            isPlaceholder || hours.closedDays.length === 0 ? (
              defaultChildren
            ) : (
              <TagGroup
                aria-label="고른 휴무일"
                size="sm"
                onRemove={(keys) =>
                  setDays(hours.closedDays.filter((d) => !keys.has(d)))
                }
              >
                <TagGroup.List>
                  {hours.closedDays.map((d) => (
                    <Tag key={d} id={d}>
                      {d}
                    </Tag>
                  ))}
                </TagGroup.List>
              </TagGroup>
            )
          }
        </Autocomplete.Value>
        <Autocomplete.ClearButton />
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter filter={contains}>
          <SearchField autoFocus aria-label="요일 찾기" variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="요일 찾기" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListBox
            renderEmptyState={() => <EmptyState>맞는 요일이 없어요</EmptyState>}
          >
            {CLOSED_DAY_OPTIONS.map((d) => (
              <ListBox.Item key={d} id={d} textValue={d}>
                {d}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}
