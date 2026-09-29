import {
  type ProposalPreviewItem,
  type ProposalSummary,
} from "@/hooks/proposals";

export type Status = "작성 중" | "제출 완료" | "맞춤 제안" | "계약 완료";

/** 시안(03. 제안서) 상태 탭 순서·문구. */
export const TABS = [
  "전체",
  "작성 중",
  "제출 완료",
  "맞춤 제안",
  "계약 완료",
] as const;

export type Proposal = {
  id: string;
  title: string;
  status: Status; // 탭 필터·배지용
  mediaCount: number;
  advertisementAmount: number;
  productionAmount: number;
  /** 정렬용 원본 시각(ms). 없으면 0. */
  updatedAtMs: number;
  createdAtMs: number;
  /** 표시용 "YYYY-MM-DD HH:mm". */
  updatedAt: string;
  createdAt: string;
  /** 표지에 쓰는 제작 연도. */
  year: string;
  previews: ProposalPreviewItem[];
};

// 백엔드 status → 화면 상태
export function toStatus(raw: string): Status {
  if (raw === "contracted") return "계약 완료";
  if (raw === "execution_requested") return "제출 완료";
  if (raw === "custom") return "맞춤 제안";
  return "작성 중";
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 시안 표기 "2026-09-02 16:00". */
function formatListDateTime(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const toMs = (iso?: string | null) => {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
};

export function toView(p: ProposalSummary): Proposal {
  const createdAt = p.created_at ?? p.updated_at;
  return {
    id: p.id,
    title: p.title,
    status: toStatus(p.status),
    mediaCount: p.media_count,
    // 예전 응답(금액 분리 전)은 total_amount가 광고비 합계다.
    advertisementAmount: p.advertisement_amount ?? p.total_amount,
    productionAmount: p.production_amount ?? 0,
    updatedAtMs: toMs(p.updated_at),
    createdAtMs: toMs(createdAt),
    updatedAt: formatListDateTime(p.updated_at),
    createdAt: formatListDateTime(createdAt),
    year: createdAt ? String(new Date(createdAt).getFullYear()) : "",
    previews: p.preview_items ?? [],
  };
}
