"use client";

import { Toast } from "@heroui/react";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

import { CheckCircleFilledIcon } from "@/components/icons";
import type { ProposalSummary } from "@/hooks/proposals";
import { cn } from "@/lib/utils";

/** 제안서 담기 완료 토스트가 떠 있는 시간. */
const PROPOSAL_ADDED_TOAST_TIMEOUT = 5000;

/** 카드에 이름을 보여 줄 매체 수 — 넘치면 "외 N개"로 줄인다. */
const MAX_MEDIA_NAMES = 3;

type ProposalAddedToastContent = { proposals: ProposalSummary[] };

// 앱 알림(useSonner, 위 가운데 검정 토스트)과 모양·위치가 달라 큐를 따로 둔다.
// 닫힐 때 0.3초 동안 사라지므로 그보다 조금 길게 붙들어 둔다(기본 0.3초면 끝 프레임이 잘린다).
const proposalAddedToastQueue = new Toast.Queue<ProposalAddedToastContent>({
  exitDuration: 350,
});

/** 매체를 제안서에 담은 뒤 — 담긴 제안서들의 요약을 왼쪽 아래에 5초 띄운다. */
export function showProposalAddedToast(proposals: ProposalSummary[]) {
  proposalAddedToastQueue.add(
    { proposals },
    { timeout: PROPOSAL_ADDED_TOAST_TIMEOUT },
  );
}

/** 모바일에서 토스트 높이의 이 비율 이상 끌어내리면 닫는다. 덜 끌면 제자리로 돌아간다. */
const SWIPE_CLOSE_RATIO = 0.5;

const isMobile = () => window.matchMedia("(max-width: 639px)").matches;

/**
 * 모바일 — 토스트를 아래로 쓸어내려 닫는다(바텀시트처럼). 손가락을 따라 내려가고,
 * 토스트 높이의 절반 이상 끌어내렸으면 닫고, 아니면 제자리로 돌아간다.
 * HeroUI 토스트는 위치를 transform으로 움직이므로, 끄는 거리는 따로 노는 CSS translate에 준다
 * (등장·퇴장 애니메이션과 부딪히지 않고, 닫힐 때는 끌린 자리에서 이어서 사라진다).
 */
function useSwipeDownToClose(onClose: () => void) {
  const drag = useRef<{
    el: HTMLElement;
    startY: number;
    dy: number;
  } | null>(null);

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType !== "touch" || !isMobile()) return;
    // 스크롤되는 카드 목록 안에서 시작한 터치는 목록 스크롤에 맡긴다(토스트가 같이 끌려 들썩이지 않게).
    const scroller = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-swipe-scroll]",
    );
    if (scroller && scroller.scrollHeight > scroller.clientHeight + 1) return;
    const el = e.currentTarget.closest<HTMLElement>('[data-slot="toast"]');
    if (!el) return;
    drag.current = { el, startY: e.clientY, dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    // 위로는 끌리지 않는다(아래로만).
    d.dy = Math.max(0, e.clientY - d.startY);
    d.el.style.translate = `0 ${d.dy}px`;
  };

  const onPointerEnd = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (
      e.type === "pointerup" &&
      d.dy >= d.el.offsetHeight * SWIPE_CLOSE_RATIO
    ) {
      onClose();
      return;
    }
    d.el.animate([{ translate: `0 ${d.dy}px` }, { translate: "0 0" }], {
      duration: 200,
      easing: "ease-out",
    });
    d.el.style.translate = "";
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: onPointerEnd,
    onPointerCancel: onPointerEnd,
  };
}

