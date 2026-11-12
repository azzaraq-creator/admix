"use client";

import {
  Button,
  Chip,
  Disclosure,
  Drawer,
  Dropdown,
  Link,
  RouterProvider,
  Tabs,
} from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  type ComponentType,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import { collabScript } from "@/app/(client)/(main)/_components/collabFont";
import { MaskIcon } from "@/components/common/MaskIcon";
import {
  ChevronRightIcon,
  FolderFilledIcon,
  LocationIcon,
  LogoutFilledIcon,
  MenuIcon,
  ProfileAvatarIcon,
  ProfileFilledIcon,
  XIcon,
} from "@/components/icons";
import { adminCollabKeys, useCollabAdminSummary } from "@/hooks/adminCollab";
import {
  adminAuthApi,
  adminAuthKeys,
  isCollabOnlyAdmin,
  useAdminMe,
} from "@/hooks/adminAuth";
import { clearAdminToken, getAdminRefreshToken } from "@/lib/adminToken";
import { cn } from "@/lib/utils";

const MASTER_ACCOUNT_TYPE = "마스터 계정";

type NavIcon = ComponentType<{ className?: string }>;

/** public/icons SVG 를 글자색 한 색으로 — 사용자 화면 사이드바 · 콜라보 사이드바와 같은 방식(partnersNav maskIcon). */
function maskIcon(src: string): NavIcon {
  function MenuMaskIcon({ className }: { className?: string }) {
    return <MaskIcon src={src} className={cn("p-[1.5px]", className)} />;
  }
  return MenuMaskIcon;
}
const DashboardIcon = maskIcon("/icons/dashboard.svg");
const PeopleIcon = maskIcon("/icons/group.svg");
const SparkleIcon = maskIcon("/icons/ai-icon.svg");
const BrandIcon = maskIcon("/icons/octogram.svg");
const StoreIcon = maskIcon("/icons/store.svg");
const ClapIcon = maskIcon("/icons/clap-duo.svg");
/** 채운 폴더가 다른 아이콘보다 커 보여 그림만 줄인다(사용자 화면 "기획안"과 같다). */
function FolderIcon({ className }: { className?: string }) {
  return <FolderFilledIcon className={cn("p-[1px]", className)} />;
}
/** FAQ — 채운 원 안에 물음표를 비워 낸 그림(다른 메뉴 아이콘처럼 채운 모양). */
function QuestionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm11.378-3.917c-.89-.777-2.366-.777-3.255 0a.75.75 0 0 1-.988-1.129c1.454-1.272 3.776-1.272 5.23 0 1.513 1.324 1.513 3.518 0 4.842a3.75 3.75 0 0 1-.837.552c-.676.328-1.028.774-1.028 1.152v.75a.75.75 0 0 1-1.5 0v-.75c0-1.279 1.06-2.107 1.875-2.502.182-.088.351-.199.503-.331.83-.727.83-1.857 0-2.584ZM12 18a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
      />
    </svg>
  );
}
/** 계정 관리(관리자 계정 · 권한) — 채운 방패 안에 체크를 비워 낸 그림. */
function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12.516 2.17a.75.75 0 0 0-1.032 0 11.209 11.209 0 0 1-7.877 3.08.75.75 0 0 0-.722.515A12.74 12.74 0 0 0 2.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 0 0 .374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 0 0-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08Zm3.094 8.016a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
      />
    </svg>
  );
}

// permKey = admin_permission menu_key. "account"(계정 관리)는 마스터 전용.
// badge = 메뉴 옆 숫자 — 콜라보 "수정 요청" 대기 수 · "제휴사 회원" · "광고주 회원" 사업자등록증 검토 대기 수
// · "콜라보 의뢰" 접수된 의뢰 수. 묶음(제휴사 관리 · 콜라보 관리) 이름 옆에는 안 숫자를 합쳐 보인다.
type NavBadge =
  | "requestsPending"
  | "partnerBizReviewing"
  | "advertiserBizReviewing"
  | "collabRequestsSubmitted";
type NavLink = {
  label: string;
  href: string;
  permKey: string;
  badge?: NavBadge;
  /** 맨 위 단계 메뉴만 — 묶음 안 메뉴는 아이콘 없이 글자만. */
  Icon?: NavIcon;
};
/** 접히는 묶음(비즈니스 관리처럼) — 아래 메뉴를 들여 써서 보여 준다. */
type NavGroup = { label: string; Icon: NavIcon; links: NavLink[] };

