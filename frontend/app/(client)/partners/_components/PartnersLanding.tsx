"use client";

import { Button } from "@heroui/react";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

import {
  COLLAB_SIGNUP_HREF,
  PARTNER_SIGNUP_HREF,
} from "@/app/(client)/(auth)/signup/_components/CategoryStep";
import { collabScript } from "@/app/(client)/(main)/_components/collabFont";
import { PartnersCardDetails } from "@/components/common/PartnersCardDetails";
import {
  ArrowUpIcon,
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
 *   위 소개(가입 버튼 둘) 아래로 광고주 · 매장 카드 → 진행 방식(단계마다 누가 하는지) → 화면 미리 보기를 스크롤해 본다.
 *   (11-12에 좌우 버튼으로 넘기는 슬라이드로 바꿨다가 11-13 사용자가 "그냥 스크롤 내려서"로 되돌림.)
 * 위 소개는 제휴사 가입 소개(PartnerJoin)와 같은 말투 — 옅은 보라 빛 위에 흰 유리 버튼, 진한 보라는 제목 끝 점 · 버튼 hover 에만.
 * 아래 세 구역은 생김새를 서로 다르게(11-13 사용자: "서로 구분 잘 되게, 너무 UI가 다 똑같아") —
 *   광고주 · 매장 = 흰 카드 + 역할 색 아이콘(보라 · 노랑), 진행 방식 = 옅은 연보라 판 위 점선 흐름(남색 판은 사용자가 "너무 화려해"로 뺌), 화면 미리 보기 = 브라우저 창 모양.
 * 스크롤해 내려가면 제목 · 카드 · 단계가 하나씩 밑에서 슥 올라온다(useReveal, 11-13 사용자). 맨 위 소개는 처음부터 보인다.
 * 문구는 지금 화면 · 기본협약에 있는 것만 옮겼다(금액 · 기간 같은 조건을 지어내지 않는다).
 */

/** 콜라보 가입 1단계에 유형을 골라 둔다 — 광고주 · 제휴사(콜라보) 모두 바로 회원가입으로(11-12 사용자). */
const ADVERTISER_SIGNUP_HREF = `${COLLAB_SIGNUP_HREF}&category=advertiser`;

// 광고주 아이콘은 채운 확성기(11-13 사용자: "fill-megaphone.svg로").
const MegaphoneIcon = maskIcon("/icons/fill-megaphone.svg");
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
    title: "매장에서 브랜드 알리기",
    points: [
      "admix가 확인한 매장을 사진 · 등급 · 금액으로 비교해요",
      "구성 · 기간만 정해 의뢰하면 기획안은 admix가 만들어요",
      "제작 대행부터 결과 보고서까지 한 화면에서 챙겨요",
    ],
    cta: { label: "광고주로 시작하기", href: ADVERTISER_SIGNUP_HREF },
  },
  {
    id: "partner",
    label: "매장(제휴사)",
    Icon: StoreIcon,
    title: "매장 공간으로 협업하기",
    points: [
      "등록비 · 이용료 없이 시작해요",
      "매장 사진 · 정보는 admix 담당자가 등록해 드려요",
      "콜라보마다 참여 여부를 직접 골라요",
    ],
    cta: { label: "제휴사로 시작하기", href: PARTNER_SIGNUP_HREF },
  },
];

/** 진행 순서 — 단계마다 누가 하는지(광고주 · admix · 매장) 칩으로. */
const FLOW: { title: string; who: Actor[]; body: string }[] = [
  {
    title: "의뢰",
    who: ["advertiser"],
    body: "구성 · 기간 · 원하는 매장을 담아 의뢰해요.",
  },
  {
    title: "기획안",
    who: ["admix"],
    body: "admix가 기획안을 보내고, 광고주가 확인하면 확정돼요.",
  },
  {
    title: "매장 모집",
    who: ["partner"],
    body: "매장이 선착순으로 참여를 신청해요.",
  },
  {
    title: "매장 확정",
    who: ["advertiser", "partner"],
    body: "광고주가 살펴본 뒤 매장이 최종 확정해요.",
  },
  {
    title: "진행",
    who: ["admix", "partner"],
    body: "준비 · 설치를 마치면 시작하고, 중간 보고로 상황을 알려요.",
  },
  {
    title: "결과 보고",
    who: ["admix"],
    body: "철수 후 결과 보고서를 전달해요.",
  },
];

