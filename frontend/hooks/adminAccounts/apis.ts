import { api } from "@/lib/api";

export type AdminStatus = "active" | "disabled";

export interface AdminAccountRow {
  no: string;
  name: string;
  email: string;
  type: string;
  role: string;
  status: AdminStatus;
  createdAt: string;
}

export interface AdminAccountListResponse {
  total: number;
  items: AdminAccountRow[];
}

export interface AdminAccountDetail {
  id: string;
  email: string;
  name: string | null;
  account_type: string | null;
  department: string | null;
  phone: string | null;
  status: AdminStatus;
  permissions: string[];
  created_at: string;
  updated_at: string;
}

export interface AdminAccountCreatePayload {
  email: string;
  password: string;
  name: string;
  account_type: string;
  department?: string | null;
  phone?: string | null;
  status?: AdminStatus;
  permissions?: string[];
}

export interface AdminAccountUpdatePayload {
  name?: string;
  account_type?: string;
  department?: string | null;
  phone?: string | null;
  status?: AdminStatus;
  password?: string;
  permissions?: string[];
}

export const adminAccountsApi = {
  list: () =>
    api.get<AdminAccountListResponse>("/admin/accounts").then((r) => r.data),
  exportExcel: () =>
    api
      .get<Blob>("/admin/accounts/export", { responseType: "blob" })
      .then((r) => r.data),
  get: (id: string) =>
    api.get<AdminAccountDetail>(`/admin/accounts/${id}`).then((r) => r.data),
  create: (payload: AdminAccountCreatePayload) =>
    api.post<AdminAccountDetail>("/admin/accounts", payload).then((r) => r.data),
  update: (id: string, payload: AdminAccountUpdatePayload) =>
    api.patch<AdminAccountDetail>(`/admin/accounts/${id}`, payload).then((r) => r.data),
  remove: (id: string) =>
    api.delete(`/admin/accounts/${id}`).then(() => undefined),
};
