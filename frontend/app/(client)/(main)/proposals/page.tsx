import { Sidebar } from "../_components/Sidebar";
import { ProposalsView } from "./_components/ProposalsView";

export default async function ProposalsPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  const resolvedPlan = plan === "guest" || plan === "member" ? plan : undefined;
  return (
    <div className="flex h-screen w-full bg-white">
      <Sidebar />
      <main className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <ProposalsView plan={resolvedPlan} />
      </main>
    </div>
  );
}
