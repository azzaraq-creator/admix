import { cookies } from "next/headers";

import { USER_TOKEN_COOKIE } from "@/lib/userToken";

import { PartnersStoreDetail } from "../../_components/PartnersStoreDetail";

export default async function PartnersStorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const member = !!(await cookies()).get(USER_TOKEN_COOKIE)?.value;
  return <PartnersStoreDetail storeKey={decodeURIComponent(id)} member={member} />;
}
