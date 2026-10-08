import { useMutation, useQueryClient } from "@tanstack/react-query";

import { adminMediaApi, type AdminMediaPayload } from "./apis";
import { mediaKeys } from "./keys";

export const useBulkImportMedia = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => adminMediaApi.bulkImport(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: mediaKeys.list() }),
  });
};

export const useCreateMedia = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AdminMediaPayload) => adminMediaApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mediaKeys.list() });
      // 새 카테고리·등급 산정 방식이 다음 등록 때 선택지에 보이게.
      qc.invalidateQueries({ queryKey: mediaKeys.adminFieldOptions() });
    },
  });
};

export const useUpdateMedia = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AdminMediaPayload }) =>
      adminMediaApi.update(id, payload),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: mediaKeys.list() });
      qc.invalidateQueries({ queryKey: mediaKeys.adminDetail(vars.id) });
      qc.invalidateQueries({ queryKey: mediaKeys.adminFieldOptions() });
    },
  });
};

export const useDeleteMedia = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminMediaApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: mediaKeys.list() }),
  });
};

export const useUploadMediaImage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      adminMediaApi.uploadImage(id, file),
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: mediaKeys.adminDetail(vars.id) }),
  });
};

export const useDeleteMediaImage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, imageId }: { id: string; imageId: string }) =>
      adminMediaApi.deleteImage(id, imageId),
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: mediaKeys.adminDetail(vars.id) }),
  });
};

export const useSetMediaThumbnail = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, imageId }: { id: string; imageId: string }) =>
      adminMediaApi.setThumbnail(id, imageId),
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: mediaKeys.adminDetail(vars.id) }),
  });
};
