import { AdminCard } from "@/components/admin/AdminCard";

import { ResultListView } from "./_components/ResultListView";

/** 콜라보 결과 — 끝난(완료 · 취소) 콜라보와 결과 보고서(11-12 사용자). */
export default function AdminCollabResultsPage() {
  return (
    <AdminCard>
      <ResultListView />
    </AdminCard>
  );
}
