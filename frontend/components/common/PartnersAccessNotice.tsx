"use client";

import { AlertDialog, Button } from "@heroui/react";
import { useSyncExternalStore } from "react";

import { openLoginModal } from "@/app/(client)/(main)/_components/useLoginModal";
import { openMemberPlanModal } from "@/components/common/MemberPlanModal";
import { useMe } from "@/hooks/auth";
import type { PartnersCardAccess } from "@/components/common/PartnersAccessMark";
import { PARTNERS_DASHBOARD_HREF, advBizLockOf } from "@/lib/partners";
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
// 마지막으로 연 창 — 닫히며 사라지는 동안에도 같은 글을 보이게(안 그러면 비회원 창이 "전용 메뉴" 글로 바뀌며 사라진다).
let lastKind: NoticeKind = "member";
const listeners = new Set<() => void>();
const setKind = (next: NoticeKind | null) => {
  kind = next;
  if (next) lastKind = next;
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
 * 콜라보 매장 정보 팝업을 다 볼 수 있는 회원 — 사업자등록증 승인을 마친 광고주만(금액 · 가능 범위 · 관심 매장).
 * 승인 전 광고주는 못 연다(11-17 사용자: "사업자등록증 승인 받았을 때만 상세 페이지를 볼 수 있게").
 * 광고주가 아닌 회원(일반 · 대행사 · 매체사 · 제휴사)은 간단한 팝업만(preview — 2026-11-19 사용자: "눌러서 팝업까진 보게",
 * 예전 11-16엔 제휴사까지 모두 막았다). 서버도 광고주가 아니면 간단한 정보만 준다(partners_service.get_public).
 */
const canOpenPartnersStore = (
  me: Parameters<typeof advBizLockOf>[0],
) => me?.member_category === "advertiser" && advBizLockOf(me) === null;

/**
 * 콜라보 매장을 어디서 보는지 — admix: admix 매체 찾기(/fixed), collab: 콜라보 화면(매장 찾기 · 관심 매장 · 기획안).
 * admix 에선 광고주도 다른 회원과 같이 간단히 보기만 — 금액 · 가능 범위 · 관심 매장은 콜라보 화면에서만(2026-11-19 사용자).
 */
export type PartnersStoreWhere = "admix" | "collab";

/**
 * 콜라보 카드를 어떻게 보일지 — 매체 찾기 목록·지도 말풍선 · 콜라보 매장 찾기 · 관심 매장.
 * admix 매체 찾기: 회원이면 누구나 preview(광고주 포함 — 누르면 간단한 매장 정보 팝업, 하트 자리는 "콜라보 바로 가기"), 비회원은 locked.
 * 콜라보 화면: open: 승인을 마친 광고주(누르면 매장 정보 팝업). unverified: 승인 전 광고주(눌리지 않고 금액 · 가능 범위를 흐리게, 하트 막음).
 * 광고주가 아닌 회원은 preview, 비회원은 locked(보이기만 하고 눌리지 않는다, 자물쇠).
 * 로그인했는데 회원 정보를 아직 받는 중이면 열 수 있는 쪽으로 본다(useOpenPartners 와 같다).
 */
export function usePartnersCardAccess(
  where: PartnersStoreWhere = "collab",
): PartnersCardAccess {
  const { data: me } = useMe();
  if (where === "admix") return me || getUserToken() ? "preview" : "locked";
  if (!me && getUserToken()) return "open";
  if (canOpenPartnersStore(me)) return "open";
  if (!me) return "locked";
  return me.member_category === "advertiser" ? "unverified" : "preview";
}

/** 콜라보 바로 가기로 열 매장 — 광고주는 콜라보 매장 찾기에서 이 매장 자리로 옮기고 매장 정보 팝업을 바로 연다. */
export type PartnersGoTarget = {
  mediaId: string;
  lat?: number | null;
  lng?: number | null;
};

// 콜라보 매장 찾기에서 매장 자리 둘레(도) · 지도 레벨 — 매체 찾기 검색으로 매체를 골랐을 때(±0.005)와 같은 넓이, 이름 말풍선이 보이는 가까이.
const GO_STORE_RADIUS_DEG = 0.005;
const GO_STORE_ZOOM = 3;

/** 콜라보 매장 찾기에서 그 매장을 여는 주소 — /partners/find?store=CF-0002(+ 매장 자리 지도 영역). */
export function partnersFindStoreHref(target: PartnersGoTarget): string {
  const q = new URLSearchParams({ store: target.mediaId });
  const { lat, lng } = target;
  if (lat != null && lng != null) {
    q.set("zoom", String(GO_STORE_ZOOM));
    q.set("neLat", String(lat + GO_STORE_RADIUS_DEG));
    q.set("swLat", String(lat - GO_STORE_RADIUS_DEG));
    q.set("neLng", String(lng + GO_STORE_RADIUS_DEG));
    q.set("swLng", String(lng - GO_STORE_RADIUS_DEG));
  }
  return `/partners/find?${q.toString()}`;
}

/**
 * 콜라보 바로 가기 — 안내 창 없이 새 탭으로 콜라보 화면을 연다. admix 매체 찾기의 콜라보 매장 카드 · 간단한 매장 정보 팝업(11-19 사용자).
 * 광고주는 콜라보 매장 찾기에서 그 매장 자리로 옮기고 매장 정보 팝업을 바로 연다(target, 11-19 사용자 — 금액 · 가능 범위 · 관심 매장은 거기서).
 * 제휴사는 대시보드, 그 밖(일반·대행사·매체사)은 /partners(회원 유형에 맞게 소개 페이지를 보여 준다, PartnersHome).
 */
export function useGoPartners(target?: PartnersGoTarget) {
  const { data: me } = useMe();
  return () => {
    const category = me?.member_category;
    window.open(
      category === "partner"
        ? PARTNERS_DASHBOARD_HREF
        : category === "advertiser" && target
          ? partnersFindStoreHref(target)
          : "/partners",
      "_blank",
      "noopener",
    );
  };
}

/**
 * 콜라보 화면을 새 탭으로 연다 — 광고주·제휴사(콜라보)만. 그 외는 "전용 메뉴" 안내 창(대시보드 보기).
 * 제휴사(콜라보)는 곧바로 대시보드(/partners/dashboard), 광고주는 /partners.
 */
export function useOpenPartners() {
  const { data: me } = useMe();
  // 로그인했는데 회원 정보를 아직 받는 중이면 비회원으로 보지 않고 그냥 연다 — /partners 가 유형에 맞게 보여 준다
  // (제휴사면 거기서 대시보드로 보낸다).
  return () => {
    const loading = !me && !!getUserToken();
    if (!loading && !canUsePartners(me?.member_category)) {
      openPartnersNotice("member");
      return;
    }
    window.open(
      me?.member_category === "partner" ? PARTNERS_DASHBOARD_HREF : "/partners",
      "_blank",
      "noopener",
    );
  };
}

/**
 * 콜라보 매장 정보 팝업(StoreDetailModal)을 띄워도 되는지 — 회원이면(admix 매체 찾기는 누구나 간단히 보기, 11-19).
 * 비회원은 로그인 안내 창을 띄우고 false. 콜라보 화면에선 승인 전 광고주를 그냥 막는다(카드에 자물쇠 · 툴팁이 있다).
 * 예전엔 매장 상세를 새 탭으로 열었다(11-16 사용자: "admix처럼 상세 팝업이 뜨게").
 */
export function usePartnersStoreGate(where: PartnersStoreWhere = "collab") {
  const { data: me } = useMe();
  return () => {
    // 로그인했는데 회원 정보를 아직 받는 중이면 연다 — 팝업이 매장 정보를 못 받으면 안내 문구를 띄운다.
    if (!me && getUserToken()) return true;
    if (!me) {
      openPartnersNotice("guest");
      return false;
    }
    return (
      where === "admix" ||
      me.member_category !== "advertiser" ||
      canOpenPartnersStore(me)
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
  const close = () => setKind(null);
  const guest = (current ?? lastKind) === "guest";

  return (
    <AlertDialog.Backdrop
      isOpen={current !== null}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      isDismissable
      isKeyboardDismissDisabled={false}
    >
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
            {/* 대시보드 보기는 닫기와 같은 회색(tertiary), 로그인은 보라(primary — 11-24 사용자). */}
            <Button
              variant={guest ? "primary" : "tertiary"}
              className={DIALOG_BUTTON}
              onPress={() => {
                close();
                // 매장 정보(비회원)는 보던 화면 그 자리에서 로그인 창을 연다 — 예전엔 대시보드(/?login=1)로 옮겨 가서
                // 보던 지도를 잃었다(11-24 사용자). 이 창을 쓰는 매체 찾기 · 콜라보 매장 찾기는 둘 다 로그인 창이 있다
                // (ClientShell · 콜라보 레이아웃). 메뉴는 콜라보 (소개) 대시보드를 새 탭으로 연다.
                if (guest) openLoginModal();
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
  );
}
