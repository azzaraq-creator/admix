"use client";

import {
  Button,
  Card,
  Chip,
  Input,
  Label,
  Link,
  Radio,
  RadioGroup,
  Switch,
  Tabs,
} from "@heroui/react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleX,
  FileText,
  Pencil,
  Receipt,
  RotateCcw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { BrandAvatar } from "@/components/common/BrandAvatar";
import { MaskIcon } from "@/components/common/MaskIcon";
import { LoadingState } from "@/components/common/RouteStates";
import { partnersApi } from "@/hooks/partners";
import {
  CANCEL_HALF_REFUND_DAYS,
  COURSE,
  EXTRA_LABEL,
  ITEM_LABEL,
  OUTCOME_OPTIONS,
  PAYMENT_DAYS,
  PREVIEW_TODAY,
  STORES_PER_INSTALL_DAY,
  addBusinessDays,
  admixMakeItems,
  applicantRows,
  canConfirmProceed,
  canDelay,
  costOf,
  delayBlockers,
  endOfDay,
  estimateOf,
  estimateText,
  expectedRate,
  installDateFor,
  installOrder,
  isLive,
  isReviewing,
  kstDate,
  makeItems,
  mdw,
  optionLabel,
  outcomeOf,
  paymentOf,
  phaseOf,
  prepKeyOf,
  previewNow,
  refundFor,
  reportsOf,
  scheduleOf,
  stageOf,
  statsOf,
  storeOf,
  todoOf,
  wonText,
  type AdvCollab,
  type PrepKey,
  type ReportKind,
  type Schedule,
} from "@/lib/advertiserPreview";
import { extractApiError } from "@/lib/apiError";
import { COLLAB_GRADE_LABEL } from "@/lib/partners";
import {
  addDays,
  diffDays,
  kstStamp,
  md,
  periodDays,
} from "@/lib/partnersPreview";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

import {
  LifeSteps,
  openedHere,
} from "../workspace/CollabDetail";
import { PanelCard, SectionHead, StatusChip } from "../workspace/workspaceUi";
import { advActions, useAdvServerSync, useAdvState, useRememberSentRequest } from "./advStore";
import { advListHref } from "./AdvCollabList";
import { AdvPlanReview } from "./AdvPlanReview";
import { InvoiceModal, ReportModal } from "./advDocs";
import { ScheduleCalendar } from "./ScheduleCalendar";
import {
  ADV_FROM,
  ADV_NEW_HREF,
  ActionBar,
  BAR_BUTTON,
  BAR_GHOST,
  ConfirmModal,
  GradeMark,
  InfoRows,
  StoreThumb,
  eulReul,
  say,
  type AdvFrom,
} from "./advUi";

/*
 * /partners/collabs/[id] (광고주) — 콜라보 상세.
 * 위에서부터: 브랜드 · 제목 → 지금 상황(상태 색 카드 + 의뢰 → 모집 → 매장 확정 → 진행 확정 → 진행 → 완료)
 * → 탭(의뢰 내용 | 일정(달력 + 점선으로 묶은 상세 일정) | 신청 매장 | 확정 매장 · 비용 | 문서(계산서 · 보고서) | 매장 변동) → 아래 고정 줄(지금 할 일 버튼 하나).
 * 진행 중 소진 현황은 보여 주지 않고 보고 시점의 보고서로만 알린다(프로토타입 원칙). 누른 결과는 이 탭에만 남는다.
 */

type Tab = "overview" | "plan" | "schedule" | "stores" | "confirmed" | "documents" | "changes";

function StatusIcon({ c }: { c: AdvCollab }) {
  const cls = "size-[22px]";
  if (c.status === "cancelled") return <CircleX className={cls} />;
  if (c.status === "requested") return <MaskIcon src="/icons/review.svg" className={cls} />;
  // admix 기획안이 왔으면(085) 서류 아이콘, 옛 보완 요청(예시)은 되돌림 아이콘.
  if (c.status === "returned") return c.plan ? <FileText className={cls} /> : <RotateCcw className={cls} />;
  const phase = phaseOf(scheduleOf(c));
  const pay = paymentOf(c);
  if (canConfirmProceed(c)) return <MaskIcon src="/icons/ringing.svg" className={cls} />;
  if (pay === "awaiting" || pay === "overdue") return <MaskIcon src="/icons/receipt.svg" className={cls} />;
  if (phase === "upcoming" || phase === "recruiting") return <MaskIcon src="/icons/megaphone.svg" className={cls} />;
  if (phase === "review" || phase === "confirming") return <MaskIcon src="/icons/store.svg" className={cls} />;
  if (phase === "preparing" || phase === "installing") return <MaskIcon src="/icons/box.svg" className={cls} />;
  if (phase === "running") return <MaskIcon src="/icons/pulse.svg" className={cls} />;
  return <MaskIcon src="/icons/confetti.svg" className={cls} />;
}

/** 광고주 기준 흐름 — 의뢰 → 모집 → 매장 확정 → 진행 확정 · 입금 → 진행 → 완료와 지금 단계. 취소면 그리지 않는다. */
function lifeOf(c: AdvCollab) {
  if (c.status === "cancelled") return null;
  const s = scheduleOf(c);
  const st = statsOf(c);
  const p = phaseOf(s);
  const b = c.billing;
  let at = 0;
  if (c.status === "approved") {
    if (!b) {
      if (p === "upcoming" || p === "recruiting") at = 1;
      else if ((p === "review" || p === "confirming") && !(st.confirmed > 0 && st.requested === 0)) at = 2;
      else at = 3;
    } else if (!b.paidAt) at = 3;
    else at = p === "done" ? 6 : p === "removal" ? 5 : 4;
  }
  return {
    at,
    steps: [
      { label: "의뢰", date: c.requestedAt ? md(kstDate(c.requestedAt)) : "-" },
      { label: "모집", date: `${md(s.noticeDate)}~` },
      { label: "매장 확정", date: `~${md(s.confirmDue)}` },
      { label: "진행 확정", date: b ? md(kstDate(b.confirmedAt)) : `~${md(s.confirmDue)}` },
      {
        label: "진행",
        date: (
          <>
            {md(c.startDate)}
            <span className="max-sm:hidden">~{md(c.endDate)}</span>
          </>
        ),
      },
      { label: "완료", date: md(s.removalDate) },
    ],
  };
}

/**
 * 지금 상황 카드 아이콘 칸 색(광고주만) — 카드는 흰 바탕(11-12 사용자: 노란 바탕 "이 색깔도 맘에 안 들어", 목록 상황 칸도 흰 칸).
 * 검토 · 입금 대기 같은 노랑(amber) 단계도 노랑 대신 보라로. 보완 요청 · 입금 지연(빨강), 완료(초록), 취소(회색)만 다른 색.
 * 제휴사 상세는 그대로 색 카드(STATUS_TONE).
 */
const ADV_PANEL_TONE: Record<ReturnType<typeof stageOf>["tone"], { icon: string; title: string }> = {
  purple: { icon: "bg-primary-50 text-primary-600", title: "text-gray-900" },
  amber: { icon: "bg-primary-50 text-primary-600", title: "text-gray-900" },
  blue: { icon: "bg-sky-50 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300", title: "text-gray-900" },
  green: { icon: "bg-emerald-50 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300", title: "text-gray-900" },
  gray: { icon: "bg-gray-100 text-gray-500", title: "text-gray-700" },
  red: { icon: "bg-red-50 text-red-600 dark:bg-red-400/15 dark:text-red-300", title: "text-error" },
};

