import { ProposalDetailView } from "./_components/ProposalDetailView";

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProposalDetailView id={id} />;
}
