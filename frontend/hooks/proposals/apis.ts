import { api } from "@/lib/api";
import { getUserToken } from "@/lib/userToken";

export interface ProposalRow {
  id: string;
  name: string;
  member: string;
  mediaCount: string;
  totalAmount: string;
  status: string;
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
  list: () =>
    api.get<ProposalListResponse>("/admin/proposals").then((r) => r.data),
  get: (id: string) =>
    api
      .get<AdminProposalDetail>(`/admin/proposals/${id}`)
      .then((r) => r.data),
  uploadCounterProposal: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<AdminProposalDetail>(
        `/admin/proposals/${id}/counter-proposal`,
        form,
      )
      .then((r) => r.data);
  },
};

// ===== 클라이언트(장바구니/플래닝) =====

const SESSION_KEY = "adRecommendV2.sessionId";

function getSessionId(): string | null {
  return typeof window !== "undefined"
    ? localStorage.getItem(SESSION_KEY)
    : null;
}

export function isMember(): boolean {
  return Boolean(getUserToken());
}

export interface ProposalSummary {
  id: string;
  title: string;
  status: string;
  media_count: number;
  total_amount: number;
  updated_at: string | null;
  media_ids: string[];
}

export interface PlanOption {
  plan_no: number;
  product_name: string | null;
  product_display_name: string | null;
  advertisement_fee: number | null;
  production_fee: number | null;
  operation_start_time: string | null;
  operation_end_time: string | null;
}

export interface ProposalItem {
  media_id: string;
  name: string | null;
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
  selected_plan_no: number | null;
  plans: PlanOption[];
}

export interface ProposalDetail extends ProposalSummary {
  items: ProposalItem[];
}

export interface ProposalLimitDetail {
  reason: "limit_reached";
  tier: "guest" | "member" | "verified";
  limit: number;
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
  addItems: (id: string, mediaIds: string[]) =>
    api
      .post<ProposalDetail>(`/proposals/${id}/items`, {
        media_ids: mediaIds,
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
    dates?: Record<string, { start_date: string | null; end_date: string | null }>,
    quantities?: Record<string, number | null>,
  ) =>
    api
      .put<ProposalDetail>(`/proposals/${id}/order`, {
        media_ids: mediaIds,
        plans,
        dates,
        quantities,
        session_id: getSessionId(),
      })
      .then((r) => r.data),
  submit: (id: string) =>
    api.post<ProposalSummary>(`/proposals/${id}/submit`).then((r) => r.data),
  cancelSubmit: (id: string) =>
    api.post<ProposalSummary>(`/proposals/${id}/cancel`).then((r) => r.data),
};
