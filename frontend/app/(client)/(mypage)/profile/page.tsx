import { MobileTopNav } from "../../(main)/_components/MobileTopNav";
import { Sidebar } from "../../(main)/_components/Sidebar";
import { ProfileView } from "./_components/ProfileView";

export default function ProfilePage() {
  return (
    <div className="flex h-dvh w-full bg-white">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopNav />
        <main className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
          <ProfileView />
        </main>
      </div>
    </div>
  );
}
