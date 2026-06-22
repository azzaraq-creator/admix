import { api } from "@/lib/api";

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    api
      .post<LoginResponse>("/auth/login", { email, password })
      .then((r) => r.data),
};
