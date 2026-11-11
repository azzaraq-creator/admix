import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { AdminPartnersStorePayload } from "@/lib/partners";

import { adminCollabKeys } from "../adminCollab/keys";
import { adminPartnersApi } from "./apis";
import { adminPartnersKeys } from "./keys";

/** 매장이 바뀌면 콜라보 어드민 숫자 · 회원(매장 수)도 다시 불러온다. */
const invalidateAll = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: adminPartnersKeys.all });
  void queryClient.invalidateQueries({ queryKey: adminCollabKeys.all });
};

/** 매장 저장 — id 가 있으면 수정, 없으면 등록. 매체 찾기 줄도 서버에서 함께 맞춰진다. */
export const useSaveAdminPartnersStore = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id?: string;
      payload: AdminPartnersStorePayload;
    }) =>
      id
        ? adminPartnersApi.update(id, payload)
        : adminPartnersApi.create(payload),
    onSuccess: () => invalidateAll(queryClient),
  });
};

export const useDeleteAdminPartnersStore = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminPartnersApi.remove(id),
    onSuccess: () => invalidateAll(queryClient),
  });
};

export const useUploadAdminPartnersImage = () =>
  useMutation({
    mutationFn: (file: File) => adminPartnersApi.uploadImage(file),
  });
