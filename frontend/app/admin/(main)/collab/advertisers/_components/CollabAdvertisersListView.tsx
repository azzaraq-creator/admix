"use client";

import { Button, Chip, Input } from "@heroui/react";
import { Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import {
  CommonTable,
  type SearchOption,
  type SearchParams,
  type TableColumn,
} from "@/components/common/Table/CommonTable";
import { useCollabAdvertisers } from "@/hooks/adminCollab";
import {
  BIZ_STATUS_OPTIONS,
  dotDate,
  type AdminAdvertiserMember,
} from "@/lib/adminCollab";
import { BizStatusBadge, bizStatusLabel } from "@/lib/bizStatus";
import { isOptimizable, mediaSrc } from "@/lib/media";
import { cn } from "@/lib/utils";

import { CollabPageHead, SimplePager } from "../../_components/collabUi";

type Row = AdminAdvertiserMember & { no: string };
type Brand = AdminAdvertiserMember["brands"][number];

/** 브랜드 사진 — 없으면 이름 첫 글자. 목록(작게) · 상세(크게)에서 같이 쓴다. */
export function BrandThumb({
  brand,
  size = 28,
  className,
}: {
  brand: Pick<Brand, "name" | "imageUrl">;
  size?: number;
  className?: string;
}) {
  const src = brand.imageUrl ? mediaSrc(brand.imageUrl) : null;
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-primary-50 font-bold text-primary-800",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      title={brand.name}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes={`${size}px`}
          unoptimized={!isOptimizable(src)}
          className="object-cover"
        />
      ) : (
        brand.name.slice(0, 1)
      )}
    </span>
  );
}

