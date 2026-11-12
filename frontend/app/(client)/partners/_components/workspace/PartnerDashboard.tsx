"use client";

import { Button, Card, Link, ProgressBar, toast } from "@heroui/react";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useRef, type ChangeEvent, type ReactNode } from "react";

import { LoadingState } from "@/components/common/RouteStates";
import { BrandAvatar } from "@/components/common/BrandAvatar";
import { MaskIcon } from "@/components/common/MaskIcon";
import { SquareCheck } from "@/components/common/SquareCheck";
import { TOAST_TIMEOUT } from "@/hooks/useSonner";
import {
  activityOf,
  categoryOf,
  diffDays,
  dueStepOf,
  kstStamp,
  md,
  nextActionOf,
  periodDays,
  STEP_LABEL,
  type PhotoStep,
  type PreviewCollab,
} from "@/lib/partnersPreview";
import { cn } from "@/lib/utils";

import { collabHref } from "./CollabBoard";
import { useCollabCommands, usePartnerWorkspace } from "./partnerState";
import { StartGate } from "./StartGate";
import {
  EmptyBox,
  PageHead,
  PanelCard,
  PartnerOnly,
  SectionHead,
  StorePicker,
  GLASS_CARD,
  SHADOW_FLOAT,
  SHADOW_LIFT,
} from "./workspaceUi";

/*
 * /partners/dashboard — 제휴사(콜라보) 매장 대시보드(서버, 069).
 * 매장이 여러 곳이면 위에서 고른다(StorePicker). 숫자 4칸 — 진행 중인 콜라보 · 신청한 콜라보 · 확정할 콜라보 · 완료.
 * 아래는 진행 중인 콜라보 · 최근 활동만. 모집 중인 콜라보는 "콜라보 참여" 메뉴로, 확정할 콜라보(확정 요청)는 알림으로,
 * 신청한 콜라보 구역은 뺐다(2026-11-09 사용자). 협약 전 · 매장 연결 전이면 StartGate.
 * 지금 확인할 일은 사이드바 알림(PartnerNotifications) — 확정 요청이 맨 위.
 */

function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group/more flex shrink-0 items-center gap-[2px] text-[13px] font-semibold text-gray-500 no-underline hover:text-gray-900"
    >
      {children}
      {/* 마우스를 올리면 화살표가 오른쪽으로 — 사이드바 "admix로 돌아가기"(왼쪽으로)와 같은 움직임. */}
      <ArrowRight className="size-[14px] transition-transform duration-200 ease-out group-hover/more:translate-x-[4px] motion-reduce:transition-none" />
    </Link>
  );
}

/** 진행 중 카드 그림자 — 가장 높이 떠서 맨 먼저 보인다(FLOAT · LIFT 는 workspaceUi). */
const SHADOW_HERO =
  "shadow-[0_2px_8px_rgba(16,24,40,0.05),0_20px_48px_rgba(16,24,40,0.09)]";

/**
 * 진행 중 콜라보 — 맨 위 넓은 카드.
 * 읽는 순서: ① 무엇을(브랜드 사진·이름) ② 기간 진행 | 사진 보고 단계(좌우) ③ 지금 할 일.
 * 색은 회색 바탕 + 포인트만 보라 — 사진 올리기 버튼 · "오늘 할 일" · 진행 막대 · 사진 보고 점과 선.
 * 사진 보고: 끝난 것은 초록 점(선은 초록 그라데이션), 오늘은 보라 테두리 점, 오늘 할 게 없으면 바로 다음 칸은 이어진 회색 테두리(선은 초록→회색), 그 뒤는 회색 점선.
 */