function StatusPanel({ c, showSub }: { c: AdvCollab; showSub: boolean }) {
  const stage = stageOf(c);
  const tone = ADV_PANEL_TONE[stage.tone];
  const todo = todoOf(c);
  const s = scheduleOf(c);
  const p = phaseOf(s);
  const life = lifeOf(c);
  const total = periodDays(c.startDate, c.endDate);
  const day = diffDays(PREVIEW_TODAY, c.startDate) + 1;
  const meta =
    isLive(c) && p === "running"
      ? `${day}일차 / ${total}일`
      : isLive(c) && p === "recruiting"
        ? `마감 D-${diffDays(s.recruitEnd, PREVIEW_TODAY)}`
        : null;
  return (
    <section
      aria-label="지금 상황"
      className="flex flex-col gap-[14px] rounded-[24px] bg-surface p-[16px] ring-1 ring-gray-200 ring-inset sm:gap-[16px] sm:p-[22px]"
    >
      <div className="flex items-center gap-[12px] sm:gap-[14px]">
        <span
          aria-hidden
          className={cn("flex size-[40px] shrink-0 items-center justify-center rounded-full sm:size-[44px]", tone.icon)}
        >
          <StatusIcon c={c} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className={cn("text-[20px] leading-[1.35] font-bold break-keep sm:text-[22px]", tone.title)}>
            {stage.label}
          </h2>
          {(showSub || c.status === "returned" || c.status === "cancelled") && todo && (
            <p className="mt-[2px] text-[14px] leading-[1.5] break-keep text-gray-700">{todo.text}</p>
          )}
        </div>
        {meta && (
          <span className="flex h-[26px] shrink-0 items-center rounded-[10px] bg-gray-100 px-[10px] text-[12px] font-bold text-gray-800">
            {meta}
          </span>
        )}
      </div>
      {life && <LifeSteps steps={life.steps} at={life.at} className="bg-gray-50" />}
      {c.delay && c.delay.status !== "applied" && isLive(c) && (
        <p className="flex items-start gap-[8px] border-t border-gray-100 pt-[12px] text-[12px] leading-[1.55] break-keep text-gray-600">
          <CalendarClock className="mt-[2px] size-[14px] shrink-0 text-gray-500" />
          일정 조정 {c.delay.status === "blocked" ? "불가" : "확인 중"} · 시작 {mdw(c.delay.fromStart)} → {mdw(c.delay.newStart)}
        </p>
      )}
    </section>
  );
}

/** 탭 안 카드 머리 — 제목 · 오른쪽 작은 설명. */
function PanelHead({ title, hint, right }: { title: ReactNode; hint?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-[12px] gap-y-[6px]">
      <div className="flex min-w-0 flex-col">
        <Card.Title className="text-[16px] font-bold break-keep text-gray-900">{title}</Card.Title>
        {hint && <Card.Description className="text-[12px] break-keep text-gray-500">{hint}</Card.Description>}
      </div>
      {right}
    </div>
  );
}

/** 기본안 준비 상태 — 상세에선 짧게(의뢰서 선택지 말은 "…맡길게요"처럼 길다). */
const PREP_SHORT: Record<PrepKey, string> = {
  ready: "준비 완료",
  made: "직접 제작",
  admix: "admix 제작",
};

/**
 * 의뢰 내용 한 묶음 — 제목(+ 오른쪽 짧은 설명) 아래 가는 줄, 그 아래 내용. 묶음 사이는 넉넉한 여백으로 띄운다
 * (11-12 사용자 "좀 더 구분을 해줬으면" — 흰 상자를 늘리지 않고 제목 줄 · 여백 · 두 칸 배치로 나눴다).
 */
function Block({ title, aside, children }: { title: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-[12px]">
      <h3 className="flex flex-wrap items-baseline justify-between gap-x-[8px] gap-y-[2px] border-b border-gray-200 pb-[10px] text-[15px] font-bold text-gray-900">
        {title}
        {aside && <span className="text-[12px] font-medium break-keep text-gray-500">{aside}</span>}
      </h3>
      {children}
    </section>
  );
}

/** 의뢰 내용 맨 위 숫자 칸 — 매장 수 · 모집 · 비용. */
function Fact({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-[2px] rounded-[16px] bg-gray-50 px-[14px] py-[12px] sm:px-[16px] sm:py-[14px]", className)}>
      <span className="text-[12px] font-medium text-gray-500">{label}</span>
      <span className="text-[17px] leading-[1.35] font-bold break-keep text-gray-900">{value}</span>
      {sub && <span className="text-[12px] leading-[1.45] break-keep text-gray-500">{sub}</span>}
    </div>
  );
}

/**
 * "의뢰 내용" 탭 — 숫자 칸(매장 수 · 모집 · 비용) 아래로, 넓은 화면에선 두 칸:
 * 왼쪽 무엇을(기본안 · 추가 기획 · 매장 운영) | 오른쪽 어디서 · 누구와(지정 희망 매장 · 남긴 말 · 담당자).
 * 일정은 따로 "일정" 탭(11-12 사용자 "의뢰 내용 따로, 일정 따로").
 */
