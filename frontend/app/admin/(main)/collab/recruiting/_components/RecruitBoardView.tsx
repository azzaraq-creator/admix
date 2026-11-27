"use client";

import { Button } from "@heroui/react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { AdminPanel } from "@/components/admin/AdminPanel";
import { MaskIcon } from "@/components/common/MaskIcon";
import {
  CommonTable,
  type TableColumn,
} from "@/components/common/Table/CommonTable";
import { LoadingState } from "@/components/common/RouteStates";
import { useRecruitBoard } from "@/hooks/adminCollab";
import { shortDate } from "@/lib/adminCollab";
import { kstDate, mdw } from "@/lib/advertiserPreview";
import type { RecruitCollabRow, RecruitReadyRow } from "@/lib/collabRecruit";
import { todayKst } from "@/lib/partnersPreview";
import { cn } from "@/lib/utils";

import { CollabPageHead, PhaseChip } from "../../_components/collabUi";
import { BrandThumb } from "../../advertisers/_components/CollabAdvertisersListView";
import {
  recruitPlanOf,
  useStartRecruitingFlow,
} from "../../collab-requests/_components/StartRecruiting";
import { advRequestHref } from "../../collab-requests/_components/CollabRequestsListView";

const collabHref = (id: string) => `/admin/collab/collabs/${id}`;

const dayDiff = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
const dLabel = (n: number) => (n === 0 ? "오늘" : n > 0 ? `D-${n}` : `D+${-n}`);

/** 신청한 매장 — 아직 고르기 전 · 확정 요청 · 확정(빠진 매장은 뺀다). 콜라보 진행 화면과 같은 기준. */
const appliedOf = (c: RecruitCollabRow) =>
  c.counts.applied + c.counts.requested + c.counts.confirmed;

/** 단계 옆 날짜 — 모집 중은 마감까지, 모집 전은 시작까지, 선정 · 확정 중은 확정 기한까지. */
function dueOf(c: RecruitCollabRow, today: string) {
  if (c.phase === "recruiting")
    return `마감 ${dLabel(dayDiff(today, c.recruitEnd))}`;
  if (c.phase === "scheduled")
    return `시작 ${dLabel(dayDiff(today, c.recruitStart))}`;
  const due = c.confirmDue ? kstDate(c.confirmDue) : c.recruitEnd;
  return `확정 기한 ${dLabel(dayDiff(today, due))}`;
}

/**
 * 매장 모집(어드민 "콜라보 관리 → 매장 모집", 2026-11-26 사용자: "콜라보별로 모집 현황을 볼 수 있게 해주고,
 * 확정된 걸 바로 모집 시작할 수 있게") — 위: 광고주가 확정했는데 아직 모집을 열지 않은 의뢰(모집 시작),
 * 아래: 모집 전 · 모집 중 · 선정 · 확정 중 콜라보의 신청 · 확정 매장 수.
 */
