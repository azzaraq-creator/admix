"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useMe } from "@/hooks/auth";
import { api } from "@/lib/api";
import { type PartnersStore, type PartnersStorePayload } from "@/lib/partners";
import { canUsePartners } from "@/lib/memberCategory";

/** 콜라보 — /partners 대시보드 API(회원 토큰). 어드민은 hooks/adminPartners. */
export const partnersApi = {
  myStores: () =>
    api
      .get<{ items: PartnersStore[] }>("/partners/me/stores")
      .then((r) => r.data.items),
  createStore: (payload: PartnersStorePayload) =>
    api.post<PartnersStore>("/partners/me/stores", payload).then((r) => r.data),
  updateStore: (id: string, payload: PartnersStorePayload) =>
    api
      .patch<PartnersStore>(`/partners/me/stores/${id}`, payload)
      .then((r) => r.data),
  deleteStore: (id: string) => api.delete(`/partners/me/stores/${id}`),
  /** 기본협약 진행 상태 — 동의 전에 저장해 둔 곳(없으면 null). */
  agreementProgress: () =>
    api
      .get<{ progress: unknown }>("/partners/me/agreement/progress")
      .then((r) => r.data.progress ?? null),
  saveAgreementProgress: (progress: unknown) =>
    api.put("/partners/me/agreement/progress", { progress }),
  /** 기본협약 최종 동의 — 동의 시각 · 버전을 남긴다. */
  agree: (version: string) =>
    api
      .post<{ agreedAt: string; version: string }>("/partners/me/agreement", {
        version,
      })
      .then((r) => r.data),
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<{ url: string }>("/partners/images", form)
      .then((r) => r.data.url);
  },
  stores: (params: { keyword?: string; city?: string }) =>
    api
      .get<{ items: PartnersStore[] }>("/partners/stores", { params })
      .then((r) => r.data.items),
  store: (key: string) =>
    api
      .get<PartnersStore>(`/partners/stores/${encodeURIComponent(key)}`)
      .then((r) => r.data),
};

export const partnersKeys = {
  all: ["partners"] as const,
  mine: () => [...partnersKeys.all, "mine"] as const,
  stores: (params: { keyword?: string; city?: string }) =>
    [...partnersKeys.all, "stores", params] as const,
  store: (key: string) => [...partnersKeys.all, "store", key] as const,
};

export const useMyPartnersStores = () => {
  const { data: me } = useMe();
  return useQuery({
    queryKey: partnersKeys.mine(),
    queryFn: partnersApi.myStores,
    enabled: me?.member_category === "partner",
  });
};

export const usePartnersStores = (params: {
  keyword?: string;
  city?: string;
}) => {
  const { data: me } = useMe();
  return useQuery({
    queryKey: partnersKeys.stores(params),
    queryFn: () => partnersApi.stores(params),
    enabled: canUsePartners(me?.member_category),
  });
};

export const usePartnersStore = (key: string) => {
  const { data: me } = useMe();
  return useQuery({
    queryKey: partnersKeys.store(key),
    queryFn: () => partnersApi.store(key),
    enabled: canUsePartners(me?.member_category),
    retry: false,
  });
};

export const useSavePartnersStore = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id?: string;
      payload: PartnersStorePayload;
    }) =>
      id
        ? partnersApi.updateStore(id, payload)
        : partnersApi.createStore(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: partnersKeys.all }),
  });
};

export const useDeletePartnersStore = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => partnersApi.deleteStore(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: partnersKeys.all }),
  });
};
