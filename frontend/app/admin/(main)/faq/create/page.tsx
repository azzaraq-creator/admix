import { AdminCard } from "@/components/admin/AdminCard";

import { FaqFormView } from "../_components/FaqFormView";

export default function AdminFaqCreatePage() {
  return (
    <AdminCard>
      <FaqFormView mode="create" />
    </AdminCard>
  );
}