// 사이드바 순서 그대로. 첫 줄(대시보드) 아래에 구분선.
const NAV: (NavLink | NavGroup)[] = [
  {
    label: "대시보드",
    href: "/admin",
    permKey: "dashboard",
    Icon: DashboardIcon,
  },
  {
    label: "광고 매체 관리",
    href: "/admin/media",
    permKey: "media",
    Icon: LocationIcon,
  },
  {
    label: "인구 분포 관리",
    Icon: PeopleIcon,
    links: [
      { label: "인구 분포 데이터", href: "/admin/pop-grid", permKey: "media" },
      { label: "타깃 관리", href: "/admin/pop-targets", permKey: "media" },
    ],
  },
  {
    label: "회원 관리",
    href: "/admin/members",
    permKey: "member",
    Icon: ProfileFilledIcon,
  },
  {
    label: "AI 채팅 관리",
    href: "/admin/chat",
    permKey: "chat",
    Icon: SparkleIcon,
  },
  {
    label: "비즈니스 관리",
    Icon: FolderIcon,
    links: [
      { label: "제안 관리", href: "/admin/proposals", permKey: "business" },
      { label: "문의 관리", href: "/admin/inquiries", permKey: "business" },
    ],
  },
  {
    label: "FAQ 관리",
    href: "/admin/faq",
    permKey: "faq",
    Icon: QuestionIcon,
  },
  {
    label: "계정 관리",
    href: "/admin/roles",
    permKey: "account",
    Icon: ShieldIcon,
  },
];

/**
 * 콜라보 어드민(/admin/collab) — 같은 로그인으로 위쪽 "admix | 콜라보" 전환에서 들어간다. 권한 "collab".
 * 광고주 회원(한 줄) · 제휴사 관리(회원 · 매장 · 보낸 수정 요청) · 콜라보 관리(의뢰 → 진행 → 결과)로 나눈다
 * (2026-11-12 사용자: 광고주는 회원 하나라 묶지 않고, 콜라보 의뢰는 콜라보 관리 묶음으로 옮김).
 * admix 메뉴와 같은 규칙 — 묶음 이름은 "~ 관리", 화면이 하나뿐인 메뉴는 묶지 않고 바로 둔다.
 */
const COLLAB_HOME = "/admin/collab";
const COLLAB_NAV: (NavLink | NavGroup)[] = [
  {
    label: "대시보드",
    href: COLLAB_HOME,
    permKey: "collab",
    Icon: DashboardIcon,
  },
  // 사업자등록증 검토 대기 수 — 제휴사 회원과 같다(11-11 사용자).
  {
    label: "광고주 회원",
    href: "/admin/collab/advertisers",
    permKey: "collab",
    badge: "advertiserBizReviewing",
    Icon: BrandIcon,
  },
  {
    label: "제휴사 관리",
    Icon: StoreIcon,
    links: [
      {
        label: "제휴사 회원",
        href: "/admin/collab/members",
        permKey: "collab",
        badge: "partnerBizReviewing",
      },
      { label: "매장 관리", href: "/admin/collab/stores", permKey: "collab" },
      // 매장 유형별 매장 어필 칩 · 조건 메모 값(070). 11-12 사용자 "매장 항목"에서 이름 바꿈.
      {
        label: "매장 유형 관리",
        href: "/admin/collab/store-options",
        permKey: "collab",
      },
      // 제휴사가 내 매장에서 보낸 수정 요청(074) — 대기 수.
      {
        label: "수정 요청",
        href: "/admin/collab/requests",
        permKey: "collab",
        badge: "requestsPending",
      },
    ],
  },
  {
    label: "콜라보 관리",
    Icon: ClapIcon,
    links: [
      // 광고주가 보낸 콜라보 의뢰서(081, 11-11 사용자) — 접수된 수(11-12 사용자, 예전엔 안 연 수만).
      {
        label: "콜라보 의뢰",
        href: "/admin/collab/collab-requests",
        permKey: "collab",
        badge: "collabRequestsSubmitted",
      },
      // 끝나지 않은 콜라보 — 준비할 것(admix 제작물 포함) · 지금 하는 일. 새 콜라보 · 상세도 여기(collabs).
      {
        label: "콜라보 진행",
        href: "/admin/collab/collabs",
        permKey: "collab",
      },
      // 끝난(완료 · 취소) 콜라보 — 결과 보고서를 보고 PDF로 받는다.
      {
        label: "콜라보 결과",
        href: "/admin/collab/results",
        permKey: "collab",
      },
    ],
  },
];

