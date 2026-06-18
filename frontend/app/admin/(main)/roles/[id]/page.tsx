import { AdminCard } from "@/components/admin/AdminCard";

import { AccountFormView } from "../_components/AccountFormView";

export default function AdminRoleDetailPage() {
  return (
    <AdminCard>
      <AccountFormView mode="edit" />
    </AdminCard>
  );
}
