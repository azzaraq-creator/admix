"use client";

import Link from "next/link";
import { useMemo } from "react";

import { CommonTable } from "@/components/common/Table/CommonTable";
import { useDashboard } from "@/hooks/dashboard";
import { useAdminProposals } from "@/hooks/proposals";

import { proposalColumnList, type Proposal } from "./index";
import { ProposalBarChart } from "./ProposalBarChart";
import { VisitorLineChart } from "./VisitorLineChart";

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
        { label: "오늘", value: "45명" },
        { label: "누적", value: "2,530명" },
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

  const recentProposals = useMemo<Proposal[]>(
    () =>
      (proposalList?.items ?? []).slice(0, 10).map((r, i) => ({
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
    <div className="flex flex-col gap-[48px]">
      <h1 className="text-2xl font-bold leading-[32px] text-black">대시보드</h1>

      <div className="grid grid-cols-2 gap-[24px] xl:grid-cols-4 xl:gap-[48px]">
        {statCards.map((card) => (
          <StatCardItem key={card.title} card={card} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-[48px] xl:grid-cols-2">
        <ProposalBarChart values={summary?.proposalMonthly ?? []} />
        <VisitorLineChart />
      </div>

      <div className="flex flex-col gap-[16px]">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold leading-[32px] text-black">
            최근 제안 리스트
          </h2>
          <Link
            href="/admin/proposals"
            className="flex h-[40px] items-center rounded-[8px] bg-primary px-[16px] text-sm font-medium leading-[20px] text-white"
          >
            더보기
          </Link>
        </div>

        <CommonTable<Proposal>
          columnList={proposalColumnList}
          data={recentProposals}
          idKey="no"
          useSearch={false}
          pageSize={10}
        />
      </div>
    </div>
  );
}

function StatCardItem({ card }: { card: StatCard }) {
  return (
    <div className="flex flex-col gap-[16px]">
      <p className="text-lg font-bold leading-[28px] text-black">{card.title}</p>
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
          className="flex h-[36px] w-full items-center justify-center rounded-[8px] bg-primary text-xs font-medium leading-[16px] text-white"
        >
          {card.action.label}
        </Link>
      )}
    </div>
  );
}
