/**
 * 제휴사(콜라보) 매장 화면 — 예시 데이터.
 * 받은 프로토타입(카페 파트너 미리보기)을 흉내 낸 화면들이 쓰는 값이다. 실제 브랜드·신청·확정이 아니고,
 * 서버 기능은 사용자가 하나씩 정해 주면 붙인다. 화면에서 누른 결과(신청·확정·사진·대화)는 이 브라우저 탭에만 남는다.
 */

/** 예시 기준일 — 진행 단계(모집 중·예정·진행 중·완료)를 이 날짜로 나눈다. */
export const PREVIEW_TODAY = "2026-11-06";

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
  /** 브라우저에서 줄인 사진(data URL). 예시 기록은 없다. */
  thumb?: string;
}

export interface PreviewCollab {
  id: string;
  brand: string;
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
}

export interface PreviewMessage {
  id: string;
  author: "admix" | "cafe";
  name: string;
  text: string;
  at: string;
}

export interface PreviewState {
  collabs: PreviewCollab[];
  /** 확인한 공지 id. */
  reads: string[];
  /** 재입고를 요청한 콜라보 id. */
  restocks: string[];
  messages: PreviewMessage[];
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

/** 시작·종료일로 설치(전날)·철수(다음 날)·점검일(25%·60%·90%)을 만든다. */
function schedule(
  recruitStart: string,
  recruitEnd: string,
  confirmDue: string,
  startDate: string,
  endDate: string,
) {
  const days = periodDays(startDate, endDate);
  const checks = ([0.25, 0.6, 0.9] as const).map((pct, i) => {
    const day = Math.max(1, Math.round(days * pct));
    return {
      step: (["check1", "check2", "check3"] as const)[i],
      date: addDays(startDate, day - 1),
      day,
    };
  });
  return {
    recruitStart,
    recruitEnd,
    confirmDue,
    installDate: addDays(startDate, -1),
    startDate,
    endDate,
    removalDate: addDays(endDate, 1),
    checks,
  };
}

/** 이미 끝난 콜라보의 사진 기록 — 설치는 ADMIX, 점검은 매장. */
const donePhotos = (s: ReturnType<typeof schedule>): PreviewPhoto[] => [
  { step: "install", at: kst(s.installDate, "15:10"), by: "admix" },
  ...s.checks.map((c) => ({
    step: c.step,
    at: kst(c.date, "18:30"),
    by: "cafe" as const,
  })),
];

const sB = schedule(
  "2026-10-13",
  "2026-10-20",
  kst("2026-10-27", "18:00"),
  "2026-11-03",
  "2026-11-14",
);
const sC = schedule(
  "2026-10-27",
  "2026-11-03",
  kst("2026-11-08", "18:00"),
  "2026-11-24",
  "2026-11-30",
);
const sA = schedule(
  "2026-11-04",
  "2026-11-12",
  kst("2026-11-17", "18:00"),
  "2026-12-08",
  "2026-12-19",
);
const sD = schedule(
  "2026-11-02",
  "2026-11-10",
  kst("2026-11-12", "18:00"),
  "2026-11-13",
  "2026-11-19",
);
const sE = schedule(
  "2026-11-05",
  "2026-11-19",
  kst("2026-11-26", "18:00"),
  "2027-01-05",
  "2027-01-16",
);
const sF = schedule(
  "2026-07-27",
  "2026-08-03",
  kst("2026-08-07", "18:00"),
  "2026-08-18",
  "2026-08-29",
);
const sG = schedule(
  "2026-09-14",
  "2026-09-21",
  kst("2026-09-25", "18:00"),
  "2026-10-06",
  "2026-10-12",
);
const sH = schedule(
  "2026-08-24",
  "2026-08-31",
  kst("2026-09-04", "18:00"),
  "2026-09-14",
  "2026-09-20",
);
const sI = schedule(
  "2026-09-28",
  "2026-10-05",
  kst("2026-10-09", "18:00"),
  "2026-10-20",
  "2026-10-25",
);

const SAMPLING = {
  label: "샘플링",
  note: "구매 시 증정 · 1인 1개 · 상온 보관",
};

export const SEED_COLLABS: PreviewCollab[] = [
  {
    id: "offer-b",
    brand: "브랜드 B",
    title: "가을 블렌드 테이스팅",
    summary: "카운터 옆 진열대에서 가을 블렌드 드립백을 소개하는 콜라보예요.",
    type: "ready",
    ...sB,
    task: "음료 구매 고객에게 드립백 샘플 1개 증정 (1인 1개)",
    items: [
      SAMPLING,
      { label: "매장 DP", note: "진열대 1개 · 제품 3종 진열 유지" },
    ],
    space: "카운터 옆 진열대",
    quantity: 250,
    benefit: "원두 1kg",
    staffScript:
      "가을 블렌드 드립백 샘플이에요. 음료 주문하시면 하나 드릴게요.",
    targetStores: 8,
    appliedStores: 8,
    standing: "confirmed",
    confirmNo: "CF-20261026-0012",
    confirmedAt: kst("2026-10-26", "14:20"),
    confirmer: "예시 담당자",
    checkedItems: 7,
    notices: [
      {
        id: "b-n1",
        title: "설치를 마쳤어요",
        body: "진열대와 드립백 250개를 설치했어요. 직원용 안내 카드는 계산대 옆에 두었습니다.",
        author: "ADMIX 운영팀",
        at: kst("2026-11-02", "16:00"),
      },
      {
        id: "b-n2",
        title: "드립백 재입고 일정 안내",
        body: "소진이 빠른 매장은 11.08(일)에 재입고해요. 남은 수량이 50개 아래면 '재입고 요청'을 눌러 주세요.",
        author: "ADMIX 운영팀",
        at: kst("2026-11-05", "10:30"),
      },
    ],
    photos: [{ step: "install", at: kst("2026-11-02", "15:10"), by: "admix" }],
  },
  {
    id: "offer-c",
    brand: "브랜드 C",
    title: "겨울 굿즈 쇼케이스",
    summary: "매장 확정 후 수량에 맞춰 제작한 브랜드 굿즈를 증정해요.",
    type: "made",
    ...sC,
    task: "음료 구매 고객에게 브랜드 키링 1개 증정 (1인 1개, 소진 시 종료)",
    items: [
      { label: "굿즈 증정", note: "구매 고객 증정 · 소진 전 재입고 요청" },
      { label: "포스터 부착", note: "입구 쪽 A3 1장" },
    ],
    space: "계산대 앞 소형 쇼케이스",
    quantity: 150,
    benefit: "굿즈 세트 2개",
    staffScript: "겨울 키링 증정 중이에요. 음료 주문하시면 하나 골라 가세요.",
    targetStores: 6,
    appliedStores: 6,
    standing: "requested",
    notices: [],
    photos: [],
  },
  {
    id: "offer-a",
    brand: "브랜드 A",
    title: "가을 티 샘플링",
    summary:
      "음료를 산 손님에게 시즌 티백을 건네며 새 블렌드를 알리는 콜라보예요.",
    type: "ready",
    ...sA,
    task: "음료 구매 고객에게 티백 샘플 1개 증정 (1인 1개)",
    items: [SAMPLING, { label: "포스터 부착", note: "계산대 옆 A4 1장" }],
    space: "계산대 옆 선반",
    quantity: 300,
    benefit: "브랜드 티 세트 1박스",
    staffScript:
      "가을 티 샘플 드리고 있어요. 음료 주문하시면 하나 챙겨 드릴게요.",
    targetStores: 10,
    appliedStores: 6,
    standing: "none",
    notices: [],
    photos: [],
  },
  {
    id: "offer-e",
    brand: "브랜드 E",
    title: "홀리데이 시럽 테이스팅",
    summary: "연말 시즌 시럽을 넣은 음료를 소개하는 콜라보예요.",
    type: "ready",
    ...sE,
    task: "주문 시 시즌 시럽 추가를 안내하고 시음 컵 제공",
    items: [
      { label: "샘플링", note: "시음 컵 30ml · 하루 최대 50컵" },
      { label: "매장 DP", note: "시럽 2종 진열" },
    ],
    space: "쇼케이스 하단",
    quantity: 200,
    benefit: "시럽 3종 세트",
    staffScript: "연말 한정 시럽이에요. 한 모금 맛보시겠어요?",
    targetStores: 8,
    appliedStores: 9,
    standing: "none",
    notices: [],
    photos: [],
  },
  {
    id: "offer-d",
    brand: "브랜드 D",
    title: "오브제 전시 위크",
    summary: "창가 선반에 소형 오브제를 전시하고 브랜드 카드를 안내해요.",
    type: "ready",
    ...sD,
    task: "지정 선반에 소형 오브제 진열 유지, 문의 고객에게 브랜드 카드 안내",
    items: [
      { label: "매장 DP", note: "선반 1칸 · 오브제 5점" },
      { label: "포스터 부착", note: "선반 옆 엽서형 안내 카드" },
    ],
    space: "창가 선반 1칸",
    quantity: 100,
    benefit: "전시 오브제 1점 증정",
    staffScript: "이번 주 전시 중인 오브제예요. 궁금하시면 카드 가져가세요.",
    targetStores: 10,
    appliedStores: 4,
    standing: "blocked",
    notices: [],
    photos: [],
  },
  {
    id: "offer-g",
    brand: "브랜드 G",
    title: "가을 원두 시음회",
    summary: "주말 오후 시간에 새 원두를 시음하는 콜라보였어요.",
    type: "ready",
    ...sG,
    task: "주말 14~17시 시음 컵 제공",
    items: [{ label: "샘플링", note: "시음 컵 30ml" }],
    space: "입구 쪽 벽면",
    quantity: 200,
    benefit: "원두 500g × 2",
    staffScript: "새로 나온 원두 시음 중이에요.",
    targetStores: 6,
    appliedStores: 6,
    standing: "confirmed",
    confirmNo: "CF-20260924-0007",
    confirmedAt: kst("2026-09-24", "11:05"),
    confirmer: "예시 담당자",
    checkedItems: 7,
    notices: [],
    photos: donePhotos(sG),
  },
  {
    id: "offer-f",
    brand: "브랜드 F",
    title: "여름 아이스티 샘플링",
    summary: "여름 한정 아이스티 파우치를 나눠 드린 콜라보였어요.",
    type: "ready",
    ...sF,
    task: "음료 구매 고객에게 아이스티 파우치 1개 증정",
    items: [SAMPLING],
    space: "계산대 옆 선반",
    quantity: 300,
    benefit: "아이스티 세트 1박스",
    staffScript: "여름 아이스티 샘플 드리고 있어요.",
    targetStores: 10,
    appliedStores: 10,
    standing: "confirmed",
    confirmNo: "CF-20260806-0003",
    confirmedAt: kst("2026-08-06", "17:40"),
    confirmer: "예시 담당자",
    checkedItems: 7,
    notices: [],
    photos: donePhotos(sF),
  },
  {
    id: "offer-h",
    brand: "브랜드 H",
    title: "디저트 페어링 위크",
    summary: "디저트와 어울리는 티를 함께 소개하는 콜라보였어요.",
    type: "made",
    ...sH,
    task: "디저트 주문 고객에게 페어링 카드 안내",
    items: [{ label: "포스터 부착", note: "테이블 텐트 10개" }],
    space: "테이블 위",
    quantity: 100,
    benefit: "티 세트 1박스",
    staffScript: "",
    targetStores: 6,
    appliedStores: 6,
    standing: "declined",
    notices: [],
    photos: [],
  },
  {
    id: "offer-i",
    brand: "브랜드 I",
    title: "핸드드립 클래스",
    summary: "매장에서 짧은 핸드드립 클래스를 여는 콜라보였어요.",
    type: "ready",
    ...sI,
    task: "주말 1회 클래스 공간 제공",
    items: [{ label: "브랜드 현장 인력 방문", note: "바리스타 1명" }],
    space: "테이블 2개",
    quantity: 20,
    benefit: "드립 세트 1개",
    staffScript: "",
    targetStores: 4,
    appliedStores: 4,
    standing: "cancelled",
    confirmNo: "CF-20261008-0004",
    confirmedAt: kst("2026-10-08", "10:00"),
    notices: [],
    photos: [],
  },
];

export const SEED_MESSAGES: PreviewMessage[] = [
  {
    id: "m1",
    author: "admix",
    name: "ADMIX 담당자",
    text: "기본협약 동의 감사합니다. 콜라보 모집이 열리면 이메일과 이 화면에서 알려 드릴게요.",
    at: kst("2026-10-01", "10:12"),
  },
  {
    id: "m2",
    author: "cafe",
    name: "우리 매장",
    text: "브랜드 B 진열대는 계산대 왼쪽에 두어도 될까요?",
    at: kst("2026-11-01", "13:40"),
  },
  {
    id: "m3",
    author: "admix",
    name: "ADMIX 담당자",
    text: "네, 가능해요. 설치하는 날 위치를 같이 확인하고 사진으로 남겨 둘게요.",
    at: kst("2026-11-01", "14:05"),
  },
];

export const SEED_STATE: PreviewState = {
  collabs: SEED_COLLABS,
  reads: ["b-n1"],
  restocks: [],
  messages: SEED_MESSAGES,
};

// ── 화면에서 쓰는 계산 ─────────────────────────────────

/** 목록 칸 — 미참여·취소, 마감했는데 신청 안 한 콜라보는 목록에 없다(참여 이력에만). */
export function categoryOf(
  c: PreviewCollab,
  today = PREVIEW_TODAY,
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

/** 카드·상세 위 상태 칩. */
export function chipOf(
  c: PreviewCollab,
  today = PREVIEW_TODAY,
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
export function dueStepOf(c: PreviewCollab, today = PREVIEW_TODAY) {
  if (c.standing !== "confirmed") return undefined;
  return c.checks.find(
    (k) => k.date <= today && !c.photos.some((p) => p.step === k.step),
  );
}

/** 다음 할 일 한 줄. */
export function nextActionOf(c: PreviewCollab, today = PREVIEW_TODAY) {
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
          : `철수 ${md(c.removalDate)} · ADMIX가 회수해요`;
      }
      return `설치 ${md(c.installDate)} · ADMIX가 방문 세팅해요`;
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
      value: `${c.quantity.toLocaleString("ko-KR")}개 · 소진이 빠르면 ADMIX가 재입고`,
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
  today = PREVIEW_TODAY,
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
export function todosOf(state: PreviewState, today = PREVIEW_TODAY) {
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
  return todos;
}
