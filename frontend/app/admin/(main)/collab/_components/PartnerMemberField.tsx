"use client";

import {
  Button,
  Card,
  Chip,
  CloseButton,
  Input,
  Modal,
  Spinner,
} from "@heroui/react";
import { Check, ChevronRight, Store, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import {
  HERO_ERROR_CLASS,
  HeroField,
} from "@/app/admin/(main)/media/_components/heroFields";
import { useCollabMemberLookup, useCollabMembers } from "@/hooks/adminCollab";
import { normalizeCode } from "@/lib/adminCollab";
import { extractApiError } from "@/lib/apiError";
import { BizStatusBadge, bizStatusLabel } from "@/lib/bizStatus";
import type { AdminPartnerMember } from "@/lib/partners";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

/**
 * 연결 회원 — "회원 검색" 창에서 회원명 · 이메일 · 고유번호로 찾아 고른다(2026-11-09 사용자: 고유번호를 직접 치지 않게).
 * 고른 회원은 고유번호(P-0001)로 저장한다. 칸 안 X 로 비워 두고 저장하면 연결이 끊긴다.
 * 매장 상세(관리)와 영업 DB 상세(맨 위)에서 같이 쓴다.
 */
export function PartnerMemberField({
  value,
  onChange,
  savedCode,
  label = "연결 회원",
  emptyHelp,
  wide,
}: {
  value: string;
  onChange: (v: string) => void;
  savedCode: string | null;
  label?: string;
  /** 아직 아무도 연결하지 않았을 때 아래 안내 */
  emptyHelp?: ReactNode;
  wide?: boolean;
}) {
  const [searching, setSearching] = useState(false);
  const code = normalizeCode(value, "P");
  const {
    data: member,
    isFetching,
    isError,
    error,
  } = useCollabMemberLookup(code);

  return (
    <HeroField
      label={label}
      wide={wide}
      // "저장하면 연결돼요" 같은 저장 안내는 두지 않는다(2026-11-10 사용자).
      help={!code && !savedCode ? emptyHelp : undefined}
    >
      {/* 고른 회원(입력칸과 같은 바탕) | 회원 검색 버튼. 연결을 끊는 X 는 칸 안 오른쪽.
          칸 자체를 눌러도 회원 검색 창이 열린다(2026-11-10 사용자) — 키보드는 옆 "회원 검색" 버튼. */}
      <div className="flex items-center gap-[8px]">
        <div
          onClick={() => setSearching(true)}
          className="flex min-h-[36px] min-w-0 flex-1 cursor-pointer items-center gap-[8px] rounded-[12px] bg-[var(--default)] py-[6px] pl-[12px] pr-[6px] text-sm"
        >
          <div className="min-w-0 flex-1">
            {!code ? (
              <span className="text-disabled">연결된 회원이 없어요</span>
            ) : isFetching && !member ? (
              <span className="text-disabled">회원 정보를 불러오는 중…</span>
            ) : isError ? (
              <span className={HERO_ERROR_CLASS}>
                {extractApiError(error, "회원을 찾지 못했어요.")}
              </span>
            ) : member ? (
              <MemberLine member={member} link />
            ) : null}
          </div>
          {code && (
            <CloseButton
              aria-label="연결 끊기"
              onPress={() => onChange("")}
              className="size-[24px] shrink-0 rounded-full bg-transparent text-disabled data-[hovered=true]:bg-black/10 data-[hovered=true]:text-black"
            >
              <X className="size-[14px]" />
            </CloseButton>
          )}
        </div>
        <Button
          variant="secondary"
          className="shrink-0"
          onPress={() => setSearching(true)}
        >
          회원 검색
        </Button>
      </div>
      <MemberSearchModal
        isOpen={searching}
        onOpenChange={setSearching}
        selectedCode={code}
        onSelect={(m) => {
          if (m.partnerCode) onChange(m.partnerCode);
          setSearching(false);
        }}
      />
    </HeroField>
  );
}

/** 회원 한 줄 — 고유번호 · 이름(상호) · 아이디 · 사업자 상태 · 협약 여부. */
export function MemberLine({
  member,
  link = false,
}: {
  member: AdminPartnerMember;
  link?: boolean;
}) {
  const title = `${member.partnerCode ?? "번호 없음"} ${member.name || member.companyName || member.loginId}`;
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-[8px] gap-y-[2px]">
      {link ? (
        <Link
          href={`/admin/collab/members/${member.id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-semibold text-primary-800 underline"
        >
          {title}
        </Link>
      ) : (
        <b className="font-semibold text-black">{title}</b>
      )}
      {member.companyName && member.name && (
        <span className="text-tone-4a5565">{member.companyName}</span>
      )}
      <span className="text-xs text-disabled">{member.loginId}</span>
      <BizStatusBadge status={bizStatusLabel(member.bizStatus)} />
      {!member.agreedAt && (
        <span className="text-xs text-[#c99a2e]">협약 전</span>
      )}
    </span>
  );
}

const MEMBER_SEARCH_SIZE = 20;

/**
 * 회원 검색 창 — 회원명 · 상호 · 이메일 · 고유번호 · 전화번호로 찾는다(서버 /admin/collab/members keyword).
 * 검색어가 없으면 최근 가입한 제휴사부터 — 현장에서 방금 가입한 회원을 바로 고를 수 있게.
 */
function MemberSearchModal({
  isOpen,
  onOpenChange,
  selectedCode,
  onSelect,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCode: string;
  onSelect: (member: AdminPartnerMember) => void;
}) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container placement="center" className="px-[16px] sm:px-0">
          <Modal.Dialog
            aria-label="회원 검색"
            className="flex max-h-[85dvh] w-full max-w-[560px] flex-col gap-[16px] rounded-[20px] bg-surface p-[20px] sm:p-[24px]"
          >
            <Modal.CloseTrigger
              aria-label="닫기"
              className="right-[16px] top-[16px] size-[32px] rounded-full bg-transparent p-0 text-gray-400 data-[hovered=true]:bg-gray-50 data-[hovered=true]:text-black"
            >
              <X className="size-[18px]" />
            </Modal.CloseTrigger>
            <Modal.Header className="flex flex-col gap-[4px] p-0 pr-[36px]">
              <Modal.Heading className="text-lg font-bold leading-[26px] text-black">
                회원 검색
              </Modal.Heading>
              <p className="text-sm text-disabled">
                이 매장에 연결할 제휴사 회원을 골라 주세요.
              </p>
            </Modal.Header>
            {/* 창을 열 때마다 검색어를 비운다(안쪽을 열 때만 그린다). */}
            {isOpen && (
              <MemberSearchBody
                selectedCode={selectedCode}
                onSelect={onSelect}
              />
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function MemberSearchBody({
  selectedCode,
  onSelect,
}: {
  selectedCode: string;
  onSelect: (member: AdminPartnerMember) => void;
}) {
  const [keyword, setKeyword] = useState("");
  // 치는 동안 매번 부르지 않게 잠깐 기다렸다가 찾는다.
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(keyword.trim()), 300);
    return () => window.clearTimeout(t);
  }, [keyword]);
  const { data, isFetching, isError, error } = useCollabMembers({
    keyword: debounced || undefined,
    page: 1,
    page_size: MEMBER_SEARCH_SIZE,
  });
  const items = data?.items ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[12px]">
      <Input
        variant="secondary"
        fullWidth
        autoFocus
        aria-label="회원 검색어"
        placeholder="회원명 · 상호 · 이메일 · 고유번호 · 전화번호"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
      />
      <p className="flex items-center gap-[6px] text-xs text-disabled">
        {debounced
          ? `"${debounced}" 검색 결과 ${data?.total ?? 0}명`
          : "최근 가입한 제휴사 회원부터 보여요."}
        {isFetching && <Spinner size="sm" />}
      </p>
      {/* 회원마다 카드 한 장(2026-11-10 사용자) — 고르면 창이 닫힌다. */}
      <div className="-mx-[6px] min-h-[120px] flex-1 overflow-y-auto px-[6px] py-[4px]">
        {isError ? (
          <p className={cn(HERO_ERROR_CLASS, "py-[16px]")}>
            {extractApiError(error, "회원을 불러오지 못했어요.")}
          </p>
        ) : items.length === 0 ? (
          <p className="py-[16px] text-sm text-disabled">
            {isFetching ? "찾는 중…" : "찾는 회원이 없어요."}
          </p>
        ) : (
          <ul className="flex flex-col gap-[10px]">
            {items.map((m) => (
              <li key={m.id}>
                <MemberCard
                  member={m}
                  current={!!m.partnerCode && m.partnerCode === selectedCode}
                  onSelect={() => onSelect(m)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * 회원 검색 결과 카드(HeroUI Card) — 카드 어디를 눌러도 고른다(2026-11-10 사용자).
 * 머리: 첫 글자 동그라미 · 이름 · 고유번호 · 이메일 | 고른 표시, 가운데: 사업자 상태 · 협약 · 전화, 아래: 연결된 매장.
 */
function MemberCard({
  member: m,
  current,
  onSelect,
}: {
  member: AdminPartnerMember;
  current: boolean;
  onSelect: () => void;
}) {
  const title = m.name || m.companyName || m.loginId;
  const disabled = !m.partnerCode;
  const select = () => {
    if (!disabled) onSelect();
  };
  return (
    <Card
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={current}
      aria-disabled={disabled || undefined}
      onClick={select}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          select();
        }
      }}
      className={cn(
        "cursor-pointer gap-[12px] p-[16px] outline-none transition-[background-color,transform] focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.99]",
        current ? "bg-primary-50" : "hover:bg-surface-secondary",
        disabled &&
          "cursor-not-allowed opacity-50 hover:bg-surface active:scale-100",
      )}
    >
      <Card.Header className="flex-row items-center gap-[12px]">
        <span
          aria-hidden
          className={cn(
            "flex size-[40px] shrink-0 items-center justify-center rounded-full text-[15px] font-bold",
            current
              ? "bg-primary text-white"
              : "bg-primary-50 text-primary-800",
          )}
        >
          {current ? <Check className="size-[18px]" /> : title.slice(0, 1)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <Card.Title className="truncate text-[15px] font-semibold leading-[22px] text-black">
            {title}
            {m.name && m.companyName && (
              <span className="ml-[6px] text-sm font-normal text-tone-4a5565">
                {m.companyName}
              </span>
            )}
          </Card.Title>
          <Card.Description className="truncate text-xs leading-[18px]">
            {m.partnerCode ?? "번호 없음"} · {m.email || m.loginId}
          </Card.Description>
        </div>
        {current ? (
          <span className="shrink-0 text-xs font-semibold text-primary-800">
            선택됨
          </span>
        ) : (
          <ChevronRight
            aria-hidden
            className="size-[18px] shrink-0 text-disabled"
          />
        )}
      </Card.Header>
      <Card.Content className="flex-row flex-wrap items-center gap-[6px]">
        <BizStatusBadge status={bizStatusLabel(m.bizStatus)} />
        {!m.agreedAt && (
          <span className="inline-flex items-center rounded-[6px] bg-tone-fdf6e3 px-[10px] py-[4px] text-xs font-medium leading-[16px] text-[#9a6b00]">
            협약 전
          </span>
        )}
        {m.phone && (
          <span className="ml-auto text-xs tabular-nums text-tone-4a5565">
            {formatPhone(m.phone)}
          </span>
        )}
      </Card.Content>
      <Card.Footer className="flex-wrap gap-[6px] border-t border-stroke pt-[12px] text-xs">
        <Store aria-hidden className="size-[14px] text-disabled" />
        {m.stores.length ? (
          m.stores.map((st) => (
            <Chip key={st.id} size="sm">
              {st.name}
              {st.status === "hidden" && " · 비공개"}
            </Chip>
          ))
        ) : (
          <span className="text-disabled">연결된 매장 없음</span>
        )}
      </Card.Footer>
    </Card>
  );
}
