"use client";

import { Button } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

import {
  COLLAB_SIGNUP_HREF,
  PARTNER_SIGNUP_HREF,
} from "@/app/(client)/(auth)/signup/_components/CategoryStep";
import { CategoryChangeModal } from "@/app/(client)/(mypage)/profile/_components/CategoryChangeModal";
import { ArrowLeftIcon, ArrowUpIcon } from "@/components/icons";
import { useMe } from "@/hooks/auth";
import { canUsePartners } from "@/lib/memberCategory";
import { PARTNERS_DASHBOARD_HREF, type CollabScopeKey } from "@/lib/partners";
import { cn } from "@/lib/utils";

/*
 * 콜라보 소개(/partners)와 하위 안내 페이지(/partners/about/brand · store)가 같이 쓰는 조각.
 * 11-23 사용자: 첫 화면 "브랜드로 시작하기 · 매장으로 시작하기"를 "브랜드 협업 구성 보기 · 매장 참여 방법 보기"로 바꾸고
 *   각각 하위 페이지로 — 하위 페이지도 소개와 같은 모양 · 말투(명사 제목 + 합니다체)라 PartnersLanding 에서 공용 부분을 여기로 옮겼다.
 */

/** 콜라보 가입 1단계에 유형을 골라 둔다 — 광고주 · 제휴사(콜라보) 모두 바로 회원가입으로(11-12 사용자). */
export const ADVERTISER_SIGNUP_HREF = `${COLLAB_SIGNUP_HREF}&category=advertiser`;

/** 하위 안내 페이지 주소. */
export const ABOUT_BRAND_HREF = "/partners/about/brand";
export const ABOUT_STORE_HREF = "/partners/about/store";

/**
 * 사진 — public/images/partners-landing/{이름}.jpg. 사용자가 넣은 사진은 이 폴더가 아니라 /images 에 — 소개 세 칸 partners_1~3(PartnersLanding ROLES) ·
 * 콜라보 구성 카드 collabo_1~6(FORMAT_COPY), 11-23. 예전 Pexels format-*.jpg 는 11-23 지움.
 * 나머지는 샘플(11-19) — Pexels 사진 번호(바꿀 때 참고):
 * about-brand 34939732 · about-store 8662149(하위 페이지 머리 — 예전 소개 세 칸 role-brand · role-store 와 같은 사진, role-* 는 11-23 지움) ·
 * flow-3 40168907(브랜드 협업 구성 매장 선정) · flow-4 31353701(매장 참여 방법 콜라보 참여) — 진행 방식이 사진 없는 표로 바뀌어 flow-1 · 2 · 5 · 6 은 11-23 지움.
 */
export const sample = (name: string) => `/images/partners-landing/${name}.jpg`;

/**
 * 콜라보 구성 카드 글 · 사진 — 소개 · 브랜드 협업 구성 페이지만(11-23 사용자 문구를 다듬음). 순서 · 키는 COLLAB_SCOPE_ITEMS 그대로.
 * 사진은 11-23 사용자가 public/images 에 넣은 collabo_1~6(모두 jpg, 소모품만 collabo_33 — 11-23에 여러 번 바꿨다) — 예전 Pexels format-*.jpg 를 바꿨다.
 * 매장 "가능 범위"(내 매장 · 어드민 · 매장 팝업 · 서버 scope_text)의 짧은 이름 · 설명은 바꾸지 않았다.
 */
export const FORMAT_COPY: Record<
  CollabScopeKey,
  { label: string; desc: string; image: string; position?: string }
