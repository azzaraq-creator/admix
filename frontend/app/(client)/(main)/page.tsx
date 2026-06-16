import Image from "next/image";

import { HomeContent } from "./_components/HomeContent";
import { Sidebar } from "./_components/Sidebar";

export default function HomePage() {
  return (
    <div className="flex h-screen w-full">
      <Sidebar />
      <main className="relative flex flex-1 overflow-hidden">
        <Image
          src="/images/home-hero.png"
          alt=""
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(0,0,0,0.5)] to-[rgba(102,102,102,0.5)]" />
        <HomeContent />
      </main>
    </div>
  );
}
