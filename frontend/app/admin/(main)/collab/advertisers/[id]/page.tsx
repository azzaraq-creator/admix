import { AdminCard } from "@/components/admin/AdminCard";

import { CollabAdvertiserDetailView } from "../_components/CollabAdvertiserDetailView";

export default async function AdminCollabAdvertiserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AdminCard>
      <CollabAdvertiserDetailView id={id} />
    </AdminCard>
  );
}
