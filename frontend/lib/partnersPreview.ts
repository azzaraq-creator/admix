/**
 * 제휴사(콜라보) 매장 화면 — 콜라보 모양 · 이름표 · 날짜 계산.
 * 2026-11-09부터 매장 콜라보는 서버 값이다(069, GET /partners/me/collabs — 같은 모양 PreviewCollab 으로 내려온다).
 * 광고주 화면(lib/advertiserPreview.ts)은 아직 예시 데이터라 PREVIEW_TODAY 와 날짜 도우미를 여기서 같이 쓴다.
 */

/** 광고주 예시 화면의 기준일 — 제휴사(매장) 화면은 todayKst()(실제 오늘)를 쓴다. */
export const PREVIEW_TODAY = "2026-11-06";

/** 오늘(KST) "YYYY-MM-DD" — 매장 화면의 단계(모집 중 · 예정 · 진행 중 · 완료)를 이 날짜로 나눈다. */
export const todayKst = () =>
  new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);

export type CollabType = "ready" | "made";
export type PhotoStep = "install" | "check1" | "check2" | "check3";
/** 이 매장의 입장 — 신청 전 · 선정 후보 · 예비 · 확정 요청 받음 · 확정 · 기간 겹침 · 미참여 · 광고주 취소. */
export type Standing =
  | "none"
  | "candidate"
  | "reserve"
  | "requested"
  | "confirmed"
  | "blocked"
  | "declined"
  | "cancelled";
/** 콜라보 목록의 칸 — 모집 중 · 예정(신청·확정, 설치 전) · 진행 중(설치~철수) · 완료. */
export const COLLAB_CATEGORIES = [
  "recruiting",
  "upcoming",
  "ongoing",
  "done",
] as const;
export type CollabCategory = (typeof COLLAB_CATEGORIES)[number];
export type Tone = "purple" | "blue" | "amber" | "green" | "gray" | "red";

export interface PreviewNotice {
  id: string;
  title: string;
  body: string;
  author: string;
  at: string;
}

export interface PreviewPhoto {
  step: PhotoStep;
  at: string;
  by: "admix" | "cafe";
  /** 올린 사진 주소(/uploads/collab/…) — mediaSrc 로 그린다. */
  thumb?: string | null;
}

export interface PreviewCollab {
  id: string;
  brand: string;
  /** 광고주 브랜드 사진(내 브랜드, advertiser_brands.image_url) — 없으면 기본 "C". 예시 데이터는 비워 둔다. */
  brandImage?: string | null;
  title: string;
  summary: string;
  type: CollabType;
  recruitStart: string;
  recruitEnd: string;
  /** 최종 확정 기한(KST 날짜·시각). */
  confirmDue: string;
  installDate: string;
  startDate: string;
  endDate: string;
  removalDate: string;
  /** 1~3차 점검일과 몇 일차인지. */
  checks: { step: Exclude<PhotoStep, "install">; date: string; day: number }[];
  task: string;
  items: { label: string; note: string }[];
  space: string;
  quantity: number;
  benefit: string;
  staffScript: string;
  targetStores: number;
  appliedStores: number;
  standing: Standing;
  /** 선정 후보 · 예비 순번. */
  slotNo?: number;
  confirmNo?: string;
  confirmedAt?: string;
  confirmer?: string;
  checkedItems?: number;
  notices: PreviewNotice[];
  photos: PreviewPhoto[];
  /** 재입고를 요청했는지(서버). */
  restockRequested?: boolean;
  /** 이 매장이 확인한 공지 id(서버). */
  readNoticeIds?: string[];
}

/** 매장 하나가 보는 콜라보 묶음 — 화면들이 같이 쓰는 모양. */
export interface PreviewState {
  collabs: PreviewCollab[];
  /** 확인한 공지 id. */
  reads: string[];
  /** 재입고를 요청한 콜라보 id. */
  restocks: string[];
}

