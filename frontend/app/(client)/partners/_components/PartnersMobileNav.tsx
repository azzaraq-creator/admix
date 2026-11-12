"use client";

import { Dropdown, Popover, Spinner } from "@heroui/react";
import Link from "next/link";
import { useState } from "react";

import { ProfileAvatarIcon } from "@/components/icons";
import {
  GUEST_AVATAR_CLASS,
  GuestMenu,
  ProfileMenu,
} from "@/app/(client)/(main)/_components/ProfileMenu";
import { avatarColorClass } from "@/lib/avatarColor";
import { cn } from "@/lib/utils";

import {
  maskIcon,
  tabCountOf,
  PartnersLogo,
  usePartnersNav,
  type PartnersMenuItem,
} from "./partnersNav";
import { BrandSwitchSubmenu } from "./advertiser/BrandSwitch";
import { PartnerNotificationHeaderButton } from "./workspace/PartnerNotifications";

/*
 * 콜라보 모바일(sm 미만) 메뉴 — 예전엔 위 띠의 햄버거로 여는 왼쪽 드로어였다(11-08 사용자: "메뉴도 다른 형태의 UI").
 *   위 띠: 왼쪽 프로필(화면 모드 · 내 정보 · 약관 · admix로 돌아가기 · 로그아웃) · 가운데 글자 로고 + Collaboration(심볼 없이) · 오른쪽 알림 종
 *   (admix 모바일 위 띠와 같은 배치 — 11-08 사용자: "프로필은 왼쪽, 로고는 가운데")
 *   아래 탭 바: 화면 아래 떠 있는 반투명 남색 유리 캡슐 — 대시보드 · 콜라보 · 참여 이력 · 내 매장 · 더보기
 *   (더보기를 누르면 그 위에 같은 유리 캡슐로 기본협약 · 대화 · 문서함이 뜬다 — 11-08 사용자: "더보기 메뉴의 UI도 동일하게")
 *   (admix 홈 모바일 탭 바(MobileTabBar)와 같은 모양 — 11-08 사용자. 가운데 AI 믹시 칸만 없다)
 * 탭 바는 메뉴가 둘 이상일 때만(협약 전 · 매장 연결 전 제휴사는 대시보드 · 기본 협약 두 칸).
 * 탭 바가 가리는 높이는 layout 이 --partners-tabbar-space 로 받아 본문 끝 · 아래 고정 줄을 그만큼 올린다.
 */

// 더보기 — 가로 점 세 개(more.svg, 11-08 사용자).
const MoreIcon = maskIcon("/icons/more.svg");

/** 위 띠 왼쪽 프로필 — 회원이면 프로필 메뉴, 비회원이면 화면 모드 · 로그인. 받는 동안 스피너. */
function AccountButton({ member }: { member: boolean }) {
  const { me, meLoading } = usePartnersNav(member);
  const BUTTON =
    "flex h-full w-[48px] shrink-0 items-center justify-center outline-none";

  if (meLoading)
    return (
      <div
        role="status"
        aria-label="회원 정보를 불러오는 중"
        className={BUTTON}
      >
        <Spinner size="sm" />
      </div>
    );
  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label={me ? "프로필 메뉴" : "메뉴 (화면 모드 · 로그인)"}
        className={BUTTON}
      >
        <ProfileAvatarIcon
          className={cn(
            "size-[26px] shrink-0",
            me ? avatarColorClass(me.sns_provider) : GUEST_AVATAR_CLASS,
          )}
        />
      </Dropdown.Trigger>
      {/*
       * 폭은 항목 길이만큼(최소 148px) — 180px 이던 때는 좁은 폰(360px 이하)에서 화면 모드 하위 메뉴(140px)가
       * 화면 밖으로 잘렸다(11-08 사용자). 프로필이 왼쪽이라 메뉴는 왼쪽 끝에 맞춰 열고, 하위 메뉴는 오른쪽으로 열린다.
       * 글자는 13px · 한 줄 — 14px 이던 때는 좁은 폰에서 "로그인 / 회원가입"이 두 줄로 내려갔다(11-08 사용자).
       * HeroUI 기본 최대 폭(화면 48%)도 풀어, 글자 길이만큼 넓어지게 한다(화면 양옆 12px 안).
       */}
      <Dropdown.Popover
        placement="bottom start"
        className="max-w-[calc(100svw-24px)] min-w-[148px] [&_[role=menuitem]_span]:text-[13px] [&_[role=menuitem]_span]:whitespace-nowrap"
      >
        {me ? (
          <ProfileMenu
            // 광고주 브랜드가 둘 이상이면 화면 모드 위에 브랜드 전환 + 구분선(11-12 사용자).
            top={<BrandSwitchSubmenu />}
            withTheme
            backToAdmix
            profileHref="/partners/profile"
            helpHref="/partners/help"
          />
        ) : (
          <GuestMenu backToAdmix />
        )}
      </Dropdown.Popover>
    </Dropdown>
  );
}

