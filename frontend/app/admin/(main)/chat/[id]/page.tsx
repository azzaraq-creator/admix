import { Suspense } from "react";

import { AdminCard } from "@/components/admin/AdminCard";

import { ChatDetailView } from "./_components/ChatDetailView";

export default function AdminChatDetailPage() {
  return (
    <AdminCard>
      <Suspense fallback={null}>
        <ChatDetailView />
      </Suspense>
    </AdminCard>
  );
}
