import { redirect } from "next/navigation";

/** 옛 주소 — /admin/collab/stores/new 로. */
export default function LegacyCafeStoreNewPage() {
  redirect("/admin/collab/stores/new");
}
