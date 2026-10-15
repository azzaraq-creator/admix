// 등급 설문 — 어드민 매체 상세 "등급·추천". 매체 종류에 따라 질문 묶음이 달라진다.
// 답은 media.grade_survey 에 {질문 ID: 답 값} 으로 저장하고, 답별 점수(points)로 품질 점수·최종 등급을 매긴다
// (기준: docs/policies/media-grade-survey.md "점수").
// 질문·답의 ID(value)는 저장값이라 한번 쓰기 시작하면 바꾸지 않는다 — 문구(label)·점수(points)는 고쳐도 된다.

export interface SurveyOption {
  value: string;
  label: string;
  points: number;
}

export interface SurveyQuestion {
  id: string;
  label: string;
  help?: string;
  options: SurveyOption[];
}

export interface SurveyGroup {
  key: string;
  title: string;
  questions: SurveyQuestion[];
}

/** 질문 묶음을 고를 때 보는 매체 값 */
export interface SurveyMediaKind {
  mediaSource: string;
  exposureType: string;
  oohType: string;
  /** 소분류 — 야립빌보드는 유동인구 대신 차량 통행량을 묻는다 */
  categorySmall: string;
  /** 서버가 유동인구 단계를 매겼는지(저장된 값 기준) — 못 매긴 고정 매체는 주변 유동인구를 대신 묻는다 */
  hasPopulationTier: boolean;
}

/** 저장값 — 질문 ID → 답 값. 메모는 NOTE_KEY. */
export type SurveyAnswers = Record<string, string>;

export const NOTE_KEY = "note";

const opts = (...rows: [string, string, number][]): SurveyOption[] =>
  rows.map(([value, label, points]) => ({ value, label, points }));

/** 가림 — 묶음마다 배점이 달라 점수를 받는다(없음·일부·많음). */
const obstruction = (
  none: number,
  partial: number,
  help = "가로수·기둥·다른 간판·사람에 가려지는 정도",
): SurveyQuestion => ({
  id: "obstruction",
  label: "가림",
  help,
  options: opts(
    ["none", "없음", none],
    ["partial", "일부 가림", partial],
    ["heavy", "많이 가림", 0],
  ),
});

/** 주변 다른 광고 — 묶음마다 배점이 달라 점수를 받는다(단독·2~3개·4개 이상). */
const competition = (
  alone: number,
  few: number,
  many: number,
  label = "주변 다른 광고",
  help = "한눈에 같이 보이는 다른 광고 수",
): SurveyQuestion => ({
  id: "competition",
  label,
  help,
  options: opts(
    ["alone", "단독", alone],
    ["few", "2~3개", few],
    ["many", "4개 이상", many],
  ),
});

const OUTDOOR: SurveyGroup = {
  key: "outdoor",
  title: "실외 매체",
  questions: [
    {
      id: "road_position",
      label: "도로와의 위치",
      options: opts(
        ["corner", "교차로(사거리) 모서리", 12],
        ["facing_intersection", "교차로를 마주 봄", 9],
        ["main_road", "대로변(교차로 아님)", 6],
        ["side_road", "이면도로·골목", 2],
      ),
    },
    {
      id: "road_width",
      label: "마주한 도로 폭",
      options: opts(
        ["8_plus", "8차로 이상", 8],
        ["4_6", "4~6차로", 6],
        ["2_or_less", "2차로 이하", 3],
        ["pedestrian", "보행자 전용", 5],
      ),
    },
    {
      id: "view_distance",
      label: "가시거리",
      help: "광고 내용을 알아볼 수 있는 가장 먼 거리",
      options: opts(
        ["200_plus", "200m 이상", 12],
        ["100_200", "100~200m", 9],
        ["50_100", "50~100m", 5],
        ["under_50", "50m 미만", 2],
      ),
    },
    obstruction(10, 5),
    {
      id: "view_angle",
      label: "보는 방향",
      help: "차량·보행자가 오는 방향에서 매체가 보이는 각도",
      options: opts(
        ["front", "정면", 8],
        ["diagonal", "비스듬히", 5],
        ["side", "옆면(지나치며 봄)", 2],
      ),
    },
    {
      id: "height",
      label: "설치 높이",
      options: opts(
        ["eye", "눈높이(지상 1~2층)", 3],
        ["middle", "건물 중간", 5],
        ["top", "옥상·최상단", 4],
      ),
    },
    {
      id: "signal_wait",
      label: "신호 대기 차량이 보는지",
      help: "앞에 신호등·정체 구간이 있어 멈춘 차량이 바라보는지",
      options: opts(["yes", "예", 5], ["no", "아니오", 0]),
    },
    competition(5, 3, 1),
  ],
};

