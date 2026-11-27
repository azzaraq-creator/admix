import type {
  AdvCollabRequestListParams,
  CollabAdvertiserListParams,
  CollabListParams,
  CollabMemberListParams,
  CollabRequestListParams,
} from "@/lib/adminCollab";
import type { BizLicenseParams } from "@/lib/bizLicense";

export const adminCollabKeys = {
  all: ["adminCollab"] as const,
  summary: () => [...adminCollabKeys.all, "summary"] as const,
  storeTypes: () => [...adminCollabKeys.all, "storeTypes"] as const,
  members: (params?: CollabMemberListParams) =>
    [...adminCollabKeys.all, "members", params ?? {}] as const,
  member: (id: string) => [...adminCollabKeys.all, "member", id] as const,
  bizLicenses: (params: BizLicenseParams) =>
    [...adminCollabKeys.all, "bizLicenses", params] as const,
  memberLogins: (id: string, page: number) =>
    [...adminCollabKeys.all, "memberLogins", id, page] as const,
  lookup: (code: string) => [...adminCollabKeys.all, "lookup", code] as const,
  advertisers: (params?: CollabAdvertiserListParams) =>
    [...adminCollabKeys.all, "advertisers", params ?? {}] as const,
  advertiser: (id: string) =>
    [...adminCollabKeys.all, "advertiser", id] as const,
  advRequests: (params?: AdvCollabRequestListParams) =>
    [...adminCollabKeys.all, "advRequests", params ?? {}] as const,
  advRequest: (id: string) =>
    [...adminCollabKeys.all, "advRequest", id] as const,
  requests: (params?: CollabRequestListParams) =>
    [...adminCollabKeys.all, "requests", params ?? {}] as const,
  collabs: (params?: CollabListParams) =>
    [...adminCollabKeys.all, "collabs", params ?? {}] as const,
  collab: (id: string) => [...adminCollabKeys.all, "collab", id] as const,
  calendar: (start: string, end: string) =>
    [...adminCollabKeys.all, "collabs", "calendar", start, end] as const,
  // "collabs" 아래 — 콜라보를 고치면(collabs 무효화) 진행 화면도 다시 불러온다.
  progress: () => [...adminCollabKeys.all, "collabs", "progress"] as const,
  // 매장 모집(11-26) — "collabs" 아래라 콜라보를 고치거나 모집을 열면 같이 다시 불러온다.
  recruitBoard: () => [...adminCollabKeys.all, "collabs", "recruiting"] as const,
};
