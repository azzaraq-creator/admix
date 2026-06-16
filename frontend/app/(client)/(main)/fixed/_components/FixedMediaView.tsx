"use client";

import { useState } from "react";

import { ChevronLeftIcon } from "@/components/icons";
import { Sidebar } from "../../_components/Sidebar";
import { ChatPanel } from "./ChatPanel";
import { MapArea } from "./MapArea";

export function FixedMediaView() {
  const [chatOpen, setChatOpen] = useState(true);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-white">
      <MapArea
        className={`absolute inset-y-0 right-0 z-0 transition-[left] duration-300 ease-in-out ${
          chatOpen ? "left-[448px]" : "left-[64px]"
        }`}
      />

      <div className="absolute inset-y-0 left-0 z-10 flex">
        <Sidebar />
        {chatOpen && <ChatPanel />}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setChatOpen((open) => !open)}
            aria-label={chatOpen ? "채팅 패널 접기" : "채팅 패널 펼치기"}
            className="flex h-[44px] w-[22px] items-center justify-center rounded-r-[4px] border-y border-r border-stroke bg-white text-black"
          >
            <ChevronLeftIcon
              className={`size-[16px] transition-transform duration-300 ${
                chatOpen ? "" : "rotate-180"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
