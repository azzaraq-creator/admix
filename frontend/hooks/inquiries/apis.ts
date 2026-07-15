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
  exportExcel: () =>
    api
      .get<Blob>("/admin/inquiries/export", { responseType: "blob" })
      .then((r) => r.data),
  get: (id: string) =>
    api.get<InquiryDetail>(`/admin/inquiries/${id}`).then((r) => r.data),
  answer: (id: string, answer: string) =>
    api
      .patch<InquiryDetail>(`/admin/inquiries/${id}/answer`, { answer })
      .then((r) => r.data),
};

// ===== 클라이언트(로그인 회원 본인 문의 내역) =====

export interface MyInquiryRow {
  id: string;
  subject: string;
  status: string; // pending | answered
  createdAt: string | null;
}

export interface MyInquiryListResponse {
  total: number;
  items: MyInquiryRow[];
}

export interface MyInquiryDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  subject: string;
  content: string;
  status: string;
  createdAt: string | null;
  answer: string | null;
  answererName: string | null;
  answeredAt: string | null;
}

export interface InquiryCreatePayload {
  subject: string;
  content: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
}

export const inquiriesClientApi = {
  myList: () =>
    api.get<MyInquiryListResponse>("/inquiries").then((r) => r.data),
  myGet: (id: string) =>
    api.get<MyInquiryDetail>(`/inquiries/${id}`).then((r) => r.data),
  create: (payload: InquiryCreatePayload) =>
    api.post<MyInquiryDetail>("/inquiries", payload).then((r) => r.data),
};
