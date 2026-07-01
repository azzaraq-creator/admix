import { HelpView } from "./_components/HelpView";
import { HELP_TABS, type HelpTabKey } from "./content";

export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initialTab: HelpTabKey = HELP_TABS.some((t) => t.key === tab)
    ? (tab as HelpTabKey)
    : "terms";
  return <HelpView initialTab={initialTab} />;
}