function Overview({ c }: { c: AdvCollab }) {
  const live = isLive(c);
  const cost = costOf(c);
  const est = estimateOf(c.preferred, c.targetStores, c.estimateAvg);
  const applied = new Set(c.entries.map((e) => e.storeId));
  const confirmedCost = live && cost.confirmedCount > 0;
  // 매장 운영 값(할 일 · 공간 · 수량 · 혜택 · 멘트)은 11-11부터 의뢰서에서 받지 않는다 — 적힌 것만 보인다.
  const opt = (label: string, value: ReactNode | false | undefined): [string, ReactNode][] => (value ? [[label, value]] : []);
  const ops: [string, ReactNode][] = [
    ...opt("매장이 할 일", c.task),
    ...opt("원하는 공간", c.space),
    ...opt(
      "매장별 수량",
      c.quantityPerStore > 0 &&
        `${c.quantityPerStore.toLocaleString("ko-KR")}개 · 구매 고객의 ${Math.round(c.targetRatio * 100)}%에게 증정`,
    ),
    ...opt("매장 혜택", c.benefit),
    ...opt("직원 안내 멘트", c.staffScript && `“${c.staffScript}”`),
    ...c.extras.map((x): [string, ReactNode] => [EXTRA_LABEL[x.kind], x.body]),
  ];

  const what: ReactNode[] = [
    <Block key="items" title="콜라보 기본안" aside={c.items.length ? `${c.items.length}가지` : undefined}>
      {c.items.length === 0 ? (
        <p className="text-[14px] text-gray-500">고른 기본안이 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-[6px]">
          {c.items.map((i) => {
            const key = prepKeyOf(c.itemPrep?.[i]);
            return (
              <li key={i} className="flex flex-col gap-[3px] rounded-[14px] px-[14px] py-[10px] ring-1 ring-gray-100 ring-inset">
                <span className="flex items-center justify-between gap-[8px]">
                  <b className="text-[14px] font-semibold break-keep text-gray-900">{ITEM_LABEL[i]}</b>
                  {key && (
                    <Chip size="sm" variant="soft" color={key === "admix" ? "accent" : "default"} className="shrink-0">
                      {PREP_SHORT[key]}
                    </Chip>
                  )}
                </span>
                {c.itemNotes[i] && (
                  <span className="text-[13px] leading-[1.55] break-keep whitespace-pre-wrap text-gray-600">{c.itemNotes[i]}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {admixMakeItems(c).length > 0 && (
        <p className="text-[12px] leading-[1.5] break-keep text-gray-500">
          admix 제작은 콜라보 비용과 따로예요 — 품목 · 수량 · 사양을 확인한 뒤 견적을 드려요.
        </p>
      )}
    </Block>,
  ];
  if (c.extraPlan || c.extraPlanFile)
    what.push(
      <Block key="extra" title="추가 기획" aside="협의 후 결정해요">
        {c.extraPlan && <p className="text-[14px] leading-[1.65] break-keep whitespace-pre-wrap text-gray-900">{c.extraPlan}</p>}
        {c.extraPlanFile && (
          <span className="flex min-w-0 items-center gap-[8px] self-start rounded-[12px] bg-gray-50 px-[12px] py-[8px] text-[13px] font-semibold text-gray-700">
            <MaskIcon src="/icons/file-text.svg" className="size-[16px] shrink-0 text-gray-500" />
            <span className="truncate">{c.extraPlanFile.name}</span>
          </span>
        )}
      </Block>,
    );
  if (ops.length > 0)
    what.push(
      <Block key="ops" title="매장 운영">
        <InfoRows rows={ops} />
      </Block>,
    );

  const who: ReactNode[] = [];
  if (c.preferred.length > 0)
    who.push(
      <Block key="preferred" title="지정 희망 매장" aside={`${c.preferred.length}곳 · admix가 먼저 연락해 신청을 권해요`}>
        <ul className="flex flex-wrap gap-[8px]">
          {c.preferred.map((p) => (
            <li
              key={p.id}
              className={cn(
                "flex items-center gap-[6px] rounded-[12px] px-[10px] py-[5px] text-[13px] ring-1",
                applied.has(p.id) ? "bg-primary-50 text-primary-700 ring-primary-100" : "bg-gray-50 text-gray-700 ring-gray-100",
              )}
            >
              <GradeMark grade={p.grade} />
              <b className="font-semibold">{p.name}</b>
              <span className="text-[12px] opacity-70">{p.fee ? wonText(p.fee) : "금액 협의"}</span>
              {applied.has(p.id) && <span className="text-[11px] font-bold">신청함</span>}
            </li>
          ))}
        </ul>
      </Block>,
    );
  if (c.memo)
    who.push(
      <Block key="memo" title="admix에 남긴 말">
        <p className="rounded-[14px] bg-gray-50 px-[14px] py-[12px] text-[14px] leading-[1.65] break-keep whitespace-pre-wrap text-gray-900">
          {c.memo}
        </p>
      </Block>,
    );
  if (c.contact?.name) {
    const contact = c.contact;
    who.push(
      <Block key="contact" title="콜라보 담당자">
        <p className="flex flex-wrap items-baseline gap-x-[10px] gap-y-[2px] text-[14px] text-gray-900">
          <b className="font-semibold">{contact.name}</b>
          {contact.role && <span className="text-gray-500">{contact.role}</span>}
          {contact.phone && <span className="text-gray-700">{formatPhone(contact.phone)}</span>}
        </p>
      </Block>,
    );
  }

  return (
    <PanelCard className="gap-[24px] p-[18px] sm:p-[24px]">
      <PanelHead
        title="의뢰 내용"
        hint={c.requestedAt ? `${kstStamp(c.requestedAt)} 의뢰` : undefined}
        right={c.requestCode && <span className="text-[12px] font-medium text-gray-400">{c.requestCode}</span>}
      />
      {c.reviewNote && (
        <div className="flex flex-col gap-[4px] rounded-[16px] bg-error-bg px-[14px] py-[12px]">
          <span className="text-[12px] font-bold text-error">admix 보완 요청</span>
          <p className="text-[14px] leading-[1.6] font-semibold break-keep whitespace-pre-wrap text-gray-900">{c.reviewNote}</p>
        </div>
      )}
      <div className="flex flex-col gap-[8px]">
        <div className="grid grid-cols-2 gap-[8px] sm:grid-cols-3">
          <Fact label="매장 수" value={`목표 ${c.targetStores}곳`} sub={`최소 ${c.minStores}곳부터 진행`} />
          {/* "확정 1"처럼 숫자만 다음 줄로 떨어지지 않게 숫자 앞은 줄바꿈 없는 칸으로. */}
          <Fact label="매장 모집" value={COURSE[c.course].label} sub={COURSE[c.course].detail.replace(/ (\d)/g, " $1")} />
          <Fact
            className="col-span-2 sm:col-span-1"
            label={confirmedCost ? "비용" : "예상 비용"}
            value={confirmedCost ? wonText(cost.confirmed) : estimateText(est.total, est.negotiable)}
            sub={confirmedCost ? `확정 매장 ${cost.confirmedCount}곳 금액 합계` : "확정 매장 금액 합계로 정해져요"}
          />
        </div>
        {!confirmedCost && (
          <p className="px-[2px] text-[12px] leading-[1.5] break-keep text-gray-500">
            예상 비용 = 지정 매장 {c.preferred.length ? estimateText(est.preferred, est.negotiable) : "없음"} + 나머지 {est.rest}곳 × 평균{" "}
            {wonText(est.avg)}
          </p>
        )}
      </div>
      <div className={cn("grid items-start gap-x-[40px] gap-y-[28px]", who.length > 0 && "lg:grid-cols-2")}>
        <div className="flex min-w-0 flex-col gap-[28px]">{what}</div>
        {who.length > 0 && <div className="flex min-w-0 flex-col gap-[28px]">{who}</div>}
      </div>
    </PanelCard>
  );
}

/** 상세 일정 한 줄 — [날짜, 할 일, 날짜 대신 보일 글자]. */
type PlanRow = [string, string, string?];

/**
 * 일정 탭 오른쪽 "상세 일정" — 날짜별 할 일을 묶음(의뢰 | 매장 모집 | 매장 확정 · 입금 | 설치 · 진행)으로, 묶음 사이는 점선.
 * 처음엔 영수증 모양(톱니 가장자리 · 가운데 머리 · 합계 줄)이었는데 11-12 사용자 "진짜 영수증 말고, 점선으로 분리한 건 좋아"
 * → 달력과 같은 보통 카드로 두고 점선 묶음만 남겼다. 지난 날은 흐리게, 오늘은 보라 "오늘".
 */
function ScheduleDetail({ c, s }: { c: AdvCollab; s: Schedule }) {
  const req = c.requestedAt ? kstDate(c.requestedAt) : undefined;
  const reviewTo = addDays(s.noticeDate, -1);
  const groups: { title: string; rows: PlanRow[] }[] = [];
  if (req)
    groups.push({
      title: "의뢰",
      rows: [
        [req, "의뢰"],
        c.approvedAt
          ? [kstDate(c.approvedAt), "admix 승인"]
          : req < reviewTo
            ? [reviewTo, "admix 검토", `~${mdw(reviewTo)}`]
            : [req, "admix 검토"],
      ],
    });
  groups.push(
    {
      title: "매장 모집",
      rows: [
        [s.noticeDate, "매장 모집 공지"],
        [s.midShareDate, "모집 현황 공유"],
        [s.recruitEnd, "모집 마감"],
      ],
    },
    {
      title: "매장 확정 · 입금",
      rows: [
        [s.reviewEnd, "신청 매장 검토 마감"],
        [s.confirmDue, "매장 확정 → 진행 확정 · 계산서"],
        [addBusinessDays(s.confirmDue, PAYMENT_DAYS), `입금 기한(영업일 ${PAYMENT_DAYS}일)`],
      ],
    },
    {
      title: "설치 · 진행",
      rows: [
        [s.installStart, `설치 ${s.installDays}일(${STORES_PER_INSTALL_DAY}곳당 1일)`],
        [c.startDate, "콜라보 시작"],
        ...s.checks.map((k, i): PlanRow => [k.date, `중간 보고 ${i + 1}(${Math.round(k.pct * 100)}%)`]),
        [s.removalDate, "철수 · 결과 보고서"],
      ],
    },
  );
  return (
    <PanelCard className="gap-[6px] p-[18px] sm:p-[24px]">
      <PanelHead
        title="상세 일정"
        hint={`콜라보 ${periodDays(c.startDate, c.endDate)}일 · ${mdw(c.startDate)} ~ ${mdw(c.endDate)}`}
      />
      <div className="flex flex-col">
        {groups.map((g, gi) => (
          <div key={g.title} className={cn("py-[12px]", gi > 0 && "border-t border-dashed border-gray-300")}>
            <p className="mb-[4px] text-[12px] font-semibold text-gray-500">{g.title}</p>
            <ol className="flex flex-col">
              {g.rows.map(([d, t, text]) => {
                const today = d === PREVIEW_TODAY && !text;
                const past = d < PREVIEW_TODAY;
                return (
                  <li
                    key={t}
                    className={cn(
                      "flex items-baseline justify-between gap-[12px] py-[4px] text-[13px] leading-[1.45]",
                      past ? "text-gray-400" : "text-gray-700",
                      today && "font-bold text-primary-600",
                    )}
                  >
                    <span className="min-w-0 break-keep">{t}</span>
                    <span className={cn("shrink-0 whitespace-nowrap", !past && !today && "font-semibold text-gray-900")}>
                      {today ? "오늘" : (text ?? mdw(d))}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </PanelCard>
  );
}

/**
 * "일정" 탭 — 왼쪽 달력(크게) | 오른쪽 상세 일정(점선 묶음, 11-12 사용자). 좁은 화면에선 달력 → 상세 일정.
 * 달력 카드는 반투명 대신 흰 바탕(11-12 사용자 "캘린더가 더 잘 보이게 흰색으로"), 두 카드는 같은 높이(늘어난 만큼 주 칸이 커진다).
 */
function ScheduleTab({ c }: { c: AdvCollab }) {
  const s = scheduleOf(c);
  // admix가 승인하기 전(검토 중 · 보완 요청 · 승인 전 취소)은 "예상 일정", 승인되면 "콜라보 일정"(11-12 사용자).
  // 제목 아래 설명 한 줄("admix가 승인하면 이 일정으로 진행해요" 등)은 뺐다(11-12 사용자 "이거 없애줘").
  const confirmed = isLive(c) || !!c.approvedAt;
  return (
    <div className="grid gap-[16px] lg:grid-cols-[minmax(0,1fr)_340px]">
      <PanelCard className="gap-[14px] bg-surface p-[18px] backdrop-blur-none sm:p-[24px]">
        <PanelHead title={confirmed ? "콜라보 일정" : "예상 일정"} />
        <ScheduleCalendar
          size="lg"
          className="flex-1"
          s={s}
          requestDate={c.requestedAt ? kstDate(c.requestedAt) : undefined}
          prepLabel={makeItems(c).length ? "제작 · 준비" : "준비"}
        />
        {c.delay?.status === "applied" && (
          <p className="text-[12px] text-gray-500">
            일정 조정 완료 · 시작 {mdw(c.delay.fromStart)} → {mdw(c.delay.newStart)}
          </p>
        )}
      </PanelCard>
      <ScheduleDetail c={c} s={s} />
    </div>
  );
}

function RateText({ c, storeId }: { c: AdvCollab; storeId: string }) {
  const r = expectedRate(c, storeOf(c, storeId));
  if (r === null) return <span className="text-gray-400">-</span>;
  return r >= 100 ? (
    <span title="기간 중 다 소진될 것으로 보여 재입고를 준비해요">
      <b className="text-gray-900">100%</b>
      <small className="block text-[11px] whitespace-nowrap text-amber-700 dark:text-warning">재입고 예상</small>
    </span>
  ) : (
    <b className="text-gray-900">{r}%</b>
  );
}

function Stores({ c, onExclude }: { c: AdvCollab; onExclude: (storeId: string) => void }) {
  const s = scheduleOf(c);
  const p = phaseOf(s);
  const st = statsOf(c);
  const rows = applicantRows(c);
  const cost = costOf(c);
  const reviewing = isReviewing(c);
  const outcome = outcomeOf(st.applied, c.minStores, c.targetStores);
  const cancelled = c.status === "cancelled";
  const canReserve = !cancelled && ["upcoming", "recruiting", "review", "confirming", "preparing", "installing"].includes(p);
  const preferred = new Set(c.preferred.map((x) => x.id));
  return (
    <div className="flex flex-col gap-[16px]">
      {reviewing && outcome !== "full" && (
        <PanelCard className={cn("gap-[12px] p-[18px] sm:p-[22px]", !c.decision && "ring-2 ring-amber-200 dark:ring-amber-900/60")}>
          <PanelHead
            title={`신청 ${st.applied}곳 — 진행 방법을 골라 주세요`}
            hint={`최소 ${c.minStores} · 목표 ${c.targetStores}곳 · ${outcome === "partial" ? "최소는 넘었어요" : "최소에 못 미쳐요"}`}
          />
          <RadioGroup
            aria-label="진행 방법"
            value={c.decision?.option ?? null}
            onChange={(v) => {
              advActions.decide(c.id, v);
              say(`"${optionLabel(v)}"(으)로 admix에 알렸어요.`);
            }}
            className="flex flex-col gap-[8px]"
          >
            {OUTCOME_OPTIONS[outcome].map((o) => (
              <Radio key={o.id} value={o.id} className="group mt-0 w-full">
                <Radio.Content className="flex w-full cursor-pointer items-center gap-[10px] rounded-[16px] border border-gray-200 bg-surface px-[14px] py-[11px] transition-colors data-[hovered=true]:border-gray-300 group-data-[selected=true]:border-primary-200 group-data-[selected=true]:bg-primary-50">
                  <Radio.Control>
                    <Radio.Indicator />
                  </Radio.Control>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Label className="cursor-pointer text-[14px] font-semibold text-gray-900">{o.label}</Label>
                    <span className="text-[12px] text-gray-500">{o.hint}</span>
                  </div>
                </Radio.Content>
              </Radio>
            ))}
          </RadioGroup>
          {c.decision && <p className="text-[12px] text-gray-400">{kstStamp(c.decision.at)}에 골랐어요 · 검토 기간 안에는 바꿀 수 있어요</p>}
        </PanelCard>
      )}
      {!reviewing && c.decision && (
        <p className="text-[13px] text-gray-600">
          진행 방법: <b className="text-gray-900">{optionLabel(c.decision.option)}</b>
          <span className="text-gray-400"> · {kstStamp(c.decision.at)}</span>
        </p>
      )}

      <PanelCard className="gap-[12px] p-[14px] sm:p-[22px]">
        <PanelHead
          title={`신청 매장 ${st.applied}곳`}
          hint="선착순으로 목표 수까지 선정 · 넘는 신청은 예비 순번이에요"
          right={
            canReserve && (
              <Switch
                size="sm"
                className="[--switch-control-bg-checked:var(--color-primary)] [--switch-control-bg-checked-hover:var(--color-primary-600)]"
                isSelected={!!c.reservesPreApproved}
                onChange={(v) => {
                  advActions.setReservesPreApproved(c.id, v);
                  say(v ? "예비 매장을 미리 승인했어요. 빠지는 매장이 생기면 바로 투입돼요." : "예비 매장 미리 승인을 껐어요. 바꿀 때마다 확인을 요청드려요.");
                }}
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb className="bg-surface!" />
                  </Switch.Control>
                  <span className="text-[13px] font-semibold text-gray-700">예비 매장 미리 승인</span>
                </Switch.Content>
              </Switch>
            )
          }
        />
        {p === "recruiting" && (
          <p className="rounded-[14px] bg-gray-50 px-[12px] py-[9px] text-[12px] break-keep text-gray-600">
            모집 중이에요({mdw(s.recruitEnd)} 마감). 마감 뒤 검토 기간({mdw(s.reviewEnd)}까지)에 제외 요청을 할 수 있어요.
          </p>
        )}
        {p === "upcoming" && (
          <p className="rounded-[14px] bg-gray-50 px-[12px] py-[9px] text-[12px] break-keep text-gray-600">
            {mdw(s.noticeDate)}에 매장 모집 공지를 올려요. 신청이 들어오면 이곳에 순서대로 보여요.
          </p>
        )}
        {rows.length > 0 && (
          <div className="grid grid-cols-[minmax(0,1fr)_96px_92px_104px_84px] gap-[12px] border-b border-gray-100 px-[4px] pb-[8px] text-[12px] font-semibold text-gray-500 max-sm:hidden">
            <span>매장</span>
            <span>순번</span>
            <span className="text-right">금액(1건)</span>
            <span>예상 소진율</span>
            <span />
          </div>
        )}
        <ul className="flex flex-col">
          {rows.map(({ e, slot, reserve, store }, i) => {
            const chip = (
              <StatusChip tone={e.status === "confirmed" ? "green" : e.status === "requested" ? "amber" : reserve ? "gray" : "purple"}>
                {slot}
              </StatusChip>
            );
            const action =
              reviewing && (e.status === "applied" || e.status === "requested") ? (
                <Button size="sm" variant="tertiary" onPress={() => onExclude(e.storeId)} className="h-[30px] rounded-[12px] px-[10px] text-[12px] font-semibold">
                  제외 요청
                </Button>
              ) : null;
            return (
              <li
                key={e.storeId}
                className={cn(
                  "flex items-center gap-[12px] px-[4px] py-[11px] sm:grid sm:grid-cols-[minmax(0,1fr)_96px_92px_104px_84px]",
                  i > 0 && "border-t border-gray-100",
                  reserve && "bg-gray-50/60",
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-[10px]">
                  <StoreThumb store={store} className="max-sm:size-[36px]" />
                  <div className="flex min-w-0 flex-col gap-[2px]">
                    <span className="flex items-center gap-[6px]">
                      <b className="truncate text-[14px] font-semibold text-gray-900">{store?.name ?? e.storeId}</b>
                      {preferred.has(e.storeId) && <span className="shrink-0 text-[11px] font-bold text-primary-600">지정</span>}
                    </span>
                    <span className="truncate text-[12px] text-gray-500">
                      {store?.area}
                      {store?.grade ? ` · ${COLLAB_GRADE_LABEL[store.grade]}` : ""}
                      <span className="max-sm:hidden">{store?.spaces?.length ? ` · ${store.spaces.join(" · ")}` : ""}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-[6px] text-[12px] text-gray-600 sm:hidden">
                      {chip}
                      <b className="text-gray-900">{store?.fee ? wonText(store.fee) : "금액 협의"}</b>
                      <span className="text-gray-400">· 예상 소진 {expectedRate(c, store) ?? "-"}%</span>
                    </span>
                  </div>
                </div>
                <span className="max-sm:hidden">{chip}</span>
                <b className="text-right text-[13px] text-gray-900 max-sm:hidden">
                  {store?.fee ? wonText(store.fee) : "금액 협의"}
                </b>
                <span className="text-[13px] max-sm:hidden">
                  <RateText c={c} storeId={e.storeId} />
                </span>
                <span className="shrink-0 text-right">{action}</span>
              </li>
            );
          })}
          {!rows.length && p !== "upcoming" && (
            <li className="py-[20px] text-center text-[13px] text-gray-500">아직 신청한 매장이 없어요.</li>
          )}
        </ul>
        {rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-[8px] rounded-[14px] bg-gray-50 px-[12px] py-[10px] text-[13px]">
            <span className="text-gray-600">선정 매장 {cost.selectedCount}곳 금액 합계(예비 제외)</span>
            <b className="text-gray-900">{wonText(cost.selected)}</b>
          </div>
        )}
        <p className="text-[12px] leading-[1.6] break-keep text-gray-400">
          금액은 매장 등급에 따른 1건 기준이고, 최종 비용은 확정 매장 금액 합계예요. 예상 소진율은 admix 사전 조사를 바탕으로 한
          추정치(초기 입고 수량 기준)이고, 매장 매출 정보는 드리지 않아요.
        </p>
      </PanelCard>
    </div>
  );
}

function Confirmed({
  c,
  onProceed,
  onCancel,
  onInvoice,
}: {
  c: AdvCollab;
  onProceed: () => void;
  onCancel: () => void;
  onInvoice: () => void;
}) {
  const [newStart, setNewStart] = useState("");
  const s = scheduleOf(c);
  const cost = costOf(c);
  const b = c.billing;
  const pay = paymentOf(c);
  const canProceed = canConfirmProceed(c);
  const cancelled = c.status === "cancelled";
  const confirmed = c.entries
    .filter((e) => e.status === "confirmed")
    .sort((x, y) => (x.confirmedAt ?? "").localeCompare(y.confirmedAt ?? ""));
  const refund = b ? refundFor(b, previewNow()) : null;
  const delayOk = canDelay(c);
  const changing = newStart && newStart !== c.startDate;
  const blockers = changing ? delayBlockers(c, newStart) : [];
  const ask = () => {
    if (!changing) return;
    advActions.requestDelay(c.id, newStart);
    say(
      blockers.length
        ? "바뀐 기간에 다른 콜라보가 있는 매장이 있어 조정할 수 없어요."
        : `일정 조정을 요청했어요. 확정 매장 ${confirmed.length}곳이 모두 확인하면 새 일정으로 바뀌어요.`,
    );
    setNewStart("");
  };
  return (
    <div className="flex flex-col gap-[16px]">
      {(canProceed || b) && (
        <PanelCard className={cn("gap-[12px] p-[18px] sm:p-[22px]", canProceed && "ring-2 ring-primary-200")}>
          <PanelHead
            title="진행 확정 · 계산서 · 입금"
            hint={b ? b.invoiceNo : `확정 매장 ${confirmed.length}곳`}
            right={
              b && (
                <Button size="sm" variant="tertiary" onPress={onInvoice} className="font-semibold">
                  <FileText className="size-[14px]" />
                  계산서 보기
                </Button>
              )
            }
          />
          {canProceed && (
            <div className="flex flex-col gap-[10px]">
              <p className="text-[14px] leading-[1.6] break-keep text-gray-800">
                매장 확정이 끝났어요.{" "}
                <b>
                  확정 매장 {confirmed.length}곳 · {wonText(cost.confirmed)}
                </b>
                으로 진행을 확정하면 계산서가 바로 발행되고, <b>영업일 {PAYMENT_DAYS}일 안에 입금</b>해야 준비가 시작돼요.
              </p>
              <ul className="flex list-disc flex-col gap-[3px] pl-[18px] text-[12px] leading-[1.7] break-keep text-gray-500">
                <li>입금 기한(영업일 {PAYMENT_DAYS}일)을 넘기면 위약금이 생겨요.</li>
                <li>진행 확정은 매장들과의 약속이에요. 확정 뒤 진행하지 않으면 브랜드 신뢰도에 남아요.</li>
                <li>확정 뒤 취소: {CANCEL_HALF_REFUND_DAYS}일 이내 50% 공제 후 환불 · 그 뒤는 admix와 협의해요.</li>
                <li>일정은 설치 전까지 조정을 요청할 수 있어요 — 확정 매장 모두 확인해야 하고, 바뀐 기간에 다른 콜라보가 있는 매장이 있으면 조정하지 않아요.</li>
              </ul>
              <Button onPress={onProceed} className="h-[44px] self-start rounded-[19px] px-[18px] font-bold">
                <CheckCircle2 className="size-[16px]" />
                진행 확정 · 계산서 발행
              </Button>
            </div>
          )}
          {b && (
            <InfoRows
              rows={[
                ["진행 확정", kstStamp(b.confirmedAt)],
                ["계산서", `${b.invoiceNo} · ${wonText(b.amount)} · 확정 매장 ${b.stores}곳 (예시 번호)`],
                [
                  "입금 기한",
                  <span key="d" className={cn(pay === "overdue" && "font-semibold text-error")}>
                    {kstStamp(b.dueAt)}
                    {pay === "overdue" ? " · 기한이 지나 위약금이 생기고 진행이 멈췄어요 — admix에 연락해 주세요" : ""}
                  </span>,
                ],
                [
                  "입금",
                  b.paidAt ? `${kstStamp(b.paidAt)} 확인 · 준비 시작` : pay === "cancelled" ? "—" : "입금 확인 대기 (admix가 확인하면 준비를 시작해요)",
                ],
                // 확정했는데 아직 입금 전이면 위약금을 눈에 띄게(11-11 사용자).
                ...(pay === "awaiting"
                  ? [
                      [
                        "위약금",
                        <span key="p" className="font-semibold text-warning">
                          {mdw(kstDate(b.dueAt))}까지 입금하지 않으면 위약금이 생겨요
                        </span>,
                      ] as [string, ReactNode],
                    ]
                  : []),
                ...(b.cancelledAt
                  ? [
                      [
                        "취소",
                        `${kstStamp(b.cancelledAt)} · ${b.refund !== undefined ? `50% 공제 후 ${wonText(b.refund)} 환불` : "환불은 admix와 협의"}`,
                      ] as [string, ReactNode],
                    ]
                  : []),
              ]}
            />
          )}
          {b && !cancelled && (
            <div className="flex flex-wrap items-center gap-[10px] border-t border-gray-100 pt-[12px]">
              <Button size="sm" variant="danger-soft" onPress={onCancel} className="font-semibold">
                콜라보 취소
              </Button>
              <span className="text-[12px] break-keep text-gray-500">
                {refund === null
                  ? `확정 ${CANCEL_HALF_REFUND_DAYS}일이 지나 환불은 admix와 협의해요`
                  : `지금 취소하면 50% 공제 후 ${wonText(refund)} 환불`}
              </span>
            </div>
          )}
        </PanelCard>
      )}

      <PanelCard className="gap-[10px] p-[14px] sm:p-[22px]">
        <PanelHead
          title={`확정 매장 ${confirmed.length}곳 · ${wonText(cost.confirmed)}`}
          hint={`설치 ${mdw(s.installStart)}부터 ${s.installDays}일 · ${STORES_PER_INSTALL_DAY}곳당 1일, 확정 순서대로`}
        />
        <ul className="flex flex-col">
          {confirmed.map((e, i) => {
            const st = storeOf(c, e.storeId);
            return (
              <li key={e.storeId} className={cn("flex items-center gap-[10px] px-[4px] py-[11px]", i > 0 && "border-t border-gray-100")}>
                <StoreThumb store={st} className="max-sm:size-[36px]" />
                <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                  <span className="flex items-center gap-[6px]">
                    <GradeMark grade={st?.grade ?? null} />
                    <b className="truncate text-[14px] font-semibold text-gray-900">{st?.name}</b>
                  </span>
                  <span className="truncate text-[12px] text-gray-500">
                    {st?.area} · 설치 {mdw(installDateFor(s, installOrder(c.entries, e.storeId)))}
                    <span className="max-sm:hidden">{e.confirmNo ? ` · 확정서 ${e.confirmNo}` : ""}</span>
                  </span>
                </div>
                <b className="shrink-0 text-[13px] text-gray-900">{st?.fee ? wonText(st.fee) : "금액 협의"}</b>
              </li>
            );
          })}
          {!confirmed.length && (
            <li className="py-[16px] text-center text-[13px] text-gray-500">
              {cancelled ? "취소한 콜라보예요." : `아직 확정한 매장이 없어요. ${mdw(s.confirmDue)}까지 확정이 끝나요.`}
            </li>
          )}
        </ul>
      </PanelCard>

      {b && isLive(c) && (
        <PanelCard className="gap-[12px] p-[18px] sm:p-[22px]">
          <PanelHead
            title="일정 조정 요청"
            hint={delayOk ? `설치 시작(${mdw(s.installStart)}) 전까지 요청할 수 있어요` : c.delay?.status === "pending" ? "매장 확인 중" : "설치가 시작돼 조정할 수 없어요"}
          />
          {c.delay && (
            <div className="flex flex-col gap-[8px] rounded-[14px] bg-gray-50 px-[12px] py-[10px] text-[13px] text-gray-800">
              <span className="flex flex-wrap items-center gap-[8px]">
                <StatusChip tone={c.delay.status === "applied" ? "green" : c.delay.status === "blocked" ? "red" : "amber"}>
                  {c.delay.status === "applied" ? "적용 완료" : c.delay.status === "blocked" ? "조정 불가" : `매장 확인 중 ${c.delay.confirmed.length}/${confirmed.length}`}
                </StatusChip>
                시작 {mdw(c.delay.fromStart)} → {mdw(c.delay.newStart)} ({c.delay.days > 0 ? `+${c.delay.days}` : c.delay.days}일)
              </span>
              {c.delay.status === "blocked" && (
                <ul className="list-disc pl-[18px] text-[12px] text-gray-500">
                  {c.delay.blockers.map((id) => (
                    <li key={id}>{storeOf(c, id)?.name} — 바뀐 기간에 다른 콜라보가 있어요</li>
                  ))}
                </ul>
              )}
              {c.delay.status !== "applied" && (
                <Button
                  size="sm"
                  variant="tertiary"
                  onPress={() => {
                    advActions.withdrawDelay(c.id);
                    say("일정 조정 요청을 거뒀어요.");
                  }}
                  className="self-start font-semibold"
                >
                  요청 거두기
                </Button>
              )}
            </div>
          )}
          {delayOk && (
            <div className="flex flex-wrap items-end gap-[10px]">
              <label className="flex flex-col gap-[6px]">
                <span className="text-[13px] font-semibold text-gray-700">새 시작일</span>
                <Input
                  type="date"
                  aria-label="새 시작일"
                  value={newStart}
                  min={addDays(PREVIEW_TODAY, 1)}
                  onChange={(e) => setNewStart(e.target.value)}
                  className="h-[44px] w-[190px] rounded-[19px]"
                />
              </label>
              <Button variant="tertiary" isDisabled={!changing} onPress={ask} className="h-[44px] rounded-[19px] px-[16px] font-semibold">
                조정 요청 보내기
              </Button>
              {changing && (
                <span className={cn("basis-full text-[12px] break-keep", blockers.length ? "font-semibold text-error" : "text-gray-500")}>
                  {blockers.length
                    ? `${blockers.map((id) => storeOf(c, id)?.name).join(", ")} — 바뀐 기간에 다른 콜라보가 있어 조정할 수 없어요`
                    : `확정 매장 ${confirmed.length}곳이 모두 확인하면 적용돼요 · 기간 ${periodDays(c.startDate, c.endDate)}일은 그대로`}
                </span>
              )}
            </div>
          )}
          <p className="text-[12px] leading-[1.6] break-keep text-gray-400">
            일정이 밀리면 매장은 그 기간을 비워 둬야 해서 확정 매장 모두의 확인이 필요해요. 뒤에 다른 콜라보가 잡힌 매장이 하나라도
            있으면 조정하지 않아요.
          </p>
        </PanelCard>
      )}
    </div>
  );
}

const PAY_CHIP: Record<ReturnType<typeof paymentOf>, ReactNode> = {
  paid: <StatusChip tone="green">입금 완료</StatusChip>,
  awaiting: <StatusChip tone="amber">입금 대기</StatusChip>,
  overdue: <StatusChip tone="red">입금 지연</StatusChip>,
  cancelled: <StatusChip tone="gray">취소</StatusChip>,
  none: null,
};

/** 문서 한 줄 — 아이콘 · 이름(+칩) · 날짜 줄 · 보기(아직이면 "예정" · "정리 중"). */
function DocRow({
  icon,
  title,
  chip,
  sub,
  ready,
  pending,
  onOpen,
  first,
}: {
  icon: ReactNode;
  title: string;
  chip?: ReactNode;
  sub: string;
  ready: boolean;
  pending?: string;
  onOpen: () => void;
  first?: boolean;
}) {
  return (
    <li className={cn("flex items-center justify-between gap-[10px] px-[4px] py-[12px]", !first && "border-t border-gray-100")}>
      <span className="flex min-w-0 items-center gap-[10px]">
        <span
          className={cn(
            "flex size-[36px] shrink-0 items-center justify-center rounded-[12px]",
            ready ? "bg-primary-50 text-primary-600" : "bg-gray-100 text-gray-400",
          )}
        >
          {icon}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="flex flex-wrap items-center gap-[6px]">
            <b className={cn("text-[14px]", ready ? "text-gray-900" : "text-gray-400")}>{title}</b>
            {chip}
          </span>
          <span className="text-[12px] break-keep text-gray-400">{sub}</span>
        </span>
      </span>
      {ready ? (
        <Button size="sm" variant="tertiary" onPress={onOpen} className="shrink-0 font-semibold">
          보기
          <ArrowRight className="size-[14px]" />
        </Button>
      ) : (
        <span className="shrink-0 text-[12px] text-gray-400">{pending}</span>
      )}
    </li>
  );
}

/**
 * 문서 — 이 콜라보의 계산서 · 보고서(게첨 · 중간 · 결과). 예전 문서함을 콜라보마다 붙였다(11-09 사용자).
 * 열면 창에서 인쇄 · PDF 저장(예시 데이터).
 */
function Documents({
  c,
  onInvoice,
  onReport,
}: {
  c: AdvCollab;
  onInvoice: () => void;
  onReport: (k: ReportKind) => void;
}) {
  const reports = reportsOf(c);
  const b = c.billing;
  return (
    <PanelCard className="gap-[8px] p-[14px] sm:p-[22px]">
      <PanelHead title="문서" hint="열어서 인쇄하거나 PDF로 저장할 수 있어요" />
      <ul className="flex flex-col">
        <DocRow
          first
          icon={<Receipt className="size-[17px]" />}
          title="계산서"
          chip={b ? PAY_CHIP[paymentOf(c)] : undefined}
          sub={b ? `${b.invoiceNo} · ${wonText(b.amount)} · ${kstStamp(b.confirmedAt)} 발행` : "진행을 확정하면 발행돼요"}
          ready={Boolean(b)}
          pending="예정"
          onOpen={onInvoice}
        />
        {reports.map((r) => (
          <DocRow
            key={r.kind}
            icon={<FileText className="size-[17px]" />}
            title={r.label}
            sub={`${mdw(r.date)} 기준`}
            ready={r.ready}
            pending={r.date < PREVIEW_TODAY ? "정리 중" : "예정"}
            onOpen={() => onReport(r.kind)}
          />
        ))}
      </ul>
    </PanelCard>
  );
}

function Changes({ c }: { c: AdvCollab }) {
  return (
    <PanelCard className="gap-[8px] p-[14px] sm:p-[22px]">
      <PanelHead title="매장 변동" hint="매장에는 금전 책임을 두지 않고 예비 매장으로 바꿔요" />
      <ul className="flex flex-col">
        {c.changes.map((x, i) => (
          <li key={x.id} className={cn("flex flex-col gap-[4px] px-[4px] py-[12px] text-[13px]", i > 0 && "border-t border-gray-100")}>
            <p className="break-keep text-gray-800">
              <b className="text-gray-900">{storeOf(c, x.storeId)?.name}</b> 미진행 ({x.reason}) →{" "}
              {x.replacement ? (
                <b className="text-primary-600">{storeOf(c, x.replacement)?.name}(으)로 대체</b>
              ) : (
                "대체 매장 찾는 중"
              )}
            </p>
            <p className="text-[12px] text-gray-400">
              {kstStamp(x.at)} · {x.timing}
            </p>
          </li>
        ))}
        {!c.changes.length && <li className="py-[16px] text-center text-[13px] text-gray-500">매장 변동이 없어요.</li>}
      </ul>
    </PanelCard>
  );
}

function Detail({ c, from }: { c: AdvCollab; from?: AdvFrom }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab | null>(null);
  const [dialog, setDialog] = useState<"proceed" | "cancel" | "withdraw" | null>(null);
  const [excluding, setExcluding] = useState<string | null>(null);
  // 의뢰 취소는 서버에도 남긴다(084) — 지우지 않고 "취소"로, 어드민 콜라보 의뢰에도 보인다(11-12 사용자).
  const rememberSent = useRememberSentRequest();
  const [withdrawing, setWithdrawing] = useState(false);
  const withdraw = async () => {
    if (c.requestId) {
      setWithdrawing(true);
      try {
        rememberSent(await partnersApi.cancelCollabRequest(c.requestId));
      } catch (err) {
        say(extractApiError(err) || "의뢰를 취소하지 못했어요. 잠시 뒤 다시 해 주세요.");
        return;
      } finally {
        setWithdrawing(false);
      }
    }
    advActions.withdrawRequest(c.id);
    setDialog(null);
    say("의뢰를 취소했어요. 내 콜라보에 취소 내역으로 남아요.");
  };
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [report, setReport] = useState<ReportKind | null>(null);

  const s = scheduleOf(c);
  const p = phaseOf(s);
  const live = isLive(c);
  const cancelled = c.status === "cancelled";
  // 승인 전(검토 중 · 보완 요청)에 취소한 의뢰 — 매장 · 비용 · 문서가 없어 의뢰 내용 탭만 보인다.
  const cancelledBeforeApproval = cancelled && !c.approvedAt;
  const st = statsOf(c);
  const cost = costOf(c);
  const pay = paymentOf(c, endOfDay(PREVIEW_TODAY));
  const canProceed = canConfirmProceed(c);
  const todo = todoOf(c);
  const reports = reportsOf(c);
  const ready = reports.filter((r) => r.ready);
  const confirmedCount = st.confirmed;
  const refund = c.billing ? refundFor(c.billing, previewNow()) : null;
  // admix와 기획안이 오갔으면(085) "기획안" 탭 — 확정 전엔 기획안부터 연다.
  const planBlock = c.plan?.rounds.length ? c.plan : null;
  const current: Tab =
    tab ??
    (planBlock && (c.status === "returned" || c.status === "requested")
      ? "plan"
      : cancelledBeforeApproval
      ? "overview"
      : cancelled
      ? "confirmed"
      : !live
        ? "overview"
        : canProceed || (c.billing && !c.billing.paidAt)
          ? "confirmed"
          : isReviewing(c) || p === "recruiting"
            ? "stores"
            : ready.length && p !== "preparing"
              ? "documents"
              : "overview");

  const goBack = () => {
    if (!from) router.push(advListHref());
    else if (openedHere()) router.push(ADV_FROM[from]);
    else router.back();
  };

  const tabs: [Tab, string, number?][] = [
    ["overview", "의뢰 내용"],
    ["plan", "기획안", planBlock?.rounds.length],
    ["schedule", "일정"],
    ["stores", "신청 매장", st.applied],
    ["confirmed", "확정 매장 · 비용", confirmedCount],
    ["documents", "문서", ready.length + (c.billing ? 1 : 0)],
    ["changes", "매장 변동", c.changes.length],
  ];
  const shownTabs = tabs.filter(([t]) =>
    t === "plan"
      ? !!planBlock
      : t === "overview" || t === "schedule" || (!cancelledBeforeApproval && (live || cancelled)),
  );

  // 아래 고정 줄 — 지금 할 일 하나.
  let bar: ReactNode = null;
  if (c.status === "returned" && planBlock)
    bar = (
      <ActionBar title="admix 기획안이 왔어요" sub="수정 전 · 후를 보고 확정하거나 다시 고쳐 보내 주세요">
        <Button onPress={() => setDialog("withdraw")} className={BAR_GHOST}>
          의뢰 취소
        </Button>
        {current !== "plan" && (
          <Button onPress={() => setTab("plan")} className={BAR_BUTTON}>
            기획안 보기
            <ArrowRight className="size-[16px]" />
          </Button>
        )}
      </ActionBar>
    );
  else if (c.status === "requested" && planBlock)
    // 기획안이 오간 뒤엔 의뢰서를 통째로 고치지 않는다 — admix 기획안이 오면 기획안 탭에서 항목별로 고친다.
    bar = (
      <ActionBar title="admix가 고친 기획안을 검토하고 있어요" sub="검토 중에는 의뢰를 취소할 수 있어요">
        <Button onPress={() => setDialog("withdraw")} className={BAR_GHOST}>
          의뢰 취소
        </Button>
        {current !== "plan" && (
          <Button onPress={() => setTab("plan")} className={BAR_BUTTON}>
            기획안 보기
            <ArrowRight className="size-[16px]" />
          </Button>
        )}
      </ActionBar>
    );
  else if (c.status === "returned")
    bar = (
      <ActionBar title="admix 보완 요청이 있어요" sub={c.reviewNote}>
        <Button onPress={() => router.push(`${ADV_NEW_HREF}?edit=${c.id}`)} className={BAR_BUTTON}>
          <Pencil className="size-[16px]" />
          보완해서 다시 보내기
        </Button>
      </ActionBar>
    );
  else if (c.status === "requested")
    bar = (
      <ActionBar title="admix가 의뢰를 검토하고 있어요" sub="검토 중에는 의뢰를 고치거나 취소할 수 있어요">
        <Button onPress={() => setDialog("withdraw")} className={BAR_GHOST}>
          의뢰 취소
        </Button>
        <Button onPress={() => router.push(`${ADV_NEW_HREF}?edit=${c.id}`)} className={BAR_BUTTON}>
          <MaskIcon src="/icons/square-pen.svg" className="size-[16px]" />
          의뢰 고치기
        </Button>
      </ActionBar>
    );
  else if (canProceed)
    bar = (
      <ActionBar title={`확정 매장 ${confirmedCount}곳 · ${wonText(cost.confirmed)}`} sub={`진행을 확정하면 계산서가 발행되고 영업일 ${PAYMENT_DAYS}일 안에 입금해요`}>
        <Button onPress={() => setDialog("proceed")} className={BAR_BUTTON}>
          <CheckCircle2 className="size-[16px]" />
          진행 확정
        </Button>
      </ActionBar>
    );
  else if (pay === "awaiting" && c.billing)
    bar = (
      <ActionBar title={`${mdw(kstDate(c.billing.dueAt))}까지 ${wonText(c.billing.amount)} 입금`} sub="기한을 넘기면 위약금이 생겨요 · 입금이 확인되면 준비를 시작해요">
        <Button onPress={() => setInvoiceOpen(true)} className={BAR_BUTTON}>
          <FileText className="size-[16px]" />
          계산서 보기
        </Button>
      </ActionBar>
    );
  else if (pay === "overdue")
    bar = (
      <ActionBar title="입금 기한이 지났어요" sub="위약금이 생기고 진행이 멈췄어요 — admix에 연락해 주세요">
        {/* 대화는 없앴다(11-09 사용자) — admix 고객센터 1:1 문의로. */}
        <Button onPress={() => router.push("/contact")} className={BAR_BUTTON}>
          문의하기
        </Button>
      </ActionBar>
    );
  else if (todo && (todo.kind === "decide" || todo.kind === "review" || todo.kind === "reserve") && current !== "stores")
    bar = (
      <ActionBar title={todo.text} sub={`검토는 ${mdw(s.reviewEnd)}까지예요`}>
        <Button onPress={() => setTab("stores")} className={BAR_BUTTON}>
          신청 매장 보기
          <ArrowRight className="size-[16px]" />
        </Button>
      </ActionBar>
    );
  else if (todo?.kind === "report" && ready.length)
    bar = (
      <ActionBar title={todo.text}>
        <Button onPress={() => setReport(ready[ready.length - 1].kind)} className={BAR_BUTTON}>
          <FileText className="size-[16px]" />
          보고서 보기
        </Button>
      </ActionBar>
    );

  const exStore = excluding ? storeOf(c, excluding) : undefined;

  return (
    <div className="flex flex-col gap-[16px] pb-[24px]">
      {/* 오른쪽의 "제작형 · 모집 14일" 글은 11-12 사용자가 뺐다 — 의뢰 내용에 같은 값이 있다. */}
      <div className="flex items-center">
        <Button size="sm" variant="ghost" onPress={goBack} className="-ml-[8px] font-semibold text-gray-500">
          <ArrowLeft className="size-[16px]" />
          {from ? "뒤로가기" : "목록으로"}
        </Button>
      </div>

      <header className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-[14px] gap-y-[12px] sm:gap-x-[18px] sm:gap-y-[10px]">
        <BrandAvatar
          src={c.brandImage}
          name={c.brand}
          className="size-[52px] rounded-[16px] border border-gray-200 bg-surface text-[28px] sm:row-span-2 sm:size-[64px] sm:rounded-[20px] sm:text-[34px]"
        />
        <div className="flex min-w-0 flex-col gap-[4px] max-sm:self-center">
          <p className="text-[14px] font-semibold text-gray-700">{c.brand}</p>
          <h1 className="text-[20px] leading-[1.3] font-bold break-keep text-gray-900 sm:text-[26px]">{c.title || "제목 없는 의뢰"}</h1>
        </div>
        {c.summary && (
          <p className="col-span-2 w-fit max-w-full rounded-[18px] rounded-tl-[6px] bg-surface px-[14px] py-[9px] text-[14px] leading-[1.55] break-keep text-gray-700 shadow-[0_1px_3px_rgba(16,24,40,0.06)] ring-1 ring-gray-200 sm:col-span-1 sm:col-start-2">
            <span aria-hidden className="mr-[3px] font-bold text-primary-400">
              “
            </span>
            {c.summary}
            <span aria-hidden className="ml-[3px] font-bold text-primary-400">
              ”
            </span>
          </p>
        )}
      </header>

      {/* 머리 · 지금 상황 · 콜라보 정보 사이 구분선은 뺐다(11-12 사용자 "구분선 없애줘") — 여백으로만 띄운다. */}
      <div className="py-[2px] sm:py-[6px]">
        <StatusPanel c={c} showSub={!bar} />
      </div>

      <section className="flex flex-col gap-[14px]">
        <SectionHead icon="/icons/open-folder.svg" title="콜라보 정보" />
        <Tabs selectedKey={current} onSelectionChange={(k) => setTab(k as Tab)}>
          <Tabs.ListContainer className="w-fit max-w-full overflow-x-auto rounded-[17px] max-sm:w-full">
            <Tabs.List aria-label="콜라보 정보">
              {shownTabs.map(([id, label, count]) => (
                <Tabs.Tab key={id} id={id} className="gap-[5px] rounded-[13px] whitespace-nowrap max-sm:px-[10px] max-sm:text-[13px]">
                  {label}
                  {!!count && <span className="opacity-60">{count}</span>}
                  <Tabs.Indicator className="rounded-[13px]" />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
          <Tabs.Panel id="overview" className="pt-[14px]">
            <Overview c={c} />
          </Tabs.Panel>
          {planBlock && (
            <Tabs.Panel id="plan" className="pt-[14px]">
              <AdvPlanReview c={c} block={planBlock} />
            </Tabs.Panel>
          )}
          <Tabs.Panel id="schedule" className="pt-[14px]">
            <ScheduleTab c={c} />
          </Tabs.Panel>
          <Tabs.Panel id="stores" className="pt-[14px]">
            <Stores c={c} onExclude={setExcluding} />
          </Tabs.Panel>
          <Tabs.Panel id="confirmed" className="pt-[14px]">
            <Confirmed
              c={c}
              onProceed={() => setDialog("proceed")}
              onCancel={() => setDialog("cancel")}
              onInvoice={() => setInvoiceOpen(true)}
            />
          </Tabs.Panel>
          <Tabs.Panel id="documents" className="pt-[14px]">
            <Documents c={c} onInvoice={() => setInvoiceOpen(true)} onReport={setReport} />
          </Tabs.Panel>
          <Tabs.Panel id="changes" className="pt-[14px]">
            <Changes c={c} />
          </Tabs.Panel>
        </Tabs>
      </section>

      {bar}

      <ConfirmModal
        isOpen={dialog === "proceed"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="진행을 확정할까요?"
        confirmLabel="진행 확정"
        onConfirm={() => {
          advActions.proceed(c.id);
          setDialog(null);
          setTab("confirmed");
          say(`진행을 확정했어요. 계산서가 발행됐고 영업일 ${PAYMENT_DAYS}일 안에 입금하면 준비가 시작돼요.`);
        }}
      >
        <p className="text-[15px] text-gray-900">
          확정 매장{" "}
          <b>
            {confirmedCount}곳 · {wonText(cost.confirmed)}
          </b>
        </p>
        <p>
          확정과 함께 계산서가 발행되고 영업일 {PAYMENT_DAYS}일 안에 입금해야 준비가 시작돼요. 기한을 넘기면 위약금이 생겨요. 진행 확정은 매장들과의 약속이에요 — 확정 뒤
          취소는 {CANCEL_HALF_REFUND_DAYS}일 이내 50% 공제 후 환불이고, 그 뒤는 admix와 협의해요.
        </p>
      </ConfirmModal>

      <ConfirmModal
        isOpen={dialog === "cancel"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="콜라보를 취소할까요?"
        confirmLabel="취소 확정"
        danger
        onConfirm={() => {
          advActions.cancel(c.id);
          setDialog(null);
          say("콜라보를 취소했어요. 확정 매장에는 admix가 안내하고, 환불은 기준에 따라 처리해요.");
        }}
      >
        <p>
          확정 매장 {confirmedCount}곳에는 admix가 취소를 안내해요(매장 책임 없음).{" "}
          {refund !== null
            ? `입금액의 50%를 공제한 ${wonText(refund)}을 환불해요.`
            : `진행 확정 ${CANCEL_HALF_REFUND_DAYS}일이 지나 환불은 admix와 협의해요.`}
        </p>
        <p>확정 뒤 취소는 브랜드 신뢰도에 남아요.</p>
      </ConfirmModal>

      <ConfirmModal
        isOpen={dialog === "withdraw"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="의뢰를 취소할까요?"
        confirmLabel="의뢰 취소"
        danger
        isDisabled={withdrawing}
        example={!c.requestId}
        onConfirm={() => void withdraw()}
      >
        <p>admix 검토 전이라 비용은 들지 않아요.</p>
        <p>취소한 의뢰는 내 콜라보에 취소 내역으로 남고, 다시 의뢰하려면 새로 작성해야 해요.</p>
      </ConfirmModal>

      <ConfirmModal
        isOpen={!!excluding}
        onOpenChange={(o) => !o && setExcluding(null)}
        title={`${eulReul(exStore?.name ?? "이 매장")} 제외할까요?`}
        confirmLabel="제외 요청"
        danger
        onConfirm={() => {
          if (excluding) advActions.exclude(c.id, excluding);
          setExcluding(null);
          say(`${eulReul(exStore?.name ?? "매장")} 제외했어요. 다음 순번 매장이 올라와요.`);
        }}
      >
        <p>
          제외하면 다음 순번 매장이 선정 자리로 올라와요{c.entries.some((e) => e.requestedAt) ? "(확정 요청도 바로 보내요)" : ""}.
        </p>
      </ConfirmModal>

      <InvoiceModal c={c} isOpen={invoiceOpen} onOpenChange={setInvoiceOpen} />
      <ReportModal c={c} kind={report} onOpenChange={(o) => !o && setReport(null)} />
    </div>
  );
}

export function AdvCollabDetail({ id, from }: { id: string; from?: string }) {
  const state = useAdvState();
  const c = state.collabs.find((x) => x.id === id);
  // 다른 탭 · 다시 로그인해 이 탭에 없으면 서버 의뢰를 받아 올 때까지 기다린다(11-12).
  const synced = useAdvServerSync();
  const known = from && Object.hasOwn(ADV_FROM, from) ? (from as AdvFrom) : undefined;
  if (!c && !synced) return <LoadingState />;
  if (!c) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-[12px] text-center">
        <p className="text-[15px] font-semibold text-gray-900">찾는 콜라보가 없어요.</p>
        <Link href="/partners/collabs" className="text-[14px] font-semibold">
          내 콜라보로
        </Link>
      </div>
    );
  }
  return <Detail key={c.id} c={c} from={known} />;
}
