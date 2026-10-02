import type { AdminListParams } from "@/lib/adminList";
import { api } from "@/lib/api";
import { getSessionId } from "@/lib/session";
import { getUserToken } from "@/lib/userToken";

export interface ProposalListParams extends AdminListParams {
  status?: string;
  member_id?: string;
}

export interface ProposalRow {
  id: string;
  name: string;
  member: string;
  mediaCount: string;
  totalAmount: string;
  status: string;
  deleted: boolean;
  registeredAt: string;
}

export interface ProposalListResponse {
  total: number;
  items: ProposalRow[];
}

export interface AdminProposalMember {
  membership_type: string | null;
  company_name: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
}

export interface AdminProposalCounterFile {
  id: string;
  file_url: string;
  file_name: string;
  title: string | null;
  author_name: string | null;
  slides_url?: string | null;
  slides?: CounterSlide[];
  created_at: string | null;
}

export interface AdminProposalDetail {
  id: string;
  title: string;
  status: string;
  total_amount: number;
  updated_at: string | null;
  counter_proposal_file_url: string | null;
  counter_proposal_file_name: string | null;
  counter_files: AdminProposalCounterFile[];
  member: AdminProposalMember | null;
  items: ProposalItem[];
}

export const proposalsApi = {
  list: (params?: ProposalListParams) =>
    api
      .get<ProposalListResponse>("/admin/proposals", { params })
      .then((r) => r.data),
  exportExcel: () =>
    api
      .get<Blob>("/admin/proposals/export", { responseType: "blob" })
      .then((r) => r.data),
  get: (id: string) =>
    api.get<AdminProposalDetail>(`/admin/proposals/${id}`).then((r) => r.data),
  uploadCounterProposal: (id: string, file: File, title: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("title", title);
    return api
      .post<AdminProposalDetail>(
        `/admin/proposals/${id}/counter-proposal`,
        form,
      )
      .then((r) => r.data);
  },
  accept: (id: string) =>
    api
      .post<AdminProposalDetail>(`/admin/proposals/${id}/accept`)
      .then((r) => r.data),
  downloadCounterProposal: (proposalId: string, counterId: string) =>
    api.get<Blob>(
      `/admin/proposals/${proposalId}/counter-proposal/${counterId}/download`,
      { responseType: "blob" },
    ),
  exportPpt: (id: string) =>
    api.get<Blob>(`/admin/proposals/${id}/export-ppt`, {
      responseType: "blob",
      timeout: 60000,
    }),
};

// ===== 클라이언트(장바구니/플래닝) =====

export function isMember(): boolean {
  return Boolean(getUserToken());
}

/** 내 제안서 목록 — 제안서명에 마우스를 올리면 뜨는 "제안서 요약"의 매체 한 줄. */
export interface ProposalPreviewItem {
  media_id: string;
  name: string;
  address: string | null;
  thumbnail_url: string | null;
  /** 선택한 상품의 광고비·제작비(1회분). */
  advertisement_fee: number | null;
  production_fee: number | null;
  /** 제안서에 담긴 시각. */
  created_at?: string | null;
}

export interface ProposalSummary {
  id: string;
  title: string;
  status: string;
  media_count: number;
  total_amount: number;
  updated_at: string | null;
  media_ids: string[];
  created_at?: string | null;
  // 아래는 내 제안서 목록(GET /proposals)에서만 채워진다.
  /** 광고비 × 수량 합계 */
  advertisement_amount?: number | null;
  /** 제작비 × 수량 합계 */
  production_amount?: number | null;
  preview_items?: ProposalPreviewItem[];
}

export interface PlanOption {
  plan_no: number;
  product_name: string | null;
  product_display_name: string | null;
  advertisement_fee: number | null;
  production_fee: number | null;
  operation_start_time: string | null;
  operation_end_time: string | null;
  /** 영상 길이(초) */
  exposure_seconds?: number | null;
  /** 일 송출 수 */
  daily_broadcasts?: number | null;
}

export interface ProposalItem {
  media_id: string;
  name: string | null;
  /** 매체명 — name 은 선택 상품명(서머리용)일 수 있다. */
  media_name?: string | null;
  /** 제안서에 담은 시각 */
  created_at?: string | null;
  price: number | null;
  production_fee: number | null;
  thumbnail_url: string | null;
  category: string | null;
  region: string | null;
  product: string | null;
  address: string | null;
  ooh_type: string | null;
  description: string | null;
  device_quantity: number | null;
  surface_quantity: number | null;
  latitude: number | null;
  longitude: number | null;
  spec: string | null;
  start_date: string | null;
  end_date: string | null;
  quantity: number | null;
  /** 집행 개월 수(광고비에 곱한다) — 매체 정보 팝업에서 고른 값, 기본 1. */
  months?: number;
  /** 제작 수(제작비에 곱한다, OOH만) — 기본 1. */
  production_count?: number;
  selected_plan_no: number | null;
  plans: PlanOption[];
}

