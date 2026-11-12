/**
 * 콜라보 의뢰 기획안 차수(085, 2026-11-12 사용자) — 어드민 · 광고주 화면이 같이 쓰는 타입 · 비교 · 계산.
 *
 * 흐름: 광고주 의뢰서(0차) → admix가 항목별로 고쳐 보냄(proposed) ⇄ 광고주가 다시 고쳐 보냄(revised) → 광고주 확정(confirmed).
 * 서버(collab_request_service)가 차수마다 내용 전부를 쌓고, 화면은 "상대가 마지막으로 보낸 차수(수정 전)"와
 * "마지막 차수(수정 후)"를 항목별로 나란히 보여 준다. 항목 키 · 비교 규칙은 서버 FIELD_KEYS · _field_value 와 같다.
 */
import {
  COURSE,
  ITEM_LABEL,
  MAKE_DAYS,
  MIN_PREP_DAYS,
  PREP_LABEL,
  PREP_OF,
  estimateOf,
  estimateText,
  makeItems,
  mdw,
  requestPlanPreviewOf,
  typeOfPrep,
  type AdvCollab,
  type BaseItem,
  type PrepKey,
  type StoreRef,
} from "@/lib/advertiserPreview";
import type { CollabGrade, PartnersStore } from "@/lib/partners";
import { PREVIEW_TODAY, addDays, periodDays } from "@/lib/partnersPreview";

// ── 서버 모양 ─────────────────────────────────────────────────────────

export interface PlanItem {
  key: string;
  prep: PrepKey;
  note: string;
}

/** 지정 희망 매장 — 차수에 넣은 그때 이름 · 지역 · 등급 · 금액. */
export interface PlanStore {
  id: string;
  code?: string | null;
  name: string;
  area: string;
  grade: string | null;
  fee: number | null;
}

export interface PlanEstimate {
  total?: number;
  preferred?: number;
  rest?: number;
  avg?: number;
  negotiable?: number;
}

/**
 * 추가 기획 첨부(2026-11-12 사용자: "어드민도 파일을 첨부할 수 있게") — id "request" 는 광고주가 의뢰서에 붙인 파일(0차부터),
 * 나머지는 admix 가 기획안에 붙인 파일(먼저 올려 두고 보낼 때 차수에 넣는다). 광고주는 기획안에서 첨부를 바꾸지 않는다.
 */
export interface PlanFile {
  id: string;
  name: string;
  size: number | null;
  by: PlanAuthor;
}

/** 기획안 첨부 — 의뢰서 첨부와 같은 확장자 · 20MB, 차수 하나에 10개까지. */
export const PLAN_FILE_ACCEPT = ".pdf,.ppt,.pptx,.key,.doc,.docx,.hwp,.hwpx,.xls,.xlsx,.zip,image/*";
export const PLAN_FILE_MAX = 20 * 1024 * 1024;
export const PLAN_FILE_MAX_COUNT = 10;

/** 한 차수의 고칠 수 있는 내용 전부(회사 · 담당자 · 남긴 말은 의뢰서 그대로). */
export interface PlanContent {
  title: string;
  summary: string | null;
  startDate: string;
  endDate: string;
  course: string;
  minStores: number;
  targetStores: number;
  items: PlanItem[];
  extraPlan: string | null;
  /** 추가 기획 첨부 — 서버가 늘 채워 준다(첨부 전 옛 차수는 앞 차수 목록을 이어받는다). */
  files?: PlanFile[];
  preferred: PlanStore[];
  estimate: PlanEstimate | null;
  schedule: Record<string, string | number | boolean> | null;
}

export type PlanAuthor = "admix" | "advertiser";

export interface PlanRound {
  round: number;
  author: PlanAuthor;
  baseRound: number;
  content: PlanContent;
  /** 항목별 수정 이유 {항목 키: 글}. */
  notes: Record<string, string>;
  changed: string[];
  createdAt: string;
}

/** 의뢰 응답에 붙는 기획안 — 0차(처음 의뢰서) · 차수들 · 확정한 때. */
export interface PlanBlock {
  original: PlanContent;
  rounds: PlanRound[];
  confirmedAt: string | null;
}

/** 의뢰 상태 — submitted(접수) · proposed(admix 기획안 보냄) · revised(광고주가 고쳐 보냄) · confirmed · cancelled. */
export type CollabRequestStatus = "submitted" | "proposed" | "revised" | "confirmed" | "cancelled";

/** 차수 보내기 — 서버 PlanRoundIn. */
export interface PlanRoundPayload {
  content: Omit<PlanContent, "preferred"> & { preferredIds: string[] };
  notes: Record<string, string>;
  baseRound: number;
}

// ── 항목 ─────────────────────────────────────────────────────────────

