import { AdminCard } from "@/components/admin/AdminCard";

import { PartnersStoreFormView } from "../../_components/PartnersStoreFormView";

/** 매장 수정 — 저장하거나 취소하면 매장 상세(../)로 돌아간다. */
export default function AdminPartnersStoreEditPage() {
  return (
    <AdminCard>
      <PartnersStoreFormView mode="edit" />
    </AdminCard>
  );
}
