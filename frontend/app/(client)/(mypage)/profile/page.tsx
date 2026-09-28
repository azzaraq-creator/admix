import { ProfileView } from "./_components/ProfileView";

export default function ProfilePage() {
  return (
    // 프로필 메뉴(드롭다운)에서 들어오면 포커스가 이 스크롤 영역에 놓여 테두리가 그려진다.
    // 버튼·입력칸이 아닌 영역이라 포커스 테두리는 끈다.
    <main className="min-h-0 flex-1 overflow-y-auto outline-none [scrollbar-gutter:stable]">
      <ProfileView />
    </main>
  );
}
