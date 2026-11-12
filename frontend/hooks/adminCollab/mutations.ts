import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { AdminAdvCollabRequestDetail, BizAction } from "@/lib/adminCollab";
import type { PlanRoundPayload } from "@/lib/collabPlan";
import type {
  AdminCollabDetail,
  AdminCollabPayload,
  AdminPartnerMember,
  CollabPhotoStep,
  ParticipantStatus,
  StoreRequestStatus,
} from "@/lib/partners";

import { adminPartnersKeys } from "../adminPartners/keys";
import { adminCollabApi, type StoreTypePayload } from "./apis";
import { adminCollabKeys } from "./keys";

/** 회원 · 매장 연결이 바뀌면 매장 목록 · 숫자도 같이 다시 불러온다. */
function useMemberSaved() {
  const queryClient = useQueryClient();
  return (member: AdminPartnerMember) => {
    queryClient.setQueryData(adminCollabKeys.member(member.id), member);
    void queryClient.invalidateQueries({ queryKey: adminCollabKeys.all });
    void queryClient.invalidateQueries({ queryKey: adminPartnersKeys.all });
  };
}

/** 콜라보 상세를 돌려받는 처리 — 받은 값으로 바로 바꾸고 목록 · 숫자는 다시 불러온다. */
function useCollabSaved() {
  const queryClient = useQueryClient();
  return (detail: AdminCollabDetail) => {
    queryClient.setQueryData(adminCollabKeys.collab(detail.id), detail);
    void queryClient.invalidateQueries({
      queryKey: [...adminCollabKeys.all, "collabs"],
    });
    void queryClient.invalidateQueries({ queryKey: adminCollabKeys.summary() });
  };
}

/** 광고주 상호 · 사업자번호 저장 — 받은 상세로 바로 바꾸고 광고주 목록은 다시 불러온다. */
export const useUpdateAdvertiserBiz = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      bizName,
      bizNo,
    }: {
      id: string;
      bizName: string | null;
      bizNo: string | null;
    }) =>
      adminCollabApi.updateAdvertiserBiz(id, {
        business_name: bizName,
        business_registration_no: bizNo,
      }),
    onSuccess: (member) => {
      queryClient.setQueryData(adminCollabKeys.advertiser(member.id), member);
      void queryClient.invalidateQueries({
        queryKey: [...adminCollabKeys.all, "advertisers"],
      });
    },
  });
};

export const useBizAction = () => {
  const onSaved = useMemberSaved();
  return useMutation({
    mutationFn: ({
      id,
      action,
      reason,
    }: {
      id: string;
      action: BizAction;
      reason?: string | null;
    }) => adminCollabApi.bizAction(id, action, reason),
    onSuccess: onSaved,
  });
};

export const useUpdateCollabMember = () => {
  const onSaved = useMemberSaved();
  return useMutation({
    mutationFn: ({ id, phone }: { id: string; phone: string | null }) =>
      adminCollabApi.updateMember(id, { phone }),
    onSuccess: onSaved,
  });
};

export const useLinkStore = () => {
  const onSaved = useMemberSaved();
  return useMutation({
    mutationFn: ({ id, storeCode }: { id: string; storeCode: string }) =>
      adminCollabApi.linkStore(id, storeCode),
    onSuccess: onSaved,
  });
};

export const useUnlinkStore = () => {
  const onSaved = useMemberSaved();
  return useMutation({
    mutationFn: ({ id, storeId }: { id: string; storeId: string }) =>
      adminCollabApi.unlinkStore(id, storeId),
    onSuccess: onSaved,
  });
};

export const useUpdateStoreRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { status?: StoreRequestStatus; admin_reply?: string | null };
    }) => adminCollabApi.updateRequest(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminCollabKeys.all });
      void queryClient.invalidateQueries({ queryKey: adminPartnersKeys.all });
    },
  });
};

export const useSaveCollab = () => {
  const onSaved = useCollabSaved();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id?: string;
      payload: AdminCollabPayload;
    }) =>
      id
        ? adminCollabApi.updateCollab(id, payload)
        : adminCollabApi.createCollab(payload),
    onSuccess: onSaved,
  });
};

export const useDeleteCollab = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminCollabApi.deleteCollab(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: adminCollabKeys.collab(id) });
      void queryClient.invalidateQueries({ queryKey: adminCollabKeys.all });
    },
  });
};

