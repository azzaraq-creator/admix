"use client";

import {
  Button,
  Card,
  Link,
  ProgressBar,
  ScrollShadow,
  toast,
} from "@heroui/react";
import { ArrowRight, Coffee } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useRef, type ChangeEvent, type ReactNode } from "react";

import { LoadingState } from "@/components/common/RouteStates";
import { BrandAvatar } from "@/components/common/BrandAvatar";
import { MaskIcon } from "@/components/common/MaskIcon";
import { SquareCheck } from "@/components/common/SquareCheck";
import { useMyPartnersStores } from "@/hooks/partners";
import { useIsDesktop } from "@/hooks/useIsDesktop";
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
  PREVIEW_TODAY,
  STEP_LABEL,
  type PhotoStep,
  type PreviewCollab,
} from "@/lib/partnersPreview";
import { cn } from "@/lib/utils";

import { collabHref, RecruitCard } from "./CollabBoard";
import { previewActions, toThumb, usePreviewState } from "./previewStore";
import {
  EmptyBox,
  PageHead,
  PanelCard,
  PartnerOnly,
  SectionHead,
  GLASS_CARD,
  SHADOW_FLOAT,
  SHADOW_LIFT,
} from "./workspaceUi";

/*
 * /partners/dashboard — 제휴사(콜라보) 매장 대시보드.
 * 받은 프로토타입(카페 파트너 미리보기)의 대시보드를 흉내 낸 화면. 콜라보 숫자 · 목록은 예시 데이터.
 * 매장을 아직 등록하지 않았으면 매장 등록 안내만 보인다(사이드바도 대시보드만).
 * 지금 확인할 일은 사이드바 알림(PartnerNotifications)으로 옮겼다.
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

/** 매장 등록 전 — 등록부터 안내. 카드 배경 없이 제목 아래 남은 자리 한가운데에. */
function RegisterStore() {
  const router = useRouter();
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-[14px] px-[24px] pb-[44px] text-center">
      <span className="flex size-[56px] items-center justify-center rounded-[20px] bg-primary-50 text-primary-500">
        <MaskIcon src="/icons/store.svg" className="size-[26px]" />
      </span>
      <h2 className="text-[18px] font-bold text-gray-900">
        매장을 먼저 등록해 주세요
      </h2>
      <p className="max-w-[360px] text-[14px] leading-[1.6] break-keep text-gray-500">
        매장을 등록하면 브랜드 콜라보 모집을 보고 신청할 수 있어요.
      </p>
      <Button
        onPress={() => router.push("/partners/join/store")}
        className="mt-[4px] h-[48px] rounded-[21px] px-[24px] text-[15px] font-bold"
      >
        매장 등록하기
        <ArrowRight className="size-[16px]" />
      </Button>
    </section>
  );
}

/**
 * 진행 중 콜라보 — 맨 위 넓은 카드.
 * 읽는 순서: ① 무엇을(브랜드 사진·이름) ② 기간 진행 | 사진 보고 단계(좌우) ③ 지금 할 일.
 * 색은 회색 바탕 + 포인트만 보라 — 사진 올리기 버튼 · "오늘 할 일" · 진행 막대 · 사진 보고 점과 선.
 * 사진 보고: 끝난 것은 초록 점(선은 초록 그라데이션), 오늘은 보라 테두리 점, 오늘 할 게 없으면 바로 다음 칸은 이어진 회색 테두리(선은 초록→회색), 그 뒤는 회색 점선.
 */
