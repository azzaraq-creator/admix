"use client";

import { Button } from "@heroui/react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

import { XIcon } from "@/components/icons";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { cn } from "@/lib/utils";

/**
 * 페이지 온보딩 — 화면의 요소를 하나씩 밝혀(스포트라이트) 옆에 설명 카드를 띄운다.
 * 페이지마다 usePageTour(id, steps)로 등록만 하면 된다. 처음 들어왔을 때 한 번 저절로 뜨고,
 * 그 뒤로는 LNB(PC)·상단바(모바일)의 "가이드" 버튼(openPageTour)으로 언제든 다시 본다.
 *
 * 단계의 target은 data-tour 값 — 같은 역할의 요소가 PC·모바일에 따로 있으면 여러 개를 넘기고,
 * 그중 지금 화면 안에 보이는 첫 번째를 밝힌다(targetAll이면 보이는 것을 모두 감싸 밝힌다).
 * 하나도 없으면 가운데에 카드만 띄운다.
 *
 * 단계마다 화면을 바꿔야 하면(예: 예시 매체 창 띄우기) 단계에 id를 주고, 페이지가
 * useActivePageTourStep()으로 지금 단계를 보고 그린다. 대상이 늦게 생겨도 생기는 대로 따라간다.
 */
export type TourStep = {
  /** 페이지가 지금 단계를 알아볼 이름(useActivePageTourStep). */
  id?: string;
  target: string | string[];
  /** 보이는 대상을 모두 감싸 한 자리로 밝힌다(여러 줄에 걸친 영역). */
  targetAll?: boolean;
  title: string;
  body: ReactNode;
  /** 모바일(sm 미만) 문구가 다를 때. */
  mobileBody?: ReactNode;
  /** 터치 화면(iPad 등 sm 이상)에서 문구가 다를 때 — 예: "마우스를 올리면" 대신 "누르면". */
  touchBody?: ReactNode;
  /** 밝힌 자리의 곡률 — 대상의 곡률 + 여백(PADDING)에 맞춘다. */
  radius?: number;
};

const STORAGE_PREFIX = "admix-tour:";
/** 밝힌 자리를 대상보다 이만큼 넓힌다. */
const PADDING = 6;
/** 카드와 밝힌 자리 사이. */
const GAP = 12;
/** 카드와 화면 가장자리 사이. */
const EDGE = 16;
const CARD_WIDTH = 320;
/** 단계를 바꾼 뒤 대상 자리가 이만큼(프레임) 그대로면 자리를 잡은 것으로 보고 옮긴다. */
const SETTLE_FRAMES = 5;
/** 대상이 계속 움직여도(애니메이션 등) 이만큼 지나면 옮긴다. */
const SETTLE_MAX_MS = 800;
/** 처음 들어왔을 때 화면이 자리를 잡은 뒤(글꼴·애니메이션) 띄운다. */
const AUTO_OPEN_DELAY_MS = 600;

type Rect = { top: number; left: number; width: number; height: number };

const sameRect = (a: Rect | null, b: Rect | null) =>
  a === b ||
  (!!a &&
    !!b &&
    a.top === b.top &&
    a.left === b.left &&
    a.width === b.width &&
    a.height === b.height);

const TOUCH_QUERY = "(pointer: coarse)";

/** 손가락으로 쓰는 화면(iPad 등) — 마우스 올리기(hover)가 없다. 서버 렌더에서는 마우스로 본다. */
function useIsTouchScreen(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(TOUCH_QUERY);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(TOUCH_QUERY).matches,
    () => false,
  );
}

/** 지금 보이는 대상들 — all이 아니면 첫 번째 하나만. */
function findTargets(step: TourStep): HTMLElement[] {
  const keys = Array.isArray(step.target) ? step.target : [step.target];
  const found: HTMLElement[] = [];
  for (const key of keys) {
    for (const el of document.querySelectorAll<HTMLElement>(
      `[data-tour="${key}"]`,
    )) {
      const r = el.getBoundingClientRect();
      // 숨긴 요소(display: none → 0×0)와 왼쪽 화면 밖으로 밀어 둔 요소(닫힌 모바일 드로어)는 건너뛴다.
      // 오른쪽 밖은 넘겨 보는 표 안일 수 있어 찾는다 — 처음 찾을 때 scrollIntoView가 표를 옆으로 넘긴다.
      if (r.width > 0 && r.height > 0 && r.right > 0) {
        if (!step.targetAll) return [el];
        found.push(el);
      }
    }
  }
  return found;
}

