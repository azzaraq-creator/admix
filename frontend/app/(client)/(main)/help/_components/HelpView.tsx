"use client";

import { useState } from "react";

import { Footer } from "@/components/layout/Footer";

import { HELP_CONTENT, HELP_TABS, type HelpTabKey } from "../content";

export function HelpView({ initialTab }: { initialTab: HelpTabKey }) {
  const [tab, setTab] = useState<HelpTabKey>(initialTab);

  return (
    <div className="min-w-0 flex-1 overflow-y-auto">
      <div className="flex flex-col items-center px-[16px] py-[80px]">
        <div className="flex w-full max-w-[1016px] flex-col gap-[24px]">
          <h1 className="text-2xl font-semibold tracking-[-0.1px] text-black">
            도움말
          </h1>

          <div className="flex items-center border-b border-stroke py-[16px]">
            {HELP_TABS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`p-[10px] text-base font-semibold whitespace-nowrap ${
                  tab === key ? "text-primary" : "text-grey-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="whitespace-pre-wrap text-base font-medium text-black">
            {HELP_CONTENT[tab]}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
