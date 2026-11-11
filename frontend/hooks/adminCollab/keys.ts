import type {
  CollabAdvertiserListParams,
  CollabListParams,
  CollabMemberListParams,
  CollabRequestListParams,
} from "@/lib/adminCollab";

export const adminCollabKeys = {
  all: ["adminCollab"] as const,
  summary: () => [...adminCollabKeys.all, "summary"] as const,
  storeTypes: () => [...adminCollabKeys.all, "storeTypes"] as const,
  members: (params?: CollabMemberListParams) =>
    [...adminCollabKeys.all, "members", params ?? {}] as const,
  member: (id: string) => [...adminCollabKeys.all, "member", id] as const,
  lookup: (code: string) => [...adminCollabKeys.all, "lookup", code] as const,
  advertisers: (params?: CollabAdvertiserListParams) =>
    [...adminCollabKeys.all, "advertisers", params ?? {}] as const,
  advertiser: (id: string) =>
    [...adminCollabKeys.all, "advertiser", id] as const,
  requests: (params?: CollabRequestListParams) =>
    [...adminCollabKeys.all, "requests", params ?? {}] as const,
  collabs: (params?: CollabListParams) =>
    [...adminCollabKeys.all, "collabs", params ?? {}] as const,
  collab: (id: string) => [...adminCollabKeys.all, "collab", id] as const,
};
