import { api } from "@/lib/api";

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
  membership_type: "individual" | "corporate";
  company_name?: string;
  marketing_consent: boolean;
}

export interface MeResponse {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  verified: boolean;
  membership_type: "individual" | "corporate";
  company_name: string | null;
  marketing_consent: boolean;
  created_at: string;
}

export const authApi = {
  login: (email: string, password: string, remember: boolean) =>
    api
      .post<LoginResponse>("/auth/login", { email, password, remember })
      .then((r) => r.data),
  register: (payload: RegisterPayload) =>
    api.post<LoginResponse>("/auth/register", payload).then((r) => r.data),
  me: () => api.get<MeResponse>("/auth/me").then((r) => r.data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post("/auth/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
    }),
  updateProfile: (payload: {
    name?: string;
    company_name?: string;
    phone?: string;
  }) => api.patch<MeResponse>("/auth/me", payload).then((r) => r.data),
};
