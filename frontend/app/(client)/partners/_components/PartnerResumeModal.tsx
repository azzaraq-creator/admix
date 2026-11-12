"use client";

import { Button, Modal } from "@heroui/react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { WriteIcon } from "@/components/icons";
import { useMe } from "@/hooks/auth";

/*
 * 진행 중인 가입 이어서 하기 — 제휴사(콜라보)로 가입(이메일 · 약관)은 끝났는데 기본협약에 아직 동의하지 않은 회원이
 * 다시 로그인하면 "이어서 하기" 창을 띄운다. admix 화면(ClientShell)과 콜라보 화면(/partners 레이아웃)에 같이 둔다.
 * 매장은 담당자가 어드민에서 등록 · 연결하므로(2026-11-09, 069) 매장 등록 안내는 없다.
 * 협약 화면(/partners/join/…)과 가입 화면에서는 띄우지 않고, "나중에"를 누르면 이 탭(세션)에서는 다시 띄우지 않는다.
 * 어디까지 했는지는 협약 화면이 계정별로 이 브라우저에 저장해 두고 되살린다(PartnerAgreement).
 */

const DISMISS_KEY = "admix:partner-resume-dismissed";

/** 로그인할 때마다 다시 묻게 — 로그인 창이 로그인 성공 뒤 부른다. */
export function resetPartnerResume() {
  try {
    sessionStorage.removeItem(DISMISS_KEY);
  } catch {
    // 못 지우면 이 탭에서는 "나중에"가 유지될 뿐.
  }
}
/** 이 탭(세션)에서는 이 회원에게 다시 묻지 않게 — 창의 "나중에"와 같다. 가입 완료 화면의 "나중에 하기"가 부른다. */
export function dismissPartnerResume(userId: string) {
  try {
    sessionStorage.setItem(DISMISS_KEY, userId);
  } catch {
    // 저장 못 하면 다음 화면에서 창이 한 번 더 뜰 뿐.
  }
}

/** 남은 일 문구 · 이어서 갈 곳. */
const AGREEMENT_COPY = {
  title: "진행 중인 기본협약 동의가 있어요",
  body: "계정으로 가입은 끝났어요. 사업자등록증을 올리고 기본협약에 동의하면 담당자가 매장을 연결해 드려요.",
  href: "/partners/join/agreement",
};

function readDismissed(id: string): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === id;
  } catch {
    return false;
  }
}

export function PartnerResumeModal() {
  const { data: me } = useMe();
  const pathname = usePathname();
  const router = useRouter();
  /** 이 화면에서 닫은 회원 id — 다른 계정으로 바꿔 로그인하면 다시 묻는다. */
  const [closedFor, setClosedFor] = useState<string | null>(null);
  // 회원 정보는 브라우저에서만 받으므로(서버 화면엔 me 가 없다) 여기서 sessionStorage 를 읽어도 어긋나지 않는다.
  const dismissed = !!me && (closedFor === me.id || readDismissed(me.id));

  const partner = me?.member_category === "partner";
  // 남은 일 — 협약 동의 전.
  const left = !!me && partner && me.partner_agreed_at == null;
  const onJoinPage =
    pathname.startsWith("/partners/join") || pathname.startsWith("/signup");
  const isOpen = !!me && left && !onJoinPage && !dismissed;
  const copy = AGREEMENT_COPY;

  // 저장 못 해도 이 화면에서는 닫힌다(closedFor).
  const dismiss = () => {
    if (!me) return;
    setClosedFor(me.id);
    dismissPartnerResume(me.id);
  };

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) dismiss();
      }}
    >
      <Modal.Container placement="center" size="sm">
        <Modal.Dialog aria-label={copy.title}>
          <Modal.Header className="flex flex-col items-start gap-[12px]">
            {/* 아이콘 — 문의 작성하기 버튼과 같은 펜(WriteIcon), 회색 동그라미 위. */}
            <span
              aria-hidden
              className="flex size-[44px] items-center justify-center rounded-full bg-gray-100 text-gray-500"
            >
              <WriteIcon className="size-[20px]" />
            </span>
            <Modal.Heading className="text-[18px] font-bold break-keep text-gray-900">
              {copy.title}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p className="text-[14px] leading-[1.65] break-keep text-gray-600">
              <b className="font-semibold break-all text-gray-900">
                {me?.email}
              </b>{" "}
              {copy.body}
            </p>
          </Modal.Body>
          <Modal.Footer className="flex gap-[8px]">
            {/* 버튼 44px → 곡률 19px. */}
            <Button
              variant="tertiary"
              onPress={dismiss}
              className="h-[44px] flex-1 rounded-[19px] text-[14px] font-semibold"
            >
              나중에
            </Button>
            <Button
              onPress={() => {
                dismiss();
                router.push(copy.href);
              }}
              className="h-[44px] flex-1 rounded-[19px] text-[14px] font-bold"
            >
              이어서 하기
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
