import { ProposalDetailView } from "./_components/ProposalDetailView";

export default async function ProposalDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  const resolvedPlan = plan === "guest" || plan === "member" ? plan : undefined;
  return <ProposalDetailView plan={resolvedPlan} />;
}
