import axios, {
  AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";

import {
  clearAdminToken,
  getAdminPersist,
  getAdminRefreshToken,
  getAdminToken,
  setAdminTokens,
} from "./adminToken";
import {
  clearUserToken,
  getPersist,
  getRefreshToken,
  getUserToken,
  setTokens,
} from "./userToken";

export const API_BASE_URL =
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001").trim();

export const api = axios.create({ baseURL: API_BASE_URL });

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
let refreshAdminPromise: Promise<string> | null = null;

async function refreshAdminAccessToken(): Promise<string> {
  const refreshToken = getAdminRefreshToken();
  if (!refreshToken) throw new Error("관리자 리프레시 토큰이 없습니다.");
  const res = await axios.post<{
    access_token: string;
    refresh_token: string;
  }>(`${API_BASE_URL}/admin/auth/refresh`, { refresh_token: refreshToken });
  setAdminTokens(res.data.access_token, res.data.refresh_token, getAdminPersist());
  return res.data.access_token;
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error("리프레시 토큰이 없습니다.");
  const res = await axios.post<{
    access_token: string;
    refresh_token: string;
  }>(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
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

    // 관리자 토큰 만료/무효(401): refresh 로 access 재발급 시도, 실패 시 로그인으로.
    // /admin/auth/* 는 제외(로그인·refresh 자체 실패 시 리다이렉트 루프 방지).
    if (
      error.response?.status === 401 &&
      isAdminRequest(url) &&
      !url.includes("/admin/auth/")
    ) {
      const endAdminSession = (cause: unknown) => {
        clearAdminToken();
        if (typeof window !== "undefined") {
          window.location.href = "/admin/login";
        }
        return Promise.reject(cause);
      };

      if (!original || original._retry || !getAdminRefreshToken()) {
        return endAdminSession(error);
      }
      original._retry = true;

      let newToken: string;
      try {
        refreshAdminPromise = refreshAdminPromise ?? refreshAdminAccessToken();
        newToken = await refreshAdminPromise;
      } catch (refreshError) {
        return endAdminSession(refreshError);
      } finally {
        refreshAdminPromise = null;
      }

      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    }

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
