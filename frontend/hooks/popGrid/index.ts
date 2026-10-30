"use client";

import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api } from "@/lib/api";

/**
 * 유동인구 격자 지도 — 서울 250m 격자의 월별 생활인구·체류인구·지하철·보행 (백엔드 routers/pop_grid.py).
 * 매체 찾기 지도의 "유동인구" 층과 어드민 "유동인구 데이터"가 쓴다.
 */

/**
 * flow 유동인구(종합 0~100점) · people 생활·체류인구(합친 0~100점) · subway 지하철 승하차 · walk 상권 보행(분기)
 * · live 생활인구(월별 색 띠 툴팁의 인원 수) · household 거주인구 — 행정동 주민등록 세대수(동마다 값 하나 — 그 동의 칸을 같은 값으로)
 */
export type PopMetric =
  "flow" | "people" | "live" | "household" | "subway" | "walk";
/** all 하루 전체 · am 출근 7~9시 · day 낮 10~16시 · pm 퇴근 17~19시 · night 야간 20~23시 */
export type PopBand = "all" | "am" | "day" | "pm" | "night";
export type PopSex = "all" | "M" | "F";
/** 10세 단위 — "60"은 60대 이상(70세 이상 포함). */
export type PopAge = "10" | "20" | "30" | "40" | "50" | "60";

export interface PopGridQuery {
  months: string[];
  metric: PopMetric;
  band: PopBand;
  sex: PopSex;
  ages: PopAge[];
}

/** [코드, 구, 동, [위도, 경도 ×4 — 왼아래·오른아래·오른위·왼위]] */
export type PopCell = [string, string, string, number[]];

export interface PopGridValues {
  months: string[];
  missingMonths: string[];
  metric: string;
  band: string;
  /** 성·연령이 실제로 걸렸는지 — 지하철·보행은 늘 false */
  filtered: boolean;
  smooth: boolean;
  /** 격자 순서, null = 자료 없음 */
  values: (number | null)[];
  /** 상위 40·20·10·5·1% 자리 값(작은 것부터) */
  breaks: number[];
  total: number;
  cellsWithData: number;
  /** 동 단위 자료(세대수) — 동마다 숫자를 적을 가운데 칸. 순위도 이 칸들로 센다. */
  labelCells?: number[];
}

export interface PopCellTrend {
  code: string;
  gu: string;
  dong: string;
  months: { ym: string; value: number | null }[];
}

export interface PopGridMonth {
  ym: string;
  metrics: string[];
}

export interface AdminPopGridMonth extends PopGridMonth {
  days: number;
  sources: Record<
    string,
    {
      source: "handover" | "seoul-raw";
      file?: string;
      files?: string[];
      uploaded_at?: string;
      by?: string;
      quarter?: string;
      fallback?: boolean;
      missingDays?: number[];
    }
  >;
  updatedAt: string | null;
}

export interface PopGridUploadResult {
  ym: string;
  days: number;
  /** zip에 없던 날(그 달 1일~말일 중) */
  missingDays: number[];
  /** 거주인구(새벽 3~5시)를 함께 넣었는지 */
  resident: boolean;
  source: "handover" | "seoul-raw";
  metrics: string[];
  rows: number;
  totals: Record<string, number>;
}

/** 어드민 — 들어 있는 행정동 세대수 달 */
export interface AdminHouseholdMonth {
  ym: string;
  dongs: number;
  total: number;
  file: string | null;
  by: string | null;
  updatedAt: string | null;
}

export interface HouseholdUploadResult {
  ym: string;
  dongs: number;
  total: number;
  /** 격자에 있는데 파일에 없는 동 */
  missingOnMap: string[];
  /** 파일에 있는데 격자 목록에 없는 동(지도에 안 나온다) */
  notOnMap: string[];
}

function queryString(q: PopGridQuery): string {
  const p = new URLSearchParams();
  q.months.forEach((m) => p.append("months", m));
  p.set("metric", q.metric);
  p.set("band", q.band);
  p.set("sex", q.sex);
  q.ages.forEach((a) => p.append("age", a));
  return p.toString();
}

