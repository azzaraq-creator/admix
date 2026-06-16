"use client";

import Link from "next/link";
import { useState, type MouseEvent } from "react";

import {
  AirplayIcon,
  BusIcon,
  CircleAlertIcon,
  ColumnsToggleIcon,
  FolderIcon,
  HeadsetIcon,
  Logo,
  LogInIcon,
  MapIcon,
} from "./icons";

const MENU_ITEMS = [
  { key: "fixed", label: "고정 매체", Icon: MapIcon },
  { key: "moving", label: "이동·지역 매체", Icon: BusIcon },
  { key: "service", label: "서비스 소개", Icon: AirplayIcon },
  { key: "proposals", label: "내 제안서", Icon: FolderIcon },
  { key: "contact", label: "문의하기", Icon: HeadsetIcon },
] as const;

export function Sidebar() {
  const [expanded, setExpanded] = useState(false);

  const stop = (event: MouseEvent) => event.stopPropagation();
  const labelClass = `text-sm font-medium whitespace-nowrap transition-opacity duration-200 ${
    expanded ? "opacity-100" : "opacity-0"
  }`;

  return (
    <aside className="relative w-[64px] shrink-0">
      <nav
        onClick={() => setExpanded((value) => !value)}
        aria-label="사이드바"
        className={`absolute inset-y-0 left-0 z-30 flex h-screen cursor-pointer flex-col justify-between overflow-hidden border-r border-stroke bg-white px-[8px] py-[24px] transition-[width] duration-300 ease-in-out ${
          expanded ? "w-[224px]" : "w-[64px]"
        }`}
      >
        <div className="flex w-full items-center justify-between">
          <Link
            href="/"
            aria-label="홈"
            onClick={stop}
            className="flex items-center justify-center rounded-[8px] p-[12px]"
          >
            <Logo className="size-[24px]" />
          </Link>
          <button
            type="button"
            aria-label="사이드바 접기"
            className={`flex items-center justify-center rounded-[8px] p-[12px] text-black transition-opacity duration-200 ${
              expanded ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <ColumnsToggleIcon className="size-[24px]" />
          </button>
        </div>

        <ul className="flex w-full flex-col gap-[12px]">
          {MENU_ITEMS.map(({ key, label, Icon }) => (
            <li key={key}>
              <button
                type="button"
                aria-label={label}
                onClick={stop}
                className="flex w-full items-center gap-[6px] rounded-[8px] p-[12px] text-black hover:bg-secondary"
              >
                <Icon className="size-[24px] shrink-0" />
                <span className={labelClass}>{label}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="flex w-full flex-col gap-[12px]">
          <button
            type="button"
            aria-label="도움말"
            onClick={stop}
            className="flex w-full items-center gap-[6px] rounded-[8px] p-[12px] text-black hover:bg-secondary"
          >
            <CircleAlertIcon className="size-[24px] shrink-0" />
            <span className={labelClass}>도움말</span>
          </button>
          <button
            type="button"
            aria-label="로그인 / 회원가입"
            onClick={stop}
            className="flex w-full items-center gap-[6px] rounded-[8px] bg-primary p-[12px] text-white"
          >
            <LogInIcon className="size-[24px] shrink-0" />
            <span
              className={`text-base font-medium whitespace-nowrap transition-opacity duration-200 ${
                expanded ? "opacity-100" : "opacity-0"
              }`}
            >
              로그인 / 회원가입
            </span>
          </button>
        </div>
      </nav>
    </aside>
  );
}
