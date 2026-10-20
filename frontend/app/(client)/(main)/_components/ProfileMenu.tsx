"use client";

import { Dropdown, Separator } from "@heroui/react";
import { useRouter } from "next/navigation";

import {
  FileTextIcon,
  LoginDoorIcon,
  LogoutFilledIcon,
  ProfileFilledIcon,
} from "@/components/icons";
import { useLogout } from "@/hooks/auth";

import { THEME_KEY_PREFIX, ThemeSubmenu } from "./ThemeMenu";
import { openLoginModal } from "./useLoginModal";

// 프로필 메뉴 아이콘 — 글자보다 한 톤 옅게 둬 글자가 먼저 읽히게 한다.
const MENU_ICON = "size-[16px] shrink-0 text-gray-500";

/**
 * 프로필 메뉴 항목(화면 모드 · 내 정보 · 약관 및 정책 | 로그아웃) — PC 사이드바와 모바일 상단바의 Dropdown이 같이 쓴다.
 * onNavigate: 이동하기 전에 할 일(모바일 사이드바 닫기 등).
 */
export function ProfileMenu({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const logout = useLogout();
  return (
    <Dropdown.Menu
      aria-label="프로필 메뉴"
      onAction={(key) => {
        // 화면 모드 줄·하위 메뉴는 ThemeSubmenu가 처리한다.
        if (String(key).startsWith(THEME_KEY_PREFIX) || key === "theme") return;
        if (key === "logout") {
          void logout();
          return;
        }
        onNavigate?.();
        router.push(String(key));
      }}
    >
      <ThemeSubmenu />
      <Dropdown.Item id="/profile" textValue="내 정보">
        <ProfileFilledIcon className={MENU_ICON} />
        <span className="text-sm font-medium text-black">내 정보</span>
      </Dropdown.Item>
      <Dropdown.Item id="/help" textValue="약관 및 정책">
        <FileTextIcon className={`${MENU_ICON} size-[14px]`} />
        <span className="text-sm font-medium text-black">약관 및 정책</span>
      </Dropdown.Item>
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

/** 비회원 메뉴(화면 모드 · 로그인 / 회원가입) — 모바일 상단바의 회색 프로필 아이콘. PC는 따로 둔다(Sidebar). */
export function GuestMenu() {
  return (
    <Dropdown.Menu
      aria-label="메뉴"
      onAction={(key) => key === "login" && openLoginModal()}
    >
      <ThemeSubmenu />
      <Dropdown.Item id="login" textValue="로그인 / 회원가입">
        <LoginDoorIcon className="h-[16px] w-[14px] shrink-0 text-gray-500" />
        <span className="text-sm font-medium text-black">
          로그인 / 회원가입
        </span>
      </Dropdown.Item>
    </Dropdown.Menu>
  );
}

/** 비회원 프로필 아이콘 색 — 회색. 다크 모드는 바탕에 묻히지 않게 한 단계 밝게. */
export const GUEST_AVATAR_CLASS = "text-gray-400 dark:text-gray-500";