> = {
  print: {
    image: "/images/collabo_1.jpg",
    label: "브랜드 홍보물",
    desc: "입구에는 포스터를, 테이블에는 안내 카드를 놓아 콜라보를 알립니다.",
  },
  goods: {
    image: "/images/collabo_2.jpg",
    label: "브랜드 굿즈 · 샘플",
    desc: "음료를 건넬 때 브랜드 굿즈나 제품 샘플을 함께 전합니다.",
  },
  supplies: {
    // 11-23 collabo_33.jpg 도 써 봤지만 사용자가 collabo_3.jpg 로 정함(33은 커밋 안 함). 세로 4:5 사진이 정사각형 칸에 들어간다 —
    // 가운데로 자르면 컵 바닥이 칸 끝에 걸려 조금 아래쪽을 남긴다(위 Nuvanilla 포스터 글자는 보이게).
    image: "/images/collabo_3.jpg",
    position: "50% 70%",
    label: "브랜드 소모품",
    desc: "음료를 받아 들 때 보이도록 컵홀더와 포장 스티커에 브랜드를 담습니다.",
  },
  dp: {
    image: "/images/collabo_4.jpg",
    label: "제품 전시 · 체험",
    desc: "매장 한편에 제품과 테스터를 두어 고객이 직접 써 보게 합니다.",
  },
  menu: {
    image: "/images/collabo_5.jpg",
    label: "협업 메뉴",
    desc: "매장의 시그니처 음료나 디저트를 브랜드와 함께 한정 메뉴로 선보입니다.",
  },
  space: {
    image: "/images/collabo_6.jpg",
    label: "공간 연출",
    desc: "쇼윈도나 좌석 한 구역을 브랜드 테마로 꾸며 머물며 사진 찍는 공간을 만듭니다.",
  },
};

/**
 * 콜라보 구성 카드 묶음 — 같은 크기 카드 격자(PC 셋 · 태블릿 둘 · 휴대폰 하나), 사진 칸은 모두 세로 4:5(FORMAT_PHOTO).
 * 11-23 사용자: 바둑판(넓은 · 좁은 칸)에서 세로 사진이 잘림 → 사진 비율대로 엇갈려 쌓기 → "높이가 다 맞았으면" → 세로 칸(4:5)으로 고름.
 * 세로 사진(홍보물 · 전시 · 메뉴)은 안 잘리고, 공간 연출은 양옆 조금, 가로 사진(굿즈 · 소모품)은 양옆이 절반 가까이 잘린다
 * (사용자에게 알림 — 세로 사진으로 다시 주면 다 안 잘린다).
 */
export const FORMAT_GRID =
  "mt-[40px] grid gap-[12px] sm:mt-[64px] sm:grid-cols-2 sm:gap-[16px] lg:grid-cols-3";
export const FORMAT_PHOTO = "aspect-[4/5] w-full";

/** 구역 제목 — 모든 구역이 같은 크기. */
export const H2 =
  "text-[28px] leading-[1.32] font-bold tracking-[-0.03em] break-keep text-gray-900 sm:text-[38px]";
/** 구역 설명. */
export const LEAD =
  "text-[15px] leading-[1.75] break-keep text-gray-500 sm:text-[16px]";
/**
 * 첫 화면 아래 본문 상자 — 1120px, 구역 사이는 넓게. 휴대폰은 아래 탭 바만큼 더 띄운다.
 * 하위 페이지는 첫 화면이 낮아 위 여백 · 구역 사이를 조금 줄인다(compact).
 */
export function bodyClass(compact = false) {
  return cn(
    // 아래 여백 — 맨 끝 "맨 위로" 아래(11-24 사용자 "좁혀줘": 40 · 72 → 32 · 40px).
    "mx-auto flex w-full max-w-[1120px] flex-col px-[16px] pb-[calc(32px+var(--partners-tabbar-space,0px))] sm:px-[24px] sm:pb-[40px]",
    compact
      ? "gap-[96px] pt-[72px] sm:gap-[160px] sm:pt-[120px]"
      : "gap-[120px] pt-[96px] sm:gap-[200px] sm:pt-[160px]",
  );
}

/** 누가 하는지(브랜드 · admix · 매장) — 아주 옅은 색 칩만(브랜드 보라 · 매장 노랑 · admix 회색, 11-13 판과 같은 짝). */
export type Actor = "brand" | "admix" | "partner";
export const ACTOR: Record<Actor, { label: string; className: string }> = {
  brand: {
    label: "브랜드",
    className:
      "bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300",
  },
  partner: {
    label: "매장",
    className:
      "bg-amber-50 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200",
  },
  admix: { label: "admix", className: "bg-gray-100 text-gray-700" },
};

