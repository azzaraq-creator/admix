import { useMutation, useQueryClient } from "@tanstack/react-query";

import { adSessionsApi } from "@/hooks/adSessions/apis";
import { getSessionId, setSessionId } from "@/lib/session";

import { isMember, proposalsApi, proposalsClientApi } from "./apis";
import { proposalsKeys } from "./keys";

export const useClaimGuestProposals = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      const sid = getSessionId();
      if (!sid) return Promise.resolve({ claimed: 0 });
      return proposalsClientApi.claim(sid);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalsKeys.myList() });
    },
  });
};

/**
 * 비회원은 기획안을 대화 세션(session_id)에 묶어 저장하는데, 로그아웃하면 세션이 지워진다.
 * 세션 없이 만들기·담기를 하면 서버가 "session_id 가 필요합니다"로 거절하므로, 없으면 먼저 만든다.
 */
async function ensureGuestSession(): Promise<void> {
  if (isMember() || getSessionId()) return;
  const session = await adSessionsApi.create(null);
  setSessionId(session.id);
}

export const useCreateProposal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (title: string) => {
      await ensureGuestSession();
      return proposalsClientApi.create(title);
    },
    // 목록을 다시 받아 올 때까지 기다려(isPending 유지) 화면이 새 목록으로 바로 바뀌게 한다.
    onSuccess: () => qc.invalidateQueries({ queryKey: proposalsKeys.myList() }),
  });
};

export const useAddProposalItems = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      mediaIds,
      plans,
      months,
      productionCounts,
    }: {
      id: string;
      mediaIds: string[];
      plans?: Record<string, number>;
      /** {media_id: 개월 수} — 매체 정보 팝업에서 고른 값 */
      months?: Record<string, number>;
      /** {media_id: 제작 수} */
      productionCounts?: Record<string, number>;
    }) =>
      ensureGuestSession().then(() =>
        proposalsClientApi.addItems(id, mediaIds, plans, {
          months,
          productionCounts,
        }),
      ),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: proposalsKeys.myList() });
      qc.invalidateQueries({ queryKey: proposalsKeys.detail(id) });
    },
  });
};

export const useRemoveProposalItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mediaId }: { id: string; mediaId: string }) =>
      proposalsClientApi.removeItem(id, mediaId),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: proposalsKeys.myList() });
      qc.invalidateQueries({ queryKey: proposalsKeys.detail(id) });
    },
  });
};

export const useReorderProposal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      mediaIds,
      plans,
      dates,
      months,
      productionCounts,
    }: {
      id: string;
      mediaIds: string[];
      plans?: Record<string, number>;
      dates?: Record<
        string,
        { start_date: string | null; end_date: string | null }
      >;
      months?: Record<string, number>;
      productionCounts?: Record<string, number>;
    }) =>
      proposalsClientApi.reorder(id, mediaIds, plans, dates, undefined, {
        months,
        productionCounts,
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: proposalsKeys.detail(id) });
    },
  });
};

/**
 * 기획안에 담긴 매체의 상품·개월 수·제작 수만 바꾼다(현재 기획안 패널).
 * 순서 저장 API를 같이 쓰므로 지금 순서(mediaIds)를 그대로 넘긴다. 금액이 바뀌어 목록 합계도 다시 받는다.
 */
export const useUpdateProposalItemOptions = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      mediaIds,
      plans,
      months,
      productionCounts,
    }: {
      id: string;
      mediaIds: string[];
      plans?: Record<string, number>;
      months?: Record<string, number>;
      productionCounts?: Record<string, number>;
    }) =>
      proposalsClientApi.reorder(id, mediaIds, plans, undefined, undefined, {
        months,
        productionCounts,
      }),
    onSuccess: (detail, { id }) => {
      qc.setQueryData(proposalsKeys.detail(id), detail);
      qc.invalidateQueries({ queryKey: proposalsKeys.myList() });
    },
  });
};

export const useRenameProposal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      proposalsClientApi.rename(id, title),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: proposalsKeys.myList() });
      qc.invalidateQueries({ queryKey: proposalsKeys.detail(id) });
    },
  });
};

export const useDeleteProposal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => proposalsClientApi.remove(id),
    // 목록을 다시 받아 올 때까지 기다려(isPending 유지) 지운 기획안이 잠깐 남아 보이지 않게 한다.
    onSuccess: () => qc.invalidateQueries({ queryKey: proposalsKeys.myList() }),
  });
};

export const useSubmitProposal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => proposalsClientApi.submit(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: proposalsKeys.myList() });
      qc.invalidateQueries({ queryKey: proposalsKeys.detail(id) });
    },
  });
};

export const useUploadCounterProposal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      file,
      title,
    }: {
      id: string;
      file: File;
      title: string;
    }) => proposalsApi.uploadCounterProposal(id, file, title),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: proposalsKeys.adminDetail(id) });
    },
  });
};

export const useAcceptProposal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => proposalsApi.accept(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: proposalsKeys.adminDetail(id) });
      qc.invalidateQueries({ queryKey: proposalsKeys.list() });
    },
  });
};

export const useCancelSubmitProposal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => proposalsClientApi.cancelSubmit(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: proposalsKeys.myList() });
      qc.invalidateQueries({ queryKey: proposalsKeys.detail(id) });
    },
  });
};
