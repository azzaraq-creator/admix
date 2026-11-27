import type { AdminListParams } from "@/lib/adminList";
import { api } from "@/lib/api";
import type {
  BizLicensePage,
  BizLicenseParams,
  BizLicenseZipParams,
} from "@/lib/bizLicense";
import type { MemberCategory } from "@/lib/memberCategory";

export interface MemberListParams extends AdminListParams {
  biz_status?: string;
  /** 회원 유형 한글값(광고주/광고 대행사/매체사/일반). */
  category?: string;
  status?: string;
}

export interface MemberRow {
  no: string;
  category: string;
  loginId: string;
  company: string;
  name: string;
  email: string;
  phone: string;
  bizStatus: string;
  marketing: string;
  status: string;
  joinedAt: string;
  /** 마지막 로그인(091) — ISO 시각, 기록이 없으면 null. */
  lastLoginAt: string | null;
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
  detail: string | null;
  start_date: string;
  end_date: string | null;
  created_at: string;
}

export interface SanctionPayload {
  reason: string;
  detail: string | null;
  start_date: string;
  end_date: string | null;
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
  /** 개인/기업 구분 — 기존 데이터 보존용(화면에서는 쓰지 않음). */
  membership_type: string;
  member_category: MemberCategory;
  company_name: string | null;
  position: string | null;
  industry: string | null;
  /** 광고주 담당자 정보(068) — 이름 · 소속팀 · 명함 파일(/uploads/business-card/…). 직함은 position. */
  contact_name: string | null;
  department: string | null;
  business_card_url: string | null;
  business_card_name: string | null;
  marketing_consent: boolean;
  /** 마케팅 정보 받을 방법(083) — 동의했을 때만 뜻이 있다. 예전 서버면 없다. */
  marketing_sms?: boolean;
  marketing_email?: boolean;
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
  member_category?: MemberCategory;
  company_name?: string | null;
  position?: string | null;
  industry?: string | null;
  contact_name?: string | null;
  department?: string | null;
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
  list: (params?: MemberListParams) =>
    api
      .get<MemberListResponse>("/admin/members", { params })
      .then((r) => r.data),
  exportExcel: () =>
    api
      .get<Blob>("/admin/members/export", { responseType: "blob" })
      .then((r) => r.data),
  get: (id: string) =>
    api.get<MemberDetail>(`/admin/members/${id}`).then((r) => r.data),
  /** 사업자등록증 모아 보기(11-26) — 파일을 올린 모든 회원, 최근 올린 것부터. */
  bizLicenses: (params: BizLicenseParams) =>
    api
      .get<BizLicensePage>("/admin/members/business-registrations", { params })
      .then((r) => r.data),
  /** 조건에 맞는 사업자등록증 전부를 zip 하나로. */
  bizLicensesZip: (params: BizLicenseZipParams) =>
    api
      .get<Blob>("/admin/members/business-registrations/download", {
        params,
        responseType: "blob",
      })
      .then((r) => r.data),
  /** 사업자등록증 파일(원본) — 새 탭으로 열 때 blob 으로 받는다. */
  bizLicenseFile: (id: string) =>
    api
      .get<Blob>(`/admin/members/${id}/business-registration/download`, {
        responseType: "blob",
      })
      .then((r) => r.data),
  update: (id: string, payload: MemberUpdatePayload) =>
    api.patch<MemberDetail>(`/admin/members/${id}`, payload).then((r) => r.data),
  updateBizReg: (id: string, payload: BizRegUpdatePayload) =>
    api
      .patch<MemberDetail>(`/admin/members/${id}/business-registration`, payload)
      .then((r) => r.data),
  createSanction: (id: string, payload: SanctionPayload) =>
    api
      .post<MemberDetail>(`/admin/members/${id}/sanctions`, payload)
      .then((r) => r.data),
  updateSanction: (id: string, sanctionId: string, payload: SanctionPayload) =>
    api
      .patch<MemberDetail>(
        `/admin/members/${id}/sanctions/${sanctionId}`,
        payload,
      )
      .then((r) => r.data),
  deleteSanction: (id: string, sanctionId: string) =>
    api
      .delete<MemberDetail>(`/admin/members/${id}/sanctions/${sanctionId}`)
      .then((r) => r.data),
};
