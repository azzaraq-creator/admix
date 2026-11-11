"use client";

import { Button, Chip, Input, ListBox, Select, Table } from "@heroui/react";
import { Plus, Search } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { HeroSelect } from "@/app/admin/(main)/media/_components/heroFields";
import { ErrorState, LoadingState } from "@/components/common/RouteStates";
import { useAdminPartnersStores } from "@/hooks/adminPartners";
import { BizStatusBadge, bizStatusLabel } from "@/lib/bizStatus";
import { formatDateTime } from "@/lib/date";
import { cardTags, wonLabel, type AdminPartnersStore } from "@/lib/partners";
import { isOptimizable, mediaSrc } from "@/lib/media";
import { cn } from "@/lib/utils";

import { CollabPageHead, PageNav } from "../../_components/collabUi";
import { STORES_HREF, StoresTabs } from "./StoresTabs";

/** 표 한 줄 — 순번(no)만 덧붙인다. */
type Row = AdminPartnersStore & { no: number };

const STATUS_LABEL: Record<AdminPartnersStore["status"], string> = {
  active: "공개",
  hidden: "비공개",
};

/** 공개/비공개 뱃지 — 비공개 매장은 매체 찾기·광고주 매장 찾기에 보이지 않는다(제휴사 회원 상세에서도 쓴다). */
export function PartnersStatusBadge({
  status,
}: {
  status: AdminPartnersStore["status"];
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-[6px] px-[10px] py-[4px] text-xs font-medium leading-[16px]",
        status === "active"
          ? "bg-primary-50 text-primary-800"
          : "bg-gray-100 text-[#64748b]",
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

const muted = (text: string) => <span className="text-disabled">{text}</span>;

/** 표 칸 하나. */
interface StoreTableColumn {
  id: string;
  label: string;
  isRowHeader?: boolean;
  render: (store: Row) => ReactNode;
}

const COLUMNS: StoreTableColumn[] = [
  {
    id: "no",
    label: "No",
    render: (s) => <span className="tabular-nums text-disabled">{s.no}</span>,
  },
  {
    id: "storeCode",
    label: "매장 ID",
    render: (s) => <span className="font-semibold">{s.storeCode ?? "-"}</span>,
  },
  {
    id: "image",
    label: "대표 사진",
    render: (s) => {
      const first = s.imageUrls[0];
      if (!first) return muted("-");
      const src = mediaSrc(first);
      return (
        <span className="relative block size-[48px] overflow-hidden rounded-[8px] bg-zinc-100">
          <Image
            src={src}
            alt=""
            fill
            sizes="48px"
            unoptimized={!isOptimizable(src)}
            className="object-cover"
          />
        </span>
      );
    },
  },
  {
    id: "name",
    label: "매장명",
    isRowHeader: true,
    render: (s) => <span className="font-medium text-black">{s.name}</span>,
  },
  {
    id: "storeType",
    label: "유형",
    render: (s) => s.storeType ?? muted("미지정"),
  },
  {
    id: "address",
    label: "주소",
    render: (s) => (
      <span className="block max-w-[260px] truncate" title={s.address}>
        {s.address}
      </span>
    ),
  },
  {
    id: "tags",
    label: "매장 어필",
    // 매장 어필은 개수 제한이 없어 목록에는 3개까지, 나머지는 "+N"(전체는 마우스를 올리면).
    render: (s) => {
      const { shown, more } = cardTags(s.tags);
      return shown.length ? (
        <span
          className="text-primary-800"
          title={more ? s.tags.map((t) => `#${t}`).join(" ") : undefined}
        >
          {shown.map((t) => `#${t}`).join(" ")}
          {more > 0 && <span className="ml-[4px] text-disabled">+{more}</span>}
        </span>
      ) : (
        muted("-")
      );
    },
  },
  {
    id: "collabGrade",
    label: "등급",
    render: (s) =>
      s.collabGrade ? (
        <span className="font-semibold">{s.collabGrade}</span>
      ) : (
        muted("미정")
      ),
  },
  {
    id: "collabFee",
    label: "콜라보 금액",
    render: (s) => (s.collabFee ? wonLabel(s.collabFee) : muted("미정")),
  },
  {
    id: "owner",
    label: "연결 회원",
    render: (s) =>
      s.ownerUserId ? (
        <span className="flex flex-col gap-[4px]">
          <span>
            <span className="font-semibold">{s.ownerPartnerCode ?? "-"}</span>{" "}
            {s.ownerMemberName || s.ownerLoginId}
          </span>
          <BizStatusBadge status={bizStatusLabel(s.ownerBizStatus)} />
        </span>
      ) : (
        muted("연결 전")
      ),
  },
  {
    id: "mediaId",
    label: "매체 찾기 ID",
    render: (s) => s.mediaId ?? muted("노출 안 됨"),
  },
  {
    id: "status",
    label: "상태",
    render: (s) => (
      <Chip
        size="sm"
        variant="soft"
        color={s.status === "active" ? "accent" : "default"}
      >
        {STATUS_LABEL[s.status]}
      </Chip>
    ),
  },
  {
    id: "createdAt",
    label: "등록일시",
    render: (s) => (
      <span className="tabular-nums text-disabled">
        {formatDateTime(s.createdAt)}
      </span>
    ),
  },
  {
    // 매장 줄이 마지막으로 바뀐 때(서버 updated_at — 정보 · 사진 · 연결 회원 · 공개 상태 등).
    id: "updatedAt",
    label: "마지막 업데이트",
    render: (s) => (
      <span className="tabular-nums text-disabled">
        {formatDateTime(s.updatedAt)}
      </span>
    ),
  },
];

const STATUS_OPTIONS = [
  { value: "active", label: "공개" },
  { value: "hidden", label: "비공개" },
];
const LINKED_OPTIONS = [
  { value: "yes", label: "연결됨" },
  { value: "no", label: "연결 전" },
];
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * 콜라보 어드민 "매장 관리" → 협업 확정 카페 — 매장은 어드민에서만 등록한다(069). 제휴사는 가입만 하고,
 * 담당자가 매장 ID(S-0001)를 회원 고유번호(P-0001)와 잇는다. ?linked=no 로 들어오면 연결 전 매장만.
 * 협업 확정 전(영업 기록) 탭과 같은 HeroUI Table · Select · Input · Pagination.
 */
export function PartnersStoreListView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [linked, setLinked] = useState(searchParams.get("linked") ?? "");
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { data, isFetching, isError } = useAdminPartnersStores({
    page,
    page_size: pageSize,
    keyword: keyword || undefined,
    status: status || undefined,
    linked: linked || undefined,
  });

  const rows = useMemo<Row[]>(
    () =>
      (data?.items ?? []).map((s, i) => ({
        ...s,
        no: (page - 1) * pageSize + i + 1,
      })),
    [data, page, pageSize],
  );

  const total = data?.total ?? 0;
  const searching = !!(status || linked || keyword);

  const submitKeyword = () => {
    setKeyword(keywordInput.trim());
    setPage(1);
  };
  const resetAll = () => {
    setStatus("");
    setLinked("");
    setKeywordInput("");
    setKeyword("");
    setPage(1);
  };

  const filters = [
    {
      key: "status",
      label: "상태",
      value: status,
      set: setStatus,
      options: STATUS_OPTIONS,
    },
    {
      key: "linked",
      label: "회원 연결",
      value: linked,
      set: setLinked,
      options: LINKED_OPTIONS,
    },
  ];

  return (
    <div className="flex flex-col gap-[24px]">
      <CollabPageHead
        title="매장 관리"
        desc={`매장은 여기서만 등록해요. 회원과 연결하면 그 회원의 "내 매장"에 보여요.`}
      >
        <Button
          variant="primary"
          size="sm"
          onPress={() => router.push(`${STORES_HREF}/new`)}
        >
          <Plus className="size-[16px]" />
          매장 등록
        </Button>
      </CollabPageHead>
      <StoresTabs current="stores" />

      {isError ? (
        <ErrorState
          title="매장 목록을 불러오지 못했어요"
          message="잠시 후 다시 시도해 주세요."
          homeHref={STORES_HREF}
        />
      ) : !data ? (
        <LoadingState />
      ) : (
        <div className="flex flex-col gap-[16px]">
          {/* 조건 · 검색 */}
          <div className="flex flex-col gap-[12px] rounded-[12px] border border-stroke bg-tone-fafafc p-[16px] md:p-[20px]">
            <div className="grid grid-cols-2 gap-[12px] md:grid-cols-3 xl:grid-cols-6">
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
                aria-label="매장 검색"
                variant="secondary"
                className="min-w-0 flex-1"
                placeholder="매장명 · 주소 · 매장 ID · 회원 고유번호로 검색"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing)
                    submitKeyword();
                }}
              />
              <Button variant="primary" onPress={submitKeyword}>
                <Search className="size-[16px]" />
                검색
              </Button>
              {(searching || keywordInput) && (
                <Button variant="tertiary" onPress={resetAll}>
                  초기화
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-[12px]">
            <p className="text-sm font-medium text-tone-4a5565">
              {searching ? "조건에 맞는 " : "모두 "}
              <span className="font-bold tabular-nums text-black">
                {total.toLocaleString()}
              </span>
              곳
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
                aria-label="협업 확정 카페 목록"
                className="min-w-max"
                onRowAction={(key) =>
                  router.push(`${STORES_HREF}/${String(key)}`)
                }
              >
                <Table.Header columns={COLUMNS} className="sticky top-0 z-10">
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
                        ? "조건에 맞는 매장이 없어요."
                        : "등록된 매장이 없어요."}
                    </p>
                  )}
                >
                  {(store) => (
                    <Table.Row
                      id={store.id}
                      columns={COLUMNS}
                      className="cursor-pointer"
                    >
                      {(col) => (
                        <Table.Cell className="whitespace-nowrap">
                          {col.render(store)}
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
        </div>
      )}
    </div>
  );
}
