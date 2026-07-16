import { type ProposalSummary } from "@/hooks/proposals";
import { formatDateTime } from "@/lib/date";

export type Status = "작성중" | "제출완료" | "맞춤제안" | "계약완료";

export const TABS = ["전체", "작성중", "제출완료", "맞춤제안", "계약완료"] as const;

export type Proposal = {
  id: string;
  title: string;
  updatedAt: string;
  status: Status; // 탭 필터용(collapsed)
  rawStatus: string; // 칩 표시용(backend 원본 5종)
};

// 백엔드 status → UI 탭 매핑
export function toStatus(raw: string): Status {
  if (raw === "contracted") return "계약완료";
  if (raw === "execution_requested") return "제출완료";
  if (raw === "custom") return "맞춤제안";
  return "작성중";
}

export function toView(p: ProposalSummary): Proposal {
  return {
    id: p.id,
    title: p.title,
    updatedAt: formatDateTime(p.updated_at),
    status: toStatus(p.status),
    rawStatus: p.status,
  };
}