/** 진행 방식 칩 — 연보라 판(FLOW_PANEL) 위라 광고주는 한 단계 진한 보라, admix 는 흰 칩. */
const ACTOR: Record<Actor, { label: string; className: string }> = {
  advertiser: { label: "광고주", className: "bg-primary-100 text-primary-700" },
  partner: {
    label: "매장",
    className:
      "bg-amber-50 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200",
  },
  admix: { label: "admix", className: "bg-surface text-gray-700" },
};

/**
 * 광고주 · 매장 카드 — 카드는 흰색(11-13 사용자: "얘넨 흰색으로 해도 될 것 같아"),
 * 아이콘 · 체크만 진행 방식 칩과 같은 보라(광고주) · 노랑(매장)으로 나눈다.
 */
const ROLE_CARD =
  "border-gray-100 bg-surface shadow-[0_18px_48px_rgba(42,20,89,0.06)]";
const ROLE_TONE: Record<Role, { icon: string; check: string }> = {
  advertiser: {
    icon: "bg-primary-50 text-primary",
    check: "bg-primary-100 text-primary-600",
  },
  partner: {
    icon: "bg-amber-50 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300",
    check:
      "bg-amber-100 text-amber-700 dark:bg-amber-400/20 dark:text-amber-200",
  },
};

/**
 * 진행 방식 판 — 아주 옅은 연보라 바탕 + 연한 테두리, 빛 · 그림자 없이(11-13 사용자: 남색 판은 "너무 화려해").
 * 위 흰 카드 · 아래 창 모양과는 바탕색으로만 갈린다.
 */
const FLOW_PANEL =
  "rounded-[28px] border border-primary-100 bg-primary-50/70 px-[20px] py-[36px] sm:rounded-[32px] sm:px-[40px] sm:py-[48px]";

/**
 * 예시 매장 — 광고주 "매장 찾기" 목록의 콜라보 카드(MediaFindCard 큰 카드)를 그림처럼 옮겼다.
 * 실제 카페로 읽히지 않게 이름은 "매장 A · B", 주소는 동까지만(11-13 사용자: "진짜 있는 카페 말고 매장 A, 매장 B").
 * 등급은 보이지 않고(11-12 사용자), 1건 금액도 예시 숫자가 실제 가격처럼 읽힐 수 있어 운영 시간 · 매장 특징만.
 */
const SAMPLE_STORES = [
  {
    name: "매장 A",
    address: "서울 성동구 성수동",
    hours: "매일 10:00 ~ 22:00",
    tags: ["감성 인테리어", "포토존", "디저트 맛집"],
    photo: "외관",
    color: "from-amber-200 to-orange-300",
    liked: true,
  },
  {
    name: "매장 B",
    address: "서울 마포구 연남동",
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
  const top = useRef<HTMLDivElement>(null);

  // 구역 사이를 넉넉히(11-13 사용자: "서로 위아래 간격을 넓혀줘") — 휴대폰 72px, PC 120px.
  return (
    <div
      ref={top}
      className="isolate flex flex-col gap-[72px] pb-[24px] sm:gap-[120px] sm:pb-[40px]"
    >
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
          기획부터 결과 보고까지 admix가 함께해요.
        </p>
        {/* 버튼 둘 다 흰 유리, 마우스를 올리면 보라(11-12 사용자). "이미 회원이에요 로그인"은 뺐다(로그인은 왼쪽 메뉴에).
            휴대폰도 PC처럼 좌우 나란히, 작게(11-13 사용자). */}
        <div className="mt-[22px] flex flex-row items-center justify-center gap-[8px] sm:mt-[30px]">
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
            콜라보는 광고주 · 제휴사 회원만 쓸 수 있어요.
          </p>
        )}
      </section>

      {/* ── 아래 세 구역은 위에서 아래로 스크롤해 본다(11-13 사용자: "버튼 슬라이드 말고 그냥 스크롤 내려서"). ── */}
      <LandingSection
        title="광고주도, 매장도 함께해요"
        desc="광고주와 제휴사 회원으로 각각 가입해요."
      >
        <RolesCards />
      </LandingSection>
      <LandingSection
        title="콜라보 진행 방식"
        desc="단계마다 누가 맡는지 표시했어요."
        panel
      >
        <FlowSteps />
      </LandingSection>
      <LandingSection
        title="가입하면 쓰는 화면"
        desc="실제 화면을 줄여 그린 예시예요."
      >
        <ScreenPreview />
      </LandingSection>
      {/* 맨 아래 "맨 위로"(11-13 사용자) — 구역 사이만큼 띄우지 않고 마지막 구역에 붙여 둔다. */}
      <BackToTop target={top} />
    </div>
  );
}

