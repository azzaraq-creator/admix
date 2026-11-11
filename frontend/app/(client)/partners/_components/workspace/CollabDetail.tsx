"use client";

import {
  Button,
  Card,
  Checkbox,
  Description,
  Label,
  Link,
  Modal,
  Separator,
  Tabs,
  toast,
} from "@heroui/react";
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleMinus,
  CircleX,
  ClipboardCheck,
  FileText,
  Gift,
  Hourglass,
  Package,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import NextImage from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type ReactNode } from "react";

import { LoadingState } from "@/components/common/RouteStates";
import { BrandAvatar } from "@/components/common/BrandAvatar";
import { MaskIcon } from "@/components/common/MaskIcon";
import { SquareCheck } from "@/components/common/SquareCheck";
import { useMe } from "@/hooks/auth";
import { TOAST_TIMEOUT } from "@/hooks/useSonner";
import {
  CONFIRM_SENTENCE,
  STEP_LABEL,
  categoryOf,
  chipOf,
  confirmItemsOf,
  diffDays,
  dow,
  dueStepOf,
  isFull,
  kstStamp,
  md,
  nextActionOf,
  periodDays,
  todayKst,
  type PhotoStep,
  type PreviewCollab,
  type Tone,
} from "@/lib/partnersPreview";
import { mediaSrc } from "@/lib/media";
import { cn } from "@/lib/utils";
import { HEROUI_CHECKBOX_SCOPE } from "@/app/(client)/(auth)/signup/_components/signupUi";

import { rowTone } from "../agreementShared";
import { COLLAB_FROM, collabListHref, type CollabFrom } from "./CollabBoard";
import { ConfirmDocModal } from "./ConfirmDocModal";
import { useCollabCommands, usePartnerWorkspace } from "./partnerState";
import { PanelCard, PartnerOnly, SectionHead } from "./workspaceUi";

/*
 * /partners/collabs/[id] — 콜라보 상세(프로토타입의 기획 보기 · 진행 안내함 흉내).
 * 위에서부터 모양이 다른 칸으로 나눈다 — 브랜드 사진 · 제목(바탕 위) → 지금 상황(상태 색 카드 + 진행 흐름)
 * → 진행 안내함(확정 매장만, 흰 카드) → 콜라보 내용(누가 무엇을: 매장이 할 일 · admix가 해 줘요 · 받는 것 → 일정 → 참여 안내 회색 상자).
 * 단계마다 아래 고정 줄에 버튼 하나(신청 · 대기 신청 · 최종 확정 · 사진 올리기 · 재입고 요청).
 * 누른 결과는 서버에 남는다(069, 고른 매장 기준 — partnerState). 문의 탭(대화)은 없앴다(2026-11-09 사용자). 화면은 모두 HeroUI 컴포넌트.
 */

type InboxTab = "checklist" | "notices" | "files";

/**
 * 진행 체크리스트 날짜 칸 — 달력처럼 두 줄(날짜 굵게 / 요일 작게)로 표시 옆에 세운다. 알약·괄호 없이.
 * 사진 낼 날이 지났으면 주황, 끝난 줄은 흐리게, 오늘이면 요일 대신 "오늘".
 */
function DateCol({
  date,
  state,
}: {
  date: string;
  state: "done" | "due" | "todo";
}) {
  return (
    <time dateTime={date} className="flex w-[42px] shrink-0 flex-col">
      <span
        className={cn(
          "text-[14px] leading-[20px] font-bold tabular-nums",
          state === "due"
            ? "text-warning"
            : state === "done"
              ? "text-gray-400"
              : "text-gray-900",
        )}
      >
        {md(date)}
      </span>
      <span
        className={cn(
          "text-[12px] leading-[18px]",
          state === "due" ? "font-semibold text-warning" : "text-gray-400",
        )}
      >
        {date === todayKst() ? "오늘" : `${dow(date)}요일`}
      </span>
    </time>
  );
}

/**
 * 진행 체크리스트 한 줄 — [표시] [날짜 칸(날짜 / 요일)] | [제목 / 설명] [버튼(세로 가운데)].
 * 표시: 끝남 초록 square-check · 사진 낼 차례 주황 camera.svg · 아직 회색 점선 네모.
 * 표시(18px)는 첫 두 줄(20 + 18 = 38px) 가운데에 — 위 여백 10px. 사진 줄이 붙어 길어져도 두 줄 기준 그대로.
 */
function CheckRow({
  date,
  title,
  who,
  state,
  action,
  last = false,
  children,
}: {
  date: string;
  title: string;
  who: string;
  state: "done" | "due" | "todo";
  action?: ReactNode;
  last?: boolean;
  children?: ReactNode;
}) {
  return (
    <li>
      <div className="flex items-start gap-[10px] py-[14px] sm:gap-[12px]">
        {state === "due" ? (
          <span role="img" aria-label="사진 낼 차례" className="mt-[10px] flex">
            <MaskIcon
              src="/icons/camera.svg"
              className="size-[18px] text-amber-500"
            />
          </span>
        ) : (
          <SquareCheck
            on={state === "done"}
            label={state === "done" ? "끝남" : "아직"}
            className="mt-[10px]"
          />
        )}
        <DateCol date={date} state={state} />
        {/* 날짜 칸과 내용 사이 가는 세로선. */}
        <div className="flex min-w-0 flex-1 flex-col border-l border-gray-100 pl-[10px] sm:pl-[12px]">
          <b className="text-[14px] leading-[20px] text-gray-900">{title}</b>
          <small className="text-[12px] leading-[18px] text-gray-500 max-sm:break-keep">
            {who}
          </small>
          {children}
        </div>
        {action && <div className="shrink-0 self-center">{action}</div>}
      </div>
      {!last && <Separator />}
    </li>
  );
}

/**
 * 콜라보 내용 역할 카드 색 — 매장이 할 일 · admix가 해 줘요는 흰 카드, 받는 것만 옅은 보라 카드로 띄운다
 * (11-08 사용자: 받는 것이나 매장이 할 일 중 하나는 배경을 달리 — 옅은 주황은 싫다고 해서 보라).
 */
export const ROLE_TONE = {
  // 받는 것 카드 하나만 보라로 띄우고 나머지 머리 칸은 흰 바탕 + 옅은 테두리
  // (보라 → 하늘색 → 회색 → "흰 배경으로", 11-08 사용자). admix 칸도 같이 맞춘다.
  store: { card: "", tile: "border border-gray-200 bg-surface text-gray-700" },
  admix: { card: "", tile: "border border-gray-200 bg-surface" },
  gift: {
    card: "border-primary-200 bg-linear-to-br from-primary-100 to-primary-50",
    tile: "bg-surface text-primary-600",
  },
} as const;

/** 콜라보 내용 — "누가 무엇을" 한 칸(머리: 색 아이콘 + 제목). */
export function RoleCard({
  tone,
  icon,
  title,
  children,
}: {
  tone: keyof typeof ROLE_TONE;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <PanelCard
      className={cn("gap-[14px] p-[18px] sm:p-[20px]", ROLE_TONE[tone].card)}
    >
      <h3 className="flex items-center gap-[8px] text-[15px] font-bold text-gray-900">
        <span
          aria-hidden
          className={cn(
            "flex size-[30px] items-center justify-center rounded-[10px]",
            ROLE_TONE[tone].tile,
          )}
        >
          {icon}
        </span>
        {title}
      </h3>
      {children}
    </PanelCard>
  );
}