/** 담당자 한 줄 — 이름 · 직함 · 소속팀 중 있는 것만. */
export function contactLine(m: AdminAdvertiserMember) {
  const parts = [m.contactName, m.position, m.department].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

const columnList: TableColumn<Row>[] = [
  { name: "no", label: "No", className: "text-disabled" },
  {
    name: "name",
    label: "이름",
    renderer: (m) => (
      <span className="flex flex-col">
        <span>{m.name || "-"}</span>
        {m.companyName && (
          <span className="text-xs text-disabled">{m.companyName}</span>
        )}
      </span>
    ),
  },
  {
    name: "loginId",
    label: "아이디",
    renderer: (m) => (
      <span className="block max-w-[220px] truncate" title={m.loginId}>
        {m.snsProvider ? `${m.snsProvider} · ` : ""}
        {m.loginId}
      </span>
    ),
  },
  {
    name: "contactName",
    label: "담당자",
    renderer: (m) => {
      const line = contactLine(m);
      return line ? (
        <span className="block max-w-[180px] truncate" title={line}>
          {line}
        </span>
      ) : (
        <span className="text-disabled">-</span>
      );
    },
  },
  { name: "phone", label: "연락처", renderer: (m) => m.phone || "-" },
  {
    name: "brands",
    label: "브랜드",
    renderer: (m) =>
      m.brands.length ? (
        <span
          className="flex max-w-[220px] items-center gap-[8px]"
          title={m.brands.map((b) => b.name).join(", ")}
        >
          <span className="flex -space-x-[6px]">
            {m.brands.slice(0, 3).map((b) => (
              <BrandThumb
                key={b.id}
                brand={b}
                size={24}
                className="ring-2 ring-white"
              />
            ))}
          </span>
          <span className="min-w-0 truncate">
            {m.brands[0].name}
            {m.brands.length > 1 ? ` 외 ${m.brands.length - 1}` : ""}
          </span>
        </span>
      ) : (
        <span className="text-disabled">등록 전</span>
      ),
  },
  {
    name: "businessCardUrl",
    label: "명함",
    renderer: (m) =>
      m.businessCardUrl ? (
        <span>있음</span>
      ) : (
        <span className="text-disabled">-</span>
      ),
  },
  {
    name: "bizStatus",
    label: "사업자",
    renderer: (m) => <BizStatusBadge status={bizStatusLabel(m.bizStatus)} />,
  },
  {
    name: "createdAt",
    label: "가입일",
    className: "text-disabled",
    renderer: (m) => dotDate(m.createdAt),
  },
];

const YES_NO = (yes: string, no: string) => [
  { label: yes, value: "yes" },
  { label: no, value: "no" },
];

const searchOptionList: SearchOption[] = [
  {
    type: "select",
    name: "brand",
    label: "브랜드",
    row: 1,
    optionList: YES_NO("등록함", "등록 전"),
  },
  {
    type: "select",
    name: "card",
    label: "명함",
    row: 1,
    optionList: YES_NO("있음", "없음"),
  },
  {
    type: "select",
    name: "biz",
    label: "사업자",
    row: 1,
    optionList: BIZ_STATUS_OPTIONS,
  },
  {
    type: "text",
    name: "keyword",
    label: "",
    placeholder: "이름 · 아이디 · 회사 · 담당자 · 연락처 · 브랜드로 검색",
    row: 2,
  },
];

/**
 * 광고주 회원(11-10 사용자: "제휴사 회원뿐 아니라 광고주 회원도") — 최근 가입 순, 읽기 전용.
 * 콜라보 의뢰는 아직 서버에 없어 담당자 정보 · 브랜드 · 사업자 상태만 보여 준다. PC 는 표, 휴대폰은 카드.
 */
export function CollabAdvertisersListView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState<SearchParams>(() => ({
    brand: searchParams.get("brand") ?? undefined,
    card: searchParams.get("card") ?? undefined,
    biz: searchParams.get("biz") ?? undefined,
  }));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { data, isFetching } = useCollabAdvertisers({
    page,
    page_size: pageSize,
    keyword: search.keyword || undefined,
    brand: search.brand || undefined,
    card: search.card || undefined,
    biz: search.biz || undefined,
  });

  const rows = useMemo<Row[]>(
    () =>
      (data?.items ?? []).map((m, i) => ({
        ...m,
        no: String((page - 1) * pageSize + i + 1),
      })),
    [data, page, pageSize],
  );

  const filtered = !!(search.brand || search.card || search.biz);

  return (
    <div className="flex flex-col gap-[24px]">
      <CollabPageHead
        title="광고주 회원"
        desc="최근 가입 순이에요. 회원을 눌러 담당자 정보 · 브랜드 · 사업자 상태를 봐요."
      />

      <div className="hidden md:block">
        <CommonTable<Row>
          columnList={columnList}
          data={rows}
          idKey="id"
          searchOptionList={searchOptionList}
          initialSearch={search}
          onSearch={(params) => {
            setSearch(params);
            setPage(1);
          }}
          totalCount={data?.total ?? 0}
          usePageSizeSelect
          pageSize={pageSize}
          manualPagination
          page={page}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
          emptyMessage="광고주 회원이 없습니다."
          onRowClick={(m) => router.push(`/admin/collab/advertisers/${m.id}`)}
        />
      </div>

      {/* 휴대폰: 검색 한 칸 + 카드 */}
      <div className="flex flex-col gap-[12px] md:hidden">
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get("q");
            setSearch((prev) => ({
              ...prev,
              keyword: String(value ?? "").trim() || undefined,
            }));
            setPage(1);
          }}
        >
          <Input
            name="q"
            type="search"
            variant="secondary"
            fullWidth
            aria-label="광고주 검색"
            placeholder="이름 · 회사 · 연락처 · 브랜드"
            defaultValue={search.keyword ?? ""}
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
            onPress={() => {
              setSearch((prev) => ({ keyword: prev.keyword }));
              setPage(1);
            }}
            className="h-auto self-start p-0 text-xs font-medium text-primary-800 underline data-[hovered=true]:bg-transparent"
          >
            조건 풀고 전체 보기
          </Button>
        )}
        <p className="text-xs text-disabled">
          {isFetching ? "불러오는 중…" : `${data?.total ?? 0}명`}
        </p>
        <ul className="flex flex-col gap-[10px]">
          {data && rows.length === 0 && (
            <li className="rounded-[12px] border border-stroke py-[40px] text-center text-sm text-disabled">
              광고주 회원이 없습니다.
            </li>
          )}
          {rows.map((m) => (
            <li key={m.id}>
              <Link
                href={`/admin/collab/advertisers/${m.id}`}
                className="flex flex-col gap-[8px] rounded-[12px] border border-stroke p-[16px] active:bg-tone-f5f6f8"
              >
                <div className="flex items-center justify-between gap-[8px]">
                  <span className="min-w-0 truncate text-base font-semibold text-black">
                    {m.name || m.loginId}
                  </span>
                  <BizStatusBadge status={bizStatusLabel(m.bizStatus)} />
                </div>
                <div className="flex flex-wrap items-center gap-x-[8px] gap-y-[4px] text-sm text-tone-4a5565">
                  {m.companyName && (
                    <span className="font-semibold text-black">
                      {m.companyName}
                    </span>
                  )}
                  {m.phone && <span>{m.phone}</span>}
                  <span className="text-disabled">
                    가입 {dotDate(m.createdAt)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-[6px]">
                  {m.brands.length > 0 && (
                    <span className="flex -space-x-[6px]">
                      {m.brands.slice(0, 3).map((b) => (
                        <BrandThumb
                          key={b.id}
                          brand={b}
                          size={22}
                          className="ring-2 ring-white"
                        />
                      ))}
                    </span>
                  )}
                  <Chip size="sm" variant="soft">
                    {m.brands.length
                      ? `브랜드 ${m.brands.length}개`
                      : "브랜드 등록 전"}
                  </Chip>
                  {m.businessCardUrl && (
                    <Chip size="sm" variant="soft">
                      명함
                    </Chip>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
        <SimplePager
          page={page}
          pageSize={pageSize}
          total={data?.total ?? 0}
          onChange={setPage}
        />
      </div>
    </div>
  );
}
