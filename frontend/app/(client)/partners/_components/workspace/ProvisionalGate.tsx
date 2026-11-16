"use client";

import { Button, Modal } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import { MaskIcon } from "@/components/common/MaskIcon";
import { useMe } from "@/hooks/auth";
import { BIZ_LICENSE_ANCHOR } from "@/lib/partners";

/*
 * 임시 승인으로 들어온 제휴사(담당자가 현장에서 등록증 없이 넘겨 준 회원, 069) — 콜라보 목록은 보지만 상세 · 신청 · 확정은
 * 어드민이 인증 완료할 때까지 못 한다(2026-11-16 사용자). 등록증을 올려 검토 대기가 돼도 · 반려돼도 그대로 막는다.
 * 콜라보 상세로 가는 링크(목록 카드 · 대시보드 · 참여 이력 …)를 누르면 이동하지 않고 이 안내 창을 띄운다.
 * 주소로 바로 들어와도 상세 화면(CollabDetail)이 같은 창을 띄우고, 서버도 신청 · 확정을 막는다(collab_service).
 * 창 오른쪽 버튼(사업자등록증 올리기 · 다시 올리기 · 내 정보로 이동)은 내 정보의 사업자등록증 칸으로 스크롤(BIZ_LICENSE_ANCHOR).
 */

/** 내 정보의 사업자등록증 칸 — 열리면 그 칸으로 스크롤한다(ProfileView). */
export const PROFILE_BIZ_HREF = `/partners/profile#${BIZ_LICENSE_ANCHOR}`;

/** 콜라보 상세 주소 — /partners/collabs/{id}(광고주 새 의뢰 /new 는 뺀다). */
const COLLAB_DETAIL_PATH = /^\/partners\/collabs\/(?!new\/?$)[^/]+\/?$/;

