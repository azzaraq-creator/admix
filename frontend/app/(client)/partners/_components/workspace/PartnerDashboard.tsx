"use client";

import {
  Button,
  Card,
  Link,
  ListBox,
  ProgressBar,
  Separator,
  Spinner,
} from "@heroui/react";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Coffee,
  History,
  Store,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { useMe } from "@/hooks/auth";
import { useMyPartnersStores } from "@/hooks/partners";
import {
  activityOf,
  categoryOf,
  chipOf,
  kstStamp,
  md,
  nextActionOf,
  range,
  type PreviewCollab,
} from "@/lib/partnersPreview";
import { cn } from "@/lib/utils";

import { collabHref } from "./CollabBoard";
import { usePreviewState } from "./previewStore";
import {
  EmptyBox,
  PageHead,
  PanelCard,
  PartnerOnly,
  StatusChip,
} from "./workspaceUi";

/*
 * /partners/dashboard — 제휴사(콜라보) 매장 대시보드.
 * 받은 프로토타입(카페 파트너 미리보기)의 대시보드를 흉내 낸 화면. 콜라보 숫자 · 목록은 예시 데이터.
 * 매장을 아직 등록하지 않았으면 매장 등록 안내만 보인다(사이드바도 대시보드만).
 * 지금 확인할 일은 사이드바 알림(PartnerNotifications)으로 옮겼다.
 */

function SectionTitle({
  title,
  sub,
  right,
}: {
  title: ReactNode;
  sub?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-[12px]">
      <div>
        <Card.Title className="text-[16px] font-bold text-gray-900">
          {title}
        </Card.Title>
        {sub && (
          <Card.Description className="mt-[2px] text-[13px] text-gray-500">
            {sub}
          </Card.Description>
        )}
      </div>
      {right}
    </div>
  );
}

function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex shrink-0 items-center gap-[2px] text-[13px] font-semibold text-gray-500 no-underline hover:text-gray-900"
    >
      {children}
      <ArrowRight className="size-[14px]" />
    </Link>
  );
}

/** 매장 등록 전 — 등록부터 안내. */
function RegisterStore() {
  const router = useRouter();
  return (
    <PanelCard className="items-center gap-[14px] px-[24px] py-[48px] text-center">
      <span className="flex size-[56px] items-center justify-center rounded-[20px] bg-primary-50 text-primary-500">
        <Store className="size-[26px]" />
      </span>
      <Card.Title className="text-[18px] font-bold text-gray-900">
        매장을 먼저 등록해 주세요
      </Card.Title>
      <Card.Description className="max-w-[360px] text-[14px] leading-[1.6] break-keep text-gray-500">
        매장을 등록하면 브랜드 콜라보 모집을 보고 신청할 수 있어요.
      </Card.Description>
      <Button
        onPress={() => router.push("/partners/join/store")}
        className="mt-[4px] h-[48px] rounded-[21px] px-[24px] text-[15px] font-bold"
      >
        매장 등록하기
        <ArrowRight className="size-[16px]" />
      </Button>
    </PanelCard>
  );
}

function ActiveCard({ c }: { c: PreviewCollab }) {
  const router = useRouter();
  const chip = chipOf(c);
  const steps = 1 + c.checks.length;
  const done = c.photos.length;
  return (
    <PanelCard className="gap-[10px] p-[20px]">
      <Card.Header className="flex-row items-center justify-between">
        <span className="flex size-[40px] items-center justify-center rounded-[14px] bg-gray-100 text-gray-600">
          <Coffee className="size-[20px]" />
        </span>
        <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
      </Card.Header>
      <Card.Content className="gap-[10px]">
        <div>
          <span className="text-[13px] font-semibold text-gray-500">
            {c.brand}
          </span>
          <Card.Title className="text-[17px] font-bold text-gray-900">
            {c.title}
          </Card.Title>
          <p className="mt-[4px] flex items-center gap-[4px] text-[13px] text-gray-500">
            <CalendarDays className="size-[14px]" />
            {range(c.startDate, c.endDate)}
          </p>
        </div>
        <ProgressBar
          aria-label={`${c.title} 진행 체크리스트`}
          value={done}
          maxValue={steps}
          size="sm"
          className="flex flex-col gap-[6px]"
        >
          <div className="flex justify-between text-[13px]">
            <span className="text-gray-500">진행 체크리스트</span>
            <b className="text-gray-900 tabular-nums">
              {done} / {steps}
            </b>
          </div>
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
      </Card.Content>
      <Separator />
      <Card.Footer className="flex items-center justify-between gap-[12px]">
        <span className="text-[13px] break-keep text-gray-600">
          {nextActionOf(c)}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onPress={() => router.push(collabHref(c.id))}
          className="shrink-0 font-bold text-primary-500"
        >
          진행 안내함
          <ArrowRight className="size-[14px]" />
        </Button>
      </Card.Footer>
    </PanelCard>
  );
}