export const TYPE_LABEL: Record<CollabType, string> = {
  ready: "준비형",
  made: "제작형",
};
export const STEP_LABEL: Record<PhotoStep, string> = {
  install: "설치 완료(게첨)",
  check1: "1차 점검",
  check2: "2차 점검",
  check3: "3차 점검",
};
export const CONFIRM_SENTENCE =
  "확정 즉시 브랜드사가 매장별 집행 물량을 확정하고 준비에 착수합니다.";

// ── 날짜 ─────────────────────────────────────────────

const toDate = (d: string) => new Date(`${d}T00:00:00Z`);
export const addDays = (d: string, n: number) => {
  const t = toDate(d);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
export const diffDays = (a: string, b: string) =>
  Math.round((toDate(a).getTime() - toDate(b).getTime()) / 86_400_000);
/** 11.06 */
export const md = (d: string) => d.slice(5, 10).replace("-", ".");
/** 2026.11.03 — 11.14 */
export const range = (a: string, b: string) =>
  `${a.replaceAll("-", ".")} — ${md(b)}`;
/** KST 날짜·시각 → ISO */
export const kst = (date: string, time = "09:00") =>
  new Date(`${date}T${time}:00+09:00`).toISOString();
/** ISO → "11.06 14:20"(KST) */
export const kstStamp = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 9 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
};
export const periodDays = (a: string, b: string) => diffDays(b, a) + 1;
/** 요일 한 글자 — "2026-11-05" → "목". */
export const dow = (d: string) =>
  "일월화수목금토"[toDate(d.slice(0, 10)).getUTCDay()];
/** 확정 일시 등 ISO → "2026.10.26 14:20"(KST, 연도까지). */
export const kstFullStamp = (iso: string) =>
  `${new Date(new Date(iso).getTime() + 9 * 3_600_000).getUTCFullYear()}.${kstStamp(iso)}`;

// ── 화면에서 쓰는 계산 ─────────────────────────────────

/** 목록 칸 — 미참여·취소, 마감했는데 신청 안 한 콜라보는 목록에 없다(참여 이력에만). */
export function categoryOf(
  c: PreviewCollab,
  today = todayKst(),
): CollabCategory | null {
  if (c.standing === "declined" || c.standing === "cancelled") return null;
  if (c.standing === "confirmed") {
    if (today > c.removalDate) return "done";
    if (today >= c.installDate) return "ongoing";
    return "upcoming";
  }
  if (["candidate", "reserve", "requested"].includes(c.standing))
    return "upcoming";
  return today <= c.recruitEnd ? "recruiting" : null;
}

/** 모집이 찼으면 예비(대기) 신청. */
export const isFull = (c: PreviewCollab) => c.appliedStores >= c.targetStores;

/**
 * 모집 중 콜라보에서 "이 매장이 지금 무엇을 할 수 있나" — 대시보드 · 콜라보 목록 카드가 같은 기준을 쓴다.
 *   open 신청 가능 · closing 3일 안 마감 · waitlist 목표 매장이 차서 대기 신청만 · blocked 기간이 겹쳐 신청 불가
 */
export type RecruitKind = "open" | "closing" | "waitlist" | "blocked";
export function recruitKindOf(
  c: PreviewCollab,
  today = todayKst(),
): RecruitKind {
  if (c.standing === "blocked") return "blocked";
  if (isFull(c)) return "waitlist";
  return diffDays(c.recruitEnd, today) <= 3 ? "closing" : "open";
}

/** 모집 상태 배지 글자. */
export function recruitBadgeOf(c: PreviewCollab, today = todayKst()) {
  const left = diffDays(c.recruitEnd, today);
  return {
    blocked: "신청 불가",
    waitlist: "대기 신청",
    closing: left === 0 ? "오늘 마감" : `마감 임박 D-${left}`,
    open: `모집 중 · D-${left}`,
  }[recruitKindOf(c, today)];
}

