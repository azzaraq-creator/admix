"use client";

import { Button, Link } from "@heroui/react";
import { ArrowRight, Coffee, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { BrandAvatar } from "@/components/common/BrandAvatar";
import { MaskIcon } from "@/components/common/MaskIcon";
import {
  PREVIEW_TODAY,
  diffDays,
  md,
  periodDays,
} from "@/lib/partnersPreview";
import {
  BOARD_STEPS,
  boardStepOf,
  canConfirmProceed,
  isUnderwayStep,
  endOfDay,
  feeOf,
  kstDate,
  paymentOf,
  phaseOf,
  reportsOf,
  scheduleOf,
  stageOf,
  statsOf,
  tabOf,
  todoOf,
  wonText,
  type AdvCollab,
  type BoardStep,
} from "@/lib/advertiserPreview";
import { cn } from "@/lib/utils";

import { LifeSteps, PeriodTicket } from "../workspace/CollabDetail";
import {
  EmptyBox,
  LinkCard,
  PageHead,
  PanelCard,
  SHADOW_FLOAT,
  SHADOW_LIFT,
  SectionHead,
  StatusChip,
} from "../workspace/workspaceUi";
import { useAdvState } from "./advStore";
import {
  ADV_FIND_HREF,
  ADV_NEW_HREF,
  MoreLink,
  StoreThumb,
  advCollabHref,
} from "./advUi";

/*
 * /partners/dashboard (광고주) — 의뢰 및 매장 모집 · 확인할 일 · 진행 중 콜라보 · 담은 매장(admix 대화는 11-09에 없앴다).
 * 프로토타입 "내 콜라보" 첫 화면을 제휴사 대시보드 모양(구역 머리 · 유리 카드)으로 옮겼다.
 * 맨 위 숫자 4칸(확인할 일 · 모집·확정 · 진행 · 완료)은 단계 칸으로 바꿨다(11-09 사용자: 의뢰 검토 중 ·
 * 매장 모집 · 매장 검토 · 진행 확정 대기 · 준비 · 진행 중을 대시보드에서 보이게). 같은 날 이름을 "의뢰 및 매장 모집"으로("매장 정보"가 애매해서 바꿈),
 * 칸은 앞 네 단계만(준비 · 진행 중은 "진행 중인 콜라보"에), 흰 바탕 없이 단계 머리 아래 카드만 두었다(11-09 사용자).
 */

/** 확인할 일 종류 이름 — 줄 오른쪽 작은 칩. */
export const TODO_LABEL = {
  proceed: "진행 확정",
  decide: "진행 방법",
  review: "신청 매장 검토",
  reserve: "예비 매장",
  pay: "입금",
  report: "보고서",
  returned: "보완 요청",
} as const;

/** 할 일이 급한 순서 — 진행 확정 · 입금 · 보완 요청이 먼저. */
const TODO_ORDER = ["proceed", "pay", "returned", "decide", "review", "reserve", "report"] as const;

export function todosOf(collabs: AdvCollab[]) {
  return collabs
    .map((c) => ({ c, todo: todoOf(c) }))
    .filter((x): x is { c: AdvCollab; todo: NonNullable<ReturnType<typeof todoOf>> & { kind: keyof typeof TODO_LABEL } } => !!x.todo?.kind)
    .filter((x) => !(x.todo.kind === "report" && tabOf(x.c) === "done" && diffDays(PREVIEW_TODAY, x.c.endDate) > 14))
    .sort((a, b) => TODO_ORDER.indexOf(a.todo.kind) - TODO_ORDER.indexOf(b.todo.kind));
}

/** D-n — 오늘이면 "오늘", 지났으면 빈칸. */
const dDay = (date: string) => {
  const n = diffDays(date, PREVIEW_TODAY);
  return n > 0 ? `D-${n}` : n === 0 ? "오늘" : "";
};

/** 단계 칸 카드 아래 한 줄 — 그 칸 안에서 어디쯤인지(모집 마감 · 신청 · 확정 수 · 입금 기한). */
function boardNoteOf(c: AdvCollab, step: BoardStep): { text: string; warn?: boolean } {
  const s = scheduleOf(c);
  const p = phaseOf(s);
  const st = statsOf(c);
  switch (step) {
    case "request":
      return c.status === "returned" ? { text: "보완 요청 받음", warn: true } : { text: "admix 검토 중" };
    case "recruit":
      return p === "upcoming"
        ? { text: `${md(s.noticeDate)} 모집 시작` }
        : { text: `마감 ${dDay(s.recruitEnd)} · 신청 ${st.applied}/${c.targetStores}` };
    case "review":
      return p === "review"
        ? { text: `신청 ${st.applied}곳 · 검토 ${dDay(s.reviewEnd)}` }
        : { text: `매장 확정 중 · ${st.confirmed}/${st.selected}곳` };
    case "proceed": {
      if (canConfirmProceed(c)) return { text: `확정 ${st.confirmed}곳 · 진행 확정 필요` };
      const pay = paymentOf(c, endOfDay(PREVIEW_TODAY));
      if (pay === "overdue") return { text: "입금 기한 지남", warn: true };
      if (pay === "awaiting" && c.billing) return { text: `${md(kstDate(c.billing.dueAt))}까지 입금` };
      return { text: "admix 확인 중" };
    }
    default:
      // 준비 · 진행 중은 칸이 없다("진행 중인 콜라보" 카드).
      return { text: stageOf(c).label };
  }
}

/**
 * 의뢰 및 매장 모집 — 의뢰 검토 → 매장 모집 → 매장 검토 → 진행 확정 네 단계, 단계마다 머리(막대 · 번호 · 이름 · 건수)
 * 아래에 그 단계 콜라보 카드를 쌓는다. 흰 바탕 상자 없이 화면 바탕 위에 바로 둔다(11-09 사용자).
 * 머리 막대: 콜라보가 있으면 보라, 그중 광고주가 확인할 일이 있으면 주황, 비었으면 회색.
 * 넓은 화면은 한 줄 4칸, 그보다 좁으면(모바일 포함) 2칸 × 2줄.
 */
function StageBoard({ collabs }: { collabs: AdvCollab[] }) {
  const steps = BOARD_STEPS.map((step) => ({
    ...step,
    items: collabs
      .filter((c) => boardStepOf(c) === step.id)
      .sort((a, b) => a.startDate.localeCompare(b.startDate)),
  }));
  return (
    <ol className="grid grid-cols-2 gap-x-[12px] gap-y-[24px] lg:grid-cols-4 lg:gap-x-[16px]">
      {steps.map((step, i) => {
        const attention = step.items.some((c) => todoOf(c)?.kind);
        return (
          <li key={step.id} className="flex min-w-0 flex-col gap-[10px]">
            <span
              aria-hidden
              className={cn(
                "h-[3px] rounded-full",
                attention ? "bg-amber-400" : step.items.length ? "bg-primary-500" : "bg-gray-200",
              )}
            />
            <span className="flex items-baseline justify-between gap-[6px] px-[2px]">
              <span className="flex min-w-0 items-baseline gap-[6px]">
                <small className="text-[12px] font-bold text-gray-400 tabular-nums">{i + 1}</small>
                <span className="truncate text-[14px] font-bold text-gray-800">{step.label}</span>
              </span>
              <b
                aria-label={`${step.items.length}건`}
                className={cn(
                  "text-[17px] leading-none font-extrabold tabular-nums",
                  step.items.length ? "text-gray-900" : "text-gray-300",
                )}
              >
                {step.items.length}
              </b>
            </span>
            {step.items.length ? (
              <ul className="flex flex-col gap-[8px]">
                {step.items.map((c) => {
                  const note = boardNoteOf(c, step.id);
                  const todo = todoOf(c)?.kind;
                  return (
                    <li key={c.id}>
                      <Link
                        href={advCollabHref(c.id, "dashboard")}
                        aria-label={`${c.brand} ${c.title} ${stageOf(c).label}`}
                        className={cn(
                          "relative flex w-full flex-col items-stretch gap-[4px] rounded-[16px] bg-surface px-[12px] py-[11px] text-left no-underline ring-1 ring-gray-100 hover:no-underline dark:ring-gray-200",
                          SHADOW_FLOAT,
                          SHADOW_LIFT,
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-[6px] pr-[10px]">
                          <BrandAvatar
                            src={c.brandImage}
                            name={c.brand}
                            className="size-[20px] rounded-[7px] border border-gray-200 bg-surface text-[11px]"
                          />
                          <span className="truncate text-[11px] font-semibold text-gray-500">{c.brand}</span>
                        </span>
                        <b title={c.title} className="truncate text-[13px] font-bold text-gray-900">{c.title}</b>
                        <span
                          className={cn(
                            "truncate text-[12px] tabular-nums",
                            note.warn ? "font-semibold text-red-500" : "text-gray-500",
                          )}
                        >
                          {note.text}
                        </span>
                        {todo && (
                          <span
                            aria-label="확인할 일 있음"
                            className="absolute top-[12px] right-[12px] size-[7px] rounded-full bg-amber-400"
                          />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <span className="flex h-[44px] items-center justify-center rounded-[16px] border border-dashed border-gray-200 text-[12px] text-gray-400">
                없음
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** 진행 중 카드 — 브랜드 · 제목 · 기간 · 보고서 흐름(게첨 → 중간 1~3 → 결과). */
function RunningCard({ c }: { c: AdvCollab }) {
  const stage = stageOf(c);
  const reports = reportsOf(c);
  const at = reports.findIndex((r) => !r.ready);
  const total = periodDays(c.startDate, c.endDate);
  const day = diffDays(PREVIEW_TODAY, c.startDate) + 1;
  const confirmed = c.entries.filter((e) => e.status === "confirmed").length;
  return (
    <LinkCard
      href={advCollabHref(c.id, "dashboard")}
      label={`${c.brand} ${c.title} ${stage.label}`}
      className={cn(
        "gap-[16px] p-[18px] sm:p-[22px]",
        "shadow-[0_2px_8px_rgba(16,24,40,0.05),0_20px_48px_rgba(16,24,40,0.09)]",
        SHADOW_LIFT,
      )}
    >
      {/* 모바일은 칩 줄을 맨 위로 — 브랜드 · 제목 옆에 두면 좁아 꺾였다. */}
      <div className="flex items-start gap-[12px] max-sm:flex-col-reverse">
        <div className="flex min-w-0 flex-1 items-center gap-[12px]">
          <BrandAvatar
            src={c.brandImage}
            name={c.brand}
            className="size-[44px] rounded-[14px] border border-gray-200 bg-surface text-[24px]"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
            <span className="flex items-center gap-[6px] text-[12px] font-semibold whitespace-nowrap text-gray-500">
              <span className="truncate">{c.brand}</span>
              <span aria-hidden className="h-[10px] w-px shrink-0 bg-gray-200" />
              확정 매장 {confirmed}곳
            </span>
            <b className="truncate text-[16px] text-gray-900">{c.title}</b>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-[8px]">
          <StatusChip tone={stage.tone}>{stage.label}</StatusChip>
          {day >= 1 && day <= total && (
            <span className="flex h-[22px] items-center rounded-[8px] bg-gray-100 px-[8px] text-[12px] font-bold text-gray-700 tabular-nums">
              {day}일차 / {total}일
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-[10px]">
        <PeriodTicket start={c.startDate} end={c.endDate} />
        <span className="text-[12px] text-gray-500">
          {todoOf(c)?.text}
        </span>
      </div>
      <LifeSteps
        steps={reports.map((r) => ({
          label: r.label.replace("중간 보고 ", "중간 ").replace(" 보고서", ""),
          date: md(r.date),
        }))}
        at={at < 0 ? reports.length : at}
      />
    </LinkCard>
  );
}

function Overview() {
  const router = useRouter();
  const state = useAdvState();
  const todos = todosOf(state.collabs);
  // 진행 중인 콜라보 = 입금을 마친 준비 · 진행 단계(위 네 칸과 겹치지 않게 boardStepOf 로 나눈다).
  const running = state.collabs
    .filter((c) => isUnderwayStep(boardStepOf(c)))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const boardIds = new Set(BOARD_STEPS.map((step) => step.id));
  const live = state.collabs.filter((c) => {
    const step = boardStepOf(c);
    return step !== null && boardIds.has(step);
  });
  const cartTotal = state.cart.reduce((a, s) => a + feeOf(s), 0);
  const unpriced = state.cart.filter((s) => !s.fee).length;

  return (
    <div className="flex flex-col gap-[32px] sm:gap-[44px]">
      <section className="flex flex-col gap-[16px]">
        <SectionHead icon="/icons/layer.svg" title="의뢰 및 매장 모집" count={live.length} />
        <StageBoard collabs={state.collabs} />
        <div className="flex gap-[8px] sm:hidden">
          <Button onPress={() => router.push(ADV_NEW_HREF)} className="h-[44px] flex-1 rounded-[19px] font-bold">
            <Plus className="size-[16px]" />
            새 콜라보 의뢰
          </Button>
          <Button
            variant="tertiary"
            onPress={() => router.push(ADV_FIND_HREF)}
            className="h-[44px] flex-1 rounded-[19px] font-semibold"
          >
            <MaskIcon src="/icons/store.svg" className="size-[16px]" />
            매장 찾기
          </Button>
        </div>
      </section>

      {/* 확인할 일 — 진행 확정 · 입금 · 보완 요청처럼 광고주가 눌러야 다음 단계로 가는 일. */}
      <section className="flex flex-col gap-[16px]">
        <SectionHead icon="/icons/ringing.svg" title="확인할 일" count={todos.length} />
        {todos.length ? (
          <PanelCard className={cn("gap-0 p-[6px]", SHADOW_FLOAT)}>
            <ul className="flex flex-col">
              {todos.map(({ c, todo }, i) => (
                <li key={c.id} className={cn(i > 0 && "border-t border-gray-100")}>
                  <Link
                    href={advCollabHref(c.id, "dashboard")}
                    className="flex w-full items-center gap-[12px] rounded-[18px] px-[12px] py-[12px] no-underline transition-colors hover:bg-gray-50 hover:no-underline"
                  >
                    <BrandAvatar
                      src={c.brandImage}
                      name={c.brand}
                      className="size-[36px] rounded-[12px] border border-gray-200 bg-surface text-[20px]"
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                      <span className="truncate text-[12px] font-semibold text-gray-500">
                        {c.brand} · {c.title}
                      </span>
                      <b className="text-[14px] leading-[1.45] font-semibold break-keep text-gray-900">
                        {todo.text}
                      </b>
                    </span>
                    <StatusChip
                      tone={todo.kind === "returned" ? "red" : todo.kind === "report" ? "green" : "amber"}
                      className="max-sm:hidden"
                    >
                      {TODO_LABEL[todo.kind]}
                    </StatusChip>
                    <ArrowRight className="size-[16px] shrink-0 text-gray-400" />
                  </Link>
                </li>
              ))}
            </ul>
          </PanelCard>
        ) : (
          <EmptyBox icon={<MaskIcon src="/icons/stroke-square-check.svg" className="size-[26px]" />}>
            지금 확인할 일이 없어요. 진행 확정 · 입금 · 보고서가 생기면 여기에 모여요.
          </EmptyBox>
        )}
      </section>

      <section className="flex flex-col gap-[16px]">
        <SectionHead
          icon="/icons/stroke-clap.svg"
          title="진행 중인 콜라보"
          more={<MoreLink href="/partners/collabs?tab=running">전체 보기</MoreLink>}
        />
        {running.length ? (
          <div className="flex flex-col gap-[12px]">
            {running.map((c) => (
              <RunningCard key={c.id} c={c} />
            ))}
          </div>
        ) : (
          <EmptyBox icon={<Coffee className="size-[26px]" />}>
            <b className="text-gray-700">진행 중인 콜라보가 없어요.</b>
            입금을 마친 콜라보가 준비 · 설치에 들어가면 이곳에 보여요.
          </EmptyBox>
        )}
      </section>

      <div className="flex flex-col">
        <section className="flex min-w-0 flex-col gap-[16px]">
          <SectionHead
            icon="/icons/store.svg"
            small
            title="담은 매장"
            count={state.cart.length}
            more={<MoreLink href={ADV_FIND_HREF}>매장 찾기</MoreLink>}
          />
          {state.cart.length ? (
            <PanelCard className={cn("gap-[14px] p-[16px] sm:p-[18px]", SHADOW_FLOAT)}>
              <ul className="flex flex-wrap gap-[8px]">
                {state.cart.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-[8px] rounded-[14px] bg-gray-50 py-[5px] pr-[10px] pl-[5px] ring-1 ring-gray-100"
                  >
                    <StoreThumb store={s} className="size-[28px] rounded-[9px] text-[12px]" />
                    <span className="text-[13px] font-semibold text-gray-900">{s.name}</span>
                    <span className="text-[12px] text-gray-500 tabular-nums">
                      {s.fee ? wonText(s.fee) : "금액 협의"}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-[10px] border-t border-gray-100 pt-[12px]">
                <span className="text-[13px] text-gray-600">
                  합계 <b className="text-gray-900 tabular-nums">{cartTotal ? wonText(cartTotal) : "금액 협의"}</b>
                  {unpriced > 0 && cartTotal > 0 && <span className="text-gray-400"> · 금액 협의 {unpriced}곳 제외</span>}
                </span>
                <Button size="sm" onPress={() => router.push(ADV_NEW_HREF)} className="rounded-[14px] font-bold">
                  이 매장들로 의뢰하기
                  <ArrowRight className="size-[14px]" />
                </Button>
              </div>
            </PanelCard>
          ) : (
            <EmptyBox icon={<MaskIcon src="/icons/store.svg" className="size-[26px]" />}>
              매장 찾기에서 마음에 드는 매장을 담으면, 의뢰할 때 지정 희망 매장으로 붙어요.
            </EmptyBox>
          )}
        </section>

      </div>
    </div>
  );
}

export function AdvDashboard() {
  const router = useRouter();
  return (
    <div className="flex flex-1 flex-col gap-[16px] sm:gap-[24px]">
      <PageHead
        title="대시보드"
        className="max-sm:sr-only"
        right={
          <div className="flex gap-[8px] max-sm:hidden">
            <Button
              variant="tertiary"
              onPress={() => router.push(ADV_FIND_HREF)}
              className="h-[42px] rounded-[18px] px-[16px] font-semibold"
            >
              <MaskIcon src="/icons/store.svg" className="size-[16px]" />
              매장 찾기
            </Button>
            <Button onPress={() => router.push(ADV_NEW_HREF)} className="h-[42px] rounded-[18px] px-[18px] font-bold">
              <Plus className="size-[16px]" />
              새 콜라보 의뢰
            </Button>
          </div>
        }
      />
      <Overview />
    </div>
  );
}