// 창 열림 — 레이아웃의 창 하나를 상세 링크 · 알림 · 상세 화면이 같이 연다.
let gateOpen = false;
const listeners = new Set<() => void>();
function setGateOpen(open: boolean) {
  gateOpen = open;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** 막힌 까닭 — 임시 승인(등록증 아직) · 검토 중(올렸고 인증 전) · 반려. */
export type BizLock = "provisional" | "reviewing" | "rejected";

/**
 * 창 · 상세 자리 글 — 까닭마다. 제목은 사업자등록증 이야기인 걸 바로 알게, 본문은 "상세" 대신 "콜라보 내용",
 * 창 오른쪽 버튼은 할 일(올리기 · 다시 올리기, 검토 중엔 할 일이 없어 내 정보로 이동)(11-16 사용자).
 */
export const BIZ_LOCK_COPY: Record<
  BizLock,
  { title: string; body: string; action: string; inline: string; link: string }
> = {
  provisional: {
    title: "사업자등록증이 임시 승인 상태예요",
    body: "콜라보 내용을 보고 신청 · 확정하려면 사업자등록증을 올려 주세요. 담당자가 인증을 마치면 이용할 수 있어요.",
    action: "사업자등록증 올리기",
    inline: "사업자등록증이 임시 승인 상태라 콜라보 내용을 볼 수 없어요.",
    link: "내 정보에서 사업자등록증 올리기",
  },
  reviewing: {
    title: "사업자등록증을 확인하고 있어요",
    body: "담당자가 인증을 마치면 콜라보 내용을 보고 신청 · 확정할 수 있어요.",
    action: "내 정보로 이동",
    inline: "담당자가 사업자등록증 인증을 마치면 볼 수 있어요.",
    link: "내 정보에서 확인하기",
  },
  rejected: {
    title: "사업자등록증이 반려됐어요",
    body: "내 정보에서 반려 사유를 보고 다시 올려 주세요. 담당자가 인증을 마치면 콜라보 내용을 보고 신청 · 확정할 수 있어요.",
    action: "다시 올리기",
    inline: "사업자등록증이 반려돼 콜라보 내용을 볼 수 없어요.",
    link: "내 정보에서 다시 올리기",
  },
};

/**
 * 콜라보 상세 · 신청 · 확정이 막혔으면 그 까닭, 아니면 null.
 * 임시 승인 시각(provisional_at)은 등록증을 올려도 남아 있어(어드민 "미등록으로"만 지운다) 인증 완료 전까지 막는다.
 * 처음부터 등록증을 올린 회원(임시 승인 없이 검토 대기)은 예전처럼 막지 않는다 — 서버 collab_service 와 같은 규칙.
 */
export function useBizLock(): BizLock | null {
  const { data: me } = useMe();
  const reg = me?.business_registration;
  if (me?.member_category !== "partner" || !reg) return null;
  if (reg.status === "verified") return null;
  if (reg.status !== "provisional" && !reg.provisional_at) return null;
  if (reg.status === "reviewing" || reg.status === "rejected")
    return reg.status;
  // 임시 승인 · 올린 등록증을 취소해 미등록이 된 경우.
  return "provisional";
}

/**
 * 콜라보 상세로 가기 전에 — 막혔으면 안내 창을 열고 true(가지 말 것).
 * router.push 로 가는 곳(알림 · 진행 카드 버튼)이 쓴다. 링크(a)는 ProvisionalGate 가 알아서 막는다.
 */
export function useProvisionalGate() {
  const locked = useBizLock() !== null;
  return {
    locked,
    block: () => {
      if (locked) setGateOpen(true);
      return locked;
    },
  };
}

/** 상세 화면에 바로 들어왔을 때 — 화면이 열리자마자 안내 창을 띄운다. */
export function useOpenProvisionalGateOnMount() {
  useEffect(() => setGateOpen(true), []);
}

/** 콜라보 레이아웃에 하나 — 막혔으면 상세 링크를 막고 안내 창을 띄운다. */
export function ProvisionalGate() {
  const router = useRouter();
  const lock = useBizLock();
  const locked = lock !== null;
  const copy = BIZ_LOCK_COPY[lock ?? "provisional"];
  const isOpen = useSyncExternalStore(
    subscribe,
    () => gateOpen,
    () => false,
  );

  useEffect(() => {
    if (!locked) return;
    // window 캡처 단계 — HeroUI Link · next/link 의 클릭 처리보다 먼저 받아 이동을 막는다.
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const a =
        e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(a instanceof HTMLAnchorElement)) return;
      if (a.origin !== window.location.origin) return;
      if (!COLLAB_DETAIL_PATH.test(a.pathname)) return;
      e.preventDefault();
      e.stopPropagation();
      setGateOpen(true);
    };
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, [locked]);

  // 어드민이 인증 완료해 풀리면 열려 있던 창도 닫는다.
  useEffect(() => {
    if (!locked) setGateOpen(false);
  }, [locked]);

  return (
    <Modal.Backdrop isOpen={isOpen && locked} onOpenChange={setGateOpen}>
      <Modal.Container placement="center" size="sm">
        <Modal.Dialog aria-label="사업자 인증 안내">
          <Modal.CloseTrigger />
          <Modal.Header className="flex flex-col items-start gap-[10px] pr-[36px]">
            <span className="flex size-[44px] items-center justify-center rounded-[16px] bg-primary-50 text-primary-500">
              <MaskIcon src="/icons/file-text.svg" className="size-[20px]" />
            </span>
            <Modal.Heading className="text-[17px] font-bold break-keep text-gray-900">
              {copy.title}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p className="text-[14px] leading-[1.6] break-keep text-gray-600">
              {copy.body}
            </p>
          </Modal.Body>
          <Modal.Footer className="flex gap-[8px]">
            <Button
              variant="tertiary"
              onPress={() => setGateOpen(false)}
              className="h-[44px] flex-1 rounded-[19px] font-semibold"
            >
              닫기
            </Button>
            <Button
              onPress={() => {
                setGateOpen(false);
                router.push(PROFILE_BIZ_HREF);
              }}
              className="h-[44px] flex-1 rounded-[19px] font-bold"
            >
              {copy.action}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
