import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  inquiriesApi,
  inquiriesClientApi,
  type InquiryCreatePayload,
} from "./apis";
import { inquiriesKeys } from "./keys";

export const useCreateInquiry = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: InquiryCreatePayload) =>
      inquiriesClientApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inquiriesKeys.myList() });
    },
  });
};

export const useAnswerInquiry = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, answer }: { id: string; answer: string }) =>
      inquiriesApi.answer(id, answer),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: inquiriesKeys.list() });
      qc.invalidateQueries({ queryKey: inquiriesKeys.detail(vars.id) });
    },
  });
};
