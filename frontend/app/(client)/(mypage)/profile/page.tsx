import { ProfileView } from "./_components/ProfileView";

export default function ProfilePage() {
  return (
    // 프로필 메뉴(드롭다운)에서 들어오면 포커스가 이 스크롤 영역에 놓여 테두리가 그려진다.
    // 버튼·입력칸이 아닌 영역이라 포커스 테두리는 끈다.
    // 회색 바탕(bg-gray-50)은 스크롤 영역 자체에 깐다 — 모바일은 끝에 탭 바 높이만큼 여백(globals.css의
    // --tabbar-space)이 붙는데, 바탕이 안쪽(ProfileView)에만 있으면 그 여백이 흰색으로 잘려 보인다.
    <main className="min-h-0 flex-1 overflow-y-auto bg-gray-50 outline-none [scrollbar-gutter:stable]">
      <ProfileView />
    </main>
  );
}
