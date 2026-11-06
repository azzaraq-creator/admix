import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { AdminPartnersStorePayload } from "@/lib/partners";

import { adminPartnersApi } from "./apis";
import { adminPartnersKeys } from "./keys";

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
      id ? adminPartnersApi.update(id, payload) : adminPartnersApi.create(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: adminPartnersKeys.all }),
  });
};

export const useDeleteAdminPartnersStore = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminPartnersApi.remove(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: adminPartnersKeys.all }),
  });
};

export const useUploadAdminPartnersImage = () =>
  useMutation({ mutationFn: (file: File) => adminPartnersApi.uploadImage(file) });