/** 메뉴 옆 숫자 칩의 읽어 주는 글. */
const BADGE_LABEL: Record<NavBadge, (count: number) => string> = {
  requestsPending: (n) => `대기 ${n}건`,
  collabRequestsSubmitted: (n) => `접수된 의뢰 ${n}건`,
  partnerBizReviewing: (n) => `사업자등록증 검토 대기 ${n}명`,
  advertiserBizReviewing: (n) => `사업자등록증 검토 대기 ${n}명`,
};

// 사용자 화면 사이드바(app/(client)/(main)/_components/Sidebar.tsx)와 같은 줄 모양 — 38px(곡률 16px), 아이콘 18px,
// 글자 14px. 색은 admix 와 다르게 어두운 남색 바탕(admin-nav 토큰 — 다크 모드에서도 남색)이다(11-12 사용자: "admix와 다르게 해서 차별점을") —
// 고른 메뉴는 보라(primary-500) 바탕 · 흰 굵은 글자, 나머지는 흐린 흰 글자(text-white/투명도 — 회색 토큰은 다크 모드에서 뒤집혀 안 씀)에 마우스를 올리면 아주 옅은 흰 바탕 · 흰 글자.
const NAV_ROW =
  "flex h-[38px] w-full items-center gap-[9px] overflow-hidden rounded-[16px] pr-[12px] pl-[20px] text-sm no-underline transition-colors data-[hovered=true]:no-underline data-[pressed=true]:no-underline";
// 묶음 안 메뉴 — 아이콘 없이 글자를 위 메뉴 글자 자리(20 + 18 + 9 = 47px)에 맞추고 한 단계 작게(34px, 13px).
const SUB_ROW =
  "flex h-[34px] w-full items-center gap-[8px] overflow-hidden rounded-[14px] pr-[12px] pl-[47px] text-[13px] no-underline transition-colors data-[hovered=true]:no-underline data-[pressed=true]:no-underline";
const ROW_ACTIVE = "bg-primary-500 font-bold text-white";
const ROW_HOVER = "data-[hovered=true]:bg-white/[0.07] data-[hovered=true]:text-white";
const ROW_IDLE = `font-medium text-white/75 ${ROW_HOVER}`;
const SUB_IDLE = `font-medium text-white/60 ${ROW_HOVER}`;
// admix | 콜라보 전환 탭 — HeroUI 기본(밝은 바탕용) 대신 남색 바탕에 맞춘 글자 · 고른 탭 표시.
const MODE_TAB =
  "h-[30px] text-[13px] font-semibold text-white/55 data-[selected=true]:text-white";
const MODE_INDICATOR = "bg-white/[0.14] shadow-none";
// 관리자 프로필 아이콘 — 사용자 화면(이메일 가입 연보라)과 다르게 admix 로고 심볼의 하늘색(#38bdf8, 11-12 사용자).
// 남색 바탕 위라 다크 모드에서도 같은 색.
const ADMIN_AVATAR = "text-[#38bdf8]";

const isCollabPath = (pathname: string | null) =>
  !!pathname &&
  (pathname === COLLAB_HOME || pathname.startsWith(`${COLLAB_HOME}/`));

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  // 두 어드민의 첫 화면은 정확히 그 주소일 때만.
  if (href === "/admin" || href === COLLAB_HOME) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * 어드민 사이드 메뉴(HeroUI) — 사용자 화면 admix 사이드바와 같은 모양(2026-11-12 사용자: "admix처럼 깔끔하게").
 * 색만 admix 와 다르게 어두운 남색(admin-nav) 바탕 · 흰 로고(11-12 사용자) — 모바일 위 띠 · Drawer 도 같은 색.
 * PC 는 왼쪽 고정(200px), 모바일은 위 띠 + 왼쪽 Drawer.
 * 메뉴 줄은 HeroUI Link, 접히는 묶음은 Disclosure, admix | 콜라보 전환은 Tabs.
 * RouterProvider 로 감싸 HeroUI Link 가 Next 라우터(router.push)로 이동한다.
 */
