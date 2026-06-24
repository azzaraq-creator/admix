import axios, {
  AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";

import { getAdminToken } from "./adminToken";
import {
  clearUserToken,
  getPersist,
  getRefreshToken,
  getUserToken,
  setTokens,
} from "./userToken";

const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

export const api = axios.create({ baseURL });

function isAdminRequest(url: string | undefined): boolean {
  return (url ?? "").startsWith("/admin");
}

api.interceptors.request.use((config) => {
  const token = isAdminRequest(config.url)
    ? getAdminToken()
    : getUserToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error("리프레시 토큰이 없습니다.");
  const res = await axios.post<{
    access_token: string;
    refresh_token: string;
  }>(`${baseURL}/auth/refresh`, { refresh_token: refreshToken });
  setTokens(res.data.access_token, res.data.refresh_token, getPersist());
  return res.data.access_token;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    const url = original?.url ?? "";
    const isAuthEndpoint =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/refresh");

    const isUserAuthError =
      error.response?.status === 401 &&
      !!original &&
      !original._retry &&
      !isAdminRequest(url) &&
      !isAuthEndpoint;

    if (!isUserAuthError || !original) {
      return Promise.reject(error);
    }

    original._retry = true;

    const endSession = (cause: unknown) => {
      clearUserToken();
      if (typeof window !== "undefined") window.location.href = "/";
      return Promise.reject(cause);
    };

    // 갱신 수단이 없으면 세션 종료 → 홈으로
    if (!getRefreshToken()) {
      return endSession(error);
    }

    let newToken: string;
    try {
      refreshPromise = refreshPromise ?? refreshAccessToken();
      newToken = await refreshPromise;
    } catch (refreshError) {
      return endSession(refreshError);
    } finally {
      refreshPromise = null;
    }

    original.headers.Authorization = `Bearer ${newToken}`;
    return api(original);
  },
);