/** 야립 광고 — 운전자가 빠르게 지나가며 멀리서 보는 매체라 실외 매체 질문 대신 묻는다. */
const ROADSIDE: SurveyGroup = {
  key: "roadside",
  title: "야립 광고",
  questions: [
    {
      id: "view_distance",
      label: "가시거리",
      help: "차에서 광고 내용을 알아볼 수 있는 가장 먼 거리",
      options: opts(
        ["500_plus", "500m 이상", 14],
        ["300_500", "300~500m", 10],
        ["150_300", "150~300m", 6],
        ["under_150", "150m 미만", 2],
      ),
    },
    {
      id: "road_shape",
      label: "도로 모양",
      help: "다가오는 차에서 매체가 어떻게 보이는지",
      options: opts(
        ["straight_front", "직선 구간 정면", 10],
        ["curve_outer", "곡선 바깥쪽(정면으로 들어옴)", 8],
        ["side", "옆으로 지나치며 봄", 3],
      ),
    },
    {
      id: "vehicle_speed",
      label: "차량 속도",
      options: opts(
        ["slow", "자주 막히거나 서행(톨게이트·JC 근처 등)", 10],
        ["normal", "보통", 6],
        ["fast", "늘 빠름", 3],
      ),
    },
    obstruction(10, 5, "방음벽·나무·다른 구조물에 가려지는 정도"),
    {
      id: "view_directions",
      label: "보이는 방향",
      options: opts(["both", "양방향 모두", 8], ["one", "한 방향만", 4]),
    },
    {
      id: "road_distance",
      label: "도로와의 거리",
      options: opts(
        ["under_50", "50m 이내", 8],
        ["50_150", "50~150m", 5],
        ["150_plus", "150m 이상", 2],
      ),
    },
    competition(5, 3, 1, "주변 다른 야립", "한눈에 같이 보이는 다른 야립 수"),
  ],
};

const INDOOR: SurveyGroup = {
  key: "indoor",
  title: "실내 매체",
  questions: [
    {
      id: "spot",
      label: "놓인 곳",
      options: opts(
        ["entrance", "출입구·개찰구 바로 앞", 18],
        ["main_path", "주 동선(통로·에스컬레이터)", 14],
        ["waiting", "대기 장소(승강장·엘리베이터 앞)", 12],
        ["off_path", "동선에서 벗어남", 3],
      ),
    },
    {
      id: "dwell",
      label: "머무는 시간",
      options: opts(
        ["long", "오래 머묾(대기·줄)", 14],
        ["short", "잠깐 멈춤", 9],
        ["pass", "지나감", 4],
      ),
    },
    {
      id: "eye_level",
      label: "시선 높이",
      options: opts(
        ["eye", "눈높이", 10],
        ["slight", "조금 위·아래", 6],
        ["far", "고개를 들거나 숙여야 봄", 2],
      ),
    },
    {
      id: "view_distance",
      label: "보이는 거리",
      options: opts(
        ["20_plus", "20m 이상", 8],
        ["10_20", "10~20m", 5],
        ["under_10", "10m 미만", 2],
      ),
    },
    obstruction(8, 4),
    competition(7, 4, 1),
  ],
};

const MOVING: SurveyGroup = {
  key: "moving",
  title: "이동 매체",
  questions: [
    {
      id: "ad_face",
      label: "광고 면 위치",
      options: opts(
        ["outside_side", "차량 바깥 옆면", 25],
        ["outside_rear", "차량 바깥 뒷면", 20],
        ["inside", "차량 안", 12],
      ),
    },
    {
      id: "route_area",
      label: "주로 다니는 곳",
      options: opts(
        ["downtown", "도심·번화가", 30],
        ["residential", "주거 지역", 18],
        ["outskirts", "외곽·고속도로", 10],
      ),
    },
    {
      id: "daily_hours",
      label: "하루 운행 시간",
      options: opts(
        ["12_plus", "12시간 이상", 20],
        ["6_12", "6~12시간", 13],
        ["under_6", "6시간 미만", 6],
      ),
    },
    {
      id: "vehicle_count",
      label: "광고가 붙는 차량 수",
      options: opts(
        ["50_plus", "50대 이상", 20],
        ["10_49", "10~49대", 13],
        ["under_10", "10대 미만", 6],
      ),
    },
  ],
};

/** DOOH(디지털 화면)일 때 더 묻는 질문 */
const DIGITAL: SurveyGroup = {
  key: "digital",
  title: "디지털 화면",
  questions: [
    {
      id: "screen_quality",
      label: "화면 선명도",
      options: opts(
        ["sharp", "선명함", 3],
        ["normal", "보통", 2],
        ["dim", "흐림·낡음", 0],
      ),
    },
    {
      id: "sound",
      label: "소리 송출",
      options: opts(["yes", "가능", 2], ["no", "불가", 0]),
    },
  ],
};

