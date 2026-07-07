import { AdminCard } from "@/components/admin/AdminCard";

import { MediaFormView } from "../_components/MediaFormView";

export default function AdminMediaCreatePage() {
  return (
    <AdminCard>
      <MediaFormView mode="create" />
    </AdminCard>
  );
}
