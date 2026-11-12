import { AdminCard } from "@/components/admin/AdminCard";

import { LeadsListView } from "./_components/LeadsListView";

/** 매장 관리 → 영업 기록(매장 영업 기록, 071). */
export default function AdminCollabLeadsPage() {
  return (
    <AdminCard>
      <LeadsListView />
    </AdminCard>
  );
}
