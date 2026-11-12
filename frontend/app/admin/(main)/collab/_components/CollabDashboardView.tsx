"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { LoadingState } from "@/components/common/RouteStates";
import { useCollabAdminSummary } from "@/hooks/adminCollab";
import { dotDate } from "@/lib/adminCollab";
import type { CollabAdminSummary } from "@/lib/partners";
import { cn } from "@/lib/utils";

import { CollabCalendar } from "./CollabCalendar";
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

/**
 * 콜라보 어드민 첫 화면 — 지금 처리할 일 숫자, 그 밑에 콜라보 일정 달력(2026-11-12 사용자, 예전 회원 · 매장 · 콜라보 현황 숫자를 바꿈).
 * 숫자를 누르면 그 목록으로, 일정 막대를 누르면 콜라보 상세로.
 */
export function CollabDashboardView() {
  const { data: s, isLoading } = useCollabAdminSummary();
  if (isLoading || !s) return <LoadingState />;

  return (
    <div className="flex flex-col gap-[24px] md:gap-[32px]">
      <CollabPageHead
        title="콜라보 대시보드"
        desc={`${dotDate(s.today)} 기준이에요. 숫자를 누르면 해당 목록으로, 일정을 누르면 콜라보 상세로 가요.`}
      />

      <section className="flex flex-col gap-[12px]">
        <h2 className="text-lg font-bold leading-[28px] text-black">
          처리할 일
        </h2>
        <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2 md:gap-[16px] xl:grid-cols-3">
          {todosOf(s).map((t) => (
            <Link
              key={t.label}
              href={t.href}
              // 테두리 없는 흰 카드(회색 바탕 위) — 할 일이 있으면 숫자만 보라로(은은하게).
              className="flex items-center justify-between gap-[12px] rounded-[20px] bg-surface p-[18px] shadow-surface transition-colors hover:bg-primary-50/40 md:p-[20px]"
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
                    "text-2xl font-bold",
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

      <CollabCalendar today={s.today} />
    </div>
  );
}
