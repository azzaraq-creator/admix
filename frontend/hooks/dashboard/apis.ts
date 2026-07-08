import { api } from "@/lib/api";

export interface DashboardTodayTotal {
  today: number;
  total: number;
}

export interface DashboardInquiryMetric {
  today: number;
  week: number;
  month: number;
  total: number;
}

export interface DashboardResponse {
  members: DashboardTodayTotal;
  proposals: DashboardTodayTotal;
  inquiries: DashboardInquiryMetric;
  visitors: DashboardTodayTotal;
  proposalMonthly: number[];
  visitorMonthly: number[];
  year: number;
}

export const dashboardApi = {
  get: () => api.get<DashboardResponse>("/admin/dashboard").then((r) => r.data),
};