/** 실외 일반(OOH) 매체 — 빌보드처럼 화면이 아닌 매체 */
const PRINT_OUTDOOR: SurveyGroup = {
  key: "print",
  title: "일반(인쇄) 매체",
  questions: [
    {
      id: "night_light",
      label: "야간 조명",
      options: opts(["yes", "있음", 5], ["no", "없음", 0]),
    },
  ],
};

/** 실내 일반(OOH) 매체 */
const PRINT_INDOOR: SurveyGroup = {
  key: "print_indoor",
  title: "일반(인쇄) 매체",
  questions: [
    {
      id: "lighting",
      label: "조명",
      help: "라이트박스처럼 광고면을 비추는 조명",
      options: opts(["yes", "있음", 5], ["no", "없음", 0]),
    },
  ],
};

/** 이동 일반(OOH) 매체 */
const MOVING_PRINT: SurveyGroup = {
  key: "moving_print",
  title: "일반(인쇄) 매체",
  questions: [
    {
      id: "ad_face_size",
      label: "광고 면 크기",
      options: opts(
        ["full_wrap", "차량 전면 래핑", 5],
        ["partial", "한 면 일부", 3],
        ["small", "작은 액자·스티커", 1],
      ),
    },
  ],
};

/** 데이터 대신 묻는 유동인구·차량 통행량 — 유동인구 단계(5→1)와 같은 점수 */
const FIVE_LEVELS = opts(
  ["very_high", "매우 많음", 30],
  ["high", "많음", 24],
  ["normal", "보통", 18],
  ["low", "적음", 12],
  ["very_low", "매우 적음", 6],
);

/** 유동인구 단계를 데이터로 못 매기는 고정 매체(서울 밖·인구 데이터 없음) — 담당자 판단으로 대신 */
const FOOT_TRAFFIC: SurveyGroup = {
  key: "foot_traffic",
  title: "유동인구 (데이터 대신)",
  questions: [
    {
      id: "foot_traffic",
      label: "주변 유동인구",
      help: "매체 앞을 지나는 사람 수 — 담당자 판단",
      options: FIVE_LEVELS,
    },
  ],
};

/** 야립 광고 — 차량 교통량 데이터가 생기기 전까지 담당자 판단으로 */
const VEHICLE_TRAFFIC: SurveyGroup = {
  key: "vehicle_traffic",
  title: "차량 통행량 (데이터 대신)",
  questions: [
    {
      id: "vehicle_traffic",
      label: "차량 통행량",
      help: "매체 앞 도로를 지나는 차량 수 — 담당자 판단",
      options: FIVE_LEVELS,
    },
  ],
};

/** 유동인구 단계별 점수(30점 만점) — 서버가 매긴 단계(1~5)로 */
const POPULATION_TIER_POINTS: Record<number, number> = {
  5: 30,
  4: 24,
  3: 18,
  2: 12,
  1: 6,
};
const POPULATION_TIER_MAX = 30;

/** 품질 점수 → 최종 등급 */
const GRADE_CUTS: [string, number][] = [
  ["S", 85],
  ["A", 70],
  ["B", 55],
  ["C", 40],
];

export function gradeOf(score: number): string {
  return GRADE_CUTS.find(([, cut]) => score >= cut)?.[0] ?? "D";
}

/** 보행 유동인구 대신 차량 교통량으로 보는 매체(소분류) — 백엔드 _VEHICLE_AUDIENCE_CATEGORIES 와 같다. */
export function isVehicleAudience(categorySmall: string): boolean {
  return categorySmall === "야립빌보드";
}

/** 유동인구 단계를 못 매긴 고정 매체(서울 밖·인구 데이터 없음)는 주변 유동인구를 대신 묻는다. 야립은 따로(차량 통행량). */
function footTrafficGroups(kind: SurveyMediaKind): SurveyGroup[] {
  return kind.hasPopulationTier ? [] : [FOOT_TRAFFIC];
}

/**
 * 이 매체에 물을 질문 묶음. 고정 매체는 실내·실외(노출 위치)를 골라야 정해진다 — 안 정해지면 빈 목록.
 * 어떤 매체든 만점이 100점이 되게 짰다 — 유동인구(야립은 차량 통행량, 또는 대신 묻는 질문) 30 + 설문 65 + 추가 5,
 * 이동은 설문 95 + 추가 5.
 */
export function surveyGroupsFor(kind: SurveyMediaKind): SurveyGroup[] {
  const isDooh = kind.oohType === "DOOH";
  if (kind.mediaSource === "MOVING")
    return [MOVING, isDooh ? DIGITAL : MOVING_PRINT];
  // 야립은 설치 장소와 상관없이 야립 질문 — 실외 매체 질문(교차로·신호 대기·설치 높이)이 맞지 않는다.
  if (isVehicleAudience(kind.categorySmall))
    return [VEHICLE_TRAFFIC, ROADSIDE, isDooh ? DIGITAL : PRINT_OUTDOOR];
  if (kind.exposureType === "OUTSIDE")
    return [
      ...footTrafficGroups(kind),
      OUTDOOR,
      isDooh ? DIGITAL : PRINT_OUTDOOR,
    ];
  if (kind.exposureType === "INSIDE")
    return [
      ...footTrafficGroups(kind),
      INDOOR,
      isDooh ? DIGITAL : PRINT_INDOOR,
    ];
  return [];
}

