import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { Paged } from "@/lib/adminCollab";
import type {
  CollabLead,
  CollabLeadListParams,
  CollabLeadMeta,
  CollabLeadPayload,
} from "@/lib/collabLeads";
import type { AdminPartnersStore } from "@/lib/partners";

import { adminPartnersKeys } from "../adminPartners/keys";
import { adminCollabKeys } from "./keys";

/** 콜라보 영업 DB(/admin/collab/leads, 071) — 가입 전 제휴사(매장) 영업 기록. 권한 "collab". */
export const collabLeadsApi = {
  meta: () =>
    api.get<CollabLeadMeta>("/admin/collab/leads/meta").then((r) => r.data),
  list: (params?: CollabLeadListParams) =>
    api
      .get<Paged<CollabLead>>("/admin/collab/leads", { params })
      .then((r) => r.data),
  get: (id: string) =>
    api
      .get<CollabLead>(`/admin/collab/leads/${encodeURIComponent(id)}`)
      .then((r) => r.data),
  create: (payload: CollabLeadPayload) =>
    api.post<CollabLead>("/admin/collab/leads", payload).then((r) => r.data),
  update: (id: string, payload: CollabLeadPayload) =>
    api
      .patch<CollabLead>(
        `/admin/collab/leads/${encodeURIComponent(id)}`,
        payload,
      )
      .then((r) => r.data),
  remove: (id: string) =>
    api.delete(`/admin/collab/leads/${encodeURIComponent(id)}`),
  confirm: (id: string) =>
    api
      .post<{
        lead: CollabLead;
        store: AdminPartnersStore;
      }>(`/admin/collab/leads/${encodeURIComponent(id)}/confirm`)
      .then((r) => r.data),
};

export const collabLeadKeys = {
  all: [...adminCollabKeys.all, "leads"] as const,
  meta: () => [...collabLeadKeys.all, "meta"] as const,
  list: (params?: CollabLeadListParams) =>
    [...collabLeadKeys.all, "list", params ?? {}] as const,
  detail: (id: string) => [...collabLeadKeys.all, "detail", id] as const,
};

/** 칸 설정 · 목록 조건 값 — 목록 · 상세가 같이 쓴다. */
export const useCollabLeadMeta = () =>
  useQuery({
    queryKey: collabLeadKeys.meta(),
    queryFn: collabLeadsApi.meta,
    staleTime: 60 * 1000,
  });

export const useCollabLeads = (params?: CollabLeadListParams) =>
  useQuery({
    queryKey: collabLeadKeys.list(params),
    queryFn: () => collabLeadsApi.list(params),
    placeholderData: keepPreviousData,
  });

export const useCollabLead = (id: string | null) =>
  useQuery({
    queryKey: collabLeadKeys.detail(id ?? ""),
    queryFn: () => collabLeadsApi.get(id as string),
    enabled: !!id,
  });

/** 저장하면 받은 값으로 상세를 바꾸고 목록 · 조건 값은 다시 불러온다. */
function useLeadSaved() {
  const queryClient = useQueryClient();
  return (lead: CollabLead) => {
    queryClient.setQueryData(collabLeadKeys.detail(lead.id), lead);
    void queryClient.invalidateQueries({
      queryKey: [...collabLeadKeys.all, "list"],
    });
    void queryClient.invalidateQueries({ queryKey: collabLeadKeys.meta() });
  };
}

export const useCreateCollabLead = () => {
  const onSaved = useLeadSaved();
  return useMutation({
    mutationFn: (payload: CollabLeadPayload) => collabLeadsApi.create(payload),
    onSuccess: onSaved,
  });
};

export const useUpdateCollabLead = () => {
  const onSaved = useLeadSaved();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CollabLeadPayload }) =>
      collabLeadsApi.update(id, payload),
    onSuccess: onSaved,
  });
};

export const useDeleteCollabLead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => collabLeadsApi.remove(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: collabLeadKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: collabLeadKeys.all });
    },
  });
};

/** 협업 확정 — 협업 확정 카페(비공개 매장)를 만들고 이 기록을 "협업 확정 전" 목록에서 뺀다(076). */
export const useConfirmCollabLead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => collabLeadsApi.confirm(id),
    onSuccess: ({ lead }) => {
      queryClient.setQueryData(collabLeadKeys.detail(lead.id), lead);
      void queryClient.invalidateQueries({
        queryKey: [...collabLeadKeys.all, "list"],
      });
      void queryClient.invalidateQueries({ queryKey: collabLeadKeys.meta() });
      void queryClient.invalidateQueries({ queryKey: adminPartnersKeys.all });
    },
  });
};
