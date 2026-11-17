"use client";

import { Button, Chip, Input } from "@heroui/react";
import { Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { collabScript } from "@/app/(client)/(main)/_components/collabFont";
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
  dotDateTime,
  type AdminAdvertiserMember,
} from "@/lib/adminCollab";
import { BizStatusBadge, bizStatusLabel } from "@/lib/bizStatus";
import { formatPhone } from "@/lib/phone";
import { isOptimizable, mediaSrc } from "@/lib/media";
import { cn } from "@/lib/utils";

import { BizReviewQueue } from "../../_components/BizReviewQueue";
import { CollabPageHead, SimplePager } from "../../_components/collabUi";

type Row = AdminAdvertiserMember & { no: string };
type Brand = AdminAdvertiserMember["brands"][number];

/**
 * 브랜드 사진 — 목록(작게) · 상세(크게) · 광고주 회원 팝업 · 의뢰서에서 같이 쓴다.
 * 없으면 광고주 화면(BrandAvatar)과 같은 기본 이미지 — 회색 바탕에 옅은 회색 "C"(11-17 사용자, 예전엔 보라 바탕 이름 첫 글자).
 */
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
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-gray-100",
        // 글꼴 파일이 Regular 하나뿐이라 font-bold 는 브라우저가 굵게 만들어 그린다(BrandAvatar 와 같다).
        !src &&
          cn(collabScript.className, "leading-none font-bold text-gray-400"),
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.55) }}
      title={brand.name}
      role={src ? undefined : "img"}
      aria-label={src ? undefined : `${brand.name} 기본 브랜드 이미지`}
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
        "C"
      )}
    </span>
  );
}

