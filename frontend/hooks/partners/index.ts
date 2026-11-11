"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";

import { useMe } from "@/hooks/auth";
import { api } from "@/lib/api";
import {
  type AdvertiserBrand,
  type AdvertiserBrandPayload,
  type PartnersStore,
  type StoreRequest,
  type StoreRequestPayload,
} from "@/lib/partners";
import type { PhotoStep, PreviewCollab } from "@/lib/partnersPreview";
import { canUsePartners } from "@/lib/memberCategory";

/** 매장 하나가 보는 콜라보 목록 — 서버 오늘(KST)과 함께. */
export interface StoreCollabs {
  today: string;
  items: PreviewCollab[];
}

/**
 * 콜라보 — /partners 대시보드 API(회원 토큰). 어드민은 hooks/adminPartners · hooks/adminCollab.
 * 매장 등록 · 수정은 어드민만(069) — 제휴사는 내 매장을 보고 "수정 요청"을 보낸다.
 */
export const partnersApi = {
  myStores: () =>
    api
      .get<{ items: PartnersStore[] }>("/partners/me/stores")
      .then((r) => r.data.items),
  /** 내 매장 수정 기록 — 보낸 요청과 처리 상태(마지막으로 바뀐 순). */
  storeRequests: (storeId: string) =>
    api
      .get<{ items: StoreRequest[] }>(`/partners/me/stores/${storeId}/requests`)
      .then((r) => r.data.items),
  /** 항목 하나의 새 값을 보낸다 — 같은 항목에 확인 중인 요청이 있으면 그 요청이 바뀐다. */
  createStoreRequest: (storeId: string, payload: StoreRequestPayload) =>
    api
      .post<StoreRequest>(`/partners/me/stores/${storeId}/requests`, payload)
      .then((r) => r.data),
  /** 모집 중인 콜라보 — 협약 전 · 매장 연결 전에도 본다(신청 정보 없음). */
  recruiting: () =>
    api.get<StoreCollabs>("/partners/collabs/recruiting").then((r) => r.data),
  /** 이 매장이 보는 콜라보 — 모집 중 + 참여한(했던) 콜라보와 매장 입장(standing). */
  storeCollabs: (storeId: string) =>
    api
      .get<StoreCollabs>("/partners/me/collabs", {
        params: { store_id: storeId },
      })
      .then((r) => r.data),
  applyCollab: (id: string, storeId: string) =>
    api
      .post<PreviewCollab>(`/partners/me/collabs/${id}/apply`, {
        store_id: storeId,
      })
      .then((r) => r.data),
  withdrawCollab: (id: string, storeId: string) =>
    api
      .post<PreviewCollab>(`/partners/me/collabs/${id}/withdraw`, {
        store_id: storeId,
      })
      .then((r) => r.data),
  confirmCollab: (
    id: string,
    storeId: string,
    confirmer: string,
    checkedItems: number,
  ) =>
    api
      .post<PreviewCollab>(`/partners/me/collabs/${id}/confirm`, {
        store_id: storeId,
        confirmer,
        checked_items: checkedItems,
      })
      .then((r) => r.data),
  uploadCollabPhoto: (
    id: string,
    storeId: string,
    step: PhotoStep,
    file: File,
  ) => {
    const form = new FormData();
    form.append("store_id", storeId);
    form.append("step", step);
    form.append("file", file);
    return api
      .post<PreviewCollab>(`/partners/me/collabs/${id}/photos`, form)
      .then((r) => r.data);
  },
  restockCollab: (id: string, storeId: string) =>
    api
      .post<PreviewCollab>(`/partners/me/collabs/${id}/restock`, {
        store_id: storeId,
      })
      .then((r) => r.data),
  readCollabNotice: (id: string, storeId: string, noticeId: string) =>
    api.post(`/partners/me/collabs/${id}/notices/${noticeId}/read`, {
      store_id: storeId,
    }),
  /** 기본협약 진행 상태 — 동의 전에 저장해 둔 곳(없으면 null). */
  agreementProgress: () =>
    api
      .get<{ progress: unknown }>("/partners/me/agreement/progress")
      .then((r) => r.data.progress ?? null),
  saveAgreementProgress: (progress: unknown) =>
    api.put("/partners/me/agreement/progress", { progress }),
  /** 기본협약 최종 동의 — 동의 시각 · 버전과 전자 서명(이름 · 구분 · 손 서명 PNG)을 남긴다(078). */
  agree: (payload: {
    version: string;
    signerName: string;
    signerRole: "representative" | "delegate";
    /** 손 서명 그림 — PNG data URL. */
    signature: string;
  }) =>
    api
      .post<{
        agreedAt: string;
        version: string;
        signerName: string | null;
        signerRole: string | null;
        signatureUrl: string | null;
      }>("/partners/me/agreement", {
        version: payload.version,
        signer_name: payload.signerName,
        signer_role: payload.signerRole,
        signature: payload.signature,
      })
      .then((r) => r.data),
  stores: (params: { keyword?: string; city?: string }) =>
    api
      .get<{ items: PartnersStore[] }>("/partners/stores", { params })
      .then((r) => r.data.items),
  store: (key: string) =>
    api
      .get<PartnersStore>(`/partners/stores/${encodeURIComponent(key)}`)
      .then((r) => r.data),
  /** 광고주 내 브랜드(068). */
  myBrands: () =>
    api
      .get<{ items: AdvertiserBrand[] }>("/partners/me/brands")
      .then((r) => r.data.items),
  createBrand: (payload: AdvertiserBrandPayload) =>
    api
      .post<AdvertiserBrand>("/partners/me/brands", payload)
      .then((r) => r.data),
  updateBrand: (id: string, payload: AdvertiserBrandPayload) =>
    api
      .patch<AdvertiserBrand>(`/partners/me/brands/${id}`, payload)
      .then((r) => r.data),
  deleteBrand: (id: string) => api.delete(`/partners/me/brands/${id}`),
  /** 브랜드 사진 올리기 — 받은 주소를 등록 · 수정에 담는다. */
  uploadBrandImage: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<{ url: string }>("/partners/brand-images", form)
      .then((r) => r.data.url);
  },
};