/**
 * 모바일 위 띠 — 왼쪽 프로필 · 가운데 로고 · 오른쪽 알림(admix 모바일 위 띠와 같은 배치).
 * 양옆 칸을 같은 폭(1fr)으로 두어 알림 종이 없어도 로고가 화면 가운데에 온다.
 */
export function PartnersMobileHeader({ member }: { member: boolean }) {
  const { hasStore, logoHref } = usePartnersNav(member);
  return (
    <header className="sticky top-0 z-30 grid h-[56px] shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-gray-200 bg-surface px-[4px] sm:hidden">
      <div className="flex h-full items-center justify-self-start">
        <AccountButton member={member} />
      </div>
      <PartnersLogo symbol={false} compact center href={logoHref} />
      <div className="flex h-full items-center justify-self-end">
        {hasStore && <PartnerNotificationHeaderButton />}
      </div>
    </header>
  );
}

/**
 * 탭 한 칸 — admix 홈 모바일 탭(MobileTabBar TabLink)과 같다: 아이콘 20px + 아래 10px 이름,
 * 켜지면 흰 글자 굵게, 꺼지면 흰 55%.
 */
function TabInner({
  Icon,
  label,
  badge,
}: {
  Icon: PartnersMenuItem["Icon"];
  label: string;
  /** 아이콘 오른쪽 위 숫자(제휴사 "콜라보 참여"). */
  badge?: number;
}) {
  return (
    <>
      {/* 메뉴 아이콘은 글자색 한 색(MaskIcon)이라 탭 글자색을 그대로 따른다. */}
      <span className="relative shrink-0">
        <Icon className="size-[20px] shrink-0" />
        {!!badge && (
          <span className="absolute -top-[5px] -right-[9px] flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-primary px-[4px] text-[9px] leading-none font-bold text-white">
            {badge}
          </span>
        )}
      </span>
      <span className="truncate">{label}</span>
    </>
  );
}

const TAB =
  "flex min-w-0 flex-1 flex-col items-center justify-center gap-[4px] text-[10px] leading-none";
const tabTone = (active: boolean) =>
  active ? "font-bold text-white" : "font-medium text-white/55";