export function AdminSidebar() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const collabMode = isCollabPath(pathname);

  return (
    <RouterProvider navigate={(href) => router.push(href)}>
      {/* 모바일(<lg): 상단 헤더 + 햄버거 드로어 */}
      {/* print:hidden — 콜라보 결과 보고서를 PDF로 저장(인쇄)할 때 메뉴는 빼고 본문만. */}
      <header className="sticky top-0 z-30 flex h-[56px] shrink-0 items-center justify-between bg-admin-nav px-[16px] lg:hidden print:hidden!">
        <Link
          href={collabMode ? COLLAB_HOME : "/admin"}
          aria-label="대시보드"
          className="flex items-center rounded-[8px] no-underline data-[hovered=true]:no-underline"
        >
          <AdminLogo collab={collabMode} compact />
        </Link>
        <Button
          isIconOnly
          variant="ghost"
          aria-label="메뉴 열기"
          onPress={() => setDrawerOpen(true)}
          className={cn("text-white/75", ROW_HOVER)}
        >
          <MenuIcon className="size-[24px]" />
        </Button>
      </header>

      {/* 모바일 메뉴(HeroUI Drawer, 왼쪽) — 열려 있는 동안 배경 스크롤 잠금 · 바깥 누르기 · Esc 로 닫기는 Drawer 가 맡는다.
          바깥 <Drawer>(DialogTrigger) 없이 Backdrop 에 isOpen 을 준다 — 여는 버튼이 따로라
          "PressResponder was rendered without a pressable child" 경고가 나지 않게(11-12). */}
      <Drawer.Backdrop
        isOpen={drawerOpen}
        onOpenChange={setDrawerOpen}
        className="lg:hidden"
      >
        <Drawer.Content placement="left">
          <Drawer.Dialog
            aria-label="메뉴"
            className="w-[240px] gap-0 bg-admin-nav p-[10px] sm:w-[240px]"
          >
            <div className="flex items-center justify-between pt-[6px] pl-[16px]">
              <AdminLogo collab={collabMode} compact />
              <Button
                isIconOnly
                variant="ghost"
                aria-label="메뉴 닫기"
                onPress={() => setDrawerOpen(false)}
                className={cn("text-white/75", ROW_HOVER)}
              >
                <XIcon className="size-[20px]" />
              </Button>
            </div>
            <AdminNav onNavigate={() => setDrawerOpen(false)} />
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>

      {/* 데스크톱(lg+): 고정 사이드바 — 사용자 화면과 같은 모양에 남색 바탕, 로고는 왼쪽 정렬. */}
      <aside className="sticky top-0 hidden h-dvh w-[200px] shrink-0 flex-col bg-admin-nav p-[10px] lg:flex print:hidden!">
        {/* 로고 심볼(약 26px)의 가운데를 아이콘 열(x=39px)에 맞춘다 → 왼쪽 여백 16px(사용자 화면과 같다). */}
        <div className="mt-[15px] pl-[16px]">
          <AdminLogo collab={collabMode} />
        </div>
        <AdminNav />
      </aside>
    </RouterProvider>
  );
}

/**
 * 사이드바 로고 — 심볼 + 글자 로고(11-10 사용자). 왼쪽 정렬. 남색 바탕이라 글자만 흰색인 admix-logo-white.svg
 * (admix-logo.svg 에서 글자 색만 바꾼 것, 심볼 그라데이션은 같다).
 * 콜라보 어드민이면 밑에 옅은 회색 "Collaboration"(HS활공명조) — 제휴사 화면(/partners) 로고와 같은 글꼴 · 모양.
 * compact — 모바일 위 띠 · 메뉴 서랍: 로고 22px · Collaboration 11px. 아니면 PC 사이드바: 로고 26px(사용자 화면과 같다).
 */
