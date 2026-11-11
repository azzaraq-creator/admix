import { AdminCard } from "@/components/admin/AdminCard";

import { CollabFormView } from "../../_components/CollabFormView";

export default async function AdminCollabEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AdminCard>
      <CollabFormView id={id} />
    </AdminCard>
  );
}