export const useAddParticipant = () => {
  const onSaved = useCollabSaved();
  return useMutation({
    mutationFn: ({
      collabId,
      storeCode,
    }: {
      collabId: string;
      storeCode: string;
    }) => adminCollabApi.addParticipant(collabId, storeCode),
    onSuccess: onSaved,
  });
};

export const useBulkParticipantStatus = () => {
  const onSaved = useCollabSaved();
  return useMutation({
    mutationFn: ({
      collabId,
      ids,
      status,
    }: {
      collabId: string;
      ids: string[];
      status: ParticipantStatus;
    }) => adminCollabApi.bulkStatus(collabId, ids, status),
    onSuccess: onSaved,
  });
};

export const useUpdateParticipant = () => {
  const onSaved = useCollabSaved();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof adminCollabApi.updateParticipant>[1];
    }) => adminCollabApi.updateParticipant(id, payload),
    onSuccess: onSaved,
  });
};

export const useUploadParticipantPhoto = () => {
  const onSaved = useCollabSaved();
  return useMutation({
    mutationFn: ({
      participantId,
      step,
      file,
    }: {
      participantId: string;
      step: CollabPhotoStep;
      file: File;
    }) => adminCollabApi.uploadPhoto(participantId, step, file),
    onSuccess: onSaved,
  });
};

export const useDeleteParticipantPhoto = () => {
  const onSaved = useCollabSaved();
  return useMutation({
    mutationFn: (photoId: string) => adminCollabApi.deletePhoto(photoId),
    onSuccess: onSaved,
  });
};

/** 결과 보고서 파일 올리기(086) — 하나씩. 여러 개는 차례로 부른다. */
export const useUploadCollabReport = () => {
  const onSaved = useCollabSaved();
  return useMutation({
    mutationFn: ({ collabId, file }: { collabId: string; file: File }) =>
      adminCollabApi.uploadReport(collabId, file),
    onSuccess: onSaved,
  });
};

export const useDeleteCollabReport = () => {
  const onSaved = useCollabSaved();
  return useMutation({
    mutationFn: (fileId: string) => adminCollabApi.deleteReport(fileId),
    onSuccess: onSaved,
  });
};

export const useAddCollabNotice = () => {
  const onSaved = useCollabSaved();
  return useMutation({
    mutationFn: ({
      collabId,
      payload,
    }: {
      collabId: string;
      payload: { title: string; body: string; author?: string | null };
    }) => adminCollabApi.addNotice(collabId, payload),
    onSuccess: onSaved,
  });
};

export const useDeleteCollabNotice = () => {
  const onSaved = useCollabSaved();
  return useMutation({
    mutationFn: (noticeId: string) => adminCollabApi.deleteNotice(noticeId),
    onSuccess: onSaved,
  });
};

export const useUploadCollabImage = () =>
  useMutation({ mutationFn: (file: File) => adminCollabApi.uploadImage(file) });

/** 매장 유형 관리 — 유형 더하기 · 고치기 · 지우기. 매장 목록(유형 이름)도 같이 다시 불러온다. */
function useStoreTypesSaved() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({
      queryKey: adminCollabKeys.storeTypes(),
    });
    void queryClient.invalidateQueries({ queryKey: adminPartnersKeys.all });
  };
}

export const useCreateStoreType = () => {
  const onSaved = useStoreTypesSaved();
  return useMutation({
    mutationFn: (payload: StoreTypePayload) =>
      adminCollabApi.createStoreType(payload),
    onSuccess: onSaved,
  });
};

export const useUpdateStoreType = () => {
  const onSaved = useStoreTypesSaved();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: StoreTypePayload }) =>
      adminCollabApi.updateStoreType(id, payload),
    onSuccess: onSaved,
  });
};

export const useDeleteStoreType = () => {
  const onSaved = useStoreTypesSaved();
  return useMutation({
    mutationFn: (id: number) => adminCollabApi.deleteStoreType(id),
    onSuccess: onSaved,
  });
};

/** admix 기획안 보내기(085) — 받은 의뢰서로 바로 바꾸고 목록 · 사이드 메뉴 숫자는 다시 불러온다. */
export const useSendAdvRequestRound = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PlanRoundPayload }) =>
      adminCollabApi.sendAdvRequestRound(id, payload),
    onSuccess: (detail: AdminAdvCollabRequestDetail) => {
      queryClient.setQueryData(adminCollabKeys.advRequest(detail.id), detail);
      void queryClient.invalidateQueries({
        queryKey: [...adminCollabKeys.all, "advRequests"],
      });
      void queryClient.invalidateQueries({ queryKey: adminCollabKeys.summary() });
    },
  });
};
