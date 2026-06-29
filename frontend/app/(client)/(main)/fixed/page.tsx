import { FixedMediaView } from "./_components/FixedMediaView";

export default async function FixedMediaPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  return <FixedMediaView initialMode={mode === "search" ? "search" : "ai"} />;
}