export function RecruitBoardView() {
  const router = useRouter();
  const { data, isLoading } = useRecruitBoard();
  // 이 화면에선 열어도 그대로 머문다 — 줄이 아래 모집 현황으로 옮겨 간다.
  const flow = useStartRecruitingFlow();
  const today = todayKst();
  const ready = data?.ready ?? [];
  const collabs = data?.collabs ?? [];

  const columns: TableColumn<RecruitCollabRow>[] = [
    {
      name: "phase",
      label: "상태",
      renderer: (c) => (
        <span className="flex flex-col items-start gap-[4px] whitespace-nowrap">
          <PhaseChip phase={c.phase} />
          <span className="text-xs text-tone-4a5565">{dueOf(c, today)}</span>
        </span>
      ),
    },
    {
      name: "title",
      label: "브랜드 · 캠페인",
      renderer: (c) => (
        <span className="flex max-w-[300px] items-center gap-[10px]">
          <BrandThumb
            brand={{ name: c.brandName, imageUrl: c.brandImageUrl }}
            size={32}
          />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold text-black" title={c.title}>
              {c.title}
            </span>
            <span className="truncate text-xs text-disabled">
              {c.brandName}
              {c.requestCode && ` · ${c.requestCode}`}
            </span>
          </span>
        </span>
      ),
    },
    {
      name: "recruit",
      label: "모집 기간",
      className: "whitespace-nowrap",
      renderer: (c) =>
        `${shortDate(c.recruitStart)} ~ ${shortDate(c.recruitEnd)}`,
    },
    {
      name: "applied",
      label: "신청",
      className: "whitespace-nowrap",
      renderer: (c) => `${appliedOf(c)}곳`,
    },
    {
      name: "requested",
      label: "확정 요청",
      className: "whitespace-nowrap",
      renderer: (c) => `${c.counts.requested}곳`,
    },
    {
      name: "confirmed",
      label: "확정 / 목표",
      className: "whitespace-nowrap",
      renderer: (c) => (
        <span>
          <span className="font-semibold text-black">
            {c.counts.confirmed}
          </span>
          <span className="text-disabled"> / {c.targetStores}곳</span>
        </span>
      ),
    },
    {
      name: "confirmDue",
      label: "확정 기한",
      className: "whitespace-nowrap",
      renderer: (c) => (c.confirmDue ? mdw(kstDate(c.confirmDue)) : "-"),
    },
    {
      name: "start",
      label: "진행 기간",
      className: "whitespace-nowrap",
      renderer: (c) => `${shortDate(c.startDate)} ~ ${shortDate(c.endDate)}`,
    },
  ];

  return (
    <div className="flex flex-col gap-[20px] md:gap-[24px]">
      <CollabPageHead title="매장 모집" />

      {isLoading ? (
        <LoadingState />
      ) : (
        <>
          <AdminPanel
            title="모집 시작 전"
            desc={ready.length ? `${ready.length}건 · 광고주 확정 순` : undefined}
          >
            {ready.length ? (
              <ul className="flex flex-col gap-[12px]">
                {ready.map((r) => (
                  <ReadyRow
                    key={r.id}
                    r={r}
                    pending={flow.pendingId === r.id}
                    onStart={() =>
                      r.confirmedAt &&
                      void flow.run({
                        id: r.id,
                        createdAt: r.createdAt,
                        confirmedAt: r.confirmedAt,
                        content: r.content,
                      })
                    }
                  />
                ))}
              </ul>
            ) : (
              <p className="py-[24px] text-center text-sm text-disabled">
                모집을 기다리는 의뢰가 없어요.
              </p>
            )}
          </AdminPanel>

          <AdminPanel
            title="모집 현황"
            desc={collabs.length ? `${collabs.length}건` : undefined}
          >
            {collabs.length ? (
              <>
                <div className="hidden md:block">
                  <CommonTable<RecruitCollabRow>
                    ariaLabel="모집 현황"
                    columnList={columns}
                    data={collabs}
                    idKey="id"
                    pageSize={collabs.length}
                    useSearch={false}
                    framed={false}
                    onRowClick={(c) => router.push(collabHref(c.id))}
                  />
                </div>
                <ul className="flex flex-col md:hidden">
                  {collabs.map((c, i) => (
                    <CollabCard key={c.id} c={c} today={today} first={i === 0} />
                  ))}
                </ul>
              </>
            ) : (
              <p className="py-[24px] text-center text-sm text-disabled">
                모집 중인 콜라보가 없어요.
              </p>
            )}
          </AdminPanel>
        </>
      )}
      {flow.dialog}
    </div>
  );
}

/**
 * 모집 시작 전 한 장(11-26 사용자: "좀 더 보기 편하게" → "더 보기 편하게 못 바꾸나?" · "최소 매장도 보여줘").
 * 위: 캠페인 · 브랜드 · 문서 번호(누르면 의뢰서) + 모집 시작.
 * 아래: 광고주 확정 · 매장 모집 · 콜라보 진행 · 매장(최소 · 목표)을 같은 크기 흰 칸에 하나씩.
 * 모집 · 진행은 확정 일정으로 센 날짜, 칸 오른쪽 위에 며칠인지. 점 · 선 진행바는 뺐다(11-26 사용자: "맘에 안 들어").
 */
