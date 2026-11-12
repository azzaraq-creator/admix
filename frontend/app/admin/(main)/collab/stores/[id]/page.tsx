import { AdminCard } from "@/components/admin/AdminCard";

import { PartnersStoreDetailView } from "../_components/PartnersStoreDetailView";

/** 매장 상세 — 먼저 한 페이지로 보고, 고치려면 "수정"(→ ./edit). */
export default function AdminPartnersStoreDetailPage() {
  return (
    <AdminCard>
      <PartnersStoreDetailView />
    </AdminCard>
  );
}