function AdminLogo({
  collab,
  compact = false,
}: {
  collab: boolean;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex flex-col items-start",
        compact ? "gap-[3px]" : "gap-[6px]",
      )}
    >
      <Image
        src="/service/admix-logo-white.svg"
        alt="admix"
        width={1333}
        height={381}
        priority
        className={cn("w-auto", compact ? "h-[22px]" : "h-[26px]")}
      />
      {collab && (
        <span
          className={cn(
            collabScript.className,
            // 글꼴 파일이 Regular 하나뿐이라 font-bold 는 브라우저가 굵게 만들어 그린다(제휴사 로고와 같다).
            "pl-[2px] leading-none font-bold tracking-[0.04em] whitespace-nowrap text-white/45",
            compact ? "text-[11px]" : "text-[12px]",
          )}
        >
          Collaboration
        </span>
      )}
    </span>
  );
}

/**
 * admix | 콜라보 전환 — 같은 로그인, 메뉴만 바뀐다. 콜라보 권한이 없으면 숨긴다.
 * 콜라보 권한만 있는 관리자도 숨긴다 — admix 쪽은 보이지 않고 콜라보 어드민만 쓴다(11-10 사용자, AdminAccessGate).
 */
function ModeSwitch({
  collabMode,
  pending = 0,
  onNavigate,
}: {
  collabMode: boolean;
  /** 수정 요청 대기 수 — 콜라보 탭 옆에 숫자로(11-11 사용자, admix 쪽에 있어도 보이게). */
  pending?: number;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  return (
    <Tabs
      selectedKey={collabMode ? "collab" : "admix"}
      onSelectionChange={(key) => {
        const toCollab = key === "collab";
        if (toCollab === collabMode) return;
        router.push(toCollab ? COLLAB_HOME : "/admin");
        onNavigate?.();
      }}
    >
      {/* 남색 바탕 위 — 틀은 아주 옅은 흰색, 고른 탭은 한 단계 밝은 흰 바탕 · 흰 글자, 나머지는 회색 글자. */}
      <Tabs.ListContainer className="bg-white/[0.07]">
        <Tabs.List aria-label="어드민 전환" className="w-full">
          <Tabs.Tab id="admix" className={cn(MODE_TAB, "flex-1")}>
            admix
            <Tabs.Indicator className={MODE_INDICATOR} />
          </Tabs.Tab>
          <Tabs.Tab id="collab" className={cn(MODE_TAB, "flex-1 gap-[5px]")}>
            콜라보
            {pending > 0 && (
              <NavCount
                count={pending}
                label={`수정 요청 대기 ${pending}건`}
              />
            )}
            <Tabs.Indicator className={MODE_INDICATOR} />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  );
}

/** 메뉴 한 줄(HeroUI Link). sub — 묶음 안 메뉴(아이콘 없이 들여 쓰고 한 단계 작게). */
function NavRow({
  href,
  active,
  onNavigate,
  sub = false,
  children,
}: {
  href: string;
  active: boolean;
  onNavigate?: () => void;
  sub?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onPress={onNavigate}
      // next/link 처럼 미리 받아 두기 — 올려 두면 화면을 먼저 받아 이동이 빠르다.
      onHoverStart={() => router.prefetch(href)}
      className={cn(
        sub ? SUB_ROW : NAV_ROW,
        active ? ROW_ACTIVE : sub ? SUB_IDLE : ROW_IDLE,
      )}
    >
      {children}
    </Link>
  );
}

function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useAdminMe();
  const isMaster = me?.account_type === MASTER_ACCOUNT_TYPE;
  const perms = me?.permissions ?? [];
  // 대시보드는 로그인 기본 페이지라 항상 노출. 마스터는 전체 노출.
  // 그 외는 권한 보유 시 노출("account"=계정 관리 포함).
  const canSee = (permKey: string) => {
    if (permKey === "dashboard") return true;
    if (isMaster) return true;
    return perms.includes(permKey);
  };
  const canCollab = !!me && canSee("collab");
  const collabOnly = isCollabOnlyAdmin(me);
  const collabMode = isCollabPath(pathname);
  // 수정 요청 · 사업자등록증 검토 대기 수 — 30초마다 다시 불러와 새로 온 것도 숫자에 바로 보인다.
  const { data: summary } = useCollabAdminSummary(canCollab, 30 * 1000);
  const pending = summary?.requestsPending;
  const counts: Record<NavBadge, number | undefined> = {
    requestsPending: pending,
    partnerBizReviewing: summary?.members?.bizReviewing,
    advertiserBizReviewing: summary?.advertisers?.bizReviewing,
    collabRequestsSubmitted: summary?.collabRequestsSubmitted,
  };
  // 대기 수가 바뀌면(새로 오거나 처리되면) 그 목록도 다시 불러온다 — 숫자와 목록이 어긋나지 않게.
  useRefetchListOnChange(counts.requestsPending, "requests");
  useRefetchListOnChange(counts.partnerBizReviewing, "members");
  useRefetchListOnChange(counts.advertiserBizReviewing, "advertisers");
  // 의뢰 목록은 안 연 수가 바뀔 때도(열어 봐서 "새" 표시가 빠질 때) 다시 불러온다.
  useRefetchListOnChange(counts.collabRequestsSubmitted, "advRequests");
  useRefetchListOnChange(summary?.collabRequestsNew, "advRequests");
  const badgeOf = (link: NavLink) => (link.badge ? (counts[link.badge] ?? 0) : 0);
  const handleLogout = () => {
    const refreshToken = getAdminRefreshToken();
    if (refreshToken) {
      void adminAuthApi.logout(refreshToken).catch(() => undefined);
    }
    clearAdminToken();
    queryClient.removeQueries({ queryKey: adminAuthKeys.all });
    router.replace("/admin/login");
    router.refresh();
  };

  const renderItem = (item: NavLink | NavGroup) => {
    if ("href" in item) {
      if (!canSee(item.permKey)) return null;
      const active = isActive(pathname, item.href);
      const count = badgeOf(item);
      const Icon = item.Icon;
      return (
        <li key={item.href}>
          <NavRow href={item.href} active={active} onNavigate={onNavigate}>
            {/* flex — 아이콘이 글자 기준선에 앉아 위로 뜨지 않게(콜라보 사이드바와 같다). */}
            {Icon && (
              <span className="flex shrink-0">
                <Icon className="size-[18px] shrink-0" />
              </span>
            )}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.badge && (
              <NavCount
                count={count}
                label={BADGE_LABEL[item.badge](count)}
                onActive={active}
              />
            )}
          </NavRow>
        </li>
      );
    }
    const links = item.links.filter((link) => canSee(link.permKey));
    if (!links.length) return null;
    return (
      <li key={item.label}>
        <NavGroupItem
          label={item.label}
          Icon={item.Icon}
          links={links}
          pathname={pathname}
          badgeOf={badgeOf}
          onNavigate={onNavigate}
        />
      </li>
    );
  };
  const [first, ...rest] = collabMode ? COLLAB_NAV : NAV;

  return (
    <>
      <nav
        aria-label="어드민 메뉴"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-[24px]"
      >
        {canCollab && !collabOnly && (
          <div className="mb-[16px] px-[4px]">
            <ModeSwitch
              collabMode={collabMode}
              pending={pending}
              onNavigate={onNavigate}
            />
          </div>
        )}
        {/* 대시보드 — 사용자 화면의 "AI 믹시"처럼 맨 위에 따로 두고 아래 메뉴와 구분선으로 나눈다. */}
        <ul className="flex flex-col">{renderItem(first)}</ul>
        <hr className="my-[12px] border-t border-white/10" />
        <ul className="flex flex-col gap-[3px]">{rest.map(renderItem)}</ul>
      </nav>

      {/* 로그인한 관리자 줄 — 사용자 화면 admix 사이드바 프로필 줄과 같은 로그아웃 방식(11-12 사용자):
          줄(아바타 24px · 이름 · >)을 누르면 HeroUI Dropdown 이 위로 열리고, 붉은 "로그아웃"(ProfileMenu 와 같은 줄)을 고른다.
          아바타(24px)의 가운데를 아이콘 열(x=39px)에 맞춘다 → 왼쪽 여백 17px. */}
      <div className="pt-[10px] pr-[10px] pb-[14px] pl-[17px]">
        <Dropdown>
          <Dropdown.Trigger
            aria-label="프로필 메뉴"
            className="flex w-full items-center gap-[10px] overflow-hidden rounded-[10px] outline-none data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-primary-400"
          >
            <ProfileAvatarIcon
              className={cn("size-[24px] shrink-0", ADMIN_AVATAR)}
            />
            <span className="flex min-w-0 flex-1 flex-col text-left">
              <span className="truncate text-sm font-medium text-white">
                {me?.name?.trim() || me?.email || "관리자"}
              </span>
              {me?.account_type && (
                <span className="truncate text-[11px] text-white/50">
                  {me.account_type}
                </span>
              )}
            </span>
            <ChevronRightIcon className="size-[16px] shrink-0 text-white/60" />
          </Dropdown.Trigger>
          <Dropdown.Popover
            placement="top start"
            className="w-(--trigger-width) min-w-[160px]"
          >
            <Dropdown.Menu
              aria-label="프로필 메뉴"
              onAction={(key) => {
                if (key === "logout") handleLogout();
              }}
            >
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
          </Dropdown.Popover>
        </Dropdown>
      </div>
    </>
  );
}

