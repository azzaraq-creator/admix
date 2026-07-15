import { Suspense } from "react";

import { AdminCard } from "@/components/admin/AdminCard";

import { MemberDetailView } from "./_components/MemberDetailView";

export default function AdminMemberDetailPage() {
  return (
    <AdminCard>
      <Suspense fallback={null}>
        <MemberDetailView />
      </Suspense>
    </AdminCard>
  );
}
