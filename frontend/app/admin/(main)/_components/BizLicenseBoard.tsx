"use client";

import { Button, Card, Chip, Input, Tabs } from "@heroui/react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Download, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { HeroSelect } from "@/app/admin/(main)/media/_components/heroFields";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { MaskIcon } from "@/components/common/MaskIcon";
import { ErrorState, LoadingState } from "@/components/common/RouteStates";
import {
  CommonTable,
  type TableColumn,
} from "@/components/common/Table/CommonTable";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { dotDateTime } from "@/lib/adminCollab";
import { extractApiError } from "@/lib/apiError";
import {
  BIZ_LICENSE_STATUS_OPTIONS,
  type BizLicenseItem,
  type BizLicensePage,
  type BizLicenseParams,
  type BizLicenseZipParams,
} from "@/lib/bizLicense";
import { bizStatusLabel } from "@/lib/bizStatus";
import { isOptimizable, mediaSrc } from "@/lib/media";
import { openFileInNewTab } from "@/lib/openFileInNewTab";
import { saveBlob } from "@/lib/saveBlob";

import { CollabPageHead, PageNav } from "../collab/_components/collabUi";

type View = "list" | "card";

/** 한 쪽에 보이는 수 — 목록은 20줄, 카드는 넓은 화면 4줄 × 3. */
const PAGE_SIZE: Record<View, number> = { list: 20, card: 12 };

/** 전체 다운로드 중일 때 saving 값(회원 하나를 받을 땐 그 회원 id). */
const ALL = "__all__";

const isImage = (url: string) => /\.(png|jpe?g|gif|webp)$/i.test(url);

/** 상태 칩 색 — 회원 상세 사업자 인증 칩과 같다. */
const STATUS_COLOR: Record<
  string,
  "default" | "accent" | "success" | "warning" | "danger"
> = {
  reviewing: "warning",
  provisional: "accent",
  verified: "success",
  rejected: "danger",
};

/** 오늘 날짜 "20261126" — zip 이름에(서버 이름과 같게). */
function today() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

/** 파일 받기 실패 사유 — 파일로 받으려던 응답(blob)이면 안의 서버 문구를 꺼낸다. */
async function fileErrorMessage(err: unknown) {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (data instanceof Blob) {
    try {
      const body = JSON.parse(await data.text()) as { detail?: unknown };
      if (typeof body.detail === "string") return body.detail;
    } catch {
      // JSON 이 아니면 아래 기본 문구로
    }
  }
  return extractApiError(err);
}

/**
 * 사업자등록증 모아 보기(2026-11-26 사용자: "사업자등록증을 따로 모아서 볼 수 있는 메뉴") — admix · 콜라보 어드민이 같이 쓴다.
 * 조건(회원 유형 · 상태 · 검색) → 목록 | 카드(같은 날 "리스트 형식으로 볼 수 있게") → 쪽 번호. 최근 올린 것부터.
 * 하나씩 다운로드 · 전체 다운로드(zip, 지금 조건에 맞는 것 전부). 파일 이름은 "회원 유형_상호(없으면 회원 이름)_사업자등록증.확장자"
 * — 서버가 정해 준다(downloadName). 등록증 보기는 새 탭, 이름을 누르면 그 회원 상세. 인증 처리는 회원 상세에서 한다.
 */
