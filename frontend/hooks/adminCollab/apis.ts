import type { PlanFile, PlanRoundPayload } from "@/lib/collabPlan";
import { api } from "@/lib/api";
import type {
  AdminAdvertiserMember,
  AdvertiserBizAction,
  BizAction,
  AdminAdvCollabRequest,
  AdminAdvCollabRequestDetail,
  AdminCollabProgress,
  AdvCollabRequestListParams,
  CollabAdvertiserListParams,
  CollabCalendarItem,
  CollabListParams,
  CollabMemberListParams,
  CollabRequestListParams,
  MemberLogins,
  Paged,
} from "@/lib/adminCollab";
import type {
  AdminCollab,
  AdminCollabDetail,
  AdminCollabPayload,
  AdminPartnerMember,
  AdminStoreRequest,
  AgreementAction,
  CollabAdminSummary,
  CollabPhotoStep,
  ParticipantStatus,
  StoreRequestStatus,
  StoreType,
} from "@/lib/partners";

const enc = encodeURIComponent;

/** 매장 유형 저장 — 보낸 것만 바꾼다. */
export interface StoreTypePayload {
  name?: string;
  sort_order?: number;
}

/** 콜라보 어드민(/admin/collab/...) — 권한 "collab". 매장 등록 · 수정은 hooks/adminPartners. */
/** 어드민 제휴사 회원 정보 바꾸기(PATCH /admin/collab/members/{id}) — 보낸 칸만 바뀐다. */
export type UpdateMemberPayload = {
  phone?: string | null;
  marketing_sms?: boolean;
  marketing_email?: boolean;
};

