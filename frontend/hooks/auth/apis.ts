import { api } from "@/lib/api";
import type { MemberCategory } from "@/lib/memberCategory";
import { getSessionId } from "@/lib/session";

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  phone: string;
  member_category: MemberCategory;
  company_name?: string;
  marketing_consent: boolean;
  /** 마케팅 정보 받을 방법(083) — 제휴사 가입 약관 단계에서 고른다. 안 보내면 동의했을 때 둘 다. */
  marketing_sms?: boolean;
  marketing_email?: boolean;
  /** 제휴사(콜라보) 매장 정보(089) — 제휴사는 꼭 보낸다. */
  store_info?: PartnerStoreInfoPayload;
}

/**
 * 제휴사 가입 "매장 정보"(089, 2026-11-13 사용자) — 상호 · 사업자 번호 · 대표자명 · 주소는 필수, 상세 주소는 선택.
 * 사업자 번호는 숫자만 보내도 된다(서버가 000-00-00000 으로 맞춰 저장).
 */
export interface PartnerStoreInfoPayload {
  business_name: string;
  business_registration_no: string;
  representative_name: string;
  address: string;
  address_detail?: string | null;
}

/** SNS 가입 마무리 — 제공자 이메일을 그대로 쓰면 이메일 인증 없이 완료된다. */
export interface SnsCompletePayload {
  email: string;
  marketing_consent: boolean;
  /** 마케팅 정보 받을 방법(083) — RegisterPayload 와 같다. */
  marketing_sms?: boolean;
  marketing_email?: boolean;
  member_category: MemberCategory;
  name: string;
  phone: string;
  company_name?: string;
  /** 제휴사(콜라보) 매장 정보(089) — RegisterPayload 와 같다. */
  store_info?: PartnerStoreInfoPayload;
}

/** 내 정보 고치기 — 보낸 칸만 바뀐다. 담당자 정보(광고주)는 빈 문자열이면 지운다. */
export interface ProfileUpdatePayload {
  name?: string;
  company_name?: string;
  phone?: string;
  marketing_consent?: boolean;
  /** 마케팅 정보 받을 방법(083) — 문자 · 이메일, 둘 다 가능. 동의를 켠 채 둘 다 끄면 서버가 막는다. */
  marketing_sms?: boolean;
  marketing_email?: boolean;
  member_category?: MemberCategory;
  contact_name?: string;
  position?: string;
  department?: string;
}

export interface BusinessRegistration {
  /** provisional — 콜라보 어드민 임시 승인(담당자가 현장에서, 등록증 없이 협약까지 넘어가게, 069). */
  status:
    "unregistered" | "reviewing" | "verified" | "rejected" | "provisional";
  business_name: string | null;
  business_registration_no: string | null;
  address: string | null;
  /** 제휴사 가입 "매장 정보"(089) — 대표자명 · 상세 주소. 기본협약 계약서 빈칸을 채운다. */
  representative_name?: string | null;
  address_detail?: string | null;
  business_type: string | null;
  reject_reason: string | null;
  license_file_url: string | null;
  license_file_name: string | null;
  license_uploaded_at: string | null;
  verified_at: string | null;
  provisional_at?: string | null;
}

export interface MeResponse {
  id: string;
  login_id: string;
  email: string;
  sns_provider: string | null;
  name: string | null;
  phone: string | null;
  role: string;
  verified: boolean;
  member_category: MemberCategory;
  company_name: string | null;
  /** 광고주 담당자 정보(068, 모두 선택) — 이름 · 직함 · 소속팀 · 명함 파일(/uploads/business-card/…). */
  contact_name?: string | null;
  position?: string | null;
  department?: string | null;
  business_card_url?: string | null;
  business_card_name?: string | null;
  marketing_consent: boolean;
  /** 마케팅 정보 받을 방법(083) — 동의했을 때만 뜻이 있다. 예전 서버면 없다. */
  marketing_sms?: boolean;
  marketing_email?: boolean;
  created_at: string;
  business_registration: BusinessRegistration | null;
  /** 제휴사(콜라보) 기본협약 동의 시각 — null 이면 아직 동의 전(로그인 시 이어서 하기 창). */
  partner_agreed_at?: string | null;
  /** 기본협약 전자 서명(078) — 협약서 서명란에 보인다. 서명 도입 전에 동의했으면 비어 있다. */
  partner_signer_name?: string | null;
  partner_signer_role?: string | null;
  /** 손 서명 그림(/uploads/partner-signature/…). */
  partner_signature_url?: string | null;
  /** 제휴사(콜라보) 회원 고유번호(P-0001, 069) — 담당자가 이 번호로 매장을 연결한다. */
  partner_code?: string | null;
  /** 슈퍼 계정 묶음(087) — 자기 자신 포함, 회원 유형 순서. 보통 회원은 빈 목록(계정 전환 메뉴 없음). */
  linked_accounts?: LinkedAccount[];
}