function ActiveCard({ c, today }: { c: PreviewCollab; today: string }) {
  const router = useRouter();
  const commands = useCollabCommands();
  const total = periodDays(c.startDate, c.endDate);
  const day = Math.min(total, Math.max(0, diffDays(today, c.startDate) + 1));
  const left = Math.max(0, diffDays(c.endDate, today));
  const steps: { step: PhotoStep; date: string; label: string }[] = [
    { step: "install", date: c.installDate, label: "설치" },
    ...c.checks.map((k, i) => ({
      step: k.step,
      date: k.date,
      label: `${i + 1}차 점검`,
    })),
  ];
  const due = dueStepOf(c, today);
  const isDone = (s: PhotoStep) => c.photos.some((p) => p.step === s);
  // 오늘 낼 사진이 없으면 바로 다음 칸을 "다음 예정"으로 — 선은 초록→회색, 표시는 점선 대신 이어진 테두리(11-08 사용자).
  const nextStep = due ? undefined : steps.find((s) => !isDone(s.step))?.step;
  // 사진 올리기 — 상세로 옮겨 가지 않고 여기서 바로(파일 고르기 → 서버에 올림 → 알림), 11-08 사용자.
  const fileRef = useRef<HTMLInputElement>(null);
  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !due) return;
    const saved = await commands.addPhoto(c.id, due.step, file);
    if (saved)
      toast(
        `${STEP_LABEL[due.step]} 사진을 올렸어요. admix가 남은 수량을 확인해요.`,
        { timeout: TOAST_TIMEOUT },
      );
  };

  return (
    <PanelCard className={cn("gap-[20px] p-[20px] sm:p-[24px]", SHADOW_HERO)}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => void onPhoto(e)}
      />
      {/*
       * ① 무엇을 — PC는 오른쪽 위에 "진행 중".
       * 모바일은 "진행 중"을 브랜드 이름 옆으로 옮겨 제목이 카드 너비를 다 쓰게 하고, 길면 두 줄까지(11-08 사용자).
       */}
      <div className="flex items-start justify-between gap-[12px]">
        <div className="flex min-w-0 flex-1 items-center gap-[12px]">
          <BrandAvatar src={c.brandImage} name={c.brand} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-[10px] text-[13px] font-medium text-gray-500">
              {c.brand}
              <LiveBadge className="sm:hidden" />
            </p>
            <Card.Title className="truncate text-[16px] leading-[1.35] font-bold text-gray-900 max-sm:line-clamp-2 max-sm:whitespace-normal sm:text-[18px]">
              {c.title}
            </Card.Title>
          </div>
        </div>
        <LiveBadge className="py-[5px] max-sm:hidden" />
      </div>

      {/*
       * ② 기간 | 사진 보고 — 넓으면 좌우로 나란히, 가운데 세로 구분선(좁으면 위아래 + 가로 구분선).
       * 두 칸 모두 [머리 줄] → [20px 줄: 막대 / 점] → [아래 글자] 같은 틀이라 막대와 점 선이 같은 높이에 온다.
       */}
      <div className="grid gap-[20px] md:grid-cols-2 md:gap-0">
        <ProgressBar
          aria-label={`${c.title} 진행 기간`}
          value={day}
          maxValue={total}
          size="sm"
          className="flex flex-col gap-[8px] md:pr-[28px]"
        >
          <StageHead
            label="진행 기간"
            value={`${day}일차`}
            rest={` / ${total}일 · ${left ? `${left}일 남음` : "오늘 종료"}`}
          />
          <div className="flex flex-col gap-[6px]">
            <div className="flex h-[20px] items-center">
              <ProgressBar.Track className="w-full">
                <ProgressBar.Fill className="bg-primary-500" />
              </ProgressBar.Track>
            </div>
            <div className="flex justify-between text-[12px] text-gray-500">
              <span>시작 {md(c.startDate)}</span>
              <span>종료 {md(c.endDate)}</span>
              <span>철수 {md(c.removalDate)}</span>
            </div>
          </div>
        </ProgressBar>

        <div className="flex flex-col gap-[8px] border-t border-gray-100 pt-[20px] md:border-t-0 md:border-l md:pt-0 md:pl-[28px]">
          <StageHead
            label="사진 보고"
            value={String(steps.filter((s) => isDone(s.step)).length)}
            rest={` / ${steps.length}`}
          />
          {/* 모바일 — 첫 칸은 왼쪽 끝, 마지막 칸은 오른쪽 끝에 붙여 진행도가 좌우를 꽉 채운다(11-08 사용자). */}
          <PhotoStepsFull
            steps={steps}
            isDone={isDone}
            due={due?.step}
            nextStep={nextStep}
          />
          <ol className="flex max-sm:hidden">
            {steps.map((s, i) => {
              const done = isDone(s.step);
              const now = due?.step === s.step;
              const next = nextStep === s.step;
              return (
                <li
                  key={s.step}
                  className="relative flex flex-1 flex-col items-center gap-[6px] text-center"
                >
                  {/* 앞 단계에서 이어지는 선 — 표시 뒤(z-0). 끝난 → 끝난은 초록 한 색, 끝난 → 오늘은 초록에서 보라로, 끝난 → 다음 예정은 초록에서 회색으로, 그 뒤는 회색 점선(콜라보 상세 진행 흐름과 같다). */}
                  {i > 0 && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute right-1/2 z-0 w-full",
                        done || now || next ? "top-[8.5px]" : "top-[9px]",
                        stepLine(done, now, next),
                      )}
                    />
                  )}
                  {/* 끝남 초록 square-check · 오늘 보라 네모 · 아직 회색 점선 네모(흰 바탕을 깔아 뒤 선을 가린다). */}
                  <span className="relative z-10 flex rounded-[6px] bg-surface">
                    <SquareCheck
                      on={done}
                      now={now}
                      next={next}
                      label={
                        done ? "끝남" : now ? "오늘" : next ? "다음" : "아직"
                      }
                      className="size-[20px]"
                    />
                  </span>
                  <span
                    className={cn(
                      "text-[12px] font-semibold",
                      now || done ? "text-gray-900" : "text-gray-500",
                    )}
                  >
                    {s.label}
                  </span>
                  <span
                    className={cn(
                      "-mt-[4px] text-[11px]",
                      now ? "font-semibold text-primary-600" : "text-gray-400",
                    )}
                  >
                    {now ? "오늘" : md(s.date)}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* ③ 지금 할 일 — 회색 상자(이름표 · 할 일 · 오른쪽 버튼, 카메라는 버튼 안). */}
      <div
        className={cn(
          // 모바일은 작게(11-08 사용자) — 세로로 쌓던 꽉 찬 버튼 대신 오른쪽 작은 버튼, 여백 · 글자 한 단계씩 작게.
          "flex items-center justify-between gap-[12px] rounded-[16px] border p-[12px] sm:mt-[8px] sm:gap-[14px] sm:rounded-[18px] sm:p-[14px]",
          "border-gray-200 bg-gray-50",
        )}
      >
        <div className="flex min-w-0 items-center gap-[12px] pl-[2px] sm:pl-[4px]">
          <div className="min-w-0">
            <p
              className={cn(
                "text-[11px] font-medium sm:text-[12px]",
                due ? "text-primary-600" : "text-gray-500",
              )}
            >
              {due ? "오늘 할 일" : "다음 일정"}
            </p>
            <p className="text-[13px] leading-[1.4] font-bold break-keep text-gray-900 sm:text-[15px]">
              {nextActionOf(c, today)}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant={due ? "primary" : "secondary"}
          aria-label={due ? "사진 올리기" : undefined}
          isPending={due ? commands.photoPending : undefined}
          onPress={() =>
            due
              ? fileRef.current?.click()
              : router.push(collabHref(c.id, "dashboard"))
          }
          className={cn(
            // 모바일 36px → 곡률 15px(높이/2 − 3px). 사진 올리기는 모바일에서 카메라 아이콘만(36px 네모, 11-08 사용자).
            "h-[40px] shrink-0 rounded-[17px] px-[16px] font-bold max-sm:h-[36px] max-sm:rounded-[15px] max-sm:px-[12px] max-sm:text-[13px]",
            due && "max-sm:w-[36px] max-sm:min-w-0 max-sm:px-0",
          )}
        >
          {/* 아이콘은 하는 일과 함께 — 사진 올리기는 카메라를 버튼 앞에, 안내함은 화살표를 뒤에. */}
          {due ? (
            <>
              <MaskIcon
                src="/icons/camera.svg"
                className="size-[17px] sm:size-[16px]"
              />
              <span className="max-sm:hidden">사진 올리기</span>
            </>
          ) : (
            <>
              진행 안내함
              <ArrowRight className="size-[14px]" />
            </>
          )}
        </Button>
      </div>
    </PanelCard>
  );
}

