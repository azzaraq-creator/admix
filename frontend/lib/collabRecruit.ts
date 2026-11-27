import type { AdminAdvCollabRequest } from "./adminCollab";
import type { PlanContent } from "./collabPlan";
import type { AdminCollab } from "./partners";

/** 매장 모집(어드민 "콜라보 관리 → 매장 모집", 2026-11-26 사용자) — GET /admin/collab/recruiting. */

/** 모집 시작 전 — 광고주가 확정했는데 아직 모집을 열지 않은 의뢰. content 는 확정한 기획안(마지막 차수). */
export interface RecruitReadyRow extends AdminAdvCollabRequest {
  content: PlanContent;
}

/** 모집 현황 — 모집 전 · 모집 중 · 선정 · 확정 중 콜라보. 의뢰에서 연 것이면 그 의뢰. */
export interface RecruitCollabRow extends AdminCollab {
  requestId: string | null;
  requestCode: string | null;
}

export interface RecruitBoard {
  ready: RecruitReadyRow[];
  collabs: RecruitCollabRow[];
}
