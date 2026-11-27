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
  Select,
  Separator,
  TextArea,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { ArrowRight, Paperclip, RotateCcw, X } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";

import { FilePreviewModal, fileSizeText } from "@/components/collabPlan/FilePreview";
import { MaskIcon } from "@/components/common/MaskIcon";
import {
  COURSE,
  ITEM_EXAMPLE,
  ITEM_LABEL,
  PREP_KEYS,
  PREP_LABEL,
  checkpoints,
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
  midReportOf,
  PLAN_FILE_ACCEPT,
  PLAN_FILE_MAX,
  PLAN_FILE_MAX_COUNT,
  roundLabel,
  scheduleParts,
  shownFields,
  storeText,
  type PlanContent,
  type PlanFieldKey,
  type PlanFile,
  type PlanStore,
  type PlanVersion,
  type SchedulePart,
} from "@/lib/collabPlan";
import { extractApiError } from "@/lib/apiError";
import { PREVIEW_TODAY, addDays, periodDays } from "@/lib/partnersPreview";
import { cn } from "@/lib/utils";

const NOTE_MAX = 300;

/**
 * 의뢰서 모양(PlanCompare look="doc") — 어드민 기획안 탭(2026-11-18 사용자: "의뢰서는 의뢰서처럼 깔끔하게").
 * 의뢰서 탭 표와 같은 모양: 위 굵은 검정 선 · 줄마다 옅은 선 · 회색 이름 칸 | 값 칸, 둥근 상자 없이 각지게.
 * 광고주 화면(기본 모양)은 그대로.
 */
const DocLook = createContext(false);
const DOC_ROW = "grid grid-cols-1 sm:grid-cols-[132px_minmax(0,1fr)]";
const DOC_LABEL = "flex bg-gray-50 px-[12px] py-[11px] text-sm font-semibold text-tone-4a5565";
const DOC_VALUE = "min-w-0 px-[12px] py-[11px]";

/**
 * 추가 기획 첨부 받기 — 쓰는 쪽(어드민 · 광고주)이 자기 API 로 파일을 받아 준다. 누르면 미리보기 창(사진 · PDF), 그 밖은 내려받기.
 * (2026-11-12 사용자: "첨부한 파일이 안 떠" · "어드민도 파일을 첨부할 수 있게", 11-17 "열기 말고 미리보기")
 */
export interface PlanFileActions {
  load: (f: PlanFile) => Promise<Blob>;
  onError?: (err: unknown) => void;
}

