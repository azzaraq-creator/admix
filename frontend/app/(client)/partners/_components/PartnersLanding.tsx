"use client";

import Link from "next/link";
import { Button } from "@heroui/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";

import {
  COLLAB_SIGNUP_HREF,
  PARTNER_SIGNUP_HREF,
} from "@/app/(client)/(auth)/signup/_components/CategoryStep";
import { collabScript } from "@/app/(client)/(main)/_components/collabFont";
import { PartnersCardDetails } from "@/components/common/PartnersCardDetails";
import {
  ChevronLeftIcon,
  ChevronRightBoldIcon,
  ChevronRightIcon,
  LocationFilledIcon,
  LoveIcon,
  SmallCheckIcon,
} from "@/components/icons";
import { useMe } from "@/hooks/auth";
import { canUsePartners } from "@/lib/memberCategory";
import {
  PARTNERS_DASHBOARD_HREF,
  PARTNERS_MEDIA_CATEGORY,
} from "@/lib/partners";
import { cn } from "@/lib/utils";

import { maskIcon } from "./partnersNav";

/*
 * /partners 소개 — 비회원 · 콜라보를 못 쓰는 회원(일반 · 대행사 · 매체사), ?intro=1 이면 누구나.
 * 2026-11-12 사용자: "소개 페이지 다시 만들어 줘, 대상은 제휴사만이 아니라 광고주와 제휴사" — 두 회원 모두에게 말한다.
 *   위 소개(가입 버튼 둘) 아래에서 광고주 · 매장 카드 → 진행 순서(단계마다 누가 하는지) → 화면 미리 보기를 좌우로 넘겨 본다(SlideDeck).
 * 모양은 제휴사 가입 소개(PartnerJoin)와 같은 말투 — 옅은 보라 빛 위에 흰 유리 카드, 진한 보라는 제목 끝 점 · 버튼 hover 에만.
 * 진행 순서만 카드 없이 점선으로 잇는 흐름 — 위아래 흰 카드와 다르게(11-12 사용자).
 * 문구는 지금 화면 · 기본협약에 있는 것만 옮겼다(금액 · 기간 같은 조건을 지어내지 않는다).
 */

/** 콜라보 가입 1단계에 유형을 골라 둔다 — 광고주 · 제휴사(콜라보) 모두 바로 회원가입으로(11-12 사용자). */
const ADVERTISER_SIGNUP_HREF = `${COLLAB_SIGNUP_HREF}&category=advertiser`;

const MegaphoneIcon = maskIcon("/icons/megaphone.svg");
const StoreIcon = maskIcon("/icons/store.svg");

type Role = "advertiser" | "partner";
type Actor = Role | "admix";

const ROLES: {
  id: Role;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  title: string;
  points: string[];
  cta: { label: string; href: string };
}[] = [
  {
    id: "advertiser",
    label: "광고주",
    Icon: MegaphoneIcon,
    title: "매장에서 브랜드를 알리고 싶다면",
    points: [
      "admix가 확인한 매장을 사진 · 등급 · 금액으로 비교해요",
      "콜라보 구성과 기간을 정해 의뢰하면 admix가 기획안으로 다듬어요",
      "제작 대행 · 설치부터 결과 보고서까지 한 화면에서 챙겨요",
    ],
    cta: { label: "광고주로 시작하기", href: ADVERTISER_SIGNUP_HREF },
  },
  {
    id: "partner",
    label: "매장(제휴사)",
    Icon: StoreIcon,
    title: "우리 매장 공간으로 협업하고 싶다면",
    points: [
      "등록비 · 이용료 없이 시작해요",
      "매장 사진 · 정보는 admix 담당자가 등록해 드려요",
      "새 콜라보마다 참여할지 직접 골라요",
    ],
    cta: { label: "제휴사로 시작하기", href: PARTNER_SIGNUP_HREF },
  },
];

