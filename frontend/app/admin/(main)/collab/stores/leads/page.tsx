import { AdminCard } from "@/components/admin/AdminCard";

import { LeadsListView } from "./_components/LeadsListView";

/** 매장 관리 → 협업 확정 전(가입 전 매장 영업 기록, 071). */
export default function AdminCollabLeadsPage() {
  return (
    <AdminCard>
      <LeadsListView />
    </AdminCard>
  );
}
