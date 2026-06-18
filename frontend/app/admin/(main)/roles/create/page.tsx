import { AdminCard } from "@/components/admin/AdminCard";

import { AccountFormView } from "../_components/AccountFormView";

export default function AdminRoleCreatePage() {
  return (
    <AdminCard>
      <AccountFormView mode="create" />
    </AdminCard>
  );
}
