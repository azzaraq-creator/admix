"use client";

import { Tabs } from "@heroui/react";
import { useRouter } from "next/navigation";

export const STORES_HREF = "/admin/collab/stores";
export const LEADS_HREF = "/admin/collab/stores/leads";

const TABS = [
  { key: "stores", label: "협업 확정 매장", href: STORES_HREF },
  { key: "leads", label: "영업 기록", href: LEADS_HREF },
] as const;

type StoresTab = (typeof TABS)[number]["key"];

/**
 * 콜라보 어드민 "매장 관리" 안의 두 목록 — 어드민이 등록한 매장(협업 확정 매장, 11-12까지 "협업 확정 카페")과 매장 영업 기록(영업 기록, 071 — 11-12 "협업 확정 전"에서 이름 바꿈, 확정해도 남는다).
 * 사이드바는 "매장 관리" 하나로 두고 화면 위에서 오간다(2026-11-10 사용자: 영업 DB 를 매장 화면에서 보이게).
 */
export function StoresTabs({ current }: { current: StoresTab }) {
  const router = useRouter();
  return (
    <Tabs
      selectedKey={current}
      onSelectionChange={(key) => {
        const tab = TABS.find((t) => t.key === key);
        if (tab && tab.key !== current) router.push(tab.href);
      }}
    >
      <Tabs.ListContainer className="w-fit rounded-[17px]">
        <Tabs.List aria-label="매장 목록">
          {TABS.map((tab) => (
            <Tabs.Tab
              key={tab.key}
              id={tab.key}
              className="rounded-[13px] whitespace-nowrap"
            >
              {tab.label}
              {/* 화면이 바뀌는 탭이라 미끄러지는 표시가 필요 없다. 두 번째 탭으로 열면 React Aria 가
                  처음 탭 자리에서 옮겨 오는 translate 를 남긴 채 멈춰(첫 탭 글자를 덮음) 자리에 고정한다. */}
              <Tabs.Indicator className="rounded-[13px] [translate:none]!" />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  );
}
