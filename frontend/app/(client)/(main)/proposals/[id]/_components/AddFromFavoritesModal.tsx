"use client";

import {
  Button,
  Card,
  Chip,
  Dropdown,
  Label,
  Modal,
  SearchField,
  Spinner,
  Switch,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SelectToggle } from "@/app/(client)/(main)/fixed/_components/MediaFindCard";
import { MediaThumbnail } from "@/components/common/MediaThumbnail";
import {
  CloseMediumIcon,
  FolderAddIcon,
  LocationFilledIcon,
  Logo,
  SearchOutlineIcon,
  SortIcon,
} from "@/components/icons";
import { useFavoriteList } from "@/hooks/favorites";
import type { MediaCardRow } from "@/hooks/media";
import { useAddProposalItems } from "@/hooks/proposals";
import { useSonner } from "@/hooks/useSonner";
import { cn } from "@/lib/utils";

// 하단 버튼 — 시안 "닫기 / 추가하기"(36px → 곡률 15px).
const ACTION_CLASS =
  "h-[36px] gap-[6px] rounded-[15px] px-[16px] text-[13px] font-semibold";

type SortKey = "latest" | "priceDesc" | "priceAsc" | "oldest";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "latest", label: "최신순" },
  { key: "priceDesc", label: "가격 높은 순" },
  { key: "priceAsc", label: "가격 낮은 순" },
  { key: "oldest", label: "오래된 순" },
];

const ALL = "전체";

/** 정렬 — 관심 매체 목록은 최근에 담은 순으로 온다. 가격은 광고비 기준, 값이 없으면 뒤로. */
function sortRows(rows: MediaCardRow[], key: SortKey): MediaCardRow[] {
  if (key === "latest") return rows;
  if (key === "oldest") return [...rows].reverse();
  const price = (r: MediaCardRow) => r.minAdvertisementFeeKrw;
  return [...rows].sort((a, b) => {
    const pa = price(a);
    const pb = price(b);
    if (pa == null) return pb == null ? 0 : 1;
    if (pb == null) return -1;
    return key === "priceDesc" ? pb - pa : pa - pb;
  });
}

const won = (value: number | null) =>
  value == null ? "-" : `${value.toLocaleString()}원`;

/**
 * 관심 매체에서 추가하기 — 시안 "03. 제안서 - 상세 (관심 매체에서 추가하기)"의 틀
 * (제목·총 개수, 검색, 정렬, 닫기/추가하기)에, 고르기 쉬운 3열 작은 카드와 카테고리 칩 한 줄을 둔다.
 * 카드를 누르거나 "선택"으로 고르고, 이 제안서에 이미 담긴 매체는 "이미 담김"으로 막는다.
 * 검색·정렬·카테고리는 화면 안에서 바로 거른다(관심 매체는 보통 수십 개 이하라 서버 조회 없이).
 */