/** 진행 중 — 깜박이는 초록 점(지금 진행 중이라는 표시) + 글자. */
function LiveBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-[7px] text-[12px] font-bold text-gray-700",
        className,
      )}
    >
      <span aria-hidden className="relative flex size-[7px]">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
        <span className="relative inline-flex size-[7px] rounded-full bg-emerald-500" />
      </span>
      진행 중
    </span>
  );
}

/**
 * 사진 보고 선 — 끝난 → 끝난은 초록 한 색, 끝난 → 오늘은 초록에서 보라로, 끝난 → 다음 예정은 초록에서 회색으로,
 * 그 뒤는 회색 점선(콜라보 상세 진행 흐름과 같다).
 */
function stepLine(done: boolean, now: boolean, next: boolean) {
  return done
    ? "h-[3px] rounded-full bg-emerald-500"
    : now
      ? "h-[3px] rounded-full bg-linear-to-r from-emerald-500 to-primary-500"
      : next
        ? "h-[3px] rounded-full bg-linear-to-r from-emerald-500 to-gray-300"
        : "h-[2px] bg-[repeating-linear-gradient(to_right,var(--color-gray-300)_0_2px,transparent_2px_4px)]";
}

/**
 * 사진 보고 — 모바일(좌우 꽉 채움).
 * 위 줄: 표시 · 선 · 표시 … (첫 표시는 왼쪽 끝, 마지막은 오른쪽 끝, 선이 사이를 고르게 채운다).
 * 아래 줄: 이름 · 날짜를 각 표시 밑에 — 첫 칸은 왼쪽 맞춤, 마지막 칸은 오른쪽 맞춤, 가운데 칸은 표시 가운데.
 */
