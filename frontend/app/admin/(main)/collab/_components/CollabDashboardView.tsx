"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { LoadingState } from "@/components/common/RouteStates";
import { useCollabAdminSummary } from "@/hooks/adminCollab";
import { dotDate } from "@/lib/adminCollab";
import {
  COLLAB_PHASE_LABEL,
  type CollabAdminSummary,
  type CollabPhase,
} from "@/lib/partners";
import { cn } from "@/lib/utils";

import { CollabPageHead } from "./collabUi";

type Todo = {
  label: string;
  hint: string;
  value: number;
  href: string;
};

const todosOf = (s: CollabAdminSummary): Todo[] => [
  {
    label: "사업자 확인 대기",
    hint: "올린 등록증을 보고 인증 완료 · 반려",
    value: s.members.bizReviewing,
    href: "/admin/collab/members?biz=reviewing",
  },
  {
    label: "임시 승인 회원",
    hint: "등록증을 받아 인증 완료로 바꿔요",
    value: s.members.bizProvisional,
    href: "/admin/collab/members?biz=provisional",
  },
  {
    label: "수정 요청",
    hint: "제휴사가 보낸 매장 수정 요청",
    value: s.requestsPending,
    href: "/admin/collab/requests",
  },
  {
    label: "매장 확정 대기",
    hint: "확정 요청을 받고 아직 확정 전",
    value: s.confirmWaiting,
    href: "/admin/collab/collabs?phase=selecting",
  },
  {
    label: "재입고 요청",
    hint: "진행 중 매장이 누른 재입고",
    value: s.restockOpen,
    href: "/admin/collab/collabs?phase=running",
  },
  {
    label: "점검 사진 늦음",
    hint: "점검일이 지났는데 사진이 없는 매장",
    value: s.photoDue,
    href: "/admin/collab/collabs?phase=running",
  },
];

const PHASE_ORDER: CollabPhase[] = [
  "recruiting",
  "selecting",
  "running",
  "scheduled",
  "draft",
  "done",
  "cancelled",
];

/** 콜라보 어드민 첫 화면 — 지금 처리할 일 숫자와 회원 · 매장 · 콜라보 현황. 숫자를 누르면 그 목록으로. */
export function CollabDashboardView() {
  const { data: s, isLoading } = useCollabAdminSummary();
  if (isLoading || !s) return <LoadingState />;

  return (
    <div className="flex flex-col gap-[28px] md:gap-[40px]">
      <CollabPageHead
        title="콜라보 대시보드"
        desc={`${dotDate(s.today)} 기준이에요. 숫자를 누르면 해당 목록으로 가요.`}
      />

      <section className="flex flex-col gap-[12px]">
        <h2 className="text-lg font-bold leading-[28px] text-black">
          처리할 일
        </h2>
        <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2 xl:grid-cols-3">
          {todosOf(s).map((t) => (
            <Link
              key={t.label}
              href={t.href}
              className={cn(
                "flex items-center justify-between gap-[12px] rounded-[12px] border p-[16px] transition-colors hover:bg-gray-50",
                t.value > 0
                  ? "border-primary/40 bg-primary-50/40"
                  : "border-stroke",
              )}
            >
              <span className="flex min-w-0 flex-col gap-[2px]">
                <span className="text-sm font-semibold text-black">
                  {t.label}
                </span>
                <span className="text-xs text-disabled">{t.hint}</span>
              </span>
              <span className="flex shrink-0 items-center gap-[4px]">
                <span
                  className={cn(
                    "text-2xl font-bold tabular-nums",
                    t.value > 0 ? "text-primary-800" : "text-disabled",
                  )}
                >
                  {t.value.toLocaleString()}
                </span>
                <ChevronRight className="size-[16px] text-disabled" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-[24px] lg:grid-cols-3">
        <StatList
          title="제휴사 회원"
          rows={[
            {
              label: "전체",
              value: s.members.total,
              href: "/admin/collab/members",
            },
            {
              label: "협약 전",
              value: s.members.notAgreed,
              href: "/admin/collab/members?agreement=none",
            },
            {
              label: "협약했는데 매장 연결 전",
              value: s.members.noStore,
              href: "/admin/collab/members?agreement=done&store=no",
            },
          ]}
          unit="명"
        />
        <StatList
          title="매장"
          rows={[
            {
              label: "전체",
              value: s.stores.total,
              href: "/admin/collab/stores",
            },
            {
              label: "회원 연결 전",
              value: s.stores.unlinked,
              href: "/admin/collab/stores?linked=no",
            },
            {
              label: "비공개",
              value: s.stores.hidden,
              href: "/admin/collab/stores?status=hidden",
            },
          ]}
          unit="곳"
        />
        <StatList
          title="콜라보"
          rows={PHASE_ORDER.map((p) => ({
            label: COLLAB_PHASE_LABEL[p],
            value: s.collabs[p] ?? 0,
            href: `/admin/collab/collabs?phase=${p}`,
          }))}
          unit="건"
        />
      </div>
    </div>
  );
}

function StatList({
  title,
  rows,
  unit,
}: {
  title: string;
  rows: { label: string; value: number; href: string }[];
  unit: string;
}) {
  return (
    <section className="flex flex-col gap-[10px]">
      <h2 className="text-lg font-bold leading-[28px] text-black">{title}</h2>
      <ul className="flex flex-col divide-y divide-stroke rounded-[12px] border border-stroke">
        {rows.map((r) => (
          <li key={r.label}>
            <Link
              href={r.href}
              className="flex items-center justify-between gap-[12px] px-[16px] py-[12px] text-sm hover:bg-gray-50"
            >
              <span className="text-tone-4a5565">{r.label}</span>
              <span className="font-semibold tabular-nums text-black">
                {r.value.toLocaleString()}
                {unit}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