/** 역할 카드 안 한 줄 — 앞에 작은 점(dotClassName 으로 첫 줄 가운데에 맞춘다, 기본은 14px 글자). */
export function RoleItem({
  dotClassName = "mt-[9px]",
  children,
}: {
  dotClassName?: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-[10px]">
      <span
        aria-hidden
        className={cn(
          "size-[5px] shrink-0 rounded-full bg-gray-400",
          dotClassName,
        )}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}

/**
 * 일정 머리 오른쪽 진행 기간 — 한 줄 알약 [11.03 (화)] ─ 12일 ─ [11.14 (토)] (높이 30px → 곡률 12px).
 * 처음엔 시작·종료 글자를 단 두 줄 표였는데 "너무 크다"(11-08 사용자)고 해서 줄였다.
 * 다크 모드의 "n일" 알약은 진한 보라가 튀어 옆 날짜가 묻혀 보여 옅은 보라 바탕 + 연보라 글자로(11-08 사용자).
 * (11-08 사용자: "진행 2026.08.18 — 08.29 · 12일" 한 줄 글자는 성의 없어 보인다.)
 */
export function PeriodTicket({ start, end }: { start: string; end: string }) {
  const day = (d: string) => (
    <span className="tabular-nums">
      {md(d)} <span className="font-medium text-gray-500">({dow(d)})</span>
    </span>
  );
  return (
    <div
      aria-label={`진행 ${md(start)}부터 ${md(end)}까지 ${periodDays(start, end)}일`}
      className="flex h-[30px] items-center gap-[8px] rounded-[12px] bg-gray-50 px-[12px] text-[13px] font-semibold text-gray-900 ring-1 ring-gray-100"
    >
      {day(start)}
      <span aria-hidden className="flex items-center">
        <span className="h-[1.5px] w-[10px] bg-primary-200" />
        <span className="flex h-[18px] items-center rounded-[6px] bg-primary-500 px-[6px] text-[11px] font-bold text-white tabular-nums dark:bg-primary-100 dark:text-primary-700">
          {periodDays(start, end)}일
        </span>
        <span className="h-[1.5px] w-[10px] bg-primary-200" />
      </span>
      {day(end)}
    </div>
  );
}

/** 시작 전에 끝내 두는 준비 항목 — 포스터 · 안내물 부착. 나머지(샘플링 · 증정 · DP 유지 등)는 진행 중에 한다. */
const isSetupItem = (i: { label: string }) => i.label.includes("부착");

/**
 * 매장이 할 일 한 묶음 — 위에 회색 제목 띠(왼쪽 때 이름 굵게 · 오른쪽 날짜), 아래에 점 목록을 카드 너비 그대로.
 * (11-08 사용자: 왼쪽 칸 · 오른쪽 내용은 좁아 읽기 어렵다 → 위아래로, 제목은 내용과 구분되게 띠로, 줄 앞엔 admix 칸처럼 점.)
 */
function TaskPhase({
  label,
  when,
  children,
}: {
  label: string;
  when: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[8px]">
      <dt className="flex h-[32px] items-center justify-between gap-[8px] rounded-[12px] bg-gray-50 px-[12px]">
        <span className="text-[13px] font-bold text-gray-900">{label}</span>
        <span className="text-[12px] font-medium text-gray-500 tabular-nums">
          {when}
        </span>
      </dt>
      <dd className="min-w-0">
        <ul className="flex flex-col gap-[6px] text-gray-700">{children}</ul>
      </dd>
    </div>
  );
}

/** 할 일 한 줄 — 점 + 앞머리(자리 · 샘플링 등) 굵게 + 내용. */
function TaskLine({ head, children }: { head: string; children: ReactNode }) {
  return (
    <RoleItem>
      <b className="mr-[6px] font-semibold text-gray-900">{head}</b>
      {children}
    </RoleItem>
  );
}

/**
 * 상세의 큰 구역 사이 구분선 — 부모 간격(16px)에 위아래 8px씩 더해 선 위아래로 24px.
 * 모바일은 위아래 2px만 더해 18px(세로로 길어 구역 사이가 너무 벌어져 보인다).
 */
export function SectionRule() {
  return <Separator className="my-[2px] bg-gray-200 sm:my-[8px]" />;
}

/** 날짜 앞머리 — "11.02 (월)" 굵게. */
function When({ d }: { d: string }) {
  return (
    <b className="mr-[6px] font-bold text-gray-900 tabular-nums">
      {md(d)} ({dow(d)})
    </b>
  );
}

/**
 * 지금 상황 카드 색 — 상태 칩 톤(chipOf)을 따른다.
 * 흰 카드들 사이에서 먼저 눈에 들어오게 색 바탕 + 진한 색 동그라미 아이콘 + 색 제목.
 */
/**
 * 지금 상황 카드 색. amber · emerald · red 테두리(200)는 다크 토큰이 없어 다크 모드에서 밝게 튄다
 * — 다크는 같은 색의 어두운 단계(900, 반투명)로(11-08 사용자 "취소 테두리가 너무 밝아").
 */
export const STATUS_TONE: Record<
  Tone,
  { card: string; icon: string; title: string }
> = {
  purple: {
    card: "bg-primary-100 ring-primary-200",
    icon: "bg-primary-500 dark:bg-primary-500/60",
    title: "text-primary-700",
  },
  blue: {
    card: "bg-sky-50 ring-sky-100",
    icon: "bg-sky-600 dark:bg-sky-600/70",
    title: "text-sky-700",
  },
  amber: {
    card: "bg-warning-bg ring-amber-200 dark:ring-amber-900/60",
    // 다크 모드는 진한 노랑이 쨍해 아이콘 · 제목을 한 단계 가라앉힌다(11-08 사용자). 다른 색 아이콘 칸도 다크에선 반투명으로.
    icon: "bg-amber-500 dark:bg-amber-600/70",
    title: "text-warning dark:text-amber-400/65",
  },
  green: {
    card: "bg-success-bg/70 ring-emerald-200 dark:ring-emerald-900/60",
    icon: "bg-emerald-500 dark:bg-emerald-600/70",
    title: "text-success",
  },
  gray: {
    card: "bg-gray-100 ring-gray-200",
    icon: "bg-gray-400",
    title: "text-gray-700",
  },
  red: {
    card: "bg-error-bg/70 ring-red-200 dark:ring-red-900/60",
    icon: "bg-red-500 dark:bg-red-600/70",
    title: "text-error",
  },
};

/**
 * 지금 상황 아이콘 — 상태마다 하나(모집 확성기 · 대기 모래시계 · 확정 요청 종 · 진행 맥박 · 완료 폭죽 …).
 * 진행 중은 대시보드 "진행 중" 숫자 칸과 같은 맥박(public/icons/pulse.svg), 완료는 폭죽(public/icons/confetti.svg).
 */
function StatusIcon({ c }: { c: PreviewCollab }) {
  const cat = categoryOf(c);
  if (c.standing === "confirmed" && cat === "ongoing")
    return <MaskIcon src="/icons/pulse.svg" className="size-[22px]" />;
  if (c.standing === "confirmed" && cat === "done")
    return <MaskIcon src="/icons/confetti.svg" className="size-[22px]" />;
  // 모집 중(아직 신청 안 함)
  if (c.standing === "none")
    return <MaskIcon src="/icons/megaphone.svg" className="size-[22px]" />;
  // 확정 요청 받음 — 대시보드 "확정 요청" 숫자 칸과 같은 ringing.svg
  if (c.standing === "requested")
    return <MaskIcon src="/icons/ringing.svg" className="size-[22px]" />;
  const Icon: LucideIcon =
    c.standing === "candidate" || c.standing === "reserve"
      ? Hourglass
      : c.standing === "blocked"
        ? Ban
        : c.standing === "declined"
          ? CircleMinus
          : c.standing === "cancelled"
            ? CircleX
            : CalendarCheck; // 확정 · 설치 전
  return <Icon className="size-[22px]" />;
}

type LifeStep = { label: string; date: ReactNode };

/**
 * 이 매장 기준 콜라보 흐름 — 신청 → 최종 확정 → 설치 → 진행 → 완료와 지금 단계(at — 앞은 끝남, 5면 모두 끝남).
 * 기간 겹침 · 미참여 · 광고주 취소는 흐름 밖이라 그리지 않는다(null).
 */
function lifeOf(c: PreviewCollab): { steps: LifeStep[]; at: number } | null {
  const t = todayKst();
  let at: number;
  switch (c.standing) {
    case "none":
      at = 0;
      break;
    case "candidate":
    case "reserve":
    case "requested":
      at = 1;
      break;
    case "confirmed":
      at =
        t < c.installDate ? 2 : t <= c.endDate ? 3 : t <= c.removalDate ? 4 : 5;
      break;
    default:
      return null;
  }
  const steps: LifeStep[] = [
    { label: "신청", date: `~${md(c.recruitEnd)}` },
    {
      label: "최종 확정",
      date: c.confirmedAt ? md(c.confirmedAt) : `~${md(c.confirmDue)}`,
    },
    { label: "설치", date: md(c.installDate) },
    {
      label: "진행",
      // 좁은 화면은 시작일만(다섯 칸이 한 줄에 들어가게).
      date: (
        <>
          {md(c.startDate)}
          <span className="max-sm:hidden">~{md(c.endDate)}</span>
        </>
      ),
    },
    { label: "완료", date: md(c.removalDate) },
  ];
  return { steps, at };
}

/**
 * 진행 흐름 — 대시보드 진행 카드의 사진 보고와 같은 모양(끝남 초록 square-check · 지금 보라 네모 · 아직 회색 점선 네모).
 * 끝남 → 끝남 사이 선은 그라데이션 없이 초록 한 색, 끝남 → 지금만 초록에서 보라로.
 */
export function LifeSteps({ steps, at }: { steps: LifeStep[]; at: number }) {
  return (
    <ol
      aria-label="진행 흐름"
      className="flex rounded-[18px] bg-surface/80 px-[4px] py-[14px] sm:px-[12px]"
    >
      {steps.map((s, i) => {
        const done = i < at;
        const now = i === at;
        return (
          <li
            key={s.label}
            aria-current={now ? "step" : undefined}
            className="relative flex flex-1 flex-col items-center gap-[6px] text-center"
          >
            {i > 0 && (
              <span
                aria-hidden
                className={cn(
                  "absolute right-1/2 z-0 w-full",
                  done
                    ? "top-[8.5px] h-[3px] rounded-full bg-emerald-500"
                    : now
                      ? "top-[8.5px] h-[3px] rounded-full bg-linear-to-r from-emerald-500 to-primary-500"
                      : "top-[9px] h-[2px] bg-[repeating-linear-gradient(to_right,var(--color-gray-300)_0_2px,transparent_2px_4px)]",
                )}
              />
            )}
            {/* 끝남 초록 square-check · 지금 보라 네모 · 아직 회색 점선 네모(흰 바탕을 깔아 뒤 선을 가린다). */}
            <span className="relative z-10 flex rounded-[6px] bg-surface">
              <SquareCheck
                on={done}
                now={now}
                label={done ? "끝남" : now ? "지금" : "아직"}
                className="size-[20px]"
              />
            </span>
            <span
              className={cn(
                "text-[12px] font-semibold whitespace-nowrap",
                now
                  ? "text-primary-700"
                  : done
                    ? "text-gray-900"
                    : "text-gray-500",
              )}
            >
              {s.label}
            </span>
            <span
              className={cn(
                "-mt-[4px] text-[11px] whitespace-nowrap tabular-nums",
                now ? "font-semibold text-primary-600" : "text-gray-400",
              )}
            >
              {s.date}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * 지금 상황 — 상태 이름(크게, 상태 색) · 진행 흐름 · 확정서.
 * 아래 흰 카드들과 달리 상태 색 바탕이라 "지금 어떤 상황인지"가 먼저 보인다.
 * 설명 한 줄(showSub)은 아래 고정 줄이 없을 때만 — 고정 줄이 있으면 할 일을 거기서 말하므로 겹치지 않게 뺀다.
 */
function StatusPanel({ c, showSub }: { c: PreviewCollab; showSub: boolean }) {
  const [docOpen, setDocOpen] = useState(false);
  const chip = chipOf(c);
  const cat = categoryOf(c);
  const tone = STATUS_TONE[chip.tone];
  const life = lifeOf(c);
  const total = periodDays(c.startDate, c.endDate);
  const day = diffDays(todayKst(), c.startDate) + 1;
  // 진행 중이면 오른쪽에 며칠째인지.
  const meta =
    cat === "ongoing" && day >= 1 && day <= total
      ? `${day}일차 / ${total}일`
      : null;
  const sub =
    cat === "done"
      ? "남은 물품은 admix가 회수했고, 결과 보고서를 브랜드에 전달했어요"
      : nextActionOf(c);
  return (
    <section
      aria-label="지금 상황"
      className={cn(
        "flex flex-col gap-[14px] rounded-[24px] p-[16px] ring-1 ring-inset sm:gap-[16px] sm:p-[22px]",
        tone.card,
      )}
    >
      <div className="flex items-center gap-[12px] sm:gap-[14px]">
        <span
          aria-hidden
          className={cn(
            "flex size-[40px] shrink-0 sm:size-[44px] items-center justify-center rounded-full text-white shadow-[0_4px_12px_rgba(16,24,40,0.12)]",
            tone.icon,
          )}
        >
          <StatusIcon c={c} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h2
            className={cn(
              "text-[20px] leading-[1.35] font-bold break-keep sm:text-[22px]",
              tone.title,
            )}
          >
            {chip.label}
          </h2>
          {showSub && (
            <p className="mt-[2px] text-[14px] leading-[1.5] break-keep text-gray-700">
              {sub}
            </p>
          )}
        </div>
        {meta && (
          // 높이 26px → 곡률 26/2 - 3 = 10px.
          <span className="flex h-[26px] shrink-0 items-center rounded-[10px] bg-surface/80 px-[10px] text-[12px] font-bold text-gray-800 tabular-nums">
            {meta}
          </span>
        )}
      </div>
      {life && <LifeSteps steps={life.steps} at={life.at} />}
      {c.confirmNo &&
        (c.standing === "confirmed" || c.standing === "cancelled") && (
          <div className="flex flex-wrap items-center gap-x-[12px] gap-y-[8px] border-t border-black/5 pt-[14px] dark:border-white/10">
            <p className="flex min-w-0 flex-1 items-start gap-[8px] text-[12px] leading-[1.55] break-keep text-gray-600">
              <FileText className="mt-[2px] size-[14px] shrink-0 text-gray-500" />
              <span>
                {/* 모바일은 "확정서" 글자를 빼고 번호만(옆 버튼이 "확정서 보기") — 번호는 중간에서 꺾이지 않게. */}
                <b className="font-semibold text-gray-800">
                  <span className="max-sm:hidden">확정서 </span>
                  <span className="whitespace-nowrap">{c.confirmNo}</span>
                </b>
                {" · "}
                {/* 모바일은 번호 · 확정일만 — 시각 · 확인자 · 항목 수는 확정서 보기에 있다. */}
                <span className="sm:hidden">
                  {c.confirmedAt ? kstStamp(c.confirmedAt).slice(0, 5) : ""}{" "}
                  확정
                </span>
                <span className="max-sm:hidden">
                  {c.confirmedAt ? kstStamp(c.confirmedAt) : ""} 확정 · 확인자{" "}
                  {c.confirmer ?? "-"} · 진행 항목 {c.checkedItems ?? 0}개 확인
                </span>
              </span>
            </p>
            {/* 눈에 띌 필요 없는 보조 동작 — 작은 글자 버튼(높이 24px → 곡률 9px). 마우스를 올리면 반투명 흰 바탕(색 카드 위라 회색 대신). */}
            <Button
              size="sm"
              variant="ghost"
              onPress={() => setDocOpen(true)}
              className="h-[24px] min-w-0 shrink-0 gap-[2px] rounded-[9px] px-[6px] text-[12px] font-medium text-gray-500 hover:text-gray-900 data-[hovered=true]:bg-surface/70 data-[pressed=true]:bg-surface/90"
            >
              확정서 보기
              <ChevronRight className="size-[12px]" />
            </Button>
            <ConfirmDocModal c={c} isOpen={docOpen} onOpenChange={setDocOpen} />
          </div>
        )}
    </section>
  );
}

/** 이 문서를 처음 연 주소가 지금 주소인지 — 앱 안에서 넘어온 게 아니면 true. */
export function openedHere() {
  const nav = performance.getEntriesByType("navigation")[0];
  return !nav || nav.name === window.location.href;
}

function Detail({ c, from }: { c: PreviewCollab; from?: CollabFrom }) {
  const router = useRouter();
  const { data: me } = useMe();
  const { state, today } = usePartnerWorkspace();
  const commands = useCollabCommands();
  const [mode, setMode] = useState<"detail" | "confirm">("detail");
  const [checks, setChecks] = useState<string[]>([]);
  const [tab, setTab] = useState<InboxTab | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadStep = useRef<PhotoStep | null>(null);

  const cat = categoryOf(c, today);
  const confirmed = c.standing === "confirmed";
  const dueStep = dueStepOf(c, today);
  const items = confirmItemsOf(c);
  const unread = c.notices.filter((n) => !state.reads.includes(n.id)).length;
  const restockPending = state.restocks.includes(c.id);
  const inboxTab: InboxTab =
    tab ?? (dueStep ? "checklist" : unread ? "notices" : "checklist");
  const say = (text: string) => toast(text, { timeout: TOAST_TIMEOUT });
  // 콜라보 목록에서 왔으면 "목록으로"(보던 칸으로), 그 밖(대시보드 · 알림 · 참여 이력 · 문서함)에서 왔으면 "뒤로가기".
  const goBack = () => {
    if (!from) router.push(collabListHref());
    // 이 상세를 바로 열었으면(새 탭 · 새로고침 — 문서를 처음 연 주소가 지금 주소) 앱 안에 돌아갈 화면이 없어
    // 브라우저 뒤로가기는 admix 밖으로 나간다 → 온 화면 주소로.
    else if (openedHere()) router.push(COLLAB_FROM[from]);
    else router.back();
  };

  const openPhoto = (step: PhotoStep) => {
    uploadStep.current = step;
    fileInput.current?.click();
  };
  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const step = uploadStep.current;
    uploadStep.current = null;
    if (!file || !step) return;
    if (!(await commands.addPhoto(c.id, step, file))) return;
    setTab("checklist");
    say(`${STEP_LABEL[step]} 사진을 올렸어요. admix가 남은 수량을 확인해요.`);
  };
  const finalConfirm = async () => {
    const no = await commands.confirm(
      c.id,
      me?.name?.trim() || "매장 담당자",
      checks.length,
    );
    if (!no) return;
    setDialogOpen(false);
    setMode("detail");
    setChecks([]);
    say(`최종 확정했어요. 확정서 ${no}`);
  };

  // 아래 고정 줄 — 단계별 버튼 하나. 누를 게 없는 상태(취소 · 미참여 · 기간 겹침 · 후보 · 예비 · 확정 대기 · 완료)는
  // 위 "지금 상황" 카드가 알려 주므로 줄을 띄우지 않는다.
  type Kind =
    "confirmDialog" | "apply" | "startConfirm" | "photo" | "restock" | null;
  let action: {
    title: string;
    sub?: string;
    button?: string;
    kind: Kind;
  } | null = null;
  const allChecked = checks.length === items.length;
  if (mode === "confirm")
    action = {
      title: `${checks.length} / ${items.length} 확인`,
      sub: allChecked
        ? "모두 확인했어요. 최종 확정을 눌러 주세요"
        : "모든 항목을 확인하면 최종 확정할 수 있어요",
      button: "최종 확정",
      kind: allChecked ? "confirmDialog" : null,
    };
  else if (cat === "recruiting" && c.standing === "none")
    action = isFull(c)
      ? {
          title: `목표 매장이 찼어요 · 예비 ${c.appliedStores - c.targetStores + 1}번`,
          sub: "빠지는 매장이 생기면 순서대로 확정 요청을 드려요",
          button: "대기 신청",
          kind: "apply",
        }
      : {
          title: `지금 신청하면 선정 후보 ${c.appliedStores + 1}번`,
          sub: "선착순 접수 · 신청만으로 확정되지 않아요",
          button: "신청하기",
          kind: "apply",
        };
  else if (c.standing === "requested")
    action = {
      title: "최종 확정 요청이 도착했어요",
      sub: `${kstStamp(c.confirmDue)}까지`,
      button: "최종 확정하기",
      kind: "startConfirm",
    };
  else if (confirmed && dueStep && cat === "ongoing")
    action = {
      title: `${STEP_LABEL[dueStep.step]} · ${dueStep.day}일차`,
      sub: "남은 수량이 보이게 사진 한 장이면 돼요",
      button: "사진 올리기",
      kind: "photo",
    };
  else if (confirmed && cat === "ongoing")
    action = restockPending
      ? { title: "재입고 요청함", sub: "admix가 확인하고 방문해요", kind: null }
      : {
          title: "남은 수량이 부족한가요?",
          sub: "누르면 admix가 확인 후 재입고해요",
          button: "재입고 요청",
          kind: "restock",
        };

  const runAction = async (kind: Kind) => {
    if (kind === "confirmDialog") setDialogOpen(true);
    else if (kind === "apply") {
      const view = await commands.apply(c.id);
      if (view)
        say(
          view.standing === "reserve"
            ? `대기 신청했어요. 예비 ${view.slotNo ?? ""}번이에요.`
            : `신청했어요. 선정 후보 ${view.slotNo ?? ""}번이에요.`,
        );
    } else if (kind === "startConfirm") setMode("confirm");
    else if (kind === "photo" && dueStep) openPhoto(dueStep.step);
    else if (kind === "restock") {
      if (await commands.restock(c.id))
        say("재입고를 요청했어요. admix가 확인 후 방문해요.");
    }
  };

  const photoOf = (step: PhotoStep) => c.photos.find((p) => p.step === step);
  const checklist = [
    {
      step: "install" as const,
      date: c.installDate,
      title: "설치 완료(게첨)",
      who: "admix 방문 세팅 · 사진 촬영",
    },
    ...c.checks.map((k, i) => ({
      step: k.step,
      date: k.date,
      title: `${i + 1}차 점검 · ${k.day}일차`,
      who: "남은 수량이 보이게 사진 한 장",
    })),
  ];
  const timeline: [string, string][] = [
    [c.recruitStart, "모집 시작"],
    [c.recruitEnd, "모집 마감 (선착순)"],
    [c.confirmDue.slice(0, 10), "최종 확정 기한"],
    [c.installDate, "설치 (admix 방문)"],
    [c.startDate, "콜라보 시작"],
    ...c.checks.map(
      (k, i) => [k.date, `${i + 1}차 점검 · ${k.day}일차`] as [string, string],
    ),
    [c.endDate, "콜라보 종료"],
    [c.removalDate, "철수·회수"],
  ];
  // 일정에서 오늘 이후 첫 일 — "다음"으로 보라 점.
  const nextIdx = timeline.findIndex(([d]) => d >= today);
  const tabs: [InboxTab, string][] = [
    ["checklist", "진행 체크리스트"],
    ["notices", `공지${unread ? ` ${unread}` : ""}`],
    ["files", "자료"],
  ];
  const canWithdraw =
    (c.standing === "candidate" || c.standing === "reserve") &&
    today <= c.recruitEnd;

  return (
    <div className="flex flex-col gap-[16px] pb-[24px]">
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => void onPhoto(e)}
      />

      <div className="flex items-center justify-between gap-[12px]">
        <Button
          size="sm"
          variant="ghost"
          onPress={() => (mode === "confirm" ? setMode("detail") : goBack())}
          className="-ml-[8px] font-semibold text-gray-500"
        >
          <ArrowLeft className="size-[16px]" />
          {mode === "confirm"
            ? "기획 내용으로"
            : from
              ? "뒤로가기"
              : "목록으로"}
        </Button>
      </div>

      {/* 브랜드 사진(없으면 기본 C) · 브랜드 · 제목 — 카드 없이 바탕 위에. */}
      {/*
       * PC: 왼쪽 브랜드 사진(두 줄 차지) | 오른쪽 브랜드 · 제목 → 말풍선.
       * 모바일: 사진 | 브랜드 · 제목 한 줄, 말풍선은 아래 줄을 꽉 채운다(오른쪽 칸에 끼우면 좁아 세 줄로 꺾였다).
       */}
      <header className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-[14px] gap-y-[12px] sm:gap-x-[18px] sm:gap-y-[10px]">
        <BrandAvatar
          src={c.brandImage}
          name={c.brand}
          // 회색 바탕 위라 흰 칸 + 테두리로 또렷하게(사진이 없을 때의 기본 C도).
          className="size-[52px] rounded-[16px] border border-gray-200 bg-surface text-[28px] sm:row-span-2 sm:size-[64px] sm:rounded-[20px] sm:text-[34px]"
        />
        <div className="flex min-w-0 flex-col gap-[4px] max-sm:self-center">
          <p className="flex flex-wrap items-center gap-[6px] text-[14px] font-semibold text-gray-700">
            {c.brand}
          </p>
          <h1 className="text-[20px] leading-[1.3] font-bold break-keep text-gray-900 sm:text-[26px]">
            {c.title}
          </h1>
        </div>
        {/* 한 줄 소개는 브랜드가 매장에 건네는 말처럼 — 말풍선(브랜드 사진 쪽 왼쪽 위 모서리만 덜 둥글게) + 따옴표. */}
        <p className="col-span-2 w-fit max-w-full rounded-[18px] rounded-tl-[6px] bg-surface px-[14px] py-[9px] text-[14px] leading-[1.55] break-keep text-gray-700 shadow-[0_1px_3px_rgba(16,24,40,0.06)] ring-1 ring-gray-200 sm:col-span-1 sm:col-start-2">
          <span aria-hidden className="mr-[3px] font-bold text-primary-400">
            “
          </span>
          {c.summary}
          <span aria-hidden className="ml-[3px] font-bold text-primary-400">
            ”
          </span>
        </p>
      </header>

      {/* 큰 구역(머리 · 지금 상황 · 진행 안내함 · 콜라보 내용) 사이 — 위아래 여백 + 가는 구분선(11-08 사용자). */}
      <SectionRule />

      {mode === "confirm" ? (
        <PanelCard className="gap-[16px] p-[16px] sm:p-[24px]">
          <Card.Header>
            <Card.Title className="text-[17px] font-bold text-gray-900">
              진행 내용을 하나씩 확인해 주세요
            </Card.Title>
            <Card.Description className="text-[13px] text-gray-500">
              모든 항목을 확인하면 최종 확정할 수 있어요.
            </Card.Description>
          </Card.Header>
          <Card.Content className="gap-[8px]">
            {items.map((item) => {
              const on = checks.includes(item.id);
              return (
                <Checkbox
                  key={item.id}
                  isSelected={on}
                  onChange={(v) =>
                    setChecks(
                      v
                        ? [...checks, item.id]
                        : checks.filter((x) => x !== item.id),
                    )
                  }
                  className={cn(
                    HEROUI_CHECKBOX_SCOPE,
                    "flex w-full rounded-[18px] transition-colors",
                    rowTone(on),
                  )}
                >
                  <Checkbox.Content className="w-full cursor-pointer items-start gap-[12px] rounded-[18px] px-[14px] py-[13px] sm:px-[16px] sm:py-[14px]">
                    <Checkbox.Control className="mt-[3px] border border-gray-300 in-data-[selected=true]:border-accent in-data-[selected=true]:bg-accent">
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <span className="flex min-w-0 flex-col">
                      <Label className="text-[14px] font-bold text-gray-900">
                        {item.label}
                      </Label>
                      <Description className="text-[13px] leading-[1.55] break-keep text-gray-600">
                        {item.value}
                      </Description>
                    </span>
                  </Checkbox.Content>
                </Checkbox>
              );
            })}
          </Card.Content>
        </PanelCard>
      ) : (
        <>
          <StatusPanel c={c} showSub={!action} />

          <SectionRule />

          {confirmed && (
            <section className="flex flex-col gap-[14px]">
              <SectionHead icon="/icons/open-folder.svg" title="진행 안내함" />
              <PanelCard
                className="gap-[12px] p-[14px] sm:p-[20px]"
                aria-label="진행 안내함"
              >
                <Tabs
                  selectedKey={inboxTab}
                  onSelectionChange={(k) => setTab(k as InboxTab)}
                >
                  {/*
                   * 모바일은 너비를 꽉 채운다. 칸 폭은 글자 길이대로 + 남는 폭을 나눠(flex-auto) —
                   * 같은 폭으로 나누면 "체크리스트"가 320px 화면에서 넘친다. 체크리스트는 "진행"을 뺀다.
                   */}
                  <Tabs.ListContainer className="w-fit max-w-full overflow-x-auto rounded-[17px] max-sm:w-full">
                    <Tabs.List aria-label="진행 안내함">
                      {tabs.map(([id, label]) => (
                        <Tabs.Tab
                          key={id}
                          id={id}
                          className="rounded-[13px] whitespace-nowrap max-sm:w-auto max-sm:min-w-0 max-sm:flex-auto max-sm:px-[10px] max-sm:text-[13px]"
                        >
                          {id === "checklist" ? (
                            <>
                              <span className="max-sm:hidden">진행&nbsp;</span>
                              체크리스트
                            </>
                          ) : (
                            label
                          )}
                          <Tabs.Indicator className="rounded-[13px]" />
                        </Tabs.Tab>
                      ))}
                    </Tabs.List>
                  </Tabs.ListContainer>

                  <Tabs.Panel id="checklist" className="pt-[4px]">
                    <ol className="flex flex-col">
                      {checklist.map((k) => {
                        const p = photoOf(k.step);
                        const due =
                          !p && k.step !== "install" && k.date <= today;
                        return (
                          <CheckRow
                            key={k.step}
                            date={k.date}
                            title={k.title}
                            who={k.who}
                            state={p ? "done" : due ? "due" : "todo"}
                            action={
                              due ? (
                                <Button
                                  size="sm"
                                  aria-label="사진 올리기"
                                  onPress={() => openPhoto(k.step)}
                                  // 높이 32px → 곡률 32/2 - 3 = 13px. 모바일은 카메라 아이콘만(32px 네모, 대시보드와 같다).
                                  className="h-[32px] rounded-[13px] font-bold max-sm:w-[32px] max-sm:min-w-0 max-sm:px-0"
                                >
                                  <MaskIcon
                                    src="/icons/camera.svg"
                                    className="size-[15px] sm:hidden"
                                  />
                                  <span className="max-sm:hidden">
                                    사진 올리기
                                  </span>
                                </Button>
                              ) : p && p.by === "cafe" && cat !== "done" ? (
                                <Button
                                  size="sm"
                                  variant="tertiary"
                                  aria-label="사진 다시 올리기"
                                  onPress={() => openPhoto(k.step)}
                                  className="h-[32px] rounded-[13px] max-sm:w-[32px] max-sm:min-w-0 max-sm:px-0"
                                >
                                  <RotateCcw className="size-[13px]" />
                                  <span className="max-sm:hidden">다시</span>
                                </Button>
                              ) : null
                            }
                          >
                            {p && (
                              <span className="mt-[6px] flex items-center gap-[8px] text-[12px] text-gray-500">
                                {p.thumb ? (
                                  // eslint-disable-next-line @next/next/no-img-element -- 올린 사진(/uploads/collab/…) 작은 미리보기
                                  <img
                                    src={mediaSrc(p.thumb)}
                                    alt={`${k.title} 사진`}
                                    className="size-[44px] rounded-[10px] object-cover"
                                  />
                                ) : (
                                  <span className="flex size-[44px] items-center justify-center rounded-[10px] bg-gray-100 text-gray-400">
                                    <MaskIcon
                                      src="/icons/camera.svg"
                                      className="size-[15px]"
                                    />
                                  </span>
                                )}
                                {p.by === "admix" ? "admix 촬영" : "제출함"} ·{" "}
                                {kstStamp(p.at)}
                              </span>
                            )}
                          </CheckRow>
                        );
                      })}
                      <CheckRow
                        last
                        date={c.removalDate}
                        title="종료·철수"
                        who="admix 철수, 남은 물품 전량 회수 → 결과 보고"
                        state={cat === "done" ? "done" : "todo"}
                      />
                    </ol>
                  </Tabs.Panel>

                  <Tabs.Panel id="notices" className="pt-[12px]">
                    {c.notices.length ? (
                      <div className="flex flex-col gap-[8px]">
                        {[...c.notices]
                          .sort((a, b) => b.at.localeCompare(a.at))
                          .map((n) => {
                            const read = state.reads.includes(n.id);
                            return (
                              <Card
                                key={n.id}
                                className={cn(
                                  "gap-[6px] rounded-[18px] px-[16px] py-[14px] shadow-none",
                                  read
                                    ? "bg-gray-50"
                                    : "border border-primary-100 bg-primary-50/50",
                                )}
                              >
                                <Card.Header className="flex-row flex-wrap items-baseline justify-between gap-[8px]">
                                  <Card.Title className="text-[14px] font-bold text-gray-900">
                                    {n.title}
                                  </Card.Title>
                                  <small className="text-[12px] text-gray-500">
                                    {n.author} · {kstStamp(n.at)}
                                  </small>
                                </Card.Header>
                                <Card.Description className="text-[13px] leading-[1.6] break-keep text-gray-600">
                                  {n.body}
                                </Card.Description>
                                <Card.Footer>
                                  {read ? (
                                    <span className="flex items-center gap-[4px] text-[12px] font-semibold text-gray-400">
                                      <CheckCircle2 className="size-[13px]" />
                                      확인함
                                    </span>
                                  ) : (
                                    <Button
                                      size="sm"
                                      onPress={() =>
                                        commands.readNotice(c.id, n.id)
                                      }
                                      className="font-bold"
                                    >
                                      확인했어요
                                    </Button>
                                  )}
                                </Card.Footer>
                              </Card>
                            );
                          })}
                      </div>
                    ) : (
                      <p className="py-[12px] text-[13px] text-gray-500">
                        아직 공지가 없어요. 새 공지가 오면 이메일로도 알려
                        드려요.
                      </p>
                    )}
                  </Tabs.Panel>

                  <Tabs.Panel id="files" className="pt-[4px]">
                    <ul className="flex flex-col">
                      {[
                        {
                          icon: ClipboardCheck,
                          title: "직원용 안내 카드",
                          sub: "계산대·서빙대 배치용 원본 (교대 직원·분실 대비)",
                          right: "준비 중",
                        },
                        {
                          icon: Package,
                          title: "설치 가이드·위치 사진 예시",
                          sub: c.space,
                          right: "설치 때 admix가 전달",
                        },
                        {
                          icon: Gift,
                          title: "브랜드 소개",
                          sub: `${c.brand} · ${c.summary}`,
                          right: "",
                        },
                      ].map((f, i) => (
                        <li key={f.title}>
                          {i > 0 && <Separator />}
                          <div className="flex items-center gap-[12px] py-[12px]">
                            <f.icon className="size-[17px] shrink-0 text-gray-500" />
                            <div className="flex min-w-0 flex-1 flex-col">
                              <b className="text-[14px] text-gray-900">
                                {f.title}
                              </b>
                              <small className="truncate text-[12px] text-gray-500">
                                {f.sub}
                              </small>
                            </div>
                            <span className="shrink-0 text-[12px] text-gray-400">
                              {f.right}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Tabs.Panel>
                </Tabs>
              </PanelCard>
            </section>
          )}
          {confirmed && <SectionRule />}

          {/*
           * 콜라보 내용 — "누가 무엇을" 역할별로(2026-11-08 사용자 선택).
           * 매장이 할 일 | admix가 해 줘요 | 받는 것(옅은 보라) → 일정(넓으면 가로 흐름, 좁으면 세로) → 참여 안내(회색 상자).
           */}
          <section className="flex flex-col gap-[14px]">
            <SectionHead icon="/icons/note.svg" title="콜라보 내용" />
            <div className="grid gap-[12px] md:grid-cols-2 lg:grid-cols-[3fr_3fr_2fr]">
              <RoleCard
                tone="store"
                icon={
                  <MaskIcon src="/icons/praying.svg" className="size-[16px]" />
                }
                title="매장이 할 일"
              >
                {/*
                 * 언제 하는지로 묶는다 — 시작 전(설치 날까지) · 진행 중 · 점검일(11-08 사용자).
                 * 왼쪽 좁은 칸에 때(이름 + 날짜), 오른쪽에 할 일 줄 — 점 · 색 알약 없이 가는 선으로만 나눈다.
                 */}
                <dl className="flex flex-col gap-[16px] text-[14px] leading-[1.6] break-keep">
                  <TaskPhase
                    label="시작 전"
                    when={`~${md(c.installDate)} (${dow(c.installDate)})`}
                  >
                    <TaskLine head="자리">{c.space} 비워 두기</TaskLine>
                    {c.items.filter(isSetupItem).map((i) => (
                      <TaskLine key={i.label} head={i.label}>
                        {i.note}
                      </TaskLine>
                    ))}
                    {c.staffScript ? (
                      <TaskLine head="직원">
                        안내 멘트 알려 두기
                        {/* 제목 띠(회색 바탕)와 헷갈리지 않게 멘트는 테두리 상자. */}
                        <q className="mt-[6px] block rounded-[12px] border border-gray-200 px-[12px] py-[7px] text-[13px] text-gray-700">
                          {c.staffScript}
                        </q>
                      </TaskLine>
                    ) : null}
                  </TaskPhase>
                  <TaskPhase
                    label="진행 중"
                    when={`${md(c.startDate)}~${md(c.endDate)}`}
                  >
                    <RoleItem>
                      <b className="font-semibold text-gray-900">{c.task}</b>
                    </RoleItem>
                    {c.items
                      .filter((i) => !isSetupItem(i))
                      .map((i) => (
                        <TaskLine key={i.label} head={i.label}>
                          {i.note}
                        </TaskLine>
                      ))}
                  </TaskPhase>
                  <TaskPhase
                    label="점검일"
                    when={`${c.checks.map((k) => k.day).join(" · ")}일차`}
                  >
                    <RoleItem>
                      <b className="font-semibold text-gray-900 tabular-nums">
                        {c.checks
                          .map((k) => `${md(k.date)} (${dow(k.date)})`)
                          .join(" · ")}
                      </b>
                      <span className="block text-gray-600">
                        남은 수량이 보이게 사진 한 장
                      </span>
                    </RoleItem>
                  </TaskPhase>
                </dl>
              </RoleCard>

              <RoleCard
                tone="admix"
                // admix 심볼(그라데이션)은 사이드바처럼 원래 색 그대로.
                icon={
                  <NextImage
                    src="/service/symbol.svg"
                    alt=""
                    width={18}
                    height={18}
                    className="size-[18px] object-contain"
                  />
                }
                title="admix가 해 줘요"
              >
                <ul className="flex flex-col gap-[12px] text-[14px] leading-[1.6] break-keep text-gray-700">
                  <RoleItem>
                    <When d={c.installDate} />
                    방문 설치 · {c.quantity.toLocaleString("ko-KR")}개 세팅
                  </RoleItem>
                  <RoleItem>점검 사진을 보고 소진이 빠르면 재입고</RoleItem>
                  {c.staffScript ? (
                    <RoleItem>
                      직원용 안내 카드를 출력해 계산대·서빙대에 비치
                    </RoleItem>
                  ) : null}
                  <RoleItem>
                    <When d={c.removalDate} />
                    철수 · 남은 물품 전량 회수
                  </RoleItem>
                  <RoleItem>결과를 정리해 브랜드에 보고서 전달</RoleItem>
                </ul>
              </RoleCard>

              <RoleCard
                tone="gift"
                icon={<MaskIcon src="/icons/box.svg" className="size-[16px]" />}
                title="받는 것"
              >
                <ul>
                  {/* 20px 글자(줄 높이 27px) 첫 줄 가운데에 점. */}
                  <RoleItem dotClassName="mt-[11px]">
                    <b className="block text-[20px] leading-[1.35] font-bold break-keep text-gray-900">
                      {c.benefit}
                    </b>
                    <span className="mt-[4px] block text-[13px] text-primary-700/80">
                      콜라보 시작 전 지급
                    </span>
                  </RoleItem>
                </ul>
              </RoleCard>
            </div>

            <PanelCard className="gap-[16px] p-[18px] sm:p-[20px]">
              <div className="flex flex-wrap items-center justify-between gap-x-[12px] gap-y-[4px]">
                <h3 className="flex items-center gap-[8px] text-[15px] font-bold text-gray-900">
                  <span
                    aria-hidden
                    className="flex size-[30px] items-center justify-center rounded-[10px] bg-gray-100 text-gray-600"
                  >
                    <CalendarDays className="size-[16px]" />
                  </span>
                  일정
                </h3>
                <PeriodTicket start={c.startDate} end={c.endDate} />
              </div>
              {/*
               * 지난 일은 초록 점, 다음 일(오늘 이후 첫 일정)은 보라 점, 그 뒤는 빈 점.
               * 넓으면(lg) 가로로 한 줄, 좁으면 세로로.
               */}
              <ol className="flex flex-col lg:flex-row">
                {timeline.map(([d, t], i) => {
                  const past = d < today;
                  const next = i === nextIdx;
                  const last = i === timeline.length - 1;
                  return (
                    <li
                      key={`${d}${t}`}
                      aria-current={next ? "step" : undefined}
                      className="relative flex gap-[12px] pb-[14px] last:pb-0 lg:flex-1 lg:flex-col lg:items-center lg:gap-[8px] lg:pb-0 lg:text-center"
                    >
                      {!last && (
                        <span
                          aria-hidden
                          className={cn(
                            "absolute top-[15px] -bottom-[3px] left-[5px] w-[2px] lg:top-[5px] lg:bottom-auto lg:left-1/2 lg:h-[2px] lg:w-full",
                            // 진행 흐름과 같은 규칙 — 지난 → 지난 초록 한 색, 지난 → 다음 초록에서 보라로, 그 뒤 회색 점선.
                            // 좁으면 세로 선이라 위→아래, 넓으면(lg) 가로 선이라 왼→오른쪽.
                            timeline[i + 1][0] < today
                              ? "bg-emerald-500"
                              : i + 1 === nextIdx && past
                                ? "bg-linear-to-b from-emerald-500 to-primary-500 lg:bg-linear-to-r"
                                : "bg-[repeating-linear-gradient(to_bottom,var(--color-gray-300)_0_2px,transparent_2px_4px)] lg:bg-[repeating-linear-gradient(to_right,var(--color-gray-300)_0_2px,transparent_2px_4px)]",
                          )}
                        />
                      )}
                      <span
                        aria-hidden
                        className={cn(
                          "relative z-10 mt-[3px] size-[12px] shrink-0 rounded-full lg:mt-0",
                          past
                            ? "bg-emerald-500"
                            : next
                              ? "bg-primary-500 ring-4 ring-primary-100"
                              : "border-2 border-gray-300 bg-surface",
                        )}
                      />
                      <div className="flex min-w-0 gap-[10px] text-[13px] lg:flex-col lg:gap-[2px] lg:text-[12px]">
                        <time
                          dateTime={d}
                          className={cn(
                            "w-[68px] shrink-0 font-bold tabular-nums lg:w-auto",
                            past
                              ? "text-gray-400"
                              : next
                                ? "text-primary-600"
                                : "text-gray-900",
                          )}
                        >
                          {md(d)} ({dow(d)})
                        </time>
                        {/* 넓은 화면(가로 흐름)은 칸이 좁아 긴 설명이 옆 칸과 겹치므로 " · " 자리에서 줄을 바꾼다. 좁은 화면은 한 줄. */}
                        <span
                          className={cn(
                            "break-keep",
                            past ? "text-gray-400" : "text-gray-700",
                          )}
                        >
                          {t.split(" · ").map((part, j) => (
                            <span key={part} className="lg:block">
                              {j > 0 && <span className="lg:hidden"> · </span>}
                              {part}
                            </span>
                          ))}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </PanelCard>

            <div className="flex flex-col items-start gap-[10px] rounded-[20px] bg-gray-100 px-[18px] py-[16px] sm:px-[24px]">
              <h3 className="flex items-center gap-[6px] text-[14px] font-bold text-gray-700">
                <MaskIcon src="/icons/info.svg" className="size-[16px]" />
                참여 안내
              </h3>
              <ul className="flex list-disc flex-col gap-[4px] pl-[18px] text-[13px] leading-[1.6] break-keep text-gray-600">
                <li>
                  매장 한 곳은 한 번에 콜라보 1건을 진행해요. 기간(설치~철수)이
                  겹치는 모집에는 신청할 수 없어요.
                </li>
                <li>
                  신청은 선착순이고, 신청만으로 확정되지 않아요. 광고주 검토 후
                  최종 확정 요청을 드려요.
                </li>
                <li>확정 요청 전까지는 부담 없이 신청을 취소할 수 있어요.</li>
                <li>
                  확정은 진행 항목을 모두 확인한 뒤 매장이 직접 해요. 확정 후
                  진행이 어려우면 금전 책임은 없지만 이후 매칭에 참고돼요.
                </li>
              </ul>
              {canWithdraw && (
                <Button
                  size="sm"
                  variant="tertiary"
                  isPending={commands.pending}
                  onPress={async () => {
                    if (await commands.withdraw(c.id))
                      say(
                        "신청을 취소했어요. 모집 기간에는 다시 신청할 수 있어요.",
                      );
                  }}
                >
                  신청 취소
                </Button>
              )}
            </div>
          </section>
        </>
      )}

      {/* 아래 고정 줄 — 관심 매체 선택 요약 줄(FavoritesView)과 같은 짙은 바탕 · 흰 글자 · 보라 버튼.
          위 칸들이 밝은 색이라, 지금 할 일이 짙은 줄로 떠서 눈에 먼저 들어온다. */}
      {action && (
        // 모바일은 한 단계 작게(글자 14 · 12px, 버튼 40px) — 아래 탭 바와 겹쳐 쌓여 화면을 많이 가렸다.
        <Card className="sticky bottom-[12px] z-10 mt-[8px] flex-row flex-wrap items-center gap-[12px] rounded-[24px] border-0 bg-gray-800 px-[18px] py-[14px] shadow-[0px_4px_10px_0px_rgba(31,41,55,0.4)] max-sm:bottom-[calc(10px+var(--partners-tabbar-space,0px))] max-sm:flex-nowrap max-sm:gap-[10px] max-sm:rounded-[22px] max-sm:py-[12px] max-sm:pr-[12px] max-sm:pl-[16px] dark:bg-gray-200">
          <div className="flex min-w-0 flex-1 flex-col">
            <Card.Title className="text-[15px] font-bold text-white max-sm:text-[14px]">
              {action.title}
            </Card.Title>
            {action.sub && (
              <Card.Description className="text-[13px] break-keep text-white/60 max-sm:text-[12px]">
                {action.sub}
              </Card.Description>
            )}
          </div>
          {action.button && (
            <Button
              isDisabled={!action.kind}
              isPending={commands.pending}
              onPress={() => void runAction(action.kind)}
              // 높이 46px → 곡률 20px · 모바일 40px → 17px.
              className="h-[46px] shrink-0 rounded-[20px] bg-primary-500 px-[20px] text-[14px] font-bold text-white max-sm:h-[40px] max-sm:rounded-[17px] max-sm:px-[14px] max-sm:text-[13px]"
            >
              {action.kind === "photo" ? (
                // 대시보드 "사진 올리기"와 같은 camera.svg(11-08 사용자).
                <MaskIcon src="/icons/camera.svg" className="size-[16px]" />
              ) : action.kind === "restock" ? (
                <Package className="size-[16px]" />
              ) : action.kind === "apply" ? (
                <ArrowRight className="size-[16px]" />
              ) : (
                <CheckCircle2 className="size-[16px]" />
              )}
              {action.button}
            </Button>
          )}
        </Card>
      )}

      <Modal isOpen={dialogOpen} onOpenChange={setDialogOpen}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog aria-label="최종 확정">
              <Modal.Header>
                <Modal.Heading className="text-[18px] font-bold break-keep text-gray-900">
                  위 내용으로 최종 확정할까요?
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-[8px] text-[14px] leading-[1.6] break-keep text-gray-600">
                <p className="font-bold text-gray-900">
                  확정은 브랜드와의 약속이에요.
                </p>
                <p>{CONFIRM_SENTENCE}</p>
              </Modal.Body>
              <Modal.Footer className="flex gap-[8px]">
                <Button
                  variant="tertiary"
                  onPress={() => setDialogOpen(false)}
                  className="h-[48px] shrink-0 rounded-[21px] px-[20px] text-[15px] font-semibold"
                >
                  돌아가기
                </Button>
                <Button
                  onPress={() => void finalConfirm()}
                  isPending={commands.pending}
                  className="h-[48px] flex-1 rounded-[21px] text-[15px] font-bold"
                >
                  최종 확정
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

function DetailById({ id, from }: { id: string; from?: CollabFrom }) {
  const { state, agreed, stores, store, isLoading } = usePartnerWorkspace();
  if (isLoading) return <LoadingState />;
  const c = state.collabs.find((x) => x.id === id);
  if (!c) {
    // 협약 전 · 매장 연결 전이면 콜라보를 볼 수 없다 — 대시보드(StartGate)와 같은 안내.
    const locked = !agreed || stores.length === 0;
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-[12px] text-center">
        <p className="text-[15px] font-semibold break-keep text-gray-900">
          {!agreed
            ? "기본협약을 해야 볼 수 있어요."
            : stores.length === 0
              ? "담당자가 매장을 연결하면 볼 수 있어요."
              : `${store?.name ?? "이 매장"}에서 볼 수 있는 콜라보가 아니에요.`}
        </p>
        <Link
          href={
            !agreed
              ? "/partners/join/agreement"
              : locked
                ? "/partners/dashboard"
                : "/partners/collabs"
          }
          className="text-[14px] font-semibold"
        >
          {!agreed
            ? "기본협약 하러 가기"
            : locked
              ? "대시보드로"
              : "콜라보 참여로"}
        </Link>
      </div>
    );
  }
  return <Detail key={c.id} c={c} from={from} />;
}

export function CollabDetail({ id, from }: { id: string; from?: string }) {
  // 모르는 값(?from=abc)은 무시 — 콜라보 목록에서 온 것처럼 "목록으로".
  const known =
    from && Object.hasOwn(COLLAB_FROM, from) ? (from as CollabFrom) : undefined;
  return (
    <PartnerOnly>
      <DetailById id={id} from={known} />
    </PartnerOnly>
  );
}
