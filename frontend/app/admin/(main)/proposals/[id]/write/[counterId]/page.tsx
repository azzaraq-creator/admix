import { CounterProposalDetailView } from "./_components/CounterProposalDetailView";

export default async function AdminCounterProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string; counterId: string }>;
}) {
  const { id, counterId } = await params;
  return <CounterProposalDetailView proposalId={id} counterId={counterId} />;
}
