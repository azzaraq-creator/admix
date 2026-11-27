import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { BizLicenseParams } from "@/lib/bizLicense";

import { membersApi, type MemberListParams } from "./apis";
import { membersKeys } from "./keys";

export const useMembers = (params?: MemberListParams) =>
  useQuery({
    queryKey: membersKeys.list(params),
    queryFn: () => membersApi.list(params),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });

/** 사업자등록증 모아 보기(11-26) — 쪽을 넘기는 동안 앞 쪽을 그대로 보여 준다. */
export const useMemberBizLicenses = (params: BizLicenseParams) =>
  useQuery({
    queryKey: membersKeys.bizLicenses(params),
    queryFn: () => membersApi.bizLicenses(params),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
  });

export const useMember = (id: string | null) =>
  useQuery({
    queryKey: membersKeys.detail(id ?? ""),
    queryFn: () => membersApi.get(id as string),
    enabled: !!id,
  });
