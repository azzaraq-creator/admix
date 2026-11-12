"use client";

import { Button, Chip, Input, ListBox, Select, Table } from "@heroui/react";
import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { HeroSelect } from "@/app/admin/(main)/media/_components/heroFields";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { ErrorState, LoadingState } from "@/components/common/RouteStates";
import { useCollabMembers } from "@/hooks/adminCollab";
import { BIZ_STATUS_OPTIONS, dotDate } from "@/lib/adminCollab";
import { BizStatusBadge, bizStatusLabel } from "@/lib/bizStatus";
import { formatDateTime } from "@/lib/date";
import type { AdminPartnerMember } from "@/lib/partners";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

import { CollabPageHead, PageNav } from "../../_components/collabUi";

const MEMBERS_HREF = "/admin/collab/members";

/** 표 한 줄 — 순번(no)만 덧붙인다. */
type Row = AdminPartnerMember & { no: number };

const muted = (text: string) => <span className="text-disabled">{text}</span>;

/** 날짜 · 시각 칸 — 흐리게, 숫자 폭 맞춤. */
const stamp = (iso: string | null) => (
  <span className="text-disabled">{formatDateTime(iso)}</span>
);

/** 표 칸 하나. */
interface MemberTableColumn {
  id: string;
  label: string;
  isRowHeader?: boolean;
  render: (member: Row) => ReactNode;
}

const COLUMNS: MemberTableColumn[] = [
  {
    id: "no",
    label: "No",
    render: (m) => <span className="text-disabled">{m.no}</span>,
  },
  {
    id: "partnerCode",
    label: "고유번호",
    render: (m) => (
      <span className="font-semibold">{m.partnerCode ?? "-"}</span>
    ),
  },
  {
    id: "name",
    label: "이름",
    isRowHeader: true,
    render: (m) => (
      <span className="flex flex-col">
        <span className="font-medium text-black">{m.name || "-"}</span>
        {m.companyName && (
          <span className="text-xs text-disabled">{m.companyName}</span>
        )}
      </span>
    ),
  },
  {
    id: "loginId",
    label: "아이디",
    render: (m) => (
      <span className="block max-w-[220px] truncate" title={m.loginId}>
        {m.snsProvider ? `${m.snsProvider} · ` : ""}
        {m.loginId}
      </span>
    ),
  },
  {
    // 숫자만 저장돼 있어 보일 때 '-'를 넣는다(010-1234-5678).
    id: "phone",
    label: "연락처",
    render: (m) => (m.phone ? <span>{formatPhone(m.phone)}</span> : muted("-")),
  },
  {
    id: "createdAt",
    label: "가입일시",
    render: (m) => stamp(m.createdAt),
  },
  {
    id: "agreedAt",
    label: "협약",
    render: (m) =>
      m.agreedAt ? (
        <span>{dotDate(m.agreedAt)}</span>
      ) : (
        <span className="text-[#c99a2e]">협약 전</span>
      ),
  },
  {
    id: "bizStatus",
    label: "사업자",
    render: (m) => <BizStatusBadge status={bizStatusLabel(m.bizStatus)} />,
  },
  {
    id: "stores",
    label: "매장",
    render: (m) =>
      m.stores.length ? (
        <span
          className="block max-w-[200px] truncate"
          title={m.stores.map((s) => `${s.storeCode} ${s.name}`).join(", ")}
        >
          {m.stores.length}곳 · {m.stores[0].name}
          {m.stores.length > 1 ? " 외" : ""}
        </span>
      ) : (
        muted("연결 전")
      ),
  },
  {
    // 회원 정보 · 사업자 등록(올림 · 임시 승인 · 인증) 중 늦은 쪽.
    id: "updatedAt",
    label: "마지막 업데이트",
    render: (m) => stamp(m.updatedAt),
  },
];

const AGREEMENT_OPTIONS = [
  { value: "done", label: "협약 완료" },
  { value: "none", label: "협약 전" },
];
const STORE_OPTIONS = [
  { value: "yes", label: "연결됨" },
  { value: "no", label: "연결 전" },
];
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * 제휴사(콜라보) 회원 — 최근 가입 순. 담당자가 매장에서 같이 가입한 회원을 맨 위에서 바로 찾게 한다.
 * PC 는 매장 관리와 같은 HeroUI 조건 상자 · Table · Pagination(2026-11-10 사용자), 휴대폰은 큰 카드(현장에서 누르기 쉽게).
 * ?agreement · ?biz · ?store 로 들어오면 그 조건으로 연다(대시보드 숫자에서).
 */