/** 카드·상세 위 상태 칩. */
export function chipOf(
  c: PreviewCollab,
  today = todayKst(),
): { label: string; tone: Tone } {
  const cat = categoryOf(c, today);
  switch (c.standing) {
    case "declined":
      return { label: "미참여", tone: "gray" };
    case "cancelled":
      return { label: "광고주 취소", tone: "red" };
    case "blocked":
      return { label: "기간이 겹쳐요", tone: "gray" };
    case "candidate":
      return { label: `신청함 · 후보 ${c.slotNo}번`, tone: "blue" };
    case "reserve":
      return { label: `대기 신청 · 예비 ${c.slotNo}번`, tone: "blue" };
    case "requested":
      return { label: "확정 요청 도착", tone: "amber" };
    case "confirmed":
      if (cat === "done") return { label: "완료", tone: "green" };
      if (cat === "ongoing") return { label: "진행 중", tone: "purple" };
      return { label: `확정 · 설치 ${md(c.installDate)}`, tone: "green" };
    default: {
      const left = diffDays(c.recruitEnd, today);
      return {
        label: isFull(c)
          ? "목표 매장 참 · 대기 신청"
          : `모집 중 · ${left === 0 ? "오늘 마감" : `D-${left}`}`,
        tone: "purple",
      };
    }
  }
}

/** 오늘 올려야 하는 점검 사진(가장 이른 것). */
export function dueStepOf(c: PreviewCollab, today = todayKst()) {
  if (c.standing !== "confirmed") return undefined;
  return c.checks.find(
    (k) => k.date <= today && !c.photos.some((p) => p.step === k.step),
  );
}

/** 다음 할 일 한 줄. */
export function nextActionOf(c: PreviewCollab, today = todayKst()) {
  const cat = categoryOf(c, today);
  const due = dueStepOf(c, today);
  if (due) return `${STEP_LABEL[due.step]} 사진을 올려 주세요`;
  switch (c.standing) {
    case "blocked":
      return "진행 중인 콜라보와 기간(설치~철수)이 겹쳐 신청할 수 없어요";
    case "candidate":
      return `모집 마감(${md(c.recruitEnd)}) 후 광고주가 검토하고 확정 요청을 드려요`;
    case "reserve":
      return "빠지는 매장이 생기면 순서대로 확정 요청을 드려요";
    case "requested":
      return `${kstStamp(c.confirmDue)}까지 진행 항목을 확인하고 최종 확정해 주세요`;
    case "declined":
      return "이번 콜라보에는 참여하지 않았어요";
    case "cancelled":
      return "광고주 사정으로 취소됐어요. 매장 책임은 없어요";
    case "confirmed":
      if (cat === "done") return "결과 보고서를 브랜드에 전달했어요";
      if (cat === "ongoing") {
        const next = c.checks.find((k) => k.date > today);
        return next
          ? `다음 점검 ${md(next.date)} · ${next.day}일차 사진`
          : `철수 ${md(c.removalDate)} · admix가 회수해요`;
      }
      return `설치 ${md(c.installDate)} · admix가 방문 세팅해요`;
    default:
      return isFull(c)
        ? "대기 신청하면 빠지는 매장이 생길 때 순서대로 연락드려요"
        : `${md(c.recruitEnd)}까지 선착순 신청`;
  }
}

/** 최종 확정 때 하나씩 확인하는 항목. */
export function confirmItemsOf(c: PreviewCollab) {
  return [
    {
      id: "period",
      label: "기간",
      value: `${range(c.startDate, c.endDate)} · 설치 ${md(c.installDate)} · 철수 ${md(c.removalDate)}`,
    },
    { id: "task", label: "해야 할 일", value: c.task },
    { id: "space", label: "사용 공간", value: c.space },
    {
      id: "quantity",
      label: "초기 수량",
      value: `${c.quantity.toLocaleString("ko-KR")}개 · 소진이 빠르면 admix가 재입고`,
    },
    {
      id: "report",
      label: "사진 보고",
      value: `${c.checks.map((k) => k.day).join("·")}일차에 남은 수량이 보이게 사진 한 장`,
    },
    {
      id: "benefit",
      label: "매장 혜택",
      value: `${c.benefit} · 콜라보 시작 전 지급`,
    },
    {
      id: "duty",
      label: "확정 후 책임",
      value: "확정 후 진행이 어려우면 금전 책임은 없지만 이후 매칭에 참고돼요",
    },
  ];
}

