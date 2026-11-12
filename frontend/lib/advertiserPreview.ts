/**
 * 광고주 콜라보 화면 — 운영 규칙 + 예시 데이터.
 *
 * 받은 프로토타입(카페 콜라보 미리보기 lib/partners/collab.ts · advertiserView.ts, 운영안 10/22 · 10/29)의 규칙을
 * 광고주에게 필요한 만큼 옮겼다. 부수효과 없는 함수만 둔다 — 서버로 옮길 때 같은 계산을 쓴다.
 *
 * 흐름: 매장 담기(지정 희망) → 의뢰 → admix 검토 · 승인 → 모집 공지 → 매장 선착순 신청(목표를 넘으면 예비 순번)
 *   → 마감 후 광고주 검토(제외 요청 · 예비 매장 미리 승인 · 미달이면 진행 방법) → 매장 최종 확정
 *   → 광고주 진행 확정 = 계산서 발행(확정 매장 금액 합계) → 영업일 5일 안 입금(넘기면 위약금) → 준비 · 설치(5곳당 1일)
 *   → 진행(30 · 50 · 70% 중간 보고) → 철수 · 결과 보고서.
 *
 * 2026-11-09 사용자 결정: 매장 찾기 · 담기 · 예상 비용은 실제 매장(등급 · 금액, 마이그레이션 067).
 * 모집 이후(신청 매장 · 확정 · 계산서 · 보고서)는 아래 예시 매장으로 그린다. 누른 결과는 이 탭(sessionStorage)에만 남는다.
 */

import type { CollabRequestStatus, PlanBlock } from "@/lib/collabPlan";
import { isHoliday } from "@/lib/krHolidays";
import {
  COLLAB_GRADE_FEE,
  wonLabel,
  type CollabGrade,
  type CollabRequestMine,
  type PartnersStore,
} from "@/lib/partners";
import {
  PREVIEW_TODAY,
  addDays,
  diffDays,
  kst,
  kstStamp,
  periodDays,
  type Tone,
} from "@/lib/partnersPreview";

export { PREVIEW_TODAY };

// ── 이름표 ───────────────────────────────────────────────────────────

export type CollabType = "ready" | "made";
/** 모집 코스(11-11 사용자) — 14일(모집 10 + 검토 3 + 확정 1) · 7일(모집 5 + 검토 1 + 확정 1). 화면엔 "기본 · 급건" 없이 일수만. */
export type Course = "standard" | "rush";
/** 콜라보 구성(11-10 사용자: 진행물 → 콜라보 구성, 6가지). */
export type BaseItem = "promo" | "consumable" | "goods" | "display" | "menu" | "space";
export type ExtraKind = "sns" | "staff";

export const COURSE = {
  standard: {
    label: "14일",
    detail: "모집 10 + 검토 3 + 확정 1",
    total: 14,
    recruit: 10,
    review: 3,
    confirmHours: 24,
  },
  rush: {
    label: "7일",
    detail: "모집 5 + 검토 1 + 확정 1",
    total: 7,
    recruit: 5,
    review: 1,
    confirmHours: 24,
  },
} as const;

export const TYPE_LABEL: Record<CollabType, string> = {
  ready: "준비형",
  made: "제작형",
};
/**
 * 기본안 하나의 준비 상태(11-11) — 준비돼 있음 / 직접 제작 예정 / admix에 제작을 맡김.
 * 예전 콜라보 전체 "유형"(준비형 · 제작형)을 기본안마다 고르게 바꿨다. 콜라보 type 은 여기서 계산한다(하나라도 제작이면 제작형).
 * 화면엔 처음부터 세 칩이 나란히 — admix 제작은 "제작 예정" 아래 버튼이 아니라 같은 줄 선택지(11-11 사용자).
 */
export type ItemPrep = { make: boolean; byAdmix?: boolean };
/** 콜라보 담당자 — 전화번호는 숫자만. same 이면 브랜드 담당자(없으면 계정 담당자)로 채운 것(11-11 사용자). */
export interface CollabContact {
  same: boolean;
  name: string;
  phone: string;
  /** 직책 또는 소속팀. */
  role: string;
}
export type PrepKey = "ready" | "made" | "admix";
export const PREP_KEYS: PrepKey[] = ["ready", "made", "admix"];
export const PREP_LABEL: Record<PrepKey, string> = {
  ready: "준비되어 있어요",
  made: "제작 예정이에요",
  admix: "admix에 제작을 맡길게요",
};
export const PREP_OF: Record<PrepKey, ItemPrep> = {
  ready: { make: false },
  made: { make: true, byAdmix: false },
  admix: { make: true, byAdmix: true },
};
export const prepKeyOf = (p?: ItemPrep): PrepKey | null => (!p ? null : !p.make ? "ready" : p.byAdmix ? "admix" : "made");
export const typeOfPrep = (items: BaseItem[], prep: AdvCollab["itemPrep"]): CollabType =>
  items.some((i) => prep?.[i]?.make) ? "made" : "ready";
/** admix에 제작 대행을 맡긴 기본안. */
export const admixMakeItems = (c: Pick<AdvCollab, "items" | "itemPrep">) =>
  c.items.filter((i) => c.itemPrep?.[i]?.make && c.itemPrep[i]?.byAdmix);
/** 제작하는 기본안 — 직접 제작 + admix 제작 대행. 둘 다 제작 기간을 MAKE_DAYS 로 잡는다. */
export const makeItems = (c: Pick<AdvCollab, "items" | "itemPrep">) => c.items.filter((i) => c.itemPrep?.[i]?.make);
export const ITEM_LABEL: Record<BaseItem, string> = {
  promo: "브랜딩 홍보물",
  consumable: "브랜딩 소모품",
  goods: "브랜드 굿즈",
  display: "DP 및 체험",
  menu: "협업 메뉴",
  space: "공간 연출",
};
/** 기본안마다 조건 예시 — 의뢰서 "조건" 칸(예) …)과 기획안 고치기 칸(조건(예: …))이 같이 쓴다(11-12 사용자: "항목에 맞게"). */
export const ITEM_EXAMPLE: Record<BaseItem, string> = {
  promo: "계산대 옆 A4 포스터 1장",
  consumable: "컵홀더 · 스티커를 음료 전체에 사용",
  goods: "구매 시 증정 · 1인 1개 · 상온 보관",
  display: "진열대 1개 · 제품 3종 · 시향 가능",
  menu: "브랜드 시럽 시즌 음료 1종 · 레시피 제공",
  space: "창가 쪽 브랜드존 1곳 · 소품 설치",
};
export const ITEM_HINT: Record<BaseItem, string> = {
  promo: "포스터, 배너, 소형 출력물 등",
  consumable: "컵홀더, 컵받침, 스티커 등",
  goods: "사은품, 샘플",
  display: "제품 진열, 체험",
  menu: "한정 메뉴, 패키지",
  space: "브랜드존, 소규모 팝업",
};
export const EXTRA_LABEL: Record<ExtraKind, string> = {
  sns: "SNS 인증 이벤트",
  staff: "현장 인력 추가",
};

/**
 * 의뢰 뒤 admix 검토(영업일 5일) + 연락(2일 안) — 영업일 7일로 잡는다(11-11 사용자).
 * 의뢰한 날은 "의뢰일"로 따로 두고 검토는 다음 날부터 센다(11-11 사용자: "당일을 검토에 넣으면 어떡해").
 * 검토가 끝나 확정되면 그다음 날부터 모집 공지가 나갈 수 있다. 의뢰서의 "총 준비 기간" · 가장 빠른 시작일에 쓴다.
 */
export const ADMIX_REVIEW_DAYS = 7;
/**
 * 제작 기간 — 품목과 상관없이 약 30일(영업일). admix 제작 대행이든 직접 제작("제작 예정이에요")이든 같다(11-11 사용자).
 * 일정에 30일을 잡아 주는 값이 아니다(11-12 사용자: "우리만의 계산이라 빠듯할 수 있다고 하면서 다른 날짜를 권하려는 것,
 * 준비일을 30일 준다는 게 아니야") — 의뢰서에서 매장 확정 뒤 준비 영업일이 이보다 짧으면 "빠듯해요"와 권하는 시작일만 보인다.
 */
export const MAKE_DAYS = 30;
/**
 * 진행 확정 뒤 입금 기한 — 영업일 5일(11-11 사용자, 넘기면 위약금) · 취소 시 50% 환불 기간(일).
 * 영업일은 월~금에서 공휴일(krHolidays)을 뺀 날.
 */
export const PAYMENT_DAYS = 5;
export const CANCEL_HALF_REFUND_DAYS = 7;
/** 설치: 매장 5곳당 1일, 시작 전날까지. */
export const STORES_PER_INSTALL_DAY = 5;
/** 중간 보고: 진행 기간의 30 · 50 · 70% 시점. */
export const CHECK_POINTS = [0.3, 0.5, 0.7] as const;

// ── 매장 ─────────────────────────────────────────────────────────────

/**
 * 화면에 보일 만큼만 붙여 둔 매장 정보 — 담은 매장 · 지정 희망 매장(실제 매장)과 신청 매장(예시 매장)이 같이 쓴다.
 * fee 가 없으면 "금액 협의"(admix가 아직 금액을 정하지 않은 매장).
 */
export interface StoreRef {
  id: string;
  name: string;
  /** 동네 · 구 — "서울 성동구" 처럼 짧게. */
  area: string;
  grade: CollabGrade | null;
  fee: number | null;
  image?: string | null;
  /** 예시 매장만 — 공간 · 분위기 칩. */
  spaces?: string[];
  tags?: string[];
  /** 예시 매장만 — 하루 영수증 수(예상 소진율 계산용, 광고주에게 숫자는 보이지 않는다). */
  dailyReceipts?: number;
  /** 예시 매장만 — 다른 브랜드 콜라보로 잡힌 기간(설치 ~ 철수). 1매장 1진행 · 일정 조정 확인용. */
  busy?: { from: string; to: string }[];
}

