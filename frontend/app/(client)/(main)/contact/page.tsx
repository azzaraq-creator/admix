import { cookies } from "next/headers";

import { USER_TOKEN_COOKIE } from "@/lib/userToken";

import { ContactView } from "./_components/ContactView";

export default async function ContactPage() {
  const token = (await cookies()).get(USER_TOKEN_COOKIE)?.value;
  return (
    <main className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
      <ContactView member={!!token} />
    </main>
  );
}
