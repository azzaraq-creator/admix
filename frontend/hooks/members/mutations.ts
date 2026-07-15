import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  membersApi,
  type BizRegUpdatePayload,
  type MemberUpdatePayload,
  type SanctionPayload,
} from "./apis";
import { membersKeys } from "./keys";

const invalidateMember = (
  qc: ReturnType<typeof useQueryClient>,
  id: string,
) => {
  qc.invalidateQueries({ queryKey: membersKeys.list() });
  qc.invalidateQueries({ queryKey: membersKeys.detail(id) });
};

export const useUpdateMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: MemberUpdatePayload }) =>
      membersApi.update(id, payload),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: membersKeys.list() });
      qc.invalidateQueries({ queryKey: membersKeys.detail(vars.id) });
    },
  });
};

export const useUpdateBizReg = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: BizRegUpdatePayload }) =>
      membersApi.updateBizReg(id, payload),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: membersKeys.list() });
      qc.invalidateQueries({ queryKey: membersKeys.detail(vars.id) });
    },
  });
};

export const useCreateSanction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SanctionPayload }) =>
      membersApi.createSanction(id, payload),
    onSuccess: (_, vars) => invalidateMember(qc, vars.id),
  });
};

export const useUpdateSanction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      sanctionId,
      payload,
    }: {
      id: string;
      sanctionId: string;
      payload: SanctionPayload;
    }) => membersApi.updateSanction(id, sanctionId, payload),
    onSuccess: (_, vars) => invalidateMember(qc, vars.id),
  });
};

export const useDeleteSanction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, sanctionId }: { id: string; sanctionId: string }) =>
      membersApi.deleteSanction(id, sanctionId),
    onSuccess: (_, vars) => invalidateMember(qc, vars.id),
  });
};
