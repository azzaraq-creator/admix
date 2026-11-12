"use client";

import {
  Button,
  ListBox,
  SearchField,
  Select,
  Table,
  Tag,
  TagGroup,
} from "@heroui/react";
import { Plus, RotateCcw } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { AdminPanel } from "@/components/admin/AdminPanel";
import { ErrorState, LoadingState } from "@/components/common/RouteStates";
import { useStoreTypes } from "@/hooks/adminCollab";
import { useAdminPartnersStores } from "@/hooks/adminPartners";
import { BizStatusBadge, bizStatusLabel } from "@/lib/bizStatus";
import {
  COLLAB_GRADES,
  wonLabel,
  type AdminPartnersStore,
} from "@/lib/partners";
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

/**
 * 칸 순서 — No · 매장 ID · 등급 · 대표 사진 · 매장명 · 유형 · 주소 · 콜라보 금액 · 연결 회원(2026-11-12 사용자).
 * 매장 어필 · 매체 찾기 ID · 상태 · 등록 · 수정 일시는 목록에서 뺐다(매장 상세에서 본다). 비공개 매장만 매장명 옆에 흐리게 "비공개".
 */
const COLUMNS: StoreTableColumn[] = [
  {
    id: "no",
    label: "No",
    render: (s) => <span className="text-disabled">{s.no}</span>,
  },
  {
    id: "storeCode",
    label: "매장 ID",
    render: (s) => <span className="font-semibold">{s.storeCode ?? "-"}</span>,
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
    render: (s) => (
      <span className="font-medium text-black">
        {s.name}
        {s.status === "hidden" && (
          <span className="ml-[6px] text-xs font-normal text-disabled">
            {STATUS_LABEL.hidden}
          </span>
        )}
      </span>
    ),
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
      <span className="block max-w-[320px] truncate" title={s.address}>
        {s.address}
      </span>
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
  // 새 콜라보마다 물은 참여 / 미참여, 모집이 끝날 때까지 답이 없으면 무응답(11-12 사용자). 매장 상세에 기록.
  {
    id: "collabResponses",
    label: "콜라보 응답",
    render: (s) => {
      const r = s.collabResponses;
      if (!s.ownerUserId || !r) return muted("-");
      return (
        <span className="whitespace-nowrap">
          참여 <b>{r.joined}</b> · 미참여 {r.passed} · 무응답 {r.silent}
        </span>
      );
    },
  },
];

/** 고르기 칩의 "전체" — 값은 비움(서버에 안 보냄), 칩 id 는 빈 문자열을 못 써서 따로. */
const ALL = "";
const ALL_KEY = "__all__";
const GRADE_OPTIONS = [
  ...COLLAB_GRADES.map((g) => ({ value: g, label: g })),
  { value: "none", label: "미정" },
];
const LINKED_OPTIONS = [
  { value: "yes", label: "연결됨" },
  { value: "no", label: "연결 전" },
];
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * 콜라보 어드민 "매장 관리" → 협업 확정 카페 — 매장은 어드민에서만 등록한다(069). 제휴사는 가입만 하고,
 * 담당자가 매장 ID(S-0001)를 회원 고유번호(P-0001)와 잇는다. ?linked=no 로 들어오면 연결 전 매장만.
 * 위는 검색 + 고르기 칩(유형 · 등급 · 회원 연결 — admix 매체 찾기 필터 칩과 같은 모양, 2026-11-12 사용자: 상태 대신 등급 · 유형).
 */
export function PartnersStoreListView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [storeType, setStoreType] = useState("");
  const [grade, setGrade] = useState("");
  const [linked, setLinked] = useState(searchParams.get("linked") ?? "");
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { data, isFetching, isError } = useAdminPartnersStores({
    page,
    page_size: pageSize,
    keyword: keyword || undefined,
    store_type: storeType ? Number(storeType) : undefined,
    grade: grade || undefined,
    linked: linked || undefined,
  });
  const { data: storeTypes = [] } = useStoreTypes();

  const rows = useMemo<Row[]>(
    () =>
      (data?.items ?? []).map((s, i) => ({
        ...s,
        no: (page - 1) * pageSize + i + 1,
      })),
    [data, page, pageSize],
  );

  const total = data?.total ?? 0;
  const searching = !!(storeType || grade || linked || keyword);

  const submitKeyword = () => {
    setKeyword(keywordInput.trim());
    setPage(1);
  };
  const resetAll = () => {
    setStoreType("");
    setGrade("");
    setLinked("");
    setKeywordInput("");
    setKeyword("");
    setPage(1);
  };

  const filters = [
    {
      key: "storeType",
      label: "유형",
      value: storeType,
      set: setStoreType,
      options: storeTypes.map((t) => ({ value: String(t.id), label: t.name })),
    },
    {
      key: "grade",
      label: "등급",
      value: grade,
      set: setGrade,
      options: GRADE_OPTIONS,
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
    <div className="flex flex-col gap-[20px] md:gap-[24px]">
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
        <div className="flex flex-col gap-[20px] md:gap-[24px]">
          {/* 검색 + 고르기 칩 — 흰 카드 하나에 줄마다 이름 | 칩(테두리 · 줄 구분선 없이). 칩을 누르면 바로 거른다. */}
          <AdminPanel contentClassName="gap-[6px]">
            <FilterRow label="검색">
              <SearchField
                aria-label="매장 검색"
                variant="secondary"
                className="w-full max-w-[560px]"
                value={keywordInput}
                onChange={setKeywordInput}
                onSubmit={submitKeyword}
                onClear={() => {
                  setKeyword("");
                  setPage(1);
                }}
              >
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input placeholder="매장명 · 주소 · 매장 ID · 회원 고유번호로 검색" />
                  <SearchField.ClearButton />
                </SearchField.Group>
              </SearchField>
            </FilterRow>
            {filters.map((f) => (
              <FilterRow key={f.key} label={f.label}>
                <FilterChips
                  label={f.label}
                  value={f.value}
                  options={f.options}
                  onChange={(v) => {
                    f.set(v);
                    setPage(1);
                  }}
                />
              </FilterRow>
            ))}
          </AdminPanel>
          <AdminPanel contentClassName="gap-[16px]">
            <div className="flex flex-wrap items-center justify-between gap-[12px]">
              <div className="flex items-center gap-[8px]">
                <p className="text-sm font-medium text-tone-4a5565">
                  {searching ? "조건에 맞는 " : "모두 "}
                  <span className="font-bold text-black">
                    {total.toLocaleString()}
                  </span>
                  곳
                </p>
                {(searching || keywordInput) && (
                  <Button size="sm" variant="tertiary" onPress={resetAll}>
                    <RotateCcw className="size-[14px]" />
                    초기화
                  </Button>
                )}
              </div>
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
          </AdminPanel>
        </div>
      )}
    </div>
  );
}