/** 모바일 아래 탭 바 + 더보기 캡슐. */
export function PartnersMobileTabBar({ member }: { member: boolean }) {
  const { menu, activeKey, onMenuClick } = usePartnersNav(member);
  const [moreOpen, setMoreOpen] = useState(false);
  if (menu.length <= 1) return null;

  const count = tabCountOf(menu.length);
  const tabs = menu.slice(0, count);
  const more = menu.slice(count);
  const moreActive = more.some((m) => m.key === activeKey);

  return (
    <>
      {/*
       * data-partners-tabbar — layout 이 이 표시가 있을 때만 본문 아래 여백(--partners-tabbar-space)을 둔다.
       * z-[35]: 위 띠(z-30)보다 위, 창 · 시트보다는 아래. 캡슐 둘레는 눌러도 본문이 눌리게 비워 둔다.
       */}
      <nav
        aria-label="콜라보 메뉴"
        data-partners-tabbar
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[35] px-[12px] pb-[calc(8px+env(safe-area-inset-bottom))] sm:hidden"
      >
        {/* admix 홈 모바일 탭 바와 같은 캡슐 — 56px → 곡률 25px, 바탕이 흐리게 비치는 남색(gray-800 #252836, 40%) 유리. */}
        <div className="pointer-events-auto flex h-[56px] items-stretch rounded-[25px] bg-[rgba(37,40,54,0.4)] px-[6px] shadow-[0px_6px_18px_rgba(0,0,0,0.18)] backdrop-blur-[12px] backdrop-saturate-[1.6]">
          {tabs.map((item) => {
            const active = item.key === activeKey;
            return (
              <Link
                key={item.key}
                href={item.href}
                // 누르자마자 본문을 로딩 화면으로(partnersPending).
                onClick={(e) => onMenuClick(e, item.href)}
                aria-current={active ? "page" : undefined}
                className={cn(TAB, tabTone(active))}
              >
                <TabInner
                  Icon={item.Icon}
                  label={item.label}
                  badge={item.badge}
                />
              </Link>
            );
          })}
          {more.length > 0 && (
            // 더보기 — 탭 바 바로 위 오른쪽에 탭 바와 같은 유리 캡슐(56px · 곡률 25px · 남색 40% · 흐림)로
            // 나머지 메뉴를 탭과 같은 모양(아이콘 20px + 흰 글자 10px)으로 띄운다. 바깥을 누르면 닫힌다.
            <Popover isOpen={moreOpen} onOpenChange={setMoreOpen}>
              <Popover.Trigger
                aria-label="더보기"
                className={cn(TAB, tabTone(moreActive || moreOpen))}
              >
                <TabInner Icon={MoreIcon} label="더보기" />
              </Popover.Trigger>
              <Popover.Content
                placement="top end"
                offset={12}
                className="rounded-[25px] bg-[rgba(37,40,54,0.4)] shadow-[0px_6px_18px_rgba(0,0,0,0.18)] backdrop-blur-[12px] backdrop-saturate-[1.6]"
              >
                {/* 아래 "더보기" 탭을 가리키는 화살표(11-08 사용자) — 끝이 둥근 16×7 삼각형, 가로 자리는 HeroUI가 탭 가운데에 맞춘다.
                    탭 바와 5px 띄운다(offset 12 − 화살표 7).
                    화살표는 캡슐 그림자 위에 놓이고(캡슐 안이라 흐림도 먹지 않는다) 같은 40%면 몸통보다 진해 보여서,
                    남색을 30%로 낮춰 몸통 색에 맞췄다. */}
                <Popover.Arrow>
                  <span className="block h-[7px] w-[16px] bg-[rgba(37,40,54,0.3)] [clip-path:path('M0_0C6.6_7_9.4_7_16_0Z')]" />
                </Popover.Arrow>
                <Popover.Dialog
                  aria-label="더보기"
                  className="flex h-[56px] items-stretch p-0 px-[6px]"
                >
                  {more.map((item) => {
                    const active = item.key === activeKey;
                    return (
                      <Link
                        key={item.key}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={(e) => {
                          setMoreOpen(false);
                          onMenuClick(e, item.href);
                        }}
                        className={cn(
                          TAB,
                          "w-[64px] flex-none",
                          tabTone(active),
                        )}
                      >
                        <TabInner Icon={item.Icon} label={item.label} />
                      </Link>
                    );
                  })}
                </Popover.Dialog>
              </Popover.Content>
            </Popover>
          )}
        </div>
      </nav>
    </>
  );
}