export const partnersKeys = {
  all: ["partners"] as const,
  mine: () => [...partnersKeys.all, "mine"] as const,
  stores: (params: { keyword?: string; city?: string }) =>
    [...partnersKeys.all, "stores", params] as const,
  store: (key: string) => [...partnersKeys.all, "store", key] as const,
  brands: () => [...partnersKeys.all, "brands"] as const,
  requests: (storeId: string) =>
    [...partnersKeys.all, "requests", storeId] as const,
  collabs: () => [...partnersKeys.all, "collabs"] as const,
  storeCollabs: (storeId: string) =>
    [...partnersKeys.collabs(), "store", storeId] as const,
  recruiting: () => [...partnersKeys.collabs(), "recruiting"] as const,
};

/** 광고주 내 브랜드 — 광고주만 받는다. */
export const useMyBrands = () => {
  const { data: me } = useMe();
  return useQuery({
    queryKey: partnersKeys.brands(),
    queryFn: partnersApi.myBrands,
    enabled: me?.member_category === "advertiser",
  });
};

/** 브랜드 등록(id 없음) · 고치기(id 있음). */
export const useSaveBrand = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id?: string;
      payload: AdvertiserBrandPayload;
    }) =>
      id
        ? partnersApi.updateBrand(id, payload)
        : partnersApi.createBrand(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: partnersKeys.brands() }),
  });
};

export const useDeleteBrand = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => partnersApi.deleteBrand(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: partnersKeys.brands() }),
  });
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

// ── 고른 매장 ─────────────────────────────────────────────────────────
// 한 회원이 매장 여러 곳(069) — 대시보드 · 내 매장 · 콜라보 참여 · 참여 이력이 같은 매장을 본다.
// 고른 매장은 이 브라우저(localStorage)에 남긴다. 없거나 내 매장이 아니면 첫 매장.

const PICKED_KEY = "admix:partner-store";
let picked: string | null | undefined;
const pickedListeners = new Set<() => void>();
const readPicked = () => {
  if (picked === undefined) {
    try {
      picked = localStorage.getItem(PICKED_KEY);
    } catch {
      picked = null;
    }
  }
  return picked;
};
const subscribePicked = (fn: () => void) => {
  pickedListeners.add(fn);
  return () => pickedListeners.delete(fn);
};
const setPicked = (id: string) => {
  picked = id;
  try {
    localStorage.setItem(PICKED_KEY, id);
  } catch {
    // 저장이 막혀 있으면 이 화면에서만.
  }
  pickedListeners.forEach((l) => l());
};

