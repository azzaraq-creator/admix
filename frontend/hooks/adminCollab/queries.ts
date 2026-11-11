import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type {
  CollabAdvertiserListParams,
  CollabListParams,
  CollabMemberListParams,
  CollabRequestListParams,
} from "@/lib/adminCollab";

import { adminCollabApi } from "./apis";
import { adminCollabKeys } from "./keys";

/** 콜라보 어드민 첫 화면 숫자 — 사이드바 "수정 요청" 배지도 이것을 쓴다(권한 없으면 enabled=false). */
export const useCollabAdminSummary = (enabled = true) =>
  useQuery({
    queryKey: adminCollabKeys.summary(),
    queryFn: adminCollabApi.summary,
    staleTime: 30 * 1000,
    enabled,
  });

/** 매장 유형(카페 · 식당 …)과 유형별 매장 어필 · 조건 메모 값 — 매장 폼 · 매장 항목 화면. */
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

export const useCollabRequests =(params?: CollabRequestListParams) =>
  useQuery({
    queryKey: adminCollabKeys.requests(params),
    queryFn: () => adminCollabApi.requests(params),
    staleTime: 15 * 1000,
    placeholderData: keepPreviousData,
  });

export const useAdminCollabs = (params?: CollabListParams) =>
  useQuery({
    queryKey: adminCollabKeys.collabs(params),
    queryFn: () => adminCollabApi.collabs(params),
    staleTime: 15 * 1000,
    placeholderData: keepPreviousData,
  });

export const useAdminCollab = (id: string | null) =>
  useQuery({
    queryKey: adminCollabKeys.collab(id ?? ""),
    queryFn: () => adminCollabApi.collab(id as string),
    enabled: !!id,
  });