export const adminCollabApi = {
  summary: () =>
    api.get<CollabAdminSummary>("/admin/collab/summary").then((r) => r.data),
  /** 브랜드 사진 — 받은 주소를 콜라보 저장에 담는다(서버가 긴 변 1200px 로 줄인다). */
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<{ url: string }>("/admin/collab/images", form)
      .then((r) => r.data.url);
  },

  // ── 매장 유형 관리(이름만, 070) ──
  storeTypes: () =>
    api.get<StoreType[]>("/admin/collab/store-types").then((r) => r.data),
  createStoreType: (payload: StoreTypePayload) =>
    api
      .post<StoreType>("/admin/collab/store-types", payload)
      .then((r) => r.data),
  updateStoreType: (id: number, payload: StoreTypePayload) =>
    api
      .patch<StoreType>(`/admin/collab/store-types/${id}`, payload)
      .then((r) => r.data),
  deleteStoreType: (id: number) =>
    api.delete(`/admin/collab/store-types/${id}`).then(() => undefined),

  // ── 제휴사 회원 ──
  members: (params?: CollabMemberListParams) =>
    api
      .get<Paged<AdminPartnerMember>>("/admin/collab/members", { params })
      .then((r) => r.data),
  member: (id: string) =>
    api
      .get<AdminPartnerMember>(`/admin/collab/members/${enc(id)}`)
      .then((r) => r.data),
  /** 로그인 기록(100) — 최근 것부터 100줄까지와 전체 개수. */
  memberLogins: (id: string) =>
    api
      .get<MemberLogins>(`/admin/collab/members/${enc(id)}/logins`)
      .then((r) => r.data),
  lookupMember: (code: string) =>
    api
      .get<AdminPartnerMember>("/admin/collab/members/lookup", {
        params: { code },
      })
      .then((r) => r.data),
  bizAction: (id: string, action: BizAction, reason?: string | null) =>
    api
      .post<AdminPartnerMember>(`/admin/collab/members/${enc(id)}/biz`, {
        action,
        reason: reason ?? null,
      })
      .then((r) => r.data),
  /** 기본협약 해지 · 해지 취소(096). */
  agreementAction: (id: string, action: AgreementAction) =>
    api
      .post<AdminPartnerMember>(`/admin/collab/members/${enc(id)}/agreement`, { action })
      .then((r) => r.data),
  bizFile: (id: string) =>
    api
      .get<Blob>(`/admin/collab/members/${enc(id)}/biz-file`, {
        responseType: "blob",
      })
      .then((r) => r.data),
  /** 관리자가 받은 사업자등록증을 대신 올린다(11-19) — 검토 대기가 되고, 확인한 뒤 인증 완료를 누른다. */
  uploadBizFile: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<AdminPartnerMember>(
        `/admin/collab/members/${enc(id)}/biz-file`,
        form,
      )
      .then((r) => r.data);
  },
  /** 회원 정보 바꾸기 — 연락처(숫자만 보내도, '-'를 넣어 보내도 서버가 숫자만 저장) · 마케팅 수신(11-25).
   *  마케팅은 받을 방법을 보낸다 — 하나라도 켜면 동의, 둘 다 끄면 비동의. */
  updateMember: (id: string, payload: UpdateMemberPayload) =>
    api
      .patch<AdminPartnerMember>(`/admin/collab/members/${enc(id)}`, payload)
      .then((r) => r.data),
  linkStore: (id: string, storeCode: string) =>
    api
      .post<AdminPartnerMember>(`/admin/collab/members/${enc(id)}/stores`, {
        store_code: storeCode,
      })
      .then((r) => r.data),
  unlinkStore: (id: string, storeId: string) =>
    api
      .delete<AdminPartnerMember>(
        `/admin/collab/members/${enc(id)}/stores/${enc(storeId)}`,
      )
      .then((r) => r.data),

  // ── 광고주 회원(읽기 전용, 11-10) ──
  advertisers: (params?: CollabAdvertiserListParams) =>
    api
      .get<Paged<AdminAdvertiserMember>>("/admin/collab/advertisers", {
        params,
      })
      .then((r) => r.data),
  advertiser: (id: string) =>
    api
      .get<AdminAdvertiserMember>(`/admin/collab/advertisers/${enc(id)}`)
      .then((r) => r.data),
  /** 광고주 상호 · 사업자번호 저장(11-11) — 빈 값은 지운다, 인증 상태는 그대로. */
  updateAdvertiserBiz: (
    id: string,
    payload: {
      business_name?: string | null;
      business_registration_no?: string | null;
    },
  ) =>
    api
      .patch<AdminAdvertiserMember>(
        `/admin/collab/advertisers/${enc(id)}/biz`,
        payload,
      )
      .then((r) => r.data),
  /** 광고주 사업자 인증(11-18) — 인증 완료 · 반려(사유) · 되돌리기. */
  advertiserBizAction: (
    id: string,
    action: AdvertiserBizAction,
    reason?: string | null,
  ) =>
    api
      .post<AdminAdvertiserMember>(`/admin/collab/advertisers/${enc(id)}/biz`, {
        action,
        reason: reason ?? null,
      })
      .then((r) => r.data),
  advertiserFile: (id: string, kind: "business-card" | "biz-file") =>
    api
      .get<Blob>(`/admin/collab/advertisers/${enc(id)}/${kind}`, {
        responseType: "blob",
      })
      .then((r) => r.data),
  /** 지난 반려 때 올렸던 사업자등록증(095). */
  advertiserRejectionFile: (id: string, rejectionId: string) =>
    api
      .get<Blob>(
        `/admin/collab/advertisers/${enc(id)}/biz-rejections/${enc(rejectionId)}/file`,
        { responseType: "blob" },
      )
      .then((r) => r.data),

  // ── 광고주 콜라보 의뢰(읽기, 081) ──
  advRequests: (params?: AdvCollabRequestListParams) =>
    api
      .get<Paged<AdminAdvCollabRequest>>("/admin/collab/collab-requests", {
        params,
      })
      .then((r) => r.data),
  /** 의뢰서 한 장 — 처음 열면 사이드 메뉴 숫자에서 빠진다. */
  advRequest: (id: string) =>
    api
      .get<AdminAdvCollabRequestDetail>(
        `/admin/collab/collab-requests/${enc(id)}`,
      )
      .then((r) => r.data),
  /** admix 기획안 보내기(085) — 항목별로 고친 내용 · 수정 이유. 그사이 광고주가 보냈으면 409. */
  sendAdvRequestRound: (id: string, payload: PlanRoundPayload) =>
    api
      .post<AdminAdvCollabRequestDetail>(
        `/admin/collab/collab-requests/${enc(id)}/rounds`,
        payload,
      )
      .then((r) => r.data),
  advRequestFile: (id: string) =>
    api
      .get<Blob>(`/admin/collab/collab-requests/${enc(id)}/plan-file`, {
        responseType: "blob",
      })
      .then((r) => r.data),
  /** 기획안 첨부 올리기(11-12) — 올려 두기만 한다. 기획안을 보낼 때 content.files 에 넣어야 광고주에게 간다. */
  uploadAdvRequestPlanFile: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<PlanFile>(
        `/admin/collab/collab-requests/${enc(id)}/plan-files`,
        form,
      )
      .then((r) => r.data);
  },
  /** 기획안 첨부 받기 — "request" 는 광고주 의뢰서 첨부. */
  advRequestPlanFile: (id: string, fileId: string) =>
    api
      .get<Blob>(
        `/admin/collab/collab-requests/${enc(id)}/plan-files/${enc(fileId)}`,
        { responseType: "blob" },
      )
      .then((r) => r.data),

  // ── 매장 수정 요청 ──
  requests: (params?: CollabRequestListParams) =>
    api
      .get<Paged<AdminStoreRequest>>("/admin/collab/requests", { params })
      .then((r) => r.data),
  updateRequest: (
    id: string,
    payload: { status?: StoreRequestStatus; admin_reply?: string | null },
  ) =>
    api
      .patch<AdminStoreRequest>(`/admin/collab/requests/${enc(id)}`, payload)
      .then((r) => r.data),

  // ── 콜라보 ──
  /** 대시보드 일정 달력 — start ~ end(YYYY-MM-DD)와 겹치는 콜라보. */
  calendar: (start: string, end: string) =>
    api
      .get<{ items: CollabCalendarItem[] }>("/admin/collab/calendar", {
        params: { start, end },
      })
      .then((r) => r.data.items),
  collabs: (params?: CollabListParams) =>
    api
      .get<Paged<AdminCollab>>("/admin/collab/collabs", { params })
      .then((r) => r.data),
  collabProgress: () =>
    api
      .get<{ items: AdminCollabProgress[] }>("/admin/collab/progress")
      .then((r) => r.data.items),
  collab: (id: string) =>
    api
      .get<AdminCollabDetail>(`/admin/collab/collabs/${enc(id)}`)
      .then((r) => r.data),
  createCollab: (payload: AdminCollabPayload) =>
    api
      .post<AdminCollabDetail>("/admin/collab/collabs", payload)
      .then((r) => r.data),
  updateCollab: (id: string, payload: AdminCollabPayload) =>
    api
      .patch<AdminCollabDetail>(`/admin/collab/collabs/${enc(id)}`, payload)
      .then((r) => r.data),
  deleteCollab: (id: string) => api.delete(`/admin/collab/collabs/${enc(id)}`),
  addParticipant: (collabId: string, storeCode: string) =>
    api
      .post<AdminCollabDetail>(
        `/admin/collab/collabs/${enc(collabId)}/participants`,
        { store_code: storeCode },
      )
      .then((r) => r.data),
  bulkStatus: (
    collabId: string,
    participantIds: string[],
    status: ParticipantStatus,
  ) =>
    api
      .post<AdminCollabDetail>(
        `/admin/collab/collabs/${enc(collabId)}/participants/status`,
        { participant_ids: participantIds, status },
      )
      .then((r) => r.data),
  updateParticipant: (
    participantId: string,
    payload: {
      status?: ParticipantStatus;
      confirmer?: string | null;
      restock_done?: boolean;
      admin_memo?: string | null;
    },
  ) =>
    api
      .patch<AdminCollabDetail>(
        `/admin/collab/participants/${enc(participantId)}`,
        payload,
      )
      .then((r) => r.data),
  uploadPhoto: (participantId: string, step: CollabPhotoStep, file: File) => {
    const form = new FormData();
    form.append("step", step);
    form.append("file", file);
    return api
      .post<AdminCollabDetail>(
        `/admin/collab/participants/${enc(participantId)}/photos`,
        form,
      )
      .then((r) => r.data);
  },
  deletePhoto: (photoId: string) =>
    api
      .delete<AdminCollabDetail>(`/admin/collab/photos/${enc(photoId)}`)
      .then((r) => r.data),
  // ── 결과 보고서 파일(086) ──
  uploadReport: (collabId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<AdminCollabDetail>(
        `/admin/collab/collabs/${enc(collabId)}/reports`,
        form,
      )
      .then((r) => r.data);
  },
  reportFile: (fileId: string) =>
    api
      .get<Blob>(`/admin/collab/reports/${enc(fileId)}/file`, {
        responseType: "blob",
      })
      .then((r) => r.data),
  deleteReport: (fileId: string) =>
    api
      .delete<AdminCollabDetail>(`/admin/collab/reports/${enc(fileId)}`)
      .then((r) => r.data),
  addNotice: (
    collabId: string,
    payload: { title: string; body: string; author?: string | null },
  ) =>
    api
      .post<AdminCollabDetail>(
        `/admin/collab/collabs/${enc(collabId)}/notices`,
        payload,
      )
      .then((r) => r.data),
  deleteNotice: (noticeId: string) =>
    api
      .delete<AdminCollabDetail>(`/admin/collab/notices/${enc(noticeId)}`)
      .then((r) => r.data),
};