/**
 * 첨부 파일 — 광고주 첨부 · admix 첨부 두 묶음(2026-11-12 사용자: "구분해 줘").
 * 묶음 이름(작은 회색 글)은 두 쪽 파일이 같이 있을 때만 — 한쪽뿐이면 뺀다(11-17 사용자: "광고주 첨부" 없애줘).
 * 줄은 아이콘 · 이름 · 크기 · 미리보기, 고치는 중이면 admix 파일에 빼기.
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
  const [preview, setPreview] = useState<PlanFile | null>(null);
  const [open, setOpen] = useState(false);
  if (!files.length) return null;
  const groups = (["advertiser", "admix"] as const)
    .map((by) => ({ by, files: files.filter((f) => f.by === by) }))
    .filter((g) => g.files.length);
  return (
    <div className="flex flex-col gap-[10px]">
      {groups.map((g) => (
        <div key={g.by} className="flex flex-col gap-[6px]">
          {groups.length > 1 && <span className="text-xs font-medium text-disabled">{AUTHOR_LABEL[g.by]} 첨부</span>}
          <ul className="flex flex-col gap-[6px]">
            {g.files.map((f) => (
              <FileRow
                key={f.id}
                file={f}
                onPreview={
                  actions &&
                  (() => {
                    setPreview(f);
                    setOpen(true);
                  })
                }
                onRemove={onRemove}
              />
            ))}
          </ul>
        </div>
      ))}
      {actions && preview && (
        <FilePreviewModal
          key={preview.id}
          file={preview}
          load={() => actions.load(preview)}
          isOpen={open}
          onOpenChange={setOpen}
          onError={actions.onError}
        />
      )}
    </div>
  );
}

/** 파일 한 줄 — 아이콘 · 이름 옆 크기(11-17 사용자: "파일명 오른쪽에") · 미리보기. */
function FileRow({
  file: f,
  onPreview,
  onRemove,
}: {
  file: PlanFile;
  onPreview?: () => void;
  onRemove?: (f: PlanFile) => void;
}) {
  const doc = useContext(DocLook);
  return (
    <li
      className={cn(
        "flex min-w-0 items-center gap-[8px] border border-gray-200 bg-surface py-[6px] pr-[6px] pl-[12px]",
        doc ? "rounded-[4px]" : "rounded-[10px]",
      )}
    >
      <MaskIcon src="/icons/file-text.svg" className="size-[16px] shrink-0 text-gray-500" />
      <span className="flex min-w-0 flex-1 items-baseline gap-[6px]">
        <span className="min-w-0 truncate text-sm font-semibold text-gray-800">{f.name}</span>
        {f.size != null && <span className="shrink-0 text-xs text-disabled">{fileSizeText(f.size)}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-[4px]">
        {onPreview && (
          <Button size="sm" variant="tertiary" onPress={onPreview} className="h-[30px] font-semibold">
            미리보기
          </Button>
        )}
        {/* 빼기 — 어드민 고치기에서만(onRemove). 광고주 의뢰서 첨부도 뺄 수 있다(11-18 사용자, 서버도 admix 차수는 허용). */}
        {onRemove && (
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
  const doc = useContext(DocLook);
  if (doc)
    return (
      <li className={DOC_ROW}>
        <span className={DOC_LABEL}>{label}</span>
        <div className={cn(DOC_VALUE, "flex flex-col gap-[8px]")}>
          {value && <div className="whitespace-pre-wrap break-keep text-sm text-black">{value}</div>}
          {extra}
        </div>
      </li>
    );
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

/** 수정 전 · 후 칸 값 — 바뀐 항목 줄과 기본안 묶음 안 바뀐 기본안이 같이 쓴다. */
interface ChangeProps {
  before: ReactNode;
  after: ReactNode;
  note?: string;
  /** 글 아래 덧붙임(추가 기획 첨부) — 수정 전 · 후 칸 안에. */
  beforeExtra?: ReactNode;
  afterExtra?: ReactNode;
}

/** 묶음 안 항목 이름 앞 점(2026-11-26 사용자: "앞에 *이나 점이나 -로 구분") — 광고주 화면 모양만. 값은 점 너비만큼 들여 쓴다. */
const ITEM_DOT = <span aria-hidden className="size-[4px] shrink-0 rounded-full bg-gray-400" />;
const ITEM_INDENT = "pl-[10px]";

/** 진한 이름표 + "수정". */
function ChangedLabel({ label, inline = false, dot = false }: { label: string; inline?: boolean; dot?: boolean }) {
  return (
    <div className={cn("flex items-center gap-[8px]", !inline && "sm:flex-col sm:items-start sm:gap-[6px]")}>
      <span className={cn("text-sm font-bold text-black", dot && "flex items-center gap-[6px]")}>
        {dot && ITEM_DOT}
        {label}
      </span>
      <Chip size="sm" variant="soft" color="accent">
        수정
      </Chip>
    </div>
  );
}

/**
 * 수정 전(흐린 글자) → 수정 후(진한 글자), 아래에 수정 이유.
 * 칸 위 "수정 전 · 1차 의뢰서" 같은 이름은 뺐다(2026-11-26 사용자: "수정 전, 수정 후 이거 다 빼줘") — 흐린 글 → 진한 글로 구분한다.
 */
function ChangeBody({ before, after, note, beforeExtra, afterExtra }: ChangeProps) {
  const doc = useContext(DocLook);
  const box = doc
    ? "flex flex-col gap-[4px] rounded-[4px] border border-gray-200 px-[12px] py-[9px]"
    : "flex flex-col gap-[4px] rounded-[12px] bg-gray-50 px-[14px] py-[10px]";
  return (
    <div className="flex min-w-0 flex-col gap-[10px]">
      <div className="grid gap-[8px] md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch">
        <div className={cn(box, doc && "bg-gray-50")}>
          {before && <div className="whitespace-pre-wrap break-keep text-sm leading-[22px] text-gray-500">{before}</div>}
          {beforeExtra}
        </div>
        <ArrowRight aria-hidden className="hidden size-[16px] self-center text-gray-400 md:block" />
        <div className={cn(box, doc && "border-gray-400 bg-white")}>
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
  );
}

/** 바뀐 항목 — 진한 이름표 + "수정", 수정 전 → 수정 후, 아래에 수정 이유. */
function ChangedRow({ label, ...change }: { label: string } & ChangeProps) {
  const doc = useContext(DocLook);
  if (doc)
    return (
      <li className={DOC_ROW}>
        <div className={cn(DOC_LABEL, "flex-wrap items-center gap-[6px] text-black sm:flex-col sm:items-start")}>
          {label}
          <Chip size="sm" variant="soft" color="accent">
            수정
          </Chip>
        </div>
        <div className={cn(DOC_VALUE, "py-[12px]")}>
          <ChangeBody {...change} />
        </div>
      </li>
    );
  return (
    <li className={cn(ROW_GRID, "py-[16px]")}>
      <ChangedLabel label={label} />
      <ChangeBody {...change} />
    </li>
  );
}

/**
 * 기본안 묶음 — 기본안 여러 줄을 이름표 "기본안" 하나 아래에 모은다(2026-11-17 사용자: "기본안과 추가 기획끼리 묶어서").
 * 안쪽은 기본안 이름 | 값, 바뀐 기본안만 진한 이름 + "수정" · 수정 전 → 후 · 수정 이유.
 */
function ItemGroup({
  label,
  rows,
}: {
  label: string;
  rows: { key: string; label: string; value: ReactNode; change: ChangeProps | null }[];
}) {
  const changed = rows.some((r) => r.change);
  const doc = useContext(DocLook);
  return (
    <li className={doc ? DOC_ROW : cn(ROW_GRID, changed ? "py-[16px]" : "py-[12px]")}>
      <span className={doc ? cn(DOC_LABEL, changed && "text-black") : cn("text-sm", changed ? "font-bold text-black" : "text-disabled")}>
        {label}
      </span>
      <ul className={cn("flex min-w-0 flex-col gap-[10px]", doc && DOC_VALUE)}>
        {rows.map((r) => (
          // 이름 위 · 값 아래(2026-11-18 사용자: "옆으로 말고, 위 아래로 배치해 줘") — 예전엔 이름 100px | 값
          <li key={r.key} className="flex min-w-0 flex-col gap-[4px]">
            {r.change ? (
              <>
                <ChangedLabel label={r.label} inline dot={!doc} />
                <div className={cn("min-w-0", !doc && ITEM_INDENT)}>
                  <ChangeBody {...r.change} />
                </div>
              </>
            ) : (
              <>
                <span className={cn("text-sm text-gray-500", !doc && "flex items-center gap-[6px]")}>
                  {!doc && ITEM_DOT}
                  {r.label}
                </span>
                <div className={cn("whitespace-pre-wrap break-keep text-sm", doc ? "text-black" : cn("text-gray-700", ITEM_INDENT))}>
                  {r.value}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
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

/** 지정 희망 매장 이름 — 누르면 새 탭으로 그 매장 상세(어드민 매장 관리, 2026-11-17 사용자). 밑줄 · 검정. */
function StoreLinks({ stores, hrefOf }: { stores: PlanStore[]; hrefOf: (s: PlanStore) => string }) {
  return (
    <span className="flex flex-wrap items-baseline gap-x-[6px] gap-y-[2px]">
      {stores.map((s, i) => (
        <span key={s.id} className="inline-flex items-baseline">
          <a
            href={hrefOf(s)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-black underline underline-offset-2"
          >
            {s.name}
          </a>
          {i < stores.length - 1 && <span aria-hidden>,</span>}
        </span>
      ))}
    </span>
  );
}

/** 앞 값과 다르면 앞(흐리게) → 뒤(진하게). */
function BeforeAfter({ b, a }: { b?: string | null; a: string }) {
  if (!b || b === a) return <>{a}</>;
  return (
    <>
      <span className="text-gray-400">{b}</span>
      <ArrowRight aria-hidden className="mx-[6px] inline size-[13px] text-gray-400" />
      <span className="font-semibold text-black">{a}</span>
    </>
  );
}

/** 예상 일정 칸 — 모집 공지 · 설치 · 철수를 줄마다 나눠 이름 | 날짜(2026-11-17 사용자: "구분해서 보여줘"). */
function ScheduleParts({
  parts,
  prev = [],
  mark = false,
}: {
  parts: SchedulePart[];
  prev?: SchedulePart[];
  /** 비교표 뒤 칸 — 앞 값은 옆 칸에 있으니 화살표 없이 바뀐 날짜만 진하게. */
  mark?: boolean;
}) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-[12px] gap-y-[4px]">
      {parts.map((p) => {
        const b = prev.find((x) => x.label === p.label)?.value;
        return (
          <div key={p.label} className="contents">
            <dt className="font-normal text-gray-500">{p.label}</dt>
            <dd className="min-w-0 break-keep font-normal text-gray-700">
              {mark ? (
                <span className={cn(b && b !== p.value && "font-semibold text-black")}>{p.value}</span>
              ) : (
                <BeforeAfter b={b} a={p.value} />
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** 예상 비용 · 일정 — 차수에 적힌 값(참고용). 바뀌었으면 앞 → 뒤. 아래 안내 글은 뺐다(11-17 사용자). */
function DerivedRows({ before, after }: { before: PlanContent | null; after: PlanContent }) {
  const doc = useContext(DocLook);
  const cost = estimateLine(after);
  const parts = scheduleParts(after.schedule);
  if (cost === "-" && !parts.length) return null;
  if (doc)
    return (
      <>
        {cost !== "-" && <SameRow label="예상 비용" value={<BeforeAfter b={before && estimateLine(before)} a={cost} />} />}
        {parts.length > 0 && (
          <SameRow
            label="예상 일정"
            value={<ScheduleParts parts={parts} prev={before ? scheduleParts(before.schedule) : []} />}
          />
        )}
      </>
    );
  return (
    <dl className="flex flex-col gap-[8px] rounded-[12px] bg-gray-50 px-[14px] py-[12px] text-sm">
      {cost !== "-" && (
        <div className="flex flex-wrap items-baseline gap-x-[10px] gap-y-[2px]">
          <dt className="w-[64px] shrink-0 text-disabled">예상 비용</dt>
          <dd className="min-w-0 flex-1 break-keep text-gray-700">
            <BeforeAfter b={before && estimateLine(before)} a={cost} />
          </dd>
        </div>
      )}
      {parts.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-[10px] gap-y-[2px]">
          <dt className="w-[64px] shrink-0 text-disabled">예상 일정</dt>
          <dd className="min-w-0 flex-1">
            <ScheduleParts parts={parts} prev={before ? scheduleParts(before.schedule) : []} />
          </dd>
        </div>
      )}
    </dl>
  );
}

/**
 * 수정 전 · 후 비교표(어드민 기획안 탭, 2026-11-18 사용자: "UI가 안 예쁘고") — 항목 | 앞 차수 | 이번 차수 세 칸 의뢰서 표.
 * 머리줄에 차수 이름을 한 번만 적고, 그대로인 항목은 값 하나를 두 칸에 걸쳐, 바뀐 항목만 앞(흐리게) | 뒤(진하게) + 수정 이유.
 * 기본안은 이름 칸 "기본안" 하나 아래 기본안마다 작은 이름. 휴대폰은 한 줄씩 쌓고 칸마다 차수 이름을 작게 붙인다.
 */
const CMP_ROW = "grid grid-cols-1 sm:grid-cols-[132px_minmax(0,1fr)_minmax(0,1fr)]";
const CMP_CELL = "min-w-0 px-[12px] py-[11px]";

interface CmpLine {
  key: string;
  /** 기본안 안쪽 작은 이름(기본안만). */
  sub?: string;
  before: ReactNode;
  after: ReactNode;
  beforeExtra?: ReactNode;
  afterExtra?: ReactNode;
  changed: boolean;
  note?: string;
}

function CmpValue({ line, side, label }: { line: CmpLine; side: "before" | "after" | "same"; label?: string }) {
  const value = side === "before" ? line.before : line.after;
  const extra = side === "before" ? line.beforeExtra : line.afterExtra;
  return (
    <div className={cn(CMP_CELL, "flex flex-col gap-[6px]", side === "same" && "sm:col-span-2")}>
      {label && <span className="text-xs font-medium text-disabled sm:hidden">{label}</span>}
      {line.sub && (
        <span className="flex items-center gap-[6px] text-xs text-gray-500">
          {line.sub}
          {line.changed && side === "after" && (
            <Chip size="sm" variant="soft" color="accent">
              수정
            </Chip>
          )}
        </span>
      )}
      {value != null && value !== "" && (
        <div
          className={cn(
            "whitespace-pre-wrap break-keep text-sm",
            side === "before" ? "text-gray-500" : side === "after" ? "font-semibold text-black" : "text-black",
          )}
        >
          {value}
        </div>
      )}
      {extra}
      {side === "after" && line.note && (
        <p className="whitespace-pre-wrap break-keep text-xs leading-[18px] text-gray-600">
          <span className="mr-[6px] font-semibold text-gray-800">수정 이유</span>
          {line.note}
        </p>
      )}
    </div>
  );
}

function CmpLineCells({ line, beforeLabel, afterLabel }: { line: CmpLine; beforeLabel: string; afterLabel: string }) {
  if (!line.changed) return <CmpValue line={line} side="same" />;
  return (
    <>
      <CmpValue line={line} side="before" label={beforeLabel} />
      <CmpValue line={line} side="after" label={afterLabel} />
    </>
  );
}

function CompareTable({
  rows,
  beforeLabel,
  afterLabel,
}: {
  rows: { key: string; label: string; lines: CmpLine[] }[];
  beforeLabel: string;
  afterLabel: string;
}) {
  return (
    <div className="flex flex-col text-sm">
      <div className={cn(CMP_ROW, "border-y border-gray-300 border-t-2 border-t-black bg-gray-50 text-xs font-semibold text-tone-4a5565 max-sm:hidden")}>
        <span className="px-[12px] py-[9px]">항목</span>
        <span className="px-[12px] py-[9px]">{beforeLabel}</span>
        <span className="px-[12px] py-[9px] text-black">{afterLabel}</span>
      </div>
      <ul className="flex flex-col divide-y divide-gray-200 border-b border-gray-200 max-sm:border-t-2 max-sm:border-t-black">
        {rows.map((r) => {
          const changed = r.lines.some((l) => l.changed);
          const grouped = r.lines.length > 1 || !!r.lines[0]?.sub;
          return (
            <li key={r.key} className={CMP_ROW}>
              <div className={cn(DOC_LABEL, "flex-wrap items-center gap-[6px] sm:flex-col sm:items-start", changed && "text-black")}>
                {r.label}
                {changed && !grouped && (
                  <Chip size="sm" variant="soft" color="accent">
                    수정
                  </Chip>
                )}
              </div>
              {grouped ? (
                <div className="flex min-w-0 flex-col divide-y divide-dashed divide-gray-200 sm:col-span-2">
                  {r.lines.map((l) => (
                    <div key={l.key} className="grid grid-cols-1 sm:grid-cols-2">
                      <CmpLineCells line={l} beforeLabel={beforeLabel} afterLabel={afterLabel} />
                    </div>
                  ))}
                </div>
              ) : (
                r.lines[0] && <CmpLineCells line={r.lines[0]} beforeLabel={beforeLabel} afterLabel={afterLabel} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * 수정 전 · 후 비교 — 모든 항목을 의뢰서 순서대로 보이고, 바뀐 항목만 모양을 달리한다(이름표 진하게 + "수정" · 수정 전 → 후 · 수정 이유).
 * (2026-11-13 사용자: "그대로인 항목을 밑에 따로 분리하지 말고 다 보여주되 수정된 것만 다르게") before 가 없으면(1차 의뢰서뿐) 모두 그대로인 줄.
 * 기본안은 한 묶음으로(ItemGroup, 11-17 사용자).
 */
export function PlanCompare({
  before,
  after,
  notes,
  beforeLabel = "수정 전",
  afterLabel = "수정 후",
  fileActions,
  onStore,
  storeHref,
  look = "card",
}: {
  before: PlanVersion | null;
  after: PlanVersion;
  notes: Record<string, string>;
  /** "doc" — 의뢰서 표 모양(어드민 기획안 탭, 11-18). 기본은 광고주 화면 모양. */
  look?: "card" | "doc";
  beforeLabel?: string;
  afterLabel?: string;
  /** 추가 기획 첨부 받기 — 없으면 파일 이름만. */
  fileActions?: PlanFileActions;
  /** 지정 희망 매장 이름을 누르면 — 없으면 이름 글자만. */
  onStore?: (s: PlanStore) => void;
  /** 지정 희망 매장 이름을 새 탭 링크로(어드민 매장 상세) — 주면 onStore 대신. */
  storeHref?: (s: PlanStore) => string;
}) {
  const fields = shownFields(before?.content, after.content);
  const changed = new Set(before ? changedKeys(before.content, after.content) : []);
  const extraOf = (k: PlanFieldKey, c: PlanContent | undefined) =>
    k === "extraPlan" && filesOf(c).length ? <FileList files={filesOf(c)} actions={fileActions} /> : undefined;
  const valueOf = (c: PlanContent, k: PlanFieldKey): ReactNode => {
    if (k === "preferred" && c.preferred.length) {
      if (storeHref) return <StoreLinks stores={c.preferred} hrefOf={storeHref} />;
      if (onStore) return <StoreNames stores={c.preferred} onStore={onStore} />;
    }
    return fieldText(c, k);
  };
  const changeOf = (k: PlanFieldKey): ChangeProps | null =>
    before && changed.has(k)
      ? {
          before: valueOf(before.content, k),
          after: valueOf(after.content, k),
          note: notes[k],
          beforeExtra: extraOf(k, before.content),
          afterExtra: extraOf(k, after.content),
        }
      : null;
  const itemFields = fields.filter((f) => f.key.startsWith("item:"));
  const rows = fields.map((f) => {
    if (f.key.startsWith("item:")) {
      if (f !== itemFields[0]) return null;
      return (
        <ItemGroup
          key="items"
          label="기본안"
          rows={itemFields.map((x) => ({
            key: x.key,
            label: ITEM_LABEL[x.key.slice(5) as BaseItem],
            value: valueOf(after.content, x.key),
            change: changeOf(x.key),
          }))}
        />
      );
    }
    const change = changeOf(f.key);
    return change ? (
      <ChangedRow key={f.key} label={f.label} {...change} />
    ) : (
      <SameRow
        key={f.key}
        label={f.label}
        value={valueOf(after.content, f.key)}
        extra={extraOf(f.key, after.content)}
      />
    );
  });
  const doc = look === "doc";
  // 어드민 비교(앞 차수가 있을 때)는 세 칸 비교표로.
  if (doc && before) {
    const lineOf = (k: PlanFieldKey, sub?: string): CmpLine => ({
      key: k,
      sub,
      before: valueOf(before.content, k),
      after: valueOf(after.content, k),
      beforeExtra: extraOf(k, before.content),
      afterExtra: extraOf(k, after.content),
      changed: changed.has(k),
      note: notes[k],
    });
    const tableRows: { key: string; label: string; lines: CmpLine[] }[] = [];
    for (const f of fields) {
      if (f.key.startsWith("item:")) {
        if (f !== itemFields[0]) continue;
        tableRows.push({
          key: "items",
          label: "기본안",
          lines: itemFields.map((x) => lineOf(x.key, ITEM_LABEL[x.key.slice(5) as BaseItem])),
        });
        continue;
      }
      tableRows.push({ key: f.key, label: f.label, lines: [lineOf(f.key)] });
    }
    // 예상 비용 · 일정 — 차수에 적힌 값. 다르면 앞 | 뒤.
    const costB = estimateLine(before.content);
    const costA = estimateLine(after.content);
    if (costA !== "-")
      tableRows.push({
        key: "cost",
        label: "예상 비용",
        lines: [{ key: "cost", before: costB, after: costA, changed: costB !== costA }],
      });
    const partsB = scheduleParts(before.content.schedule);
    const partsA = scheduleParts(after.content.schedule);
    if (partsA.length) {
      const same = JSON.stringify(partsB) === JSON.stringify(partsA);
      tableRows.push({
        key: "schedule",
        label: "예상 일정",
        lines: [
          {
            key: "schedule",
            before: <ScheduleParts parts={partsB} />,
            after: <ScheduleParts parts={partsA} prev={partsB} mark />,
            changed: !same,
          },
        ],
      });
    }
    return (
      <DocLook.Provider value>
        <div className="flex flex-col gap-[12px]">
          {!changed.size && (
            <p className="text-sm font-medium text-gray-700">바꾼 항목이 없어요 — {roundLabel(before)} 내용 그대로예요.</p>
          )}
          <CompareTable rows={tableRows} beforeLabel={beforeLabel} afterLabel={afterLabel} />
        </div>
      </DocLook.Provider>
    );
  }
  return (
    <DocLook.Provider value={doc}>
      <div className="flex flex-col">
        {before && !changed.size && (
          <p className="py-[12px] text-sm font-medium text-gray-700">
            바꾼 항목이 없어요 — {roundLabel(before)} 내용 그대로예요.
          </p>
        )}
        {doc ? (
          <ul className="flex flex-col divide-y divide-gray-200 border-y border-gray-200 border-t-2 border-t-black">
            {rows}
            <DerivedRows before={before?.content ?? null} after={after.content} />
          </ul>
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-gray-100">{rows}</ul>
            <div className="pt-[16px]">
              <DerivedRows before={before?.content ?? null} after={after.content} />
            </div>
          </>
        )}
      </div>
    </DocLook.Provider>
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
  extra,
  changed,
  baseText,
  error,
  note,
  onNote,
  onReset,
  notePlaceholder = "수정 이유(선택) — 상대 화면에서 이 항목 아래에 보여요",
  children,
}: {
  label: string;
  notePlaceholder?: string;
  /** 이름표 바로 오른쪽에 붙는 것(진행 기간 달력의 고른 기간, 11-18). */
  extra?: ReactNode;
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
        {extra}
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
          placeholder={notePlaceholder}
          onChange={(e) => onNote(e.target.value)}
          className="w-full"
        />
      )}
    </div>
  );
}

/** 진행 기간 칸을 쓰는 쪽이 그릴 때 받는 값(PlanEditor renderPeriod). */
export interface PeriodEditorProps {
  start: string;
  end: string;
  invalid: boolean;
  onChange: (start: string, end: string) => void;
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
/**
 * 중간 보고 날 고르기(어드민, 2026-11-18 사용자: "콜라보 기간에 따라 달라질 수 있어서 언제 할지도 어드민에서 같이 선택").
 * 진행 기간의 날마다 "12.26 (토) · 진행 3일차". 비움(기본)이면 기간 50% 날이 골라져 보이고, 그날을 고르면 다시 비움
 * — 기간을 바꾸면 따라 움직인다. "기간의 50%" 글자는 따로 두지 않는다(11-26 사용자: "(기간의 50%) 없애줘").
 */
function MidReportSelect({
  start,
  end,
  value,
  invalid,
  onChange,
}: {
  start: string;
  end: string;
  value: string | null;
  invalid: boolean;
  onChange: (v: string | null) => void;
}) {
  const ok = !!start && !!end && end >= start;
  const days = ok ? Array.from({ length: periodDays(start, end) }, (_, i) => addDays(start, i)) : [];
  const half = ok ? checkpoints(start, end)[0] : null;
  return (
    <Select
      aria-label="중간 보고 날"
      variant="secondary"
      className="w-full max-w-[320px]"
      placeholder="진행 기간을 먼저 정해 주세요"
      isDisabled={!ok}
      isInvalid={invalid}
      selectedKey={value && days.includes(value) ? value : (half?.date ?? null)}
      onSelectionChange={(key) => {
        if (key == null) return;
        onChange(key === half?.date ? null : String(key));
      }}
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="max-h-[320px]">
        <ListBox>
          {days.map((d, i) => (
            <ListBox.Item key={d} id={d} textValue={mdw(d)}>
              {mdw(d)} · 진행 {i + 1}일차
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

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
  renderPeriod,
  requestDate,
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
  /**
   * 진행 기간 칸을 쓰는 쪽이 그린다 — 어드민은 의뢰서처럼 일정 달력에서 시작일 → 끝날을 눌러 고른다(2026-11-18 사용자).
   * 없으면 날짜 칸(DateRangePicker, 광고주 화면).
   */
  renderPeriod?: (p: PeriodEditorProps) => ReactNode;
  /** 처음 의뢰서를 낸 날(YYYY-MM-DD) — 예상 일정의 admix 검토 7영업일을 그날부터 센다(11-26 사용자). */
  requestDate?: string;
}) {
  const changed = useMemo(() => new Set(changedKeys(base, draft)), [base, draft]);
  // 어드민(첨부를 고칠 수 있는 쪽)은 안내 글을 줄인다(11-18 사용자: placeholder "(선택) 이후 문구는 다 지워줘"), 광고주 화면은 그대로.
  const admin = !!onUploadFile;
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
    // 중간 보고는 실제 날로 비교한다 — 지금 날이 고친 기간 안이면 그날로, 밖이면 비운다(50% 날).
    if (k === "midReport") {
      const was = midReportOf(base)?.date ?? null;
      return set({ midReport: was && was >= draft.startDate && was <= draft.endDate ? was : null });
    }
    if (k.startsWith("item:")) {
      const key = k.slice(5);
      const was = base.items.find((x) => x.key === key);
      const others = draft.items.filter((x) => x.key !== key);
      const items = was ? [...others, was] : others;
      return set({ items: BASE_ITEMS.flatMap((b) => items.filter((x) => x.key === b)) });
    }
    set({ [k]: base[k as keyof PlanContent] } as Partial<PlanContent>);
  };
  const row = (k: PlanFieldKey, label: string, editor: ReactNode, extra?: ReactNode) => (
    <EditRow
      key={k}
      label={label}
      extra={extra}
      changed={changed.has(k)}
      baseText={fieldText(base, k)}
      error={errors[k]}
      note={note(k)}
      onNote={setNote(k)}
      onReset={reset(k)}
      notePlaceholder={admin ? "수정 이유(선택)" : undefined}
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

  const d = derivedOf(draft, avg, undefined, requestDate);
  const b = derivedOf(base, avg, undefined, requestDate);
  // 진행 기간을 바꿔 고른 중간 보고 날이 기간 밖이 되면 비운다(다시 50% 날, 서버와 같은 규칙).
  const setPeriod = (startDate: string, endDate: string) =>
    set({
      startDate,
      endDate,
      ...(draft.midReport && (draft.midReport < startDate || draft.midReport > endDate) ? { midReport: null } : {}),
    });

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
      renderPeriod ? (
        renderPeriod({
          start: draft.startDate,
          end: draft.endDate,
          invalid: !!errors.period,
          onChange: setPeriod,
        })
      ) : (
      <div className="flex flex-wrap items-center gap-[10px]">
        <PeriodInput
          start={draft.startDate}
          end={draft.endDate}
          invalid={!!errors.period}
          onChange={setPeriod}
        />
        {draft.startDate && draft.endDate && (
          <span className="text-sm text-gray-600">총 {periodDays(draft.startDate, draft.endDate)}일</span>
        )}
      </div>
      ),
      // 달력으로 고를 땐 고른 기간을 이름표 오른쪽에(11-18 사용자: "진행 기간 타이틀 오른쪽에 배치").
      renderPeriod && (
        <span className={cn("text-sm font-medium", errors.period ? "text-danger" : "text-gray-700")}>
          {draft.startDate && draft.endDate
            ? `${mdw(draft.startDate)} ~ ${mdw(draft.endDate)} · 총 ${periodDays(draft.startDate, draft.endDate)}일`
            : "아직 고르지 않았어요."}
        </span>
      ),
    ),
    // 중간 보고 날 — 어드민만 고른다(2026-11-18 사용자). 광고주 고치기엔 줄이 없고, 비교 화면에서 보기만 한다.
    ...(admin
      ? [
          row(
            "midReport",
            "중간 보고",
            <MidReportSelect
              start={draft.startDate}
              end={draft.endDate}
              value={draft.midReport ?? null}
              invalid={!!errors.midReport}
              onChange={(midReport) => set({ midReport })}
            />,
          ),
        ]
      : []),
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
          // 어드민은 안내 글 없이(11-18 사용자: "Placeholder 없애줘"), 광고주 화면은 그대로.
          placeholder={admin ? undefined : "비워 둘 수 있어요"}
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
            <dd className="min-w-0 flex-1">
              <ScheduleParts parts={scheduleParts(d.schedule)} />
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
