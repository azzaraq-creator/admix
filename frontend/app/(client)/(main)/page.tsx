import Image from "next/image";

import { HomeContent } from "./_components/HomeContent";

export default function HomePage() {
  return (
    <main className="relative flex flex-1 overflow-hidden">
      <Image src="" alt="" fill priority className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-[rgba(0,0,0,0.5)] to-[rgba(102,102,102,0.5)]" />
      <HomeContent />
    </main>
  );
}