function ReadyRow({
  r,
  pending,
  onStart,
}: {
  r: RecruitReadyRow;
  pending: boolean;
  onStart: () => void;
}) {
  const plan = r.confirmedAt
    ? recruitPlanOf({
        id: r.id,
        createdAt: r.createdAt,
        confirmedAt: r.confirmedAt,
        content: r.content,
      })
    : null;
  const days = (a: string, b: string) => `${dayDiff(a, b) + 1}일`;
  const facts: {
    label: string;
    days?: string;
    value: ReactNode;
    late?: boolean;
  }[] = [
    {
      label: "광고주 확정",
      value: r.confirmedAt ? mdw(kstDate(r.confirmedAt)) : "-",
    },
    {
      label: "매장 모집",
      days: plan ? days(plan.recruitStart, plan.recruitEnd) : undefined,
      value: plan ? `${mdw(plan.recruitStart)} ~ ${mdw(plan.recruitEnd)}` : "-",
      late: plan?.late,
    },
    {
      label: "콜라보 진행",
      days: plan ? days(plan.startDate, plan.endDate) : undefined,
      value: plan ? `${mdw(plan.startDate)} ~ ${mdw(plan.endDate)}` : "-",
    },
    {
      label: "매장",
      value: (
        <>
          <span className="font-normal text-tone-4a5565">
            최소 {r.content.minStores}곳 ·{" "}
          </span>
          목표 {r.content.targetStores}곳
        </>
      ),
    },
  ];
  return (
    <li className="flex flex-col gap-[20px] rounded-[12px] bg-gray-50 p-[16px] md:p-[20px]">
      <div className="flex items-center justify-between gap-[12px]">
        <Link
          href={advRequestHref(r.id)}
          className="group flex min-w-0 items-center gap-[12px]"
        >
          <BrandThumb
            brand={{ name: r.brandName, imageUrl: r.brandImageUrl }}
            size={40}
          />
          <span className="flex min-w-0 flex-col gap-[2px]">
            <span className="truncate text-base font-semibold text-black group-hover:underline">
              {r.title}
            </span>
            <span className="truncate text-xs text-disabled">
              {r.brandName} · {r.code}
            </span>
          </span>
        </Link>
        <Button
          size="sm"
          variant="primary"
          isPending={pending}
          isDisabled={!plan}
          onPress={onStart}
          className="shrink-0"
        >
          {/* 채운 확성기(11-26 사용자: "아이콘을 fill-megaphone.svg로 바꿔줘"). */}
          <MaskIcon src="/icons/fill-megaphone.svg" className="size-[16px]" />
          모집 시작
        </Button>
      </div>

      {/* 같은 크기 흰 칸 넷(11-26 사용자: 점 · 선 진행바는 "맘에 안 들어") — 넓으면 한 줄, 중간은 둘씩.
          휴대폰은 한 줄에 하나(이름표 왼쪽 · 값 오른쪽) — 두 칸씩이면 날짜가 꺾인다. */}
      <dl className="grid grid-cols-1 gap-[8px] sm:grid-cols-2 lg:grid-cols-4">
        {facts.map((f) => (
          <div
            key={f.label}
            className="flex min-w-0 items-center justify-between gap-[12px] rounded-[10px] bg-surface px-[14px] py-[12px] sm:flex-col sm:items-stretch sm:justify-start sm:gap-[4px]"
          >
            <dt className="flex shrink-0 items-center gap-[6px] text-xs text-tone-4a5565 sm:justify-between">
              {f.label}
              {f.days && <span className="text-disabled">{f.days}</span>}
            </dt>
            <dd
              className={cn(
                "text-right text-sm font-semibold whitespace-nowrap sm:text-left",
                f.late ? "text-danger" : "text-black",
              )}
            >
              {f.value}
            </dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

/** 휴대폰 모집 현황 — 표 대신 카드 한 장씩(누르면 콜라보 상세). */
function CollabCard({
  c,
  today,
  first,
}: {
  c: RecruitCollabRow;
  today: string;
  first: boolean;
}) {
  return (
    <li className={first ? "pb-[14px]" : "border-t border-gray-100 py-[14px]"}>
      <Link href={collabHref(c.id)} className="flex flex-col gap-[8px]">
        <span className="flex items-center justify-between gap-[8px]">
          <span className="flex items-center gap-[8px]">
            <PhaseChip phase={c.phase} />
            <span className="text-xs text-tone-4a5565">{dueOf(c, today)}</span>
          </span>
          <ChevronRight className="size-[16px] text-disabled" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-black">
            {c.title}
          </span>
          <span className="truncate text-xs text-disabled">
            {c.brandName} · 모집 {shortDate(c.recruitStart)} ~{" "}
            {shortDate(c.recruitEnd)}
          </span>
        </span>
        <span className="text-sm text-tone-4a5565">
          신청 {appliedOf(c)} · 확정 요청 {c.counts.requested} · 확정{" "}
          <span className="font-semibold text-black">{c.counts.confirmed}</span>{" "}
          / {c.targetStores}곳
        </span>
      </Link>
    </li>
  );
}