export function BizLicenseBoard({
  categoryOptions,
  useLicenses,
  hrefOf,
  loadFile,
  loadZip,
  homeHref,
}: {
  /** 회원 유형 조건 — 값은 서버 코드(partner · advertiser …). */
  categoryOptions: { value: string; label: string }[];
  useLicenses: (params: BizLicenseParams) => UseQueryResult<BizLicensePage>;
  /** 회원 상세 주소 */
  hrefOf: (item: BizLicenseItem) => string;
  /** 원본 파일(blob) — 어드민마다 받는 주소가 다르다. */
  loadFile: (item: BizLicenseItem) => Promise<Blob>;
  /** 조건에 맞는 등록증 전부(zip). */
  loadZip: (params: BizLicenseZipParams) => Promise<Blob>;
  /** 불러오지 못했을 때 "홈으로" — 그 어드민 첫 화면. */
  homeHref: string;
}) {
  const [view, setView] = useState<View>("list");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState<string | null>(null);
  const { alert, confirmDialog } = useAdminConfirm();

  const filterParams: BizLicenseZipParams = {
    category: category || undefined,
    status: status || undefined,
    keyword: keyword || undefined,
  };
  const pageSize = PAGE_SIZE[view];
  const { data, isError, isPlaceholderData } = useLicenses({
    page,
    page_size: pageSize,
    ...filterParams,
  });
  const total = data?.total ?? 0;
  const searching = !!(category || status || keyword);
  // 회원 유형 이름은 그 어드민 조건과 같게(콜라보는 "제휴사", admix 는 "제휴사(콜라보)").
  const categoryLabels = new Map(
    categoryOptions.map((o) => [o.value, o.label]),
  );
  const categoryOf = (item: BizLicenseItem) =>
    categoryLabels.get(item.category ?? "") ?? item.categoryLabel;

  const submitKeyword = () => {
    setKeyword(keywordInput.trim());
    setPage(1);
  };
  const resetAll = () => {
    setCategory("");
    setStatus("");
    setKeywordInput("");
    setKeyword("");
    setPage(1);
  };

  const failed = async (title: string, err: unknown) =>
    alert({
      title,
      description: await fileErrorMessage(err),
      confirmText: "확인",
    });

  const openFile = async (item: BizLicenseItem) => {
    try {
      await openFileInNewTab(() => loadFile(item), item.downloadName);
    } catch (err) {
      await failed("파일을 열지 못했어요", err);
    }
  };

  /** 받는 중이면 다른 내려받기는 막는다(saving 하나). */
  const save = async (key: string, load: () => Promise<Blob>, name: string) => {
    if (saving) return;
    setSaving(key);
    try {
      saveBlob(await load(), name);
    } catch (err) {
      await failed("다운로드하지 못했어요", err);
    } finally {
      setSaving(null);
    }
  };
  const downloadOne = (item: BizLicenseItem) =>
    save(item.memberId, () => loadFile(item), item.downloadName);
  const downloadAll = () =>
    save(ALL, () => loadZip(filterParams), `사업자등록증_${today()}.zip`);

  const filters = [
    {
      key: "category",
      label: "회원 유형",
      value: category,
      set: setCategory,
      options: categoryOptions,
    },
    {
      key: "status",
      label: "상태",
      value: status,
      set: setStatus,
      options: BIZ_LICENSE_STATUS_OPTIONS,
    },
  ];

  // 파일(보기 · 다운로드)이 맨 앞(11-26 사용자: "파일을 맨앞에 배치해 줘").
  const columns: TableColumn<BizLicenseItem>[] = [
    {
      name: "file",
      label: "파일",
      renderer: (item) => (
        <span className="flex gap-[6px]">
          <Button
            size="sm"
            variant="tertiary"
            onPress={() => void openFile(item)}
          >
            보기
          </Button>
          <Button
            size="sm"
            variant="secondary"
            isPending={saving === item.memberId}
            onPress={() => void downloadOne(item)}
          >
            <Download className="size-[14px]" />
            다운로드
          </Button>
        </span>
      ),
    },
    {
      name: "category",
      label: "회원 유형",
      renderer: categoryOf,
      className: "whitespace-nowrap",
    },
    {
      name: "name",
      label: "회원",
      renderer: (item) => (
        <span className="flex min-w-0 flex-col">
          <Link
            href={hrefOf(item)}
            className="truncate font-semibold text-black no-underline underline-offset-2 hover:underline"
          >
            {item.name}
          </Link>
          <span className="truncate text-xs text-disabled">
            {item.partnerCode ?? item.loginId}
          </span>
        </span>
      ),
    },
    {
      name: "businessName",
      label: "상호",
      renderer: (item) => item.businessName || "-",
    },
    {
      name: "businessNo",
      label: "사업자 번호",
      renderer: (item) => item.businessNo || "-",
      className: "whitespace-nowrap",
    },
    {
      name: "bizStatus",
      label: "상태",
      renderer: (item) => <StatusChip status={item.bizStatus} />,
    },
    {
      name: "uploadedAt",
      label: "올린 때",
      renderer: (item) => dotDateTime(item.uploadedAt),
      className: "whitespace-nowrap",
    },
  ];

  return (
    <div className="flex flex-col gap-[20px] md:gap-[24px]">
      <CollabPageHead title="사업자등록증" />

      <AdminPanel contentClassName="gap-[12px]">
        <div className="grid grid-cols-2 gap-[12px] md:max-w-[480px]">
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
            aria-label="등록증 검색"
            variant="secondary"
            className="min-w-0 flex-1"
            placeholder="이름 · 아이디 · 상호 · 사업자 번호로 검색"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing)
                submitKeyword();
            }}
          />
          <Button variant="primary" onPress={submitKeyword}>
            <Search className="size-[16px]" />
            <span className="max-sm:hidden">검색</span>
          </Button>
          {(searching || keywordInput) && (
            <Button variant="tertiary" onPress={resetAll}>
              초기화
            </Button>
          )}
        </div>
      </AdminPanel>

      {isError ? (
        <ErrorState
          title="사업자등록증을 불러오지 못했어요"
          message="잠시 후 다시 시도해 주세요."
          homeHref={homeHref}
        />
      ) : !data ? (
        <LoadingState />
      ) : (
        <AdminPanel contentClassName="gap-[16px]">
          <div className="flex flex-wrap items-center justify-between gap-[12px]">
            <p className="text-sm font-medium text-tone-4a5565">
              {searching ? "조건에 맞는 " : "모두 "}
              <span className="font-bold text-black">
                {total.toLocaleString()}
              </span>
              장
            </p>
            <div className="flex items-center gap-[8px]">
              <Tabs
                selectedKey={view}
                onSelectionChange={(key) => {
                  setView(key as View);
                  setPage(1);
                }}
              >
                <Tabs.ListContainer className="w-fit rounded-[17px]">
                  <Tabs.List aria-label="보기 방식">
                    {(
                      [
                        ["list", "목록"],
                        ["card", "카드"],
                      ] as const
                    ).map(([id, label]) => (
                      <Tabs.Tab
                        key={id}
                        id={id}
                        className="rounded-[13px] whitespace-nowrap"
                      >
                        {label}
                        <Tabs.Indicator className="rounded-[13px]" />
                      </Tabs.Tab>
                    ))}
                  </Tabs.List>
                </Tabs.ListContainer>
              </Tabs>
              {/* 조건이 있으면 그 조건에 맞는 것만 담는다 — 이름도 "N장 다운로드"로. */}
              <Button
                variant="secondary"
                // 새 조건 결과를 받는 동안엔 막는다 — 앞 조건의 장 수가 보이는 사이에 다른 것을 담지 않게.
                isDisabled={total === 0 || isPlaceholderData}
                isPending={saving === ALL}
                onPress={() => void downloadAll()}
              >
                <Download className="size-[16px]" />
                {searching
                  ? `${total.toLocaleString()}장 다운로드`
                  : "전체 다운로드"}
              </Button>
            </div>
          </div>
          {data.items.length === 0 ? (
            <p className="rounded-[14px] bg-gray-50 px-[16px] py-[40px] text-center text-sm text-disabled">
              {searching
                ? "조건에 맞는 사업자등록증이 없어요."
                : "아직 올라온 사업자등록증이 없어요."}
            </p>
          ) : view === "list" ? (
            <>
              {/* 휴대폰은 표가 옆으로 길어져 한 줄씩 쌓는다. */}
              <ul className="flex flex-col divide-y divide-gray-100 sm:hidden">
                {data.items.map((item) => (
                  <li key={item.memberId}>
                    <LicenseRow
                      item={item}
                      categoryLabel={categoryOf(item)}
                      href={hrefOf(item)}
                      onOpen={() => void openFile(item)}
                      onDownload={() => void downloadOne(item)}
                      downloading={saving === item.memberId}
                    />
                  </li>
                ))}
              </ul>
              <div className="max-sm:hidden">
                <CommonTable<BizLicenseItem>
                  ariaLabel="사업자등록증 목록"
                  columnList={columns}
                  data={data.items}
                  idKey="memberId"
                  pageSize={pageSize}
                  useSearch={false}
                  framed={false}
                />
              </div>
            </>
          ) : (
            // 휴대폰도 두 장씩(한 장씩이면 너무 길다), 넓으면 3 · 4장.
            <ul className="grid grid-cols-2 gap-[10px] sm:gap-[16px] lg:grid-cols-3 2xl:grid-cols-4">
              {data.items.map((item) => (
                <li key={item.memberId}>
                  <LicenseCard
                    item={item}
                    categoryLabel={categoryOf(item)}
                    href={hrefOf(item)}
                    onOpen={() => void openFile(item)}
                    onDownload={() => void downloadOne(item)}
                    downloading={saving === item.memberId}
                  />
                </li>
              ))}
            </ul>
          )}
          <PageNav
            page={page}
            pageSize={pageSize}
            total={total}
            onChange={setPage}
            className="self-center"
          />
        </AdminPanel>
      )}
      {confirmDialog}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  return (
    <Chip
      size="sm"
      variant="soft"
      color={STATUS_COLOR[status] ?? "default"}
      className="shrink-0"
    >
      {bizStatusLabel(status)}
    </Chip>
  );
}