/** 사이드 메뉴 숫자가 바뀌면(처음 불러올 때 말고) 그 목록 쿼리를 다시 불러온다. */
function useRefetchListOnChange(
  value: number | undefined,
  list: "requests" | "members" | "advertisers" | "advRequests",
) {
  const queryClient = useQueryClient();
  const last = useRef(value);
  useEffect(() => {
    if (value === undefined || value === last.current) return;
    const first = last.current === undefined;
    last.current = value;
    if (!first) {
      void queryClient.invalidateQueries({
        queryKey: [...adminCollabKeys.all, list],
      });
    }
  }, [value, list, queryClient]);
}

/**
 * 메뉴 옆 대기 수 — 0이면 숨긴다. 콜라보 사이드바 숫자와 같은 작은 알약(18px, 11px):
 * 남색 바탕 위라 평소엔 보라 바탕 · 흰 글자, 고른 메뉴(보라 바탕) 위에서는 흰 바탕 · 보라 글자로 뒤집는다.
 */
function NavCount({
  count,
  label,
  onActive = false,
}: {
  count: number;
  label: string;
  onActive?: boolean;
}) {
  if (count <= 0) return null;
  return (
    <Chip
      size="sm"
      aria-label={label}
      className={cn(
        "h-[18px] min-w-[18px] shrink-0 justify-center rounded-full px-[5px] text-[11px] leading-none font-bold",
        onActive ? "bg-white text-primary-600" : "bg-primary-400 text-white",
      )}
    >
      {count}
    </Chip>
  );
}

