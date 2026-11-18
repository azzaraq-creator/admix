"use client";

import { Button, Modal } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import { MaskIcon } from "@/components/common/MaskIcon";
import { useMe } from "@/hooks/auth";
import {
  BIZ_LICENSE_ANCHOR,
  PARTNERS_DASHBOARD_HREF,
  advBizLockOf,
  type AdvBizLock,
} from "@/lib/partners";

/*
 * 사업자 인증 전 제휴사 — 콜라보 목록은 보지만 상세 · 신청 · 확정은 어드민이 인증 완료할 때까지 못 한다.
 * 처음엔 임시 승인 회원(069)만(2026-11-16), 11-18부터 검토 중 · 반려 · 미등록도 모두(사용자: "검토 중인 제휴사도 승인 전까지 막아줘").
 * 콜라보 상세로 가는 링크(목록 카드 · 대시보드 · 참여 이력 …)를 누르면 이동하지 않고 이 안내 창을 띄운다.
 * 주소로 바로 들어와도 상세 화면(CollabDetail)이 같은 창을 띄우고, 서버도 신청 · 확정을 막는다(collab_service).
 * 창 오른쪽 버튼(사업자등록증 올리기 · 다시 올리기 · 내 정보로 이동)은 내 정보의 사업자등록증 칸으로 스크롤(BIZ_LICENSE_ANCHOR).
 */

/** 내 정보의 사업자등록증 칸 — 열리면 그 칸으로 스크롤한다(ProfileView). */
export const PROFILE_BIZ_HREF = `/partners/profile#${BIZ_LICENSE_ANCHOR}`;

/** 콜라보 상세 주소 — /partners/collabs/{id}(광고주 새 의뢰 /new 는 뺀다). */
const COLLAB_DETAIL_PATH = /^\/partners\/collabs\/(?!new\/?$)[^/]+\/?$/;

/**
 * 승인 전 광고주가 못 여는 콜라보 화면 — 대시보드 · 매장 찾기 · 내 정보 · 도움말 말고 모두
 * (내 콜라보 · 새 의뢰 · 콜라보 상세 · 관심 매장 · 내 브랜드 · 매장 화면 · 옛 대화 · 문서함, 11-17 사용자).
 */
const ADV_LOCKED_PATH =
  /^\/partners\/(collabs|favorites|brands|stores|messages|documents|history)(\/|$)/;

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

/** 막힌 까닭 — 임시 승인(등록증 아직) · 검토 중(올렸고 인증 전) · 반려 · 미등록(임시 승인 없이 등록증도 없음). */
export type BizLock = "provisional" | "reviewing" | "rejected" | "unregistered";

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
  unregistered: {
    title: "사업자등록증 승인이 필요해요",
    body: "사업자등록증을 올리고 담당자가 인증을 마치면 콜라보 내용을 보고 신청 · 확정할 수 있어요.",
    action: "사업자등록증 올리기",
    inline: "사업자등록증 승인을 받으면 볼 수 있어요.",
    link: "내 정보에서 사업자등록증 올리기",
  },
};

/**
 * 승인 전 광고주 — 창 · 막힌 화면 글(11-17 사용자: "사업자등록증 승인 받을 경우에만 콜라보를 진행할 수 있다고 안내").
 * 제목은 지금 상태, 본문은 승인을 받으면 무엇을 할 수 있는지, 버튼은 할 일(올리기 · 다시 올리기, 확인 중엔 내 정보로 이동).
 */
export const ADV_LOCK_COPY: Record<
  AdvBizLock,
  { title: string; body: string; action: string }
> = {
  unregistered: {
    title: "사업자등록증 승인이 필요해요",
    body: "사업자등록증을 올리고 승인을 받으면 콜라보를 진행할 수 있어요. 그 전에는 대시보드와 매장 찾기만 볼 수 있어요.",
    action: "사업자등록증 올리기",
  },
  reviewing: {
    title: "사업자등록증을 확인하고 있어요",
    body: "담당자가 승인하면 콜라보를 진행할 수 있어요. 그 전에는 대시보드와 매장 찾기만 볼 수 있어요.",
    action: "내 정보로 이동",
  },
  rejected: {
    title: "사업자등록증이 반려됐어요",
    body: "내 정보에서 반려 사유를 보고 다시 올려 주세요. 승인을 받으면 콜라보를 진행할 수 있어요.",
    action: "다시 올리기",
  },
};

