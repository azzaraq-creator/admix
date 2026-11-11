import { AdminCard } from "@/components/admin/AdminCard";

import { CollabMemberDetailView } from "../_components/CollabMemberDetailView";

export default async function AdminCollabMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AdminCard>
      <CollabMemberDetailView id={id} />
    </AdminCard>
  );
}