function Overview() {
  const state = usePreviewState();
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

  // 숫자 4칸 — 한 장의 카드를 넷으로 나눈다(누르면 해당 목록으로).
  const stats = [
    {
      label: "진행 중",
      value: active.length,
      dot: "bg-primary-500",
      href: "/partners/collabs?tab=ongoing",
    },
    {
      label: "확정 예정",
      value: upcoming.length,
      dot: "bg-blue-500",
      href: "/partners/collabs?tab=upcoming",
    },
    {
      label: "확정 요청",
      value: requested.length,
      dot: "bg-amber-500",
      href: requested[0]
        ? collabHref(requested[0].id)
        : "/partners/collabs?tab=upcoming",
    },
    {
      label: "완료",
      value: completed.length,
      dot: "bg-emerald-500",
      href: "/partners/history?status=completed",
    },
  ];

  return (
    <>
      <PanelCard className="grid grid-cols-2 gap-0 overflow-hidden p-0 lg:grid-cols-4">
        {stats.map((s, i) => (
          <Link
            key={s.label}
            href={s.href}
            aria-label={`${s.label} ${s.value}건`}
            className={cn(
              "flex w-full flex-col items-start gap-[8px] rounded-none px-[20px] py-[18px] no-underline transition-colors hover:bg-gray-50 hover:no-underline",
              i % 2 === 1 && "border-l border-gray-100",
              i >= 2 && "border-t border-gray-100 lg:border-t-0",
              i === 2 && "lg:border-l",
            )}
          >
            <span className="flex items-center gap-[6px] text-[13px] font-semibold text-gray-500">
              <span className={cn("size-[6px] rounded-full", s.dot)} />
              {s.label}
            </span>
            <strong className="text-[26px] leading-none font-bold text-gray-900 tabular-nums">
              {s.value}
              <small className="ml-[3px] text-[13px] font-semibold text-gray-400">
                건
              </small>
            </strong>
          </Link>
        ))}
      </PanelCard>

      {/* 모집 중인 콜라보 — 브랜드 · 이름 · 마감 칩을 짧은 목록으로 */}
      <PanelCard className="gap-[12px] p-[20px]">
        <SectionTitle
          title={
            <>
              모집 중인 콜라보
              <span className="ml-[6px] text-primary-500 tabular-nums">
                {recruiting.length}
              </span>
            </>
          }
          sub="선착순 신청 · 신청만으로 확정되지 않아요."
          right={
            <MoreLink href="/partners/collabs?tab=recruiting">
              전체 보기
            </MoreLink>
          }
        />
        {recruiting.length ? (
          <ListBox
            aria-label="모집 중인 콜라보"
            selectionMode="none"
            className="w-full min-w-0 p-0"
          >
            {recruiting.slice(0, 3).map((c) => {
              const chip = chipOf(c);
              return (
                <ListBox.Item
                  key={c.id}
                  id={c.id}
                  href={collabHref(c.id)}
                  textValue={`${c.brand} ${c.title}`}
                  className="gap-[12px] rounded-[16px] px-[8px] py-[10px]"
                >
                  <span className="flex size-[40px] shrink-0 items-center justify-center rounded-[14px] bg-gray-100 text-gray-600">
                    <Coffee className="size-[18px]" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="truncate text-[14px] text-gray-900">
                      {c.title}
                    </b>
                    <small className="truncate text-[12px] text-gray-500">
                      {c.brand} · 진행 {md(c.startDate)}~{md(c.endDate)}
                    </small>
                  </span>
                  <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
                  <ChevronRight className="size-[16px] shrink-0 text-gray-400 max-sm:hidden" />
                </ListBox.Item>
              );
            })}
          </ListBox>
        ) : (
          <p className="py-[12px] text-[13px] text-gray-400">
            지금 모집 중인 콜라보가 없어요. 새 모집은 이메일로 알려 드려요.
          </p>
        )}
      </PanelCard>

      {/* 지금 함께하는 콜라보 */}
      <section className="flex flex-col gap-[14px]">
        <div className="flex items-start justify-between gap-[12px]">
          <div>
            <h2 className="text-[16px] font-bold text-gray-900">
              지금 함께하는 콜라보
            </h2>
            <p className="mt-[2px] text-[13px] text-gray-500">
              진행 상황과 다음 할 일을 확인하세요.
            </p>
          </div>
          <MoreLink href="/partners/collabs?tab=ongoing">
            진행 현황 보기
          </MoreLink>
        </div>
        {active.length ? (
          <div className="grid gap-[12px] md:grid-cols-2">
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

      {/* 최근 활동 */}
      <PanelCard className="gap-[12px] p-[20px]">
        <SectionTitle
          title="최근 활동"
          sub="우리 매장의 콜라보 기록"
          right={<History className="size-[19px] text-gray-400" />}
        />
        {events.length ? (
          <ListBox
            aria-label="최근 활동"
            selectionMode="none"
            className="w-full min-w-0 p-0"
          >
            {events.map((e) => (
              <ListBox.Item
                key={e.id}
                id={e.id}
                href={collabHref(e.collabId)}
                textValue={e.title}
                className="gap-[12px] rounded-[14px] px-[4px] py-[8px]"
              >
                <span className="size-[8px] shrink-0 rounded-full bg-primary-300" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="truncate text-[14px] font-semibold text-gray-900">
                    {e.title}
                  </b>
                  <small className="truncate text-[12px] text-gray-500">
                    {e.collab}
                  </small>
                </span>
                <time className="shrink-0 text-[12px] text-gray-400 tabular-nums">
                  {kstStamp(e.at).slice(0, 5)}
                </time>
              </ListBox.Item>
            ))}
          </ListBox>
        ) : (
          <p className="py-[12px] text-[13px] text-gray-400">
            아직 활동이 없어요.
          </p>
        )}
        <Card.Footer className="mt-auto">
          <MoreLink href="/partners/history">전체 이력 조회</MoreLink>
        </Card.Footer>
      </PanelCard>
    </>
  );
}

function Dashboard() {
  const { data: me } = useMe();
  const stores = useMyPartnersStores();
  const hasStore = (stores.data?.length ?? 0) > 0;
  const name = me?.name?.trim() || "사장";

  return (
    <div className="flex flex-col gap-[20px]">
      <PageHead
        title="대시보드"
        description={
          hasStore
            ? `${name}님, 오늘 챙길 콜라보를 모아 뒀어요.`
            : `${name}님, 반가워요.`
        }
      />
      {stores.isPending ? (
        <div className="flex justify-center py-[60px]">
          <Spinner />
        </div>
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
