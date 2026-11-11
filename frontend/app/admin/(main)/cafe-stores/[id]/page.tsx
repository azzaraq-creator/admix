import { redirect } from "next/navigation";

/** 옛 주소 — /admin/collab/stores/{id} 로. */
export default async function LegacyCafeStoreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/collab/stores/${encodeURIComponent(id)}`);
}
