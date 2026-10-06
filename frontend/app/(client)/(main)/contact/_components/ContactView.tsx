"use client";

import {
  Button,
  Dropdown,
  Popover,
  SearchField,
  Tabs,
  Tooltip,
} from "@heroui/react";
import { ChevronDownIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { SearchOutlineIcon, WriteIcon } from "@/components/icons";
import { Footer } from "@/components/layout/Footer";
import { useMe } from "@/hooks/auth";
import { useSonner } from "@/hooks/useSonner";
import { cn } from "@/lib/utils";

import { setLoginModalOpen } from "../../_components/useLoginModal";
import { ContactChannels, HoursChip } from "./ContactChannels";
import { FaqPanel } from "./FaqPanel";
import {
  HistoryPanel,
  INQUIRY_STATUS_FILTERS,
  type InquiryStatusFilter,
} from "./HistoryPanel";
import { InquiryModal } from "./InquiryModal";

type TabKey = "received" | "history" | "faq";

// 탭은 누구에게나 셋 다 보인다. 문의 내역은 회원 전용이라 비회원에게는 누를 수 없게(disabled) 둔다.
const TABS: { key: TabKey; label: string }[] = [
  { key: "received", label: "문의 접수" },
  { key: "history", label: "문의 내역" },
  { key: "faq", label: "자주 묻는 질문" },
];

const SEARCH_PLACEHOLDER: Partial<Record<TabKey, string>> = {
  history: "문의 제목으로 검색해 보세요",
  faq: "궁금한 내용을 검색해 보세요",
};

// 하이드레이션이 끝났는지 — 서버 렌더·첫 화면에서는 false, 그 뒤로는 true.
const subscribeNothing = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );

