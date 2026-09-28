"use client";

import { Tabs } from "@heroui/react";
import { useEffect, useRef, useState } from "react";

import { MixieIcon } from "@/components/icons";

export type Mode = "ai" | "search";

const PILL_CLASS =
  "rounded-[13px] bg-white shadow-[1px_1px_4px_0px_rgba(0,0,0,0.1)]";

// 알약은 아래 useEffect가 위치를 잴 때까지만 탭 자체 배경으로 그려 둔다(자바스크립트
// 실행 전에도 선택 상태가 보이도록). 측정이 끝나면(data-pill-ready) 같은 자리에서
// 미끄러지는 알약이 이어받으므로 탭 배경은 지운다.
const TAB_CLASS =
  "h-[32px] w-auto rounded-[13px] py-[3px] text-sm font-normal whitespace-nowrap text-[#8c8c94] " +
  "data-[selected=true]:font-semibold data-[selected=true]:text-black-900 " +
  "data-[selected=true]:bg-white data-[selected=true]:shadow-[1px_1px_4px_0px_rgba(0,0,0,0.1)] " +
  "[[data-pill-ready]_&]:bg-transparent [[data-pill-ready]_&]:shadow-none";

// 선택 시 font-semibold로 바뀌면 글자 폭이 늘어나 탭·인디케이터가 매번 밀린다.
// 높이 0으로 감춘 굵은 글씨 복제본(::before)으로 항상 bold 기준 폭을 잡아 둔다.
const TAB_LABEL_CLASS =
  "inline-block before:invisible before:block before:h-0 before:overflow-hidden before:font-semibold before:content-[attr(data-label)]";

/** 홈 입력바 전송 버튼 왼쪽의 AI / 검색 전환 탭. 대화 중에도 언제든 검색으로 넘어갈 수 있다. */
export function ModeToggle({
  value,
  onChange,
}: {
  value: Mode;
  onChange: (mode: Mode) => void;
}) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  // 선택 표시(흰 알약)를 직접 그린다. HeroUI(react-aria) Tabs.Indicator는 미끄러지는
  // 연출을 위해 이전 인디케이터의 위치를 기억해 translate/width/height 인라인 스타일로
  // "출발 위치"를 잡는데, 최초 마운트가 CSS가 아직 안 먹은 레이아웃에서 측정되면
  // 어긋난 translate(예: 0 -9.75px)가 그대로 굳어 알약만 탭 위로 떠 보인다.
  // (한 번 굳으면 다음 전환에서 그 값을 다시 집어 재적용해 계속 남는다.)
  // 여기서는 매번 선택된 탭의 실제 위치를 다시 재므로 값이 굳을 일이 없다.
  useEffect(() => {
    const root = tabsRef.current;
    if (!root) return;

    const measure = () => {
      const tab = root.querySelector<HTMLElement>(`[data-key="${value}"]`);
      if (!tab) return;
      // offsetLeft/Width는 정수로 반올림돼 0.x px씩 어긋난다. 실제 값으로 잰다.
      const base = root.getBoundingClientRect();
      const rect = tab.getBoundingClientRect();
      setPill({
        x: rect.x - base.x,
        y: rect.y - base.y,
        w: rect.width,
        h: rect.height,
      });
    };

    measure();
    // 웹폰트가 늦게 적용되거나 창 폭이 바뀌어 탭 크기가 달라지면 다시 잰다.
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div
      ref={tabsRef}
      className="relative isolate"
      data-pill-ready={pill ? "" : undefined}
    >
      {pill && (
        <span
          aria-hidden
          className={`absolute top-0 left-0 z-[1] transition-[translate,width] duration-250 ease-out ${PILL_CLASS}`}
          style={{
            translate: `${pill.x}px ${pill.y}px`,
            width: pill.w,
            height: pill.h,
          }}
        />
      )}
      <Tabs
        className="gap-0"
        selectedKey={value}
        onSelectionChange={(key) => onChange(key as Mode)}
      >
        <Tabs.List
          aria-label="검색 모드"
          className="h-[40px] items-center rounded-[17px] bg-[#f1f1f3] p-[4px]"
        >
          <Tabs.Tab id="ai" className={`${TAB_CLASS} gap-[5px] px-[10px]`}>
            <MixieIcon className="size-[16.5px] shrink-0" />
            <span data-label="AI" className={TAB_LABEL_CLASS}>
              AI
            </span>
          </Tabs.Tab>
          <Tabs.Tab id="search" className={`${TAB_CLASS} px-[20px]`}>
            <span data-label="검색" className={TAB_LABEL_CLASS}>
              검색
            </span>
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>
    </div>
  );
}