export const popGridApi = {
  cells: () =>
    api.get<{ cells: PopCell[] }>("/pop-grid/cells").then((r) => r.data.cells),
  months: () =>
    api
      .get<{ months: PopGridMonth[] }>("/pop-grid/months")
      .then((r) => r.data.months),
  values: (q: PopGridQuery, signal?: AbortSignal) =>
    api
      .get<PopGridValues>(`/pop-grid/values?${queryString(q)}`, { signal })
      .then((r) => r.data),
  trend: (code: string, q: Omit<PopGridQuery, "months">) =>
    api
      .get<PopCellTrend>(
        `/pop-grid/cells/${encodeURIComponent(code)}/trend?${queryString({ ...q, months: [] })}`,
      )
      .then((r) => r.data),
  adminMonths: () =>
    api
      .get<{ months: AdminPopGridMonth[]; cellCount: number }>(
        "/admin/pop-grid/months",
      )
      .then((r) => r.data),
  adminUpload: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api
      .post<PopGridUploadResult>("/admin/pop-grid/upload", fd)
      .then((r) => r.data);
  },
  adminDelete: (ym: string) =>
    api.delete(`/admin/pop-grid/months/${ym}`).then((r) => r.data),
  adminHouseholds: () =>
    api
      .get<{ months: AdminHouseholdMonth[] }>("/admin/pop-grid/households")
      .then((r) => r.data.months),
  adminHouseholdUpload: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api
      .post<HouseholdUploadResult>("/admin/pop-grid/households/upload", fd)
      .then((r) => r.data);
  },
  /** 공공데이터포털 API에서 2025-01부터 빠진 달을 지금 받아 온다 */
  adminHouseholdSync: () =>
    api
      .post<{ added: string[]; months: AdminHouseholdMonth[] }>(
        "/admin/pop-grid/households/sync",
      )
      .then((r) => r.data),
  adminHouseholdDelete: (ym: string) =>
    api.delete(`/admin/pop-grid/households/${ym}`).then((r) => r.data),
};

export const popGridKeys = {
  all: ["pop-grid"] as const,
  cells: () => [...popGridKeys.all, "cells"] as const,
  months: () => [...popGridKeys.all, "months"] as const,
  values: (q: PopGridQuery) => [...popGridKeys.all, "values", q] as const,
  trend: (code: string | null, q: Omit<PopGridQuery, "months">) =>
    [...popGridKeys.all, "trend", code, q] as const,
  adminMonths: () => [...popGridKeys.all, "admin", "months"] as const,
  adminHouseholds: () => [...popGridKeys.all, "admin", "households"] as const,
};

/** 격자 8,617칸 모양 — 바뀌지 않아 한 번만 받는다(약 160KB). */
export const usePopGridCells = (enabled: boolean) =>
  useQuery({
    queryKey: popGridKeys.cells(),
    queryFn: popGridApi.cells,
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  });

export const usePopGridMonths = (enabled: boolean) =>
  useQuery({
    queryKey: popGridKeys.months(),
    queryFn: popGridApi.months,
    enabled,
    staleTime: 10 * 60 * 1000,
  });

/** 지도 한 장 — 조건을 바꾸는 동안 앞 지도를 그대로 두어 깜빡이지 않게. */
export const usePopGridValues = (q: PopGridQuery | null) =>
  useQuery({
    queryKey: popGridKeys.values(q as PopGridQuery),
    queryFn: ({ signal }) => popGridApi.values(q as PopGridQuery, signal),
    enabled: !!q && q.months.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 10 * 60 * 1000,
  });

export const usePopCellTrend = (
  code: string | null,
  q: Omit<PopGridQuery, "months">,
) =>
  useQuery({
    queryKey: popGridKeys.trend(code, q),
    queryFn: () => popGridApi.trend(code as string, q),
    enabled: !!code,
    placeholderData: keepPreviousData,
    staleTime: 10 * 60 * 1000,
  });

export const useAdminPopGridMonths = () =>
  useQuery({
    queryKey: popGridKeys.adminMonths(),
    queryFn: popGridApi.adminMonths,
  });

/** 올리거나 지우면 지도 쪽 값도 새로 받게 전부 무효화한다. */
export const useAdminPopGridUpload = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: popGridApi.adminUpload,
    onSuccess: () => qc.invalidateQueries({ queryKey: popGridKeys.all }),
  });
};