/** 실제 매장(매장 찾기 API) → 담기 칸. */
export function refOfStore(s: PartnersStore): StoreRef {
  return {
    id: s.id,
    name: s.name,
    area: [s.city, s.district].filter(Boolean).join(" ") || s.address,
    grade: s.collabGrade ?? null,
    fee: s.collabFee ?? null,
    image: s.imageUrls[0] ?? null,
    tags: s.tags,
  };
}

/** 예시 매장 — 모집 이후 신청 · 확정 · 보고서에만 쓴다(실제 매장 아님). */
const AREAS = [
  "성수", "연남", "망원", "합정", "을지로", "문래", "송리단길", "해방촌", "삼청", "신사", "압구정", "도산",
  "이태원", "상수", "계동", "후암", "신당", "용리단길", "연희", "부암", "익선", "한남", "서촌",
];
const SPACES = [
  ["계산대 옆 선반", "창가 선반"],
  ["카운터 옆 진열대", "입구 쪽 벽면"],
  ["쇼케이스 하단", "테이블 사이 선반"],
  ["창가 선반", "포스터 벽면"],
];
const TAGS = [
  ["좌석 넓음", "작업하기 좋은"],
  ["감성 인테리어", "사진 명소"],
  ["디저트 강점", "주말 웨이팅"],
  ["조용한", "단골 많음"],
  ["루프탑", "반려동물 동반"],
];
const RECEIPTS = [140, 95, 210, 130, 160, 110, 175, 125, 190, 100, 145, 165, 115, 200, 135, 155, 105, 185, 120, 170];
const gradeOf = (i: number): CollabGrade =>
  [11, 28].includes(i) ? "S" : i % 5 === 0 ? "A" : i % 7 === 3 ? "C" : "B";
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const EXAMPLE_STORES: StoreRef[] = (() => {
  const series: [string, number][] = [
    ["예시 카페", 26],
    ["예시 베이커리", 14],
  ];
  const out: StoreRef[] = [];
  let i = 0;
  for (const [prefix, count] of series) {
    for (let k = 0; k < count; k++, i++) {
      const grade = gradeOf(i);
      out.push({
        id: `x${String(i + 1).padStart(2, "0")}`,
        name: `${prefix} ${LETTERS[k]}`,
        area: i === 0 ? "성수" : i === 1 ? "연남" : i === 2 ? "망원" : AREAS[(i * 7) % AREAS.length],
        grade,
        fee: i === 0 ? 1_600_000 : COLLAB_GRADE_FEE[grade],
        spaces: SPACES[i % SPACES.length],
        tags: TAGS[i % TAGS.length],
        dailyReceipts: RECEIPTS[i % RECEIPTS.length],
        // 예시 카페 Q — 브랜드 A 철수(기준일 +18일) 8일 뒤부터 다른 브랜드 콜라보. A 일정을 8일 넘게 미루면 조정할 수 없다.
        busy: i === 16 ? [{ from: addDays(PREVIEW_TODAY, 26), to: addDays(PREVIEW_TODAY, 40) }] : undefined,
      });
    }
  }
  return out;
})();
const exampleIds = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, k) => `x${String(from + k).padStart(2, "0")}`);
const exampleOf = (id: string) => EXAMPLE_STORES.find((s) => s.id === id);

/** 매장 금액(1건) — 정해지지 않았으면 0(합계에서 빠진다). */
export const feeOf = (s: Pick<StoreRef, "fee"> | undefined | null) => s?.fee ?? 0;

/** 금액 평균(만 원 반올림) — 예상 비용 "나머지 × 평균"에 쓴다. 금액이 정해진 매장이 없으면 예시 매장 평균. */
export function averageFee(stores: Pick<StoreRef, "fee">[]): number {
  const priced = stores.filter((s) => (s.fee ?? 0) > 0);
  const base = priced.length ? priced : EXAMPLE_STORES;
  return Math.round(base.reduce((a, s) => a + feeOf(s), 0) / base.length / 10_000) * 10_000;
}

// ── 콜라보 ───────────────────────────────────────────────────────────

export type PlanStatus = "requested" | "returned" | "approved" | "cancelled";
export type EntryStatus =
  | "applied"
  | "requested"
  | "confirmed"
  | "excluded"
  | "expired"
  | "withdrawn"
  | "cancelled";

/** 신청 매장 한 곳. */
export interface Entry {
  storeId: string;
  appliedAt: string;
  status: EntryStatus;
  requestedAt?: string;
  confirmedAt?: string;
  confirmNo?: string;
  closedAt?: string;
  closedReason?: string;
}

/** 진행 확정 → 계산서 → 입금(영업일 5일) · 취소. */
export interface Billing {
  confirmedAt: string;
  invoiceNo: string;
  /** 확정 매장 금액 합계(원) · 매장 수. */
  amount: number;
  stores: number;
  dueAt: string;
  paidAt?: string;
  cancelledAt?: string;
  /** 취소 때 환불액 — 7일 안이면 50%, 넘으면 admix와 협의(undefined). */
  refund?: number;
}

/** 일정 조정 요청 — 확정 매장 모두 확인해야 바뀌고, 바뀐 기간에 다른 콜라보가 있는 매장이 있으면 불가. */
export interface DelayRequest {
  requestedAt: string;
  fromStart: string;
  newStart: string;
  days: number;
  status: "blocked" | "pending" | "applied";
  blockers: string[];
  confirmed: string[];
  appliedAt?: string;
}

/** 매장 변동 — 확정 매장이 진행하지 못해 예비 매장으로 바꾼 기록(매장에 금전 책임은 없다). */
export interface StoreChange {
  id: string;
  storeId: string;
  at: string;
  timing: string;
  reason: string;
  replacement?: string;
}

/** 보고서 재료(예시) — 매장별 남은 수량(1 · 2 · 3차 점검)과 재입고 · 회수 수량. */
export interface StoreReport {
  storeId: string;
  installAt?: string;
  remaining: (number | null)[];
  restock?: number;
  collected?: number;
}

export interface AdvCollab {
  id: string;
  brand: string;
  /** 내 브랜드 id(068) — 브랜드 전환(사이드바)으로 거를 때 쓴다. 예전에 이 탭에 저장한 의뢰는 없어서 이름(brand)으로 견준다. */
  brandId?: string | null;
  brandImage?: string | null;
  title: string;
  summary: string;
  type: CollabType;
  course: Course;
  startDate: string;
  endDate: string;
  minStores: number;
  targetStores: number;
  /** 준비 기간(일) — 옛 값. 11-12부터 일정 계산(scheduleOf)에 쓰지 않는다(준비는 매장 확정 뒤 설치 전까지 남는 날). */
  prepDays: number;
  items: BaseItem[];
  itemNotes: Partial<Record<BaseItem, string>>;
  task: string;
  space: string;
  quantityPerStore: number;
  /** 증정 대상 비율(영수증 중) — 예상 소진율 계산용. */
  targetRatio: number;
  benefit: string;
  staffScript: string;
  /** 옛 "더 하고 싶은 것" — 11-11부터 의뢰서는 추가 기획(extraPlan)으로 받는다. 예시 의뢰에만 남아 있다. */
  extras: { kind: ExtraKind; body: string }[];
  /** 추가 기획 — 광고주가 자유롭게 적는 원하는 기획(협의 후 결정, 11-11). */
  extraPlan?: string;
  /** 추가 기획 첨부 파일 — 예시 화면이라 이름 · 크기만 남긴다. */
  extraPlanFile?: { name: string; size: number };
  /** 기본안마다 준비 상태 · admix 제작 대행(11-11) — 제작 대행은 콜라보 비용과 별도로 추가, 확인 후 견적. */
  itemPrep?: Partial<Record<BaseItem, ItemPrep>>;
  /** 콜라보 담당자(11-11) — 의뢰서에서 모두 필수. */
  contact?: CollabContact;
  /** 서버에 보낸 의뢰(081) — 고쳐 다시 보내면 같은 의뢰를 바꾼다. code 는 문서 번호 CR-YYMMDD-NN. */
  requestId?: string;
  requestCode?: string;
  status: PlanStatus;
  requestedAt?: string;
  approvedAt?: string;
  /** 취소한 때 — 의뢰 취소(검토 중)든 진행 확정 뒤 취소든. 취소해도 내 콜라보에 "취소"로 남는다(11-12 사용자). */
  cancelledAt?: string;
  /** admix 보완 요청 내용(옛 예시) — 11-12부터 admix 는 기획안(plan)을 보낸다. */
  reviewNote?: string;
  /** 서버 의뢰 상태(085) — submitted · proposed(admix 기획안 옴) · revised(내가 고쳐 보냄) · confirmed · cancelled. */
  requestStatus?: CollabRequestStatus;
  /** 기획안 차수(085) — 처음 의뢰서 · admix와 오간 차수 · 확정한 때. 위 값(캠페인명 · 기간 …)은 마지막 차수 기준. */
  plan?: PlanBlock;
  /** 처음 의뢰서(0차)를 보낸 때 — 기획안 차수 기록 맨 위 줄. */
  originalAt?: string;
  /** 광고주가 admix에 남긴 말. */
  memo?: string;
  /** 지정 희망 매장 — 담은 매장을 의뢰 때 붙여 둔다. */
  preferred: StoreRef[];
  /** 의뢰 때 계산한 예상 비용(나머지 매장 평균 금액). */
  estimateAvg: number;
  reservesPreApproved?: boolean;
  /** 목표 미달 때 고른 진행 방법. */
  decision?: { option: string; at: string };
  billing?: Billing;
  delay?: DelayRequest;
  entries: Entry[];
  changes: StoreChange[];
  reports: StoreReport[];
}

export interface AdvState {
  /** 3 — 11-10 콜라보 구성 6가지로 바꿈(옛 진행물 키가 남은 2 이하는 버린다). 2부터 예시 콜라보 없이 빈 상태로 시작. */
  version: 3;
  collabs: AdvCollab[];
  /** 담은 매장(의뢰 전). */
  cart: StoreRef[];
}

