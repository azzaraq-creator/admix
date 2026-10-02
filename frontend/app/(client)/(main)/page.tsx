import { cookies } from "next/headers";

import { CHAT_ACTIVE_COOKIE } from "@/lib/session";

import { HomeContent } from "./_components/HomeContent";

export default async function HomePage() {
  // 믹시와 나눈 대화가 있으면 첫 화면부터 "대화를 불러오는 중"으로 그린다(검색 화면이 잠깐 보이지 않게).
  const chatActive = (await cookies()).get(CHAT_ACTIVE_COOKIE)?.value === "1";
  return (
    <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-black-50">
      <HomeContent chatActive={chatActive} />
    </main>
  );
}
