"use client";

import {
  Button,
  EmptyState,
  Pagination,
  SearchField,
  Tabs,
} from "@heroui/react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { SortDescriptor } from "react-aria-components";

import {
  CircleAlertIcon,
  CollectionIcon,
  PlusIcon,
  SearchOutlineIcon,
} from "@/components/icons";
import {
  isMember,
  proposalErrorReason,
  proposalLimitTier,
  proposalsClientApi,
  useCreateProposal,
  useDeleteProposal,
  useMyProposals,
  useProposalLimitDialog,
} from "@/hooks/proposals";
import { useConfirm } from "@/hooks/useConfirm";
import { useModalConfirm } from "@/hooks/useModalConfirm";
import { useSonner } from "@/hooks/useSonner";

import { NewProposalModal } from "./NewProposalModal";
import { ProposalTable, type ProposalSortKey } from "./ProposalTable";
import { type Proposal, type Status, TABS, toView } from "./proposalTypes";

const PAGE_SIZE = 10;

// 시안 주석: 정렬 기본값은 제작 일시(최신 먼저).
const DEFAULT_SORT: SortDescriptor = {
  column: "createdAt",
  direction: "descending",
};

/** 상태 탭을 골랐는데 해당 제안서가 없을 때 문구. */
const TAB_EMPTY_TITLE: Record<Status, string> = {
  "작성 중": "작성 중인 제안서가 없어요",
  "제출 완료": "제출 완료 된 제안서가 없어요",
  "맞춤 제안": "맞춤 제안 중인 제안서가 없어요",
  "계약 완료": "계약 완료 된 제안서가 없어요",
};

function compare(a: Proposal, b: Proposal, key: ProposalSortKey): number {
  if (key === "title") return a.title.localeCompare(b.title, "ko");
  if (key === "updatedAt") return a.updatedAtMs - b.updatedAtMs;
  return a.createdAtMs - b.createdAtMs;
}