/** 문의 내역 답변 상태 필터 — HeroUI Dropdown. 검색창과 같은 40px 회색 칸(곡률 17px), 고른 항목에 체크. */
function StatusFilterDropdown({
  value,
  onChange,
}: {
  value: InquiryStatusFilter;
  onChange: (value: InquiryStatusFilter) => void;
}) {
  const current =
    INQUIRY_STATUS_FILTERS.find((f) => f.key === value) ??
    INQUIRY_STATUS_FILTERS[0];
  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label={`답변 상태: ${current.label}`}
        className="flex h-[40px] shrink-0 items-center gap-[6px] rounded-[17px] border border-black-200 bg-black-100 px-[14px] text-[14px] font-medium whitespace-nowrap text-[#18181b] outline-none data-[focus-visible=true]:border-focus"
      >
        {/* 모바일(sm 미만)은 짧은 이름 — 전체·대기·완료. */}
        <span className="max-sm:hidden">{current.label}</span>
        <span className="sm:hidden">{current.short}</span>
        {/* 홑화살표(lucide) — 색은 글자색을 따른다. */}
        <ChevronDownIcon
          aria-hidden
          className="size-[14px] text-[#71717a]"
          strokeWidth={2}
        />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom start" className="min-w-[140px]">
        <Dropdown.Menu
          aria-label="답변 상태"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={new Set([value])}
          onSelectionChange={(keys) => {
            const next = [...keys][0];
            if (next != null) onChange(next as InquiryStatusFilter);
          }}
        >
          {INQUIRY_STATUS_FILTERS.map((f) => (
            <Dropdown.Item key={f.key} id={f.key} textValue={f.label}>
              <span className="text-[14px] text-[#18181b]">
                <span className="max-sm:hidden">{f.label}</span>
                <span className="sm:hidden">{f.short}</span>
              </span>
              <Dropdown.ItemIndicator />
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

const LOGIN_REQUIRED = "로그인 후 이용할 수 있어요";

/**
 * 비회원의 문의 내역 탭 글자 — 왜 못 누르는지 알려 준다.
 * PC(sm 이상)는 마우스를 올리면 Tooltip, 모바일은 hover가 없어 누르면 Popover(기획안 목록의 요약 툴팁과 같은 방식).
 */
function DisabledTabLabel({ label }: { label: string }) {
  return (
    <>
      <Tooltip delay={150} closeDelay={0}>
        <Tooltip.Trigger className="max-sm:hidden">{label}</Tooltip.Trigger>
        <Tooltip.Content showArrow placement="bottom">
          <Tooltip.Arrow />
          {LOGIN_REQUIRED}
        </Tooltip.Content>
      </Tooltip>
      <Popover>
        <Button
          variant="ghost"
          className="h-auto min-w-0 rounded-none bg-transparent p-0 text-inherit data-[hovered=true]:bg-transparent data-[pressed=true]:scale-100 sm:hidden"
        >
          {label}
        </Button>
        {/* 화살표가 탭을 가리키도록 — 화살표 높이만큼 띄운다. */}
        <Popover.Content placement="bottom" offset={10}>
          <Popover.Arrow />
          <Popover.Dialog className="px-[12px] py-[8px] text-[13px] text-[#18181b]">
            {LOGIN_REQUIRED}
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
    </>
  );
}

export function ContactView({ member = false }: { member?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success } = useSonner();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<InquiryStatusFilter>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const { data: me } = useMe();
  const isMember = member || !!me;
  const disabledTabs: TabKey[] = isMember ? [] : ["history"];
  const tabParam = searchParams.get("tab");
  const activeTab: TabKey = TABS.some(
    (tab) => tab.key === tabParam && !disabledTabs.includes(tab.key),
  )
    ? (tabParam as TabKey)
    : "received";
  const searchPlaceholder = SEARCH_PLACEHOLDER[activeTab];
  const hydrated = useHydrated();

  const goTab = (key: TabKey) => {
    setSearchQuery("");
    setStatusFilter("all");
    router.push(key === "received" ? "/contact" : `/contact?tab=${key}`, {
      scroll: false,
    });
  };

  // 비로그인 상태로 문의내역 딥링크(?tab=history)로 진입 시 로그인 유도.
  // 로그인 성공하면 me 캐시가 채워져 isMember→true, history 탭이 자동 표시된다.
  useEffect(() => {
    if (!isMember && tabParam === "history") {
      setLoginModalOpen(true);
    }
  }, [isMember, tabParam]);

  // 문의 작성은 로그인한 회원만 — 비회원은 로그인 창을 띄운다.
  const openWrite = () => {
    if (isMember) setModalOpen(true);
    else setLoginModalOpen(true);
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      void error;
    }
    success(`${what}를 복사했어요.`, text);
  };

  return (
    // 본문이 남는 높이를 채워, 내용이 짧아도 Footer가 화면 바닥에 붙는다.
    <div className="flex min-h-full w-full flex-col">
      <div className="flex w-full flex-1 flex-col gap-[20px] p-[16px] sm:px-[20px]">
        {/* 머리글 — 기획안 목록과 같은 제목·설명 크기. */}
        <div className="flex flex-col gap-[5px]">
          <h1 className="text-[24px] leading-[1.4] font-semibold text-black">
            문의하기
          </h1>
          <p className="text-[13px] font-light text-[#6b7280]">
            궁금한 점을 가장 편한 방법으로 문의해 주세요.
          </p>
        </div>

        <div className="flex flex-col gap-[12px] sm:flex-row sm:items-center sm:justify-between">
          {/* HeroUI Tabs — 기획안 목록 탭과 같은 모양.
            곡률 규칙(높이/2 - 3px): 틀 40px → 17px, 탭·선택 표시 32px → 13px. */}
          {/* ?tab=으로 둘째·셋째 탭에 바로 들어오면, react-aria 선택 표시가 첫 화면의 덜 잡힌 배치를
            기억했다가 그만큼 밀린 채 멈춘다(첫 탭 위에 흰 알약이 남음). 하이드레이션 뒤 한 번 새로 그려 위치를 다시 잰다. */}
          <Tabs
            key={hydrated ? "client" : "server"}
            className="max-w-full min-w-0"
            selectedKey={activeTab}
            disabledKeys={disabledTabs}
            onSelectionChange={(key) => goTab(key as TabKey)}
          >
            <Tabs.ListContainer className="w-fit max-w-full rounded-[17px]">
              <Tabs.List aria-label="문의하기 메뉴">
                {TABS.map((tab) => {
                  const disabled = disabledTabs.includes(tab.key);
                  return (
                    <Tabs.Tab
                      key={tab.key}
                      id={tab.key}
                      // 비활성 탭은 HeroUI가 마우스 이벤트를 막아(pointer-events: none) 안내가 뜨지 않으므로 다시 연다.
                      // 탭 자체는 비활성 그대로라 눌러도 선택되지 않는다.
                      className={cn(
                        "rounded-[13px] whitespace-nowrap",
                        disabled && "pointer-events-auto",
                      )}
                    >
                      {disabled ? (
                        <DisabledTabLabel label={tab.label} />
                      ) : (
                        tab.label
                      )}
                      <Tabs.Indicator className="rounded-[13px]" />
                    </Tabs.Tab>
                  );
                })}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>

          {/* 오른쪽 도구 — 문의 내역: [답변 상태 필터] [검색] [문의 작성하기], 자주 묻는 질문: [검색].
              모두 40px → 곡률 17px. */}
          {searchPlaceholder && (
            <div className="flex w-full items-center gap-[8px] sm:w-auto">
              {activeTab === "history" && (
                <StatusFilterDropdown
                  value={statusFilter}
                  onChange={setStatusFilter}
                />
              )}
              {/* 기획안 검색창과 같은 회색 칸. */}
              <SearchField
                aria-label={searchPlaceholder}
                value={searchQuery}
                onChange={setSearchQuery}
                className="min-w-0 flex-1 sm:w-[350px] sm:flex-none"
              >
                <SearchField.Group className="h-[40px] gap-[12px] rounded-[17px] border border-black-200 bg-black-100 px-[12px] shadow-none focus-within:border-focus focus-within:ring-0 data-[focus-within=true]:border-focus data-[focus-within=true]:bg-white data-[focus-within=true]:ring-0">
                  <SearchOutlineIcon className="size-[18px] shrink-0 text-[#6c757d]" />
                  <SearchField.Input
                    placeholder={searchPlaceholder}
                    className="px-0 text-[14px] placeholder:text-[#a1a1aa]"
                  />
                  <SearchField.ClearButton className="me-0" />
                </SearchField.Group>
              </SearchField>
              {activeTab === "history" && (
                // 기획안 목록의 "새 기획안"과 같은 보라 버튼. 모바일은 폭이 좁아 아이콘만.
                <Button
                  variant="primary"
                  onPress={openWrite}
                  aria-label="문의 작성하기"
                  className="h-[40px] shrink-0 gap-[6px] rounded-[17px] bg-primary-500 px-[16px] text-[14px] font-semibold text-white max-sm:w-[40px] max-sm:px-0"
                >
                  <WriteIcon className="size-[15px]" />
                  <span className="max-sm:hidden">문의 작성하기</span>
                </Button>
              )}
            </div>
          )}
        </div>

        {activeTab === "received" && (
          <div className="flex flex-col gap-[16px]">
            <HoursChip />
            <ContactChannels onWrite={openWrite} onCopy={copy} />
          </div>
        )}

        {activeTab === "history" && (
          <HistoryPanel
            query={searchQuery}
            status={statusFilter}
            onSelect={(id) => router.push(`/contact/inquiries/${id}`)}
            onWrite={openWrite}
            onResetFilters={() => {
              setSearchQuery("");
              setStatusFilter("all");
            }}
          />
        )}

        {activeTab === "faq" && (
          <FaqPanel
            query={searchQuery}
            onResetQuery={() => setSearchQuery("")}
          />
        )}

        <InquiryModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </div>

      {/* 공용 Footer(이용약관 페이지와 같은 것) — 로고·약관 링크·사업자 정보. 본문처럼 전체 폭으로 펼쳐 왼쪽 끝을 맞춘다. */}
      <Footer fullWidth />
    </div>
  );
}
