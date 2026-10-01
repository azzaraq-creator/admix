import { cookies } from "next/headers";

import { USER_TOKEN_COOKIE } from "@/lib/userToken";

import { FavoritesView } from "./_components/FavoritesView";

export default async function FavoritesPage() {
  // 로그인 쿠키로 회원 여부를 미리 넘겨, 서버·브라우저 첫 화면이 같게(불러오는 중/비회원 안내) 그려지게 한다.
  const token = (await cookies()).get(USER_TOKEN_COOKIE)?.value;
  return (
    <main className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
      <FavoritesView member={!!token} />
    </main>
  );
}
