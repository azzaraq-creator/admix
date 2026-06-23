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

export const proposalsApi = {
  list: () =>
    api.get<ProposalListResponse>("/admin/proposals").then((r) => r.data),
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
}

export interface ProposalItem {
  media_id: string;
  name: string | null;
  price: number | null;
  thumbnail_url: string | null;
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
  submit: (id: string) =>
    api.post<ProposalSummary>(`/proposals/${id}/submit`).then((r) => r.data),
};