/** 신청 매장 · 확정 매장 정보 — 예시 매장, 없으면 지정 희망 매장에서. */
export const storeOf = (c: Pick<AdvCollab, "preferred">, id: string) =>
  exampleOf(id) ?? c.preferred.find((s) => s.id === id);

// ── 날짜 ─────────────────────────────────────────────────────────────

/** 토 · 일. */
export const isWeekend = (d: string) => {
  const w = new Date(`${d}T00:00:00Z`).getUTCDay();
  return w === 0 || w === 6;
};
/** 영업일이 아닌 날 — 토 · 일 · 공휴일(11-11 사용자: 공휴일을 달력에 빨간 날로 보이면서 영업일에서도 뺌). */
export const isOffDay = (d: string) => isWeekend(d) || isHoliday(d);
/** 영업일 n일 뒤 날짜(주말 · 공휴일 뺌). */
export const addBusinessDays = (d: string, n: number) => {
  let x = d;
  for (let left = n; left > 0; ) {
    x = addDays(x, 1);
    if (!isOffDay(x)) left -= 1;
  }
  return x;
};
/** from ~ to(둘 다 포함) 사이 영업일 수. to 가 from 보다 앞이면 0. */
export const businessDaysBetween = (from: string, to: string) => {
  let n = 0;
  for (let x = from; x <= to; x = addDays(x, 1)) if (!isOffDay(x)) n += 1;
  return n;
};
/** 11.06 (금) */
export const mdw = (d: string) =>
  `${d.slice(5, 7)}.${d.slice(8, 10)} (${"일월화수목금토"[new Date(`${d.slice(0, 10)}T00:00:00Z`).getUTCDay()]})`;
