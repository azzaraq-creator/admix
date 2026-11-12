"use client";

/**
 * 콜라보 의뢰 기획안 — 항목별 수정 전 · 후 비교(PlanCompare)와 항목별로 고치기(PlanEditor), 차수 기록(PlanHistory).
 * 어드민 "콜라보 의뢰 → 기획안"과 광고주 내 콜라보 상세 "기획안" 탭이 같이 쓴다(085, 2026-11-12 사용자).
 * 바깥 카드는 쓰는 쪽이 감싼다. 안에는 테두리 상자 없이 줄 · 옅은 회색 칸만.
 */
import {
  Button,
  Checkbox,
  Chip,
  ComboBox,
  DateField,
  DateRangePicker,
  Input,
  Label,
  ListBox,
  Radio,
  RadioGroup,
  RangeCalendar,
  Separator,
  TextArea,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { ArrowRight, FileText, Paperclip, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";

import {
  COURSE,
  ITEM_EXAMPLE,
  ITEM_LABEL,
  PREP_KEYS,
  PREP_LABEL,
  estimateText,
  mdw,
  type BaseItem,
  type PrepKey,
} from "@/lib/advertiserPreview";
import {
  AUTHOR_LABEL,
  BASE_ITEMS,
  changedKeys,
  derivedOf,
  estimateLine,
  fieldText,
  filesOf,
  PLAN_FILE_ACCEPT,
  PLAN_FILE_MAX,
  PLAN_FILE_MAX_COUNT,
  roundLabel,
  scheduleLine,
  shownFields,
  storeText,
  type PlanContent,
  type PlanFieldKey,
  type PlanFile,
  type PlanStore,
  type PlanVersion,
} from "@/lib/collabPlan";
import { extractApiError } from "@/lib/apiError";
import { openFileInNewTab } from "@/lib/openFileInNewTab";
import { PREVIEW_TODAY, addDays, periodDays } from "@/lib/partnersPreview";
import { cn } from "@/lib/utils";

const NOTE_MAX = 300;

/**
 * 추가 기획 첨부 받기 — 쓰는 쪽(어드민 · 광고주)이 자기 API 로 파일을 받아 준다. 누르면 새 탭(사진 · PDF) 또는 내려받기.
 * (2026-11-12 사용자: "첨부한 파일이 안 떠" · "어드민도 파일을 첨부할 수 있게")
 */
export interface PlanFileActions {
  load: (f: PlanFile) => Promise<Blob>;
  onError?: (err: unknown) => void;
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/**
 * 첨부 파일 — 광고주 첨부 · admix 첨부 두 묶음(작은 회색 제목, 없는 묶음은 안 보임, 2026-11-12 사용자: "구분해 줘").
 * 줄은 아이콘 · 이름 · 크기 · 열기, 고치는 중이면 admix 파일에 빼기.
 */
function FileList({
  files,
  actions,
  onRemove,
}: {
  files: PlanFile[];
  actions?: PlanFileActions;
  onRemove?: (f: PlanFile) => void;
}) {
  const [opening, setOpening] = useState<string | null>(null);
  if (!files.length) return null;
  const open = async (f: PlanFile) => {
    if (!actions) return;
    setOpening(f.id);
    try {
      await openFileInNewTab(() => actions.load(f), f.name);
    } catch (err) {
      actions.onError?.(err);
    } finally {
      setOpening(null);
    }
  };
  const groups = (["advertiser", "admix"] as const)
    .map((by) => ({ by, files: files.filter((f) => f.by === by) }))
    .filter((g) => g.files.length);
  return (
    <div className="flex flex-col gap-[10px]">
      {groups.map((g) => (
        <div key={g.by} className="flex flex-col gap-[6px]">
          <span className="text-xs font-medium text-disabled">{AUTHOR_LABEL[g.by]} 첨부</span>
          <ul className="flex flex-col gap-[6px]">
            {g.files.map((f) => (
              <FileRow
                key={f.id}
                file={f}
                opening={opening === f.id}
                onOpen={actions && (() => open(f))}
                onRemove={onRemove}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function FileRow({
  file: f,
  opening,
  onOpen,
  onRemove,
}: {
  file: PlanFile;
  opening: boolean;
  onOpen?: () => void;
  onRemove?: (f: PlanFile) => void;
}) {
  return (
    <li className="flex min-w-0 items-center gap-[8px] rounded-[10px] border border-gray-200 bg-surface py-[6px] pr-[6px] pl-[12px]">
      <FileText aria-hidden className="size-[16px] shrink-0 text-gray-500" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="line-clamp-2 text-sm font-semibold break-all text-gray-800">{f.name}</span>
        {f.size != null && <span className="text-xs text-disabled">{fileSize(f.size)}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-[4px]">
        {onOpen && (
          <Button size="sm" variant="tertiary" isPending={opening} onPress={onOpen} className="h-[30px] font-semibold">
            열기
          </Button>
        )}
        {onRemove && f.by === "admix" && (
          <Button
            size="sm"
            variant="ghost"
            isIconOnly
            aria-label={`${f.name} 빼기`}
            onPress={() => onRemove(f)}
            className="size-[30px] min-w-0 text-gray-500"
          >
            <X className="size-[14px]" />
          </Button>
        )}
      </span>
    </li>
  );
}

/** 파일 첨부 — 고르면 바로 올리고(쓰는 쪽 onUpload) 목록에 더한다. 보내기 전엔 상대에게 보이지 않는다. */
function FileUpload({
  count,
  onUpload,
  onAdd,
}: {
  count: number;
  onUpload: (file: File) => Promise<PlanFile>;
  onAdd: (files: PlanFile[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  // 올리는 사이에 고친 글이 덮이지 않게 — 다 올린 뒤엔 그때의 onAdd(마지막 draft 기준)를 부른다.
  const addRef = useRef(onAdd);
  useEffect(() => {
    addRef.current = onAdd;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ""; // 같은 파일을 다시 골라도 바뀌게
    if (!picked.length) return;
    if (count + picked.length > PLAN_FILE_MAX_COUNT) {
      setError(`첨부 파일은 ${PLAN_FILE_MAX_COUNT}개까지예요.`);
      return;
    }
    if (picked.some((f) => f.size > PLAN_FILE_MAX)) {
      setError("20MB 이하 파일만 올릴 수 있어요.");
      return;
    }
    setError(null);
    setBusy(true);
    const added: PlanFile[] = [];
    try {
      for (const f of picked) added.push(await onUpload(f));
    } catch (err) {
      setError(extractApiError(err) || "파일을 올리지 못했어요.");
    } finally {
      setBusy(false);
      if (added.length) addRef.current(added);
    }
  };
  return (
    <div className="flex flex-col gap-[6px]">
      <div className="flex flex-wrap items-center gap-[8px]">
        <input ref={input} type="file" hidden multiple accept={PLAN_FILE_ACCEPT} onChange={pick} />
        <Button
          size="sm"
          variant="tertiary"
          isPending={busy}
          isDisabled={count >= PLAN_FILE_MAX_COUNT}
          onPress={() => input.current?.click()}
          className="font-semibold"
        >
          <Paperclip className="size-[14px]" />
          파일 첨부
        </Button>
        <span className="text-xs text-disabled">
          PDF · PPT · 문서 · 이미지, 파일마다 20MB · {PLAN_FILE_MAX_COUNT}개까지 · 보내면 광고주가 받아 볼 수 있어요
        </span>
      </div>
      {error && (
        <p role="alert" className="text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

// ── 비교 ─────────────────────────────────────────────────────────────

/** 항목 줄 칸 — 그대로인 줄 · 바뀐 줄이 같은 칸(이름표 | 값)이라 위아래로 나란히 읽힌다. */
const ROW_GRID = "grid gap-[6px] sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-[12px]";

/** 그대로인 항목 — 옅은 이름표 | 값 한 줄. */
function SameRow({ label, value, extra }: { label: string; value: ReactNode; extra?: ReactNode }) {
  return (
    <li className={cn(ROW_GRID, "py-[12px]")}>
      <span className="text-sm text-disabled">{label}</span>
      <div className="flex min-w-0 flex-col gap-[8px]">
        {value && <div className="whitespace-pre-wrap break-keep text-sm text-gray-700">{value}</div>}
        {extra}
      </div>
    </li>
  );
}

/** 바뀐 항목 — 진한 이름표 + "수정", 수정 전(흐린 글자) → 수정 후(진한 글자), 아래에 수정 이유. */
function ChangedRow({
  label,
  before,
  after,
  note,
  beforeLabel,
  afterLabel,
  beforeExtra,
  afterExtra,
}: {
  label: string;
  before: ReactNode;
  after: ReactNode;
  note?: string;
  beforeLabel: string;
  afterLabel: string;
  /** 글 아래 덧붙임(추가 기획 첨부) — 수정 전 · 후 칸 안에. */
  beforeExtra?: ReactNode;
  afterExtra?: ReactNode;
}) {
  return (
    <li className={cn(ROW_GRID, "py-[16px]")}>
      <div className="flex items-center gap-[8px] sm:flex-col sm:items-start sm:gap-[6px]">
        <span className="text-sm font-bold text-black">{label}</span>
        <Chip size="sm" variant="soft" color="accent">
          수정
        </Chip>
      </div>
      <div className="flex min-w-0 flex-col gap-[10px]">
        <div className="grid gap-[8px] md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch">
          <div className="flex flex-col gap-[4px] rounded-[12px] bg-gray-50 px-[14px] py-[10px]">
            <span className="text-xs font-medium text-disabled">{beforeLabel}</span>
            {before && <div className="whitespace-pre-wrap break-keep text-sm leading-[22px] text-gray-500">{before}</div>}
            {beforeExtra}
          </div>
          <ArrowRight aria-hidden className="hidden size-[16px] self-center text-gray-400 md:block" />
          <div className="flex flex-col gap-[4px] rounded-[12px] bg-gray-50 px-[14px] py-[10px]">
            <span className="text-xs font-medium text-disabled">{afterLabel}</span>
            {after && (
              <div className="whitespace-pre-wrap break-keep text-sm font-semibold leading-[22px] text-black">{after}</div>
            )}
            {afterExtra}
          </div>
        </div>
        {note && (
          <p className="whitespace-pre-wrap break-keep text-sm leading-[21px] text-gray-700">
            <span className="mr-[6px] font-semibold text-black">수정 이유</span>
            {note}
          </p>
        )}
      </div>
    </li>
  );
}

/** 지정 희망 매장 이름 — 누르면 그 매장 정보 팝업(쓰는 쪽 onStore, 2026-11-13 사용자: "어느 매장인지 볼 수 있게"). */
function StoreNames({ stores, onStore }: { stores: PlanStore[]; onStore: (s: PlanStore) => void }) {
  return (
    <span className="flex flex-wrap items-baseline gap-x-[6px] gap-y-[2px]">
      {stores.map((s, i) => (
        <span key={s.id} className="inline-flex items-baseline">
          <Button
            variant="ghost"
            onPress={() => onStore(s)}
            aria-label={`${s.name} 매장 정보 보기`}
            className="h-auto min-h-0 min-w-0 rounded-[4px] bg-transparent p-0 text-sm font-[inherit] text-inherit underline decoration-gray-300 underline-offset-[3px] data-[hovered=true]:bg-transparent data-[hovered=true]:text-primary data-[hovered=true]:decoration-primary"
          >
            {s.name}
          </Button>
          {i < stores.length - 1 && <span aria-hidden>,</span>}
        </span>
      ))}
    </span>
  );
}

/** 예상 비용 · 일정 — 차수에 적힌 값(참고용). 바뀌었으면 앞 → 뒤. */
function DerivedRows({ before, after }: { before: PlanContent | null; after: PlanContent }) {
  const rows = [
    { label: "예상 비용", b: before && estimateLine(before), a: estimateLine(after) },
    { label: "예상 일정", b: before && scheduleLine(before), a: scheduleLine(after) },
  ].filter((r) => r.a && r.a !== "-");
  if (!rows.length) return null;
  return (
    <dl className="flex flex-col gap-[8px] rounded-[12px] bg-gray-50 px-[14px] py-[12px]">
      {rows.map((r) => (
        <div key={r.label} className="flex flex-wrap items-baseline gap-x-[10px] gap-y-[2px] text-sm">
          <dt className="w-[64px] shrink-0 text-disabled">{r.label}</dt>
          <dd className="min-w-0 flex-1 break-keep text-gray-700">
            {r.b && r.b !== r.a ? (
              <>
                <span className="text-gray-400">{r.b}</span>
                <ArrowRight aria-hidden className="mx-[6px] inline size-[13px] text-gray-400" />
                <span className="font-semibold text-black">{r.a}</span>
              </>
            ) : (
              r.a
            )}
          </dd>
        </div>
      ))}
      <p className="text-xs text-disabled">예상 값이에요. 확정 뒤 실제 매장 · 일정에 따라 바뀔 수 있어요.</p>
    </dl>
  );
}

/**
 * 수정 전 · 후 비교 — 모든 항목을 의뢰서 순서대로 보이고, 바뀐 항목만 모양을 달리한다(이름표 진하게 + "수정" · 수정 전 → 후 · 수정 이유).
 * (2026-11-13 사용자: "그대로인 항목을 밑에 따로 분리하지 말고 다 보여주되 수정된 것만 다르게") before 가 없으면(1차 의뢰서뿐) 모두 그대로인 줄.
 */
export function PlanCompare({
  before,
  after,
  notes,
  beforeLabel = "수정 전",
  afterLabel = "수정 후",
  fileActions,
  onStore,
}: {
  before: PlanVersion | null;
  after: PlanVersion;
  notes: Record<string, string>;
  beforeLabel?: string;
  afterLabel?: string;
  /** 추가 기획 첨부 받기 — 없으면 파일 이름만. */
  fileActions?: PlanFileActions;
  /** 지정 희망 매장 이름을 누르면 — 없으면 이름 글자만. */
  onStore?: (s: PlanStore) => void;
}) {
  const fields = shownFields(before?.content, after.content);
  const changed = new Set(before ? changedKeys(before.content, after.content) : []);
  const extraOf = (k: PlanFieldKey, c: PlanContent | undefined) =>
    k === "extraPlan" && filesOf(c).length ? <FileList files={filesOf(c)} actions={fileActions} /> : undefined;
  const valueOf = (c: PlanContent, k: PlanFieldKey): ReactNode =>
    k === "preferred" && onStore && c.preferred.length ? (
      <StoreNames stores={c.preferred} onStore={onStore} />
    ) : (
      fieldText(c, k)
    );
  return (
    <div className="flex flex-col">
      {before && !changed.size && (
        <p className="py-[12px] text-sm font-medium text-gray-700">
          바꾼 항목이 없어요 — {roundLabel(before)} 내용 그대로예요.
        </p>
      )}
      <ul className="flex flex-col divide-y divide-gray-100">
        {fields.map((f) =>
          changed.has(f.key) && before ? (
            <ChangedRow
              key={f.key}
              label={f.label}
              before={valueOf(before.content, f.key)}
              after={valueOf(after.content, f.key)}
              note={notes[f.key]}
              beforeLabel={beforeLabel}
              afterLabel={afterLabel}
              beforeExtra={extraOf(f.key, before.content)}
              afterExtra={extraOf(f.key, after.content)}
            />
          ) : (
            <SameRow
              key={f.key}
              label={f.label}
              value={valueOf(after.content, f.key)}
              extra={extraOf(f.key, after.content)}
            />
          ),
        )}
      </ul>
      <div className="pt-[16px]">
        <DerivedRows before={before?.content ?? null} after={after.content} />
      </div>
    </div>
  );
}

// ── 차수 기록 ─────────────────────────────────────────────────────────

/** 차수 기록 — 누가 언제 보냈고 어떤 항목을 바꿨는지. */
export function PlanHistory({ versions, formatAt }: { versions: PlanVersion[]; formatAt: (iso: string) => string }) {
  return (
    <ol className="flex flex-col gap-[12px]">
      {versions.map((v, i) => {
        const prev = versions
          .slice(0, i)
          .reverse()
          .find((x) => x.author !== v.author);
        const changed = prev ? changedKeys(prev.content, v.content) : [];
        return (
          <li key={v.round} className="flex flex-col gap-[2px]">
            <div className="flex flex-wrap items-baseline gap-x-[8px]">
              <span className="text-sm font-semibold text-black">{roundLabel(v)}</span>
              {v.createdAt && <span className="text-xs text-disabled">{formatAt(v.createdAt)}</span>}
            </div>
            {v.round > 0 && (
              <p className="break-keep text-xs text-gray-600">
                {changed.length
                  ? `${changed.length}개 항목 수정: ${changed
                      .map((k) => shownFields(v.content).find((f) => f.key === k)?.label ?? k)
                      .join(", ")}`
                  : "바꾼 항목 없이 보냄"}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ── 고치기 ───────────────────────────────────────────────────────────

/** 고치는 줄 — 이름표 · 바뀌면 "수정" + 되돌리기, 지금 값, 입력 칸, 바뀐 줄엔 수정 이유 칸. */
function EditRow({
  label,
  changed,
  baseText,
  error,
  note,
  onNote,
  onReset,
  children,
}: {
  label: string;
  changed: boolean;
  baseText: string;
  error?: string;
  note: string;
  onNote: (v: string) => void;
  onReset: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[10px] py-[16px]">
      <div className="flex min-h-[28px] flex-wrap items-center gap-[8px]">
        <span className="text-sm font-bold text-black">{label}</span>
        {changed && (
          <>
            <Chip size="sm" variant="soft" color="accent">
              수정
            </Chip>
            <Button size="sm" variant="ghost" onPress={onReset} className="ml-auto h-[28px] text-gray-600">
              <RotateCcw className="size-[13px]" />
              되돌리기
            </Button>
          </>
        )}
      </div>
      {changed && (
        <p className="whitespace-pre-wrap break-keep text-xs leading-[18px] text-disabled">
          <span className="mr-[6px] font-semibold text-gray-500">지금</span>
          {baseText}
        </p>
      )}
      {children}
      {error && (
        <p role="alert" className="text-xs font-semibold text-danger">
          {error}
        </p>
      )}
      {changed && (
        <Input
          variant="secondary"
          aria-label={`${label} 수정 이유`}
          value={note}
          maxLength={NOTE_MAX}
          placeholder="수정 이유(선택) — 상대 화면에서 이 항목 아래에 보여요"
          onChange={(e) => onNote(e.target.value)}
          className="w-full"
        />
      )}
    </div>
  );
}

function PeriodInput({
  start,
  end,
  invalid,
  onChange,
}: {
  start: string;
  end: string;
  invalid: boolean;
  onChange: (start: string, end: string) => void;
}) {
  const value = start && end && end >= start ? { start: parseDate(start), end: parseDate(end) } : null;
  const minValue = parseDate(addDays(PREVIEW_TODAY, 1));
  return (
    <DateRangePicker
      aria-label="진행 기간"
      className="w-full sm:max-w-[360px]"
      value={value}
      minValue={minValue}
      isInvalid={invalid}
      onChange={(v) => {
        if (!v) return;
        const s = v.start.toString();
        const e = v.end.toString();
        onChange(s, periodDays(s, e) < 3 ? addDays(s, 2) : e);
      }}
    >
      <DateField.Group fullWidth variant="secondary">
        <DateField.Input slot="start">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateRangePicker.RangeSeparator />
        <DateField.Input slot="end">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateField.Suffix>
          <DateRangePicker.Trigger aria-label="달력 열기">
            <DateRangePicker.TriggerIndicator />
          </DateRangePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <DateRangePicker.Popover>
        <RangeCalendar aria-label="진행 기간" minValue={minValue}>
          <RangeCalendar.Header>
            <RangeCalendar.Heading />
            <RangeCalendar.NavButton slot="previous" />
            <RangeCalendar.NavButton slot="next" />
          </RangeCalendar.Header>
          <RangeCalendar.Grid>
            <RangeCalendar.GridHeader>{(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}</RangeCalendar.GridHeader>
            <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
          </RangeCalendar.Grid>
        </RangeCalendar>
      </DateRangePicker.Popover>
    </DateRangePicker>
  );
}

/** 칩 모양 고르기 — 동그라미 없이 고른 칩만 진하게(의뢰서 준비 상태와 같은 모양). */
function ChipRadio<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; text: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <RadioGroup
      aria-label={label}
      orientation="horizontal"
      value={value}
      onChange={(v) => onChange(v as T)}
      className="flex flex-wrap gap-[6px]"
    >
      {options.map((o) => (
        <Radio key={o.value} value={o.value} className="group mt-0">
          <Radio.Content className="flex cursor-pointer items-center rounded-[12px] bg-gray-50 px-[12px] py-[7px] transition-colors group-data-[selected=true]:bg-gray-900">
            <Radio.Control className="hidden">
              <Radio.Indicator />
            </Radio.Control>
            <Label className="cursor-pointer break-keep text-xs font-semibold text-gray-600 group-data-[selected=true]:text-white">
              {o.text}
            </Label>
          </Radio.Content>
        </Radio>
      ))}
    </RadioGroup>
  );
}

const num = (v: string, min = 0) => Math.max(min, Math.round(Number(v.replace(/[^\d]/g, "")) || 0));

/** 지정 희망 매장 고치기 — 넣은 매장 줄(빼기)과 매장 찾아 넣기. */
function PreferredInput({
  value,
  options,
  onChange,
}: {
  value: PlanStore[];
  options: PlanStore[];
  onChange: (v: PlanStore[]) => void;
}) {
  const [query, setQuery] = useState("");
  const chosen = new Set(value.map((p) => p.id));
  const left = options.filter((o) => !chosen.has(o.id));
  return (
    <div className="flex flex-col gap-[8px]">
      {value.length > 0 && (
        <ul className="flex flex-col gap-[6px]">
          {value.map((p) => (
            <li key={p.id} className="flex items-center gap-[10px] rounded-[12px] bg-gray-50 py-[6px] pl-[14px] pr-[6px]">
              <span className="min-w-0 flex-1 truncate text-sm text-black">{storeText(p)}</span>
              <span className="shrink-0 text-xs text-disabled">
                {p.grade ? `${p.grade} · ` : ""}
                {p.fee ? estimateText(p.fee, 0) : "금액 협의"}
              </span>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label={`${p.name} 빼기`}
                onPress={() => onChange(value.filter((x) => x.id !== p.id))}
                className="size-[28px] text-gray-500"
              >
                <X className="size-[14px]" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ComboBox
        variant="secondary"
        aria-label="지정 희망 매장 넣기"
        menuTrigger="focus"
        inputValue={query}
        onInputChange={setQuery}
        selectedKey={null}
        onSelectionChange={(key) => {
          const s = left.find((o) => o.id === key);
          if (s) onChange([...value, s]);
          setQuery("");
        }}
        className="w-full sm:max-w-[360px]"
      >
        <ComboBox.InputGroup>
          <Input variant="secondary" placeholder="매장 이름으로 찾아 넣기" />
          <ComboBox.Trigger />
        </ComboBox.InputGroup>
        <ComboBox.Popover>
          <ListBox renderEmptyState={() => <p className="px-[12px] py-[8px] text-sm text-disabled">넣을 수 있는 매장이 없어요.</p>}>
            {left.map((o) => (
              <ListBox.Item key={o.id} id={o.id} textValue={o.name}>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm text-black">{o.name}</span>
                  <span className="truncate text-xs text-disabled">
                    {[o.area, o.grade, o.fee ? estimateText(o.fee, 0) : "금액 협의"].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </ListBox.Item>
            ))}
          </ListBox>
        </ComboBox.Popover>
      </ComboBox>
    </div>
  );
}

/**
 * 항목별로 고치기 — base(지금 펼친 차수)에서 시작한 draft 를 고친다. 바뀐 줄엔 "수정" · 되돌리기 · 수정 이유 칸.
 * 아래엔 고친 값으로 다시 계산한 예상 비용 · 일정(의뢰서와 같은 계산).
 */
export function PlanEditor({
  base,
  draft,
  onDraft,
  notes,
  onNotes,
  errors,
  storeOptions,
  avg,
  fileActions,
  onUploadFile,
}: {
  base: PlanContent;
  draft: PlanContent;
  onDraft: (next: PlanContent) => void;
  notes: Record<string, string>;
  onNotes: (next: Record<string, string>) => void;
  errors: Partial<Record<PlanFieldKey, string>>;
  storeOptions: PlanStore[];
  avg: number;
  /** 추가 기획 첨부 받기. */
  fileActions?: PlanFileActions;
  /** 있으면 파일 첨부 · admix 파일 빼기(어드민만, 11-12). 광고주는 기획안에서 첨부를 바꾸지 않는다. */
  onUploadFile?: (file: File) => Promise<PlanFile>;
}) {
  const changed = useMemo(() => new Set(changedKeys(base, draft)), [base, draft]);
  const set = (patch: Partial<PlanContent>) => onDraft({ ...draft, ...patch });
  const note = (k: PlanFieldKey) => notes[k] ?? "";
  const setNote = (k: PlanFieldKey) => (v: string) => onNotes({ ...notes, [k]: v });
  /** 되돌리기 — 그 항목만 지금 값으로, 적던 수정 이유도 지운다. */
  const reset = (k: PlanFieldKey) => () => {
    const { [k]: _drop, ...rest } = notes;
    void _drop;
    onNotes(rest);
    if (k === "period") return set({ startDate: base.startDate, endDate: base.endDate });
    if (k === "stores") return set({ minStores: base.minStores, targetStores: base.targetStores });
    if (k === "extraPlan") return set({ extraPlan: base.extraPlan, files: base.files });
    if (k.startsWith("item:")) {
      const key = k.slice(5);
      const was = base.items.find((x) => x.key === key);
      const others = draft.items.filter((x) => x.key !== key);
      const items = was ? [...others, was] : others;
      return set({ items: BASE_ITEMS.flatMap((b) => items.filter((x) => x.key === b)) });
    }
    set({ [k]: base[k as keyof PlanContent] } as Partial<PlanContent>);
  };
  const row = (k: PlanFieldKey, label: string, editor: ReactNode) => (
    <EditRow
      key={k}
      label={label}
      changed={changed.has(k)}
      baseText={fieldText(base, k)}
      error={errors[k]}
      note={note(k)}
      onNote={setNote(k)}
      onReset={reset(k)}
    >
      {editor}
    </EditRow>
  );

  const setItem = (key: BaseItem, patch: Partial<{ on: boolean; prep: PrepKey; note: string }>) => {
    const cur = draft.items.find((x) => x.key === key);
    let items = draft.items;
    if (patch.on === false) items = items.filter((x) => x.key !== key);
    else if (patch.on === true && !cur)
      items = [...items, base.items.find((x) => x.key === key) ?? { key, prep: "ready", note: "" }];
    else if (cur) items = items.map((x) => (x.key === key ? { ...x, ...patch } : x));
    set({ items: BASE_ITEMS.flatMap((b) => items.filter((x) => x.key === b)) });
  };

  const d = derivedOf(draft, avg);
  const b = derivedOf(base, avg);

  const rows: ReactNode[] = [
    row(
      "title",
      "캠페인명",
      <Input
        variant="secondary"
        aria-label="캠페인명"
        value={draft.title}
        maxLength={30}
        onChange={(e) => set({ title: e.target.value })}
        className="w-full"
      />,
    ),
    row(
      "summary",
      "한 줄 소개",
      <Input
        variant="secondary"
        aria-label="한 줄 소개"
        value={draft.summary ?? ""}
        maxLength={100}
        placeholder="비워 둘 수 있어요"
        onChange={(e) => set({ summary: e.target.value })}
        className="w-full"
      />,
    ),
    row(
      "period",
      "진행 기간",
      <div className="flex flex-wrap items-center gap-[10px]">
        <PeriodInput
          start={draft.startDate}
          end={draft.endDate}
          invalid={!!errors.period}
          onChange={(startDate, endDate) => set({ startDate, endDate })}
        />
        {draft.startDate && draft.endDate && (
          <span className="text-sm text-gray-600">총 {periodDays(draft.startDate, draft.endDate)}일</span>
        )}
      </div>,
    ),
    row(
      "course",
      "모집 코스",
      <ChipRadio
        label="모집 코스"
        value={draft.course === "rush" ? "rush" : "standard"}
        options={(["standard", "rush"] as const).map((c) => ({
          value: c,
          text: `${COURSE[c].label} · ${COURSE[c].detail}`,
        }))}
        onChange={(course) => set({ course })}
      />,
    ),
    row(
      "stores",
      "매장 수",
      <div className="flex flex-wrap items-center gap-[10px]">
        {(
          [
            ["minStores", "최소"],
            ["targetStores", "목표"],
          ] as const
        ).map(([k, text]) => (
          <label key={k} className="flex items-center gap-[8px] text-sm text-gray-600">
            {text}
            <Input
              variant="secondary"
              aria-label={`${text} 매장 수`}
              inputMode="numeric"
              value={String(draft[k])}
              onChange={(e) => set({ [k]: num(e.target.value, 1) } as Partial<PlanContent>)}
              className="w-[88px] text-right"
            />
            곳
          </label>
        ))}
      </div>,
    ),
    ...BASE_ITEMS.map((key) => {
      const cur = draft.items.find((x) => x.key === key);
      return row(
        `item:${key}`,
        `기본안 · ${ITEM_LABEL[key]}`,
        <div className="flex flex-col gap-[10px]">
          <Checkbox isSelected={!!cur} onChange={(on) => setItem(key, { on })} className="w-fit">
            <Checkbox.Content className="cursor-pointer items-center gap-[8px]">
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Label elementType="span" className="cursor-pointer text-sm text-gray-700">
                이 기본안 넣기
              </Label>
            </Checkbox.Content>
          </Checkbox>
          {cur && (
            <>
              <ChipRadio
                label={`${ITEM_LABEL[key]} 준비 상태`}
                value={cur.prep}
                options={PREP_KEYS.map((p) => ({ value: p, text: PREP_LABEL[p] }))}
                onChange={(prep) => setItem(key, { prep })}
              />
              <Input
                variant="secondary"
                aria-label={`${ITEM_LABEL[key]} 조건`}
                value={cur.note}
                maxLength={100}
                placeholder={`조건(예: ${ITEM_EXAMPLE[key]})`}
                onChange={(e) => setItem(key, { note: e.target.value })}
                className="w-full"
              />
            </>
          )}
        </div>,
      );
    }),
    row(
      "extraPlan",
      "추가 기획",
      <div className="flex flex-col gap-[8px]">
        <TextArea
          variant="secondary"
          aria-label="추가 기획"
          rows={4}
          value={draft.extraPlan ?? ""}
          maxLength={1000}
          placeholder="비워 둘 수 있어요"
          onChange={(e) => set({ extraPlan: e.target.value })}
          className="w-full"
        />
        <FileList
          files={filesOf(draft)}
          actions={fileActions}
          onRemove={onUploadFile ? (f) => set({ files: filesOf(draft).filter((x) => x.id !== f.id) }) : undefined}
        />
        {onUploadFile && (
          <FileUpload
            count={filesOf(draft).length}
            onUpload={onUploadFile}
            onAdd={(added) => set({ files: [...filesOf(draft), ...added] })}
          />
        )}
      </div>,
    ),
    row(
      "preferred",
      "지정 희망 매장",
      <PreferredInput value={draft.preferred} options={storeOptions} onChange={(preferred) => set({ preferred })} />,
    ),
  ];

  return (
    <div className="flex flex-col">
      {rows.map((r, i) => (
        <div key={i}>
          {i > 0 && <Separator />}
          {r}
        </div>
      ))}
      <Separator />
      <div className="flex flex-col gap-[8px] pt-[16px]">
        <dl className="flex flex-col gap-[8px] rounded-[12px] bg-gray-50 px-[14px] py-[12px] text-sm">
          <div className="flex flex-wrap items-baseline gap-x-[10px]">
            <dt className="w-[64px] shrink-0 text-disabled">예상 비용</dt>
            <dd className="min-w-0 flex-1 text-gray-700">
              {estimateText(d.estimate.total, d.estimate.negotiable)}
              {d.estimate.total !== b.estimate.total && (
                <span className="ml-[6px] text-xs text-disabled">
                  (지금 {estimateText(b.estimate.total, b.estimate.negotiable)})
                </span>
              )}
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-[10px]">
            <dt className="w-[64px] shrink-0 text-disabled">예상 일정</dt>
            <dd className="min-w-0 flex-1 break-keep text-gray-700">
              모집 공지 {mdw(d.schedule.noticeDate)} · 설치 {mdw(d.schedule.installStart)} · 철수 {mdw(d.schedule.removalDate)}
            </dd>
          </div>
          <p className="text-xs text-disabled">지금 보내면 기준으로 다시 계산한 예상 값이에요.</p>
        </dl>
        {d.tooSoon && (
          <p role="alert" className="text-xs font-semibold text-danger">
            모집 · 준비 기간이 부족해요 — {mdw(d.earliest)} 이후 시작을 권해요.
          </p>
        )}
      </div>
    </div>
  );
}
