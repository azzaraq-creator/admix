import { AdminCard } from "@/components/admin/AdminCard";

import { CollabProgressView } from "./_components/CollabProgressView";

/** 콜라보 진행 — 끝나지 않은 콜라보(11-12 사용자, 예전 "콜라보 관리" 목록). 끝난 것은 /admin/collab/results. */
export default function AdminCollabsPage() {
  return (
    <AdminCard>
      <CollabProgressView />
    </AdminCard>
  );
}
