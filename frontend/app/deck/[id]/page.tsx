import fs from "fs/promises";
import path from "path";
import { notFound } from "next/navigation";
import PptDeckViewer, { type DeckSlide } from "@/components/common/PptDeckViewer";

interface DeckMeta {
  title?: string;
  totalSlides: number;
  slides: DeckSlide[];
}

export default async function DeckPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const metaPath = path.join(process.cwd(), "public", "decks", id, "meta.json");

  let meta: DeckMeta;
  try {
    const raw = await fs.readFile(metaPath, "utf-8");
    meta = JSON.parse(raw);
  } catch {
    notFound();
  }

  return (
    <div className="h-dvh w-screen">
      <PptDeckViewer deckId={id} slides={meta.slides} title={meta.title} />
    </div>
  );
}
