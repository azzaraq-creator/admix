import { Sidebar } from "../_components/Sidebar";
import { ContactView } from "./_components/ContactView";

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  const { member } = await searchParams;
  return (
    <div className="flex h-screen w-full bg-white">
      <Sidebar />
      <main className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <ContactView member={member === "1"} />
      </main>
    </div>
  );
}
