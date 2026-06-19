import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  membersApi,
  type BizRegUpdatePayload,
  type MemberUpdatePayload,
} from "./apis";
import { membersKeys } from "./keys";

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