/** 조건 한 줄 — 왼쪽 이름(고정 폭) | 오른쪽 칸. 모바일은 이름을 위로. */
function FilterRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[8px] py-[6px] sm:flex-row sm:items-center sm:gap-[16px]">
      <span className="w-[72px] shrink-0 text-sm font-semibold text-tone-4a5565">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

const FILTER_TAG = cn(
  "flex h-[32px] shrink-0 items-center rounded-[13px] border border-gray-200 bg-surface px-[14px] text-[13px] font-medium text-gray-600 transition-colors",
  "hover:border-gray-300",
  "data-[selected=true]:border-gray-400 data-[selected=true]:bg-surface data-[selected=true]:font-bold data-[selected=true]:text-gray-900",
);

/** 하나 고르기 칩 — 맨 앞 "전체"(값 비움). admix 매체 찾기 필터 칩과 같은 모양(HeroUI TagGroup). */
function FilterChips({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <TagGroup
      aria-label={label}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={new Set([value || ALL_KEY])}
      onSelectionChange={(keys) => {
        const next = [...keys][0];
        if (next == null) return;
        onChange(next === ALL_KEY ? ALL : String(next));
      }}
    >
      <TagGroup.List className="flex flex-wrap gap-[8px]">
        <Tag id={ALL_KEY} className={FILTER_TAG}>
          전체
        </Tag>
        {options.map((o) => (
          <Tag key={o.value} id={o.value} className={FILTER_TAG}>
            {o.label}
          </Tag>
        ))}
      </TagGroup.List>
    </TagGroup>
  );
}