/**
 * 맨 위로 — 이 화면은 창이 아니라 본문(main)이 스크롤되므로, 소개를 감싼 칸에서 위로 올라가며 스크롤되는 상자를 찾아 올린다
 * (없으면 창). 색은 남색 기운의 진한 회색(11-13 사용자: "회색이나 남색으로") — admix 매체 찾기 "맨 위로" · 믹시 "맨 아래로"와 같은
 * bg-gray-800/90 + text-surface(다크 모드는 밝은 회색 바탕 · 어두운 글자로 뒤집힌다), 마우스를 올리면 gray-900.
 */
function BackToTop({ target }: { target: RefObject<HTMLElement | null> }) {
  const goTop = () => {
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";
    let el = target.current?.parentElement ?? null;
    while (el) {
      const { overflowY } = getComputedStyle(el);
      if (/(auto|scroll)/.test(overflowY) && el.scrollHeight > el.clientHeight) {
        el.scrollTo({ top: 0, behavior });
        return;
      }
      el = el.parentElement;
    }
    window.scrollTo({ top: 0, behavior });
  };
  return (
    <Reveal className="-mt-[24px] flex justify-center sm:-mt-[56px]">
      <Button
        variant="ghost"
        onPress={goTop}
        className="h-[44px] gap-[6px] rounded-full bg-gray-800/90 px-[20px] text-[14px] font-semibold text-surface shadow-[0_4px_12px_rgba(0,0,0,0.18)] backdrop-blur transition-colors data-[hovered=true]:bg-gray-900"
      >
        <ArrowUpIcon className="size-[16px]" />
        맨 위로
      </Button>
    </Reveal>
  );
}

/** 아래 구역 하나 — 가운데 제목 · 설명, 그 아래 내용. panel: 연보라 판 위에(진행 방식). */
function LandingSection({
  title,
  desc,
  panel = false,
  children,
}: {
  title: string;
  desc: string;
  panel?: boolean;
  children: ReactNode;
}) {
  const head = <SectionHead title={title} desc={desc} />;
  const section = (
    <section
      className={cn("flex flex-col gap-[20px] sm:gap-[32px]", panel && FLOW_PANEL)}
    >
      {/* 판은 판째로 올라오고(아래), 보통 구역은 제목부터 올라온다. 내용(카드 · 단계 · 창)은 저마다 하나씩. */}
      {panel ? head : <Reveal>{head}</Reveal>}
      {children}
    </section>
  );
  return panel ? <Reveal>{section}</Reveal> : section;
}

/** 스크롤 등장 — 처음엔 32px 아래 · 투명, 화면에 들어오면 0.7초 동안 제자리로. */
const REVEAL_BASE =
  "transition-[opacity,translate] duration-700 ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none";