/** 진행 순서 — 단계마다 누가 하는지(광고주 · admix · 매장) 칩으로. */
const FLOW: { title: string; who: Actor[]; body: string }[] = [
  {
    title: "의뢰",
    who: ["advertiser"],
    body: "콜라보 구성 · 기간 · 원하는 매장을 담아 의뢰해요.",
  },
  {
    title: "기획안",
    who: ["admix"],
    body: "의뢰를 검토해 기획안을 보내요. 광고주가 확인하면 확정돼요.",
  },
  {
    title: "매장 모집",
    who: ["partner"],
    body: "모집이 열리면 매장이 참여 여부를 골라 선착순으로 신청해요.",
  },
  {
    title: "매장 확정",
    who: ["advertiser", "partner"],
    body: "광고주가 신청 매장을 살펴보고, 매장이 최종 확정해요.",
  },
  {
    title: "진행",
    who: ["admix", "partner"],
    body: "준비 · 설치를 마치면 콜라보가 열리고, 중간 보고로 상황을 알려요.",
  },
  {
    title: "결과 보고",
    who: ["admix"],
    body: "철수 뒤 결과 보고서로 콜라보를 마무리해요.",
  },
];

const ACTOR: Record<Actor, { label: string; className: string }> = {
  advertiser: { label: "광고주", className: "bg-primary-50 text-primary-700" },
  partner: {
    label: "매장",
    className:
      "bg-amber-50 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200",
  },
  admix: { label: "admix", className: "bg-gray-100 text-gray-700" },
};

/** 흰 유리 카드 — 가입 소개(PartnerJoin)의 오른쪽 카드와 같은 바탕 · 테두리 · 보라 기운 그림자. */
const GLASS =
  "rounded-[24px] border border-white bg-surface/60 shadow-[0_18px_48px_rgba(42,20,89,0.08)] backdrop-blur-md dark:border-gray-100";

/**
 * 예시 매장 — 광고주 "매장 찾기" 목록의 콜라보 카드(MediaFindCard 큰 카드)를 그림처럼 옮겼다(실제 매장 아님).
 * 등급은 보이지 않고(11-12 사용자), 1건 금액도 예시 숫자가 실제 가격처럼 읽힐 수 있어 운영 시간 · 매장 특징만.
 */
const SAMPLE_STORES = [
  {
    name: "오늘의 커피 성수점",
    address: "서울 성동구 연무장길 12",
    hours: "매일 10:00 ~ 22:00",
    tags: ["감성 인테리어", "포토존", "디저트 맛집"],
    photo: "외관",
    color: "from-amber-200 to-orange-300",
    liked: true,
  },
  {
    name: "브루잉랩 성수",
    address: "서울 성동구 아차산로 17",
    hours: "매일 09:00 ~ 21:00 (월요일 휴무)",
    tags: ["로스터리", "넓은 공간"],
    photo: "내관",
    color: "from-stone-200 to-amber-400",
    liked: false,
  },
];

