import { Sidebar } from "../../(main)/_components/Sidebar";
import { ProfileView } from "./_components/ProfileView";

export default function ProfilePage() {
  return (
    <div className="flex h-screen w-full bg-white">
      <Sidebar />
      <main className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <ProfileView />
      </main>
    </div>
  );
}