/** 시안(03. 제안서 / 03. 제안서 - tooltip) — 내 제안서 목록. */
export function ProposalsView() {
  const router = useRouter();
  const { data, isLoading } = useMyProposals();
  const createMutation = useCreateProposal();
  const deleteMutation = useDeleteProposal();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("전체");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortDescriptor>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();
  // 삭제 확인·모바일 미지원 안내는 HeroUI Modal 확인창(ADMIX 팝업 모양).
  const { confirm: confirmDelete, confirmDialog: deleteDialog } =
    useModalConfirm();
  const { showLimitDialog, limitDialog } = useProposalLimitDialog();
  const { error: toastError, deleted } = useSonner();

  const proposals = useMemo(() => (data ?? []).map(toView), [data]);
  const keyword = query.trim();
  const filtered = useMemo(() => {
    const key = sort.column as ProposalSortKey;
    const sign = sort.direction === "ascending" ? 1 : -1;
    return proposals
      .filter(
        (proposal) =>
          (activeTab === "전체" || proposal.status === activeTab) &&
          (!keyword || proposal.title.includes(keyword)),
      )
      .sort((a, b) => compare(a, b, key) * sign);
  }, [proposals, activeTab, keyword, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const rangeStart =
    filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = (currentPage - 1) * PAGE_SIZE + pageItems.length;

  const handleCreate = async (name: string): Promise<string | null> => {
    try {
      await createMutation.mutateAsync(name);
      return null;
    } catch (err) {
      if (proposalErrorReason(err) === "duplicate_name") {
        return "이미 사용 중인 제안서 이름입니다. 다른 이름을 입력해 주세요.";
      }
      const tier = proposalLimitTier(err);
      if (tier) {
        // 한도 초과는 모달을 닫고 별도 안내 다이얼로그로. (await 안 함)
        void showLimitDialog(tier);
        return null;
      }
      return "제안서를 만들지 못했어요. 다시 시도해 주세요.";
    }
  };

  // 시안 주석: 삭제 전에 "{제안서명}을 삭제하시겠습니까?" 확인창.
  const handleDelete = async (proposal: Proposal) => {
    const ok = await confirmDelete({
      title: `'${proposal.title}' 제안서를 삭제하시겠습니까?`,
      description: "삭제한 제안서는 내 제안서에서 사라집니다.",
      confirmText: "삭제",
      destructive: true,
    });
    if (!ok) return;
    // 회원 정보 저장처럼 결과를 화면 위 알림(HeroUI Toast)으로 알린다.
    try {
      await deleteMutation.mutateAsync(proposal.id);
      deleted("제안서를 삭제했어요", proposal.title);
    } catch {
      toastError("제안서를 삭제하지 못했어요", "잠시 후 다시 시도해 주세요.");
    }
  };

  const handleDownload = async (proposal: Proposal) => {
    if (!isMember()) {
      await confirm({
        title: "로그인 후 다운로드 할 수 있어요.",
        description:
          "제안서 다운로드는 회원 전용 기능이에요.\n로그인 후 제안서를 저장하고 관리해 보세요.",
        confirmText: "로그인 화면으로",
      });
      return;
    }
    if (downloadingId) return;
    setDownloadingId(proposal.id);
    try {
      const res = await proposalsClientApi.exportPpt(proposal.id);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${proposal.title || "제안서"}.pptx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // 다운로드 실패 시 무시
    } finally {
      setDownloadingId(null);
    }
  };

  const resetFilters = () => {
    setActiveTab("전체");
    setQuery("");
    setPage(1);
  };

  // 처음 불러올 때와 만들기·삭제 뒤 목록을 다시 받는 동안은 표 본문에 스피너를 보인다.
  const listLoading =
    isLoading || createMutation.isPending || deleteMutation.isPending;

  const emptyState =
    activeTab !== "전체" && !keyword ? (
      <EmptyStateBox
        icon={<CollectionIcon className="size-[24px]" />}
        title={TAB_EMPTY_TITLE[activeTab]}
      />
    ) : proposals.length === 0 ? (
      <EmptyStateBox
        icon={<CollectionIcon className="size-[24px]" />}
        title="아직 제안서가 없어요"
        description={
          <>
            오른쪽 위 &apos;새 제안서&apos;를 눌러
            <br />첫 제안서를 만들어 보세요
          </>
        }
      ></EmptyStateBox>
    ) : (
      <EmptyStateBox
        icon={<SearchOutlineIcon className="size-[22px]" />}
        title="조건에 맞는 제안서가 없어요"
        description="다른 검색어를 입력하거나 상태 탭을 바꿔 보세요"
      >
        <Button
          variant="outline"
          onPress={resetFilters}
          className="mt-[8px] h-[36px] rounded-[15px] px-[16px] text-[13px] font-semibold"
        >
          검색 조건 초기화
        </Button>
      </EmptyStateBox>
    );

  return (
    <div className="flex min-h-full w-full flex-col gap-[20px] px-[16px] py-[20px] sm:px-[20px]">
      <div className="flex items-center justify-between gap-[12px]">
        <div className="flex flex-col gap-[5px]">
          <h1 className="text-[24px] leading-[1.4] font-semibold text-black">
            내 제안서
          </h1>
          <p className="text-[13px] font-light text-[#6b7280]">
            제안서 {proposals.length}건
            {/* 모바일(sm 미만)에서는 설명 문구를 숨긴다. */}
            <span className="hidden sm:inline">
              {" "}
              · 광고비와 제작비를 나란히 비교하고 PPT로 내려받을 수 있습니다.
            </span>
          </p>
        </div>
        {/* HeroUI 기본 primary 버튼(기본 크기 md) 그대로. 아이콘 크기도 HeroUI가 맞춘다.
            곡률만 규칙(높이/2 - 3px)대로 — 높이가 모바일 40px·PC(md 이상) 36px이라 17px·15px. */}
        <Button
          variant="primary"
          onPress={() => setCreateOpen(true)}
          className="shrink-0 rounded-[17px] md:rounded-[15px]"
        >
          <PlusIcon />새 제안서
        </Button>
      </div>

      <div className="flex flex-col gap-[12px] sm:flex-row sm:items-center sm:justify-between">
        {/* HeroUI Tabs 기본 스타일 그대로.
            - Tabs.Indicator: 선택이 바뀌면 미끄러지듯 옮겨 가는 표시
            - Tabs.ListContainer: 폭이 모자라면 가로 스크롤 + 양쪽 화살표(넘칠 때만 보임) */}
        <Tabs
          className="max-w-full min-w-0"
          selectedKey={activeTab}
          onSelectionChange={(key) => {
            setActiveTab(key as (typeof TABS)[number]);
            setPage(1);
          }}
        >
          {/* 곡률 규칙(높이/2 - 3px): 틀 40px → 17px, 탭·선택 표시 32px → 13px. 나머지는 HeroUI 기본. */}
          <Tabs.ListContainer className="w-fit max-w-full rounded-[17px]">
            <Tabs.List aria-label="제안서 상태">
              {TABS.map((tab) => (
                <Tabs.Tab
                  key={tab}
                  id={tab}
                  className="rounded-[13px] whitespace-nowrap"
                >
                  {tab}
                  <Tabs.Indicator className="rounded-[13px]" />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>

        {/* 검색 40px → 곡률 17px. 매체 찾기 검색바와 같은 회색 칸.
            포커스 표시는 HeroUI 기본 2px 링 대신 테두리 색만 바꾼 1px. */}
        <SearchField
          aria-label="제안서 검색"
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          className="w-full sm:w-[350px]"
        >
          <SearchField.Group className="h-[40px] gap-[12px] rounded-[17px] border border-black-200 bg-black-100 px-[12px] shadow-none focus-within:border-focus focus-within:ring-0 data-[focus-within=true]:border-focus data-[focus-within=true]:bg-white data-[focus-within=true]:ring-0">
            <SearchOutlineIcon className="size-[18px] shrink-0 text-[#6c757d]" />
            <SearchField.Input
              placeholder="제안서명으로 검색해 보세요"
              className="px-0 text-[14px] placeholder:text-[#a1a1aa]"
            />
            {/* HeroUI 기본 me-2를 빼서 좌우 여백을 칸의 px-[12px]로 맞춘다. */}
            <SearchField.ClearButton className="me-0" />
          </SearchField.Group>
        </SearchField>
      </div>

      <ProposalTable
        items={pageItems}
        loading={listLoading}
        emptyState={emptyState}
        sortDescriptor={sort}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
        onOpen={(proposal) => {
          // 제안서 상세(편집)는 모바일에서 지원하지 않는다 — 이동하지 않고 안내만 띄운다(639px 이하).
          if (window.matchMedia("(max-width: 639px)").matches) {
            void confirmDelete({
              title: "해당 기능은 모바일에서 지원되지 않습니다.",
              description: "데스크톱으로 이용해 주시기 바랍니다.",
              icon: <CircleAlertIcon className="size-[22px]" />,
              hideCancel: true,
              neutral: true,
            });
            return;
          }
          router.push(`/proposals/${proposal.id}`);
        }}
        onDownload={handleDownload}
        onDelete={handleDelete}
        downloadingId={downloadingId}
      />

      <Pagination className="gap-[12px]">
        <Pagination.Summary className="text-[12px] text-[#8c8c94]">
          전체 {filtered.length}건 중 {rangeStart}–{rangeEnd}건 표시
        </Pagination.Summary>
        <Pagination.Content className="gap-[4px]">
          <Pagination.Item>
            <Pagination.Previous
              isDisabled={currentPage === 1}
              onPress={() => setPage(currentPage - 1)}
              className={PAGE_NAV_CLASS}
            >
              <Pagination.PreviousIcon />
            </Pagination.Previous>
          </Pagination.Item>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <Pagination.Item key={n}>
              <Pagination.Link
                isActive={n === currentPage}
                onPress={() => setPage(n)}
                className={
                  n === currentPage
                    ? `${PAGE_LINK_CLASS} border-transparent bg-primary-500 font-semibold text-white`
                    : `${PAGE_LINK_CLASS} border-[#ececef] bg-white text-[#71717a]`
                }
              >
                {n}
              </Pagination.Link>
            </Pagination.Item>
          ))}
          <Pagination.Item>
            <Pagination.Next
              isDisabled={currentPage === pageCount}
              onPress={() => setPage(currentPage + 1)}
              className={PAGE_NAV_CLASS}
            >
              <Pagination.NextIcon />
            </Pagination.Next>
          </Pagination.Item>
        </Pagination.Content>
      </Pagination>

      <NewProposalModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
      />
      {confirmDialog}
      {deleteDialog}
      {limitDialog}
    </div>
  );
}

/** 표가 비었을 때 본문 — HeroUI EmptyState. 높이는 표가 재서 준 칸 높이를 꽉 채운다. */
function EmptyStateBox({
  icon,
  title,
  description,
  children,
}: {
  icon?: ReactNode;
  title?: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    // 표 바탕은 HeroUI 기본 그대로 두고, 빈 상태 영역만 흰 바탕으로 띄운다.
    <EmptyState className="flex flex-1 flex-col items-center justify-center gap-[8px] rounded-2xl bg-white p-[24px] text-center">
      {icon && (
        // 아이콘 칸 56px → 곡률 25px.
        <span className="mb-[4px] flex size-[56px] items-center justify-center rounded-[25px] bg-primary-50 text-primary-500">
          {icon}
        </span>
      )}
      {title && (
        <p className="text-[16px] font-semibold text-black-900">{title}</p>
      )}
      {description && (
        <p className="text-[13px] leading-[1.6] text-[#8c8c94]">
          {description}
        </p>
      )}
      {children}
    </EmptyState>
  );
}

// 페이지 번호 28px → 곡률 11px.
const PAGE_LINK_CLASS =
  "size-[28px] min-w-0 rounded-[11px] border p-0 text-[11px] font-medium";
const PAGE_NAV_CLASS =
  "size-[28px] min-w-0 rounded-[11px] border border-[#ececef] bg-white p-0 text-[#71717a] data-[disabled=true]:opacity-40";
