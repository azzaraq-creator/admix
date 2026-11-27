import { AdminCard } from "@/components/admin/AdminCard";

import { RecruitBoardView } from "./_components/RecruitBoardView";

/** 매장 모집 — 확정한 의뢰를 바로 모집 시작 + 콜라보별 모집 현황(2026-11-26 사용자). */
export default function AdminCollabRecruitingPage() {
  return (
    <AdminCard>
      <RecruitBoardView />
    </AdminCard>
  );
}
