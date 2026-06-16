import { Sidebar } from "../../_components/Sidebar";
import { MediaDetailContent } from "./_components/MediaDetailContent";

export default function MediaDetailPage() {
  return (
    <div className="flex h-screen w-full bg-white">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <MediaDetailContent />
      </main>
    </div>
  );
}
