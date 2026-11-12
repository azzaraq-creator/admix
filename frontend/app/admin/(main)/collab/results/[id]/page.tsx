import { AdminCard } from "@/components/admin/AdminCard";

import { CollabReportView } from "../_components/CollabReportView";

export default async function AdminCollabReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AdminCard>
      <CollabReportView id={id} />
    </AdminCard>
  );
}