/**
 * 접히는 묶음(HeroUI Disclosure) — 처음엔 펼쳐 두고, 묶음 안 메뉴를 보고 있으면 묶음 이름도 흰 굵은 글자.
 * 묶음 이름 옆에는 묶음 안 숫자를 합쳐 늘 보인다(콜라보 광고주 · 제휴사 묶음, 2026-11-12 사용자).
 */
function NavGroupItem({
  label,
  Icon,
  links,
  pathname,
  badgeOf,
  onNavigate,
}: {
  label: string;
  Icon: NavIcon;
  links: NavLink[];
  pathname: string | null;
  badgeOf: (link: NavLink) => number;
  onNavigate?: () => void;
}) {
  const groupActive = links.some((link) => isActive(pathname, link.href));
  const total = links.reduce((sum, link) => sum + badgeOf(link), 0);

  return (
    <Disclosure defaultExpanded>
      <Disclosure.Heading>
        <Disclosure.Trigger
          className={cn(
            NAV_ROW,
            "text-left",
            groupActive
              ? `font-bold text-white ${ROW_HOVER}`
              : ROW_IDLE,
          )}
        >
          <span className="flex shrink-0">
            <Icon className="size-[18px] shrink-0" />
          </span>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <NavCount count={total} label={`${label} 확인할 일 ${total}건`} />
          <Disclosure.Indicator className="size-[14px] shrink-0 text-white/40" />
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body className="flex flex-col gap-[2px] p-0 pt-[2px] pb-[4px]">
          {links.map((link) => {
            const count = badgeOf(link);
            const active = isActive(pathname, link.href);
            return (
              <NavRow
                key={link.href}
                href={link.href}
                active={active}
                onNavigate={onNavigate}
                sub
              >
                <span className="min-w-0 flex-1 truncate">{link.label}</span>
                {link.badge && (
                  <NavCount
                    count={count}
                    label={BADGE_LABEL[link.badge](count)}
                    onActive={active}
                  />
                )}
              </NavRow>
            );
          })}
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}
