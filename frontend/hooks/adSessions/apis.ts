import { api } from "@/lib/api";

export interface AdSessionSummary {
  id: string;
  title: string;
  thread_id: string;
  created_at: string;
  updated_at: string;
}

export interface AdMessageOut {
  id: string;
  role: "user" | "assistant";
  content: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface AdSessionDetail extends AdSessionSummary {
  messages: AdMessageOut[];
}

export const adSessionsApi = {
  create: (title?: string | null) =>
    api
      .post<AdSessionSummary>("/chat/graph/sessions", { title })
      .then((r) => r.data),

  list: () =>
    api.get<AdSessionSummary[]>("/chat/graph/sessions").then((r) => r.data),

  get: (id: string) =>
    api
      .get<AdSessionDetail>(`/chat/graph/sessions/${id}`)
      .then((r) => r.data),

  patch: (id: string, title: string) =>
    api
      .patch<AdSessionSummary>(`/chat/graph/sessions/${id}`, { title })
      .then((r) => r.data),

  remove: (id: string) =>
    api.delete(`/chat/graph/sessions/${id}`).then(() => undefined),
};
