"use client";

import { Dropdown } from "@heroui/react";
import { Check, Monitor, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

/** 라이트 아이콘 — public/icons/light.svg 모양을 글자색(currentColor)으로 칠한다(lucide 아이콘과 같은 자리에 쓰려고 같은 props). */
function LightIcon({
  className,
}: {
  className?: string;
  strokeWidth?: number;
  "aria-hidden"?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={`inline-block bg-current [mask:url(/icons/light.svg)_center/contain_no-repeat] ${className ?? ""}`}
    />
  );
}

const OPTIONS = [
  { id: "light", label: "라이트", Icon: LightIcon },
  { id: "dark", label: "다크", Icon: Moon },
  { id: "system", label: "시스템", Icon: Monitor },
] as const;

// 저장된 테마는 브라우저에서만 알 수 있어 서버 화면엔 시스템 아이콘을 그린다(하이드레이션 어긋남 방지).
const subscribe = () => () => {};
const useMounted = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

/** 지금 고른 화면 모드(서버 화면·첫 그림에선 시스템)와 바꾸는 함수. */
function useThemeChoice() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const current =
    OPTIONS.find((o) => o.id === (mounted ? theme : "system")) ?? OPTIONS[2];
  return { current, setTheme };
}

/** 메뉴 칸 하나 — 아이콘 · 이름 · 고른 것이면 체크. */
function OptionRow({
  label,
  Icon,
  checked,
}: {
  label: string;
  Icon: (typeof OPTIONS)[number]["Icon"];
  checked: boolean;
}) {
  return (
    <>
      <Icon className="size-[16px] shrink-0 text-gray-500" strokeWidth={1.8} />
      <span className="flex-1 text-sm font-medium text-black">{label}</span>
      {checked && (
        <Check
          className="size-[14px] shrink-0 text-primary-500"
          strokeWidth={2.2}
        />
      )}
    </>
  );
}

/** 프로필 메뉴 맨 위 화면 모드 줄 — 지금 모드(아이콘 + 라이트·다크·시스템)를 보이고,
 *  누르거나 올리면 옆으로 세 가지가 열린다. */
export const THEME_KEY_PREFIX = "theme-";
export function ThemeSubmenu() {
  const { current, setTheme } = useThemeChoice();
  const CurrentIcon = current.Icon;
  return (
    <Dropdown.SubmenuTrigger>
      <Dropdown.Item id="theme" textValue={`화면 모드: ${current.label}`}>
        <CurrentIcon
          className="size-[16px] shrink-0 text-gray-500"
          strokeWidth={1.8}
        />
        <span className="flex-1 text-sm font-medium whitespace-nowrap text-black">
          {current.label}
        </span>
        <Dropdown.SubmenuIndicator />
      </Dropdown.Item>
      <Dropdown.Popover className="min-w-[140px]">
        <Dropdown.Menu
          aria-label="화면 모드"
          onAction={(key) =>
            setTheme(String(key).slice(THEME_KEY_PREFIX.length))
          }
        >
          {OPTIONS.map(({ id, label, Icon }) => (
            <Dropdown.Item
              key={id}
              id={THEME_KEY_PREFIX + id}
              textValue={label}
            >
              <OptionRow
                label={label}
                Icon={Icon}
                checked={current.id === id}
              />
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.SubmenuTrigger>
  );
}

/**
 * 화면 모드 고르기 단독 버튼 — PC 비회원 사이드바의 보조 줄. 누르면 라이트·다크·시스템 메뉴.
 * (회원은 프로필 메뉴 맨 위, 모바일 비회원은 상단바 회색 프로필 메뉴에서 고른다.)
 * 트리거 모양은 놓이는 곳에서 받는다 — 글자는 지금 모드 이름(라이트·다크·시스템), labelClassName 은 그 글자에.
 */
export function ThemeMenu({
  className,
  labelClassName,
  placement = "bottom end",
}: {
  className?: string;
  labelClassName?: string;
  placement?: "bottom end" | "top start" | "right bottom";
}) {
  const { current, setTheme } = useThemeChoice();
  const CurrentIcon = current.Icon;
  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label={`화면 모드: ${current.label}`}
        className={className}
      >
        <CurrentIcon
          aria-hidden
          className="size-[18px] shrink-0"
          strokeWidth={1.8}
        />
        <span className={labelClassName}>{current.label}</span>
      </Dropdown.Trigger>
      <Dropdown.Popover placement={placement} className="min-w-[140px]">
        <Dropdown.Menu
          aria-label="화면 모드"
          onAction={(key) => setTheme(String(key))}
        >
          {OPTIONS.map(({ id, label: text, Icon }) => (
            <Dropdown.Item key={id} id={id} textValue={text}>
              <OptionRow label={text} Icon={Icon} checked={current.id === id} />
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
