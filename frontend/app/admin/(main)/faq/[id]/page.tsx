import { AdminCard } from "@/components/admin/AdminCard";

import { FaqFormView } from "../_components/FaqFormView";

export default function AdminFaqDetailPage() {
  return (
    <AdminCard>
      <FaqFormView mode="edit" />
    </AdminCard>
  );
}
