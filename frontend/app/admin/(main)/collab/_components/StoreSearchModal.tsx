"use client";

import { Button, Card, Chip, Input, Modal, Spinner, Tabs } from "@heroui/react";
import { Check, ChevronRight, Store, User, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { HERO_ERROR_CLASS } from "@/app/admin/(main)/media/_components/heroFields";
import { useStoreTypes } from "@/hooks/adminCollab";
import { useAdminPartnersStores } from "@/hooks/adminPartners";
import { extractApiError } from "@/lib/apiError";
import { isOptimizable, mediaSrc } from "@/lib/media";
import { coverImageUrls, type AdminPartnersStore } from "@/lib/partners";
import { cn } from "@/lib/utils";

const STORE_SEARCH_SIZE = 20;
/** 유형 탭 "전체" */
const ALL_TYPES = "all";

/**
 * 매장 검색 창 — 회원 상세에서 이 회원에게 연결할 매장을 고른다(2026-11-10 사용자: 매장 상세의 "회원 검색"과 같게).
 * 연결 전 · 후 모든 매장을 최근 등록 순으로 보이고, 위 탭으로 매장 유형(카페 · 식당 …)을 나눈다(2026-11-10 사용자).
 * 매장명 · 주소 · 매장 ID · 연결 회원으로 찾는다(서버 /admin/partners/stores keyword · store_type).
 * 다른 회원에게 연결된 매장도 고를 수 있다 — 고르면 부르는 쪽이 옮길지 묻는다. 이 회원 매장은 고를 수 없다.
 */
export function StoreSearchModal({
  isOpen,
  onOpenChange,
  memberId,
  onSelect,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** 지금 보고 있는 회원 — 이미 이 회원 매장이면 "연결됨"으로 막는다. */
  memberId: string;
  onSelect: (store: AdminPartnersStore) => void;
}) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container placement="center" className="px-[16px] sm:px-0">
        <Modal.Dialog
          aria-label="매장 검색"
          className="flex max-h-[85dvh] w-full max-w-[560px] flex-col gap-[16px] rounded-[20px] bg-surface p-[20px] sm:p-[24px]"
        >
          <Modal.CloseTrigger
            aria-label="닫기"
            className="right-[16px] top-[16px] size-[32px] rounded-[13px] bg-transparent p-0 text-gray-400 data-[hovered=true]:bg-gray-50 data-[hovered=true]:text-black"
          >
            <X className="size-[18px]" />
          </Modal.CloseTrigger>
          <Modal.Header className="flex flex-col gap-[4px] p-0 pr-[36px]">
            <Modal.Heading className="text-lg font-bold leading-[26px] text-black">
              매장 검색
            </Modal.Heading>
            <p className="text-sm text-disabled">
              이 회원에게 연결할 매장을 골라 주세요.
            </p>
          </Modal.Header>
          {/* 창을 열 때마다 검색어를 비운다(안쪽을 열 때만 그린다). */}
          {isOpen && (
            <StoreSearchBody memberId={memberId} onSelect={onSelect} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function StoreSearchBody({
  memberId,
  onSelect,
}: {
  memberId: string;
  onSelect: (store: AdminPartnersStore) => void;
}) {
  const [keyword, setKeyword] = useState("");
  // 치는 동안 매번 부르지 않게 잠깐 기다렸다가 찾는다.
  const [debounced, setDebounced] = useState("");
  // 많으면 "더 보기"로 늘린다 — 검색어 · 탭이 바뀌면 처음 개수로.
  const [size, setSize] = useState(STORE_SEARCH_SIZE);
  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebounced(keyword.trim());
      setSize(STORE_SEARCH_SIZE);
    }, 300);
    return () => window.clearTimeout(t);
  }, [keyword]);
  const { data: storeTypes = [] } = useStoreTypes();
  const [typeTab, setTypeTab] = useState(ALL_TYPES);
  const { data, isFetching, isError, error } = useAdminPartnersStores({
    keyword: debounced || undefined,
    store_type: typeTab === ALL_TYPES ? undefined : Number(typeTab),
    page: 1,
    page_size: size,
  });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[12px]">
      <Input
        variant="secondary"
        fullWidth
        autoFocus
        aria-label="매장 검색어"
        placeholder="매장명 · 주소 · 매장 ID · 연결 회원"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
      />
      {storeTypes.length > 0 && (
        <Tabs
          selectedKey={typeTab}
          onSelectionChange={(key) => {
            setTypeTab(String(key));
            setSize(STORE_SEARCH_SIZE);
          }}
        >
          <Tabs.ListContainer className="max-w-full">
            <Tabs.List aria-label="매장 유형">
              {[{ id: ALL_TYPES, name: "전체" }, ...storeTypes].map((t) => (
                <Tabs.Tab
                  key={t.id}
                  id={String(t.id)}
                  className="whitespace-nowrap"
                >
                  {t.name}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      )}
      {debounced && (
        <p className="flex items-center gap-[6px] text-xs text-disabled">
          &quot;{debounced}&quot; 검색 결과 {total}곳
          {isFetching && <Spinner size="sm" />}
        </p>
      )}
      <div className="-mx-[6px] min-h-[120px] flex-1 overflow-y-auto px-[6px] py-[4px]">
        {isError ? (
          <p className={cn(HERO_ERROR_CLASS, "py-[16px]")}>
            {extractApiError(error, "매장을 불러오지 못했어요.")}
          </p>
        ) : items.length === 0 ? (
          <p className="py-[16px] text-sm text-disabled">
            {isFetching
              ? "찾는 중…"
              : debounced
                ? "찾는 매장이 없어요."
                : "등록된 매장이 없어요."}
          </p>
        ) : (
          <ul className="flex flex-col gap-[10px]">
            {items.map((s) => (
              <li key={s.id}>
                <StoreCard
                  store={s}
                  current={s.ownerUserId === memberId}
                  onSelect={() => onSelect(s)}
                />
              </li>
            ))}
            {items.length < total && (
              <li className="flex justify-center">
                <Button
                  size="sm"
                  variant="tertiary"
                  isDisabled={isFetching}
                  onPress={() => setSize((n) => n + STORE_SEARCH_SIZE)}
                >
                  {isFetching ? "불러오는 중…" : `더 보기 (${items.length}/${total})`}
                </Button>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * 매장 검색 결과 카드(HeroUI Card) — 카드 어디를 눌러도 고른다. 이 회원 매장이면 "연결됨"으로 막는다.
 * 머리: 대표 사진 · 매장명 · 매장 ID · 유형 | 고른 표시, 가운데: 주소, 아래: 연결 회원.
 */
function StoreCard({
  store: s,
  current,
  onSelect,
}: {
  store: AdminPartnersStore;
  current: boolean;
  onSelect: () => void;
}) {
  const cover = coverImageUrls(s)[0];
  const src = cover ? mediaSrc(cover) : null;
  const select = () => {
    if (!current) onSelect();
  };
  return (
    <Card
      role="button"
      tabIndex={current ? -1 : 0}
      aria-disabled={current || undefined}
      onClick={select}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          select();
        }
      }}
      className={cn(
        "cursor-pointer gap-[12px] p-[16px] outline-none transition-[background-color,transform] focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.99]",
        current
          ? "cursor-default bg-primary-50 active:scale-100"
          : "hover:bg-surface-secondary",
      )}
    >
      <Card.Header className="flex-row items-center gap-[12px]">
        <span className="relative flex size-[48px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-zinc-100 text-disabled">
          {src ? (
            <Image
              src={src}
              alt=""
              fill
              sizes="48px"
              unoptimized={!isOptimizable(src)}
              className="object-cover"
            />
          ) : (
            <Store aria-hidden className="size-[20px]" />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <Card.Title className="truncate text-[15px] font-semibold leading-[22px] text-black">
            {s.name}
          </Card.Title>
          <Card.Description className="truncate text-xs leading-[18px]">
            {[s.storeCode, s.storeType].filter(Boolean).join(" · ")}
          </Card.Description>
        </div>
        {current ? (
          <span className="flex shrink-0 items-center gap-[2px] text-xs font-semibold text-primary-800">
            <Check className="size-[14px]" />
            연결됨
          </span>
        ) : (
          <ChevronRight
            aria-hidden
            className="size-[18px] shrink-0 text-disabled"
          />
        )}
      </Card.Header>
      <Card.Content className="flex-row flex-wrap items-center gap-[6px]">
        <Chip
          size="sm"
          variant="soft"
          color={s.status === "active" ? "accent" : "default"}
        >
          {s.status === "active" ? "공개" : "비공개"}
        </Chip>
        <span className="min-w-0 flex-1 truncate text-xs text-tone-4a5565">
          {s.address}
        </span>
      </Card.Content>
      <Card.Footer className="flex-wrap items-center gap-[6px] border-t border-stroke pt-[12px] text-xs">
        <User aria-hidden className="size-[14px] text-disabled" />
        {s.ownerUserId ? (
          <span className={current ? "text-primary-800" : "text-[#c99a2e]"}>
            {current ? "이 회원 매장" : "다른 회원에게 연결됨"} ·{" "}
            {s.ownerPartnerCode ?? "-"}{" "}
            {s.ownerMemberName || s.ownerCompanyName || s.ownerLoginId}
          </span>
        ) : (
          <span className="text-disabled">연결 전</span>
        )}
      </Card.Footer>
    </Card>
  );
}
