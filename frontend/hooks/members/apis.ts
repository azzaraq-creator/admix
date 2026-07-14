import { api } from "@/lib/api";

export interface MemberRow {
  no: string;
  type: string;
  loginId: string;
  company: string;
  name: string;
  email: string;
  phone: string;
  bizStatus: string;
  marketing: string;
  status: string;
  joinedAt: string;
}

export interface MemberListResponse {
  total: number;
  items: MemberRow[];
}

export interface BusinessRegistrationOut {
  status: string;
  business_name: string | null;
  business_registration_no: string | null;
  address: string | null;
  business_type: string | null;
  reject_reason: string | null;
  license_file_url: string | null;
  license_file_name: string | null;
  license_uploaded_at: string | null;
  verified_at: string | null;
}

export interface SanctionOut {
  id: string;
  reason: string;
  start_date: string;
  end_date: string | null;
  created_at: string;
}

export interface MemberProposalRow {
  id: string;
  proposalName: string;
  name: string;
  totalAmount: string;
  status: string;
  registeredAt: string;
}

export interface MemberInquiryRow {
  id: string;
  name: string;
  title: string;
  content: string;
  status: string;
  submittedAt: string;
}

export interface MemberDetail {
  id: string;
  login_id: string;
  email: string;
  name: string | null;
  phone: string | null;
  membership_type: string;
  company_name: string | null;
  position: string | null;
  industry: string | null;
  marketing_consent: boolean;
  status: string;
  admin_memo: string | null;
  created_at: string;
  withdrawn_at: string | null;
  proposal_count: number;
  inquiry_count: number;
  business_registration: BusinessRegistrationOut | null;
  sanctions: SanctionOut[];
  proposals: MemberProposalRow[];
  inquiries: MemberInquiryRow[];
}

export interface MemberUpdatePayload {
  name?: string;
  phone?: string;
  membership_type?: string;
  company_name?: string | null;
  position?: string | null;
  industry?: string | null;
  marketing_consent?: boolean;
  status?: string;
  admin_memo?: string | null;
}

export interface BizRegUpdatePayload {
  status?: string;
  business_name?: string | null;
  business_registration_no?: string | null;
  address?: string | null;
  business_type?: string | null;
  reject_reason?: string | null;
}

export const membersApi = {
  list: () =>
    api.get<MemberListResponse>("/admin/members").then((r) => r.data),
  exportExcel: () =>
    api
      .get<Blob>("/admin/members/export", { responseType: "blob" })
      .then((r) => r.data),
  get: (id: string) =>
    api.get<MemberDetail>(`/admin/members/${id}`).then((r) => r.data),
  update: (id: string, payload: MemberUpdatePayload) =>
    api.patch<MemberDetail>(`/admin/members/${id}`, payload).then((r) => r.data),
  updateBizReg: (id: string, payload: BizRegUpdatePayload) =>
    api
      .patch<MemberDetail>(`/admin/members/${id}/business-registration`, payload)
      .then((r) => r.data),
};
