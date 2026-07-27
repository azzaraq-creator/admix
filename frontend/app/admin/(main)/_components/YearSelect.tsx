"use client";

import { useEffect, useRef, useState } from "react";

import { ChevronDownIcon } from "@/components/icons";

const YEARS = [2026];

export function YearSelect() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(YEARS[0]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-[40px] items-center gap-[6px] rounded-[8px] border border-stroke px-[12px] text-sm font-medium leading-[20px] text-[#364153]"
      >
        {selected}
        <ChevronDownIcon
          className={`size-[18px] text-disabled transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul className="absolute left-0 right-0 top-full z-10 overflow-hidden rounded-[8px] border border-stroke bg-white py-[4px] shadow-md">
          {YEARS.map((year) => (
            <li key={year}>
              <button
                type="button"
                onClick={() => {
                  setSelected(year);
                  setOpen(false);
                }}
                className={`flex w-full items-center px-[12px] py-[8px] text-sm leading-[20px] hover:bg-[#f5f6f8] ${
                  year === selected ? "font-medium text-[#364153]" : "text-disabled"
                }`}
              >
                {year}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