export function ActorChips({
  who,
  className,
}: {
  who: Actor[];
  className?: string;
}) {
  return (
    <span className={cn("flex flex-wrap gap-[4px]", className)}>
      {who.map((a) => (
        <span
          key={a}
          className={cn(
            "rounded-full px-[8px] py-[2px] text-[12px] font-semibold whitespace-nowrap",
            ACTOR[a].className,
          )}
        >
          {ACTOR[a].label}
        </span>
      ))}
    </span>
  );
}

export function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

/** 구역 제목 위 작은 보라 글자(레퍼런스의 작은 머리) — 번호 없이 구역 이름만. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="mb-[12px] block text-[14px] font-semibold text-primary sm:mb-[16px] sm:text-[15px]">
      {children}
    </span>
  );
}

/**
 * 이미지 칸 — 회색 바탕 위에 사진을 칸 크기에 맞춰 채운다(object-cover). src 가 없으면 회색 칸 그대로
 * (11-19 사용자: 처음엔 "회색 배경으로 비워줘", 이어서 "샘플 이미지들을 넣어 줄 수 있어?"). data-image-slot 으로 찾기 쉽게.
 * 사진은 꾸밈이라 글로 읽지 않는다(aria-hidden · alt 빈칸) — 같은 내용이 옆 글에 있다.
 */
export function ImageSlot({
  src,
  sizes,
  priority = false,
  position,
  className,
}: {
  src?: string;
  sizes?: string;
  priority?: boolean;
  /** 칸이 사진보다 납작해 잘릴 때 어디를 남길지(object-position, 예: "50% 85%" — 아래쪽을 남김). 없으면 가운데. */
  position?: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      data-image-slot=""
      className={cn("relative overflow-hidden bg-gray-200", className)}
    >
      {src && (
        <Image
          src={src}
          alt=""
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
          style={position ? { objectPosition: position } : undefined}
        />
      )}
    </div>
  );
}

/**
 * 시작 버튼을 고르는 회원 정보 + 회원 유형 바꾸기 창(내 정보와 같은 창, 11-17 사용자: "페이지 이동 말고 팝업").
 * 광고주 · 제휴사로 바꾸면 내 정보를 다시 받아 버튼이 "대시보드로 가기"로 바뀐다(소개 첫 화면은 PartnersHome 이 대시보드로 옮겨 준다).
 * member — 서버에서 본 로그인 쿠키(회원 정보를 받기 전에도 가입 버튼 대신 유형 바꾸기를 고르게).
 */
export function useCollabStart(member: boolean) {
  const { data: me } = useMe();
  const collabMember = canUsePartners(me?.member_category);
  const otherMember = (member || !!me) && !collabMember;
  const [categoryOpen, setCategoryOpen] = useState(false);
  const modal = (
    <CategoryChangeModal
      open={categoryOpen}
      onOpenChange={setCategoryOpen}
      current={me?.member_category}
    />
  );
  return {
    collabMember,
    otherMember,
    openCategory: () => setCategoryOpen(true),
    modal,
  };
}

/**
 * 회원 유형별 시작 버튼 — 콜라보 회원은 대시보드, 다른 유형 회원은 회원 유형 바꾸기(창), 비회원은 브랜드 · 매장 가입.
 * only — 하위 페이지: 비회원에게 그 페이지 쪽 가입 버튼 하나만(브랜드 협업 구성 → 브랜드, 매장 참여 방법 → 매장).
 */
export function StartActions({
  onPhoto,
  collabMember,
  otherMember,
  onChangeCategory,
  only,
}: {
  onPhoto: boolean;
  collabMember: boolean;
  otherMember: boolean;
  onChangeCategory: () => void;
  only?: "advertiser" | "partner";
}) {
  if (collabMember)
    return (
      <CtaLink href={PARTNERS_DASHBOARD_HREF} onPhoto={onPhoto} solid>
        대시보드로 가기
      </CtaLink>
    );
  if (otherMember)
    return (
      <button
        type="button"
        onClick={onChangeCategory}
        className={ctaClass(true, onPhoto)}
      >
        회원 유형 바꾸기
        <CtaArrow />
      </button>
    );
  return (
    <>
      {only !== "partner" && (
        <CtaLink href={ADVERTISER_SIGNUP_HREF} onPhoto={onPhoto} solid>
          브랜드로 시작하기
        </CtaLink>
      )}
      {only !== "advertiser" && (
        <CtaLink href={PARTNER_SIGNUP_HREF} onPhoto={onPhoto} solid={!!only}>
          매장으로 시작하기
        </CtaLink>
      )}
    </>
  );
}

