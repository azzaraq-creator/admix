"use client";

import { ScrollShadow, Tabs } from "@heroui/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Footer } from "@/components/layout/Footer";
import { cn } from "@/lib/utils";

import { HELP_CONTENT, HELP_TABS, type HelpTabKey } from "../content";
import { parseTerms, TermsSectionBody } from "./TermsDocument";

// 목차에서 조로 이동할 때 조 제목 위에 남길 여백.
const SECTION_OFFSET = 24;

export function HelpView() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  // ?tab=이 없으면 이용약관이다. (처음 들어온 탭으로 되돌아가면, ?tab=location으로 들어와
  // 이용약관을 눌렀을 때 주소가 /help가 되며 다시 위치기반 약관으로 튕긴다.)
  const tab: HelpTabKey = HELP_TABS.some((t) => t.key === tabParam)
    ? (tabParam as HelpTabKey)
    : "terms";

  const articleRef = useRef<HTMLElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
    /** 탭 스크롤 영역(Tabs 바깥 틀 기준) — 알약을 이 안으로 잘라 넘친 탭 밖으로 삐져나오지 않게 한다. */
    clip: { x: number; y: number; w: number; h: number };
    /** 스크롤 영역 가장자리의 흐림(ScrollShadow 마스크) — 탭 글자와 같이 알약도 흐려지게 따라 쓴다. */
    mask: string;
    /** 탭을 바꿀 때만 미끄러지고, 스크롤·크기 변화는 바로 따라간다(늦게 쫓아오지 않게). */
    animate: boolean;
  } | null>(null);
  const scrolledOnce = useRef(false);

  // 선택된 탭의 위치를 재서 알약을 옮긴다. 웹폰트가 늦게 적용되거나 창 폭이 바뀌어
  // 탭 크기가 달라져도 다시 잰다(값이 굳지 않는다).
  // 좁은 화면(320px 등)에선 탭이 넘쳐 가로로 스크롤되므로(HeroUI ListContainer의 overflow —
  // 가장자리 흐림 + 좌우 화살표), 탭 목록이 스크롤될 때도 다시 재서 알약이 탭을 따라가게 한다.
  useEffect(() => {
    const root = tabsRef.current;
    // 알약 좌표의 기준은 알약이 들어 있는 Tabs 바깥 틀이다.
    const container = root?.querySelector<HTMLElement>(".tabs");
    const scroller = root?.querySelector<HTMLElement>(
      ".tabs__list-container__scroller",
    );
    if (!root || !container || !scroller) return;
    const measure = (animate: boolean) => {
      const el = root.querySelector<HTMLElement>(`[data-key="${tab}"]`);
      if (!el) return;
      const box = container.getBoundingClientRect();
      const area = scroller.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      setPill({
        x: rect.x - area.x,
        y: rect.y - area.y,
        w: rect.width,
        h: rect.height,
        clip: {
          x: area.x - box.x,
          y: area.y - box.y,
          w: area.width,
          h: area.height,
        },
        mask: getComputedStyle(scroller).maskImage,
        animate,
      });
    };

    // 선택된 탭이 스크롤 영역 밖(또는 가장자리 흐림·화살표 밑)에 있으면 보이는 곳까지 민다.
    // 처음 열 때(?tab=location로 들어온 경우 등)는 애니메이션 없이 바로 맞춘다.
    const el = root.querySelector<HTMLElement>(`[data-key="${tab}"]`);
    if (el && scroller.scrollWidth > scroller.clientWidth) {
      const EDGE = 28;
      const area = scroller.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      const delta =
        rect.left < area.left + EDGE
          ? rect.left - area.left - EDGE
          : rect.right > area.right - EDGE
            ? rect.right - area.right + EDGE
            : 0;
      if (delta)
        scroller.scrollBy({
          left: delta,
          behavior: scrolledOnce.current ? "smooth" : "auto",
        });
    }
    scrolledOnce.current = true;

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => measure(false));
    };
    measure(true);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(() => measure(false));
    observer.observe(root);
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [tab]);
  const sections = useMemo(() => parseTerms(HELP_CONTENT[tab], tab), [tab]);
  const articles = sections.filter((s) => s.num);
  const intro = sections.find((s) => !s.num);
  const [activeId, setActiveId] = useState<string | null>(null);

  // 탭은 URL(?tab=)에 남겨 새로고침·공유해도 같은 문서가 열린다. 페이지 이동 없이 주소만 바꾼다.
  const goTab = (key: HelpTabKey) => {
    window.history.replaceState(
      null,
      "",
      key === "terms" ? "/help" : `/help?tab=${key}`,
    );
  };

  // 문서가 바뀌면 본문을 맨 위로 되돌린다. (조 id에 탭 이름이 붙어 있어 이전 문서의
  // 목차 표시는 새 문서와 겹치지 않는다.)
  useEffect(() => {
    articleRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  // 본문을 스크롤하면 지금 읽는 조를 목차에 표시한다.
  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;
    const onScroll = () => {
      let current: string | null = null;
      for (const s of articles) {
        const el = document.getElementById(s.id);
        if (el && el.offsetTop - SECTION_OFFSET - 1 <= article.scrollTop)
          current = s.id;
      }
      setActiveId(current);
    };
    article.addEventListener("scroll", onScroll, { passive: true });
    return () => article.removeEventListener("scroll", onScroll);
  }, [articles]);

  // 목차 이동은 본문 카드 안에서만 스크롤한다(페이지 전체는 움직이지 않는다).
  // 좁은 화면은 본문이 페이지와 함께 흐르고 목차도 없어서 해당하지 않는다.
  const jumpTo = (id: string) => {
    const article = articleRef.current;
    const el = document.getElementById(id);
    if (!article || !el) return;
    article.scrollTo({
      top: el.offsetTop - SECTION_OFFSET,
      behavior: "smooth",
    });
  };

  return (
    <div className="min-w-0 flex-1 overflow-y-auto bg-black-50">
      <div className="mx-auto flex w-full max-w-[1016px] flex-col px-[16px] py-[16px] sm:px-[24px] sm:pt-[56px] sm:pb-[40px]">
        <header className="flex flex-col gap-[6px]">
          <h1 className="text-[18px] leading-[26px] font-bold text-black-900 sm:text-[26px] sm:leading-[34px]">
            약관 및 정책
          </h1>
          <p className="text-[12px] leading-[18px] text-black-500 max-sm:break-keep sm:text-[14px] sm:leading-[inherit]">
            ADMIXAI 서비스 이용과 개인정보·위치정보 처리에 관한 약관을 확인할 수
            있어요.
          </p>
        </header>

        {/* HeroUI Tabs 기본 모양 그대로 쓴다. 선택 알약만 직접 그린다 — Tabs.Indicator는
            미끄러지는 연출을 위해 잰 위치를 인라인 스타일로 들고 있는데, 새로고침 직후 잘못 잰 값
            (목록 전체 폭)이 굳어 다른 탭을 덮고 클릭까지 막는다. 여기서는 탭이 바뀔 때마다·크기가
            바뀔 때마다 선택된 탭의 실제 위치를 다시 재서 같은 모양(tabs__indicator)의 알약을 옮긴다. */}
        <div
          ref={tabsRef}
          className="mt-[16px] w-full sm:mt-[24px] sm:w-[480px]"
        >
          {/* 탭 목록은 스크롤 그림자(마스크) 층 안에 있어, 알약을 그 위에 겹치면 탭 글자까지 덮는다.
              그래서 목록 컨테이너의 회색 바탕(--default, 모서리 --radius×2.5 — HeroUI 값 그대로)을
              Tabs 바깥 틀로 옮기고, 알약은 그 바탕과 탭 목록 사이에 그린다. 겉모양은 기본과 같다. */}
          <Tabs
            selectedKey={tab}
            onSelectionChange={(key) => goTab(key as HelpTabKey)}
            className="relative w-full rounded-[calc(var(--radius)*2.5)] bg-(--default)"
          >
            {pill && (
              // 탭 스크롤 영역과 같은 자리·같은 흐림으로 잘라, 탭이 넘쳐 스크롤돼도 알약이
              // 회색 바탕 밖으로 삐져나오지 않고 탭 글자와 똑같이 가장자리에서 흐려진다.
              <span
                aria-hidden
                className="pointer-events-none absolute overflow-hidden"
                style={{
                  left: pill.clip.x,
                  top: pill.clip.y,
                  width: pill.clip.w,
                  height: pill.clip.h,
                  maskImage: pill.mask,
                  WebkitMaskImage: pill.mask,
                }}
              >
                <span
                  className="tabs__indicator z-auto"
                  style={{
                    translate: `${pill.x}px ${pill.y}px`,
                    width: pill.w,
                    height: pill.h,
                    transitionDuration: pill.animate ? undefined : "0ms",
                  }}
                />
              </span>
            )}
            <Tabs.ListContainer className="bg-transparent">
              <Tabs.List aria-label="약관 종류">
                {HELP_TABS.map(({ key, label }) => (
                  // 모양은 기본 그대로, 좁은 화면에서 이름이 두 줄로 꺾이지만 않게 한다.
                  // 알약을 그리기 전(자바스크립트 실행 전)엔 선택 탭을 글자색만으로 구분한다.
                  <Tabs.Tab
                    key={key}
                    id={key}
                    className="whitespace-nowrap max-sm:text-[12px]"
                  >
                    {label}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
        </div>

        {/* 넓은 화면: 목차와 본문이 화면 높이 안에서 각자 스크롤한다. */}
        <div className="mt-[16px] grid gap-[20px] sm:mt-[20px] lg:h-[calc(100dvh-236px)] lg:min-h-[480px] lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav
            aria-label="목차"
            className="hidden min-h-0 flex-col overflow-hidden rounded-[16px] border border-black-200 bg-white lg:flex"
          >
            <p className="shrink-0 px-[20px] pt-[12px] pb-[8px] text-[12px] font-semibold text-black-400">
              목차
            </p>
            {/* 목차가 길어 넘치면 넘치는 쪽 가장자리를 흐리게(HeroUI ScrollShadow) — 테두리는 바깥 nav에 둔다. */}
            <ScrollShadow
              size={24}
              className="flex min-h-0 flex-1 flex-col px-[12px] pb-[12px] [scrollbar-width:thin]"
            >
              {articles.map((s) => {
                const active = s.id === activeId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-current={active ? "location" : undefined}
                    onClick={() => jumpTo(s.id)}
                    className={cn(
                      "flex shrink-0 gap-[6px] rounded-[10px] px-[8px] py-[6px] text-left text-[13px] leading-[18px] transition-colors hover:bg-black-50 hover:text-black-900",
                      active
                        ? "bg-black-50 font-semibold text-black-900"
                        : "text-black-600",
                    )}
                  >
                    <span className="shrink-0 text-black-400">{s.num}</span>
                    <span className="min-w-0 break-keep">{s.title}</span>
                  </button>
                );
              })}
            </ScrollShadow>
          </nav>

          <article
            ref={articleRef}
            className="relative flex min-h-0 flex-col rounded-[20px] border border-black-200 bg-white p-[20px] sm:px-[36px] sm:py-[32px] lg:overflow-y-auto lg:[scrollbar-width:thin]"
          >
            {intro && (
              <div className="mb-[20px] shrink-0 rounded-[14px] bg-black-50 p-[14px] sm:mb-[24px] sm:px-[18px]">
                <TermsSectionBody section={intro} />
              </div>
            )}
            {articles.map((s, i) => (
              <section
                key={s.id}
                id={s.id}
                className={cn(
                  "shrink-0",
                  i > 0 &&
                    "mt-[20px] border-t border-black-100 pt-[20px] sm:mt-[24px] sm:pt-[24px]",
                )}
              >
                <h2 className="mb-[8px] flex flex-wrap items-baseline gap-x-[8px] text-[14px] leading-[20px] font-bold text-black-900 sm:mb-[10px] sm:text-[16px] sm:leading-[24px]">
                  <span className="text-black-400">{s.num}</span>
                  {s.title && <span>{s.title}</span>}
                </h2>
                <TermsSectionBody section={s} />
              </section>
            ))}
          </article>
        </div>
      </div>

      <Footer />
    </div>
  );
}