export const BASE_ITEMS = Object.keys(ITEM_LABEL) as BaseItem[];

export type PlanFieldKey =
  | "title"
  | "summary"
  | "period"
  | "course"
  | "stores"
  | `item:${BaseItem}`
  | "extraPlan"
  | "preferred";

export const itemKey = (k: BaseItem): PlanFieldKey => `item:${k}`;

/** 화면 순서 — 의뢰서 칸 순서와 같다. 기본안은 6가지가 각각 한 항목. */
export const PLAN_FIELDS: { key: PlanFieldKey; label: string }[] = [
  { key: "title", label: "캠페인명" },
  { key: "summary", label: "한 줄 소개" },
  { key: "period", label: "진행 기간" },
  { key: "course", label: "모집 코스" },
  { key: "stores", label: "매장 수" },
  ...BASE_ITEMS.map((k) => ({ key: itemKey(k), label: `기본안 · ${ITEM_LABEL[k]}` })),
  { key: "extraPlan", label: "추가 기획" },
  { key: "preferred", label: "지정 희망 매장" },
];

export const fieldLabel = (k: string) => PLAN_FIELDS.find((f) => f.key === k)?.label ?? k;

const itemOf = (c: PlanContent, k: BaseItem) => c.items.find((x) => x.key === k);
export const filesOf = (c: PlanContent | null | undefined): PlanFile[] => c?.files ?? [];
const blank = (v: string | null | undefined) => (v ?? "").trim();

/** 항목 하나의 비교 값(문자열) — 빈 글자와 없음은 같게 본다. 서버 _field_value 와 같은 규칙. */
export function fieldValue(c: PlanContent, k: PlanFieldKey): string {
  switch (k) {
    case "title":
    case "summary":
      return blank(c[k]);
    case "extraPlan":
      // 추가 기획 = 글 + 첨부 — 파일을 붙이거나 빼도 이 항목이 '수정'(서버와 같다).
      return `${blank(c.extraPlan)}|${filesOf(c)
        .map((f) => f.id)
        .join(",")}`;
    case "course":
      return c.course;
    case "period":
      return `${c.startDate}~${c.endDate}`;
    case "stores":
      return `${c.minStores}/${c.targetStores}`;
    case "preferred":
      return c.preferred.map((p) => p.id).join(",");
    default: {
      const row = itemOf(c, k.slice(5) as BaseItem);
      return row ? `${row.prep}|${blank(row.note)}` : "";
    }
  }
}

export const changedKeys = (a: PlanContent, b: PlanContent): PlanFieldKey[] =>
  PLAN_FIELDS.map((f) => f.key).filter((k) => fieldValue(a, k) !== fieldValue(b, k));

/** 두 차수 어느 쪽에도 없는 기본안은 줄로 보이지 않는다. */
export function shownFields(...cs: (PlanContent | null | undefined)[]) {
  return PLAN_FIELDS.filter((f) => {
    if (!f.key.startsWith("item:")) return true;
    const k = f.key.slice(5) as BaseItem;
    return cs.some((c) => c && itemOf(c, k));
  });
}

// ── 차수 ─────────────────────────────────────────────────────────────

export interface PlanVersion {
  round: number;
  author: PlanAuthor;
  content: PlanContent;
  notes: Record<string, string>;
  createdAt?: string;
}

export function versionsOf(b: PlanBlock, requestedAt?: string): PlanVersion[] {
  return [
    { round: 0, author: "advertiser", content: b.original, notes: {}, createdAt: requestedAt },
    ...b.rounds.map((r) => ({
      round: r.round,
      author: r.author,
      content: r.content,
      notes: r.notes ?? {},
      createdAt: r.createdAt,
    })),
  ];
}

/**
 * 지금 펼쳐 볼 비교 — 마지막 차수(after)와 상대가 마지막으로 보낸 차수(before).
 * 같은 쪽이 잇달아 보냈으면(admix가 다시 고쳐 보냄) 그 사이 수정 이유를 모두 합친다(나중 글이 이긴다).
 */
export function compareOf(b: PlanBlock, requestedAt?: string) {
  const versions = versionsOf(b, requestedAt);
  const after = versions[versions.length - 1];
  let i = versions.length - 2;
  while (i >= 0 && versions[i].author === after.author) i--;
  const before = i >= 0 ? versions[i] : null;
  const notes: Record<string, string> = {};
  for (const v of versions.slice(i + 1)) Object.assign(notes, v.notes);
  const changed = before ? changedKeys(before.content, after.content) : [];
  return { versions, before, after, notes, changed };
}

export const latestRound = (b: PlanBlock) => b.rounds[b.rounds.length - 1]?.round ?? 0;
export const latestContent = (b: PlanBlock) => b.rounds[b.rounds.length - 1]?.content ?? b.original;

