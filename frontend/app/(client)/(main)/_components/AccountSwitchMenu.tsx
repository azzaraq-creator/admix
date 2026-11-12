"use client";

import { Dropdown, Separator } from "@heroui/react";
import { Check } from "lucide-react";

import { MaskIcon } from "@/components/common/MaskIcon";
import { useMe, useSwitchAccount } from "@/hooks/auth";
import { useSonner } from "@/hooks/useSonner";
import { extractApiError } from "@/lib/apiError";
import { MEMBER_CATEGORY_LABEL } from "@/lib/memberCategory";

/** 계정 전환 줄 · 하위 메뉴 키 — 프로필 메뉴의 onAction 은 이 키들을 건너뛴다(하위 메뉴가 직접 처리). */
export const ACCOUNT_KEY_PREFIX = "account-";
export const ACCOUNT_TRIGGER_KEY = "account";

/**
 * 프로필 메뉴 맨 위 "계정 전환" — 슈퍼 계정(087)만. 지금 유형을 오른쪽에 두고, 누르거나 올리면
 * 일반 · 광고주 · 대행사 · 매체사 · 제휴사(콜라보)가 옆으로 열린다. 유형마다 따로인 계정이라 고르면 그 계정으로 다시 연다.
 * 묶음이 없는 보통 회원에겐 아무것도 그리지 않는다.
 */
export function AccountSwitchSubmenu() {
  const { data: me } = useMe();
  const switchAccount = useSwitchAccount();
  const { error } = useSonner();
  const accounts = me?.linked_accounts ?? [];
  if (!me || accounts.length < 2) return null;
  const currentLabel = MEMBER_CATEGORY_LABEL[me.member_category];

  return (
    <>
      <Dropdown.SubmenuTrigger>
        <Dropdown.Item
          id={ACCOUNT_TRIGGER_KEY}
          textValue={`계정 전환: ${currentLabel}`}
        >
          <MaskIcon
            src="/icons/group.svg"
            className="size-[16px] text-gray-500"
          />
          <span className="flex-1 text-sm font-medium whitespace-nowrap text-black">
            계정 전환
          </span>
          <span className="text-[13px] whitespace-nowrap text-gray-500">
            {currentLabel}
          </span>
          <Dropdown.SubmenuIndicator />
        </Dropdown.Item>
        <Dropdown.Popover className="min-w-[160px]">
          <Dropdown.Menu
            aria-label="계정 전환"
            disabledKeys={switchAccount.isPending ? accounts.map((a) => ACCOUNT_KEY_PREFIX + a.id) : []}
            onAction={(key) => {
              const to = accounts.find(
                (a) => ACCOUNT_KEY_PREFIX + a.id === String(key),
              );
              if (!to || to.id === me.id) return;
              switchAccount.mutate(to, {
                onError: (e) =>
                  error(extractApiError(e, "계정을 바꾸지 못했어요.")),
              });
            }}
          >
            {accounts.map((a) => (
              <Dropdown.Item
                key={a.id}
                id={ACCOUNT_KEY_PREFIX + a.id}
                textValue={MEMBER_CATEGORY_LABEL[a.member_category]}
              >
                <span className="flex-1 text-sm font-medium whitespace-nowrap text-black">
                  {MEMBER_CATEGORY_LABEL[a.member_category]}
                </span>
                {a.id === me.id && (
                  <Check
                    className="size-[14px] shrink-0 text-primary-500"
                    strokeWidth={2.2}
                  />
                )}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.SubmenuTrigger>
      {/* 누구로 쓰는지(계정 전환)와 이동 메뉴(내 정보 · 약관)를 떼어 둔다. */}
      <Separator className="my-[4px] bg-gray-200" />
    </>
  );
}
