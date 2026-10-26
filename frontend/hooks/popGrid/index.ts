"use client";

import {
  keepPreviousData,
  useMutation,
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
 * · live 생활인구(월별 색 띠 툴팁의 인원 수)
 */
export type PopMetric = "flow" | "people" | "live" | "subway" | "walk";
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
    }
  >;
  updatedAt: string | null;
}

export interface PopGridUploadResult {
  ym: string;
  days: number;
  source: "handover" | "seoul-raw";
  metrics: string[];
  rows: number;
  totals: Record<string, number>;
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
};

export const popGridKeys = {
  all: ["pop-grid"] as const,
  cells: () => [...popGridKeys.all, "cells"] as const,
  months: () => [...popGridKeys.all, "months"] as const,
  values: (q: PopGridQuery) => [...popGridKeys.all, "values", q] as const,
  trend: (code: string | null, q: Omit<PopGridQuery, "months">) =>
    [...popGridKeys.all, "trend", code, q] as const,
  adminMonths: () => [...popGridKeys.all, "admin", "months"] as const,
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