/** 담당자 한 줄 — 이름 · 직함 · 소속팀 중 있는 것만. */
export function contactLine(m: AdminAdvertiserMember) {
  const parts = [m.contactName, m.position, m.department].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * 표 열(11-12 사용자) — 이름 · 아이디 · 담당자명 · 연락처 · 사업자등록증 · 브랜드 · 가입일 · 마지막 로그인(11-16) · 콜라보.
 * 값이 말줄임(…)으로 잘리지 않게: 칸마다 줄바꿈 없이 다 보이고, 넓어지면 표가 옆으로 밀린다(CommonTable 가로 스크롤).
 * 브랜드가 여러 개면 브랜드끼리만 줄을 바꾼다. 콜라보는 보낸 의뢰 중 취소를 뺀 수(collabCount).
 */
const NOWRAP = "whitespace-nowrap";
const columnList: TableColumn<Row>[] = [
  {
    name: "name",
    label: "이름",
    className: `${NOWRAP} font-medium text-black`,
    renderer: (m) => m.name || "-",
  },
  {
    name: "loginId",
    label: "아이디",
    className: NOWRAP,
    renderer: (m) => (
      <>
        {m.snsProvider && (
          <span className="text-disabled">{m.snsProvider} · </span>
        )}
        {m.loginId}
      </>
    ),
  },
  {
    name: "contactName",
    label: "담당자명",
    className: NOWRAP,
    renderer: (m) =>
      m.contactName || <span className="text-disabled">-</span>,
  },
  // 연락처는 숫자만 저장돼 있어 '-'를 넣어 보인다(제휴사 회원과 같다).
  {
    name: "phone",
    label: "연락처",
    className: NOWRAP,
    renderer: (m) => formatPhone(m.phone) || "-",
  },
  {
    name: "bizStatus",
    label: "사업자등록증",
    className: NOWRAP,
    renderer: (m) => <BizStatusBadge status={bizStatusLabel(m.bizStatus)} />,
  },
  {
    name: "brands",
    label: "브랜드",
    renderer: (m) =>
      m.brands.length ? (
        <span className="flex min-w-[140px] flex-wrap items-center gap-x-[12px] gap-y-[6px]">
          {m.brands.map((b) => (
            <span
              key={b.id}
              className="flex items-center gap-[6px] whitespace-nowrap"
            >
              <BrandThumb brand={b} size={22} />
              {b.name}
            </span>
          ))}
        </span>
      ) : (
        <span className="whitespace-nowrap text-disabled">등록 전</span>
      ),
  },
  {
    name: "createdAt",
    label: "가입일",
    className: `${NOWRAP} text-disabled`,
    renderer: (m) => dotDate(m.createdAt),
  },
  {
    // 로그인 · 로그인 유지로 토큰을 새로 받은 마지막 시각(091, 2026-11-16 사용자).
    name: "lastLoginAt",
    label: "마지막 로그인",
    className: `${NOWRAP} text-disabled`,
    renderer: (m) => dotDateTime(m.lastLoginAt),
  },
  {
    name: "collabCount",
    label: "콜라보",
    className: NOWRAP,
    renderer: (m) =>
      m.collabCount ? (
        <span className="font-semibold text-black">{m.collabCount}건</span>
      ) : (
        <span className="text-disabled">0건</span>
      ),
  },
];

// 검색 조건은 사업자등록증 현황 하나만(11-11 사용자 — 브랜드 · 명함 조건은 뺐다).
const searchOptionList: SearchOption[] = [
  {
    type: "select",
    name: "biz",
    label: "사업자등록증 현황",
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
 * 담당자 · 브랜드 · 사업자 상태와 콜라보 수(취소 뺀 의뢰 수)를 보여 준다. PC 는 표, 휴대폰은 카드.
 * 맨 위 "검토 대기" 칸(BizReviewQueue) — 제휴사 회원과 같다(11-17 사용자: "광고주 회원도 제휴사 회원처럼 검토 대기를 동일하게").
 * 머리 설명 글도 제휴사 회원처럼 뺐다.
 */
export function CollabAdvertisersListView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState<SearchParams>(() => ({
    biz: searchParams.get("biz") ?? undefined,
  }));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { data, isFetching } = useCollabAdvertisers({
    page,
    page_size: pageSize,
    keyword: search.keyword || undefined,
    biz: search.biz || undefined,
  });

  // 검토 대기 — 아래 표 조건과 따로 늘 불러온다(메뉴 숫자가 바뀌면 같이 새로 불러온다 — advertisers 키).
  const { data: waiting } = useCollabAdvertisers({
    biz: "reviewing",
    page: 1,
    page_size: 50,
  });

  const rows = useMemo<Row[]>(
    () =>
      (data?.items ?? []).map((m, i) => ({
        ...m,
        no: String((page - 1) * pageSize + i + 1),
      })),
    [data, page, pageSize],
  );

  const filtered = !!search.biz;

  return (
    <div className="flex flex-col gap-[20px] md:gap-[24px]">
      <CollabPageHead title="광고주 회원" />

      <BizReviewQueue
        items={(waiting?.items ?? []).map((m) => ({
          id: m.id,
          caption: m.companyName,
          name: m.name || m.loginId,
          loginId: m.loginId,
          uploadedAt: m.bizUploadedAt,
        }))}
        total={waiting?.total ?? 0}
        hrefOf={(id) => `/admin/collab/advertisers/${id}`}
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
            variant="primary"
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
            <li className="rounded-[16px] bg-surface py-[40px] text-center shadow-surface text-sm text-disabled">
              광고주 회원이 없습니다.
            </li>
          )}
          {rows.map((m) => (
            <li key={m.id}>
              <Link
                href={`/admin/collab/advertisers/${m.id}`}
                className="flex flex-col gap-[8px] rounded-[16px] bg-surface p-[16px] shadow-surface active:bg-gray-50"
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
                  {m.phone && <span>{formatPhone(m.phone)}</span>}
                  <span className="text-disabled">
                    가입 {dotDate(m.createdAt)}
                  </span>
                  {m.lastLoginAt && (
                    <span className="text-disabled">
                      로그인 {dotDateTime(m.lastLoginAt)}
                    </span>
                  )}
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
                  <Chip size="sm" variant="soft">
                    콜라보 {m.collabCount ?? 0}건
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
