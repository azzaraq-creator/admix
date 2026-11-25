"use client";

import { Button, Checkbox, Chip, Label, Pagination } from "@heroui/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { AdminPanel } from "@/components/admin/AdminPanel";
import { marketingStatus, PARTICIPANT_STATUS_LABEL } from "@/lib/adminCollab";
import {
  COLLAB_PHASE_LABEL,
  type CollabPhase,
  type ParticipantStatus,
} from "@/lib/partners";
import { cn } from "@/lib/utils";

/** 콜라보 어드민 화면 제목 — 기존 어드민과 같은 크기(모바일은 한 단계 작게). */
export function CollabPageHead({
  title,
  desc,
  extra,
  children,
}: {
  title: ReactNode;
  desc?: ReactNode;
  /** 제목 옆(코드 칩 등) */
  extra?: ReactNode;
  /** 오른쪽 버튼 */
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-[12px]">
      <div className="flex min-w-0 flex-col gap-[4px]">
        <div className="flex flex-wrap items-center gap-[8px]">
          <h1 className="text-xl font-bold leading-[28px] text-black md:text-2xl md:leading-[32px]">
            {title}
          </h1>
          {extra}
        </div>
        {desc && (
          <p className="text-sm font-medium leading-[20px] text-disabled">
            {desc}
          </p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-[8px]">{children}</div>
      )}
    </div>
  );
}

/**
 * 칸 묶음 — 어드민 공통 흰 카드(AdminPanel). 예전엔 흰 판 안의 테두리 상자였는데, 2026-11-12 사용자 요청으로
 * 회색 바탕 위 테두리 없는 흰 카드로 바꿨다(매장 상세와 같은 모양).
 */
export function CollabSection({
  title,
  desc,
  right,
  children,
  className,
}: {
  title: ReactNode;
  desc?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <AdminPanel title={title} desc={desc} right={right} className={className}>
      {children}
    </AdminPanel>
  );
}

const PHASE_COLOR: Record<
  CollabPhase,
  "default" | "accent" | "success" | "warning" | "danger"
> = {
  draft: "default",
  scheduled: "default",
  recruiting: "accent",
  selecting: "warning",
  running: "success",
  done: "default",
  cancelled: "danger",
};

export function PhaseChip({ phase }: { phase: CollabPhase }) {
  return (
    <Chip size="sm" variant="soft" color={PHASE_COLOR[phase]}>
      {COLLAB_PHASE_LABEL[phase]}
    </Chip>
  );
}

const STATUS_COLOR: Record<
  ParticipantStatus,
  "default" | "accent" | "success" | "warning" | "danger"
> = {
  applied: "default",
  requested: "warning",
  confirmed: "success",
  declined: "default",
  cancelled: "danger",
  passed: "default",
};

export function ParticipantChip({ status }: { status: ParticipantStatus }) {
  return (
    <Chip size="sm" variant="soft" color={STATUS_COLOR[status]}>
      {PARTICIPANT_STATUS_LABEL[status]}
    </Chip>
  );
}

/**
 * 마케팅 정보 수신 값 — 제휴사 · 광고주 회원 목록 · 상세(11-24 사용자).
 * "동의 · 문자 · 이메일"(받을 방법은 흐리게) · "비동의"(흐리게). 예전 서버라 값이 없으면 "-".
 */
export function MarketingValue({
  member,
}: {
  member: Parameters<typeof marketingStatus>[0];
}) {
  const status = marketingStatus(member);
  if (!status) return <span className="text-disabled">-</span>;
  if (!status.agreed) return <span className="text-disabled">비동의</span>;
  return (
    <span>
      동의
      {status.channels && (
        <span className="text-disabled"> · {status.channels}</span>
      )}
    </span>
  );
}

/**
 * HeroUI 체크박스를 원래 모양으로 — 보라 체크 + 6px 모서리 네모(전역 accent · radius가 shadcn용이라 그대로면 연보라 원).
 * 회원 내 정보의 받을 방법 체크(HEROUI_CHECKBOX_SCOPE)와 같다.
 */
const CHECKBOX_SCOPE =
  "[--app-accent:var(--accent)] [--app-accent-foreground:var(--accent-foreground)] [--app-radius:0.46875rem]";

/**
 * 마케팅 정보 수신 — 회원 상세용 체크박스(11-24 사용자: "체크박스형식으로 보여줘").
 * 문자 · 이메일 — 동의하지 않았으면 둘 다 빈 칸. 목록 표는 글(MarketingValue) 그대로.
 * onChange 가 있으면 관리자가 눌러 바꾼다(11-25 제휴사 회원 상세), 없으면 읽기 전용(광고주 회원).
 */
