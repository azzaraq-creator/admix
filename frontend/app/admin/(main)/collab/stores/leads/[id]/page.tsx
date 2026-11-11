import { AdminCard } from "@/components/admin/AdminCard";

import { LeadFormView } from "../_components/LeadFormView";

export default async function AdminCollabLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AdminCard>
      <LeadFormView id={id} />
    </AdminCard>
  );
}
