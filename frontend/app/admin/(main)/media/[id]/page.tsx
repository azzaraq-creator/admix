import { AdminCard } from "@/components/admin/AdminCard";

import { MediaFormView } from "../_components/MediaFormView";

export default function AdminMediaDetailPage() {
  return (
    <AdminCard>
      <MediaFormView mode="edit" />
    </AdminCard>
  );
}
