import { AdminCard } from "@/components/admin/AdminCard";

import { CollabDetailView } from "../_components/CollabDetailView";

export default async function AdminCollabDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AdminCard>
      <CollabDetailView id={id} />
    </AdminCard>
  );
}