/** 내 매장들과 지금 고른 매장. */
export function useSelectedPartnerStore() {
  const stores = useMyPartnersStores();
  const pickedId = useSyncExternalStore(
    subscribePicked,
    readPicked,
    () => null,
  );
  const list = stores.data ?? [];
  const store = list.find((s) => s.id === pickedId) ?? list[0] ?? null;
  return {
    stores: list,
    store,
    setStore: setPicked,
    isPending: stores.isPending,
    isError: stores.isError,
  };
}

/** 고른 매장이 보는 콜라보(모집 중 + 참여한 콜라보). */
export function useStoreCollabs(storeId: string | null | undefined) {
  return useQuery({
    queryKey: partnersKeys.storeCollabs(storeId ?? ""),
    queryFn: () => partnersApi.storeCollabs(storeId!),
    enabled: Boolean(storeId),
  });
}

/** 모집 중인 콜라보 — 협약 전 · 매장 연결 전 대시보드. */
export function useRecruitingCollabs(enabled = true) {
  const { data: me } = useMe();
  return useQuery({
    queryKey: partnersKeys.recruiting(),
    queryFn: partnersApi.recruiting,
    enabled: enabled && me?.member_category === "partner",
  });
}

/**
 * 콜라보 동작(신청 · 신청 취소 · 확정 · 사진 · 재입고 · 공지 확인) — 응답(이 매장 입장으로 다시 그린 콜라보)을
 * 목록에 바로 바꿔 넣고, 다른 매장 목록 · 모집 목록은 다시 받는다.
 */
export function useCollabActions(storeId: string | null | undefined) {
  const queryClient = useQueryClient();
  const sid = storeId ?? "";
  const put = useCallback(
    (view: PreviewCollab) => {
      queryClient.setQueryData<StoreCollabs>(
        partnersKeys.storeCollabs(sid),
        (old) =>
          old && {
            ...old,
            items: view.title
              ? old.items.some((c) => c.id === view.id)
                ? old.items.map((c) => (c.id === view.id ? view : c))
                : [...old.items, view]
              : old.items,
          },
      );
      return queryClient.invalidateQueries({
        queryKey: partnersKeys.collabs(),
      });
    },
    [queryClient, sid],
  );
  const apply = useMutation({
    mutationFn: (id: string) => partnersApi.applyCollab(id, sid),
    onSuccess: put,
  });
  const withdraw = useMutation({
    mutationFn: (id: string) => partnersApi.withdrawCollab(id, sid),
    onSuccess: put,
  });
  const confirm = useMutation({
    mutationFn: (v: { id: string; confirmer: string; checked: number }) =>
      partnersApi.confirmCollab(v.id, sid, v.confirmer, v.checked),
    onSuccess: put,
  });
  const photo = useMutation({
    mutationFn: (v: { id: string; step: PhotoStep; file: File }) =>
      partnersApi.uploadCollabPhoto(v.id, sid, v.step, v.file),
    onSuccess: put,
  });
  const restock = useMutation({
    mutationFn: (id: string) => partnersApi.restockCollab(id, sid),
    onSuccess: put,
  });
  const readNotice = useMutation({
    mutationFn: (v: { id: string; noticeId: string }) =>
      partnersApi.readCollabNotice(v.id, sid, v.noticeId),
    onMutate: (v) =>
      queryClient.setQueryData<StoreCollabs>(
        partnersKeys.storeCollabs(sid),
        (old) =>
          old && {
            ...old,
            items: old.items.map((c) =>
              c.id === v.id
                ? {
                    ...c,
                    readNoticeIds: [
                      ...new Set([...(c.readNoticeIds ?? []), v.noticeId]),
                    ],
                  }
                : c,
            ),
          },
      ),
  });
  return { apply, withdraw, confirm, photo, restock, readNotice };
}

/** 내 매장 수정 기록. */
export function useStoreRequests(storeId: string | null | undefined) {
  return useQuery({
    queryKey: partnersKeys.requests(storeId ?? ""),
    queryFn: () => partnersApi.storeRequests(storeId!),
    enabled: Boolean(storeId),
  });
}

export function useCreateStoreRequest(storeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: StoreRequestPayload) =>
      partnersApi.createStoreRequest(storeId, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: partnersKeys.requests(storeId),
      }),
  });
}
