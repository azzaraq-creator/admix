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
  CollabLeadLocation,
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
  /** location — 화면이 카카오 지도로 찾은 위치(없으면 서버가 주소로 찾는다, 11-12). */
  confirm: (id: string, location?: CollabLeadLocation | null) =>
    api
      .post<{
        lead: CollabLead;
        store: AdminPartnersStore;
      }>(
        `/admin/collab/leads/${encodeURIComponent(id)}/confirm`,
        location ?? undefined,
      )
      .then((r) => r.data),
  cancel: (id: string) =>
    api
      .post<{
        lead: CollabLead;
        storeCode: string;
      }>(`/admin/collab/leads/${encodeURIComponent(id)}/cancel`)
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
/** 협업 확정 매장 · 제휴사 회원 쪽 — 확정 · 취소 · 회원 연결(= 확정, 11-12)이 매장과 회원의 연결 매장을 바꾼다. */
function refreshStoreSide(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: adminPartnersKeys.all });
  void queryClient.invalidateQueries({
    queryKey: [...adminCollabKeys.all, "member"],
  });
  void queryClient.invalidateQueries({
    queryKey: [...adminCollabKeys.all, "members"],
  });
}

function useLeadSaved() {
  const queryClient = useQueryClient();
  return (lead: CollabLead) => {
    queryClient.setQueryData(collabLeadKeys.detail(lead.id), lead);
    void queryClient.invalidateQueries({
      queryKey: [...collabLeadKeys.all, "list"],
    });
    void queryClient.invalidateQueries({ queryKey: collabLeadKeys.meta() });
    refreshStoreSide(queryClient);
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

/** 협업 확정 — 협업 확정 매장(비공개)을 만들고 이 기록과 잇는다(076). 기록은 목록에 그대로 남는다(11-12). */
export const useConfirmCollabLead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      location,
    }: {
      id: string;
      location?: CollabLeadLocation | null;
    }) => collabLeadsApi.confirm(id, location),
    onSuccess: ({ lead }) => {
      queryClient.setQueryData(collabLeadKeys.detail(lead.id), lead);
      void queryClient.invalidateQueries({
        queryKey: [...collabLeadKeys.all, "list"],
      });
      void queryClient.invalidateQueries({ queryKey: collabLeadKeys.meta() });
      refreshStoreSide(queryClient);
    },
  });
};

/** 협업 취소(11-12) — 확정으로 만든 협업 확정 매장을 지우고 기록을 확정 전으로. 매장에 참여 · 수정 요청 기록이 있으면 서버가 막는다. */
export const useCancelCollabLead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => collabLeadsApi.cancel(id),
    onSuccess: ({ lead }) => {
      queryClient.setQueryData(collabLeadKeys.detail(lead.id), lead);
      void queryClient.invalidateQueries({
        queryKey: [...collabLeadKeys.all, "list"],
      });
      void queryClient.invalidateQueries({ queryKey: collabLeadKeys.meta() });
      refreshStoreSide(queryClient);
    },
  });
};