function PhotoStepsFull({
  steps,
  isDone,
  due,
  nextStep,
}: {
  steps: { step: PhotoStep; date: string; label: string }[];
  isDone: (s: PhotoStep) => boolean;
  due?: PhotoStep;
  nextStep?: PhotoStep;
}) {
  const last = steps.length - 1;
  return (
    <div className="sm:hidden">
      <div className="flex items-center">
        {steps.map((s, i) => {
          const done = isDone(s.step);
          const now = due === s.step;
          const next = nextStep === s.step;
          return (
            <Fragment key={s.step}>
              {i > 0 && (
                <span
                  aria-hidden
                  className={cn("min-w-0 flex-1", stepLine(done, now, next))}
                />
              )}
              <SquareCheck
                on={done}
                now={now}
                next={next}
                label={done ? "끝남" : now ? "오늘" : next ? "다음" : "아직"}
                className="size-[20px] shrink-0"
              />
            </Fragment>
          );
        })}
      </div>
      {/* 표시 가운데 = 왼쪽 끝 10px + (너비 − 20px) × i/마지막. */}
      <div className="relative mt-[6px] h-[33px]">
        {steps.map((s, i) => {
          const done = isDone(s.step);
          const now = due === s.step;
          const edge = i === 0 ? "start" : i === last ? "end" : "mid";
          return (
            <span
              key={s.step}
              style={
                edge === "mid"
                  ? { left: `calc(10px + (100% - 20px) * ${i / last})` }
                  : undefined
              }
              className={cn(
                "absolute top-0 flex flex-col gap-[2px] whitespace-nowrap",
                edge === "start" && "left-0 items-start",
                edge === "end" && "right-0 items-end",
                edge === "mid" && "-translate-x-1/2 items-center",
              )}
            >
              <span
                className={cn(
                  "text-[12px] font-semibold",
                  now || done ? "text-gray-900" : "text-gray-500",
                )}
              >
                {s.label}
              </span>
              <span
                className={cn(
                  "text-[11px]",
                  now ? "font-semibold text-primary-600" : "text-gray-400",
                )}
              >
                {now ? "오늘" : md(s.date)}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** 진행 기간 · 사진 보고 머리 줄 — 두 칸이 같은 높이가 되게 한 틀로. */
function StageHead({
  label,
  value,
  rest,
}: {
  label: string;
  value: string;
  rest: string;
}) {
  return (
    <div className="flex h-[22px] items-baseline justify-between text-[13px]">
      <span className="font-semibold text-gray-700">{label}</span>
      <span className="text-gray-500">
        <b className="text-[15px] text-gray-900">{value}</b>
        {rest}
      </span>
    </div>
  );
}

/**
 * 숫자 칸 오른쪽 위 작은 아이콘 — 바탕 없이 색 아이콘만.
 * 진행 중은 보라, 완료는 초록(11-08 사용자) — 콜라보 상세의 진행 흐름(지금 보라 · 끝남 초록)과 같은 뜻.
 */
const STAT_TONE = {
  ongoing: { tile: "text-primary-500", icon: "/icons/pulse.svg" },
  upcoming: { tile: "text-sky-500", icon: "/icons/pin.svg" },
  requested: { tile: "text-amber-500", icon: "/icons/ringing.svg" },
  done: { tile: "text-emerald-500", icon: "/icons/stroke-square-check.svg" },
} as const;

function StatIcon({
  tone,
  className,
}: {
  tone: keyof typeof STAT_TONE;
  className?: string;
}) {
  const { tile, icon } = STAT_TONE[tone];
  return (
    <MaskIcon
      src={icon}
      className={cn("mt-[2px] size-[16px]", tile, className)}
    />
  );
}

/** 숫자 칸 — 갈 곳이 있으면 링크, 없으면(확정할 콜라보 0건) 누르지 않는 칸. */
function StatTile({
  href,
  label,
  className,
  children,
}: {
  href?: string;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return href ? (
    <Link href={href} aria-label={label} className={className}>
      {children}
    </Link>
  ) : (
    <div role="group" aria-label={label} className={className}>
      {children}
    </div>
  );
}

function Overview() {
  const { state, today } = usePartnerWorkspace();
  const cats = state.collabs.map((c) => ({ c, cat: categoryOf(c, today) }));
  const active = cats.filter((x) => x.cat === "ongoing").map((x) => x.c);
  // 확정할 콜라보 — 확정 요청을 받아 매장이 최종 확정해야 하는 콜라보(예전 "확정 요청"). 목록은 알림에.
  const toConfirm = state.collabs
    .filter((c) => c.standing === "requested")
    .sort((a, b) => a.confirmDue.localeCompare(b.confirmDue));
  // 신청한 콜라보 — 신청(선정 후보 · 예비)했거나 확정하고 설치를 기다리는 콜라보(예전 "확정 예정").
  const applied = cats
    .filter((x) => x.cat === "upcoming" && x.c.standing !== "requested")
    .map((x) => x.c)
    .sort(
      (a, b) =>
        Number(b.standing === "confirmed") -
          Number(a.standing === "confirmed") ||
        a.startDate.localeCompare(b.startDate),
    );
  const completed = cats.filter((x) => x.cat === "done").map((x) => x.c);
  const events = activityOf(state).slice(0, 5);

  /*
   * 숫자 4칸 — 떨어진 흰 칸 넷(그림자), 큰 숫자 + 오른쪽 위 작은 색 아이콘.
   * 누르면 그 콜라보 상세 · 참여 이력으로. "확정할 · 신청한 콜라보" 구역은 대시보드에서 뺐다(2026-11-09 사용자 — 확정 요청은 알림에).
   * 갈 곳이 없으면(확정할 콜라보 0건) 누르지 않는 칸.
   */
  const stats: {
    label: string;
    tone: keyof typeof STAT_TONE;
    value: number;
    href?: string;
  }[] = [
    {
      label: "진행 중인 콜라보",
      tone: "ongoing",
      value: active.length,
      href: active[0] ? collabHref(active[0].id, "dashboard") : "#ongoing",
    },
    {
      label: "신청한 콜라보",
      tone: "upcoming",
      value: applied.length,
      // 없으면 신청하러 — 콜라보 참여(모집 중).
      href: applied[0]
        ? collabHref(applied[0].id, "dashboard")
        : "/partners/collabs",
    },
    {
      label: "확정할 콜라보",
      tone: "requested",
      value: toConfirm.length,
      href: toConfirm[0] && collabHref(toConfirm[0].id, "dashboard"),
    },
    {
      label: "완료",
      tone: "done",
      value: completed.length,
      href: "/partners/history?status=completed",
    },
  ];

  return (
    // 구역 사이 — 모바일 32px · PC 44px. 제목과 첫 구역 사이는 Dashboard 가 따로 정한다.
    <div className="flex flex-col gap-[32px] sm:gap-[44px]">
      {/*
       * 모바일 — 유리 카드 한 장을 2×2로 나눈 낮은 칸(왼쪽 아이콘 · 이름 | 오른쪽 숫자, 칸 사이 가는 선).
       * 처음 2×2 큰 칸은 첫 화면 절반을 차지했고, 4열 한 줄은 칸이 너무 좁았다(11-08 사용자).
       */}
      <div
        className={cn(
          "grid grid-cols-2 overflow-hidden rounded-[22px] border sm:hidden",
          SHADOW_FLOAT,
          GLASS_CARD,
        )}
      >
        {stats.map((s, i) => (
          <StatTile
            key={s.label}
            href={s.href}
            label={`${s.label} ${s.value}건`}
            className={cn(
              // w-full — HeroUI Link 의 w-fit 을 덮어 칸을 꽉 채운다.
              "flex w-full min-w-0 items-center justify-between gap-[8px] rounded-none px-[14px] py-[14px] no-underline hover:no-underline",
              s.href && "active:bg-gray-50",
              i % 2 === 1 && "border-l border-gray-100",
              i >= 2 && "border-t border-gray-100",
            )}
          >
            <span className="flex min-w-0 items-center gap-[6px]">
              <StatIcon tone={s.tone} className="mt-0 size-[15px] shrink-0" />
              <span className="truncate text-[12px] font-semibold text-gray-600">
                {s.label}
              </span>
            </span>
            <strong className="shrink-0 text-[20px] leading-none font-extrabold text-gray-900">
              {s.value}
              <small className="ml-[2px] text-[12px] font-semibold text-gray-400">
                건
              </small>
            </strong>
          </StatTile>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-[10px] max-sm:hidden lg:grid-cols-4">
        {stats.map((s) => (
          <StatTile
            key={s.label}
            href={s.href}
            label={`${s.label} ${s.value}건`}
            className={cn(
              "flex w-full items-start justify-between gap-[10px] rounded-[20px] border bg-surface px-[20px] py-[18px] no-underline hover:no-underline",
              SHADOW_FLOAT,
              s.href && SHADOW_LIFT,
              GLASS_CARD,
            )}
          >
            <span className="flex flex-col gap-[12px]">
              <span className="text-[14px] font-semibold text-gray-600">
                {s.label}
              </span>
              <strong className="text-[32px] leading-none font-extrabold text-gray-900">
                {s.value}
                <small className="ml-[4px] text-[14px] font-semibold text-gray-400">
                  건
                </small>
              </strong>
            </span>
            <StatIcon tone={s.tone} />
          </StatTile>
        ))}
      </div>

      {/* 진행 중인 콜라보 — 넓은 진행 카드 */}
      <section
        id="ongoing"
        className="flex scroll-mt-[24px] flex-col gap-[16px]"
      >
        <SectionHead
          icon="/icons/stroke-clap.svg"
          title="진행 중인 콜라보"
          more={
            active[0] && (
              <MoreLink href={collabHref(active[0].id, "dashboard")}>
                진행 현황 보기
              </MoreLink>
            )
          }
        />
        {active.length ? (
          <div className="flex flex-col gap-[12px]">
            {active.map((c) => (
              <ActiveCard key={c.id} c={c} today={today} />
            ))}
          </div>
        ) : (
          <EmptyBox
            icon={
              <MaskIcon src="/icons/face-sleep.svg" className="size-[26px]" />
            }
          >
            <b className="text-gray-700">진행 중인 콜라보가 없어요.</b>
          </EmptyBox>
        )}
      </section>

      {/* 최근 활동 — 카드 대신 세로 타임라인(왼쪽 선 · 점)으로 위 카드 구역들과 모양부터 다르게. */}
      <section className="flex flex-col gap-[16px]">
        <SectionHead
          icon="/icons/history.svg"
          small
          title="최근 활동"
          more={<MoreLink href="/partners/history">전체 이력</MoreLink>}
        />
        {events.length ? (
          <ol className="relative ml-[15px] flex flex-col pl-[24px] before:absolute before:inset-y-0 before:left-[0.5px] before:w-px before:bg-[repeating-linear-gradient(to_bottom,var(--color-gray-300)_0_2px,transparent_2px_4px)]">
            {events.map((e, i) => (
              <li key={e.id} className="relative">
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-[15px] -left-[28px] z-10 size-[10px] rounded-full ring-4 ring-gray-50",
                    i === 0 ? "bg-gray-700" : "bg-gray-300",
                  )}
                />
                <Link
                  href={collabHref(e.collabId, "dashboard")}
                  className="flex items-baseline gap-[12px] rounded-[12px] px-[10px] py-[10px] text-[14px] no-underline transition-[background-color,box-shadow] hover:bg-surface hover:no-underline hover:shadow-[0_1px_3px_rgba(16,24,40,0.06),0_6px_16px_rgba(16,24,40,0.06)]"
                >
                  <time className="w-[40px] shrink-0 text-[12px] text-gray-400">
                    {kstStamp(e.at).slice(0, 5)}
                  </time>
                  {/* 모바일은 제목 아래 줄에 콜라보 이름 — 좁으면 줄마다 한 줄 · 두 줄이 섞여 들쭉날쭉했다. */}
                  <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-[8px] max-sm:flex-col max-sm:gap-y-[3px]">
                    <b className="font-semibold text-gray-900">{e.title}</b>
                    <span className="truncate text-[12px] text-gray-400 max-sm:w-full">
                      {e.collab}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          // 진행 중인 콜라보와 같은 빈 상자, 아이콘은 time-sleep.svg(11-10 사용자).
          <EmptyBox
            icon={
              <MaskIcon
                src="/icons/time-sleep.svg"
                className="size-[26px] shrink-0"
              />
            }
          >
            <b className="text-gray-700">아직 활동이 없어요.</b>
          </EmptyBox>
        )}
      </section>
    </div>
  );
}

function Dashboard() {
  const { stores, agreed, isLoading } = usePartnerWorkspace();
  const ready = agreed && stores.length > 0;

  return (
    // 제목 아래 — PC 24px("숫자 칸 위 여백 줄여줘", 11-08 사용자). 모바일은 제목을 숨겨 바로 숫자 칸부터.
    <div className="flex flex-1 flex-col gap-[16px] sm:gap-[24px]">
      {/* 모바일은 제목을 감춘다 — 아래 탭 바가 이미 "대시보드"를 켜 보여 준다(11-08 사용자). 화면 읽기 프로그램용으로는 남긴다. */}
      <PageHead title="대시보드" className="max-sm:sr-only" />
      {isLoading ? (
        <LoadingState />
      ) : ready ? (
        <>
          <StorePicker />
          <Overview />
        </>
      ) : (
        <StartGate agreed={agreed} />
      )}
    </div>
  );
}

export function PartnerDashboard() {
  return (
    <PartnerOnly>
      <Dashboard />
    </PartnerOnly>
  );
}
