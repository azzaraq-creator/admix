"use client";

import { Button, TextArea } from "@heroui/react";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { MediaFindCard } from "@/app/(client)/(main)/fixed/_components/MediaFindCard";
import { MaskIcon } from "@/components/common/MaskIcon";
import {
  useCanOpenPartners,
  useOpenPartners,
} from "@/components/common/PartnersAccessNotice";
import { LoadingState } from "@/components/common/RouteStates";
import { LoveIcon } from "@/components/icons";
import {
  FAVORITE_MEMO_MAX,
  useFavoriteList,
  useFavoriteMemos,
  useSaveFavoriteMemo,
} from "@/hooks/favorites";
import type { MediaFilterParams } from "@/hooks/media";
import { useSonner } from "@/hooks/useSonner";
import { PARTNERS_MEDIA_CATEGORY } from "@/lib/partners";

import { EmptyBox, PageHead } from "../workspace/workspaceUi";
import { useFavoriteStores } from "./favoriteStores";
import { ADV_FIND_HREF } from "./advUi";

/*
 * /partners/favorites (광고주) — 관심 매장(11-11 사용자: "관심 매장 메뉴, 매장 찾기의 하트를 누르면 관심 매장에 담기게").
 * 매장 찾기와 같은 카드(MediaFindCard — 사진 · 운영 시간 · 매장 특징 · 등급 · 1건 금액 · 하트)를 격자로 놓고,
 * 카드 아래에 매장마다 메모(최대 500자, 서버 080 — Enter 나 칸을 벗어나면 저장, 줄 바꿈은 Shift+Enter)를 둔다.
 * 하트를 끄면 관심 매장에서 빠진다(메모도 같이 지워진다). 카드를 누르면 매장 상세가 새 탭으로(매장 찾기와 같다).
 * 처음엔 admix 관심 매체처럼 "선택" + 아래 고정 줄(빼기 · 이 매장들로 의뢰하기)이 있었는데 11-11 사용자가 없앴다 —
 * 의뢰할 매장은 의뢰서의 "관심 매장 고르기"에서 고른다. 저장 방식은 favoriteStores.ts 참고.
 */

/** 관심 목록 중 콜라보 매장 카드만. */
const FILTERS: MediaFilterParams = { category: [PARTNERS_MEDIA_CATEGORY] };

/** "저장했어요"를 잠깐 보여 주는 시간. */
const SAVED_FLASH_MS = 2000;

/**
 * 카드 아래 메모 — 고치는 동안은 이 칸에만 두고(draft), Enter 나 칸을 벗어나면 저장한다.
 * 줄 바꿈은 Shift+Enter(11-11 사용자). 앞뒤 공백은 빼고 저장하고, 다 지우면 메모가 지워진다.
 */
function StoreMemo({
  mediaId,
  storeName,
  saved,
}: {
  mediaId: string;
  storeName: string;
  /** 서버에 저장된 메모(없으면 ""). */
  saved: string;
}) {
  const save = useSaveFavoriteMemo();
  const { error: toastError } = useSonner();
  const [draft, setDraft] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const value = draft ?? saved;
  const dirty = draft !== null && draft.trim() !== saved;

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(false), SAVED_FLASH_MS);
    return () => clearTimeout(t);
  }, [flash]);

  const commit = () => {
    if (draft === null) return;
    const memo = draft.trim();
    // 바뀐 게 없으면(공백만 고침 등) 저장하지 않고 저장된 값으로 돌린다.
    if (memo === saved) {
      setDraft(null);
      return;
    }
    save.mutate(
      { mediaId, memo },
      {
        onSuccess: () => {
          // 저장하는 사이 더 고쳤으면 그 글은 남겨 둔다(다음에 칸을 벗어날 때 저장).
          setDraft((d) => (d !== null && d.trim() === memo ? null : d));
          setFlash(true);
        },
        onError: () =>
          toastError("메모를 저장하지 못했어요", "잠시 후 다시 시도해 주세요."),
      },
    );
  };

  // 저장이 끝나면 글자 없이 초록 체크만 잠깐(11-11 사용자: "저장했어요" 대신 체크 아이콘, 색은 보라 말고 초록).
  const status = save.isPending ? (
    "저장 중…"
  ) : dirty ? (
    "Enter로 저장 · Shift+Enter로 줄 바꿈"
  ) : flash ? (
    <>
      <Check
        aria-hidden
        strokeWidth={3}
        className="size-[14px] text-emerald-600 dark:text-emerald-400"
      />
      <span className="sr-only">저장했어요</span>
    </>
  ) : null;

  return (
    <div className="flex flex-col gap-[4px]">
      <TextArea
        aria-label={`${storeName} 메모`}
        rows={3}
        maxLength={FAVORITE_MEMO_MAX}
        value={value}
        placeholder="이 매장에 대한 메모를 남겨 보세요."
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          // 한글 조합 중 Enter 는 글자를 끝내는 키라 넘긴다(저장하면 마지막 글자가 빠지거나 두 번 들어간다).
          if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
          e.preventDefault();
          // 칸을 벗어나게 해 onBlur 의 저장 한 번만 탄다.
          e.currentTarget.blur();
        }}
        className="resize-none rounded-[16px] text-[13px] leading-[1.6]"
      />
      <div className="flex min-h-[18px] items-center justify-between gap-[8px] px-[6px] text-[12px] text-gray-400">
        <span aria-live="polite" className="flex items-center">
          {status}
        </span>
        <span>
          {value.length}/{FAVORITE_MEMO_MAX}
        </span>
      </div>
    </div>
  );
}