export function AddFromFavoritesModal({
  proposalId,
  existingIds,
  onClose,
}: {
  proposalId: string;
  /** 이 제안서에 이미 담긴 매체 id. */
  existingIds: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { data, isLoading } = useFavoriteList();
  const allRows = data?.items ?? [];
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);
  const [sort, setSort] = useState<SortKey>("latest");
  // 이 제안서에 이미 담긴 매체 숨기기 — 담을 수 있는 매체만 보고 싶을 때.
  const [hideAdded, setHideAdded] = useState(false);
  const addedCount = allRows.filter((r) => existingIds.includes(r.id)).length;
  const [selected, setSelected] = useState<string[]>([]);
  const addItems = useAddProposalItems();
  const { success, error } = useSonner();

  // 카테고리 칩 — 내 관심 매체에 있는 대분류만, 많은 순.
  const categoryCounts = new Map<string, number>();
  allRows.forEach((r) => {
    if (r.categoryLarge)
      categoryCounts.set(
        r.categoryLarge,
        (categoryCounts.get(r.categoryLarge) ?? 0) + 1,
      );
  });
  const categories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const keyword = query.trim().toLowerCase();
  const rows = sortRows(
    allRows.filter(
      (r) =>
        (category === ALL || r.categoryLarge === category) &&
        !(hideAdded && existingIds.includes(r.id)) &&
        (!keyword ||
          r.name.toLowerCase().includes(keyword) ||
          (r.address ?? "").toLowerCase().includes(keyword)),
    ),
    sort,
  );

  const toggle = (id: string, checked: boolean) =>
    setSelected((prev) =>
      checked ? [...prev, id] : prev.filter((v) => v !== id),
    );

  const handleAdd = () => {
    if (selected.length === 0) return;
    const count = selected.length;
    addItems.mutate(
      { id: proposalId, mediaIds: selected },
      {
        onSuccess: () => {
          success(`제안서에 매체 ${count}개를 담았어요`);
          onClose();
        },
        onError: () =>
          error("매체를 담지 못했어요", "잠시 후 다시 시도해 주세요."),
      },
    );
  };

  const currentSort = SORTS.find((s) => s.key === sort) ?? SORTS[0];

  return (
    <Modal
      isOpen
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Modal.Backdrop>
        <Modal.Container
          placement="center"
          className="px-[16px] sm:w-full sm:max-w-[930px] sm:px-[20px]"
        >
          <Modal.Dialog
            aria-label="관심 매체에서 추가하기"
            // 창 높이 고정 — 검색 결과가 적거나 없거나, 관심 매체가 없어 카테고리 줄이 빠져도 크기가 그대로다.
            // 목록 칸(본문)이 남는 높이를 채운다.
            className="h-[min(780px,calc(100vh-80px))] w-full max-w-full gap-0 rounded-[24px] bg-white p-[20px] shadow-[0px_4px_60px_0px_rgba(0,0,0,0.25)]"
          >
            <Modal.CloseTrigger
              aria-label="닫기"
              className="top-[20px] right-[20px] z-10 size-[28px] rounded-[14px] border border-[#ececef] bg-[#eaeaeb] p-0 text-[#70707a]"
            >
              <CloseMediumIcon className="size-[24px]" />
            </Modal.CloseTrigger>

            {/* 제목 + 총 개수 칩(시안). */}
            <Modal.Header className="flex min-h-[28px] shrink-0 flex-row items-center gap-[8px] p-0 pr-[40px]">
              <Modal.Heading className="text-[16px] font-semibold text-black">
                관심 매체 목록
              </Modal.Heading>
              <Chip className="h-[20px] rounded-[7px] bg-[#f1f1f3] px-[7px] py-0 text-[10px] font-medium text-[#71717a]">
                총 {allRows.length}개
              </Chip>
            </Modal.Header>

            {/* 검색 + 정렬. */}
            <div className="mt-[16px] flex shrink-0 items-center justify-between gap-[10px]">
              <SearchField
                aria-label="관심 매체 검색"
                value={query}
                onChange={setQuery}
                className="w-full max-w-[420px]"
              >
                <SearchField.Group className="h-[36px] gap-[10px] rounded-[15px] border border-black-200 bg-black-100 px-[12px] shadow-none focus-within:border-focus focus-within:bg-white focus-within:ring-0 data-[focus-within=true]:border-focus data-[focus-within=true]:bg-white data-[focus-within=true]:ring-0">
                  <SearchOutlineIcon className="size-[16px] shrink-0 text-[#6c757d]" />
                  <SearchField.Input
                    placeholder="매체명·주소로 검색해 보세요"
                    className="px-0 text-[13px] placeholder:text-[#a1a1aa]"
                  />
                  <SearchField.ClearButton className="me-0" />
                </SearchField.Group>
              </SearchField>

              <div className="flex shrink-0 items-center gap-[12px]">
                {/* 이미 담긴 매체가 있을 때만 — 켜면 "이미 담김" 카드를 목록에서 뺀다(HeroUI Switch). */}
                {addedCount > 0 && (
                  <Switch
                    size="sm"
                    isSelected={hideAdded}
                    onChange={setHideAdded}
                    className="group flex"
                  >
                    <Switch.Content className="flex-row-reverse gap-[6px]">
                      {/* 간략히 보기 토글과 같은 색 — 꺼짐 회색 트랙, 켜짐 보라·흰 손잡이. */}
                      <Switch.Control className="bg-[#d4d4d8]! group-data-[selected=true]:bg-primary!">
                        <Switch.Thumb className="bg-white!" />
                      </Switch.Control>
                      <Label className="text-[13px] font-medium whitespace-nowrap text-[#52525b]">
                        이미 담긴 매체 숨기기
                        <span className="ml-[3px] text-[#a1a1aa]">
                          {addedCount}
                        </span>
                      </Label>
                    </Switch.Content>
                  </Switch>
                )}

                <Dropdown>
                  <Dropdown.Trigger
                    aria-label={`정렬: ${currentSort.label}`}
                    className="flex h-[36px] shrink-0 items-center gap-[8px] rounded-[15px] border border-black-200 bg-black-100 px-[14px] text-[13px] font-medium whitespace-nowrap text-[#18181b] outline-none hover:bg-white data-[focus-visible=true]:border-focus"
                  >
                    <SortIcon className="size-[16px] shrink-0 text-[#18181b]" />
                    {currentSort.label}
                  </Dropdown.Trigger>
                  <Dropdown.Popover
                    placement="bottom end"
                    className="min-w-[150px]"
                  >
                    <Dropdown.Menu
                      aria-label="정렬"
                      selectionMode="single"
                      disallowEmptySelection
                      selectedKeys={new Set([sort])}
                      onSelectionChange={(keys) => {
                        const next = [...keys][0];
                        if (next != null) setSort(next as SortKey);
                      }}
                    >
                      {SORTS.map((s) => (
                        <Dropdown.Item
                          key={s.key}
                          id={s.key}
                          textValue={s.label}
                        >
                          <span className="text-[13px] text-[#18181b]">
                            {s.label}
                          </span>
                          <Dropdown.ItemIndicator />
                        </Dropdown.Item>
                      ))}
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>
              </div>
            </div>

            {/* 카테고리 칩 한 줄(내 관심 매체에 있는 대분류만) — 칩 30px → 곡률 12px. */}
            {categories.length > 1 && (
              <div className="mt-[12px] flex shrink-0 gap-[6px] overflow-x-auto [scrollbar-width:none]">
                {[ALL, ...categories].map((name) => {
                  const active = category === name;
                  return (
                    <Button
                      key={name}
                      variant="ghost"
                      onPress={() => setCategory(name)}
                      aria-pressed={active}
                      className={cn(
                        "h-[30px] min-w-0 shrink-0 rounded-[12px] border px-[12px] text-[12px] whitespace-nowrap",
                        active
                          ? "border-[#18181b] bg-white font-semibold text-[#18181b]"
                          : "border-[#ececef] bg-white font-normal text-[#71717a] data-[hovered=true]:bg-[#fafafa]",
                      )}
                    >
                      {name}
                      {name !== ALL && (
                        <span className="ml-[3px] text-[#a1a1aa]">
                          {categoryCounts.get(name)}
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>
            )}

            {/* 목록 칸 — 고정된 창 높이에서 남는 만큼 채우고(HeroUI 기본 flex-1), 넘치면 안에서 스크롤. */}
            <Modal.Body className="m-0 mt-[16px] flex min-h-0 flex-col overflow-y-auto p-0">
              {isLoading ? (
                <div className="flex flex-1 items-center justify-center py-[40px]">
                  <Spinner />
                </div>
              ) : allRows.length === 0 ? (
                <EmptyNote
                  title="아직 관심 매체가 없어요"
                  description="매체 찾기에서 마음에 드는 매체에 하트를 눌러 보세요."
                  action={
                    <Button
                      variant="outline"
                      onPress={() => router.push("/fixed")}
                      className="mt-[6px] h-[32px] rounded-[13px] px-[12px] text-[12px] font-semibold"
                    >
                      매체 찾기로 가기
                    </Button>
                  }
                />
              ) : rows.length === 0 ? (
                <EmptyNote
                  title="조건에 맞는 관심 매체가 없어요"
                  description="다른 검색어를 입력하거나 카테고리를 바꿔 보세요."
                />
              ) : (
                <div className="grid grid-cols-1 gap-[10px] p-[2px] sm:grid-cols-3">
                  {rows.map((row) => (
                    <PickCard
                      key={row.id}
                      row={row}
                      added={existingIds.includes(row.id)}
                      checked={selected.includes(row.id)}
                      onChange={(checked) => toggle(row.id, checked)}
                    />
                  ))}
                </div>
              )}
            </Modal.Body>

            <Modal.Footer className="mt-[16px] flex shrink-0 items-center justify-end gap-[8px] p-0">
              <Button
                variant="ghost"
                onPress={onClose}
                className={cn(
                  ACTION_CLASS,
                  "w-[96px] bg-[#eee] text-[#18181b]",
                )}
              >
                닫기
              </Button>
              <Button
                variant="primary"
                onPress={handleAdd}
                isDisabled={selected.length === 0}
                isPending={addItems.isPending}
                className={cn(
                  ACTION_CLASS,
                  "min-w-[150px] bg-primary-500 font-bold text-white",
                )}
              >
                {!addItems.isPending && (
                  <FolderAddIcon className="size-[14px] shrink-0" />
                )}
                {selected.length > 0
                  ? `${selected.length}개 추가하기`
                  : "추가하기"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

/**
 * 고르기 카드 — 관심 매체 카드를 줄인 모양(사진 120px + 이름·주소·금액).
 * 카드 어디를 눌러도 고른다. 고르면 보라 2px 테두리, 이미 담긴 매체는 흐리게 + "이미 담김".
 */
function PickCard({
  row,
  added,
  checked,
  onChange,
}: {
  row: MediaCardRow;
  added: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Card
      onClick={() => {
        if (!added) onChange(!checked);
      }}
      aria-disabled={added || undefined}
      className={cn(
        "relative gap-0 overflow-hidden rounded-[14px] border bg-white p-0 shadow-none transition-colors",
        added
          ? "cursor-default border-[#ececef]"
          : checked
            ? "cursor-pointer border-primary-500 shadow-[0_0_0_1px_var(--color-primary-500)]"
            : "cursor-pointer border-[#ececef] hover:border-[#d4d4d8]",
      )}
    >
      <div className={cn("relative h-[120px] w-full", added && "opacity-50")}>
        <MediaThumbnail
          src={row.thumbnailUrl ?? row.images?.[0]}
          sizes="290px"
          className="size-full rounded-t-[13px]"
          fallback={<Logo className="size-[24px] opacity-30" />}
        />
      </div>
      {added ? (
        <Chip className="absolute top-[11px] left-[11px] h-[30px] rounded-[12px] bg-white px-[10px] text-[12px] font-semibold text-[#3f3f46] drop-shadow-[0px_2px_4px_rgba(0,0,0,0.08)]">
          이미 담김
        </Chip>
      ) : (
        <SelectToggle checked={checked} onChange={onChange} />
      )}
      <div
        className={cn(
          "flex flex-col gap-[3px] px-[10px] pt-[9px] pb-[10px]",
          added && "opacity-50",
        )}
      >
        <p className="truncate text-[14px] leading-[19px] font-bold text-black">
          {row.name}
        </p>
        <div className="flex min-w-0 items-center gap-[3px]">
          <LocationFilledIcon className="size-[12px] shrink-0 text-[#6c757d]" />
          <span className="truncate text-[11px] text-[#6c757d]">
            {row.address ?? "-"}
          </span>
        </div>
        {/* 금액 — 매체 찾기 카드처럼 이름표 위·금액 아래, 두 칸 모두 오른쪽 정렬. 광고비 칸이 남는 폭을 쓴다. */}
        <div className="mt-[7px] flex items-end gap-[16px] border-t border-[#f1f1f4] pt-[8px]">
          <PickPrice
            label="광고비 / 1개월"
            value={row.minAdvertisementFeeKrw}
            className="min-w-0 flex-1"
          />
          <PickPrice
            label="제작비 / 1회"
            value={row.minProductionFeeKrw}
            className="shrink-0"
          />
        </div>
      </div>
    </Card>
  );
}

function PickPrice({
  label,
  value,
  className,
}: {
  label: string;
  value: number | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-end gap-[3px] whitespace-nowrap",
        className,
      )}
    >
      <span className="text-[10px] font-medium text-black-400">{label}</span>
      <span className="text-[14px] font-bold text-[#2d264b]">{won(value)}</span>
    </div>
  );
}

function EmptyNote({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[6px] rounded-[12px] border border-[#ececef] bg-[#f7f7f8] py-[40px] text-center">
      <p className="text-[14px] font-semibold text-[#18181b]">{title}</p>
      <p className="text-[12px] break-keep text-[#888]">{description}</p>
      {action}
    </div>
  );
}
