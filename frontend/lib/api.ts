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

api.interceptors.request.use((config) => {
  const token = getAdminToken() ?? getUserToken();
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

    const shouldRefresh =
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !getAdminToken() &&
      !!getRefreshToken() &&
      !original.url?.includes("/auth/refresh");

    if (!shouldRefresh || !original) {
      return Promise.reject(error);
    }

    original._retry = true;
    try {
      refreshPromise = refreshPromise ?? refreshAccessToken();
      const newToken = await refreshPromise;
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (refreshError) {
      clearUserToken();
      if (typeof window !== "undefined") window.location.href = "/";
      return Promise.reject(refreshError);
    } finally {
      refreshPromise = null;
    }
  },
);
