"use client";

import { Button, InputGroup, TextField, toast } from "@heroui/react";
import { Link2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";

import { ArrowLeftIcon } from "@/components/icons";
import { MaskIcon } from "@/components/common/MaskIcon";
import { LoadingState } from "@/components/common/RouteStates";
import { useMe } from "@/hooks/auth";
import {
  useCancelStoreLink,
  useCreateStoreLink,
  useMyPartnersStores,
  useStoreLinkLookup,
  useStoreLinks,
} from "@/hooks/partners";
import { extractApiError } from "@/lib/apiError";
import {
  STORE_CODE_PREFIX,
  formatStoreCodeInput,
  storeCodeFromInput,
  type StoreLinkRequest,
} from "@/lib/partners";
import { cn } from "@/lib/utils";

import { GLASS } from "./agreementShared";
import { JoinFlow } from "./JoinFlow";

const AGREEMENT_HREF = "/partners/join/agreement";
const DASHBOARD_HREF = "/partners/dashboard";

/*
 * 가입 03 매장 연결(/partners/join/store, 2026-11-17 사용자: "n:1도 되게").
 * 기본협약을 마친 회원이 두 길 중 하나를 고른다.
 * - 매장 ID로 연결 — 이미 등록된 매장(매니저 · 공동 운영자). 매장 ID를 넣으면 매장 이름 · 주소를 먼저 보여 주고(사용자: "응. 보여줘"),
 *   "연결 요청"을 보내면 어드민 "수정 요청"에서 승인할 때 연결된다. 매장 ID 는 먼저 연결된 회원의 내 매장 화면에 있다.
 * - 처음 등록하는 매장 — 예전처럼 admix 담당자가 매장을 등록하고 회원 고유번호로 잇는다.
 * 매장 ID 칸은 머리 "S-"를 칸 앞에 두고, 소문자는 대문자로 · 4자 뒤 하이픈은 저절로(사용자).
 * 연결된 회원끼리 대표 · 매니저를 나누지 않는다(권한 같음).
 */
export function PartnerStoreLink() {
  const router = useRouter();
  const { data: me, isPending } = useMe();
  const stores = useMyPartnersStores();
  const linked = (stores.data?.length ?? 0) > 0;

  if (isPending) return <LoadingState />;
  const agreed = !!me?.partner_agreed_at;

  return (
    <div className="isolate flex flex-1 flex-col">
      {/* 배경 빛 — 기본협약 동의 화면과 같다. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_75%_at_75%_50%,rgba(183,163,242,0.35),transparent_70%),radial-gradient(45%_55%_at_15%_20%,rgba(216,205,249,0.35),transparent_70%)] dark:opacity-35"
      />
      <div className="flex flex-wrap items-center justify-between gap-[12px]">
        <Link
          href={AGREEMENT_HREF}
          className="flex items-center gap-[6px] text-[13px] font-semibold text-gray-500 hover:text-gray-800"
        >
          <ArrowLeftIcon className="size-[16px]" />
          협약서
        </Link>
        <JoinFlow current={2} />
      </div>

      <div className="mt-[20px] sm:mt-[28px]">
        <h1 className="text-[24px] leading-[1.3] font-bold tracking-[-0.03em] break-keep text-gray-900 sm:text-[32px]">
          매장 연결
          <span
            aria-hidden
            className="ml-[5px] inline-block size-[7px] rounded-full bg-primary align-baseline sm:ml-[6px] sm:size-[9px]"
          />
        </h1>
        {/* 제목 아래 안내 문장은 뺐다(11-17 사용자: "이 문구 없애줘") — 두 카드 머리 칩이 같은 말을 한다. */}
      </div>

      {!agreed ? (
        <section
          className={cn(
            "mt-[16px] flex flex-col items-start gap-[14px] rounded-[24px] p-[20px] sm:mt-[24px] sm:p-[28px]",
            GLASS,
          )}
        >
          <p className="text-[15px] font-bold break-keep text-gray-900">
            협약서를 작성하면 매장을 연결할 수 있어요.
          </p>
          <Button
            onPress={() => router.push(AGREEMENT_HREF)}
            className="h-[44px] rounded-[19px] px-[20px] font-bold max-sm:w-full"
          >
            협약서 작성하기
          </Button>
        </section>
      ) : (
        <>
          {/* 두 길은 고르는 것이라 "또는"으로 나눈다(11-17 사용자: "서로 구분해서 배치, UI도 구분이 잘 되게") —
              머리 칩(매장 ID가 있어요 · 없어요) · 아이콘 색(보라 · 노랑)을 달리하고, 처음 등록은 점선 테두리의 옅은 판. */}
          <div className="mt-[16px] grid grid-cols-1 gap-[12px] sm:mt-[24px] lg:grid-cols-[minmax(0,1.25fr)_auto_minmax(0,1fr)] lg:gap-[20px]">
            <StoreIdCard />
            <OrDivider />
            <NewStoreCard code={me?.partner_code ?? null} />
          </div>
          {/* 보라 꽉 찬 버튼은 연보라 배경 빛과 겹쳐 어울리지 않아(11-17 사용자) 콜라보 소개 버튼과 같은 모양으로 —
              매장이 연결됐으면 먹색 둥근 버튼, 아직이면 흰 유리 테두리 버튼. */}
          <div className="mt-[20px] flex justify-end">
            <Link
              href={DASHBOARD_HREF}
              className={cn(
                "group inline-flex h-[44px] items-center justify-center gap-[6px] rounded-full px-[22px] text-[14px] font-semibold whitespace-nowrap transition-colors max-sm:w-full",
                linked
                  ? "bg-gray-900 text-surface hover:bg-primary hover:text-white"
                  : "border border-white bg-surface/70 text-gray-900 backdrop-blur-md hover:bg-surface dark:border-gray-200",
              )}
            >
              대시보드로
              <ArrowLeftIcon className="size-[15px] rotate-180 transition-transform group-hover:translate-x-[2px]" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

/** 매장 ID로 연결 — 다 치면 매장 이름 · 주소를 보여 주고 "연결 요청". 아래에 보낸 요청과 처리 상태. */
function StoreIdCard() {
  const [body, setBody] = useState("");
  // 한글 조합 중(한/영을 안 바꾸고 친 영문)엔 칸 글을 그대로 두고, 조합이 끝나면 영문 · 대문자로 다듬는다(11-19 사용자).
  // 조합 중에 값을 바꾸면 브라우저에 따라 마지막 글자가 두 번 들어간다. 찾기(code)는 조합 중 글도 영문으로 세어 본다.
  const composing = useRef(false);
  const code = storeCodeFromInput(body);
  const lookup = useStoreLinkLookup(code);
  const create = useCreateStoreLink();
  const links = useStoreLinks();
  const found = code ? lookup.data : undefined;

  const send = async () => {
    if (!code) return;
    try {
      const r = await create.mutateAsync(code);
      setBody("");
      toast("연결을 요청했어요", {
        description: `${r.storeName ?? "매장"} — 담당자가 확인하면 연결돼요.`,
      });
    } catch (err) {
      toast.danger("요청하지 못했어요", {
        description: extractApiError(err),
      });
    }
  };

  return (
    <section
      className={cn(
        "flex min-w-0 flex-col gap-[16px] rounded-[24px] p-[20px] sm:p-[28px]",
        GLASS,
      )}
    >
      <PathHead
        icon={<Link2 aria-hidden className="size-[20px]" strokeWidth={2} />}
        tone="bg-primary-50 text-primary-500 dark:bg-primary-500/15 dark:text-primary-300"
        chip="매장 ID가 있어요"
        title="매장 ID로 연결하기"
        desc="이미 등록된 매장이면 매장 ID를 넣어 주세요. 먼저 연결된 분의 내 매장 화면에 있어요."
      />

      <TextField
        aria-label="매장 ID"
        value={body}
        onChange={(v) =>
          setBody(composing.current ? v : formatStoreCodeInput(v))
        }
      >
        <InputGroup fullWidth variant="secondary" className="h-[48px]">
          <InputGroup.Prefix className="pl-[14px] text-[16px] font-semibold text-gray-500">
            {STORE_CODE_PREFIX}
          </InputGroup.Prefix>
          <InputGroup.Input
            placeholder="XXXX-XXXX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={(e) => {
              composing.current = false;
              setBody(formatStoreCodeInput(e.currentTarget.value));
            }}
            onBlur={(e) => setBody(formatStoreCodeInput(e.currentTarget.value))}
            className="text-[16px] font-semibold tracking-[0.04em]"
          />
        </InputGroup>
      </TextField>

      {code &&
        (lookup.isFetching && !found ? (
          <p className="text-[13px] text-gray-500">매장을 찾는 중이에요…</p>
        ) : lookup.isError ? (
          <p className="text-[13px] font-medium text-danger">
            {extractApiError(
              lookup.error,
              "매장을 찾지 못했어요. 매장 ID를 다시 확인해 주세요.",
            )}
          </p>
        ) : found ? (
          <div className="flex flex-col gap-[12px] rounded-[18px] border border-gray-100 bg-surface p-[16px] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-[2px]">
              <span className="text-[16px] font-bold break-keep text-gray-900">
                {found.name}
              </span>
              <span className="text-[13px] break-keep text-gray-500">
                {found.address}
              </span>
            </div>
            {found.linked ? (
              <span className="shrink-0 text-[13px] font-semibold text-gray-500">
                이미 연결된 매장이에요
              </span>
            ) : found.pending ? (
              <span className="shrink-0 text-[13px] font-semibold text-gray-500">
                연결을 요청했어요
              </span>
            ) : (
              <Button
                onPress={send}
                isPending={create.isPending}
                className="h-[44px] shrink-0 rounded-[19px] px-[20px] font-bold max-sm:w-full"
              >
                연결 요청
              </Button>
            )}
          </div>
        ) : null)}

      {!!links.data?.length && <LinkRequestList items={links.data} />}
    </section>
  );
}

const STATUS_TEXT: Record<StoreLinkRequest["status"], string> = {
  pending: "담당자 확인 중",
  done: "연결됨",
  rejected: "연결 안 됨",
};

const STATUS_TONE: Record<StoreLinkRequest["status"], string> = {
  pending: "text-amber-600 dark:text-warning",
  done: "text-emerald-600 dark:text-success",
  rejected: "text-red-500 dark:text-error",
};

/** 보낸 연결 요청 — 매장 · 상태(확인 중이면 요청 취소, 연결 안 됨이면 사유). */
function LinkRequestList({ items }: { items: StoreLinkRequest[] }) {
  const cancel = useCancelStoreLink();
  return (
    <div className="flex flex-col gap-[8px] border-t border-gray-100 pt-[16px]">
      <h3 className="text-[13px] font-bold text-gray-900">보낸 요청</h3>
      <ul className="flex flex-col gap-[8px]">
        {items.map((r) => (
          <li
            key={r.id}
            className="flex flex-col gap-[4px] rounded-[16px] bg-gray-50 px-[14px] py-[12px]"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-[12px] gap-y-[6px]">
              <span className="min-w-0 text-[14px] font-semibold break-keep text-gray-900">
                {r.storeName ?? "지운 매장"}
                <span className="ml-[6px] text-[12px] font-medium text-gray-400">
                  {r.storeCode}
                </span>
              </span>
              <span className="flex items-center gap-[10px]">
                <span
                  className={cn(
                    "text-[13px] font-semibold",
                    STATUS_TONE[r.status],
                  )}
                >
                  {STATUS_TEXT[r.status]}
                </span>
                {r.status === "pending" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    isDisabled={cancel.isPending}
                    onPress={() =>
                      cancel.mutate(r.id, {
                        onError: (err) =>
                          toast.danger("취소하지 못했어요", {
                            description: extractApiError(err),
                          }),
                      })
                    }
                    className="h-[28px] rounded-[11px] px-[8px] text-[12px] font-semibold text-gray-500"
                  >
                    요청 취소
                  </Button>
                )}
              </span>
            </div>
            {r.status === "rejected" && r.adminReply && (
              <p className="text-[13px] leading-[1.6] break-keep text-gray-500">
                {r.adminReply}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 카드 머리 — 아이콘 칸 + 상황 칩(매장 ID가 있어요 · 없어요) 줄, 그 아래 제목 · 설명. */
function PathHead({
  icon,
  tone,
  chip,
  title,
  desc,
}: {
  icon: ReactNode;
  /** 아이콘 칸 바탕 · 색 — 매장 ID 는 보라, 처음 등록은 노랑. */
  tone: string;
  chip: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center gap-[10px]">
        <span
          className={cn(
            "flex size-[40px] shrink-0 items-center justify-center rounded-[13px]",
            tone,
          )}
        >
          {icon}
        </span>
        <span className="rounded-full bg-gray-100 px-[10px] py-[3px] text-[12px] font-semibold text-gray-600">
          {chip}
        </span>
      </div>
      <div className="flex flex-col gap-[4px]">
        <h2 className="text-[17px] font-bold break-keep text-gray-900">
          {title}
        </h2>
        <p className="text-[13px] leading-[1.6] break-keep text-gray-500">
          {desc}
        </p>
      </div>
    </div>
  );
}

/** 두 카드 사이 "또는" — 휴대폰은 가로줄, PC는 세로줄. */
function OrDivider() {
  return (
    <div
      aria-hidden
      className="flex items-center gap-[12px] py-[2px] lg:flex-col lg:py-[12px]"
    >
      <span className="h-px flex-1 bg-gray-200 lg:h-auto lg:w-px" />
      <span className="text-[12px] font-semibold text-gray-400">또는</span>
      <span className="h-px flex-1 bg-gray-200 lg:h-auto lg:w-px" />
    </div>
  );
}

/** 처음 등록하는 매장 — admix 담당자가 매장을 등록하고 회원 고유번호로 잇는다(069). */
function NewStoreCard({ code }: { code: string | null }) {
  return (
    // 매장 ID 카드(흰 유리)와 갈리게 — 점선 테두리 · 옅은 판 · 그림자 없음.
    <section className="flex min-w-0 flex-col gap-[16px] rounded-[24px] border border-dashed border-gray-300 bg-surface/40 p-[20px] sm:p-[28px] dark:border-gray-200">
      <PathHead
        icon={
          <MaskIcon src="/icons/stroke-store.svg" className="size-[20px]" />
        }
        tone="bg-amber-50 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300"
        chip="매장 ID가 없어요"
        title="처음 등록하는 매장이에요"
        desc="admix 담당자가 매장을 등록하고 연결해 드려요. 담당자에게 회원 고유번호를 알려 주세요."
      />
      {code && (
        <p className="flex items-center justify-between gap-[8px] rounded-[16px] bg-surface px-[16px] py-[12px] text-[13px] text-gray-600 ring-1 ring-gray-200">
          회원 고유번호
          <b className="text-[16px] font-bold tracking-[0.02em] text-gray-900">
            {code}
          </b>
        </p>
      )}
    </section>
  );
}
