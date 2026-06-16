import { Sidebar } from "../_components/Sidebar";
import { MovingView } from "./_components/MovingView";

export default function MovingMediaPage() {
  return (
    <div className="flex h-screen w-full bg-white">
      <Sidebar />
      <MovingView />
    </div>
  );
}