export function PartnersLanding({ member = false }: { member?: boolean }) {
  const { data: me } = useMe();
  // 광고주 · 제휴사가 ?intro=1 로 보면 가입 대신 대시보드로, 다른 유형 회원은 회원 유형 바꾸기로.
  const collabMember = canUsePartners(me?.member_category);
  const otherMember = (member || !!me) && !collabMember;

  return (
    <div className="isolate flex flex-col gap-[40px] sm:gap-[64px]">
      {/* 배경 빛 — 가입 소개와 같은 옅은 보라. 본문 영역(main) 첫 화면에 깐다. 다크 모드는 35%만. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px] bg-[radial-gradient(45%_60%_at_50%_15%,rgba(183,163,242,0.32),transparent_70%),radial-gradient(35%_45%_at_12%_8%,rgba(216,205,249,0.35),transparent_70%)] dark:opacity-35"
      />

      {/* ── 위 소개 ── */}
      <section className="flex flex-col items-center pt-[20px] text-center sm:pt-[48px]">
        <span
          className={cn(
            collabScript.className,
            "text-[15px] font-bold tracking-[0.04em] text-gray-400 sm:text-[18px] dark:text-white/60",
          )}
        >
          Collaboration
        </span>
        <h1 className="mt-[8px] text-[28px] leading-[1.3] font-bold tracking-[-0.03em] break-keep text-gray-900 sm:mt-[12px] sm:text-[44px]">
          브랜드와 매장이
          <br />
          함께 만드는 콜라보
          <Dot />
        </h1>
        <p className="mt-[12px] max-w-[520px] text-[15px] leading-[1.65] break-keep text-gray-500 sm:mt-[18px] sm:text-[17px]">
          광고주는 브랜드를 알릴 매장을 찾고, 매장은 공간으로 새 협업을 만나요.
          기획부터 결과 보고까지 admix가 함께해요.
        </p>
        {/* 버튼 둘 다 흰 유리, 마우스를 올리면 보라(11-12 사용자). "이미 회원이에요 로그인"은 뺐다(로그인은 왼쪽 메뉴에). */}
        <div className="mt-[22px] flex w-full flex-col items-center gap-[10px] sm:mt-[30px] sm:w-auto sm:flex-row sm:gap-[8px]">
          {collabMember ? (
            <HeroLink href={PARTNERS_DASHBOARD_HREF}>대시보드로 가기</HeroLink>
          ) : otherMember ? (
            <HeroLink href="/profile">회원 유형 바꾸기</HeroLink>
          ) : (
            ROLES.map((r) => (
              <HeroLink key={r.id} href={r.cta.href}>
                {r.cta.label}
              </HeroLink>
            ))
          )}
        </div>
        {otherMember && (
          <p className="mt-[14px] max-w-[420px] text-[13px] leading-[1.6] break-keep text-gray-500">
            콜라보는 광고주 · 제휴사(콜라보) 회원이 쓸 수 있어요. 회원 정보에서
            언제든 회원 유형을 바꿀 수 있어요.
          </p>
        )}
      </section>

      {/* ── 아래 세 구역은 스크롤 대신 이 자리에서 좌우 버튼으로 넘겨 본다(11-12 사용자). 맺음 문구는 그때 뺐다. ── */}
      <SlideDeck heads={SLIDE_HEADS}>
        <RolesSlide />
        <FlowSlide />
        <PreviewSlide />
      </SlideDeck>
    </div>
  );
}

/** 넘겨 보는 구역 제목 — 순서는 아래 SlideDeck 의 자식 순서와 같다. */
const SLIDE_HEADS = [
  {
    title: "광고주도, 매장도 함께해요",
    desc: "하는 일은 달라도 같은 콜라보 안에서 만나요.",
  },
  {
    title: "콜라보는 이렇게 진행돼요",
    desc: "단계마다 누가 무엇을 하는지 한눈에 볼 수 있어요.",
  },
  {
    title: "가입하면 이런 화면을 써요",
    desc: "실제 화면을 줄여 그린 예시예요.",
  },
];

/**
 * 좌우로 넘겨 보는 구역(11-12 사용자: "스크롤을 내려서 보는 게 아니라 이 위치로 좌우 버튼을 넘겨서") —
 * 위에 지금 구역 제목 · 설명과 양옆 이전 · 다음 버튼, 아래 점(눌러서 바로 가기). 휴대폰 · 트랙패드는 밀어서도 넘긴다(scroll-snap).
 * 칸은 본문 여백만큼 양옆으로 넓혀(-mx) 카드 그림자가 잘리지 않게 하고, 구역마다 같은 여백을 안쪽에 다시 준다.
 *
 * 끝에서 끝으로도 이어서 넘긴다(3 → 1, 1 ← 3, 11-12 사용자: "페이지 넘기듯이") — 양 끝에 반대쪽 끝 구역의 복사본을 하나씩 두고
 * (마지막 복사본 | 1 2 3 | 첫 복사본), 복사본까지 보통처럼 밀어 넘긴 뒤 멈추면 같은 모양의 진짜 구역 자리로 소리 없이 옮긴다.
 * 자리(pos)는 복사본을 포함한 순번(0 ~ N+1), 화면 순번(index)은 진짜 구역 순번(0 ~ N-1).
 */
