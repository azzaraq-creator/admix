"use client";

import { Dropdown, Separator } from "@heroui/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import {
  ArrowLeftIcon,
  FileTextIcon,
  LoginDoorIcon,
  LogoutFilledIcon,
  ProfileFilledIcon,
} from "@/components/icons";
import { useOpenPartners } from "@/components/common/PartnersAccessNotice";
import { useLogout } from "@/hooks/auth";
import { cn } from "@/lib/utils";

import {
  ACCOUNT_KEY_PREFIX,
  ACCOUNT_TRIGGER_KEY,
  AccountSwitchSubmenu,
} from "./AccountSwitchMenu";
import { collabScript } from "./collabFont";
import { THEME_KEY_PREFIX, ThemeSubmenu } from "./ThemeMenu";
import { openLoginModal } from "./useLoginModal";

// 프로필 메뉴 아이콘 — 글자보다 한 톤 옅게 둬 글자가 먼저 읽히게 한다.
const MENU_ICON = "size-[16px] shrink-0 text-gray-500";

/** Collaboration 줄의 메뉴 키 — 누르면 콜라보를 새 탭으로(useOpenPartners). */
const COLLAB_KEY = "collab";

/**
 * 프로필 메뉴 항목([화면 모드] · [계정 전환 |] 내 정보 · 약관 및 정책 | 로그아웃) — PC 사이드바와 모바일 상단바의 Dropdown이 같이 쓴다.
 * 계정 전환은 슈퍼 계정(087)만 — admix · 콜라보 화면 모두 이 메뉴라 어디서든 바꿀 수 있다.
 * onNavigate: 이동하기 전에 할 일(모바일 사이드바 닫기 등).
 * withTheme: 맨 위에 화면 모드 줄 — 모바일 상단바만. PC는 사이드바 가이드 줄 위에 따로 있다.
 * top: 화면 모드 줄 위에 둘 줄 — 콜라보 모바일의 광고주 브랜드 전환(BrandSwitchSubmenu, 키는 "brand"로 시작).
 * backToAdmix: 로그아웃 위에 "admix로 돌아가기" — 콜라보 모바일 위 띠만(사이드바가 없어 돌아갈 줄이 없다).
 * withCollab: 로그아웃 위에 "Collaboration ↗" — admix 모바일 상단바만(PC는 사이드바 맨 아래에 따로 있다, 11-08 사용자).
 */
export function ProfileMenu({
  onNavigate,
  withTheme = false,
  backToAdmix = false,
  withCollab = false,
  profileHref = "/profile",
  helpHref = "/help",
  top,
}: {
  onNavigate?: () => void;
  top?: ReactNode;
  withTheme?: boolean;
  backToAdmix?: boolean;
  withCollab?: boolean;
  /** 내 정보 주소 — 콜라보 화면은 사이드바를 유지하려고 /partners/profile. */
  profileHref?: string;
  /** 약관 및 정책 주소 — 콜라보 화면은 사이드바를 유지하려고 /partners/help. */
  helpHref?: string;
}) {
  const router = useRouter();
  const logout = useLogout();
  const openPartners = useOpenPartners();
  return (
    <Dropdown.Menu
      aria-label="프로필 메뉴"
      onAction={(key) => {
        // 화면 모드 줄·하위 메뉴는 ThemeSubmenu가 처리한다.
        if (String(key).startsWith(THEME_KEY_PREFIX) || key === "theme") return;
        // 브랜드 전환 줄 · 하위 메뉴(top)는 스스로 처리한다.
        if (String(key).startsWith("brand")) return;
        // 계정 전환 줄 · 하위 메뉴는 AccountSwitchSubmenu가 처리한다.
        if (
          String(key).startsWith(ACCOUNT_KEY_PREFIX) ||
          key === ACCOUNT_TRIGGER_KEY
        )
          return;
        if (key === "logout") {
          void logout();
          return;
        }
        if (key === COLLAB_KEY) {
          openPartners();
          return;
        }
        onNavigate?.();
        router.push(String(key));
      }}
    >
      {top}
      {withTheme ? <ThemeSubmenu /> : null}
      {/* 슈퍼 계정(087)만 — 일반 · 광고주 · 대행사 · 매체사 · 제휴사 계정 사이를 오간다. 보통 회원은 없다. */}
      <AccountSwitchSubmenu />
      <Dropdown.Item id={profileHref} textValue="내 정보">
        <ProfileFilledIcon className={MENU_ICON} />
        <span className="text-sm font-medium text-black">내 정보</span>
      </Dropdown.Item>
      <Dropdown.Item id={helpHref} textValue="약관 및 정책">
        <FileTextIcon className={`${MENU_ICON} size-[14px]`} />
        <span className="text-sm font-medium text-black">약관 및 정책</span>
      </Dropdown.Item>
      {backToAdmix ? <BackToAdmixItem /> : null}
      {withCollab ? <CollabItem /> : null}
      {/* 이동 메뉴와 로그아웃을 구분선으로 떼고, 로그아웃은 위험 동작이라 붉게 둔다. */}
      <Separator className="my-[4px] bg-gray-200" />
      <Dropdown.Item
        id="logout"
        textValue="로그아웃"
        variant="danger"
        className="text-danger"
      >
        <LogoutFilledIcon className="size-[14px] shrink-0 opacity-80" />
        <span className="text-sm font-medium">로그아웃</span>
      </Dropdown.Item>
    </Dropdown.Menu>
  );
}

