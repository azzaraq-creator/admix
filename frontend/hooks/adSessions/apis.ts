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
  /** 믹시 "어느 제안서에 담을까요?" 목록에서 고른 결과를 대화 기록에 남긴다(새로고침해도 완료 문구로 보이게). */
  markProposalChoice: (
    sessionId: string,
    body: { proposal_id: string; proposal_name: string; media_ids: string[] },
  ) =>
    api
      .post(`/chat/graph/sessions/${sessionId}/proposal-choice`, body)
      .then(() => undefined),

  create: (title?: string | null) =>
    api
      .post<AdSessionSummary>("/chat/graph/sessions", { title })
      .then((r) => r.data),

  list: () =>
    api.get<AdSessionSummary[]>("/chat/graph/sessions").then((r) => r.data),

  get: (id: string) =>
    api.get<AdSessionDetail>(`/chat/graph/sessions/${id}`).then((r) => r.data),

  patch: (id: string, title: string) =>
    api
      .patch<AdSessionSummary>(`/chat/graph/sessions/${id}`, { title })
      .then((r) => r.data),

  remove: (id: string) =>
    api.delete(`/chat/graph/sessions/${id}`).then(() => undefined),

  // 로그인 사용자의 전체 세션 누적 챗 횟수(와리가리 횟수). 로그인 필요.
  chatCount: () =>
    api
      .get<{ chat_count: number }>("/chat/graph/chat-count")
      .then((r) => r.data.chat_count),
};