/**
 * 시작 버튼.
 * - 첫 화면 사진 위(onPhoto): solid 어두운 회색(사이트 어두운 버튼 · "맨 위로"와 같은 gray-800 #262a3d — 처음 넣은 남색은
 *   "이 사이트에서 자주 사용하는 어두운 색"으로 바꿈) · 아니면 흰색, 마우스를 올리면 둘 다 보라 바탕 + 흰 글(11-19 사용자).
 * - 아래 시작 띠(회색 카드): 첫 화면 버튼과 같은 짝 — solid 어두운 회색 · 아니면 흰 알약(회색 판 위라 옅은 테두리), 마우스를 올리면 보라.
 * 색은 hex 로 고정한 곳이 있다 — 회색 · 남색 토큰은 다크 모드에서 밝게 뒤집힌다.
 */
export function CtaLink({
  href,
  onPhoto,
  solid = false,
  children,
}: {
  href: string;
  onPhoto: boolean;
  solid?: boolean;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={ctaClass(solid, onPhoto)}>
      {children}
      <CtaArrow />
    </Link>
  );
}

export function ctaClass(solid: boolean, onPhoto: boolean) {
  return cn(
    "group inline-flex h-[42px] cursor-pointer items-center gap-[6px] rounded-full border px-[16px] text-[13px] font-semibold whitespace-nowrap transition-colors sm:h-[52px] sm:px-[26px] sm:text-[15px]",
    onPhoto
      ? solid
        ? "border-transparent bg-[#262a3d] text-white hover:bg-primary"
        : "border-transparent bg-white text-[#16131f] hover:bg-primary hover:text-white"
      : solid
        ? "border-transparent bg-[#262a3d] text-white hover:bg-primary"
        : "border-gray-200 bg-white text-[#16131f] hover:border-transparent hover:bg-primary hover:text-white",
  );
}

export function CtaArrow() {
  return (
    <ArrowLeftIcon className="size-[14px] rotate-180 transition-transform group-hover:translate-x-[2px] sm:size-[16px]" />
  );
}

/**
 * 시작 띠 — 판 없이 위에 가는 회색 선 하나, 그 아래 왼쪽 제목 · 오른쪽 버튼(휴대폰은 제목 아래 버튼). 회원 유형별 버튼은 StartActions.
 * 11-24 사용자: 진한 보라 띠 "너무 쨍한 느낌" → 옅은 보라 판 "보라색이 너무 많아" → 먹색 판 "너무 뜬금없는 느낌" → 회색 카드
 * "다른 거랑 너무 겹쳐" → 보라 · 노랑 그러데이션(테두리 없이 · 옅은 그림자) "좀 화려한 느낌?" → 시안 셋 중 "판 없이 위 선만".
 */
export function StartBand({
  title = "admix 콜라보, 지금 시작",
  actions,
}: {
  title?: string;
  actions: ReactNode;
}) {
  return (
    <Reveal>
      <section className="flex flex-col gap-[20px] border-t border-gray-200 pt-[32px] sm:pt-[40px] lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-[20px] leading-[1.4] font-bold tracking-[-0.02em] break-keep text-gray-900 sm:text-[24px]">
          {title}
        </h2>
        {/* 버튼은 늘 가로 한 줄(11-23 사용자 "가로로 배치해 줘" — 좁은 휴대폰에서 줄이 넘어가 세로로 쌓였다).
            휴대폰은 버튼이 폭을 반씩 나눠 갖고 좌우 여백을 줄인다. 아주 좁으면(380px 미만) 화살표를 뺀다. */}
        <div className="flex flex-row flex-nowrap items-center gap-[8px] max-sm:*:min-w-0 max-sm:*:flex-1 max-sm:*:justify-center max-sm:*:px-[10px] max-[379px]:[&_svg]:hidden">
          {actions}
        </div>
      </section>
    </Reveal>
  );
}

