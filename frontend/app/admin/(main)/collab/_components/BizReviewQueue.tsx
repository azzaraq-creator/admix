"use client";

import { Button, Chip } from "@heroui/react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { AdminPanel } from "@/components/admin/AdminPanel";
import { formatDateTime } from "@/lib/date";
import { cn } from "@/lib/utils";

/** 검토 대기 줄 하나 — 회원 종류(제휴사 · 광고주)와 상관없이 같은 모양. */
export interface BizReviewItem {
  id: string;
  /** 이름 위 작은 글(고유번호 · 회사명) — 없으면 그 줄을 그리지 않는다("-"만 떠서 어색했다). */
  caption: string | null;
  name: string;
  loginId: string;
  /** 사업자등록증을 올린 시각. */
  uploadedAt: string | null;
}

/**
 * 사업자등록증 검토 대기 칸 — 제휴사 회원 · 광고주 회원 목록 맨 위(11-17 사용자: "숫자 1이 떠서 들어왔는데 뭘 해야 할지 모르게 방황",
 * "광고주 회원도 제휴사 회원처럼 동일하게"). 메뉴 옆 숫자와 같은 회원만 모아 "검토하기"로 회원 상세에 바로 간다. 없으면 칸째 없다.
 * - 설명 글은 없다(사용자: "이 문구 빼줘"). 제목 옆 인원은 옅은 보라 칩(사용자: "숫자를 다르게, 구분되게").
 * - 회원마다 옅은 회색 칸 — PC는 이름 | 아이디 | 등록증 올린 시각 | 검토하기 열을 맞추고,
 *   휴대폰은 이름 · 검토하기 줄 아래 아이디 · 올린 시각 두 칸(사용자: "더 깔끔하게 잘 구분 지어서").
 */
export function BizReviewQueue({
  items,
  total,
  hrefOf,
}: {
  items: BizReviewItem[];
  total: number;
  hrefOf: (id: string) => string;
}) {
  const router = useRouter();
  if (items.length === 0) return null;
  return (
    <AdminPanel
      title={
        <span className="flex items-center gap-[8px]">
          검토 대기
          <Chip size="sm" variant="soft" color="accent">
            {total.toLocaleString()}명
          </Chip>
        </span>
      }
      contentClassName="gap-[8px]"
    >
      {items.map((m) => (
        <div
          key={m.id}
          className="grid grid-cols-2 items-center gap-x-[16px] gap-y-[12px] rounded-[14px] bg-gray-50 px-[16px] py-[14px] md:grid-cols-[minmax(160px,1fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto] md:gap-x-[24px]"
        >
          <div className="order-1 flex min-w-0 flex-col">
            {m.caption && (
              <span className="truncate text-xs font-semibold text-disabled">
                {m.caption}
              </span>
            )}
            <span className="truncate font-semibold text-black">{m.name}</span>
          </div>
          <QueueMeta label="아이디" className="order-3 md:order-2">
            <span className="block truncate" title={m.loginId}>
              {m.loginId}
            </span>
          </QueueMeta>
          <QueueMeta label="등록증 올린 시각" className="order-4 md:order-3">
            {formatDateTime(m.uploadedAt)}
          </QueueMeta>
          <Button
            size="sm"
            variant="primary"
            className="order-2 justify-self-end md:order-4"
            onPress={() => router.push(hrefOf(m.id))}
          >
            검토하기
          </Button>
        </div>
      ))}
    </AdminPanel>
  );
}

/** 검토 대기 줄 안 한 칸 — 위 작은 이름표, 아래 값. */
function QueueMeta({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-[2px]", className)}>
      <span className="text-xs text-disabled">{label}</span>
      <span className="min-w-0 text-sm text-black">{children}</span>
    </div>
  );
}
