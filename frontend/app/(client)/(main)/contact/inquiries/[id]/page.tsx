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
      {/* 문의하기 목록과 같은 여백. 글 읽기 좋은 폭(800px)까지, 화면 가운데에 둔다. */}
      <div className="mx-auto flex w-full max-w-[800px] flex-col px-[16px] py-[20px] sm:px-[20px]">
        <InquiryDetailView id={id} />
      </div>
    </main>
  );
}