export function CollabMembersListView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [agreement, setAgreement] = useState(
    searchParams.get("agreement") ?? "",
  );
  const [biz, setBiz] = useState(searchParams.get("biz") ?? "");
  const [store, setStore] = useState(searchParams.get("store") ?? "");
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { data, isFetching, isError } = useCollabMembers({
    page,
    page_size: pageSize,
    keyword: keyword || undefined,
    agreement: agreement || undefined,
    biz: biz || undefined,
    store: store || undefined,
  });

  const rows = useMemo<Row[]>(
    () =>
      (data?.items ?? []).map((m, i) => ({
        ...m,
        no: (page - 1) * pageSize + i + 1,
      })),
    [data, page, pageSize],
  );

  const total = data?.total ?? 0;
  const filtered = !!(agreement || biz || store);
  const searching = filtered || !!keyword;

  const submitKeyword = (value = keywordInput) => {
    setKeywordInput(value);
    setKeyword(value.trim());
    setPage(1);
  };
  const resetFilters = () => {
    setAgreement("");
    setBiz("");
    setStore("");
    setPage(1);
  };
  const resetAll = () => {
    resetFilters();
    setKeywordInput("");
    setKeyword("");
  };

  const filters = [
    {
      key: "agreement",
      label: "협약",
      value: agreement,
      set: setAgreement,
      options: AGREEMENT_OPTIONS,
    },
    {
      key: "biz",
      label: "사업자",
      value: biz,
      set: setBiz,
      options: BIZ_STATUS_OPTIONS,
    },
    {
      key: "store",
      label: "매장",
      value: store,
      set: setStore,
      options: STORE_OPTIONS,
    },
  ];

  return (
    <div className="flex flex-col gap-[20px] md:gap-[24px]">
      <CollabPageHead
        title="제휴사 회원"
        desc="최근 가입 순이에요. 회원을 눌러 사업자 임시 승인 · 매장 연결을 해요."
      />

      {isError ? (
        <ErrorState
          title="제휴사 회원을 불러오지 못했어요"
          message="잠시 후 다시 시도해 주세요."
          homeHref={MEMBERS_HREF}
        />
      ) : !data ? (
        <LoadingState />
      ) : (
        <>
          {/* PC: 조건 · 표 · 쪽 넘기기 */}
          <div className="hidden flex-col gap-[20px] md:flex md:gap-[24px]">
            <AdminPanel contentClassName="gap-[12px]">
              <div className="grid grid-cols-3 gap-[12px] xl:grid-cols-6">
                {filters.map((f) => (
                  <div key={f.key} className="flex min-w-0 flex-col gap-[6px]">
                    <span className="text-xs font-semibold text-tone-4a5565">
                      {f.label}
                    </span>
                    <HeroSelect
                      ariaLabel={f.label}
                      value={f.value}
                      onChange={(v) => {
                        f.set(v);
                        setPage(1);
                      }}
                      options={f.options}
                      placeholder="전체"
                      emptyLabel="전체"
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-[8px]">
                <Input
                  aria-label="회원 검색"
                  variant="secondary"
                  className="min-w-0 flex-1"
                  placeholder="고유번호 · 이름 · 아이디 · 연락처로 검색"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing)
                      submitKeyword();
                  }}
                />
                <Button variant="primary" onPress={() => submitKeyword()}>
                  <Search className="size-[16px]" />
                  검색
                </Button>
                {(searching || keywordInput) && (
                  <Button variant="tertiary" onPress={resetAll}>
                    초기화
                  </Button>
                )}
              </div>
            </AdminPanel>
            <AdminPanel contentClassName="gap-[16px]">
              <div className="flex flex-wrap items-center justify-between gap-[12px]">
                <p className="text-sm font-medium text-tone-4a5565">
                  {searching ? "조건에 맞는 " : "모두 "}
                  <span className="font-bold text-black">
                    {total.toLocaleString()}
                  </span>
                  명
                </p>
                <Select
                  aria-label="한 쪽에 보일 개수"
                  className="w-[140px]"
                  variant="secondary"
                  selectedKey={String(pageSize)}
                  onSelectionChange={(key) => {
                    if (key == null) return;
                    setPageSize(Number(key));
                    setPage(1);
                  }}
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <ListBox.Item
                          key={n}
                          id={String(n)}
                          textValue={`${n}개씩 보기`}
                        >
                          {n}개씩 보기
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>

              <Table
                className={cn("transition-opacity", isFetching && "opacity-60")}
              >
                {/* 칸이 많아 옆으로 밀어 보고, 길면 표 안에서 위아래로 — 가로 막대가 늘 화면 안에 있다. */}
                <Table.ScrollContainer className="max-h-[calc(100dvh-240px)] overflow-y-auto">
                  <Table.Content
                    aria-label="제휴사 회원 목록"
                    className="min-w-max"
                    onRowAction={(key) =>
                      router.push(`${MEMBERS_HREF}/${String(key)}`)
                    }
                  >
                    <Table.Header
                      columns={COLUMNS}
                      className="sticky top-0 z-10"
                    >
                      {(col) => (
                        <Table.Column
                          id={col.id}
                          isRowHeader={col.isRowHeader}
                          className="whitespace-nowrap"
                        >
                          {col.label}
                        </Table.Column>
                      )}
                    </Table.Header>
                    <Table.Body
                      items={rows}
                      renderEmptyState={() => (
                        <p className="py-[48px] text-center text-sm font-medium text-disabled">
                          {searching
                            ? "조건에 맞는 회원이 없어요."
                            : "제휴사 회원이 없어요."}
                        </p>
                      )}
                    >
                      {(member) => (
                        <Table.Row
                          id={member.id}
                          columns={COLUMNS}
                          className="cursor-pointer"
                        >
                          {(col) => (
                            <Table.Cell className="whitespace-nowrap">
                              {col.render(member)}
                            </Table.Cell>
                          )}
                        </Table.Row>
                      )}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>

              <PageNav
                page={page}
                pageSize={pageSize}
                total={total}
                onChange={setPage}
                className="self-center"
              />
            </AdminPanel>
          </div>

          {/* 휴대폰: 검색 한 칸 + 큰 카드 */}
          <div className="flex flex-col gap-[12px] md:hidden">
            <form
              className="relative"
              onSubmit={(e) => {
                e.preventDefault();
                submitKeyword();
              }}
            >
              <Input
                type="search"
                variant="primary"
                fullWidth
                aria-label="회원 검색"
                placeholder="이름 · 연락처 · 고유번호"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                className="h-[48px] pr-[44px] text-base"
              />
              <Button
                type="submit"
                isIconOnly
                variant="ghost"
                aria-label="검색"
                className="absolute right-[4px] top-1/2 size-[40px] -translate-y-1/2 text-tone-4a5565"
              >
                <Search className="size-[20px]" />
              </Button>
            </form>
            {filtered && (
              <Button
                size="sm"
                variant="ghost"
                onPress={resetFilters}
                className="h-auto self-start p-0 text-xs font-medium text-primary-800 underline data-[hovered=true]:bg-transparent"
              >
                조건 풀고 전체 보기
              </Button>
            )}
            <p className="text-xs text-disabled">
              {isFetching ? "불러오는 중…" : `${total.toLocaleString()}명`}
            </p>
            <ul className="flex flex-col gap-[10px]">
              {rows.length === 0 && (
                <li className="rounded-[16px] bg-surface py-[40px] text-center shadow-surface text-sm text-disabled">
                  제휴사 회원이 없어요.
                </li>
              )}
              {rows.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`${MEMBERS_HREF}/${m.id}`}
                    className="flex flex-col gap-[8px] rounded-[16px] bg-surface p-[16px] shadow-surface active:bg-gray-50"
                  >
                    <div className="flex items-center justify-between gap-[8px]">
                      <span className="min-w-0 truncate text-base font-semibold text-black">
                        {m.name || m.loginId}
                      </span>
                      <BizStatusBadge status={bizStatusLabel(m.bizStatus)} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-[8px] gap-y-[4px] text-sm text-tone-4a5565">
                      <span className="font-semibold text-black">
                        {m.partnerCode ?? "-"}
                      </span>
                      {m.phone && <span>{formatPhone(m.phone)}</span>}
                      <span className="text-disabled">
                        가입 {formatDateTime(m.createdAt)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-[6px]">
                      <Chip
                        size="sm"
                        variant="soft"
                        color={m.agreedAt ? "success" : "warning"}
                      >
                        {m.agreedAt ? "협약 완료" : "협약 전"}
                      </Chip>
                      <Chip size="sm" variant="soft">
                        {m.stores.length
                          ? `매장 ${m.stores.length}곳`
                          : "매장 연결 전"}
                      </Chip>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <PageNav
              page={page}
              pageSize={pageSize}
              total={total}
              onChange={setPage}
              className="self-center"
            />
          </div>
        </>
      )}
    </div>
  );
}
