"use client";

import { AlertDialog, Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";

import { openMemberPlanModal } from "@/components/common/MemberPlanModal";
import { useMe } from "@/hooks/auth";
import { partnersStoreHref } from "@/lib/partners";
import { getUserToken } from "@/lib/userToken";
import { canUsePartners } from "@/lib/memberCategory";

/*
 * 콜라보 안내 창 — 광고주·제휴사(콜라보)만 쓰는 메뉴라 비회원과 그 외 회원(일반·대행사·매체사)이 누르면 띄운다.
 * 제목 + 짧은 설명 + 회원 유형 비교 링크, 아래 버튼은 닫기 · 대시보드 보기(새 탭 아이콘, /partners?intro=1).
 * 매체 찾기에서 콜라보 매장을 눌렀을 때 비회원이면 로그인 안내로 같은 창을 쓴다.
 * 어디서든 openPartnersNotice() 로 열고, 창은 PartnersAccessNoticeHost 하나가 그린다(ClientShell).
 */

type NoticeKind = "member" | "guest";
let kind: NoticeKind | null = null;
const listeners = new Set<() => void>();
const setKind = (next: NoticeKind | null) => {
  kind = next;
  listeners.forEach((l) => l());
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export const openPartnersNotice = (next: NoticeKind = "member") => setKind(next);

/** 콜라보 소개 화면 — 회원 유형과 상관없이 소개 + 예시 화면을 보여 준다(PartnersHome). */
export const PARTNERS_INTRO_HREF = "/partners?intro=1";

/**
 * 콜라보 매장 상세를 열 수 있는 회원인지(광고주·제휴사(콜라보)) — 매체 찾기 목록·지도 말풍선의 콜라보 카드는
 * 그 외(비회원·일반·대행사·매체사)에겐 보이기만 하고 눌리지 않는다.
 * 로그인했는데 회원 정보를 아직 받는 중이면 열 수 있는 쪽으로 본다(useOpenPartners 와 같다).
 */
export function useCanOpenPartners() {
  const { data: me } = useMe();
  const loading = !me && !!getUserToken();
  return loading || canUsePartners(me?.member_category);
}

/**
 * 콜라보 화면을 새 탭으로 연다 — 광고주·제휴사(콜라보)만. 그 외는 안내 창.
 * - 메뉴(/partners): 비회원·일반·대행사·매체사는 "전용 메뉴" 안내 창(대시보드 보기).
 * - 매장 상세(storeKey): 비회원은 로그인 안내 창, 그 외 회원은 "전용 메뉴" 안내 창.
 */
export function useOpenPartners() {
  const { data: me } = useMe();
  // 로그인했는데 회원 정보를 아직 받는 중이면 비회원으로 보지 않고 그냥 연다 — /partners 가 유형에 맞게 보여 준다.
  return (storeKey?: string) => {
    const loading = !me && !!getUserToken();
    if (!loading && !me && storeKey) {
      openPartnersNotice("guest");
      return;
    }
    if (!loading && !canUsePartners(me?.member_category)) {
      openPartnersNotice("member");
      return;
    }
    window.open(
      storeKey ? partnersStoreHref(storeKey) : "/partners",
      "_blank",
      "noopener",
    );
  };
}

const DIALOG_BUTTON = "rounded-[15px] font-semibold";

export function PartnersAccessNoticeHost() {
  const current = useSyncExternalStore(
    subscribe,
    () => kind,
    () => null,
  );
  // 여기서 회원 정보(useMe)를 부르지 않는다 — 앱 맨 위에서 먼저 받아 오면
  // 나중에 하이드레이션되는 사이드 메뉴가 서버 HTML(불러오는 중)과 달라진다.
  const router = useRouter();
  const close = () => setKind(null);
  const guest = current === "guest";

  return (
    <AlertDialog
      isOpen={current !== null}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <AlertDialog.Backdrop isDismissable isKeyboardDismissDisabled={false}>
        <AlertDialog.Container placement="center" size="sm">
          <AlertDialog.Dialog className="rounded-[24px]">
            <AlertDialog.Header>
              <AlertDialog.Heading>
                {guest
                  ? "로그인이 필요해요"
                  : "광고주 · 제휴사(콜라보) 전용 메뉴예요"}
              </AlertDialog.Heading>
            </AlertDialog.Header>
            {/* 짧은 설명 한 줄 + "회원 유형 비교 보기" 글자 링크 — 버튼 모양(ghost)은 안쪽 여백 탓에 글자가
                들여 써지고 위아래가 비어 보여, 설명 바로 아래 붙는 작은 글자 링크로 둔다. */}
            <AlertDialog.Body className="flex flex-col items-start gap-[6px] text-[14px] leading-[22px] text-gray-600">
              <p>
                {guest
                  ? "로그인하면 콜라보 매장 정보를 볼 수 있어요."
                  : "어떤 서비스인지 대시보드에서 먼저 둘러보세요."}
              </p>
              <button
                type="button"
                onClick={() => {
                  close();
                  openMemberPlanModal();
                }}
                className="text-[13px] font-semibold text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline"
              >
                회원 유형 비교 보기
              </button>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button
                variant="tertiary"
                className={DIALOG_BUTTON}
                onPress={close}
              >
                닫기
              </Button>
              {/* 닫기와 같은 회색(tertiary). */}
              <Button
                variant="tertiary"
                className={DIALOG_BUTTON}
                onPress={() => {
                  close();
                  // 매장 상세(비회원)는 대시보드의 로그인 창으로(LOGIN_HREF),
                  // 메뉴는 콜라보 (소개) 대시보드를 새 탭으로 연다.
                  if (guest) router.push("/?login=1");
                  else window.open(PARTNERS_INTRO_HREF, "_blank", "noopener");
                }}
              >
                {guest ? (
                  "로그인"
                ) : (
                  <>
                    대시보드 보기
                    {/* 새 탭으로 열린다는 표시 — public/icons/export.svg 를 글자색으로 칠한다. */}
                    <span
                      aria-label="새 탭에서 열림"
                      role="img"
                      className="size-[14px] shrink-0 bg-current [mask:url(/icons/export.svg)_center/contain_no-repeat]"
                    />
                  </>
                )}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