export function MarketingChecks({
  member,
  onChange,
  isDisabled = false,
}: {
  member: Parameters<typeof marketingStatus>[0];
  onChange?: (next: { sms: boolean; email: boolean }) => void;
  isDisabled?: boolean;
}) {
  const status = marketingStatus(member);
  if (!status) return <span className="text-disabled">-</span>;
  const items = [
    { key: "sms", label: "문자", on: status.sms },
    { key: "email", label: "이메일", on: status.email },
  ];
  return (
    <span
      role="group"
      aria-label={
        status.agreed ? "마케팅 정보 수신 동의" : "마케팅 정보 수신 비동의"
      }
      className="flex flex-wrap items-center gap-x-[16px] gap-y-[6px]"
    >
      {items.map((item) => (
        // 읽기 전용이면 마우스를 올려도 손가락 모양이 되지 않게(의뢰서 확인 체크와 같다).
        <Checkbox
          key={item.key}
          isSelected={item.on}
          isReadOnly={!onChange}
          isDisabled={isDisabled}
          onChange={(on) =>
            onChange?.({
              sms: item.key === "sms" ? on : status.sms,
              email: item.key === "email" ? on : status.email,
            })
          }
          className={cn(
            CHECKBOX_SCOPE,
            !onChange && "cursor-default [&_*]:cursor-default",
          )}
        >
          <Checkbox.Content className="items-center gap-[6px]">
            {/* 빈 칸도 흰 카드 위에서 보이게 회색 테두리(회원 내 정보와 같다). */}
            <Checkbox.Control className="border border-gray-300 in-data-[selected=true]:border-accent in-data-[selected=true]:bg-accent">
              <Checkbox.Indicator />
            </Checkbox.Control>
            {/* Checkbox.Content 가 이미 <label> 이라 글자는 span 으로(label 안 label 방지). */}
            <Label
              elementType="span"
              className={cn(
                "text-sm font-medium",
                item.on ? "text-black" : "text-disabled",
              )}
            >
              {item.label}
            </Label>
          </Checkbox.Content>
        </Checkbox>
      ))}
    </span>
  );
}

/** 이전 · 다음 — 카드 목록(모바일 · 수정 요청함)용 간단한 쪽 넘기기. */
export function SimplePager({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  if (last <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-[12px]">
      <Button
        isIconOnly
        size="sm"
        variant="tertiary"
        aria-label="이전 쪽"
        isDisabled={page <= 1}
        onPress={() => onChange(page - 1)}
      >
        <ChevronLeft className="size-[16px]" />
      </Button>
      <span className="text-sm text-tone-4a5565">
        {page} / {last}
      </span>
      <Button
        isIconOnly
        size="sm"
        variant="tertiary"
        aria-label="다음 쪽"
        isDisabled={page >= last}
        onPress={() => onChange(page + 1)}
      >
        <ChevronRight className="size-[16px]" />
      </Button>
    </div>
  );
}

/** 쪽 번호 — 처음 · 끝 쪽, 지금 쪽 양옆 1쪽을 보이고 나머지는 …로 줄인다(AI 채팅 관리 목록과 같다). */
function pageItems(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("…");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < total - 1) out.push("…");
  out.push(total);
  return out;
}

/** HeroUI Pagination 쪽 넘기기 — 표 아래. 한 쪽뿐이면 그리지 않는다. */
export function PageNav({
  page,
  pageSize,
  total,
  onChange,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  if (last <= 1) return null;
  const current = Math.min(page, last);
  return (
    <Pagination className={cn("w-auto", className)}>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous
            aria-label="이전 쪽"
            isDisabled={current === 1}
            onPress={() => onChange(current - 1)}
          >
            <Pagination.PreviousIcon />
          </Pagination.Previous>
        </Pagination.Item>
        {pageItems(current, last).map((item, i) =>
          item === "…" ? (
            <Pagination.Item key={`gap-${i}`}>
              <Pagination.Ellipsis />
            </Pagination.Item>
          ) : (
            <Pagination.Item key={item}>
              <Pagination.Link
                isActive={item === current}
                onPress={() => onChange(item)}
              >
                {item}
              </Pagination.Link>
            </Pagination.Item>
          ),
        )}
        <Pagination.Item>
          <Pagination.Next
            aria-label="다음 쪽"
            isDisabled={current === last}
            onPress={() => onChange(current + 1)}
          >
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );
}

/** 파일을 받아 새 탭에 — 광고주 기획안 화면도 쓰려고 lib 로 옮겼다(11-12). */
export { openFileInNewTab } from "@/lib/openFileInNewTab";
