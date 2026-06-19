import { ContactView } from "./_components/ContactView";

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  const { member } = await searchParams;
  return (
    <main className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
      <ContactView member={member === "1"} />
    </main>
  );
}