export const AUTHOR_LABEL: Record<PlanAuthor, string> = { admix: "admix", advertiser: "광고주" };

/**
 * 화면 차수 번호 — 광고주가 처음 보낸 의뢰서(서버 0차)가 "1차", 그다음부터 하나씩(2026-11-12 사용자: "처음이 아니라
 * 1차 의뢰서로 해서 n차로"). 서버 · 저장 값은 그대로 0부터.
 */
export const roundNo = (round: number) => round + 1;

/** 차수 이름 — 1차 의뢰서 · 2차 · admix · 3차 · 광고주 …(광고주 화면도 같다). */
export const roundLabel = (v: Pick<PlanVersion, "round" | "author">) =>
  v.round === 0 ? "1차 의뢰서" : `${roundNo(v.round)}차 · ${AUTHOR_LABEL[v.author]}`;

// ── 보이는 글 ────────────────────────────────────────────────────────

const dot = (d: string) => d.replace(/-/g, ".");

export function courseText(course: string) {
  const c = COURSE[course === "rush" ? "rush" : "standard"];
  return `모집 ${c.label} (${c.detail})`;
}

export function storeText(p: PlanStore) {
  return [p.name, p.area].filter(Boolean).join(" · ");
}

/** 항목 값 글 — 비교 칸에 그대로 쓴다. 기본안이 없으면 "넣지 않음". */
export function fieldText(c: PlanContent, k: PlanFieldKey): string {
  switch (k) {
    case "title":
      return c.title || "-";
    case "summary":
      return blank(c.summary) || "-";
    case "extraPlan":
      // 글 없이 첨부만 있으면 글 칸은 비우고 아래 파일 줄만 보인다.
      return blank(c.extraPlan) || (filesOf(c).length ? "" : "-");
    case "course":
      return courseText(c.course);
    case "period":
      return c.startDate && c.endDate
        ? `${dot(c.startDate)} ~ ${dot(c.endDate)} · 총 ${periodDays(c.startDate, c.endDate)}일`
        : "-";
    case "stores":
      return `최소 ${c.minStores}곳 · 목표 ${c.targetStores}곳`;
    case "preferred":
      return c.preferred.length ? c.preferred.map((p) => p.name).join(", ") : "없음";
    default: {
      const row = itemOf(c, k.slice(5) as BaseItem);
      return row ? `${PREP_LABEL[row.prep] ?? row.prep} · ${blank(row.note) || "-"}` : "넣지 않음";
    }
  }
}

// ── 예상 비용 · 일정 ─────────────────────────────────────────────────

const refOf = (p: PlanStore): StoreRef => ({
  id: p.id,
  name: p.name,
  area: p.area,
  grade: (p.grade as CollabGrade | null) ?? null,
  fee: p.fee,
});

/** 매장 찾기 · 어드민 매장 → 지정 희망 매장 칸. */
export function planStoreOf(s: PartnersStore & { storeCode?: string | null }): PlanStore {
  return {
    id: s.id,
    code: s.storeCode ?? null,
    name: s.name,
    area: [s.city, s.district].filter(Boolean).join(" ") || s.address || "",
    grade: s.collabGrade ?? null,
    fee: s.collabFee ?? null,
  };
}

/** 일정 계산용 — 의뢰서 · 내 콜라보(collabOfRequest)와 같은 준비 기간 규칙. */
function scheduleInputOf(c: PlanContent): Parameters<typeof requestPlanPreviewOf>[0] {
  const rows = c.items.filter((x) => Object.hasOwn(ITEM_LABEL, x.key));
  const items = rows.map((x) => x.key as BaseItem);
  const itemPrep = Object.fromEntries(rows.map((x) => [x.key, PREP_OF[x.prep] ?? PREP_OF.ready])) as AdvCollab["itemPrep"];
  return {
    type: typeOfPrep(items, itemPrep),
    course: c.course === "rush" ? "rush" : "standard",
    startDate: c.startDate,
    endDate: c.endDate,
    prepDays: makeItems({ items, itemPrep }).length ? MAKE_DAYS : MIN_PREP_DAYS,
    targetStores: c.targetStores,
    items,
    itemPrep,
  };
}

/**
 * 고친 내용으로 예상 비용 · 일정을 다시 계산 — 의뢰서와 같은 계산(나머지 매장은 평균 금액 avg, 오늘 보내면 기준).
 * 보낼 때 이 값을 차수에 함께 적는다(참고용).
 */
