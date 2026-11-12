"use client";

import Link from "next/link";
import { useMemo } from "react";

import { AdminPanel } from "@/components/admin/AdminPanel";
import { CommonTable } from "@/components/common/Table/CommonTable";
import { useDashboard } from "@/hooks/dashboard";
import { useAdminProposals } from "@/hooks/proposals";

import {
  ProposalStatusBadge,
  type ProposalStatus,
} from "../proposals/_components";
import { proposalColumnList, type Proposal } from "./index";
import { ProposalBarChart } from "./ProposalBarChart";
import { VisitorLineChart } from "./VisitorLineChart";

type RecentProposal = Proposal & { id: string };

type StatRow = { label: string; value: string };
type StatCard = {
  title: string;
  rows: StatRow[];
  columns?: 1 | 2;
  action?: { label: string; href: string };
};

const cnt = (n: number | undefined) => `${(n ?? 0).toLocaleString()}건`;
const person = (n: number | undefined) => `${(n ?? 0).toLocaleString()}명`;

export function DashboardView() {
  const { data: summary } = useDashboard();
  const { data: proposalList } = useAdminProposals();

  const statCards: StatCard[] = [
    {
      title: "방문자 수",
      rows: [
        { label: "오늘", value: person(summary?.visitors?.today) },
        { label: "누적", value: person(summary?.visitors?.total) },
      ],
    },
    {
      title: "전체 회원 수",
      rows: [
        { label: "오늘 가입자", value: person(summary?.members.today) },
        { label: "누적 가입자", value: person(summary?.members.total) },
      ],
      action: { label: "회원 관리", href: "/admin/members" },
    },
    {
      title: "전체 제안 건수",
      rows: [
        { label: "오늘", value: cnt(summary?.proposals.today) },
        { label: "누적", value: cnt(summary?.proposals.total) },
      ],
      action: { label: "제안 관리", href: "/admin/proposals" },
    },
    {
      title: "전체 문의 건수",
      columns: 2,
      rows: [
        { label: "오늘", value: cnt(summary?.inquiries.today) },
        { label: "주간", value: cnt(summary?.inquiries.week) },
        { label: "월간", value: cnt(summary?.inquiries.month) },
        { label: "누적", value: cnt(summary?.inquiries.total) },
      ],
      action: { label: "문의 관리", href: "/admin/inquiries" },
    },
  ];

  const recentProposals = useMemo<RecentProposal[]>(
    () =>
      (proposalList?.items ?? []).slice(0, 10).map((r, i) => ({
        id: r.id,
        no: String(i + 1),
        name: r.name,
        member: r.member,
        mediaCount: r.mediaCount,
        totalAmount: r.totalAmount,
        status: r.status,
        registeredAt: r.registeredAt,
      })),
    [proposalList],
  );

  return (
    // 회색 바탕 위 흰 카드(AdminPanel) — 숫자 칸 · 차트 · 최근 목록을 각각 카드로(2026-11-12).
    <div className="flex flex-col gap-[20px] md:gap-[24px]">
      <h1 className="text-xl font-bold leading-[28px] text-black md:text-2xl md:leading-[32px]">
        대시보드
      </h1>

      <div className="grid grid-cols-1 gap-[20px] sm:grid-cols-2 md:gap-[24px] xl:grid-cols-4">
        {statCards.map((card) => (
          <StatCardItem key={card.title} card={card} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-[20px] md:gap-[24px] xl:grid-cols-2">
        <ProposalBarChart values={summary?.proposalMonthly ?? []} />
        <VisitorLineChart values={summary?.visitorMonthly ?? []} />
      </div>

      <AdminPanel
        title="최근 제안 리스트"
        right={
          <Link
            href="/admin/proposals"
            className="flex h-[36px] items-center rounded-[15px] bg-primary px-[14px] text-sm font-medium leading-[20px] text-white md:h-[40px] md:rounded-[17px] md:px-[16px]"
          >
            더보기
          </Link>
        }
      >
        <div className="hidden md:block">
          <CommonTable<Proposal>
            columnList={proposalColumnList}
            data={recentProposals}
            idKey="no"
            useSearch={false}
            pageSize={10}
            framed={false}
          />
        </div>

        {/* 모바일: 7열 테이블 대신 카드 리스트 */}
        <ul className="flex flex-col gap-[12px] md:hidden">
          {recentProposals.length === 0 && (
            <li className="rounded-[12px] bg-gray-50 py-[40px] text-center text-sm leading-[20px] text-disabled">
              최근 제안이 없습니다.
            </li>
          )}
          {recentProposals.map((item) => (
            <li key={item.id}>
              <RecentProposalCard item={item} />
            </li>
          ))}
        </ul>
      </AdminPanel>
    </div>
  );
}

function RecentProposalCard({ item }: { item: RecentProposal }) {
  return (
    <Link
      href={`/admin/proposals/${item.id}`}
      className="flex flex-col gap-[12px] rounded-[12px] bg-gray-50 p-[16px] active:bg-gray-100"
    >
      <div className="flex items-start justify-between gap-[12px]">
        <p className="line-clamp-2 min-w-0 text-base font-semibold leading-[24px] text-black">
          {item.name}
        </p>
        <span className="shrink-0">
          <ProposalStatusBadge status={item.status as ProposalStatus} />
        </span>
      </div>
      <div className="flex items-center justify-between gap-[12px] text-sm leading-[20px] text-disabled">
        <span className="min-w-0 truncate">
          {item.member} · 매체 {item.mediaCount}
        </span>
        <span className="shrink-0">{item.registeredAt}</span>
      </div>
      <div className="flex items-center justify-between gap-[12px] border-t border-gray-200 pt-[12px]">
        <span className="text-sm leading-[20px] text-disabled">예상 예산</span>
        <span className="text-base font-semibold leading-[24px] text-black">
          {item.totalAmount}
        </span>
      </div>
    </Link>
  );
}

function StatCardItem({ card }: { card: StatCard }) {
  return (
    <AdminPanel title={card.title} contentClassName="gap-[16px]">
      <div
        className={
          card.columns === 2
            ? "grid grid-cols-2 gap-x-[24px] gap-y-[8px]"
            : "flex flex-col gap-[8px]"
        }
      >
        {card.rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-[12px]"
          >
            <span className="text-sm leading-[20px] text-disabled">
              {row.label}
            </span>
            <span className="text-base font-semibold leading-[24px] text-black">
              {row.value}
            </span>
          </div>
        ))}
      </div>
      {card.action && (
        <Link
          href={card.action.href}
          className="mt-auto flex h-[36px] w-full items-center justify-center rounded-[15px] bg-primary text-xs font-medium leading-[16px] text-white"
        >
          {card.action.label}
        </Link>
      )}
    </AdminPanel>
  );
}
