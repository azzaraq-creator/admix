import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { USER_TOKEN_COOKIE } from "@/lib/userToken";

import { InquiryDetailView } from "./_components/InquiryDetailView";

export default async function InquiryDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const token = (await cookies()).get(USER_TOKEN_COOKIE)?.value;
  if (!token) redirect("/contact");

  const { id } = await params;

  return (
    <main className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
      <div className="mx-auto flex w-full max-w-[1016px] flex-col px-[20px] pb-[40px] pt-[24px] sm:pt-[80px]">
        <InquiryDetailView id={id} />
      </div>
    </main>
  );
}
