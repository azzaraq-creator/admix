import { ProposalsView } from "./_components/ProposalsView";

export default async function ProposalsPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  const resolvedPlan = plan === "guest" || plan === "member" ? plan : undefined;
  return (
    <main className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
      <ProposalsView plan={resolvedPlan} />
    </main>
  );
}