/**
 * 스크롤해 화면에 들어오면 밑에서 슥 올라오며 나타나게(11-13 사용자: "스크롤 내릴 때 하나씩 … 밑에서 슥 올라오는 것처럼").
 * 15%쯤 보이면 시작하고, 한 번 나타나면 그대로 둔다(위로 다시 올려도 숨기지 않는다).
 * delay(ms): 같은 줄에 나란한 것들을 하나씩 차례로. 움직임 줄이기 설정이면 움직이지 않고 처음부터 보인다.
 * 이 화면은 창이 아니라 main 이 스크롤되지만, 관찰 기준을 화면(root 없음)으로 두면 스크롤 상자에 가려진 부분도 알아서 빠진다.
 */
function useReveal<T extends HTMLElement>(delay = 0) {
  // 요소는 콜백 ref 로 받는다 — 렌더 중에 ref 객체를 넘기지 않게(react-hooks/refs).
  const [el, ref] = useState<T | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        // 화면에 들어올 때만. 한 번에 건너뛴 것은 다시 올라가 볼 때 그 자리에서 올라온다.
        if (!entries.some((e) => e.isIntersecting)) return;
        setShown(true);
        io.disconnect();
      },
      // 화면 아래 끝 여백(rootMargin)은 두지 않는다 — 맨 아래 "맨 위로"처럼 더 내릴 수 없는 것도 나타나게.
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [el]);
  // 기다림은 나타날 때만 — 처음 숨길 때 기다리면 깜빡 보였다 사라진다.
  const style: CSSProperties | undefined =
    shown && delay ? { transitionDelay: `${delay}ms` } : undefined;
  const className = cn(
    REVEAL_BASE,
    shown ? "translate-y-0 opacity-100" : "translate-y-[32px] opacity-0",
  );
  // [요소에 붙일 콜백 ref, 그 요소의 style · className]
  return [ref, { style, className }] as const;
}

function Reveal({
  delay,
  className,
  children,
}: {
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const [revealRef, reveal] = useReveal<HTMLDivElement>(delay);
  return (
    <div
      ref={revealRef}
      style={reveal.style}
      className={cn(reveal.className, className)}
    >
      {children}
    </div>
  );
}

/** 1 — 광고주 · 매장 카드(가입 버튼은 위 소개에만). 흰 카드, 아이콘 · 체크만 역할 색 — 광고주 보라 · 매장 노랑. */
function RolesCards() {
  return (
    <div className="grid gap-[12px] md:grid-cols-2 md:gap-[16px]">
      {ROLES.map((r, i) => (
        <RoleCard key={r.id} role={r} delay={i * 120} />
      ))}
    </div>
  );
}

function RoleCard({
  role: r,
  delay,
}: {
  role: (typeof ROLES)[number];
  delay: number;
}) {
  const [revealRef, reveal] = useReveal<HTMLElement>(delay);
  return (
    <article
      ref={revealRef}
      style={reveal.style}
      className={cn(
        "flex flex-col rounded-[24px] border p-[20px] sm:p-[28px]",
        ROLE_CARD,
        reveal.className,
      )}
    >
      <span className="flex items-center gap-[8px]">
        <span
          className={cn(
            "flex size-[36px] items-center justify-center rounded-full",
            ROLE_TONE[r.id].icon,
          )}
        >
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
            <span
              className={cn(
                "mt-[2px] flex size-[18px] shrink-0 items-center justify-center rounded-full",
                ROLE_TONE[r.id].check,
              )}
            >
              <SmallCheckIcon className="size-[10px]" />
            </span>
            {p}
          </li>
        ))}
      </ul>
    </article>
  );
}

/**
 * 2 — 진행 순서. 연보라 판 위에서 카드 없이 번호 동그라미를 점선으로 잇는다(위아래 색 카드 · 창 모양과 다르게).
 * PC(lg)는 세 단계씩 두 줄, 칸마다 가운데 정렬(11-12 사용자: 여섯 칸 한 줄은 옆으로만 길고 읽기 불편 · 가운데에), 그보다 좁으면 세로로.
 */
