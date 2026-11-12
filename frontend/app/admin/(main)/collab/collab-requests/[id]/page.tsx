import { AdminCard } from "@/components/admin/AdminCard";

import { CollabRequestDocView } from "../_components/CollabRequestDocView";

export default async function AdminCollabRequestDocPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AdminCard>
      <CollabRequestDocView id={id} />
    </AdminCard>
  );
}