function unionRect(els: HTMLElement[]): Rect | null {
  if (els.length === 0) return null;
  const rects = els.map((el) => el.getBoundingClientRect());
  const top = Math.min(...rects.map((r) => r.top));
  const left = Math.min(...rects.map((r) => r.left));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  const right = Math.max(...rects.map((r) => r.right));
  return { top, left, width: right - left, height: bottom - top };
}

/**
 * 지금 화면에 등록된 가이드와 열림 상태 — 페이지(usePageTour)가 등록하고, 화면 틀의 가이드
 * 버튼(useCurrentPageTour)과 PageTourHost가 같이 본다. 가이드가 없는 페이지는 등록이 없어
 * 버튼도 뜨지 않는다.
 */
type Registration = {
  id: string;
  steps: TourStep[];
  onStart?: () => boolean | void;
  next?: PageTourNext | null;
  onClose?: () => void;
};

/** 마지막 단계에서 다른 화면의 가이드로 이어 간다(예: 기획안 목록 → 예시 기획안 상세). */
export type PageTourNext = {
  /** 마지막 단계 버튼 글자(기본 "시작하기" 대신). */
  label: string;
  href: string;
  /** 이어 갈 가이드 id — 그 화면이 이 id로 usePageTour를 부르면 바로 연다. */
  tourId: string;
};

export type PageTourOptions = {
  /**
   * 열기 직전에 화면을 첫 단계에 맞춰 둘 때(예: 대시보드를 AI 모드로). false를 돌려주면 열지 않는다
   * (예: 다른 화면으로 옮겨 가서 열 때).
   */
  onStart?: () => boolean | void;
  /** 처음 들어왔을 때 저절로 열지 — 기본 true(한 번만), "always"면 들어올 때마다, false면 열지 않는다. */
  autoOpen?: boolean | "always";
  /** 마지막 단계에서 이어 갈 가이드(없으면 null). */
  next?: PageTourNext | null;
  /** 가이드를 닫은 뒤(끝까지 보든 건너뛰든). 다음 가이드로 이어 갈 때는 부르지 않는다. */
  onClose?: () => void;
};

/** 다른 화면으로 넘어가서 이어 열 가이드 id — 넘어간 화면이 같은 id로 등록하면 바로 연다. */
const CONTINUE_KEY = "admix-tour:continue";

/** 화면을 옮긴 뒤 그 화면의 가이드를 바로 열게 표시해 둔다. */
export function continuePageTour(tourId: string) {
  sessionStorage.setItem(CONTINUE_KEY, tourId);
}

let current: Registration | null = null;
let isOpen = false;
/** 열린 가이드의 지금 단계 id — 페이지가 단계에 맞춰 예시 화면을 띄우는 데 쓴다. */
let activeStep: string | null = null;
/** 화면에 보이는(자리를 잡아 밝힌 자리·카드가 옮겨 간) 단계 id — 예시 화면을 이때 같이 드러낸다. */
let shownStep: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (callback: () => void) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

/**
 * 페이지 가이드 등록 — 이 페이지가 떠 있는 동안 가이드 버튼이 이 단계들을 연다.
 * 처음 들어오면 한 번 저절로 열고, 닫으면(끝까지 보든 건너뛰든) 다시 저절로 열지 않는다.
 * steps는 바뀔 때마다 다시 등록하므로 컴포넌트 밖 상수로 둔다.
 * 다른 화면의 가이드에서 이어 오면(continuePageTour) 저절로 열기 설정과 상관없이 바로 연다.
 */
export function usePageTour(
  id: string,
  steps: TourStep[],
  options: PageTourOptions = {},
) {
  const { autoOpen = true, next = null } = options;
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    const registration: Registration = {
      id,
      steps,
      onStart: () => optionsRef.current.onStart?.(),
      next,
      onClose: () => optionsRef.current.onClose?.(),
    };
    current = registration;
    emit();
    const continued = sessionStorage.getItem(CONTINUE_KEY) === id;
    if (continued) sessionStorage.removeItem(CONTINUE_KEY);
    const shouldOpen =
      continued ||
      autoOpen === "always" ||
      (autoOpen && localStorage.getItem(STORAGE_PREFIX + id) !== "done");
    const timer = shouldOpen
      ? setTimeout(openPageTour, AUTO_OPEN_DELAY_MS)
      : undefined;
    return () => {
      clearTimeout(timer);
      if (current !== registration) return;
      current = null;
      isOpen = false;
      emit();
    };
    // next는 값(글자·주소)이 같으면 다시 등록하지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, steps, autoOpen, next?.href, next?.label, next?.tourId]);
}