function SlideDeck({
  heads,
  children,
}: {
  heads: { title: string; desc: string }[];
  children: ReactNode[];
}) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = heads.length;
  const head = heads[index] ?? heads[0];
  const realOf = (pos: number) => (pos - 1 + count) % count;

  // 버튼 · 점으로 넘기는 움직임은 브라우저 부드러운 스크롤 대신 직접 그린다 — 끝나는 때를 정확히 알고, 도중에 또 눌러도 이어진다.
  // dest — 가고 있는 자리(움직이는 동안만). 그동안은 스크롤 위치로 순번을 바꾸지 않는다(1 → 3 사이에 2 제목이 깜빡이지 않게).
  const dest = useRef<number | null>(null);
  const frame = useRef<number | undefined>(undefined);
  const settleTimer = useRef<number | undefined>(undefined);

  /** 복사본 자리에 멈췄으면 같은 모양의 진짜 구역 자리로 바로 옮긴다(움직임 없이). */
  const settle = useCallback(
    (el: HTMLElement) => {
      const pos = Math.round(el.scrollLeft / stepOf(el));
      if (pos === 0) el.scrollLeft = count * stepOf(el);
      else if (pos === count + 1) el.scrollLeft = stepOf(el);
    },
    [count],
  );

  /** 그리던 움직임을 멈추고 칸 맞춤(snap)을 되돌린다. */
  const stop = useCallback((el: HTMLElement) => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    frame.current = undefined;
    dest.current = null;
    el.style.scrollSnapType = "";
  }, []);

  /**
   * pick(지금 자리) → 갈 자리(복사본 포함 0 ~ N+1). 지금 자리는 움직이는 중이면 가던 곳이고, 그게 복사본이면 같은 모양의
   * 진짜 자리로 먼저 옮겨 놓고 센다 — 3 → 1 로 넘어가는 도중에 다음을 또 눌러도 2 가 거꾸로(왼쪽에서) 오지 않고 오른쪽으로 이어진다(11-12).
   */
  const go = (pick: (pos: number) => number) => {
    const el = track.current;
    if (!el) return;
    const step = stepOf(el);
    let pos = dest.current ?? Math.round(el.scrollLeft / step);
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    window.clearTimeout(settleTimer.current);
    el.style.scrollSnapType = "none"; // 움직이는 동안 칸 맞춤이 끼어들지 않게
    if (pos <= 0) {
      el.scrollLeft += count * step;
      pos += count;
    } else if (pos >= count + 1) {
      el.scrollLeft -= count * step;
      pos -= count;
    }
    const to = Math.max(0, Math.min(count + 1, pick(pos)));
    dest.current = to;
    setIndex(realOf(to));

    const from = el.scrollLeft;
    const end = to * step;
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? 0
      : 520;
    const start = performance.now();
    const tick = (now: number) => {
      const t = duration ? Math.min(1, (now - start) / duration) : 1;
      el.scrollLeft = from + (end - from) * (1 - (1 - t) ** 3);
      if (t < 1) {
        frame.current = requestAnimationFrame(tick);
        return;
      }
      stop(el);
      settle(el);
    };
    frame.current = requestAnimationFrame(tick);
  };

  // 처음엔 진짜 첫 구역 자리에, 화면 폭이 바뀌면 보던 구역 자리에 다시 맞춘다(폭 × 자리가 어긋나지 않게).
  const indexRef = useRef(index);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const fit = () => {
      stop(el);
      el.scrollLeft = (indexRef.current + 1) * stepOf(el);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stop]);
  useEffect(
    () => () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
      window.clearTimeout(settleTimer.current);
    },
    [],
  );

  // 복사본 — 마지막 구역 | 진짜 구역들 | 첫 구역. 복사본은 읽기 · 탭 이동에서 뺀다.
  const slides = [
    { key: "clone-last", node: children[count - 1], clone: true },
    ...children.map((node, i) => ({
      key: heads[i]?.title ?? String(i),
      node,
      clone: false,
    })),
    { key: "clone-first", node: children[0], clone: true },
  ];

  return (
    <section
      aria-roledescription="carousel"
      aria-label="admix 콜라보 소개"
      className="flex flex-col"
    >
      <div className="flex items-center justify-between gap-[12px]">
        <SlideArrow dir="prev" onPress={() => go((pos) => pos - 1)} />
        <div aria-live="polite" className="min-w-0 flex-1">
          <SectionHead title={head.title} desc={head.desc} />
        </div>
        <SlideArrow dir="next" onPress={() => go((pos) => pos + 1)} />
      </div>
      <div className="mt-[12px] flex justify-center gap-[6px]">
        {heads.map((h, i) => (
          <button
            key={h.title}
            type="button"
            aria-label={`${i + 1}번째 · ${h.title}`}
            aria-current={i === index ? "true" : undefined}
            onClick={() => go(() => i + 1)}
            className={cn(
              "h-[6px] rounded-full transition-all",
              i === index
                ? "w-[18px] bg-primary"
                : "w-[6px] bg-gray-300 hover:bg-gray-400",
            )}
          />
        ))}
      </div>
      <div
        ref={track}
        onScroll={(e) => {
          if (dest.current !== null) return; // 버튼 · 점으로 넘기는 중 — 끝나면 go 가 정리한다.
          // 밀어서 넘기는 중 — 제목은 바로 따라가고, 멈추면 끝 정리.
          const el = e.currentTarget;
          setIndex(realOf(Math.round(el.scrollLeft / stepOf(el))));
          window.clearTimeout(settleTimer.current);
          settleTimer.current = window.setTimeout(() => settle(el), 140);
        }}
        // 버튼으로 넘기는 도중에 손으로 밀면 손이 이긴다(가로 휠 · 트랙패드도).
        onTouchStart={(e) => stop(e.currentTarget)}
        onWheel={(e) => {
          if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) stop(e.currentTarget);
        }}
        className="-mx-[16px] mt-[8px] flex snap-x snap-mandatory items-start gap-[64px] overflow-x-auto overscroll-x-contain [scrollbar-width:none] sm:-mx-[24px] sm:mt-[16px] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide, pos) => (
          <div
            key={slide.key}
            role={slide.clone ? undefined : "group"}
            aria-roledescription={slide.clone ? undefined : "slide"}
            aria-label={slide.clone ? undefined : `${pos} / ${count}`}
            aria-hidden={slide.clone || realOf(pos) !== index}
            inert={slide.clone}
            className="w-full shrink-0 snap-start px-[16px] pt-[12px] pb-[40px] sm:px-[24px]"
          >
            {slide.node}
          </div>
        ))}
      </div>
    </section>
  );
}

