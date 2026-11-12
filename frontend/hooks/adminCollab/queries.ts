import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type {
  AdvCollabRequestListParams,
  CollabAdvertiserListParams,
  CollabListParams,
  CollabMemberListParams,
  CollabRequestListParams,
} from "@/lib/adminCollab";

import { adminCollabApi } from "./apis";
import { adminCollabKeys } from "./keys";

/** 콜라보 어드민 첫 화면 숫자 — 사이드바 "수정 요청" 배지도 이것을 쓴다(권한 없으면 enabled=false). */
/**
 * 콜라보 어드민 숫자(대시보드 · 사이드 메뉴 "수정 요청" 대기 수).
 * pollMs 를 주면 그 간격으로 다시 불러온다 — 사이드 메뉴는 화면을 열어 둔 사이 새로 온 요청 수도 보이게(11-11 사용자).
 * 창이 뒤에 있을 때는 쉬고(react-query 기본), 다시 앞으로 오면 바로 불러온다.
 */
export const useCollabAdminSummary = (enabled = true, pollMs?: number) =>
  useQuery({
    queryKey: adminCollabKeys.summary(),
    queryFn: adminCollabApi.summary,
    staleTime: 30 * 1000,
    enabled,
    refetchInterval: pollMs,
  });

/** 매장 유형(카페 · 식당 …)과 유형별 매장 어필 · 조건 메모 값 — 매장 폼 · 매장 유형 관리 화면. */
export const useStoreTypes = () =>
  useQuery({
    queryKey: adminCollabKeys.storeTypes(),
    queryFn: adminCollabApi.storeTypes,
    staleTime: 60 * 1000,
  });

export const useCollabMembers = (params?: CollabMemberListParams) =>
  useQuery({
    queryKey: adminCollabKeys.members(params),
    queryFn: () => adminCollabApi.members(params),
    staleTime: 15 * 1000,
    placeholderData: keepPreviousData,
  });

/** 회원 상세 — 현장에서 쓰므로 창으로 돌아오면 다시 불러온다(등록증을 막 올렸을 수 있다). */
export const useCollabMember = (id: string | null) =>
  useQuery({
    queryKey: adminCollabKeys.member(id ?? ""),
    queryFn: () => adminCollabApi.member(id as string),
    enabled: !!id,
    refetchOnWindowFocus: true,
  });

/** 고유번호로 회원 미리 보기 — 매장 연결 전 확인. 못 찾으면 오류(재시도 없음). */
export const useCollabMemberLookup = (code: string) =>
  useQuery({
    queryKey: adminCollabKeys.lookup(code),
    queryFn: () => adminCollabApi.lookupMember(code),
    enabled: code.length > 0,
    retry: false,
    staleTime: 30 * 1000,
  });

/** 광고주 회원(읽기 전용) — 콜라보 권한만 있는 관리자도 본다. */
export const useCollabAdvertisers = (params?: CollabAdvertiserListParams) =>
  useQuery({
    queryKey: adminCollabKeys.advertisers(params),
    queryFn: () => adminCollabApi.advertisers(params),
    staleTime: 15 * 1000,
    placeholderData: keepPreviousData,
  });

export const useCollabAdvertiser = (id: string | null) =>
  useQuery({
    queryKey: adminCollabKeys.advertiser(id ?? ""),
    queryFn: () => adminCollabApi.advertiser(id as string),
    enabled: !!id,
  });

/** 광고주 콜라보 의뢰 목록(081). */
export const useAdvCollabRequests = (params?: AdvCollabRequestListParams) =>
  useQuery({
    queryKey: adminCollabKeys.advRequests(params),
    queryFn: () => adminCollabApi.advRequests(params),
    staleTime: 15 * 1000,
    placeholderData: keepPreviousData,
  });

/** 의뢰서 한 장 — 처음 열면 서버가 '봄'으로 적는다. */
export const useAdvCollabRequest = (id: string | null) =>
  useQuery({
    queryKey: adminCollabKeys.advRequest(id ?? ""),
    queryFn: () => adminCollabApi.advRequest(id as string),
    enabled: !!id,
  });

export const useCollabRequests =(params?: CollabRequestListParams) =>
  useQuery({
    queryKey: adminCollabKeys.requests(params),
    queryFn: () => adminCollabApi.requests(params),
    staleTime: 15 * 1000,
    placeholderData: keepPreviousData,
  });

/**
 * 대시보드 콜라보 일정 달력(2026-11-12 사용자) — 보이는 6주와 겹치는 콜라보.
 * 키를 "collabs" 아래에 두어 콜라보를 만들거나 고치면(collabs 무효화) 달력도 다시 불러온다.
 */
export const useCollabCalendar = (start: string, end: string) =>
  useQuery({
    queryKey: adminCollabKeys.calendar(start, end),
    queryFn: () => adminCollabApi.calendar(start, end),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });

export const useAdminCollabs = (params?: CollabListParams) =>
  useQuery({
    queryKey: adminCollabKeys.collabs(params),
    queryFn: () => adminCollabApi.collabs(params),
    staleTime: 15 * 1000,
    placeholderData: keepPreviousData,
  });

/** 콜라보 진행 — 끝나지 않은 콜라보 전부(몇 개 안 돼 쪽 나눔 없이). */
export const useAdminCollabProgress = () =>
  useQuery({
    queryKey: adminCollabKeys.progress(),
    queryFn: adminCollabApi.collabProgress,
    staleTime: 15 * 1000,
  });

export const useAdminCollab = (id: string | null) =>
  useQuery({
    queryKey: adminCollabKeys.collab(id ?? ""),
    queryFn: () => adminCollabApi.collab(id as string),
    enabled: !!id,
  });