/** 승인 전 광고주면 그 까닭(미등록 · 확인 중 · 반려), 아니면 null(lib/partners advBizLockOf). */
export function useAdvBizLock(): AdvBizLock | null {
  const { data: me } = useMe();
  return advBizLockOf(me);
}

/** 승인 전 광고주의 안내 창을 연다(대시보드 안내 줄 등). */
export const openBizGate = () => setGateOpen(true);

/**
 * 승인 전 광고주가 막힌 화면(내 콜라보 · 관심 매장 · 내 브랜드 …)에 주소로 바로 들어왔을 때 본문 대신(AdvertiserOnly).
 */
export function AdvLockedState({ lock }: { lock: AdvBizLock }) {
  const router = useRouter();
  const copy = ADV_LOCK_COPY[lock];
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[14px] px-[16px] py-[48px] text-center">
      <span className="flex size-[48px] items-center justify-center rounded-[17px] bg-primary-50 text-primary-500">
        <MaskIcon src="/icons/file-text.svg" className="size-[22px]" />
      </span>
      <div className="flex flex-col gap-[6px]">
        <p className="text-[17px] font-bold break-keep text-gray-900">
          {copy.title}
        </p>
        <p className="max-w-[400px] text-[14px] leading-[1.6] break-keep text-gray-600">
          {copy.body}
        </p>
      </div>
      <div className="mt-[4px] flex flex-wrap items-center justify-center gap-[8px]">
        <Button
          variant="tertiary"
          onPress={() => router.push(PARTNERS_DASHBOARD_HREF)}
          className="h-[44px] rounded-[19px] px-[18px] font-semibold"
        >
          대시보드로
        </Button>
        <Button
          onPress={() => router.push(PROFILE_BIZ_HREF)}
          className="h-[44px] rounded-[19px] px-[18px] font-bold"
        >
          {copy.action}
        </Button>
      </div>
    </div>
  );
}

/**
 * 콜라보 상세 · 신청 · 확정이 막혔으면 그 까닭, 아니면 null — 사업자 인증을 마친(verified) 제휴사만 연다.
 * 처음엔 임시 승인 회원만 막았는데, 검토 중인 제휴사도 승인 전까지 막는다(11-18 사용자) — 서버 collab_service 와 같은 규칙.
 */
export function useBizLock(): BizLock | null {
  const { data: me } = useMe();
  if (me?.member_category !== "partner") return null;
  const reg = me.business_registration;
  if (reg?.status === "verified") return null;
  if (reg?.status === "reviewing" || reg?.status === "rejected")
    return reg.status;
  if (reg?.status === "provisional" || reg?.provisional_at)
    return "provisional";
  // 임시 승인 없이 등록증도 없음(올린 것을 취소했거나 사업자 정보가 없는 예전 회원).
  return "unregistered";
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

/**
 * 콜라보 레이아웃에 하나 — 막혔으면 링크를 막고 안내 창을 띄운다.
 * 임시 승인 제휴사는 콜라보 상세 링크, 승인 전 광고주는 대시보드 · 매장 찾기 · 내 정보 밖 콜라보 화면 링크(11-17).
 */
export function ProvisionalGate() {
  const router = useRouter();
  const partnerLock = useBizLock();
  const advLock = useAdvBizLock();
  const locked = partnerLock !== null || advLock !== null;
  const copy = advLock
    ? ADV_LOCK_COPY[advLock]
    : BIZ_LOCK_COPY[partnerLock ?? "provisional"];
  const blockedPath = advLock ? ADV_LOCKED_PATH : COLLAB_DETAIL_PATH;
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
      if (!blockedPath.test(a.pathname)) return;
      e.preventDefault();
      e.stopPropagation();
      setGateOpen(true);
    };
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, [locked, blockedPath]);

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