/** 구역 하나만큼 넘기는 거리 — 칸 폭 + 구역 사이 틈(옆 구역 카드 그림자가 비치지 않게 64px 띄웠다). */
const stepOf = (el: HTMLElement) =>
  el.clientWidth + (parseFloat(getComputedStyle(el).columnGap) || 0);

/** 이전 · 다음 — 아주 옅은 검정 5%(위 가입 버튼 · 아래 카드가 흰색이라 겹치지 않게, 보라는 아니게, 많이 흐리게 — 11-12 사용자) + 짙은 화살표, 마우스를 올리면 10%. 끝에서도 꺼지지 않고 반대쪽 끝으로 넘어간다. */
function SlideArrow({
  dir,
  onPress,
}: {
  dir: "prev" | "next";
  onPress: () => void;
}) {
  const Icon = dir === "prev" ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <Button
      isIconOnly
      variant="ghost"
      aria-label={dir === "prev" ? "이전" : "다음"}
      onPress={onPress}
      className="size-[40px] min-w-0 shrink-0 rounded-full bg-gray-900/5 text-gray-800 backdrop-blur-sm transition-colors data-[hovered=true]:bg-gray-900/10 sm:size-[48px]"
    >
      <Icon className="size-[18px] sm:size-[20px]" />
    </Button>
  );
}

