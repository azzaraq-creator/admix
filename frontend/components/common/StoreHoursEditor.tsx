"use client";

import {
  Autocomplete,
  Button,
  ListBox,
  SearchField,
  Select,
  TimeField,
  useFilter,
} from "@heroui/react";
import { parseTime, type Time } from "@internationalized/date";
import { Plus, Trash2 } from "lucide-react";

import {
  CLOSED_DAYS,
  HOURS_DAYS,
  MAX_HOURS_SLOTS,
  type HoursDays,
  type StoreHours,
} from "@/lib/partners";
import { cn } from "@/lib/utils";

/*
 * 콜라보 매장 운영 시간 입력 — 요일 구분(매일 · 평일 · 주말(공휴일)) + 여는 · 닫는 시간(2줄까지) + 휴무일.
 * 화면 글(businessHours)은 서버가 만든다(partners_service.hours_text).
 * 제휴사 내 매장 "수정 요청" 창이 쓴다. 어드민 매장 폼(PartnersStoreFormView)에도 같은 규칙의 편집기가 따로 있다.
 */

type FieldVariant = "primary" | "secondary";

export const EMPTY_HOURS: StoreHours = {
  slots: [{ days: "daily", open: "", close: "" }],
  closed: [],
};

/**
 * 예전에 글로 적은 운영 시간 읽기 — "매일 10:00 ~ 22:00 (월요일 휴무)", "평일 … · 주말(공휴일) …" 같은 꼴만.
 * 다 읽히면 입력값으로, 하나라도 못 읽으면 null.
 */
export function parseHoursText(text: string | null): StoreHours | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  const m = t.match(/^(.*?)\s*(?:\(([^()]*)\s*휴무\)|([^()]*?)\s*휴무)?$/);
  if (!m) return null;
  const slotText = (m[1] ?? "").trim();
  const closedText = (m[2] ?? m[3] ?? "").trim();
  const dayOf: Record<string, HoursDays> = {
    매일: "daily",
    평일: "weekday",
    주말: "weekend",
    "주말(공휴일)": "weekend",
  };
  const slots: StoreHours["slots"] = [];
  for (const part of slotText ? slotText.split(/\s*[·,/]\s*/) : []) {
    const p = part.match(
      /^(매일|평일|주말\(공휴일\)|주말)\s*(\d{1,2}):(\d{2})\s*[~-]\s*(\d{1,2}):(\d{2})$/,
    );
    if (!p) return null;
    const hhmm = (h: string, mm: string) =>
      Number(h) <= 23 && Number(mm) <= 59 ? `${h.padStart(2, "0")}:${mm}` : "";
    const open = hhmm(p[2], p[3]);
    const close = hhmm(p[4], p[5]);
    const days = dayOf[p[1]];
    if (!open || !close || slots.some((x) => x.days === days)) return null;
    slots.push({ days, open, close });
  }
  if (slots.length > MAX_HOURS_SLOTS) return null;
  if (slots.length > 1 && slots.some((x) => x.days === "daily")) return null;
  const closed: string[] = [];
  for (const word of closedText ? closedText.split(/\s*[,·]\s*/) : []) {
    const day = CLOSED_DAYS.find(
      (d) => d.label === word || d.label.slice(0, 1) === word,
    );
    if (!day) return null;
    if (!closed.includes(day.value)) closed.push(day.value);
  }
  if (!slots.length && !closed.length) return null;
  return {
    slots: slots.length ? slots : EMPTY_HOURS.slots,
    closed: CLOSED_DAYS.filter((d) => closed.includes(d.value)).map(
      (d) => d.value,
    ),
  };
}

/**
 * 편집기 처음 값 — 입력값이 있으면 그것, 없으면 예전 글을 읽어 본다.
 * 못 읽으면 빈 칸과 그 글(legacy)을 돌려준다 — 화면에서 "지금 적힌 운영 시간"으로 보여 준다.
 */
export function hoursFromStore(s: {
  hours?: StoreHours | null;
  businessHours: string | null;
}): { hours: StoreHours; legacy: string } {
  if (s.hours)
    return {
      hours: {
        slots: s.hours.slots.length ? s.hours.slots : EMPTY_HOURS.slots,
        closed: s.hours.closed,
      },
      legacy: "",
    };
  const parsed = parseHoursText(s.businessHours);
  return parsed
    ? { hours: parsed, legacy: "" }
    : { hours: EMPTY_HOURS, legacy: s.businessHours ?? "" };
}

/** 보낼 운영 시간 — 시간을 다 넣은 줄만. 아무것도 없으면 null(비움). */
export function hoursPayload(hours: StoreHours): StoreHours | null {
  const slots = hours.slots.filter((s) => s.open && s.close);
  return slots.length || hours.closed.length
    ? { slots, closed: hours.closed }
    : null;
}

/** 시간을 반만 넣은 줄이 있는지 — 보내기 전에 막는다. */
export const hoursIncomplete = (hours: StoreHours) =>
  hours.slots.some((s) => Boolean(s.open) !== Boolean(s.close));

const DAYS_LABEL: Record<HoursDays, string> = Object.fromEntries(
  HOURS_DAYS.map((d) => [d.value, d.label]),
) as Record<HoursDays, string>;

/** "10:00" ↔ TimeField 값(24시간). */
const timeOf = (hhmm: string): Time | null => {
  try {
    return hhmm ? parseTime(hhmm) : null;
  } catch {
    return null;
  }
};
const hhmmOf = (t: { hour: number; minute: number } | null) =>
  t
    ? `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`
    : "";

