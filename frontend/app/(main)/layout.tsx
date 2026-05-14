import { CosmosBackground } from "@/components/cosmos/CosmosBackground";
import { Sidebar } from "@/components/cosmos/Sidebar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex h-screen">
      <CosmosBackground />
      <Sidebar />
      <main className="relative z-10 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