/** 지금 화면에 가이드가 있는지 — 없으면 가이드 버튼을 숨긴다. */
export function useHasPageTour() {
  return useSyncExternalStore(
    subscribe,
    () => current !== null,
    () => false,
  );
}

/** 열린 가이드의 지금 단계 id(TourStep.id) — 닫혀 있거나 id 없는 단계면 null. */
export function useActivePageTourStep() {
  return useSyncExternalStore(
    subscribe,
    () => activeStep,
    () => null,
  );
}

function setActiveStep(id: string | null) {
  if (activeStep === id) return;
  activeStep = id;
  emit();
}

/**
 * 화면에 보이는 단계 id — 단계를 바꾸면 새 대상이 자리를 잡을 때까지 이전 단계가 보이다가, 밝힌 자리·카드가
 * 옮겨 갈 때 바뀐다. 예시 화면은 useActivePageTourStep으로 먼저 그려 두고(자리를 재야 하니까) 이 값이 될 때
 * 드러내면, 예시가 먼저 뜨고 나서 밝힌 자리가 따라가는 어색함 없이 함께 움직인다.
 */
export function useShownPageTourStep() {
  return useSyncExternalStore(
    subscribe,
    () => shownStep,
    () => null,
  );
}

function setShownStep(id: string | null) {
  if (shownStep === id) return;
  shownStep = id;
  emit();
}

export function openPageTour() {
  if (!current) return;
  if (current.onStart?.() === false) return;
  isOpen = true;
  emit();
}

function closePageTour() {
  const closing = current;
  if (closing) localStorage.setItem(STORAGE_PREFIX + closing.id, "done");
  isOpen = false;
  emit();
  closing?.onClose?.();
}

/** 마지막 단계에서 다음 화면의 가이드로 — 이 가이드는 본 것으로 두고 화면을 옮긴다. */
function continueToNext(navigate: (href: string) => void) {
  const closing = current;
  if (!closing?.next) return;
  localStorage.setItem(STORAGE_PREFIX + closing.id, "done");
  continuePageTour(closing.next.tourId);
  isOpen = false;
  emit();
  navigate(closing.next.href);
}

/** 화면 틀(ClientShell)에 한 번 둔다 — 등록된 가이드가 열리면 그린다. */
export function PageTourHost() {
  const registration = useSyncExternalStore(
    subscribe,
    () => (isOpen ? current : null),
    () => null,
  );
  if (!registration || registration.steps.length === 0) return null;
  // 열 때마다 첫 단계부터 — 닫히면 언마운트되므로 단계 상태가 새로 시작된다.
  // key — 다른 페이지 가이드로 바뀌면 단계도 처음부터.
  return createPortal(
    <TourOverlay
      key={registration.id}
      steps={registration.steps}
      next={registration.next ?? null}
      onClose={closePageTour}
    />,
    document.body,
  );
}