function ActiveCard({ c }: { c: PreviewCollab }) {
  const router = useRouter();
  const total = periodDays(c.startDate, c.endDate);
  const day = Math.min(
    total,
    Math.max(0, diffDays(PREVIEW_TODAY, c.startDate) + 1),
  );
  const left = Math.max(0, diffDays(c.endDate, PREVIEW_TODAY));
  const steps: { step: PhotoStep; date: string; label: string }[] = [
    { step: "install", date: c.installDate, label: "설치" },
    ...c.checks.map((k, i) => ({
      step: k.step,
      date: k.date,
      label: `${i + 1}차 점검`,
    })),
  ];
  const due = dueStepOf(c);
  const isDone = (s: PhotoStep) => c.photos.some((p) => p.step === s);
  // 오늘 낼 사진이 없으면 바로 다음 칸을 "다음 예정"으로 — 선은 초록→회색, 표시는 점선 대신 이어진 테두리(11-08 사용자).
  const nextStep = due ? undefined : steps.find((s) => !isDone(s.step))?.step;
  // 사진 올리기 — 상세로 옮겨 가지 않고 여기서 바로(파일 고르기 → 예시 상태에 저장 → 알림), 11-08 사용자.
  const fileRef = useRef<HTMLInputElement>(null);
  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !due) return;
    previewActions.addPhoto(c.id, due.step, await toThumb(file));
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
            <div className="flex justify-between text-[12px] text-gray-500 tabular-nums">
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
                      "-mt-[4px] text-[11px] tabular-nums",
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
              {nextActionOf(c)}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant={due ? "primary" : "secondary"}
          aria-label={due ? "사진 올리기" : undefined}
          onPress={() =>
            due
              ? fileRef.current?.click()
              : router.push(collabHref(c.id, "dashboard"))
          }
          className={cn(
            // 모바일 36px → 곡률 15px(높이/2 − 3px). 사진 올리기는 모바일에서 카메라 아이콘만(36px 네모, 11-08 사용자).
            "h-[40px] shrink-0 rounded-[14px] px-[16px] font-bold max-sm:h-[36px] max-sm:rounded-[15px] max-sm:px-[12px] max-sm:text-[13px]",
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
                  "text-[11px] tabular-nums",
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
      <span className="text-gray-500 tabular-nums">
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

function Overview() {
  const state = usePreviewState();
  const isDesktop = useIsDesktop();
  const cats = state.collabs.map((c) => ({ c, cat: categoryOf(c) }));
  const active = cats.filter((x) => x.cat === "ongoing").map((x) => x.c);
  const upcoming = cats
    .filter((x) => x.cat === "upcoming" && x.c.standing === "confirmed")
    .map((x) => x.c)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const requested = state.collabs.filter((c) => c.standing === "requested");
  const completed = cats.filter((x) => x.cat === "done").map((x) => x.c);
  const recruiting = cats
    .filter((x) => x.cat === "recruiting")
    .map((x) => x.c)
    .sort(
      (a, b) =>
        Number(a.standing === "blocked") - Number(b.standing === "blocked") ||
        a.recruitEnd.localeCompare(b.recruitEnd),
    );
  const events = activityOf(state).slice(0, 5);

  // 숫자 4칸 — 떨어진 흰 칸 넷(그림자), 큰 숫자 + 오른쪽 위 작은 색 아이콘. 누르면 해당 목록으로.
  const stats = [
    {
      label: "진행 중",
      tone: "ongoing" as const,
      value: active.length,
      href: "/partners/collabs?tab=ongoing",
    },
    {
      label: "확정 예정",
      tone: "upcoming" as const,
      value: upcoming.length,
      href: "/partners/collabs?tab=upcoming",
    },
    {
      label: "확정 요청",
      tone: "requested" as const,
      value: requested.length,
      href: requested[0]
        ? collabHref(requested[0].id, "dashboard")
        : "/partners/collabs?tab=upcoming",
    },
    {
      label: "완료",
      tone: "done" as const,
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
          <Link
            key={s.label}
            href={s.href}
            aria-label={`${s.label} ${s.value}건`}
            className={cn(
              // w-full — HeroUI Link 의 w-fit 을 덮어 칸을 꽉 채운다.
              "flex w-full min-w-0 items-center justify-between gap-[8px] rounded-none px-[16px] py-[14px] no-underline hover:no-underline active:bg-gray-50",
              i % 2 === 1 && "border-l border-gray-100",
              i >= 2 && "border-t border-gray-100",
            )}
          >
            <span className="flex min-w-0 items-center gap-[6px]">
              <StatIcon tone={s.tone} className="mt-0 size-[15px]" />
              <span className="truncate text-[13px] font-semibold text-gray-600">
                {s.label}
              </span>
            </span>
            <strong className="shrink-0 text-[20px] leading-none font-extrabold text-gray-900 tabular-nums">
              {s.value}
              <small className="ml-[2px] text-[12px] font-semibold text-gray-400">
                건
              </small>
            </strong>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-[10px] max-sm:hidden lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            aria-label={`${s.label} ${s.value}건`}
            className={cn(
              "flex w-full items-start justify-between gap-[10px] rounded-[20px] border bg-surface px-[20px] py-[18px] no-underline hover:no-underline",
              SHADOW_FLOAT,
              SHADOW_LIFT,
              GLASS_CARD,
            )}
          >
            <span className="flex flex-col gap-[12px]">
              <span className="text-[14px] font-semibold text-gray-600">
                {s.label}
              </span>
              <strong className="text-[32px] leading-none font-extrabold text-gray-900 tabular-nums">
                {s.value}
                <small className="ml-[4px] text-[14px] font-semibold text-gray-400">
                  건
                </small>
              </strong>
            </span>
            <StatIcon tone={s.tone} />
          </Link>
        ))}
      </div>

      {/* 지금 함께하는 콜라보 — 맨 위, 넓은 진행 카드 */}
      <section className="flex flex-col gap-[16px]">
        <SectionHead
          icon="/icons/stroke-clap.svg"
          title="지금 함께하는 콜라보"
          more={
            // 진행 중인 콜라보가 있으면 그 콜라보 상세(진행 안내함)로, 없으면 목록의 진행 중 칸으로.
            <MoreLink
              href={
                active[0]
                  ? collabHref(active[0].id, "dashboard")
                  : "/partners/collabs?tab=ongoing"
              }
            >
              진행 현황 보기
            </MoreLink>
          }
        />
        {active.length ? (
          <div className="flex flex-col gap-[12px]">
            {active.map((c) => (
              <ActiveCard key={c.id} c={c} />
            ))}
          </div>
        ) : (
          <EmptyBox icon={<Coffee className="size-[26px]" />}>
            <b className="text-gray-700">진행 중인 콜라보가 없어요.</b>
            최종 확정한 콜라보가 설치되면 이곳에 보여요.
          </EmptyBox>
        )}
      </section>

      {/* 모집 중인 콜라보 — 마감 D-day가 먼저 보이는 카드 3장 */}
      <section className="flex flex-col gap-[16px]">
        <SectionHead
          icon="/icons/megaphone.svg?v=2"
          small
          title="모집 중인 콜라보"
          count={recruiting.length}
          description="선착순 신청 · 신청만으로 확정되지 않아요."
          more={
            <MoreLink href="/partners/collabs?tab=recruiting">
              전체 보기
            </MoreLink>
          }
        />
        {recruiting.length ? (
          // 모바일 — 세로로 세 장 쌓으면 길어서, 옆으로 넘기는 한 줄(다음 카드가 살짝 보인다). 화면 끝까지 흐르게 -mx.
          // 그림자가 잘리지 않게 위아래 여백을 두고 같은 만큼 바깥 여백을 줄인다.
          // 양 끝은 HeroUI ScrollShadow 로 흐리게 — 넘길 카드가 더 있다는 표시(11-08 사용자). PC는 세 칸 격자라 끈다.
          <ScrollShadow
            orientation="horizontal"
            hideScrollBar
            size={36}
            isEnabled={!isDesktop}
            visibility={isDesktop ? "none" : "auto"}
            className="-mx-[16px] -my-[10px] flex snap-x snap-mandatory scroll-px-[16px] gap-[12px] px-[16px] py-[10px] sm:mx-0 sm:my-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:p-0"
          >
            {recruiting.slice(0, 3).map((c) => (
              <div key={c.id} className="w-[78%] shrink-0 snap-start sm:w-auto">
                <RecruitCard c={c} from="dashboard" />
              </div>
            ))}
          </ScrollShadow>
        ) : (
          <EmptyBox icon={<Coffee className="size-[26px]" />}>
            지금 모집 중인 콜라보가 없어요. 새 모집은 이메일로 알려 드려요.
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
                  <time className="w-[40px] shrink-0 text-[12px] text-gray-400 tabular-nums">
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
          <p className="py-[12px] text-[13px] text-gray-400">
            아직 활동이 없어요.
          </p>
        )}
      </section>
    </div>
  );
}

function Dashboard() {
  const stores = useMyPartnersStores();
  const hasStore = (stores.data?.length ?? 0) > 0;

  return (
    // flex-1 — 매장 등록 전 안내가 제목 아래 남은 자리 한가운데에 오게.
    // 제목 아래 — PC 24px("숫자 칸 위 여백 줄여줘", 11-08 사용자). 모바일은 제목을 숨겨 바로 숫자 칸부터.
    <div className="flex flex-1 flex-col gap-[16px] sm:gap-[24px]">
      {/* 인사 한 줄("○○님, 오늘 챙길 콜라보를 모아 뒀어요.")은 뺐다(11-08 사용자). */}
      {/* 모바일은 제목을 감춘다 — 아래 탭 바가 이미 "대시보드"를 켜 보여 준다(11-08 사용자). 화면 읽기 프로그램용으로는 남긴다. */}
      <PageHead title="대시보드" className="max-sm:sr-only" />
      {stores.isPending ? (
        <LoadingState />
      ) : hasStore ? (
        <Overview />
      ) : (
        <RegisterStore />
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
