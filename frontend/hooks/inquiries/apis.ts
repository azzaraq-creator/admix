import { api } from "@/lib/api";

export interface InquiryRow {
  id: string;
  name: string;
  title: string;
  content: string;
  status: string;
  submittedAt: string;
}

export interface InquiryListResponse {
  total: number;
  items: InquiryRow[];
}

export interface InquiryDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  subject: string;
  content: string;
  status: string;
  submittedAt: string;
  answer: string | null;
  answerer: string | null;
  answeredAt: string | null;
}

export const inquiriesApi = {
  list: () =>
    api.get<InquiryListResponse>("/admin/inquiries").then((r) => r.data),
  get: (id: string) =>
    api.get<InquiryDetail>(`/admin/inquiries/${id}`).then((r) => r.data),
  answer: (id: string, answer: string) =>
    api
      .patch<InquiryDetail>(`/admin/inquiries/${id}/answer`, { answer })
      .then((r) => r.data),
};
