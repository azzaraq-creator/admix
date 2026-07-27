import { api } from "@/lib/api";
import type { AdminAccountDetail } from "@/hooks/adminAccounts";

export type AdminMe = AdminAccountDetail;

export interface AdminLoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  admin: AdminMe;
}

export const adminAuthApi = {
  login: (email: string, password: string, remember: boolean) =>
    api
      .post<AdminLoginResponse>("/admin/auth/login", { email, password, remember })
      .then((r) => r.data),
  me: () => api.get<AdminMe>("/admin/auth/me").then((r) => r.data),
  logout: (refreshToken: string) =>
    api.post("/admin/auth/logout", { refresh_token: refreshToken }),
};