export function AdvFavorites() {
  const router = useRouter();
  const openPartners = useOpenPartners();
  const partnersAccess = useCanOpenPartners() ? "open" : "locked";
  const { byMedia, ids, isLoading } = useFavoriteStores();
  const list = useFavoriteList(FILTERS);
  const memos = useFavoriteMemos();

  // 매장 찾기에 나오는 매장(제휴사 연결 매장)만. 하트를 끄는 즉시(서버 응답 전) 카드가 빠지도록
  // 하트 상태(id 목록)로 한 번 더 거른다(admix 관심 매체 화면과 같다).
  const rows = useMemo(() => {
    const liked = ids.data ? new Set(ids.data) : null;
    return (list.data?.items ?? []).filter(
      (r) => byMedia.has(r.id) && (!liked || liked.has(r.id)),
    );
  }, [list.data, ids.data, byMedia]);

  // 빈 화면의 "매장 찾기" — 하나뿐인 다음 할 일이라 보라 버튼. 목록이 있을 때 머리 오른쪽에 두던 버튼은
  // 11-11 사용자가 없앴다(매장 찾기는 메뉴에 있다).
  const findButton = (
    <Button
      variant="primary"
      onPress={() => router.push(ADV_FIND_HREF)}
      className="h-[42px] rounded-[18px] px-[16px] font-semibold max-sm:h-[36px] max-sm:rounded-[15px] max-sm:px-[12px] max-sm:text-[13px]"
    >
      <MaskIcon src="/icons/store.svg" className="size-[16px]" />
      매장 찾기
    </Button>
  );

  // 메모를 받기 전에 칸을 그리면 빈 칸에 먼저 쓰기 시작할 수 있어 같이 기다린다.
  const loading = isLoading || list.isLoading || memos.isLoading;

  return (
    <div className="flex flex-1 flex-col gap-[16px] sm:gap-[24px]">
      <PageHead
        title="관심 매장"
        description="매장 찾기에서 하트를 누른 매장이 모여요. 의뢰서에서 지정 희망 매장으로 고를 수 있어요."
      />

      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyBox icon={<LoveIcon className="size-[26px]" />}>
          <b className="text-gray-700">아직 관심 매장이 없어요.</b>
          매장 찾기에서 마음에 드는 매장의 하트를 누르면 여기에 모여요.
          <span className="mt-[8px]">{findButton}</span>
        </EmptyBox>
      ) : (
        <div className="flex flex-col gap-[12px]">
          <span className="text-[13px] font-semibold text-gray-500">
            {rows.length}곳
          </span>
          <ul className="grid gap-x-[12px] gap-y-[20px] sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => {
              const store = byMedia.get(row.id);
              return (
                <li key={row.id} className="flex flex-col gap-[8px]">
                  <MediaFindCard
                    row={row}
                    onClick={() => openPartners(row.id)}
                    partnersAccess={partnersAccess}
                    // 하트에 마우스를 올리면 "관심 해제"(11-11 사용자).
                    likeTooltip
                    collabPick={
                      store
                        ? {
                            grade: store.collabGrade ?? null,
                            fee: store.collabFee ?? null,
                          }
                        : undefined
                    }
                  />
                  <StoreMemo
                    mediaId={row.id}
                    storeName={row.name}
                    saved={memos.data?.[row.id] ?? ""}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