export interface SurveyScoreLine {
  label: string;
  /** 고른 답(유동인구 단계면 "3단계") */
  answer: string;
  points: number;
  max: number;
}

export interface SurveyScore {
  /** 0~100 — 답하지 않은 질문이 있으면 답한 것만으로 100점 환산 */
  score: number;
  grade: string;
  /** 답하지 않은 질문이 있음 */
  provisional: boolean;
  answered: number;
  total: number;
  lines: SurveyScoreLine[];
}

/**
 * 품질 점수 — 유동인구 단계(서버가 매긴 1~5, 고정 매체이고 야립이 아니며 단계가 있을 때) + 설문 답별 점수.
 * 질문의 절반 미만만 답했거나 질문이 없으면 null(점수를 매기지 않는다).
 */
export function computeSurveyScore(
  kind: SurveyMediaKind,
  answers: SurveyAnswers,
  populationTier: number | null,
): SurveyScore | null {
  const groups = surveyGroupsFor(kind);
  if (groups.length === 0) return null;
  const lines: SurveyScoreLine[] = [];
  let total = 0;
  // 유동인구 단계는 묻지 않고 자동 — 단계가 있으면 늘 "답한" 문항이다(없으면 주변 유동인구 질문이 대신 나온다).
  const tierPoints =
    kind.mediaSource !== "MOVING" &&
    !isVehicleAudience(kind.categorySmall) &&
    populationTier != null
      ? POPULATION_TIER_POINTS[populationTier]
      : undefined;
  if (tierPoints !== undefined) {
    total += 1;
    lines.push({
      label: "유동인구 단계",
      answer: `${populationTier}단계`,
      points: tierPoints,
      max: POPULATION_TIER_MAX,
    });
  }
  for (const q of groups.flatMap((g) => g.questions)) {
    total += 1;
    const picked = q.options.find((o) => o.value === answers[q.id]);
    if (!picked) continue;
    lines.push({
      label: q.label,
      answer: picked.label,
      points: picked.points,
      max: Math.max(...q.options.map((o) => o.points)),
    });
  }
  if (lines.length * 2 < total) return null;
  const got = lines.reduce((sum, l) => sum + l.points, 0);
  const max = lines.reduce((sum, l) => sum + l.max, 0);
  const score = max ? Math.round((got / max) * 100) : 0;
  return {
    score,
    grade: gradeOf(score),
    provisional: lines.length < total,
    answered: lines.length,
    total,
    lines,
  };
}

/** "등급 근거"에 남기는 글 — "등급 설문 89점 · S (임시 9/11) | 유동인구 단계 5단계 30/30 · 가시거리 200m 이상 12/12 …" */
export function scoreEvidence(s: SurveyScore): string {
  const head = `등급 설문 ${s.score}점 · ${s.grade}${
    s.provisional ? ` (임시 ${s.answered}/${s.total})` : ""
  }`;
  const body = s.lines
    .map((l) => `${l.label} ${l.answer} ${l.points}/${l.max}`)
    .join(" · ");
  return `${head} | ${body}`;
}

/**
 * 지금 질문에 없는 답(매체 종류를 바꾸기 전 답)을 빼고 저장한다. 비면 null.
 * 실외·실내·야립이 같은 질문 ID(가시거리)를 쓰지만 선택지가 달라 답 값까지 맞는지 본다.
 */
export function pruneSurvey(
  answers: SurveyAnswers,
  kind: SurveyMediaKind,
): SurveyAnswers | null {
  const valid = new Map(
    surveyGroupsFor(kind).flatMap((g) =>
      g.questions.map((q) => [q.id, q.options.map((o) => o.value)] as const),
    ),
  );
  const out: SurveyAnswers = {};
  for (const [key, value] of Object.entries(answers)) {
    const keep =
      key === NOTE_KEY ? !!value.trim() : !!valid.get(key)?.includes(value);
    if (keep) out[key] = key === NOTE_KEY ? value.trim() : value;
  }
  return Object.keys(out).length ? out : null;
}

/** 폼이 들고 있는 JSON 문자열 → 답. 읽을 수 없으면 빈 답. */
export function parseSurvey(raw: string): SurveyAnswers {
  if (!raw.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, v]) => typeof v === "string"),
    ) as SurveyAnswers;
  } catch {
    return {};
  }
}