/** 11월 6일 */
export const mdKo = (d: string) =>
  `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;
/** ISO → KST 날짜. */
export const kstDate = (iso: string) =>
  new Date(Date.parse(iso) + 9 * 3_600_000).toISOString().slice(0, 10);
/** 예시 기준일 + 지금 시각(KST) — 새로 남기는 기록에 쓴다. */
export const previewNow = () => {
  const t = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(11, 16);
  return kst(PREVIEW_TODAY, t);
};
/** 하루의 끝(KST) — 기한 비교용. */
export const endOfDay = (d: string) => kst(d, "23:59");

// ── 일정 역산 ────────────────────────────────────────────────────────

export const installDays = (stores: number) =>
  Math.max(1, Math.ceil(Math.max(1, stores) / STORES_PER_INSTALL_DAY));

export interface Schedule {
  noticeDate: string;
  midShareDate: string;
  recruitEnd: string;
  reviewEnd: string;
  confirmStart: string;
  confirmDue: string;
  installStart: string;
  installDays: number;
  startDate: string;
  endDate: string;
  removalDate: string;
  checks: { day: number; date: string; pct: number }[];
}

type SchedulePlan = Pick<
  AdvCollab,
  "type" | "course" | "startDate" | "endDate" | "prepDays" | "targetStores" | "items" | "itemPrep"
> &
  Partial<Pick<AdvCollab, "status" | "requestedAt" | "approvedAt">>;

/** 30 · 50 · 70% 점검일(진행 n일차, 반올림). 12일 → 4 · 6 · 8일차. */
export function checkpoints(start: string, end: string) {
  const len = periodDays(start, end);
  return CHECK_POINTS.map((pct) => {
    const day = Math.min(len, Math.max(1, Math.round(len * pct)));
    return { day, pct, date: addDays(start, day - 1) };
  });
}

/**
 * admix 승인일 — 승인됐으면 그날. 아니면 의뢰 다음 영업일부터 검토 7영업일을 채운 날(의뢰가 없으면 오늘 보낸다고 친다).
 * 검토 중인데 그날이 이미 지났으면 오늘(주말 · 공휴일이면 다음 영업일) — 예상 일정이 지난 날짜로 나오지 않게(11-12 사용자).
 */
export function approvalDateOf(p: Partial<Pick<AdvCollab, "status" | "requestedAt" | "approvedAt">>, today = PREVIEW_TODAY) {
  if (p.approvedAt) return kstDate(p.approvedAt);
  const due = addBusinessDays(p.requestedAt ? kstDate(p.requestedAt) : today, ADMIX_REVIEW_DAYS);
  if (p.status === "cancelled" || due >= today) return due;
  return isOffDay(today) ? addBusinessDays(today, 1) : today;
}

/**
 * 일정 — 의뢰에서 앞으로 센다(11-12 사용자: 시작일에서 거꾸로 세니 모집이 지난 날짜로 나오고 의뢰서 예상 일정과 달랐다).
 * 의뢰 → admix 검토 · 승인(영업일) → 승인 다음 날 모집 공지 → 모집(코스 일수, 주말 포함) → 신청 매장 검토 · 매장 확정(영업일)
 * → 준비(영업일, 확정 다음 날부터 설치 전날까지 남는 날) → 설치 → 진행 → 철수. 설치 · 진행 · 철수는 고른 시작일 · 종료일 기준.
 * 영업일 = 주말 · 공휴일엔 진행하지 않는다(11-12 사용자: admix 검토 · 확정, 제작 · 준비, 매장 확정).
 * 제작 30일(MAKE_DAYS)은 일정에 잡지 않는다 — 의뢰서에서 빠듯함을 알리고 다른 시작일을 권할 때만 쓴다.
 */
export function scheduleOf(plan: SchedulePlan, today = PREVIEW_TODAY): Schedule {
  const c = COURSE[plan.course];
  const inst = installDays(plan.targetStores);
  const noticeDate = addDays(approvalDateOf(plan, today), 1);
  const recruitEnd = addDays(noticeDate, c.recruit - 1);
  const reviewEnd = addBusinessDays(recruitEnd, c.review);
  // 확정은 하루(영업일) — 검토가 끝난 다음 영업일.
  const confirmDue = addBusinessDays(reviewEnd, 1);
  return {
    noticeDate,
    midShareDate: addDays(noticeDate, Math.ceil(c.recruit / 2) - 1),
    recruitEnd,
    reviewEnd,
    confirmStart: confirmDue,
    confirmDue,
    installStart: addDays(plan.startDate, -inst),
    installDays: inst,
    startDate: plan.startDate,
    endDate: plan.endDate,
    removalDate: addDays(plan.endDate, 1),
    checks: checkpoints(plan.startDate, plan.endDate),
  };
}

/**
 * 최소 준비 기간(영업일) — 매장 확정 뒤 설치 전까지 이만큼도 안 남으면 의뢰서에서 보내기를 막는다(tooSoon).
 * 준비 기간은 11-11부터 의뢰서에서 받지 않는다.
 */
export const MIN_PREP_DAYS = 3;

/**
 * 의뢰서 "예상 일정" — 지금(today) 보내면 어떻게 되는지(11-11 사용자). 일정은 콜라보 상세와 같은 scheduleOf 로,
 * 의뢰일만 오늘로 둔다(고쳐 다시 보낼 때 옛 의뢰일 · 승인을 쓰지 않게). 의뢰서(AdvRequestForm) · 기획안 고치기(collabPlan)가 같이 쓴다.
 * 시작일은 고른 날 그대로라, 준비 기간은 확정 다음 날부터 설치 전날까지 남는 영업일.
 */
export function requestPlanPreviewOf(d: SchedulePlan, today = PREVIEW_TODAY) {
  const s = scheduleOf({ ...d, status: undefined, requestedAt: undefined, approvedAt: undefined }, today);
  // 준비 기간은 기본 3영업일보다 짧으면 의뢰를 막는다(tooSoon). 제작하는 기본안이 있으면 30영업일이 권장인데,
  // 못 채워도 막지 않고 알려만 준다(tight — 11-11 사용자: "못하는 건 아니고 못할 수도 있으니 인지하라는 말").
  // 처음엔 admix에 맡긴 제작만 30영업일로 막았는데, 같은 날 사용자가 직접 제작과 똑같이 늦추기를 권하고
  // 그대로 진행하면 책임은 광고주에게 있다고만 알리게 했다.
  const make = makeItems(d).length > 0;
  const minPrep = MIN_PREP_DAYS;
  const prep = businessDaysBetween(addDays(s.confirmDue, 1), addDays(s.installStart, -1));
  const tooSoon = prep < minPrep || s.installStart <= s.confirmDue;
  /** 확정 뒤 준비 영업일 n일을 채운 다음 날 설치 시작(주말도 됨), 설치 일수 뒤 시작. */
  const startAfter = (n: number) => addDays(addBusinessDays(s.confirmDue, n), 1 + s.installDays);
  return {
    s,
    make,
    minPrep,
    prep,
    tooSoon,
    tight: make && !tooSoon && prep < MAKE_DAYS,
    /** 가장 빠른 시작일. */
    earliest: startAfter(minPrep),
    /** 제작(직접 · admix 대행)까지 여유 있는 시작일. */
    makeReady: startAfter(MAKE_DAYS),
  };
}

export type Phase =
  | "upcoming"
  | "recruiting"
  | "review"
  | "confirming"
  | "preparing"
  | "installing"
  | "running"
  | "removal"
  | "done";

export function phaseOf(s: Schedule, today = PREVIEW_TODAY): Phase {
  if (today < s.noticeDate) return "upcoming";
  if (today <= s.recruitEnd) return "recruiting";
  if (today <= s.reviewEnd) return "review";
  if (today <= s.confirmDue) return "confirming";
  if (today < s.installStart) return "preparing";
  if (today < s.startDate) return "installing";
  if (today <= s.endDate) return "running";
  if (today === s.removalDate) return "removal";
  return "done";
}

export const isLive = (c: Pick<AdvCollab, "status">) => c.status === "approved";

// ── 신청 · 순번 ──────────────────────────────────────────────────────

const ACTIVE: EntryStatus[] = ["applied", "requested", "confirmed"];
export const isActive = (e: Entry) => ACTIVE.includes(e.status);

/** 선착순 — 확정 · 확정 요청 매장이 자리를 지키고, 나머지는 신청 순. 목표 수까지 선정, 그 뒤는 예비 순번. */
export function lineup(entries: Entry[], target: number) {
  const rank = (e: Entry) => (e.status === "applied" ? 1 : 0);
  const ordered = entries
    .filter(isActive)
    .sort((a, b) => rank(a) - rank(b) || a.appliedAt.localeCompare(b.appliedAt));
  return {
    selected: ordered.slice(0, Math.max(0, target)),
    reserves: ordered.slice(Math.max(0, target)),
    total: ordered.length,
  };
}

export function statsOf(c: AdvCollab) {
  const count = (st: EntryStatus) => c.entries.filter((e) => e.status === st).length;
  const { selected, reserves, total } = lineup(c.entries, c.targetStores);
  return {
    applied: total,
    confirmed: count("confirmed"),
    requested: count("requested"),
    selected: selected.length,
    reserves: reserves.length,
  };
}

/** 모집 결과 — 목표 이상 · 최소 이상 · 최소 미달. */
export type Outcome = "full" | "partial" | "short";
export const outcomeOf = (applied: number, min: number, target: number): Outcome =>
  applied >= target ? "full" : applied >= min ? "partial" : "short";

/** 목표 미달 때 광고주가 고르는 진행 방법. */
export const OUTCOME_OPTIONS: Record<
  Exclude<Outcome, "full">,
  { id: string; label: string; hint: string }[]
> = {
  partial: [
    { id: "proceed", label: "신청한 매장으로 진행", hint: "비용은 확정 매장 금액 합계예요" },
    { id: "extend", label: "3~5일 추가 모집", hint: "일정이 그만큼 뒤로 밀릴 수 있어요" },
  ],
  short: [
    { id: "extend", label: "추가 모집(기간 연장)", hint: "모집 기간을 늘려요" },
    { id: "widen", label: "지역 · 조건 넓히기", hint: "admix가 조건을 다시 제안해요" },
    { id: "direct", label: "admix 추천 매장 직접 섭외", hint: "비슷한 매장을 admix가 찾아요" },
    { id: "shrink", label: "규모 줄여 진행 협의", hint: "목표 매장 수를 낮춰요" },
    { id: "hold", label: "진행 보류", hint: "비용은 청구하지 않아요" },
  ],
};
export const optionLabel = (id: string) =>
  [...OUTCOME_OPTIONS.partial, ...OUTCOME_OPTIONS.short].find((o) => o.id === id)?.label ?? id;

/** 확정 순서대로 하루 5곳씩 설치일. */
export function installDateFor(s: Schedule, order: number) {
  const day = Math.min(s.installDays - 1, Math.floor(Math.max(0, order) / STORES_PER_INSTALL_DAY));
  return addDays(s.installStart, day);
}
export function installOrder(entries: Entry[], storeId: string) {
  const confirmed = entries
    .filter((e) => e.status === "confirmed")
    .sort((a, b) => (a.confirmedAt ?? "").localeCompare(b.confirmedAt ?? ""));
  const i = confirmed.findIndex((e) => e.storeId === storeId);
  return i < 0 ? confirmed.length : i;
}

/** 신청 매장 표 — 선정(확정 · 확정 요청 중 · 선정 n번) → 예비 n번. */
export function applicantRows(c: AdvCollab) {
  const { selected, reserves } = lineup(c.entries, c.targetStores);
  const row = (e: Entry, slot: string, reserve: boolean) => ({
    e,
    slot,
    reserve,
    store: storeOf(c, e.storeId),
  });
  return [
    ...selected.map((e, i) =>
      row(e, e.status === "confirmed" ? "확정" : e.status === "requested" ? "확정 요청 중" : `선정 ${i + 1}번`, false),
    ),
    ...reserves.map((e, i) => row(e, `예비 ${i + 1}번`, true)),
  ];
}

/** 매장별 예상 소진율(초기 입고 대비) — 광고주에게 보여 주는 유일한 수량 지표. 매출 · 영수증 수는 보이지 않는다. */
export function expectedRate(c: AdvCollab, store: StoreRef | undefined) {
  if (!store?.dailyReceipts || c.quantityPerStore <= 0) return null;
  const use = store.dailyReceipts * c.targetRatio * periodDays(c.startDate, c.endDate);
  return Math.min(100, Math.round((use / c.quantityPerStore) * 100));
}

// ── 비용 ─────────────────────────────────────────────────────────────

export function costOf(c: AdvCollab) {
  const sum = (ids: string[]) => ids.reduce((a, id) => a + feeOf(storeOf(c, id)), 0);
  const { selected } = lineup(c.entries, c.targetStores);
  const confirmed = c.entries.filter((e) => e.status === "confirmed").map((e) => e.storeId);
  return {
    selected: sum(selected.map((e) => e.storeId)),
    selectedCount: selected.length,
    confirmed: sum(confirmed),
    confirmedCount: confirmed.length,
  };
}

/** 목표 매장 수 기준 예상 비용 — 지정 매장은 그 금액, 나머지는 평균 금액. negotiable = 금액 협의(금액 없음) 지정 매장 수. */
export function estimateOf(preferred: StoreRef[], target: number, avg: number) {
  const fixed = preferred.reduce((a, s) => a + feeOf(s), 0);
  const rest = Math.max(0, target - preferred.length);
  const negotiable = preferred.filter((s) => !s.fee).length;
  return { preferred: fixed, rest, avg, total: fixed + rest * avg, negotiable };
}
/** 예상 비용 글 — 금액 협의 매장이 끼어 있으면 금액 뒤 "+@", 정해진 금액이 하나도 없으면 "금액 협의"(11-11 사용자). */
export const estimateText = (won: number, negotiable: number) =>
  negotiable ? (won ? `${wonText(won)} +@` : "금액 협의") : wonText(won);

// ── 진행 확정 · 계산서 · 입금 ─────────────────────────────────────────

export type PaymentState = "none" | "awaiting" | "overdue" | "paid" | "cancelled";

/** 매장 확정이 끝났으면(확정 요청이 모두 처리되고 확정 매장이 1곳 이상) 광고주가 진행을 확정할 수 있다. */
export function canConfirmProceed(c: AdvCollab, today = PREVIEW_TODAY) {
  if (!isLive(c) || c.billing) return false;
  const st = statsOf(c);
  const phase = phaseOf(scheduleOf(c), today);
  return st.confirmed > 0 && st.requested === 0 && ["review", "confirming", "preparing"].includes(phase);
}

export function paymentOf(c: AdvCollab, now = endOfDay(PREVIEW_TODAY)): PaymentState {
  const b = c.billing;
  if (c.status === "cancelled") return "cancelled";
  if (!b) return "none";
  if (b.paidAt) return "paid";
  return now > b.dueAt ? "overdue" : "awaiting";
}

const codeOf = (id: string) => id.replace(/^(offer|req)-/, "").toUpperCase();
export const invoiceNoFor = (id: string, now: string) =>
  `INV-${codeOf(id)}-${kstDate(now).replaceAll("-", "")}`;

export function confirmProceed(c: AdvCollab, now: string): AdvCollab {
  if (!canConfirmProceed(c, kstDate(now))) return c;
  const cost = costOf(c);
  return {
    ...c,
    billing: {
      confirmedAt: now,
      invoiceNo: invoiceNoFor(c.id, now),
      amount: cost.confirmed,
      stores: cost.confirmedCount,
      dueAt: endOfDay(addBusinessDays(kstDate(now), PAYMENT_DAYS)),
    },
  };
}

/** 진행 확정 뒤 취소 — 7일 안이면 50% 공제 후 환불, 넘으면 admix와 협의(null). */
export function refundFor(b: Billing, now: string) {
  const days = (Date.parse(now) - Date.parse(b.confirmedAt)) / 86_400_000;
  return days <= CANCEL_HALF_REFUND_DAYS ? Math.round(b.amount * 0.5) : null;
}

export function cancelCollab(c: AdvCollab, now: string): AdvCollab {
  if (c.status === "cancelled") return c;
  const refund = c.billing ? refundFor(c.billing, now) : null;
  return {
    ...c,
    status: "cancelled",
    cancelledAt: now,
    billing: c.billing
      ? { ...c.billing, cancelledAt: now, refund: refund ?? undefined }
      : undefined,
    entries: c.entries.map((e) =>
      isActive(e) ? { ...e, status: "cancelled", closedAt: now, closedReason: "광고주 취소" } : e,
    ),
  };
}

// ── 일정 조정 ────────────────────────────────────────────────────────

const overlaps = (a: { from: string; to: string }, b: { from: string; to: string }) =>
  a.from <= b.to && b.from <= a.to;

/** 새 시작일로 옮긴 기획(기간 길이는 그대로). */
export const shifted = (c: AdvCollab, newStart: string): AdvCollab => ({
  ...c,
  startDate: newStart,
  endDate: addDays(c.endDate, diffDays(newStart, c.startDate)),
});

/** 조정할 수 없는 확정 매장 — 바뀐 기간(설치 ~ 철수)에 다른 콜라보가 잡혀 있다. */
export function delayBlockers(c: AdvCollab, newStart: string): string[] {
  const s = scheduleOf(shifted(c, newStart));
  const span = { from: s.installStart, to: s.removalDate };
  return c.entries
    .filter((e) => e.status === "confirmed")
    .filter((e) => (storeOf(c, e.storeId)?.busy ?? []).some((b) => overlaps(b, span)))
    .map((e) => e.storeId);
}

export function requestDelay(c: AdvCollab, newStart: string, now: string): AdvCollab {
  if (!isLive(c) || newStart === c.startDate) return c;
  const blockers = delayBlockers(c, newStart);
  return {
    ...c,
    delay: {
      requestedAt: now,
      fromStart: c.startDate,
      newStart,
      days: diffDays(newStart, c.startDate),
      status: blockers.length ? "blocked" : "pending",
      blockers,
      confirmed: [],
    },
  };
}

/** 일정 조정이 가능한 때 — 진행 확정 뒤, 설치 시작 전, 확인 중인 요청이 없을 때. */
export const canDelay = (c: AdvCollab, today = PREVIEW_TODAY) =>
  isLive(c) && !!c.billing && today < scheduleOf(c).installStart && c.delay?.status !== "pending";

// ── 신청 매장 검토 ──────────────────────────────────────────────────

/** 확정 요청이 시작된 기획이면 비는 자리를 다음 순번에 바로 요청한다(예비 매장 투입). */
function fillSlots(c: AdvCollab, now: string): AdvCollab {
  if (!c.entries.some((e) => e.requestedAt)) return c;
  const ids = lineup(c.entries, c.targetStores)
    .selected.filter((e) => e.status === "applied")
    .map((e) => e.storeId);
  if (!ids.length) return c;
  return {
    ...c,
    entries: c.entries.map((e) =>
      ids.includes(e.storeId) ? { ...e, status: "requested", requestedAt: now } : e,
    ),
  };
}

/** 광고주 제외 요청 → 다음 순번이 올라온다. */
export function excludeStore(c: AdvCollab, storeId: string, now: string): AdvCollab {
  const target = c.entries.find((e) => e.storeId === storeId);
  if (!target || !["applied", "requested"].includes(target.status)) return c;
  return fillSlots(
    {
      ...c,
      entries: c.entries.map((e) =>
        e.storeId === storeId
          ? { ...e, status: "excluded", closedAt: now, closedReason: "광고주 제외 요청" }
          : e,
      ),
    },
    now,
  );
}

/** 신청 매장을 검토할 수 있는 때 — 모집 마감 뒤 ~ 매장 확정 기한. */
export const isReviewing = (c: AdvCollab, today = PREVIEW_TODAY) => {
  const p = phaseOf(scheduleOf(c), today);
  return isLive(c) && (p === "review" || p === "confirming");
};

// ── 단계 · 할 일 ─────────────────────────────────────────────────────

export type ListTab = "request" | "matching" | "running" | "done";
export const LIST_TABS: { id: ListTab; label: string; empty: string }[] = [
  { id: "request", label: "의뢰", empty: "검토 중인 의뢰가 없어요." },
  { id: "matching", label: "모집 · 확정", empty: "모집하거나 매장을 확정하는 콜라보가 없어요." },
  { id: "running", label: "진행", empty: "준비하거나 진행 중인 콜라보가 없어요." },
  { id: "done", label: "완료", empty: "끝난 콜라보가 없어요." },
];

export function tabOf(c: AdvCollab, today = PREVIEW_TODAY): ListTab {
  if (c.status === "cancelled") return "done";
  if (c.status !== "approved") return "request";
  const p = phaseOf(scheduleOf(c), today);
  if (p === "upcoming" || p === "recruiting" || p === "review" || p === "confirming") return "matching";
  if (p === "done") return "done";
  // 매장 확정이 끝났는데 진행 확정 · 입금 전이면 아직 확정 단계.
  if (p === "preparing" && !c.billing) return "matching";
  return "running";
}

export function stageOf(c: AdvCollab, today = PREVIEW_TODAY): { label: string; tone: Tone } {
  if (c.status === "cancelled") return { label: "취소", tone: "gray" };
  if (c.status === "requested") return { label: "의뢰 검토 중", tone: "amber" };
  if (c.status === "returned") return c.plan ? { label: "기획안 확인", tone: "amber" } : { label: "보완 요청", tone: "red" };
  const p = phaseOf(scheduleOf(c), today);
  if (canConfirmProceed(c, today)) return { label: "진행 확정 대기", tone: "amber" };
  const pay = paymentOf(c, endOfDay(today));
  if (pay === "awaiting") return { label: "입금 대기", tone: "amber" };
  if (pay === "overdue") return { label: "입금 지연", tone: "red" };
  switch (p) {
    case "upcoming":
      return { label: "모집 예정", tone: "gray" };
    case "recruiting":
      return { label: "매장 모집 중", tone: "blue" };
    case "review":
      return { label: "매장 검토", tone: "amber" };
    case "confirming":
      return { label: "매장 확정 중", tone: "blue" };
    case "preparing":
      return { label: c.type === "made" ? "제작 · 준비" : "준비", tone: "blue" };
    case "installing":
      return { label: "설치", tone: "blue" };
    case "running":
      return { label: "진행 중", tone: "purple" };
    default:
      return { label: "완료", tone: "green" };
  }
}

/**
 * 대시보드 단계 — 의뢰부터 진행까지 흐름 순서(완료 · 취소는 밖).
 * stageOf 의 자세한 단계를 여섯 단계로 묶는다: 모집 예정 → 매장 모집, 매장 확정 중 → 매장 검토,
 * 입금 대기 · 지연 → 진행 확정, 설치 → 준비, 기획안 확인(옛 보완 요청) → 의뢰 검토.
 * 대시보드 "의뢰 및 매장 모집"에는 앞 네 단계만 칸으로 둔다(BOARD_STEPS) — 준비 · 진행 중은 아래
 * "진행 중인 콜라보"에 카드로 나온다(11-09 사용자).
 */
export type BoardStep = "request" | "recruit" | "review" | "proceed" | "prep" | "running";
export const BOARD_STEPS: { id: BoardStep; label: string }[] = [
  { id: "request", label: "의뢰 검토" },
  { id: "recruit", label: "매장 모집" },
  { id: "review", label: "매장 검토" },
  { id: "proceed", label: "진행 확정" },
];
/** 대시보드 "진행 중인 콜라보"에 나오는 단계 — 입금을 마친 뒤 준비 · 설치 · 진행 · 철수. */
export const isUnderwayStep = (step: BoardStep | null) => step === "prep" || step === "running";

export function boardStepOf(c: AdvCollab, today = PREVIEW_TODAY): BoardStep | null {
  if (c.status === "cancelled") return null;
  if (c.status !== "approved") return "request";
  if (canConfirmProceed(c, today)) return "proceed";
  const pay = paymentOf(c, endOfDay(today));
  if (pay === "awaiting" || pay === "overdue") return "proceed";
  switch (phaseOf(scheduleOf(c), today)) {
    case "upcoming":
    case "recruiting":
      return "recruit";
    case "review":
    case "confirming":
      return "review";
    case "preparing":
    case "installing":
      // 매장 확정은 끝났는데 진행 확정 전이면(확정 매장 0곳 등) 아직 진행 확정 칸.
      return c.billing ? "prep" : "proceed";
    case "running":
    case "removal":
      return "running";
    default:
      return null;
  }
}

export interface ReportLink {
  kind: ReportKind;
  label: string;
  ready: boolean;
  date: string;
}
export type ReportKind = "install" | "mid1" | "mid2" | "mid3" | "result";
export const REPORT_LABEL: Record<ReportKind, string> = {
  install: "게첨 보고서",
  mid1: "중간 보고 1",
  mid2: "중간 보고 2",
  mid3: "중간 보고 3",
  result: "결과 보고서",
};

export function reportsOf(c: AdvCollab, today = PREVIEW_TODAY): ReportLink[] {
  if (!isLive(c)) return [];
  const s = scheduleOf(c);
  const installed = c.reports.some((r) => r.installAt);
  return [
    { kind: "install", label: REPORT_LABEL.install, ready: installed && today >= s.startDate, date: s.startDate },
    ...s.checks.map((k, i) => ({
      kind: `mid${i + 1}` as ReportKind,
      label: REPORT_LABEL[`mid${i + 1}` as ReportKind],
      ready: today >= k.date && c.reports.some((r) => r.remaining[i] != null),
      date: k.date,
    })),
    { kind: "result", label: REPORT_LABEL.result, ready: today >= s.removalDate, date: s.removalDate },
  ];
}

/** 지금 광고주가 할 일 / 알아 둘 일 한 줄. kind 가 있으면 누를 일이 있는 것(대시보드 "확인할 일"). */
export function todoOf(
  c: AdvCollab,
  today = PREVIEW_TODAY,
): { text: string; kind?: "proceed" | "decide" | "review" | "reserve" | "pay" | "report" | "returned" } | null {
  if (c.status === "cancelled")
    return {
      text: c.billing?.cancelledAt
        ? c.billing.refund !== undefined
          ? `취소했어요 · 50% 공제 후 ${wonText(c.billing.refund)} 환불 예정`
          : "취소했어요 · 환불은 admix와 협의해요"
        : c.cancelledAt
          ? `${kstStamp(c.cancelledAt)}에 의뢰를 취소했어요`
          : "의뢰를 취소했어요",
    };
  if (c.status === "returned")
    return c.plan
      ? { text: "admix 기획안이 왔어요 — 수정 전 · 후를 보고 확정하거나 다시 고쳐 보내 주세요", kind: "returned" }
      : { text: `admix 보완 요청 — ${c.reviewNote ?? "내용을 확인해 주세요"}`, kind: "returned" };
  if (c.status === "requested")
    return {
      text: c.plan?.rounds.length ? "admix가 고쳐 보낸 기획안을 검토하고 있어요" : "admix가 의뢰 내용을 검토하고 있어요",
    };
  const st = statsOf(c);
  const s = scheduleOf(c);
  const p = phaseOf(s, today);
  if (canConfirmProceed(c, today))
    return {
      text: `매장 ${st.confirmed}곳이 확정했어요 — 진행을 확정해 주세요`,
      kind: "proceed",
    };
  const pay = paymentOf(c, endOfDay(today));
  if (pay === "awaiting" && c.billing)
    return {
      text: `${mdw(kstDate(c.billing.dueAt))}까지 ${wonText(c.billing.amount)} 입금해 주세요 · 기한을 넘기면 위약금이 생겨요`,
      kind: "pay",
    };
  if (pay === "overdue") return { text: "입금 기한이 지나 위약금이 생기고 진행이 멈췄어요 — admix에 연락해 주세요", kind: "pay" };
  if (c.delay?.status === "pending")
    return { text: `일정 조정 확인 중 · 확정 매장 ${c.delay.confirmed.length}/${st.confirmed}곳 확인` };
  if (p === "review" || p === "confirming") {
    const o = outcomeOf(st.applied, c.minStores, c.targetStores);
    if (o !== "full" && !c.decision)
      return { text: `신청 ${st.applied}곳 — 진행 방법을 골라 주세요`, kind: "decide" };
    if (!c.reservesPreApproved && st.reserves > 0)
      return { text: "예비 매장을 미리 승인할지 정해 주세요", kind: "reserve" };
    return p === "review"
      ? { text: "신청 매장을 검토해 주세요 · 필요하면 제외 요청", kind: "review" }
      : { text: `매장들이 최종 확정하고 있어요 · ${mdw(s.confirmDue)}까지` };
  }
  const ready = reportsOf(c, today).filter((r) => r.ready);
  if (p === "done" || p === "removal") return { text: "결과 보고서를 확인해 주세요", kind: "report" };
  if (ready.length && (p === "running" || p === "installing"))
    return { text: `새 보고서 · ${ready[ready.length - 1].label}`, kind: "report" };
  if (p === "upcoming") return { text: `${mdw(s.noticeDate)}에 매장 모집을 시작해요` };
  if (p === "recruiting")
    return { text: `${mdw(s.recruitEnd)} 모집 마감 · 신청 ${st.applied}/${c.targetStores}곳` };
  if (p === "preparing" || p === "installing")
    return { text: `${mdw(s.installStart)}부터 매장에 설치해요` };
  return null;
}

/**
 * 마지막으로 단계가 바뀐 때(ISO) — 내 콜라보 목록을 이 순서로 놓는다(11-12 사용자: "업데이트순으로, 의뢰는 11/11인데
 * 검토 단계로 갱신되면서 11/12, 확정되면 모집으로 갱신되면서 11/16 이런 식으로").
 * 의뢰(고쳐 다시 보낸 때) → admix 검토 시작(의뢰 다음 영업일) → 승인 → 모집 공지 → 매장 검토 → 매장 확정 →
 * 진행 확정(계산서) · 입금 → 준비 → 설치 → 진행 → 철수 → 완료 가운데 지금까지 지난 것 중 가장 늦은 때. 취소면 취소한 때.
 * 날짜만 있는 단계는 그날 0시(KST)로 친다.
 */
export function updatedAtOf(c: AdvCollab, now = previewNow()): string {
  if (c.status === "cancelled" && c.cancelledAt) return c.cancelledAt;
  const day = (d: string) => kst(d, "00:00");
  const events: (string | undefined)[] = [];
  if (c.requestedAt) events.push(c.requestedAt, day(addBusinessDays(kstDate(c.requestedAt), 1)));
  if (c.status === "approved") {
    const s = scheduleOf(c);
    events.push(
      c.approvedAt,
      day(s.noticeDate),
      day(addDays(s.recruitEnd, 1)),
      day(addDays(s.reviewEnd, 1)),
      day(addDays(s.confirmDue, 1)),
      day(s.installStart),
      day(s.startDate),
      day(s.removalDate),
      day(addDays(s.removalDate, 1)),
      c.billing?.confirmedAt,
      c.billing?.paidAt,
    );
  }
  const limit = Date.parse(now);
  let best = c.requestedAt ?? now;
  for (const e of events)
    if (e && Date.parse(e) <= limit && Date.parse(e) > Date.parse(best)) best = e;
  return best;
}

/**
 * 지금 단계가 얼마나 걸리는지 — 내 콜라보 줄 "지금 상황" 칸의 둘째 줄(11-12 사용자: "예상 몇일 걸리는지도 같이").
 * 의뢰 검토는 의뢰 다음 날부터 영업일 7일(ADMIX_REVIEW_DAYS), 승인 뒤는 일정(scheduleOf)에서 그 단계가 끝나는 날까지.
 * 끝난 콜라보 · 취소 · 보완 요청(보완 내용을 먼저 보여 준다)은 없다.
 */
export function etaOf(c: AdvCollab, today = PREVIEW_TODAY): string | null {
  if (c.status === "cancelled" || c.status === "returned") return null;
  if (c.status === "requested") {
    const due = addBusinessDays(c.requestedAt ? kstDate(c.requestedAt) : today, ADMIX_REVIEW_DAYS);
    if (today > due) return "검토 결과를 곧 알려 드려요";
    if (today === due) return "오늘 검토를 마쳐요";
    const n = businessDaysBetween(addDays(today, 1), due);
    return n >= ADMIX_REVIEW_DAYS
      ? `영업일 ${ADMIX_REVIEW_DAYS}일 걸려요 · ${mdw(due)}까지`
      : `영업일 ${n}일 남았어요 · ${mdw(due)}까지`;
  }
  const s = scheduleOf(c);
  const left = (end: string) => {
    const n = diffDays(end, today);
    return n <= 0 ? "오늘까지" : `${n}일 남음`;
  };
  switch (phaseOf(s, today)) {
    case "upcoming":
      return `${mdw(s.noticeDate)}부터 모집해요 · ${diffDays(s.noticeDate, today)}일 뒤`;
    case "recruiting":
      return `모집 ${COURSE[c.course].recruit}일 · ${mdw(s.recruitEnd)}까지 · ${left(s.recruitEnd)}`;
    case "review":
      return `${mdw(s.reviewEnd)}까지 검토해요 · ${left(s.reviewEnd)}`;
    case "confirming":
      return `${mdw(s.confirmDue)}까지 확정해요 · ${left(s.confirmDue)}`;
    case "preparing":
      return `${mdw(s.installStart)}부터 설치해요 · ${diffDays(s.installStart, today)}일 뒤`;
    case "installing":
      return `설치 ${s.installDays}일 · ${mdw(s.startDate)} 진행 시작`;
    case "running":
      return `${periodDays(c.startDate, c.endDate)}일 진행 · ${mdw(s.endDate)}까지 · ${left(s.endDate)}`;
    default:
      return null;
  }
}

/** 원 → "150만 원"(lib/partners wonLabel). */
export const wonText = wonLabel;

// ── 예시 데이터 ─────────────────────────────────────────────────────

const T = PREVIEW_TODAY;
const at = (offset: number, time = "09:00") => kst(addDays(T, offset), time);

const plan = (
  p: Omit<AdvCollab, "extras" | "itemNotes" | "staffScript" | "status" | "preferred" | "entries" | "changes" | "reports" | "estimateAvg"> &
    Partial<Pick<AdvCollab, "extras" | "itemNotes" | "staffScript" | "status" | "preferred" | "entries" | "changes" | "reports" | "estimateAvg">>,
): AdvCollab => {
  const c: AdvCollab = {
    extras: [],
    itemNotes: {},
    staffScript: "",
    status: "approved",
    preferred: [],
    entries: [],
    changes: [],
    reports: [],
    estimateAvg: averageFee(EXAMPLE_STORES),
    ...p,
  };
  if (c.status !== "approved" || c.requestedAt) return c;
  // 승인된 예시 — 시작일에서 거꾸로(설치 · 준비 · 모집 코스) 모집 공지일을 잡고, 그 전날 승인 · 9일 전 의뢰로 채운다.
  // 11-12부터 일정은 승인일에서 앞으로 세서(scheduleOf), 예시의 확정 · 준비 날짜는 예전과 하루 이틀 다를 수 있다.
  const notice = addDays(c.startDate, -installDays(c.targetStores) - Math.max(0, Math.round(c.prepDays)) - COURSE[c.course].total);
  return {
    ...c,
    requestedAt: kst(addDays(notice, -9), "10:20"),
    approvedAt: c.approvedAt ?? kst(addDays(notice, -1), "15:00"),
  };
};

/** 신청 줄 — 공지일부터 step 시간 간격. */
const applied = (ids: string[], from: string, stepHours: number): Entry[] =>
  ids.map((storeId, i) => ({
    storeId,
    appliedAt: new Date(Date.parse(kst(from, "10:00")) + i * stepHours * 3_600_000).toISOString(),
    status: "applied",
  }));
/** 모두 확정 — 확정 요청 뒤 47분 간격으로 확정. */
const confirmedAll = (list: Entry[], requestedAt: string, code: string, day: string): Entry[] =>
  list.map((e, i) => ({
    ...e,
    status: "confirmed",
    requestedAt,
    confirmedAt: new Date(Date.parse(requestedAt) + (i + 1) * 47 * 60_000).toISOString(),
    confirmNo: `ADX-${code}-${day.replaceAll("-", "")}-${String(i + 1).padStart(2, "0")}`,
  }));
const billingOf = (c: AdvCollab, paid: boolean): Billing => {
  const s = scheduleOf(c);
  const confirmedAt = kst(s.confirmDue, "18:00");
  const cost = costOf(c);
  return {
    confirmedAt,
    invoiceNo: invoiceNoFor(c.id, confirmedAt),
    amount: cost.confirmed,
    stores: cost.confirmedCount,
    dueAt: kst(addBusinessDays(s.confirmDue, PAYMENT_DAYS), "18:00"),
    paidAt: paid ? kst(addDays(s.confirmDue, 1), "10:30") : undefined,
  };
};

/**
 * 예시 콜라보 7개(K · M · H · F · A · B · E) — 의뢰 검토부터 완료까지 단계별 화면을 보여 주던 값.
 * 11-10 사용자("화면에 뜨는 데이터 다 없애줘, 처음부터 테스트")로 기본 상태에서는 뺐다(SEED_STATE 는 빈 목록).
 * 서버 연동 전에 뒤 단계 화면을 다시 봐야 하면 SEED_STATE.collabs 에 exampleCollabs() 를 넣으면 된다.
 */
export function exampleCollabs(): AdvCollab[] {
  // K — 방금 보낸 의뢰, admix 검토 중. 지정 희망 매장 3곳.
  const k = plan({
    id: "offer-k",
    brand: "브랜드 K",
    title: "겨울 핸드크림 샘플링",
    summary: "건조한 겨울, 음료와 함께 핸드크림 샘플을 건네는 콜라보예요.",
    type: "ready",
    course: "standard",
    startDate: addDays(T, 67),
    endDate: addDays(T, 80),
    minStores: 6,
    targetStores: 10,
    prepDays: 3,
    items: ["promo", "goods"],
    itemNotes: { promo: "계산대 옆 A4 포스터 1장", goods: "구매 시 증정 · 1인 1개 · 상온 보관" },
    task: "음료 구매 고객에게 핸드크림 샘플 1개 증정 (1인 1개)",
    space: "계산대 옆 선반",
    quantityPerStore: 300,
    targetRatio: 0.2,
    benefit: "핸드크림 정품 세트 2개",
    staffScript: "겨울 핸드크림 샘플 드리고 있어요. 음료와 함께 하나 챙겨 가세요.",
    status: "requested",
    requestedAt: at(0, "08:10"),
    memo: "성수 · 합정 매장 위주로 원해요. 고른 매장이 어렵다면 비슷한 분위기 매장으로 채워 주세요.",
    preferred: ["x01", "x07", "x24"].map((id) => exampleOf(id)!),
  });

  // M — 매장 8곳 모두 확정, 오늘이 매장 확정 기한 → 광고주 진행 확정 차례.
  const m0 = plan({
    id: "offer-m",
    brand: "브랜드 M",
    title: "홀리데이 쿠키 샘플링",
    summary: "연말 시즌 버터 쿠키를 음료와 함께 맛보게 하는 콜라보예요.",
    type: "ready",
    course: "standard",
    startDate: addDays(T, 6),
    endDate: addDays(T, 19),
    minStores: 6,
    targetStores: 8,
    prepDays: 3,
    items: ["goods", "display"],
    itemNotes: { goods: "음료 구매 시 증정 · 1인 1개", display: "쿠키 틴 케이스 진열 1칸" },
    task: "음료 구매 고객에게 쿠키 샘플 1개 증정 (1인 1개)",
    space: "쇼케이스 옆 선반",
    quantityPerStore: 250,
    targetRatio: 0.22,
    benefit: "홀리데이 쿠키 틴 3개",
    staffScript: "연말 한정 쿠키 샘플이에요. 음료와 함께 드셔 보세요.",
    reservesPreApproved: true,
  });
  const sM = scheduleOf(m0);
  const mApplied = applied(exampleIds(27, 36), sM.noticeDate, 26);
  const m: AdvCollab = {
    ...m0,
    entries: [
      ...confirmedAll(mApplied.slice(0, 8), kst(sM.confirmStart, "10:00"), "M", sM.confirmStart),
      ...mApplied.slice(8),
    ],
  };

  // H — 제작형, 신청 13곳(목표 15 · 최소 10) → "신청한 매장으로 진행"을 골랐고 오늘 확정 요청. 3곳 확정, 10곳 확정 요청 중.
  const h0 = plan({
    id: "offer-h",
    brand: "브랜드 H",
    title: "연말 기프트 쇼케이스",
    summary: "매장 확정 후 수량에 맞춰 만든 연말 한정 굿즈를 증정해요.",
    type: "made",
    course: "standard",
    startDate: addDays(T, 46),
    endDate: addDays(T, 66),
    minStores: 10,
    targetStores: 15,
    prepDays: 30,
    items: ["goods", "display", "menu"],
    itemNotes: {
      goods: "구매 고객 증정 · 소진 전 재입고 요청",
      display: "기프트 세트 진열 1칸",
      menu: "브랜드 시럽을 넣은 시즌 음료 1종 (레시피와 시럽 제공)",
    },
    task: "음료 구매 고객에게 연말 한정 굿즈 1개 증정 (1인 1개)",
    space: "입구 쪽 진열대",
    quantityPerStore: 200,
    targetRatio: 0.12,
    benefit: "연말 기프트 세트 1개",
    staffScript: "연말 한정 굿즈 증정 중이에요. 음료 주문하시면 하나 드릴게요.",
    decision: { option: "proceed", at: at(0, "08:30") },
  });
  const sH = scheduleOf(h0);
  const hReq = at(0, "09:00");
  const h: AdvCollab = {
    ...h0,
    entries: applied(["x18", "x19", "x20", "x01", "x21", "x22", ...exampleIds(7, 13)], sH.noticeDate, 19).map(
      (e, i): Entry =>
        i < 3
          ? {
              ...e,
              status: "confirmed",
              requestedAt: hReq,
              confirmedAt: at(0, `09:${String(20 + i * 11).padStart(2, "0")}`),
              confirmNo: `ADX-H-${T.replaceAll("-", "")}-0${i + 1}`,
            }
          : { ...e, status: "requested", requestedAt: hReq },
    ),
  };

  // F — 모집 9일차, 9곳 신청(목표 15).
  const f0 = plan({
    id: "offer-f",
    brand: "브랜드 F",
    title: "겨울 향기 체험",
    summary: "계산대 옆에서 겨울 향 샘플키트를 건네는 콜라보예요.",
    type: "ready",
    course: "standard",
    startDate: addDays(T, 18),
    endDate: addDays(T, 38),
    minStores: 10,
    targetStores: 15,
    prepDays: 3,
    items: ["promo", "goods", "display"],
    itemNotes: { promo: "계산대 옆 A4 포스터 1장", goods: "구매 시 증정 · 1인 1개 · 직사광선 피해 보관", display: "디퓨저 시향 1세트" },
    task: "음료 구매 고객에게 향 샘플키트 1개 증정 (1인 1개)",
    space: "계산대 옆 선반",
    quantityPerStore: 400,
    targetRatio: 0.3,
    benefit: "디퓨저 세트 1개",
    staffScript: "겨울 향 샘플키트 드리고 있어요. 음료 주문하시면 하나 챙겨 드릴게요.",
    extras: [{ kind: "sns", body: "인스타그램 인증 고객에게 브랜드가 추가 샘플을 직접 보내요 (매장 확인 불필요)" }],
  });
  const f: AdvCollab = { ...f0, entries: applied(exampleIds(14, 22), scheduleOf(f0).noticeDate, 21) };

  // A — 매장 확정 · 입금까지 끝, 준비 중. 확정 매장 1곳이 공사로 빠져 예비 매장으로 바꿨다.
  //     예시 카페 Q(x17)는 철수 8일 뒤 다른 콜라보가 잡혀 있어 일정을 8일 넘게 미루면 조정할 수 없다.
  const a0 = plan({
    id: "offer-a",
    brand: "브랜드 A",
    title: "가을 티 테이스팅",
    summary: "따뜻한 음료와 함께 가을 티백 샘플을 건네는 콜라보예요.",
    type: "ready",
    course: "standard",
    startDate: addDays(T, 4),
    endDate: addDays(T, 17),
    minStores: 6,
    targetStores: 10,
    prepDays: 2,
    items: ["promo", "goods"],
    itemNotes: { promo: "계산대 옆 A4 포스터 1장", goods: "구매 시 증정 · 1인 1개 · 상온 보관" },
    task: "음료 구매 고객에게 티백 샘플 1개 증정 (1인 1개)",
    space: "계산대 옆 선반",
    quantityPerStore: 300,
    targetRatio: 0.25,
    benefit: "브랜드 티 세트 1박스",
    staffScript: "가을 티 샘플 드리고 있어요. 음료 주문하시면 하나 챙겨 드릴게요.",
  });
  const sA = scheduleOf(a0);
  const aApplied = applied(exampleIds(7, 17), sA.noticeDate, 16);
  const aConfirmed = confirmedAll(aApplied.slice(0, 10), kst(sA.confirmStart, "10:00"), "A", sA.confirmStart);
  const aOut = aConfirmed[7];
  const a1: AdvCollab = {
    ...a0,
    entries: [
      ...aConfirmed.map((e): Entry =>
        e.storeId === aOut.storeId
          ? { ...e, status: "cancelled", closedAt: at(-1, "15:20"), closedReason: "공사" }
          : e,
      ),
      {
        ...aApplied[10],
        status: "confirmed",
        requestedAt: at(-1, "15:30"),
        confirmedAt: at(-1, "17:10"),
        confirmNo: `ADX-A-${addDays(T, -1).replaceAll("-", "")}-11`,
      },
    ],
    changes: [
      {
        id: "chg-a1",
        storeId: aOut.storeId,
        at: at(-1, "15:20"),
        timing: "확정 후 · 시작 5일 전",
        reason: "공사 — 매장 내부 공사 일정이 앞당겨졌어요",
        replacement: aApplied[10].storeId,
      },
    ],
  };
  const a: AdvCollab = { ...a1, billing: billingOf(a1, true) };

  // B — 진행 중, 오늘 1차 점검(중간 보고 1). 확정 매장 1곳이 시작 전 빠져 예비 매장으로 바꿨다.
  const b0 = plan({
    id: "offer-b",
    brand: "브랜드 B",
    title: "가을 블렌드 테이스팅",
    summary: "카운터 옆 진열대에서 가을 블렌드 드립백을 소개하는 콜라보예요.",
    type: "ready",
    course: "standard",
    startDate: addDays(T, -3),
    endDate: addDays(T, 8),
    minStores: 5,
    targetStores: 8,
    prepDays: 2,
    items: ["goods", "display"],
    itemNotes: { goods: "구매 시 증정 · 1인 1개 · 상온 보관", display: "진열대 1개 · 제품 3종 진열 유지" },
    task: "음료 구매 고객에게 드립백 샘플 1개 증정 (1인 1개)",
    space: "카운터 옆 진열대",
    quantityPerStore: 250,
    targetRatio: 0.2,
    benefit: "원두 1kg",
    staffScript: "가을 블렌드 드립백 샘플이에요. 음료 주문하시면 하나 드릴게요.",
    reservesPreApproved: true,
  });
  const sB = scheduleOf(b0);
  const bApplied = applied(["x18", "x01", ...exampleIds(19, 25)], sB.noticeDate, 20);
  const bConfirmed = confirmedAll(bApplied.slice(0, 8), kst(sB.confirmStart, "10:00"), "B", sB.confirmStart);
  const bOut = bConfirmed[6];
  const bEntries: Entry[] = [
    ...bConfirmed.map((e): Entry =>
      e.storeId === bOut.storeId
        ? { ...e, status: "cancelled", closedAt: kst(addDays(sB.startDate, -3), "11:00"), closedReason: "인력" }
        : e,
    ),
    {
      ...bApplied[8],
      status: "confirmed",
      requestedAt: kst(addDays(sB.startDate, -3), "11:10"),
      confirmedAt: kst(addDays(sB.startDate, -3), "13:40"),
      confirmNo: `ADX-B-${addDays(sB.startDate, -3).replaceAll("-", "")}-09`,
    },
  ];
  const bStores = bEntries.filter((e) => e.status === "confirmed").map((e) => e.storeId);
  const b1: AdvCollab = {
    ...b0,
    entries: bEntries,
    changes: [
      {
        id: "chg-b1",
        storeId: bOut.storeId,
        at: kst(addDays(sB.startDate, -3), "11:00"),
        timing: "확정 후 · 시작 3일 전",
        reason: "인력 — 직원이 갑자기 그만둬 운영이 어려워요",
        replacement: bApplied[8].storeId,
      },
    ],
    reports: bStores.map((storeId, i) => ({
      storeId,
      installAt: kst(addDays(sB.installStart, i < 5 ? 0 : 1), "15:00"),
      remaining: [i === 0 ? 160 : i === 1 ? 120 : null, null, null],
    })),
  };
  const b: AdvCollab = { ...b1, billing: billingOf(b1, true) };

  // E — 지난여름 완료, 결과 보고서까지.
  const e0 = plan({
    id: "offer-e",
    brand: "브랜드 E",
    title: "여름 음료 샘플링",
    summary: "매장 방문객에게 여름 신제품 음료를 소개한 콜라보예요.",
    type: "ready",
    course: "standard",
    startDate: "2026-08-10",
    endDate: "2026-08-16",
    minStores: 4,
    targetStores: 6,
    prepDays: 2,
    items: ["goods"],
    itemNotes: { goods: "냉장 보관 · 1인 1개" },
    task: "음료 구매 고객에게 음료 샘플 1병 증정 (1인 1개)",
    space: "쇼케이스 옆",
    quantityPerStore: 150,
    targetRatio: 0.12,
    benefit: "음료 2박스",
    staffScript: "여름 신제품 음료 샘플이에요. 시원하게 드셔 보세요.",
    reservesPreApproved: true,
  });
  const sE = scheduleOf(e0);
  const eEntries = confirmedAll(
    applied(["x01", "x02", "x03", ...exampleIds(37, 39)], sE.noticeDate, 22),
    kst(sE.confirmStart, "10:00"),
    "E",
    sE.confirmStart,
  );
  const pace = [0.85, 0.95, 1, 0.9, 1.05, 0.8];
  const e1: AdvCollab = {
    ...e0,
    entries: eEntries,
    reports: eEntries.map((en, i) => {
      const perDay = (exampleOf(en.storeId)?.dailyReceipts ?? 120) * e0.targetRatio * pace[i];
      const restock = en.storeId === "x03" ? 60 : 0;
      return {
        storeId: en.storeId,
        installAt: kst(addDays(sE.startDate, -1), "14:00"),
        remaining: sE.checks.map((k, j) =>
          Math.max(0, Math.round(e0.quantityPerStore + (j === 2 ? restock : 0) - perDay * k.day)),
        ),
        restock: restock || undefined,
        collected: Math.max(0, Math.round(e0.quantityPerStore + restock - perDay * periodDays(e0.startDate, e0.endDate))),
      };
    }),
  };
  const e: AdvCollab = { ...e1, billing: billingOf(e1, true) };

  return [k, m, h, f, a, b, e];
}

/** 처음 상태 — 의뢰한 콜라보 · 담은 매장 없이 빈 화면에서 시작(11-10 사용자). */
export const SEED_STATE: AdvState = {
  version: 3,
  collabs: [],
  cart: [],
};

/** 새 의뢰 id — req-01, req-02 … */
export const nextRequestId = (state: AdvState) =>
  `req-${String(state.collabs.filter((c) => c.id.startsWith("req-")).length + 1).padStart(2, "0")}`;

/** 빈 의뢰 — 시작일은 기준일 45일 뒤, 14일 진행. */
export function blankRequest(state: AdvState, brand: string): AdvCollab {
  const start = addDays(T, 45);
  return plan({
    id: nextRequestId(state),
    brand,
    title: "",
    summary: "",
    type: "ready",
    course: "standard",
    startDate: start,
    endDate: addDays(start, 13),
    minStores: 6,
    targetStores: Math.max(10, state.cart.length),
    prepDays: 3,
    // 콜라보 구성은 고르면 조건을 꼭 적어야 해서 미리 골라 두지 않는다(11-10).
    items: [],
    // 매장 운영(할 일 · 수량 · 혜택 등)은 11-11부터 의뢰서에서 받지 않는다 — admix와 협의해 정한다.
    task: "",
    space: "",
    quantityPerStore: 0,
    targetRatio: 0.2,
    benefit: "",
    status: "requested",
  });
}

const isBaseItem = (k: string): k is BaseItem => Object.hasOwn(ITEM_LABEL, k);

/**
 * 서버에 보낸 의뢰(081) → 내 콜라보 한 줄(11-12). 다른 탭 · 다시 로그인하면 이 탭 저장소엔 없으니 서버 값으로 다시 그린다.
 * 아직 admix 검토 단계(검토 중)만 있다 — 승인 뒤 단계는 예시 화면 그대로. id 는 서버 의뢰 id 를 그대로 쓴다.
 */
export function collabOfRequest(r: CollabRequestMine): AdvCollab {
  // 기획안이 오갔으면(085) 마지막 차수 내용이 지금 콜라보 — 처음 의뢰서는 plan.original 에 남는다.
  const rounds = r.rounds ?? [];
  const c = rounds.length ? rounds[rounds.length - 1].content : null;
  const title = c?.title ?? r.title;
  const summary = c ? c.summary : r.summary;
  const startDate = c?.startDate ?? r.startDate;
  const endDate = c?.endDate ?? r.endDate;
  const course = c?.course ?? r.course;
  const rows = (c?.items ?? r.items).filter((x) => isBaseItem(x.key));
  const items = rows.map((x) => x.key as BaseItem);
  const itemPrep = Object.fromEntries(rows.map((x) => [x.key, PREP_OF[x.prep] ?? PREP_OF.ready])) as AdvCollab["itemPrep"];
  const preferred = c?.preferred ?? r.preferred;
  const avg = c?.estimate?.avg || r.estimate?.avg;
  return plan({
    id: r.id,
    requestId: r.id,
    requestCode: r.code,
    brand: r.brandName,
    brandId: r.brandId,
    brandImage: r.brandImageUrl,
    title,
    summary: summary ?? "",
    type: typeOfPrep(items, itemPrep),
    course: course === "rush" ? "rush" : "standard",
    startDate,
    endDate,
    minStores: c?.minStores ?? r.minStores,
    targetStores: c?.targetStores ?? r.targetStores,
    // 의뢰서와 같은 규칙 — 제작하는 기본안이 있으면 제작 기간(30일), 아니면 최소 준비(3일).
    prepDays: makeItems({ items, itemPrep }).length ? MAKE_DAYS : 3,
    items,
    itemNotes: Object.fromEntries(rows.map((x) => [x.key, x.note])),
    itemPrep,
    extraPlan: (c ? c.extraPlan : r.extraPlan) ?? undefined,
    extraPlanFile: r.planFile ?? undefined,
    contact: { same: false, ...r.contact },
    task: "",
    space: "",
    quantityPerStore: 0,
    targetRatio: 0.2,
    benefit: "",
    // 서버 상태(085) → 화면 단계: admix 기획안이 옴 = 기획안 확인(returned), 내가 확정 = 승인(approved, 진행 단계는 아직 예시),
    // 접수 · 내가 고쳐 보냄 = admix 검토 중. 취소한 의뢰도 지우지 않고 "취소"로 남긴다(084, 11-12 사용자).
    status:
      r.status === "cancelled"
        ? "cancelled"
        : r.status === "proposed"
          ? "returned"
          : r.status === "confirmed"
            ? "approved"
            : "requested",
    requestStatus: r.status as CollabRequestStatus,
    plan: { original: r.original, rounds, confirmedAt: r.confirmedAt ?? null },
    // 기획안이 오가기 전에 고쳐 다시 보냈으면 그때, 아니면 처음 보낸 때(광고주가 기획안을 고쳐 보내도 updatedAt 이 바뀐다).
    originalAt:
      rounds[0] && Date.parse(r.updatedAt) >= Date.parse(rounds[0].createdAt) ? r.createdAt : r.updatedAt || r.createdAt,
    approvedAt: r.confirmedAt ?? undefined,
    cancelledAt: r.cancelledAt ?? undefined,
    // 고쳐 다시 보냈으면 그때 — 화면의 "의뢰" 시각.
    requestedAt: r.updatedAt || r.createdAt,
    memo: r.memo ?? undefined,
    preferred: preferred.map((p) => ({
      id: p.id,
      name: p.name,
      area: p.area,
      grade: (p.grade as CollabGrade | null) ?? null,
      fee: p.fee,
    })),
    ...(avg ? { estimateAvg: avg } : {}),
  });
}