function TourOverlay({
  steps,
  next: nextTour,
  onClose,
}: {
  steps: TourStep[];
  next: PageTourNext | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  // 화면에 보이는 단계 — 단계를 바꾸면 새 대상(예시 창·툴팁 등)이 자리를 잡을 때까지 이전 자리·카드를
  // 그대로 두었다가 한 번에 옮긴다(늦게 생기는 대상 때문에 두 번 움직이거나 글만 먼저 바뀌지 않게).
  const [shownIndex, setShownIndex] = useState<number | null>(null);
  // 처음 자리를 잡을 때는 미끄러지지 않고 그 자리에 바로 뜬다 — 다음 프레임부터 움직임을 켠다.
  const [animate, setAnimate] = useState(false);
  const firstShown = shownIndex !== null;
  useEffect(() => {
    if (!firstShown) return;
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, [firstShown]);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardHeight, setCardHeight] = useState(0);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const isDesktop = useIsDesktop();
  const isTouch = useIsTouchScreen();
  const titleId = useId();
  const bodyId = useId();

  const step = steps[index];
  const shownStep = steps[shownIndex ?? index];
  const last = index === steps.length - 1;

  // 대상 자리를 매 프레임 잰다 — 모드 전환·패널 애니메이션·스크롤·창 크기 변화를 따로 듣지 않아도
  // 밝힌 자리가 늘 대상에 붙어 있다. 값이 바뀔 때만 다시 그린다. 온보딩이 떠 있는 동안만 돈다.
  // 대상이 단계에 맞춰 늦게 생기면(예시 창) 처음 찾은 때 한 번 화면 안으로 스크롤한다.
  useEffect(() => {
    let frame = 0;
    let scrolled = false;
    let settled = false;
    let stableFrames = 0;
    let candidate: Rect | null = null;
    const startedAt = performance.now();
    const tick = () => {
      const els = findTargets(step);
      if (els.length > 0 && !scrolled) {
        if (els.length === 1) {
          els[0].scrollIntoView({ block: "nearest", behavior: "smooth" });
        } else {
          // 여러 대상(넘겨 보는 표의 PPT·삭제 등)은 마지막 것을 먼저 들여온 뒤 첫 것을 맞춰 모두 보이게.
          els[els.length - 1].scrollIntoView({
            block: "nearest",
            inline: "nearest",
          });
          els[0].scrollIntoView({ block: "nearest", inline: "nearest" });
        }
        scrolled = true;
      }
      const next = unionRect(els);
      if (!settled) {
        stableFrames = sameRect(candidate, next) ? stableFrames + 1 : 0;
        candidate = next;
        if (
          stableFrames >= SETTLE_FRAMES ||
          performance.now() - startedAt > SETTLE_MAX_MS
        ) {
          settled = true;
          setShownIndex(index);
        }
      }
      // 자리를 잡은 뒤엔 매 프레임 따라간다(스크롤·창 크기 변화).
      if (settled) setRect((prev) => (sameRect(prev, next) ? prev : next));
      setViewport((prev) =>
        prev.w === window.innerWidth && prev.h === window.innerHeight
          ? prev
          : { w: window.innerWidth, h: window.innerHeight },
      );
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [step, index]);

  // 카드 높이에 따라 위·아래 자리를 고른다.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const measure = () => setCardHeight(card.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    primaryRef.current?.focus();
  }, [shownIndex]);

  // 지금 단계를 페이지에 알린다 — 닫히면(언마운트) 비운다.
  useEffect(() => {
    setActiveStep(step.id ?? null);
  }, [step.id]);
  useEffect(() => {
    if (shownIndex !== null) setShownStep(steps[shownIndex].id ?? null);
  }, [shownIndex, steps]);
  useEffect(
    () => () => {
      setActiveStep(null);
      setShownStep(null);
    },
    [],
  );

  const next = () => {
    if (!last) setIndex((i) => i + 1);
    else if (nextTour) continueToNext((href) => router.push(href));
    else onClose();
  };
  const prev = () => setIndex((i) => Math.max(0, i - 1));

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight")
        setIndex((i) => Math.min(steps.length - 1, i + 1));
      else if (event.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, steps.length]);

  const spot = rect && {
    top: rect.top - PADDING,
    left: rect.left - PADDING,
    width: rect.width + PADDING * 2,
    height: rect.height + PADDING * 2,
  };

  const cardWidth = Math.min(CARD_WIDTH, viewport.w - EDGE * 2);
  let cardStyle: CSSProperties;
  if (spot && viewport.w > 0) {
    const below = spot.top + spot.height + GAP;
    const above = spot.top - GAP - cardHeight;
    const right = spot.left + spot.width + GAP;
    const leftSide = spot.left - GAP - cardWidth;
    const centeredLeft = Math.min(
      Math.max(EDGE, spot.left + spot.width / 2 - cardWidth / 2),
      viewport.w - EDGE - cardWidth,
    );
    // 옆에 둘 때는 대상 위쪽에 맞추되 화면 안에 들어오게.
    const sideTop = Math.min(
      Math.max(EDGE, spot.top),
      viewport.h - EDGE - cardHeight,
    );
    // 아래 → 위 → 오른쪽 → 왼쪽 순으로 자리가 있는 곳, 다 없으면(큰 대상) 대상 안쪽 아래에 겹쳐 둔다.
    if (below + cardHeight <= viewport.h - EDGE)
      cardStyle = { top: below, left: centeredLeft, width: cardWidth };
    else if (above >= EDGE)
      cardStyle = { top: above, left: centeredLeft, width: cardWidth };
    else if (right + cardWidth <= viewport.w - EDGE)
      cardStyle = { top: sideTop, left: right, width: cardWidth };
    else if (leftSide >= EDGE)
      cardStyle = { top: sideTop, left: leftSide, width: cardWidth };
    else
      cardStyle = {
        top: Math.max(EDGE, viewport.h - EDGE - cardHeight),
        left: centeredLeft,
        width: cardWidth,
      };
  } else {
    cardStyle = {
      top: "50%",
      left: "50%",
      width: cardWidth || CARD_WIDTH,
      translate: "-50% -50%",
    };
  }

  return (
    // z-70: LNB(z-40)·AI 믹시 패널(z-50)보다 위. 뒤 화면은 누르지 못하게 판 전체가 막는다.
    <div
      className="fixed inset-0 z-[70]"
      onClick={(event) => event.stopPropagation()}
    >
      {spot ? (
        // 밝힌 자리 바깥을 큰 그림자로 어둡게 칠한다. 자리가 단계마다 미끄러져 옮겨 간다.
        <div
          aria-hidden
          className="pointer-events-none fixed shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] ring-2 ring-white/70 transition-[top,left,width,height,border-radius] duration-300 ease-out motion-reduce:transition-none"
          style={{ ...spot, borderRadius: shownStep.radius ?? 16 }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-black/50" />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className={cn(
          "fixed rounded-[20px] bg-white p-[20px] shadow-[0_8px_32px_rgba(0,0,0,0.18)]",
          animate &&
            "transition-[top,left] duration-300 ease-out motion-reduce:transition-none",
          !firstShown && "invisible",
        )}
        style={cardStyle}
      >
        <div className="flex items-start justify-between gap-[12px]">
          <p className="text-[12px] font-semibold text-primary-500">
            {(shownIndex ?? index) + 1} / {steps.length}
          </p>
          <button
            type="button"
            aria-label="가이드 닫기"
            onClick={onClose}
            className="-mt-[6px] -mr-[6px] flex size-[28px] shrink-0 items-center justify-center rounded-[8px] text-gray-400 transition-colors hover:bg-gray-50 hover:text-black"
          >
            <XIcon className="size-[14px]" />
          </button>
        </div>
        <h2
          id={titleId}
          className="mt-[4px] text-[16px] leading-[24px] font-bold text-black"
        >
          {shownStep.title}
        </h2>
        <p
          id={bodyId}
          className="mt-[6px] text-[14px] leading-[21px] break-keep text-[#52525b]"
        >
          {!isDesktop && shownStep.mobileBody
            ? shownStep.mobileBody
            : isTouch && shownStep.touchBody
              ? shownStep.touchBody
              : shownStep.body}
        </p>

        {/* 버튼이 셋(이전·시작하기·다음 가이드)이면 한 줄에 다 안 들어가 점은 위 줄로 내린다. */}
        <div className="mt-[18px] flex flex-wrap items-center justify-between gap-x-[8px] gap-y-[14px]">
          <div aria-hidden className="flex gap-[5px]">
            {steps.map((s, i) => (
              <span
                key={s.title}
                className={cn(
                  "h-[6px] rounded-full transition-[width,background-color] duration-300",
                  i === (shownIndex ?? index)
                    ? "w-[16px] bg-primary-500"
                    : "w-[6px] bg-gray-200",
                )}
              />
            ))}
          </div>
          <div className="ml-auto flex gap-[6px]">
            {index > 0 && (
              <Button variant="ghost" size="sm" onPress={prev}>
                이전
              </Button>
            )}
            {/* 마지막 단계에 이어 갈 가이드가 있으면 — 여기서 끝내기(시작하기)와 이어 가기를 함께 둔다. */}
            {last && nextTour && (
              <Button variant="outline" size="sm" onPress={onClose}>
                시작하기
              </Button>
            )}
            <Button ref={primaryRef} variant="primary" size="sm" onPress={next}>
              {last ? (nextTour?.label ?? "시작하기") : "다음"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