export function derivedOf(c: PlanContent, avg: number, today = PREVIEW_TODAY) {
  const est = estimateOf(c.preferred.map(refOf), c.targetStores, avg);
  const plan = requestPlanPreviewOf(scheduleInputOf(c), today);
  const { s } = plan;
  return {
    estimate: { total: est.total, preferred: est.preferred, rest: est.rest, avg: est.avg, negotiable: est.negotiable },
    schedule: {
      requestDate: today,
      reviewEnd: addDays(s.noticeDate, -1),
      noticeDate: s.noticeDate,
      recruitEnd: s.recruitEnd,
      confirmDue: s.confirmDue,
      installStart: s.installStart,
      installDays: s.installDays,
      startDate: s.startDate,
      endDate: s.endDate,
      removalDate: s.removalDate,
      prepBusinessDays: Math.max(0, plan.prep),
      makeItems: plan.make,
    },
    tooSoon: plan.tooSoon,
    earliest: plan.earliest,
    tight: plan.tight,
    makeReady: plan.makeReady,
  };
}

/** 예상 비용 글 — 차수에 적힌 값으로. */
export function estimateLine(c: PlanContent) {
  const e = c.estimate;
  if (!e || e.total == null) return "-";
  return estimateText(e.total, e.negotiable ?? 0);
}

/** 예상 일정 한 줄 — 모집 공지 · 설치 · 진행 · 철수(차수에 적힌 값). */
export function scheduleLine(c: PlanContent) {
  const s = c.schedule ?? {};
  const d = (k: string) => (typeof s[k] === "string" ? mdw(s[k] as string) : null);
  return [
    d("noticeDate") && `모집 공지 ${d("noticeDate")}`,
    d("installStart") && `설치 ${d("installStart")}`,
    d("removalDate") && `철수 ${d("removalDate")}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** 보낼 값 — 지정 희망 매장은 id 만, 예상 비용 · 일정은 다시 계산한 값. */
export function roundPayloadOf(
  draft: PlanContent,
  notes: Record<string, string>,
  baseRound: number,
  avg: number,
): PlanRoundPayload {
  const { preferred, ...rest } = draft;
  const d = derivedOf(draft, avg);
  const keep = Object.fromEntries(
    Object.entries(notes)
      .map(([k, v]) => [k, v.trim()] as const)
      .filter(([, v]) => v),
  );
  return {
    content: {
      ...rest,
      title: draft.title.trim(),
      summary: blank(draft.summary) || null,
      extraPlan: blank(draft.extraPlan) || null,
      items: draft.items.map((x) => ({ ...x, note: x.note.trim() })),
      preferredIds: preferred.map((p) => p.id),
      estimate: d.estimate,
      schedule: d.schedule,
    },
    notes: keep,
    baseRound,
  };
}

/** 나머지 매장 평균 금액 — 마지막 차수에 적힌 값(바뀌면 비교가 흔들리지 않게), 없으면 매장 목록 평균. */
export function planAvgOf(b: PlanBlock, fallback: number) {
  return latestContent(b).estimate?.avg || b.original.estimate?.avg || fallback;
}

/** 보내기 전 검사 — 서버와 같은 규칙. 오류가 있는 항목 키 → 글. */
export function planErrorsOf(c: PlanContent, before: PlanContent): Partial<Record<PlanFieldKey, string>> {
  const e: Partial<Record<PlanFieldKey, string>> = {};
  if (!c.title.trim()) e.title = "캠페인명을 적어 주세요.";
  else if (c.title.trim().length > 30) e.title = "캠페인명은 30자까지예요.";
  if (blank(c.summary).length > 100) e.summary = "한 줄 소개는 100자까지예요.";
  if (!c.startDate || !c.endDate) e.period = "진행 기간을 골라 주세요.";
  else if (fieldValue(c, "period") !== fieldValue(before, "period") && c.startDate <= PREVIEW_TODAY)
    e.period = "시작일은 내일부터 고를 수 있어요.";
  else if (c.endDate < c.startDate || periodDays(c.startDate, c.endDate) < 3) e.period = "진행 기간은 최소 3일이에요.";
  if (c.minStores < 1 || c.targetStores < c.minStores)
    e.stores = "최소 매장 수는 1곳 이상, 목표는 최소보다 같거나 많아야 해요.";
  else if (c.preferred.length > c.targetStores) e.preferred = `지정 희망 매장(${c.preferred.length}곳)보다 목표가 적어요.`;
  if (!c.items.length) e[itemKey(BASE_ITEMS[0])] = "콜라보 기본안을 하나 이상 넣어 주세요.";
  for (const x of c.items) if (!x.note.trim()) e[itemKey(x.key as BaseItem)] = "조건을 적어 주세요.";
  if (blank(c.extraPlan).length > 1000) e.extraPlan = "추가 기획은 1000자까지예요.";
  return e;
}
