import { redirect } from "next/navigation";

/** 옛 주소 — 콜라보 매장은 콜라보 어드민(/admin/collab/stores)으로 옮겼다. */
export default function LegacyCafeStoresPage() {
  redirect("/admin/collab/stores");
}
