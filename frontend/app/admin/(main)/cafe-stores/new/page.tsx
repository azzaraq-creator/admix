import { AdminCard } from "@/components/admin/AdminCard";

import { PartnersStoreFormView } from "../_components/PartnersStoreFormView";

export default function AdminPartnersStoreCreatePage() {
  return (
    <AdminCard>
      <PartnersStoreFormView mode="create" />
    </AdminCard>
  );
}