/** 목록이 넘쳐 스크롤이 생겼는지 — 넘칠 때만 목록 안에서의 세로 끌기를 스크롤에 양보한다. */
function useOverflowing(ref: RefObject<HTMLElement | null>) {
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setOverflowing(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    // 목록 칸 크기는 그대로인데 안의 카드 높이만 바뀌는 경우도 잡는다.
    Array.from(el.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [ref]);
  return overflowing;
}

const won = (value: number) => `${value.toLocaleString()}원`;

const pad = (n: number) => String(n).padStart(2, "0");

/** 시안 표기 "2026.08.30". */
function formatDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

function ProposalCard({ proposal }: { proposal: ProposalSummary }) {
  const created = formatDate(proposal.created_at ?? proposal.updated_at);
  // 새로 담긴 순 — 담긴 시각이 없는(예전 응답) 매체는 뒤로.
  const names = [...(proposal.preview_items ?? [])]
    .sort(
      (a, b) =>
        (b.created_at ? Date.parse(b.created_at) : 0) -
        (a.created_at ? Date.parse(a.created_at) : 0),
    )
    .map((item) => item.name);
  const hiddenCount = names.length - MAX_MEDIA_NAMES;
  // 예전 응답(금액 분리 전)은 total_amount가 광고비 합계다 — 제안서 목록(toView)과 같은 기준.
  const adAmount = proposal.advertisement_amount ?? proposal.total_amount;
  const productionAmount = proposal.production_amount ?? 0;

  return (
    <div className="flex w-full flex-col gap-[12px] rounded-[16px] border border-[#ececef] bg-[#f9fafb] p-[14px]">
      <div className="flex min-w-0 flex-col gap-[4px]">
        <p className="truncate text-[16px] font-bold text-[#18181b]">
          {proposal.title}
        </p>
        <p className="text-[12px] text-[#71717a]">
          {created && `${created} 생성 · `}
          {proposal.media_count}개 매체 포함
        </p>
      </div>
      {names.length > 0 && (
        <ul className="flex flex-col gap-[8px]">
          {names.slice(0, MAX_MEDIA_NAMES).map((name, i) => (
            <li key={i} className="flex items-center gap-[8px]">
              <span
                aria-hidden
                className="size-[6px] shrink-0 rounded-full bg-[#a33bd1]"
              />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#18181b]">
                {name}
              </span>
            </li>
          ))}
          {hiddenCount > 0 && (
            <li className="pl-[14px] text-[12px] text-[#71717a]">
              외 {hiddenCount}개 매체
            </li>
          )}
        </ul>
      )}
      <div className="flex flex-col gap-[8px] rounded-[16px] border border-[#ececef] bg-white px-[14px] py-[12px] whitespace-nowrap">
        <div className="flex items-center justify-between font-medium">
          <span className="text-[12px] text-[#71717a]">광고비</span>
          <span className="text-[14px] text-[#18181b]">{won(adAmount)}</span>
        </div>
        <div className="flex items-center justify-between font-medium">
          <span className="text-[12px] text-[#71717a]">제작비</span>
          <span className="text-[14px] text-[#18181b]">
            {won(productionAmount)}
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-[#ececef] pt-[8px] text-[14px] font-bold text-[#18181b]">
          <span>총 예상 비용</span>
          <span>{won(adAmount + productionAmount)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 시안 "02. 매체 상세 - 제안서 담기 완료" — 흰 카드(곡률 20px) 왼쪽 아래 30px.
 * HeroUI 토스트 기본 모양과 globals.css의 검정 토스트 덮어쓰기는 유틸리티 클래스로 되돌린다.
 */
export function ProposalAddedToastProvider() {
  return (
    <Toast.Provider
      queue={proposalAddedToastQueue}
      placement="bottom start"
      width={333}
      hotkey={[]}
      className="sm:start-[30px] sm:bottom-[30px]"
    >
      {({ toast }) => <ProposalAddedToastItem toast={toast} />}
    </Toast.Provider>
  );
}

function ProposalAddedToastItem({
  toast,
}: {
  toast: { key: string; content: ProposalAddedToastContent };
}) {
  const swipe = useSwipeDownToClose(() =>
    proposalAddedToastQueue.close(toast.key),
  );
  const listRef = useRef<HTMLDivElement>(null);
  const listOverflowing = useOverflowing(listRef);

  return (
    <Toast
      toast={toast}
      className={cn(
        "gap-0 rounded-[20px] bg-white p-0 leading-[normal] shadow-[0px_4px_7px_0px_rgba(0,0,0,0.25)] backdrop-blur-none",
        // HeroUI 기본 퇴장은 자기 높이만큼 내려가며 0.15초에 사라져, 키 큰 이 카드는 뚝 끊겨 보인다.
        // 24px만 내려가며 0.3초 동안 고르게 흐려지게 한다.
        "data-[exiting=true]:[--toast-enter:-24px] data-[exiting=true]:[--toast-ease:ease-in-out] data-[exiting=true]:[--toast-opacity-duration:300ms] data-[exiting=true]:[--toast-translate-duration:300ms]",
      )}
    >
      {/* 토스트 안에 포커스가 있으면 HeroUI가 타이머를 멈춘다(키보드 사용자용).
              마우스로 누르기만 해도 포커스가 들어가 안 사라지므로, 손을 떼면 포커스를 놓는다.
              글자 드래그 선택은 그대로 남는다. */}
      {/* 모바일은 아래로 쓸어내려 닫는다 — 브라우저가 세로 끌기를 스크롤로 가져가지 않게 touch-none.
              카드 목록이 넘칠 때만 목록 안은 스크롤(touch-pan-y)에 양보한다. */}
      <div
        className="flex w-full flex-col p-[10px] max-sm:touch-none"
        onPointerDown={swipe.onPointerDown}
        onPointerMove={swipe.onPointerMove}
        onPointerCancel={swipe.onPointerCancel}
        onPointerUp={(e) => {
          swipe.onPointerUp(e);
          const active = document.activeElement;
          if (
            active instanceof HTMLElement &&
            e.currentTarget.closest('[data-slot="toast"]')?.contains(active)
          ) {
            active.blur();
          }
        }}
      >
        {/* 모바일 — 쓸어내릴 수 있음을 알리는 손잡이. */}
        <span
          aria-hidden
          className="mx-auto h-[4px] w-[36px] shrink-0 rounded-full bg-[#d4d4d8] sm:hidden"
        />
        <div className="flex items-center gap-[10px] p-[10px]">
          <CheckCircleFilledIcon className="shrink-0 text-[#16a34a]" />
          <p className="text-[13px] font-medium text-[#111827]">
            제안서에 추가되었습니다
          </p>
        </div>
        <div className="flex w-full flex-col gap-[8px] p-[10px]">
          <span className="self-start rounded-full border border-[#ededef] bg-[#f7f3fe] px-[8px] py-[4px] text-[10px] font-semibold text-[#a33bd1]">
            {toast.content.proposals.length}개 제안서
          </span>
          <div
            ref={listRef}
            data-swipe-scroll
            // overscroll-contain: 목록 끝에서 더 밀어도 뒤 화면이 따라 스크롤되지 않게 한다.
            className={cn(
              "flex max-h-[min(60vh,480px)] flex-col gap-[8px] overflow-y-auto overscroll-contain",
              listOverflowing && "max-sm:touch-pan-y",
            )}
          >
            {toast.content.proposals.map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal} />
            ))}
          </div>
        </div>
      </div>
      {/* 마우스를 올리면 오른쪽 위에 뜨는 닫기 — 앱 알림 토스트와 같은 HeroUI 기본 버튼. */}
      <Toast.CloseButton />
    </Toast>
  );
}