/**
 * 맨 위로 — 이 화면은 창이 아니라 본문(main)이 스크롤되므로, 소개를 감싼 칸에서 위로 올라가며 스크롤되는 상자를 찾아 올린다
 * (없으면 창). 반투명 흰 바탕(50% — 70% → 90%("투명도를 좀 더 줄여줘"를 불투명하게로 잘못 읽음) → "더 투명하게") + 검은 글자(11-24 사용자 — 예전엔 남색 기운의 진한 회색, 11-13 "회색이나 남색으로").
 * 위아래 간격은 휴대폰 32px · 그 위 40px(11-24 사용자 "위 아래 영역이 너무 넓은데 좀 좁혀줘" — 예전 위 72~80 · 아래 40~72px).
 * 위 간격 = 본문 사이(bodyClass gap) − 끌어올림이라 compact(하위 안내 페이지) 여부를 받는다. 아래는 bodyClass pb.
 * 첫 화면(target 의 첫 자식 — 영상 · 사진 머리)을 지나 내려가면 나타나 화면 아래에 붙어 있다(11-24 사용자). sticky 라
 * 본문 칸 가운데에 서고, 맨 끝에 닿으면 원래 자리(띠 아래)에 멈춘다. 첫 화면이 보이는 동안은 숨기고 눌리지도 않게(inert).
 */
export function BackToTop({
  target,
  compact = false,
}: {
  target: RefObject<HTMLElement | null>;
  compact?: boolean;
}) {
  const goTop = () => {
    const behavior = scrollBehavior();
    let el = target.current?.parentElement ?? null;
    while (el) {
      const { overflowY } = getComputedStyle(el);
      if (
        /(auto|scroll)/.test(overflowY) &&
        el.scrollHeight > el.clientHeight
      ) {
        el.scrollTo({ top: 0, behavior });
        return;
      }
      el = el.parentElement;
    }
    window.scrollTo({ top: 0, behavior });
  };
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const hero = target.current?.firstElementChild;
    if (!hero) return;
    const io = new IntersectionObserver(([e]) => setShown(!e.isIntersecting));
    io.observe(hero);
    return () => io.disconnect();
  }, [target]);
  return (
    <div
      inert={!shown}
      className={cn(
        // 칸 전체는 클릭을 통과시키고 버튼만 받는다 — 붙어 있는 동안 아래 카드 · 버튼을 가리지 않게.
        "pointer-events-none sticky bottom-[calc(16px+var(--partners-tabbar-space,0px))] z-20 flex justify-center transition-[opacity,translate] duration-300 ease-out sm:bottom-[24px] motion-reduce:transition-none",
        compact ? "-mt-[64px] sm:-mt-[120px]" : "-mt-[88px] sm:-mt-[160px]",
        shown ? "translate-y-0 opacity-100" : "translate-y-[12px] opacity-0",
      )}
    >
      <Button
        variant="ghost"
        onPress={goTop}
        className="pointer-events-auto h-[44px] gap-[6px] rounded-full bg-white/50 px-[20px] text-[14px] font-semibold text-[#16131f] shadow-[0_4px_14px_rgba(22,19,31,0.12)] ring-1 ring-black/5 backdrop-blur-md transition-colors data-[hovered=true]:bg-white"
      >
        <ArrowUpIcon className="size-[16px]" />맨 위로
      </Button>
    </div>
  );
}

/** 스크롤 등장 — 처음엔 32px 아래 · 투명, 화면에 들어오면 0.9초 동안 제자리로. */
const REVEAL_BASE =
  "transition-[opacity,translate] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none";

/**
 * 스크롤해 화면에 들어오면 밑에서 슥 올라오며 나타나게(11-13 사용자: "스크롤 내릴 때 하나씩 … 밑에서 슥 올라오는 것처럼").
 * 15%쯤 보이면 시작하고, 한 번 나타나면 그대로 둔다. delay(ms): 나란한 것들을 하나씩 차례로. 움직임 줄이기면 처음부터 보인다.
 */
export function useReveal<T extends HTMLElement>(delay = 0) {
  // 요소는 콜백 ref 로 받는다 — 렌더 중에 ref 객체를 넘기지 않게(react-hooks/refs).
  const [el, ref] = useState<T | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
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
  return [ref, { style, className }] as const;
}

export function Reveal({
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
