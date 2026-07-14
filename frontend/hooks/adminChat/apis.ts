import { api } from "@/lib/api";
import type { AdSessionDetail } from "@/hooks/adSessions";

export type ChatOverviewKind = "member" | "guest";

export interface AdChatOverviewRow {
  kind: ChatOverviewKind;
  key: string; // member=user_id, guest=session_id
  name: string;
  email: string;
  membership?: string | null;
  room_count: number;
  message_count: number;
  last_used_at: string;
}

export interface AdChatOverviewResponse {
  total: number;
  items: AdChatOverviewRow[];
}

export interface AdUserSession {
  id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdUserChatDetail {
  user_id: string;
  name: string;
  email: string;
  membership?: string | null;
  sessions: AdUserSession[];
}

export const adminChatApi = {
  overview: () =>
    api.get<AdChatOverviewResponse>("/admin/chat/overview").then((r) => r.data),
  exportExcel: () =>
    api
      .get<Blob>("/admin/chat/export", { responseType: "blob" })
      .then((r) => r.data),

  user: (userId: string) =>
    api
      .get<AdUserChatDetail>(`/admin/chat/users/${userId}`)
      .then((r) => r.data),

  session: (sessionId: string) =>
    api
      .get<AdSessionDetail>(`/admin/chat/sessions/${sessionId}`)
      .then((r) => r.data),
};