function HourInput({
  label,
  value,
  onChange,
  variant,
}: {
  label: string;
  value: string;
  onChange: (hhmm: string) => void;
  variant: FieldVariant;
}) {
  return (
    <TimeField
      aria-label={label}
      hourCycle={24}
      value={timeOf(value)}
      onChange={(t) => onChange(hhmmOf(t))}
      className="min-w-0 flex-1"
    >
      <TimeField.Group
        variant={variant}
        fullWidth
        // 좁은 화면은 한 줄에 요일 · 두 시간 · 빼기 버튼이 다 들어가게 여백 · 글자를 줄인다.
        className="max-sm:justify-center max-sm:px-[6px] max-sm:text-[13px]"
      >
        <TimeField.Input>
          {(segment) => <TimeField.Segment segment={segment} />}
        </TimeField.Input>
      </TimeField.Group>
    </TimeField>
  );
}

/**
 * 운영 시간 — 요일 구분 Select + 여는 · 닫는 시간 TimeField, 2줄까지(평일 · 주말이 다를 때).
 * 두 줄이면 "매일"은 고를 수 없다(매일이던 줄은 평일로 바꾸고 주말 줄을 더한다).
 * 한 줄에 요일 구분 · 여는 시간 ~ 닫는 시간(11-10 사용자: "한 줄로 깔끔하게"), 줄 더하기는 아래 "추가하기".
 */
export function BusinessHoursEditor({
  value,
  onChange,
  variant = "primary",
}: {
  value: StoreHours;
  onChange: (next: StoreHours) => void;
  variant?: FieldVariant;
}) {
  const slots = value.slots;
  const setSlot = (i: number, patch: Partial<StoreHours["slots"][number]>) =>
    onChange({
      ...value,
      slots: slots.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    });

  const addSlot = () => {
    const [first] = slots;
    if (!first || slots.length >= MAX_HOURS_SLOTS) return;
    const copy = { open: first.open, close: first.close };
    onChange({
      ...value,
      slots:
        first.days === "daily"
          ? [
              { ...first, days: "weekday" },
              { days: "weekend", ...copy },
            ]
          : [
              first,
              {
                days: first.days === "weekday" ? "weekend" : "weekday",
                ...copy,
              },
            ],
    });
  };

  const removeSlot = (i: number) => {
    const rest = slots.filter((_, j) => j !== i);
    onChange({ ...value, slots: rest.length ? rest : EMPTY_HOURS.slots });
  };

  const optionsFor = (i: number) =>
    HOURS_DAYS.filter(
      (d) =>
        !(slots.length > 1 && d.value === "daily") &&
        !slots.some((s, j) => j !== i && s.days === d.value),
    );

  return (
    <div className="flex flex-col gap-[8px]">
      {slots.map((slot, i) => (
        <div key={i} className="flex items-center gap-[8px] max-sm:gap-[4px]">
          <Select
            variant={variant}
            aria-label={`운영 시간 ${i + 1} 요일`}
            selectedKey={slot.days}
            onSelectionChange={(key) =>
              key != null && setSlot(i, { days: String(key) as HoursDays })
            }
            className="w-[136px] shrink-0 max-sm:w-[120px]"
          >
            <Select.Trigger className="max-sm:gap-[2px] max-sm:px-[8px] max-sm:text-[13px]">
              <Select.Value className="min-w-0 truncate" />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {optionsFor(i).map((d) => (
                  <ListBox.Item key={d.value} id={d.value} textValue={d.label}>
                    {d.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          <HourInput
            label={`${DAYS_LABEL[slot.days]} 여는 시간`}
            value={slot.open}
            onChange={(open) => setSlot(i, { open })}
            variant={variant}
          />
          <span className="shrink-0 text-[13px] text-gray-400">~</span>
          <HourInput
            label={`${DAYS_LABEL[slot.days]} 닫는 시간`}
            value={slot.close}
            onChange={(close) => setSlot(i, { close })}
            variant={variant}
          />
          {slots.length > 1 && (
            <Button
              isIconOnly
              size="sm"
              variant="tertiary"
              aria-label={`${DAYS_LABEL[slot.days]} 운영 시간 빼기`}
              onPress={() => removeSlot(i)}
              className="shrink-0 max-sm:size-[28px] max-sm:min-w-[28px]"
            >
              <Trash2 className="size-[14px]" />
            </Button>
          )}
        </div>
      ))}
      {slots.length < MAX_HOURS_SLOTS && (
        <Button
          size="sm"
          variant="tertiary"
          className="w-fit"
          onPress={addSlot}
        >
          <Plus className="size-[14px]" />
          추가하기
        </Button>
      )}
    </div>
  );
}

/** 휴무일 — 요일 · 공휴일을 여러 개 고른다(HeroUI Autocomplete, 검색해서 고르기). */
export function ClosedDaysPicker({
  value,
  onChange,
  variant = "primary",
  className,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  variant?: FieldVariant;
  className?: string;
}) {
  const { contains } = useFilter({ sensitivity: "base" });
  return (
    <Autocomplete
      aria-label="휴무일"
      selectionMode="multiple"
      variant={variant}
      placeholder="없음"
      className={cn("w-full", className)}
      fullWidth
      value={value}
      onChange={(keys) => {
        const picked = new Set((keys as (string | number)[]).map(String));
        // 고른 순서가 아니라 월 → 일 → 공휴일 순으로 둔다.
        onChange(
          CLOSED_DAYS.filter((d) => picked.has(d.value)).map((d) => d.value),
        );
      }}
    >
      <Autocomplete.Trigger>
        <Autocomplete.Value />
        <Autocomplete.ClearButton />
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter filter={contains}>
          <SearchField autoFocus aria-label="휴무일 검색" variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="검색" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListBox>
            {CLOSED_DAYS.map((d) => (
              <ListBox.Item key={d.value} id={d.value} textValue={d.label}>
                {d.label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}