export interface CounterSlide {
  image: string;
  thumb: string;
}

export interface ProposalDetail extends ProposalSummary {
  items: ProposalItem[];
  counter_proposal_slides_url?: string | null;
  counter_proposal_slides?: CounterSlide[];
  counter_proposal_file_name?: string | null;
}

export interface ProposalLimitDetail {
  reason: "limit_reached";
  tier: "guest" | "member" | "verified";
  limit: number;
}

// 제안서 생성/이름변경 409 응답의 detail.reason 추출. 409 아니면 null.
export function proposalErrorReason(err: unknown): string | null {
  const res = (
    err as {
      response?: { status?: number; data?: { detail?: { reason?: string } } };
    }
  )?.response;
  if (res?.status !== 409) return null;
  return res.data?.detail?.reason ?? null;
}

// 한도 초과(409 limit_reached) 에러면 tier 반환, 아니면 null.
export function proposalLimitTier(
  err: unknown,
): ProposalLimitDetail["tier"] | null {
  const res = (
    err as {
      response?: { status?: number; data?: { detail?: ProposalLimitDetail } };
    }
  )?.response;
  if (res?.status !== 409) return null;
  const detail = res.data?.detail;
  return detail?.reason === "limit_reached" ? detail.tier : null;
}

export const proposalsClientApi = {
  list: () =>
    api
      .get<ProposalSummary[]>("/proposals", {
        params: { session_id: getSessionId() },
      })
      .then((r) => r.data),
  create: (title: string) =>
    api
      .post<ProposalSummary>("/proposals", {
        title,
        session_id: getSessionId(),
      })
      .then((r) => r.data),
  get: (id: string) =>
    api
      .get<ProposalDetail>(`/proposals/${id}`, {
        params: { session_id: getSessionId() },
      })
      .then((r) => r.data),
  downloadCounterProposal: (id: string) =>
    api.get<Blob>(`/proposals/${id}/counter-proposal/download`, {
      responseType: "blob",
      params: { session_id: getSessionId() },
    }),
  rename: (id: string, title: string) =>
    api
      .patch<ProposalSummary>(
        `/proposals/${id}`,
        { title },
        { params: { session_id: getSessionId() } },
      )
      .then((r) => r.data),
  remove: (id: string) =>
    api
      .delete(`/proposals/${id}`, { params: { session_id: getSessionId() } })
      .then(() => undefined),
  addItems: (
    id: string,
    mediaIds: string[],
    plans?: Record<string, number>,
    options?: {
      months?: Record<string, number>;
      productionCounts?: Record<string, number>;
    },
  ) =>
    api
      .post<ProposalDetail>(`/proposals/${id}/items`, {
        media_ids: mediaIds,
        plans,
        months: options?.months,
        production_counts: options?.productionCounts,
        session_id: getSessionId(),
      })
      .then((r) => r.data),
  removeItem: (id: string, mediaId: string) =>
    api
      .delete<ProposalDetail>(`/proposals/${id}/items/${mediaId}`, {
        params: { session_id: getSessionId() },
      })
      .then((r) => r.data),
  reorder: (
    id: string,
    mediaIds: string[],
    plans?: Record<string, number>,
    dates?: Record<
      string,
      { start_date: string | null; end_date: string | null }
    >,
    quantities?: Record<string, number | null>,
    options?: {
      months?: Record<string, number>;
      productionCounts?: Record<string, number>;
    },
  ) =>
    api
      .put<ProposalDetail>(`/proposals/${id}/order`, {
        media_ids: mediaIds,
        plans,
        dates,
        quantities,
        months: options?.months,
        production_counts: options?.productionCounts,
        session_id: getSessionId(),
      })
      .then((r) => r.data),
  submit: (id: string) =>
    api.post<ProposalSummary>(`/proposals/${id}/submit`).then((r) => r.data),
  cancelSubmit: (id: string) =>
    api.post<ProposalSummary>(`/proposals/${id}/cancel`).then((r) => r.data),
  exportPpt: (id: string) =>
    api.get<Blob>(`/proposals/${id}/export-ppt`, {
      responseType: "blob",
      params: { session_id: getSessionId() },
      timeout: 60000,
    }),
  // 로그인/가입 시 게스트 세션 제안서 + 챗 세션을 회원으로 승계.
  claim: (sessionId: string) =>
    api
      .post<{ claimed: number }>("/proposals/claim", { session_id: sessionId })
      .then((r) => r.data),
};

/**
 * 담기·옵션 변경은 "작성 중"(편집 가능) 제안서에만 — 맞춤 제안·제출 완료·계약 완료는 뺀다.
 * (ProposalsView.toStatus 의 "작성 중" 분류와 같은 기준)
 */
export function isDraftProposal(status: string): boolean {
  return (
    status !== "contracted" &&
    status !== "custom" &&
    status !== "execution_requested"
  );
}