export interface LinkedAccount {
  id: string;
  member_category: MemberCategory;
}

export const authApi = {
  login: (email: string, password: string, remember: boolean) =>
    api
      .post<LoginResponse>("/auth/login", {
        email,
        password,
        remember,
        session_id: getSessionId(),
      })
      .then((r) => r.data),
  register: (payload: RegisterPayload) =>
    api
      .post<LoginResponse>("/auth/register", {
        ...payload,
        session_id: getSessionId(),
      })
      .then((r) => r.data),
  snsAuthorizeUrl: (provider: string) =>
    api.get<{ url: string }>(`/auth/sns/${provider}`).then((r) => r.data.url),
  snsExchange: (provider: string, code: string, state: string) =>
    api
      .get<LoginResponse>(`/auth/sns/${provider}/callback`, {
        params: { code, state },
      })
      .then((r) => r.data),
  checkEmailAvailable: (email: string) =>
    api
      .get<{ available: boolean }>("/auth/register/email-available", {
        params: { email },
      })
      .then((r) => r.data.available),
  /** 회원정보 단계 전화번호 중복 확인. SNS 가입(로그인 상태)은 본인 번호를 제외한다. */
  checkPhoneAvailable: (phone: string) =>
    api
      .get<{ available: boolean }>("/auth/register/phone-available", {
        params: { phone },
      })
      .then((r) => r.data.available),
  requestEmailVerification: (email: string) =>
    api.post("/auth/email/verify/request", { email }),
  confirmEmailVerification: (email: string, code: string) =>
    api.post("/auth/email/verify/confirm", { email, code }),
  changeContactEmail: (email: string, code: string) =>
    api
      .patch<MeResponse>("/auth/me/email", { email, code })
      .then((r) => r.data),
  completeSnsSignup: (payload: SnsCompletePayload) =>
    api.post<MeResponse>("/auth/sns/complete", payload).then((r) => r.data),
  logout: (refreshToken: string) =>
    api.post("/auth/logout", { refresh_token: refreshToken }),
  /** 슈퍼 계정 "계정 전환" — 같은 묶음의 다른 유형 계정 토큰. 지금 리프레시 토큰은 서버가 폐기한다. */
  switchAccount: (userId: string, remember: boolean, refreshToken: string | null) =>
    api
      .post<LoginResponse>("/auth/switch-account", {
        user_id: userId,
        remember,
        refresh_token: refreshToken,
      })
      .then((r) => r.data),
  me: () => api.get<MeResponse>("/auth/me").then((r) => r.data),
  uploadBusinessRegistration: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<MeResponse>("/auth/me/business-registration", form)
      .then((r) => r.data);
  },
  /** 광고주 담당자 명함 올리기(바꾸기) — PDF · JPG · PNG · WEBP, 10MB. */
  uploadBusinessCard: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<MeResponse>("/auth/me/business-card", form)
      .then((r) => r.data);
  },
  deleteBusinessCard: () =>
    api.delete<MeResponse>("/auth/me/business-card").then((r) => r.data),
  cancelBusinessRegistration: () =>
    api
      .delete<MeResponse>("/auth/me/business-registration")
      .then((r) => r.data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post("/auth/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
    }),
  requestPasswordReset: (email: string) =>
    api
      .post<{ message: string }>("/auth/password-reset/request", { email })
      .then((r) => r.data),
  confirmPasswordReset: (token: string, newPassword: string) =>
    api.post("/auth/password-reset/confirm", {
      token,
      new_password: newPassword,
    }),
  updateProfile: (payload: ProfileUpdatePayload) =>
    api.patch<MeResponse>("/auth/me", payload).then((r) => r.data),
  withdraw: () => api.delete("/auth/me"),
};
