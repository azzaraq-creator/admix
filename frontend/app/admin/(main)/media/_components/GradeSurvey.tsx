"use client";

import {
  Button,
  Popover,
  Table,
  TextArea,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { CircleHelp } from "lucide-react";

import type { GradeSuggestions, PopulationTier } from "@/hooks/media";
import { cn } from "@/lib/utils";

import {
  isVehicleAudience,
  NOTE_KEY,
  surveyGroupsFor,
  type SurveyAnswers,
  type SurveyMediaKind,
} from "./gradeSurveyQuestions";

/**
 * 어드민 매체 상세 "등급 설문" — 매체 종류(실외·실내·이동, DOOH)에 맞는 질문에 답한다.
 * 고른 답을 다시 누르면 답을 지운다. 점수는 아직 매기지 않는다.
 * 맨 위 "유동인구 단계"는 서버가 월평균 유동인구로 자동으로 매긴 값이다(묻지 않는다).
 * 서버가 도로 데이터·설명글로 고른 추천 답(suggestions)은 이 탭을 열 때 폼(MediaFormView)이 빈 질문에 넣어 둔다.
 * 추천 답에는 "자동" 표시와 근거를 붙이고, 담당자가 다른 답을 골라 지운 추천은 점선 칩으로 남긴다.
 */
export function GradeSurvey({
  kind,
  answers,
  onChange,
  populationTier,
  suggestions = {},
}: {
  kind: SurveyMediaKind;
  answers: SurveyAnswers;
  onChange: (next: SurveyAnswers) => void;
  populationTier?: PopulationTier;
  suggestions?: GradeSuggestions;
}) {
  const groups = surveyGroupsFor(kind);
  const tierBox =
    kind.mediaSource !== "MOVING" && isVehicleAudience(kind.categorySmall) ? (
      <TrafficTierBox />
    ) : (
      <PopulationTierBox data={populationTier} />
    );
  if (groups.length === 0) {
    return (
      <div className="flex flex-col gap-[16px]">
        {tierBox}
        <div className="rounded-[12px] bg-gray-50 px-[16px] py-[14px] text-[13px] text-gray-500">
          기본 정보에서 설치 장소(공간형·외부형)를 고르면 그 매체에 맞는 질문이
          나와요.
        </div>
      </div>
    );
  }

  const questions = groups.flatMap((g) => g.questions);
  const answered = questions.filter((q) =>
    q.options.some((o) => o.value === answers[q.id]),
  ).length;
  const set = (key: string, value: string) => {
    const next = { ...answers };
    if (value) next[key] = value;
    else delete next[key];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-[16px]">
      {tierBox}
      <p className="w-fit rounded-full bg-gray-50 px-[10px] py-[3px] text-[12px] font-semibold text-gray-600">
        {groups.map((g) => g.title).join(" · ")} 질문 · {questions.length}개 중{" "}
        {answered}개 답함
      </p>

      {/* 질문 묶음 — 테두리 상자 대신 위에 가는 줄로 나눈다(2026-11-12 어드민 흰 카드 · 테두리 없음). */}
      {groups.map((group) => (
        <div
          key={group.key}
          className="flex flex-col gap-[14px] border-t border-separator pt-[16px]"
        >
          <h3 className="text-[15px] font-bold text-black">{group.title}</h3>
          {group.questions.map((q) => {
            const sug = suggestions[q.id];
            const sugValue = q.options.some((o) => o.value === sug?.value)
              ? sug?.value
              : undefined;
            return (
              <div
                key={q.id}
                className="grid grid-cols-[180px_1fr] items-start gap-[12px] max-sm:grid-cols-1"
              >
                <div className="flex flex-col gap-[2px] pt-[6px]">
                  <p className="text-[13px] font-semibold text-gray-900">
                    {q.label}
                  </p>
                  {q.help && (
                    <p className="text-[12px] text-gray-400">{q.help}</p>
                  )}
                  {sugValue && (
                    <p className="text-[12px] text-primary-500">
                      자동 · {sug?.reason}
                    </p>
                  )}
                </div>
                {/* 하나만 고르기(radiogroup). 빈 선택을 허용해 고른 답을 다시 누르면 답이 지워진다. */}
                <ToggleButtonGroup
                  aria-label={q.label}
                  selectionMode="single"
                  isDetached
                  size="sm"
                  selectedKeys={answers[q.id] ? [answers[q.id]] : []}
                  onSelectionChange={(keys) => {
                    const [picked] = [...keys];
                    set(q.id, picked == null ? "" : String(picked));
                  }}
                  className="flex flex-wrap justify-start gap-[6px]"
                >
                  {q.options.map((o) => {
                    const on = answers[q.id] === o.value;
                    // 추천 답 — "자동" 표시. 고르지 않은 추천(담당자가 바꾼 답)은 점선 테두리.
                    const suggested = o.value === sugValue;
                    return (
                      <ToggleButton
                        key={o.value}
                        id={o.value}
                        className={cn(
                          "gap-[4px] text-[13px]",
                          suggested &&
                            !on &&
                            "border border-dashed border-primary-400 text-primary-600",
                        )}
                      >
                        {o.label}
                        {suggested && (
                          <span className="text-[11px] font-semibold text-primary-400">
                            자동
                          </span>
                        )}
                      </ToggleButton>
                    );
                  })}
                </ToggleButtonGroup>
              </div>
            );
          })}
        </div>
      ))}

      <TextArea
        variant="secondary"
        fullWidth
        rows={3}
        aria-label="설문 메모"
        placeholder="메모 — 답을 고른 이유나 현장 확인 내용(선택)"
        value={answers[NOTE_KEY] ?? ""}
        onChange={(e) => set(NOTE_KEY, e.target.value)}
      />
    </div>
  );
}

/** 120만 → "120만", 1,675,317 → "168만", 9,000 → "9,000" */
function formatPeople(n: number): string {
  return n >= 10000
    ? `${Math.round(n / 10000).toLocaleString()}만`
    : n.toLocaleString();
}

/** 설문 맨 위 단계 상자 — 이름·"?" 기준 팝오버·값·설명. */
function TierBox({
  label,
  value,
  detail,
  filled,
  children,
}: {
  label: string;
  value: string;
  detail: string | null;
  /** 단계가 매겨졌는지 — 아니면 값을 흐리게 */
  filled: boolean;
  /** "?"를 누르면 뜨는 기준 설명 */
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-[16px] rounded-[12px] bg-gray-50 px-[16px] py-[14px]">
      <div className="flex shrink-0 items-center gap-[4px]">
        <p className="text-[13px] font-semibold text-gray-600">{label}</p>
        <Popover>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={`${label} 기준`}
            className="size-[20px] min-w-0 rounded-[7px] p-0 text-gray-400 data-[hovered=true]:bg-transparent data-[hovered=true]:text-gray-600"
          >
            <CircleHelp className="size-[16px]" />
          </Button>
          <Popover.Content className="w-[300px]">
            <Popover.Dialog>
              <Popover.Heading className="text-[13px] font-bold text-black">
                {label} 기준
              </Popover.Heading>
              {children}
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
      </div>
      <div className="flex min-w-0 flex-col gap-[2px]">
        <p
          className={cn(
            "text-[18px] font-bold leading-tight",
            filled ? "text-gray-900" : "text-gray-400",
          )}
        >
          {value}
        </p>
        {detail && <p className="text-[12px] text-gray-500">{detail}</p>}
      </div>
    </div>
  );
}

const TIER_HELP_CLASS = "mt-[4px] text-[12px] leading-[18px] text-gray-500";
// 기준표 칸 — 팝오버 바탕을 그대로 보이게(칸 흰 바탕 끔) 하고 12px로 촘촘하게.
const TIER_CELL_CLASS = "bg-transparent px-[8px] py-[6px] text-[12px]";

/** 자동으로 매긴 유동인구 단계와 단계 기준표. */
function PopulationTierBox({ data }: { data?: PopulationTier }) {
  let value: string;
  let detail: string | null = null;
  if (!data) {
    value = "저장하면 계산돼요";
  } else if (data.excluded) {
    value = "해당 없음";
    detail = data.excluded;
  } else if (data.tier == null) {
    value = "데이터 없음";
    detail =
      "이 매체 주변 서울시 상권 유동인구가 없어요. 그동안은 아래 '주변 유동인구' 질문으로 대신 매기고, 위치·인구 탭에서 월평균 유동인구를 직접 입력하면 단계가 매겨져요.";
  } else {
    value = `${data.tier}단계`;
    detail = `월평균 ${formatPeople(data.monthly ?? 0)} 명${data.place ? ` · ${data.place}` : ""}`;
  }
  return (
    <TierBox
      label="유동인구 단계"
      value={value}
      detail={detail}
      filled={data?.tier != null}
    >
      <p className={TIER_HELP_CLASS}>
        매체 정보 팝업의 월평균 유동인구로 자동으로 매겨요. 직접 입력한 값이
        있으면 그 값, 없으면 매체 반경 500m 안에서 가장 붐비는 서울시 상권
        값이에요. 서울 고정 매체만 매기고, 단계가 없는 매체(서울 밖·데이터
        없음)는 ‘주변 유동인구’ 질문으로 대신 매겨요.
      </p>
      {/* 팝오버 속 작은 기준표 — HeroUI 표(secondary)를 12px·좁은 여백으로 줄이고, 지금 단계 줄은 굵은 보라. */}
      {!!data?.tiers?.length && (
        <Table variant="secondary" className="mt-[10px]">
          <Table.ScrollContainer>
            <Table.Content aria-label="유동인구 단계 기준">
              <Table.Header>
                <Table.Column
                  id="tier"
                  isRowHeader
                  className="px-[8px] py-[4px] text-[11px]"
                >
                  단계
                </Table.Column>
                <Table.Column
                  id="range"
                  className="px-[8px] py-[4px] text-right text-[11px]"
                >
                  월평균 유동인구
                </Table.Column>
              </Table.Header>
              <Table.Body>
                {data.tiers.map((t) => (
                  <Table.Row
                    key={t.tier}
                    id={String(t.tier)}
                    className={cn(
                      t.tier === data.tier && "*:font-bold *:text-primary-600",
                    )}
                  >
                    <Table.Cell className={TIER_CELL_CLASS}>
                      {t.tier}단계
                    </Table.Cell>
                    <Table.Cell className={cn(TIER_CELL_CLASS, "text-right")}>
                      {t.max == null
                        ? `${formatPeople(t.min)} 명 이상`
                        : t.min === 0
                          ? `${formatPeople(t.max)} 명 미만`
                          : `${formatPeople(t.min)} ~ ${formatPeople(t.max)} 명`}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}
    </TierBox>
  );
}

/** 야립 광고 — 유동인구 대신 차량 교통량 단계. 교통량 데이터가 아직 없어 늘 "데이터 없음"이다. */
function TrafficTierBox() {
  return (
    <TierBox
      label="교통량 단계"
      value="데이터 없음"
      detail="차량 교통량 데이터를 아직 가져오지 않았어요. 그동안은 아래 '차량 통행량' 질문으로 대신 매겨요."
      filled={false}
    >
      <p className={TIER_HELP_CLASS}>
        야립 광고는 지나가는 운전자가 보는 매체라 보행 유동인구 대신 매체 앞
        도로의 차량 교통량으로 단계를 매겨요. 교통량 데이터(고속도로·서울 시내
        도로)를 가져오면 자동으로 매기고, 그 전에는 담당자가 ‘차량 통행량’
        질문에 답해요.
      </p>
    </TierBox>
  );
}
