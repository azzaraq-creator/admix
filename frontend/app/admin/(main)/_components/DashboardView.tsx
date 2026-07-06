"use client";

import Link from "next/link";

import { CommonTable } from "@/components/common/Table/CommonTable";

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

const STAT_CARDS: StatCard[] = [
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
      { label: "오늘 가입자", value: "12명" },
      { label: "누적 가입자", value: "456명" },
    ],
    action: { label: "회원 관리", href: "/admin/members" },
  },
  {
    title: "전체 제안 건수",
    rows: [
      { label: "오늘", value: "12건" },
      { label: "누적", value: "456건" },
    ],
    action: { label: "제안 관리", href: "/admin/proposals" },
  },
  {
    title: "전체 문의 건수",
    columns: 2,
    rows: [
      { label: "오늘", value: "12건" },
      { label: "주간", value: "456건" },
      { label: "월간", value: "12건" },
      { label: "누적", value: "456건" },
    ],
    action: { label: "문의 관리", href: "/admin/inquiries" },
  },
];

const PROPOSALS: Proposal[] = [
  { no: "12345", name: "광고 제안서_2026", member: "홍길동", mediaCount: 5, budget: "380,000,000원", status: "신규", date: "2025-01-01" },
  { no: "12346", name: "브랜드 캠페인_2026", member: "김영희", mediaCount: 3, budget: "250,000,000원", status: "신규", date: "2025-02-15" },
  { no: "12347", name: "제품 런칭 프로모션", member: "이철수", mediaCount: 7, budget: "450,000,000원", status: "취소", date: "2025-03-10" },
  { no: "12348", name: "SNS 마케팅 전략", member: "박민정", mediaCount: 4, budget: "150,000,000원", status: "회신", date: "2025-04-05" },
  { no: "12349", name: "TV 광고 캠페인", member: "최수연", mediaCount: 6, budget: "600,000,000원", status: "회신", date: "2025-05-20" },
  { no: "12350", name: "온라인 프로모션", member: "정호준", mediaCount: 2, budget: "120,000,000원", status: "회신", date: "2025-06-12" },
  { no: "12351", name: "이벤트 기획안", member: "한지민", mediaCount: 5, budget: "300,000,000원", status: "회신", date: "2025-07-01" },
  { no: "12352", name: "콘텐츠 마케팅", member: "오지훈", mediaCount: 3, budget: "200,000,000원", status: "완료", date: "2025-08-18" },
  { no: "12353", name: "시장 조사 보고서", member: "문지후", mediaCount: 4, budget: "180,000,000원", status: "완료", date: "2025-09-09" },
  { no: "12354", name: "파트너십 제안", member: "윤서진", mediaCount: 1, budget: "100,000,000원", status: "완료", date: "2025-10-23" },
];

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

export function DashboardView() {
  return (
    <div className="flex flex-col gap-[48px]">
      <h1 className="text-2xl font-bold leading-[32px] text-black">대시보드</h1>

      <div className="grid grid-cols-2 gap-[24px] xl:grid-cols-4 xl:gap-[48px]">
        {STAT_CARDS.map((card) => (
          <StatCardItem key={card.title} card={card} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-[48px] xl:grid-cols-2">
        <ProposalBarChart />
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
          data={PROPOSALS}
          idKey="no"
          useSearch={false}
          pageSize={10}
        />
      </div>
    </div>
  );
}
