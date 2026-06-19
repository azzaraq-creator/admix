import { api } from "@/lib/api";

export interface FaqRow {
  id: string;
  faq_type: string | null;
  title: string;
  content: string;
  sort_order: number;
  is_published: boolean;
  created_by: string | null;
  author: string | null;
  created_at: string;
  updated_at: string;
}

export interface FaqCreatePayload {
  faq_type?: string | null;
  title: string;
  content: string;
  sort_order?: number;
  is_published?: boolean;
  created_by?: string | null;
}

export interface FaqUpdatePayload {
  faq_type?: string | null;
  title?: string;
  content?: string;
  sort_order?: number;
  is_published?: boolean;
}

export const faqsApi = {
  list: (params?: { faq_type?: string; published_only?: boolean }) =>
    api.get<FaqRow[]>("/faqs", { params }).then((r) => r.data),
  get: (id: string) => api.get<FaqRow>(`/faqs/${id}`).then((r) => r.data),
  create: (payload: FaqCreatePayload) =>
    api.post<FaqRow>("/faqs", payload).then((r) => r.data),
  update: (id: string, payload: FaqUpdatePayload) =>
    api.patch<FaqRow>(`/faqs/${id}`, payload).then((r) => r.data),
  remove: (id: string) => api.delete(`/faqs/${id}`).then(() => undefined),
};
