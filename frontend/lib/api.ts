import axios from "axios";

import { getAdminToken } from "./adminToken";
import { getUserToken } from "./userToken";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001",
});

api.interceptors.request.use((config) => {
  const token = getAdminToken() ?? getUserToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
