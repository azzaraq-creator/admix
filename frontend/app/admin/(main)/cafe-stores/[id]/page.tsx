import { AdminCard } from "@/components/admin/AdminCard";

import { PartnersStoreFormView } from "../_components/PartnersStoreFormView";

export default function AdminPartnersStoreDetailPage() {
  return (
    <AdminCard>
      <PartnersStoreFormView mode="edit" />
    </AdminCard>
  );
}