type ItemProps = {
  item: BizLicenseItem;
  categoryLabel: string;
  href: string;
  onOpen: () => void;
  onDownload: () => void;
  downloading: boolean;
};

/** 휴대폰 목록 한 줄 — 이름 · 상태 / 상호 · 사업자 번호 / 유형 · 올린 때 + 보기 · 다운로드. */
function LicenseRow({
  item,
  categoryLabel,
  href,
  onOpen,
  onDownload,
  downloading,
}: ItemProps) {
  return (
    <div className="flex flex-col gap-[4px] py-[12px]">
      <div className="flex min-w-0 items-center justify-between gap-[8px]">
        <Link
          href={href}
          className="min-w-0 truncate text-sm font-bold text-black no-underline"
        >
          {item.name}
        </Link>
        <StatusChip status={item.bizStatus} />
      </div>
      <p className="truncate text-xs text-tone-4a5565">
        {[item.businessName, item.businessNo].filter(Boolean).join(" · ") ||
          "상호 · 사업자 번호 없음"}
      </p>
      <div className="flex min-w-0 items-center justify-between gap-[8px]">
        <span className="min-w-0 truncate text-xs text-disabled">
          {[categoryLabel, dotDateTime(item.uploadedAt)].join(" · ")}
        </span>
        <span className="flex shrink-0 gap-[6px]">
          <Button size="sm" variant="tertiary" onPress={onOpen}>
            보기
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="secondary"
            aria-label={`${item.name} 사업자등록증 다운로드`}
            isPending={downloading}
            onPress={onDownload}
          >
            <Download className="size-[14px]" />
          </Button>
        </span>
      </div>
    </div>
  );
}

