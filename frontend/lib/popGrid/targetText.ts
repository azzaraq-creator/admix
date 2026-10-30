import type { PopAge, PopMetric, PopSex, PopTarget } from "@/hooks/popGrid";

// 타깃 조건 글 — 매체 찾기 "타깃" 목록과 어드민 "타깃 관리"가 함께 쓴다.

const METRIC_TEXT: Record<PopMetric, string> = {
  live: "생활인구",
  household: "거주인구",
  subway: "지하철",
  walk: "보행",
  flow: "유동인구",
  people: "생활·체류인구",
};
const SEX_TEXT: Record<PopSex, string> = {
  all: "남녀 전체",
  M: "남성",
  F: "여성",
};
const ageText = (a: PopAge) => (a === "60" ? "60대 이상" : `${a}대`);

/** 타깃 조건 한 줄 — "생활인구 + 거주인구 · 남녀 전체 · 50대·60대 이상". 성별·연령은 생활인구일 때만 붙인다. */
export function popTargetText(
  t: Pick<PopTarget, "metric" | "extras" | "sex" | "ages">,
): string {
  const parts = [
    [t.metric, ...t.extras].map((m) => METRIC_TEXT[m]).join(" + "),
  ];
  if (t.metric === "live") {
    parts.push(SEX_TEXT[t.sex]);
    parts.push(t.ages.length ? t.ages.map(ageText).join("·") : "전 연령");
  }
  return parts.join(" · ");
}