function FlowSteps() {
  return (
    <ol className="mx-auto flex w-full max-w-[560px] flex-col lg:grid lg:max-w-none lg:grid-cols-3 lg:gap-y-[40px]">
      {FLOW.map((s, i) => (
        <FlowStep key={s.title} step={s} index={i} />
      ))}
    </ol>
  );
}

/** 단계 하나 — PC 한 줄(세 칸) 안에서 하나씩 차례로 올라온다. */
function FlowStep({
  step: s,
  index: i,
}: {
  step: (typeof FLOW)[number];
  index: number;
}) {
  const [revealRef, reveal] = useReveal<HTMLLIElement>((i % 3) * 110);
  return (
    <li
      ref={revealRef}
      style={reveal.style}
      className={cn(
        "relative flex gap-[14px] pb-[24px] last:pb-0 lg:flex-col lg:items-center lg:gap-[14px] lg:px-[24px] lg:pb-0 lg:text-center",
        reveal.className,
      )}
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
      <span className="flex size-[38px] shrink-0 items-center justify-center rounded-full border border-primary-100 bg-surface text-[15px] font-bold text-gray-800">
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
  );
}

/** 3 — 화면 미리 보기(예시). */
function ScreenPreview() {
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
      <ExampleFrame label="매장 · 콜라보 참여" delay={120}>
        <div className="flex h-full flex-col gap-[12px] rounded-[14px] bg-gray-50 p-[14px]">
          <div className="flex items-center justify-between gap-[8px]">
            <span className="rounded-full bg-primary-50 px-[8px] py-[2px] text-[11px] font-semibold text-primary-700">
              모집 중
            </span>
            <span className="text-[11px] text-gray-500">
              11.15 마감
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
      className="flex h-[40px] items-center justify-center gap-[2px] rounded-[21px] border border-white bg-surface/70 px-[14px] text-[13px] font-bold whitespace-nowrap text-gray-800 shadow-[0_6px_18px_rgba(42,20,89,0.08)] backdrop-blur-sm transition-colors hover:border-primary hover:bg-primary hover:text-white hover:shadow-[0_12px_28px_rgba(122,63,224,0.3)] sm:h-[48px] sm:px-[24px] sm:text-[15px] dark:border-gray-100"
    >
      {children}
      <ChevronRightIcon className="size-[14px] sm:size-[16px]" />
    </Link>
  );
}

/**
 * 예시 화면 틀 — 브라우저 창 모양(위 띠에 회색 점 셋 · 가운데 주소 칸 자리에 화면 이름), 미리 보기가 "화면"으로 읽히게(11-13).
 * 누르지 않게(그림처럼) 한다.
 */
function ExampleFrame({
  label,
  delay = 0,
  children,
}: {
  label: string;
  /** 나란한 두 창을 하나씩 — 두 번째 창은 조금 늦게 올라온다. */
  delay?: number;
  children: ReactNode;
}) {
  const [revealRef, reveal] = useReveal<HTMLElement>(delay);
  return (
    <figure
      ref={revealRef}
      style={reveal.style}
      className={cn(
        "flex flex-col overflow-hidden rounded-[18px] border border-gray-200 bg-surface shadow-[0_18px_48px_rgba(42,20,89,0.10)]",
        reveal.className,
      )}
    >
      <figcaption className="flex items-center gap-[10px] border-b border-gray-100 bg-gray-50 px-[14px] py-[9px]">
        <span aria-hidden className="flex w-[37px] shrink-0 gap-[5px]">
          {[0, 1, 2].map((d) => (
            <span key={d} className="size-[9px] rounded-full bg-gray-300" />
          ))}
        </span>
        <span className="min-w-0 flex-1 truncate rounded-full bg-surface px-[12px] py-[3px] text-center text-[11px] font-medium text-gray-500">
          {label}
        </span>
        <span aria-hidden className="w-[37px] shrink-0" />
      </figcaption>
      <div
        aria-hidden
        className="pointer-events-none flex-1 p-[14px] select-none sm:p-[18px]"
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
