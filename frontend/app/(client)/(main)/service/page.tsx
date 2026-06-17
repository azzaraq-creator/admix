import { Sidebar } from "../_components/Sidebar";
import { ServiceIntroView } from "./_components/ServiceIntroView";

export default function ServicePage() {
  return (
    <div className="flex h-screen w-full bg-white">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <ServiceIntroView />
      </main>
    </div>
  );
}