/** 참여 이력의 상태 — 확정된 콜라보 + 미참여 · 취소. */
export type HistoryStatus =
  "active" | "scheduled" | "completed" | "declined" | "cancelled";
export const HISTORY_LABEL: Record<HistoryStatus, string> = {
  active: "진행 중",
  scheduled: "진행 예정",
  completed: "완료",
  declined: "미참여",
  cancelled: "취소",
};
export const HISTORY_TONE: Record<HistoryStatus, Tone> = {
  active: "purple",
  scheduled: "blue",
  completed: "green",
  declined: "gray",
  cancelled: "red",
};
export function historyStatusOf(
  c: PreviewCollab,
  today = todayKst(),
): HistoryStatus | null {
  if (c.standing === "declined") return "declined";
  if (c.standing === "cancelled") return "cancelled";
  if (c.standing !== "confirmed") return null;
  const cat = categoryOf(c, today);
  return cat === "done"
    ? "completed"
    : cat === "ongoing"
      ? "active"
      : "scheduled";
}

/** 최근 활동 — 확정 · 설치 · 사진 · 공지를 시간 순으로. */
export function activityOf(state: PreviewState) {
  const out: {
    id: string;
    collabId: string;
    title: string;
    collab: string;
    at: string;
  }[] = [];
  for (const c of state.collabs) {
    const name = `${c.brand} ${c.title}`;
    if (c.confirmedAt)
      out.push({
        id: `${c.id}-cf`,
        collabId: c.id,
        title: "최종 확정",
        collab: name,
        at: c.confirmedAt,
      });
    for (const p of c.photos)
      out.push({
        id: `${c.id}-${p.step}`,
        collabId: c.id,
        title:
          p.step === "install"
            ? "설치 완료"
            : `${STEP_LABEL[p.step]} 사진 제출`,
        collab: name,
        at: p.at,
      });
    for (const n of c.notices)
      out.push({
        id: n.id,
        collabId: c.id,
        title: `공지 · ${n.title}`,
        collab: name,
        at: n.at,
      });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

/** 지금 확인할 일 — 점검 사진 · 확정 요청 · 안 읽은 공지. */
export function todosOf(state: PreviewState, today = todayKst()) {
  const todos: {
    id: string;
    collabId: string;
    kind: "photo" | "confirm" | "notice";
    title: string;
    detail: string;
  }[] = [];
  for (const c of state.collabs) {
    const due = dueStepOf(c, today);
    if (due && categoryOf(c, today) === "ongoing")
      todos.push({
        id: `photo-${c.id}`,
        collabId: c.id,
        kind: "photo",
        title: `${STEP_LABEL[due.step]} 사진을 올려 주세요`,
        detail: `${c.brand} ${c.title} · ${due.day}일차 남은 수량`,
      });
    if (c.standing === "requested")
      todos.push({
        id: `confirm-${c.id}`,
        collabId: c.id,
        kind: "confirm",
        title: "최종 확정 요청이 도착했어요",
        detail: `${c.brand} ${c.title} · ${kstStamp(c.confirmDue)}까지`,
      });
    const unread = c.notices.filter((n) => !state.reads.includes(n.id)).length;
    if (unread && c.standing === "confirmed")
      todos.push({
        id: `notice-${c.id}`,
        collabId: c.id,
        kind: "notice",
        title: `새 공지 ${unread}건`,
        detail: `${c.brand} ${c.title} · 진행 안내함에서 확인`,
      });
  }
  // 확정 요청은 기한이 있으니 맨 위 — 대시보드 "확정할 콜라보" 구역을 알림으로 옮겼다(2026-11-09 사용자).
  return todos.sort((a, b) => TODO_ORDER[a.kind] - TODO_ORDER[b.kind]);
}
const TODO_ORDER = { confirm: 0, photo: 1, notice: 2 } as const;