/** 1 — 광고주 · 매장 카드(가입 버튼은 위 소개에만). */
function RolesSlide() {
  return (
    <div className="grid gap-[12px] md:grid-cols-2 md:gap-[16px]">
      {ROLES.map((r) => (
        <article
          key={r.id}
          className={cn("flex flex-col p-[20px] sm:p-[28px]", GLASS)}
        >
          <span className="flex items-center gap-[8px]">
            <span className="flex size-[36px] items-center justify-center rounded-full bg-primary-50 text-primary">
              <r.Icon className="size-[18px]" />
            </span>
            <span className="text-[14px] font-semibold text-gray-600">
              {r.label}
            </span>
          </span>
          <h3 className="mt-[14px] text-[19px] font-bold tracking-[-0.02em] break-keep text-gray-900 sm:text-[22px]">
            {r.title}
          </h3>
          <ul className="mt-[14px] flex flex-col gap-[10px] sm:mt-[18px]">
            {r.points.map((p) => (
              <li
                key={p}
                className="flex gap-[8px] text-[14px] leading-[1.55] break-keep text-gray-700 sm:text-[15px]"
              >
                <span className="mt-[2px] flex size-[18px] shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                  <SmallCheckIcon className="size-[10px]" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

/**
 * 2 — 진행 순서. 카드 없이 번호 동그라미를 점선으로 잇는다(흰 카드 구역들과 다르게).
 * PC(lg)는 세 단계씩 두 줄, 칸마다 가운데 정렬(11-12 사용자: 여섯 칸 한 줄은 옆으로만 길고 읽기 불편 · 가운데에), 그보다 좁으면 세로로.
 */
function FlowSlide() {
  return (
    <ol className="mx-auto flex w-full max-w-[560px] flex-col lg:grid lg:max-w-none lg:grid-cols-3 lg:gap-y-[40px]">
      {FLOW.map((s, i) => (
        <li
          key={s.title}
          className="relative flex gap-[14px] pb-[24px] last:pb-0 lg:flex-col lg:items-center lg:gap-[14px] lg:px-[24px] lg:pb-0 lg:text-center"
        >
          {/* 잇는 점선 — 휴대폰은 아래로, PC는 같은 줄 다음 단계 동그라미까지(줄 끝 3 → 4 는 잇지 않는다).
              PC는 단계를 칸 가운데에 둔다(11-12 사용자) — 점선은 이 동그라미 오른쪽에서 다음 칸 동그라미 왼쪽까지. */}
          {i < FLOW.length - 1 && (
            <span
              aria-hidden
              className={cn(
                "absolute top-[44px] bottom-[6px] left-[18px] border-l-2 border-dotted border-primary-200 lg:top-[19px] lg:right-[calc(-50%+29px)] lg:bottom-auto lg:left-[calc(50%+29px)] lg:border-t-2 lg:border-l-0",
                i % 3 === 2 && "lg:hidden",
              )}
            />
          )}
          <span className="flex size-[38px] shrink-0 items-center justify-center rounded-full border border-white bg-surface/80 text-[15px] font-bold text-gray-800 shadow-[0_6px_18px_rgba(42,20,89,0.08)] backdrop-blur-sm dark:border-gray-100">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1 pt-[7px] lg:pt-0">
            <div className="flex flex-wrap items-center gap-x-[8px] gap-y-[4px] lg:justify-center">
              <h3 className="text-[16px] font-bold whitespace-nowrap text-gray-900 sm:text-[17px]">
                {s.title}
              </h3>
              <span className="flex gap-[4px]">
                {s.who.map((a) => (
                  <span
                    key={a}
                    className={cn(
                      "rounded-full px-[8px] py-[2px] text-[11px] font-semibold whitespace-nowrap",
                      ACTOR[a].className,
                    )}
                  >
                    {ACTOR[a].label}
                  </span>
                ))}
              </span>
            </div>
            <p className="mt-[6px] text-[14px] leading-[1.6] break-keep text-gray-600">
              {s.body}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** 3 — 화면 미리 보기(예시). */
function PreviewSlide() {
  return (
    <div className="grid gap-[12px] lg:grid-cols-2 lg:gap-[16px]">
      <ExampleFrame label="광고주 · 매장 찾기">
        {/* 휴대폰은 한 장만 — 두 장을 나란히 두면 카드가 너무 좁다. */}
        <div className="grid gap-[10px] sm:grid-cols-2">
          {SAMPLE_STORES.map((s, i) => (
            <SampleStoreCard
              key={s.name}
              store={s}
              className={i > 0 ? "max-sm:hidden" : undefined}
            />
          ))}
        </div>
      </ExampleFrame>
      <ExampleFrame label="매장 · 콜라보 참여">
        <div className="flex h-full flex-col gap-[12px] rounded-[14px] bg-gray-50 p-[14px]">
          <div className="flex items-center justify-between gap-[8px]">
            <span className="rounded-full bg-primary-50 px-[8px] py-[2px] text-[11px] font-semibold text-primary-700">
              모집 중
            </span>
            <span className="text-[11px] text-gray-500">
              11.15까지 답해 주세요
            </span>
          </div>
          <div>
            <p className="text-[11px] text-gray-500">브랜드 A</p>
            <p className="text-[15px] font-bold text-gray-900">
              가을 시즌 한정 메뉴 콜라보
            </p>
          </div>
          <dl className="grid grid-cols-[64px_1fr] gap-y-[4px] text-[12px]">
            <dt className="text-gray-500">기간</dt>
            <dd className="text-gray-800">11.20 ~ 12.19</dd>
            <dt className="text-gray-500">구성</dt>
            <dd className="text-gray-800">협업 메뉴 · 브랜딩 소모품</dd>
            <dt className="text-gray-500">admix가</dt>
            <dd className="text-gray-800">설치 · 철수 · 결과 보고서</dd>
          </dl>
          <p className="mt-auto text-[12px] font-semibold text-gray-800">
            이 콜라보에 참여할까요?
          </p>
          <div className="grid grid-cols-[1fr_2fr] gap-[6px]">
            <span className="flex h-[36px] items-center justify-center rounded-[15px] border border-gray-200 bg-surface text-[13px] font-semibold text-gray-700">
              미참여
            </span>
            <span className="flex h-[36px] items-center justify-center rounded-[15px] bg-primary text-[13px] font-semibold text-white">
              참여
            </span>
          </div>
        </div>
      </ExampleFrame>
    </div>
  );
}

/** 제목 끝 보라 점 — 가입 소개(PartnerJoin) 제목과 같다. */
function Dot() {
  return (
    <span
      aria-hidden
      className="ml-[5px] inline-block size-[8px] rounded-full bg-primary align-baseline sm:ml-[6px] sm:size-[11px]"
    />
  );
}

function SectionHead({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex flex-col gap-[4px] text-center">
      <h2 className="text-[20px] font-bold tracking-[-0.02em] break-keep text-gray-900 sm:text-[28px]">
        {title}
      </h2>
      <p className="text-[14px] break-keep text-gray-500 sm:text-[15px]">
        {desc}
      </p>
    </div>
  );
}

/** 위 소개 버튼 — 흰 유리, 마우스를 올리면 보라 바탕 · 흰 글자(11-12 사용자). */
function HeroLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex h-[48px] w-full items-center justify-center gap-[2px] rounded-[21px] border border-white bg-surface/70 px-[24px] text-[15px] font-bold text-gray-800 shadow-[0_6px_18px_rgba(42,20,89,0.08)] backdrop-blur-sm transition-colors hover:border-primary hover:bg-primary hover:text-white hover:shadow-[0_12px_28px_rgba(122,63,224,0.3)] sm:w-auto dark:border-gray-100"
    >
      {children}
      <ChevronRightIcon className="size-[16px]" />
    </Link>
  );
}

/** 예시 화면 틀 — 누르지 않게(그림처럼) 한다. */
function ExampleFrame({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <figure className={cn("flex flex-col overflow-hidden", GLASS)}>
      <figcaption className="flex items-center gap-[6px] px-[18px] pt-[14px] text-[12px] font-semibold text-gray-500">
        <span className="size-[6px] rounded-full bg-primary-300" />
        {label}
      </figcaption>
      <div
        aria-hidden
        className="pointer-events-none flex-1 p-[14px] pt-[10px] select-none sm:p-[18px] sm:pt-[12px]"
      >
        {children}
      </div>
    </figure>
  );
}

/**
 * 매장 찾기 카드 그림 — MediaFindCard 큰 카드(콜라보)와 같은 자리 · 글씨: 사진(왼쪽 위 새 탭 표시 · 오른쪽 위 하트 ·
 * 왼쪽 아래 사진 분류 · 아래 점), 매장명 · 주소 · "콜라보 > 매장" 칩, 선 아래 운영 시간 · 매장 특징(공용 PartnersCardDetails).
 */
function SampleStoreCard({
  store,
  className,
}: {
  store: (typeof SAMPLE_STORES)[number];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[16px] border border-gray-200 bg-surface",
        className,
      )}
    >
      <div className={cn("relative h-[132px] bg-gradient-to-br", store.color)}>
        <span className="absolute top-[9px] left-[9px] flex size-[28px] items-center justify-center rounded-[11px] bg-surface text-gray-500 drop-shadow-[0px_2px_4px_rgba(0,0,0,0.08)]">
          <span className="size-[13px] bg-current [mask:url(/icons/export.svg)_center/contain_no-repeat]" />
        </span>
        <span
          className={cn(
            "absolute top-[9px] right-[9px] flex size-[28px] items-center justify-center rounded-[11px]",
            store.liked ? "bg-tone-fff1f0" : "bg-surface",
          )}
        >
          <LoveIcon
            className={cn(
              "size-[15px]",
              store.liked ? "text-red-500" : "text-gray-300",
            )}
          />
        </span>
        <span className="absolute bottom-[8px] left-[8px] rounded-[6px] bg-black/55 px-[6px] text-[10px] leading-[16px] font-semibold text-white">
          {store.photo}
        </span>
        <span className="absolute bottom-[9px] left-1/2 flex -translate-x-1/2 gap-[4px]">
          {[0, 1, 2].map((d) => (
            <span
              key={d}
              className={cn(
                "size-[5px] rounded-full bg-white",
                d ? "opacity-70" : "opacity-100",
              )}
            />
          ))}
        </span>
      </div>
      <div className="flex flex-col px-[10px] pt-[10px]">
        <p className="truncate pl-[2px] text-[14px] leading-[18px] font-bold text-black">
          {store.name}
        </p>
        <p className="mt-[5px] flex items-center gap-[3px]">
          <LocationFilledIcon className="size-[13px] shrink-0 text-tone-6c757d" />
          <span className="truncate text-[11px] text-tone-6c757d">
            {store.address}
          </span>
        </p>
        <span className="mt-[8px] flex w-fit items-center rounded-[8px] bg-tone-ededef px-[8px] py-[2px] text-[10px] leading-[16px] text-zinc-500">
          {PARTNERS_MEDIA_CATEGORY}
          <ChevronRightBoldIcon className="size-[14px] shrink-0" />
          매장
        </span>
      </div>
      <div className="mx-[10px] mt-[10px] border-t border-gray-200" />
      <PartnersCardDetails
        businessHours={store.hours}
        tags={store.tags}
        className="p-[10px] text-[11px]"
      />
    </div>
  );
}
