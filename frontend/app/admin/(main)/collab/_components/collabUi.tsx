"use client";

import { Button, Chip, Pagination } from "@heroui/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { PARTICIPANT_STATUS_LABEL } from "@/lib/adminCollab";
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

/** 칸 묶음 — 흰 카드 안의 테두리 상자. */
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
    <section
      className={cn(
        "flex flex-col gap-[16px] rounded-[12px] border border-stroke p-[16px] md:p-[24px]",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-[8px]">
        <div className="flex min-w-0 flex-col gap-[2px]">
          <h2 className="text-base font-bold leading-[24px] text-black md:text-lg md:leading-[28px]">
            {title}
          </h2>
          {desc && <p className="text-sm text-disabled">{desc}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
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
};

export function ParticipantChip({ status }: { status: ParticipantStatus }) {
  return (
    <Chip size="sm" variant="soft" color={STATUS_COLOR[status]}>
      {PARTICIPANT_STATUS_LABEL[status]}
    </Chip>
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
      <span className="text-sm tabular-nums text-tone-4a5565">
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

/** 받은 파일 저장 · 열기 — 사진 · PDF 는 새 창으로 보여 주고, 그 밖은 내려받는다. */
export function openOrDownloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const viewable =
    blob.type.startsWith("image/") || blob.type === "application/pdf";
  if (viewable) {
    const win = window.open(url, "_blank");
    if (win) {
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return;
    }
  }
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