/** 등록증 카드 한 장 — 위 미리보기(누르면 원본, 오른쪽 위 다운로드) · 아래 회원 · 상호 · 사업자 번호 · 올린 때. */
function LicenseCard({
  item,
  categoryLabel,
  href,
  onOpen,
  onDownload,
  downloading,
}: ItemProps) {
  const src = mediaSrc(item.fileUrl);
  const caption = [categoryLabel, item.partnerCode].filter(Boolean).join(" · ");
  return (
    <Card
      variant="secondary"
      className="h-full gap-[10px] rounded-[16px] bg-gray-50 p-[8px] shadow-none sm:gap-[12px] sm:p-[12px]"
    >
      <div className="relative">
        <Button
          variant="ghost"
          aria-label={`${item.name} 사업자등록증 크게 보기`}
          onPress={onOpen}
          className="relative block aspect-[4/5] h-auto w-full overflow-hidden rounded-[12px] bg-surface p-0"
        >
          {isImage(item.fileUrl) ? (
            <Image
              src={src}
              alt={`${item.name} 사업자등록증`}
              fill
              sizes="(min-width: 1536px) 22vw, (min-width: 1024px) 30vw, 45vw"
              unoptimized={!isOptimizable(src)}
              className="object-contain"
            />
          ) : (
            <span className="flex size-full flex-col items-center justify-center gap-[8px] text-tone-4a5565">
              <MaskIcon src="/icons/file-text.svg" className="size-[32px]" />
              <span className="text-sm font-semibold">PDF</span>
            </span>
          )}
        </Button>
        <Button
          isIconOnly
          size="sm"
          variant="secondary"
          aria-label={`${item.name} 사업자등록증 다운로드`}
          isPending={downloading}
          onPress={onDownload}
          className="absolute right-[6px] top-[6px] bg-surface/90 shadow-sm"
        >
          <Download className="size-[14px]" />
        </Button>
      </div>
      <div className="flex min-w-0 flex-col gap-[4px] px-[4px]">
        {/* 휴대폰 두 장씩이면 칸이 좁아 칩이 이름 아래로 내려간다. */}
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-[8px] gap-y-[4px]">
          <Link
            href={href}
            className="min-w-0 truncate text-sm font-bold text-black no-underline underline-offset-2 hover:underline"
          >
            {item.name}
          </Link>
          <StatusChip status={item.bizStatus} />
        </div>
        <p className="truncate text-xs text-tone-4a5565">
          {[item.businessName, item.businessNo].filter(Boolean).join(" · ") ||
            "상호 · 사업자 번호 없음"}
        </p>
        <p className="flex min-w-0 flex-wrap items-center justify-between gap-x-[8px] text-xs text-disabled">
          <span className="truncate">{caption}</span>
          <span className="shrink-0">{dotDateTime(item.uploadedAt)}</span>
        </p>
      </div>
    </Card>
  );
}