/**
 * admix로 돌아가기 줄 — 누르면 admix 첫 화면("/").
 * 글자 대신 ← + admix 글자 로고(콜라보 PC 사이드바의 돌아가기 줄과 같은 모양, 11-08 사용자: "admix로 바꿔줘").
 * 화면 읽기 프로그램에는 "admix로 돌아가기"로 읽힌다.
 */
function BackToAdmixItem() {
  return (
    <Dropdown.Item
      id="/"
      textValue="admix로 돌아가기"
      aria-label="admix로 돌아가기"
    >
      <ArrowLeftIcon className={MENU_ICON} />
      {/* 원본 833×236 비율 — 높이 13px(메뉴 글자 14px와 같은 무게). */}
      <Image
        src="/service/admix-text-logo.svg"
        alt=""
        width={46}
        height={13}
        className="h-[13px] w-auto dark:brightness-0 dark:invert"
      />
    </Dropdown.Item>
  );
}

/**
 * Collaboration 줄 — PC 사이드바 맨 아래 줄과 같은 모양(HS활공명조 "Collaboration" + 새 탭 ↗).
 * 아이콘 자리에는 사이드바를 접었을 때와 같은 글꼴 "C". 누르면 useOpenPartners — 제휴사는 대시보드, 광고주는 콜라보 첫 화면,
 * 그 외 회원 · 비회원은 "전용 메뉴" 안내 창.
 */
function CollabItem() {
  return (
    <Dropdown.Item
      id={COLLAB_KEY}
      textValue="콜라보 (새 탭)"
      aria-label="콜라보 (새 탭)"
    >
      <span
        aria-hidden
        className={cn(
          collabScript.className,
          "w-[16px] shrink-0 text-center text-[17px] leading-none font-bold text-gray-500",
        )}
      >
        C
      </span>
      <span
        aria-hidden
        className={cn(
          collabScript.className,
          // 글꼴 파일이 Regular 하나뿐이라 font-bold 는 브라우저가 굵게 만들어 그린다(사이드바와 같다).
          "text-[15px] leading-none font-bold tracking-[0.04em] whitespace-nowrap text-black",
        )}
      >
        Collaboration
      </span>
      <span aria-hidden className="ml-auto pl-[8px] text-[11px] text-gray-400">
        ↗
      </span>
    </Dropdown.Item>
  );
}

/**
 * 비회원 메뉴(화면 모드 · 로그인 / 회원가입 [· Collaboration]) — 모바일 상단바의 회색 프로필 아이콘. PC는 따로 둔다(Sidebar).
 * withCollab: admix 모바일 상단바만 — 비회원이 누르면 "전용 메뉴" 안내 창(PC 사이드바와 같다).
 */
export function GuestMenu({
  backToAdmix = false,
  withCollab = false,
}: {
  backToAdmix?: boolean;
  withCollab?: boolean;
}) {
  const router = useRouter();
  const openPartners = useOpenPartners();
  return (
    <Dropdown.Menu
      aria-label="메뉴"
      onAction={(key) => {
        if (key === "login") openLoginModal();
        if (key === "/") router.push("/");
        if (key === COLLAB_KEY) openPartners();
      }}
    >
      <ThemeSubmenu />
      <Dropdown.Item id="login" textValue="로그인 / 회원가입">
        <LoginDoorIcon className="h-[16px] w-[14px] shrink-0 text-gray-500" />
        <span className="text-sm font-medium text-black">
          로그인 / 회원가입
        </span>
      </Dropdown.Item>
      {backToAdmix ? <BackToAdmixItem /> : null}
      {withCollab ? <CollabItem /> : null}
    </Dropdown.Menu>
  );
}

/** 비회원 프로필 아이콘 색 — 회색. 다크 모드는 바탕에 묻히지 않게 한 단계 밝게. */
export const GUEST_AVATAR_CLASS = "text-gray-400 dark:text-gray-500";