export const useAdminPopGridDelete = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: popGridApi.adminDelete,
    onSuccess: () => qc.invalidateQueries({ queryKey: popGridKeys.all }),
  });
};

export const useAdminHouseholds = () =>
  useQuery({
    queryKey: popGridKeys.adminHouseholds(),
    queryFn: popGridApi.adminHouseholds,
  });

export const useAdminHouseholdUpload = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: popGridApi.adminHouseholdUpload,
    onSuccess: () => qc.invalidateQueries({ queryKey: popGridKeys.all }),
  });
};

export const useAdminHouseholdDelete = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: popGridApi.adminHouseholdDelete,
    onSuccess: () => qc.invalidateQueries({ queryKey: popGridKeys.all }),
  });
};

export const useAdminHouseholdSync = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: popGridApi.adminHouseholdSync,
    onSuccess: () => qc.invalidateQueries({ queryKey: popGridKeys.all }),
  });
};

const valuesData = (rs: { data?: PopGridValues }[]) => rs.map((r) => r.data);

/** 겹쳐 볼 지도 여러 장 — 함께 고른 자료마다 한 장. 값은 아직 안 받은 것이 undefined. */
export const usePopGridValuesList = (qs: PopGridQuery[]) =>
  useQueries({
    queries: qs.map((q) => ({
      queryKey: popGridKeys.values(q),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        popGridApi.values(q, signal),
      staleTime: 10 * 60 * 1000,
    })),
    combine: valuesData,
  });

// ---------- 타깃 — 매체 찾기 "타깃" 버튼 목록(고르면 인구 분포 조건을 맞춘다). 어드민 "타깃 관리"에서 만든다.

export interface PopTarget {
  id: number;
  label: string;
  /** 첫 자료(칸 색 기준) */
  metric: PopMetric;
  /** 함께 겹쳐 볼 자료 */
  extras: PopMetric[];
  /** 성별·연령 — 생활인구에만 걸린다 */
  sex: PopSex;
  ages: PopAge[];
  sortOrder: number;
  isPublished: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
}

export type PopTargetInput = Pick<
  PopTarget,
  "label" | "metric" | "extras" | "sex" | "ages" | "sortOrder" | "isPublished"
>;

export const popTargetApi = {
  list: () =>
    api
      .get<{ targets: PopTarget[] }>("/pop-grid/targets")
      .then((r) => r.data.targets),
  adminList: () =>
    api
      .get<{ targets: PopTarget[] }>("/admin/pop-grid/targets")
      .then((r) => r.data.targets),
  adminCreate: (body: PopTargetInput) =>
    api.post<PopTarget>("/admin/pop-grid/targets", body).then((r) => r.data),
  adminUpdate: ({ id, ...body }: PopTargetInput & { id: number }) =>
    api
      .put<PopTarget>(`/admin/pop-grid/targets/${id}`, body)
      .then((r) => r.data),
  adminDelete: (id: number) =>
    api.delete(`/admin/pop-grid/targets/${id}`).then((r) => r.data),
};

// 격자 값(popGridKeys.all)과 따로 둔다 — 타깃을 고쳐도 지도 값을 다시 받지 않게.
export const popTargetKeys = {
  all: ["pop-targets"] as const,
  list: () => [...popTargetKeys.all, "list"] as const,
  adminList: () => [...popTargetKeys.all, "admin"] as const,
};

export const usePopTargets = () =>
  useQuery({
    queryKey: popTargetKeys.list(),
    queryFn: popTargetApi.list,
    staleTime: 10 * 60 * 1000,
  });

export const useAdminPopTargets = () =>
  useQuery({
    queryKey: popTargetKeys.adminList(),
    queryFn: popTargetApi.adminList,
  });

const useTargetMutation = <T>(fn: (v: T) => Promise<unknown>) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: popTargetKeys.all }),
  });
};

export const useAdminPopTargetCreate = () =>
  useTargetMutation(popTargetApi.adminCreate);
export const useAdminPopTargetUpdate = () =>
  useTargetMutation(popTargetApi.adminUpdate);
export const useAdminPopTargetDelete = () =>
  useTargetMutation(popTargetApi.adminDelete);
