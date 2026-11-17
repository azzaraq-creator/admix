"use client";

import {
  Accordion,
  Button,
  Chip,
  EmptyState,
  Tabs,
  TextArea,
} from "@heroui/react";
import { ArrowRight, Inbox, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { AdminPanel } from "@/components/admin/AdminPanel";
import { LoadingState } from "@/components/common/RouteStates";
import {
  useCollabAdminSummary,
  useCollabRequests,
  useLinkStore,
  useUpdateStoreRequest,
} from "@/hooks/adminCollab";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { useSonner } from "@/hooks/useSonner";
import { dotDateTime, type StoreRequestKind } from "@/lib/adminCollab";
import { extractApiError } from "@/lib/apiError";
import {
  isFieldRequest,
  STORE_ADD_FIELD,
  STORE_LINK_FIELD,
  STORE_INQUIRY_FIELD,
  STORE_INQUIRY_LABEL,
  type AdminPartnersStore,
  type AdminStoreRequest,
  type StoreRequestField,
  type StoreRequestStatus,
} from "@/lib/partners";

import { CollabPageHead, SimplePager } from "../../_components/collabUi";
import { StoreSearchModal } from "../../_components/StoreSearchModal";

type StatusTab = StoreRequestStatus | "all";
const PAGE_SIZE = 20;

/** 유형 묶음(11-17 사용자: "유형별로 아코디언") — 이 순서로 위에서부터. 요청이 없는 묶음은 감춘다. */
const KINDS: { kind: StoreRequestKind; label: string }[] = [
  { kind: "link", label: "매장 연결 요청" },
  { kind: "add", label: "매장 추가 요청" },
  { kind: "field", label: "정보 수정 요청" },
  { kind: "inquiry", label: STORE_INQUIRY_LABEL },
];
const FIRST_PAGES: Record<StoreRequestKind, number> = {
  link: 1,
  add: 1,
  field: 1,
  inquiry: 1,
};

/**
 * 매장 수정 요청함 — 제휴사가 "내 매장 → 우리 매장 정보"에서 줄(항목)을 골라 보낸 새 값(074).
 * "반영하기"를 누르면 매장 정보가 그 값으로 바뀌고 처리 완료. 안 되면 "처리 불가"를 눌러 밑에 열린 칸에 사유를 적고 보낸다(제휴사 수정 기록에 사유가 보인다).
 * "추가 요청 · 문의"(11-12, 글로 보낸 요청)는 바꿀 값이 없어 "답변하기"로 답(선택)을 적고 처리 완료 — 답은 제휴사 수정 기록에 보인다.
 * "매장 추가"(11-16, 제휴사가 매장명으로 보낸 요청)는 "매장 등록하기"로 등록된 매장 검색 창을 요청한 매장명으로 찾아 열고(11-16 사용자),
 * 고르면 보낸 회원에게 연결하고 이 요청도 처리 완료. 찾는 매장이 없으면 창 아래 "새 매장으로 등록"으로 새 매장 폼을
 * 매장명 · 연결 회원을 채워 열고, 등록하면 이 요청도 처리 완료된다(?request=).
 * ?store_id= 로 들어오면 그 매장 요청만.
 * 처리 상태 탭 아래는 유형별 접는 묶음(HeroUI Accordion, 처음엔 모두 펼침) — 매장 연결 · 매장 추가 · 정보 수정 · 추가 요청 · 문의.
 * 묶음마다 따로 받아 쪽을 넘긴다(11-17 사용자: "유형별로 아코디언").
 * 카드 제목은 "무엇을 고쳐 달라는지"(어드민 매장 화면 칸 이름 — 가능 범위 · 운영 시간 …), 그 아래 매장 · 보낸 회원,
 * 본문은 지금 값 → 바꿀 값 두 칸(2026-11-12 사용자: 뭐에 대한 수정 요청인지 명확히).
 */
export function CollabRequestsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeId = searchParams.get("store_id") ?? undefined;
  const [tab, setTab] = useState<StatusTab>("pending");
  const [pages, setPages] = useState(FIRST_PAGES);
  const { data: summary } = useCollabAdminSummary();
  const status = tab === "all" ? undefined : tab;
  const listOf = (kind: StoreRequestKind) => ({
    status,
    store_id: storeId,
    kind,
    page: pages[kind],
    page_size: PAGE_SIZE,
  });
  // 훅은 같은 순서로 네 번 — KINDS 순서와 같다.
  const lists = {
    link: useCollabRequests(listOf("link")),
    add: useCollabRequests(listOf("add")),
    field: useCollabRequests(listOf("field")),
    inquiry: useCollabRequests(listOf("inquiry")),
  };
  const groups = KINDS.filter((g) => (lists[g.kind].data?.total ?? 0) > 0);
  const isLoading = KINDS.some((g) => lists[g.kind].isLoading);
  const storeName = storeId
    ? groups.map((g) => lists[g.kind].data?.items[0]?.storeName).find(Boolean)
    : undefined;
  // 접은 묶음만 기억 — 처음엔 모두 펼침, 새로 생긴 묶음도 펼친 채로.
  const [collapsed, setCollapsed] = useState<Set<StoreRequestKind>>(
    () => new Set(),
  );

  return (
    <div className="flex flex-col gap-[20px] md:gap-[24px]">
      {/* 설명 글은 뺐다(11-17 사용자: "이 문구 빼줘"). */}
      <CollabPageHead title="매장·수정 요청" />

      <div className="flex flex-wrap items-center gap-[12px]">
        <Tabs
          key={summary?.requestsPending ?? "-"}
          selectedKey={tab}
          onSelectionChange={(key) => {
            setTab(key as StatusTab);
            setPages(FIRST_PAGES);
          }}
        >
          <Tabs.ListContainer className="w-fit rounded-[17px]">
            <Tabs.List aria-label="처리 상태">
              {(
                [
                  ["pending", "처리 전"],
                  ["done", "반영 완료"],
                  ["rejected", "처리 불가"],
                  ["all", "전체"],
                ] as const
              ).map(([id, label]) => (
                <Tabs.Tab
                  key={id}
                  id={id}
                  className="gap-[4px] whitespace-nowrap rounded-[13px]"
                >
                  {label}
                  {id === "pending" && !!summary?.requestsPending && (
                    <span>{summary.requestsPending}</span>
                  )}
                  <Tabs.Indicator className="rounded-[13px]" />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
        {storeId && (
          <span className="flex items-center gap-[8px] text-sm">
            <Chip size="sm" variant="soft" color="accent">
              {storeName ?? "이 매장"} 요청만
            </Chip>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => router.push("/admin/collab/requests")}
              className="h-auto p-0 text-xs font-medium text-primary-800 underline data-[hovered=true]:bg-transparent"
            >
              전체 보기
            </Button>
          </span>
        )}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : groups.length === 0 ? (
        <AdminPanel>
          <EmptyState className="flex flex-col items-center gap-[8px] py-[56px] text-center">
            <Inbox className="size-[28px] text-gray-300" aria-hidden />
            <p className="text-base font-semibold text-black">
              {EMPTY_TITLE[tab]}
            </p>
            <p className="text-sm text-disabled">
              제휴사가 내 매장에서 매장명 · 주소 · 운영 시간 같은 정보를 고쳐
              달라고 하면 여기에 모여요.
            </p>
          </EmptyState>
        </AdminPanel>
      ) : (
        <Accordion
          allowsMultipleExpanded
          hideSeparator
          expandedKeys={groups
            .map((g) => g.kind)
            .filter((k) => !collapsed.has(k))}
          onExpandedChange={(keys) =>
            setCollapsed(
              new Set(
                groups
                  .map((g) => g.kind)
                  .filter((k) => !(keys as Set<string>).has(k)),
              ),
            )
          }
          className="flex flex-col gap-[24px]"
        >
          {groups.map((g) => {
            const data = lists[g.kind].data;
            return (
              <Accordion.Item key={g.kind} id={g.kind} className="after:hidden">
                <Accordion.Heading>
                  {/* 이름 · 건수는 왼쪽에 붙이고, 접기 표시는 오른쪽 끝. */}
                  <Accordion.Trigger className="gap-[8px] rounded-[10px] px-[4px] py-[4px] hover:bg-transparent">
                    <span className="flex items-center gap-[8px]">
                      <span className="text-base font-bold text-black">
                        {g.label}
                      </span>
                      <Chip size="sm" variant="soft" color="accent">
                        {(data?.total ?? 0).toLocaleString()}건
                      </Chip>
                    </span>
                    <Accordion.Indicator className="size-[16px] text-gray-400" />
                  </Accordion.Trigger>
                </Accordion.Heading>
                <Accordion.Panel>
                  <Accordion.Body className="flex flex-col gap-[16px] px-0 pt-[8px] pb-0">
                    <ul className="flex flex-col gap-[16px]">
                      {data?.items.map((r) => (
                        <li key={r.id}>
                          <RequestCard request={r} />
                        </li>
                      ))}
                    </ul>
                    <SimplePager
                      page={pages[g.kind]}
                      pageSize={PAGE_SIZE}
                      total={data?.total ?? 0}
                      onChange={(p) =>
                        setPages((prev) => ({ ...prev, [g.kind]: p }))
                      }
                    />
                  </Accordion.Body>
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}

const EMPTY_TITLE: Record<StatusTab, string> = {
  pending: "처리할 수정 요청이 없어요",
  done: "반영한 요청이 없어요",
  rejected: "처리 불가로 답한 요청이 없어요",
  all: "받은 수정 요청이 없어요",
};

/**
 * 요청 항목 이름 — 제휴사 화면 이름(사장님 · 매장 번호 …) 대신 어드민 매장 화면 칸 이름으로 보인다.
 * "어느 칸을 고쳐 달라는지" 바로 알 수 있게(2026-11-12 사용자).
 */
const ADMIN_FIELD_LABEL: Record<StoreRequestField, string> = {
  name: "매장명",
  address: "주소",
  hours: "운영 시간",
  phone: "전화번호",
  owner_name: "사장 이름",
  scope: "가능 범위",
};

const STATUS_CHIP: Record<
  StoreRequestStatus,
  { label: string; color: "warning" | "success" | "danger" }
> = {
  pending: { label: "처리 전", color: "warning" },
  done: { label: "반영 완료", color: "success" },
  rejected: { label: "처리 불가", color: "danger" },
};

function RequestCard({ request: r }: { request: AdminStoreRequest }) {
  const router = useRouter();
  const update = useUpdateStoreRequest();
  const link = useLinkStore();
  const { alert, confirmDialog } = useAdminConfirm();
  const { success, error } = useSonner();
  // 매장 추가 요청(11-16) — 등록된 매장에서 골라 보낸 회원에게 연결한다. 없으면 새 매장 폼을 매장명 · 연결 회원 · 이 요청으로 채워 연다.
  const addStore = r.field === STORE_ADD_FIELD;
  // 매장 연결 요청(094) — 매장 ID로 이 매장에 연결해 달라는 요청. "연결 승인"하면 보낸 회원이 연결 회원이 된다.
  const linkStore = r.field === STORE_LINK_FIELD;
  const [picking, setPicking] = useState(false);
  const busy = update.isPending || link.isPending;
  const addStoreHref = `/admin/collab/stores/new?${new URLSearchParams({
    name: r.after ?? "",
    ...(r.partnerCode ? { owner: r.partnerCode } : {}),
    request: r.id,
  })}`;
  // 항목 요청은 "반영하기"(매장 값을 바꾼다), 글로 보낸 요청(추가 요청 · 문의, 예전 자유 입력)은 "답변하기"(처리 완료).
  const fieldRequest = isFieldRequest(r);
  // 없앤 항목(매장 어필 · 조건 메모, 11-17)으로 예전에 보낸 요청 — 정보 수정 묶음에 두고 같은 모양(제목 · 값 두 칸)으로 보인다.
  // 반영은 못 해서 버튼은 글 요청과 같다(이미 모두 처리됨).
  const pastField =
    !!r.field &&
    !fieldRequest &&
    !addStore &&
    !linkStore &&
    r.field !== STORE_INQUIRY_FIELD;
  const valueRequest = fieldRequest || pastField;
  // 버튼 밑에 열리는 칸 — "처리 불가"는 사유(꼭, 11-11 사용자), "답변하기"는 답(선택, 11-12). 평소엔 숨긴다.
  const [panel, setPanel] = useState<"reject" | "answer" | null>(null);
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const status =
    r.status === "done" && linkStore
      ? { ...STATUS_CHIP.done, label: "연결 완료" }
      : r.status === "done" && !fieldRequest
        ? { ...STATUS_CHIP.done, label: "처리 완료" }
        : (STATUS_CHIP[r.status] ?? STATUS_CHIP.pending);

  const save = async (next: StoreRequestStatus) => {
    // 처리 불가는 사유가 꼭 있어야 한다 — 제휴사 수정 기록에 그대로 보인다.
    if (next === "rejected" && !reply.trim()) {
      setReplyError("처리 불가 사유를 적어 주세요.");
      return;
    }
    // 칸을 열고 보낼 때만 답을 같이 저장한다(처리 전으로 되돌릴 땐 남긴 사유를 그대로 둔다).
    const withReply =
      next === "rejected" || (next === "done" && panel === "answer");
    try {
      await update.mutateAsync({
        id: r.id,
        payload: withReply
          ? { status: next, admin_reply: reply.trim() || null }
          : { status: next },
      });
      setPanel(null);
      success(
        next === "done"
          ? linkStore
            ? "매장에 연결했어요."
            : fieldRequest
              ? "매장 정보에 반영했어요."
              : reply.trim()
                ? "답변하고 처리 완료로 바꿨어요."
                : "처리 완료로 바꿨어요."
          : next === "rejected"
            ? "처리 불가로 답했어요."
            : "처리 전으로 되돌렸어요.",
      );
    } catch (err) {
      error("저장하지 못했어요.", extractApiError(err));
    }
  };

  /** 매장 검색 창에서 고른 매장 — 보낸 회원에게 연결하고 이 요청을 처리 완료로. 다른 회원이 연결돼 있어도 같이 연결된다(094). */
  const linkPicked = async (store: AdminPartnersStore) => {
    setPicking(false);
    if (!r.userId || !store.storeCode) return;
    try {
      await link.mutateAsync({ id: r.userId, storeCode: store.storeCode });
    } catch (err) {
      await alert({
        title: "연결하지 못했어요",
        description: extractApiError(err),
        confirmText: "확인",
      });
      return;
    }
    // 연결은 됐으니 요청 처리 완료가 안 돼도 연결은 그대로 둔다.
    const done = await update
      .mutateAsync({ id: r.id, payload: { status: "done" } })
      .then(() => true)
      .catch(() => false);
    success(
      "매장을 연결했어요.",
      `${store.storeCode} ${store.name}. ${
        done
          ? "매장 추가 요청도 처리 완료로 바꿨어요."
          : "매장 추가 요청은 답변하기로 처리 완료로 바꿔 주세요."
      }`,
    );
  };

  const openPanel = (next: "reject" | "answer") => {
    setReply("");
    setReplyError(null);
    setPanel(next);
  };

  return (
    // 요청 하나 = 흰 카드 하나(테두리 없이, 회색 바탕 위) — 2026-11-12 어드민 전체 모양.
    <AdminPanel contentClassName="gap-[14px]">
      {/*
       * 머리 — 정보 수정 요청만 무엇을 고쳐 달라는지(제목), 그 아래 매장 · 보낸 회원 · 보낸 때 · 오른쪽 상태.
       * 매장 연결 · 매장 추가 · 문의는 묶음 이름과 같아 제목을 뺐다(11-17 사용자: "카드 제목은 빼줘").
       */}
      <div className="flex items-start justify-between gap-[12px]">
        <div className="flex min-w-0 flex-col gap-[4px]">
          {valueRequest && (
            <h3 className="text-base font-bold leading-[24px] text-black">
              {(fieldRequest && ADMIN_FIELD_LABEL[r.field]) || r.fieldLabel}{" "}
              수정 요청
            </h3>
          )}
          <p className="flex flex-wrap items-center gap-x-[8px] gap-y-[2px] text-sm text-tone-4a5565">
            {/* 누르면 매장 · 회원 상세 — 밑줄로 알린다, 굵기는 기본 · 검정(11-17 사용자). */}
            <Link
              href={`/admin/collab/stores/${r.storeId}`}
              className="font-normal text-black underline underline-offset-2"
            >
              {[r.storeCode, r.storeName ?? "(지운 매장)"]
                .filter(Boolean)
                .join(" ")}
            </Link>
            {r.userId && (
              <>
                <span className="text-gray-300" aria-hidden>
                  |
                </span>
                <Link
                  href={`/admin/collab/members/${r.userId}`}
                  className="font-normal text-black underline underline-offset-2"
                >
                  {r.partnerCode} {r.userName || r.userLoginId}
                </Link>
              </>
            )}
          </p>
        </div>
        {/* 상태 칩 · 보낸 때 — 보낸 때는 맨 오른쪽(11-17 사용자). */}
        <div className="flex shrink-0 items-center gap-[10px]">
          <Chip size="sm" variant="soft" color={status.color}>
            {status.label}
          </Chip>
          <span className="text-xs whitespace-nowrap text-disabled">
            {dotDateTime(r.createdAt)} 요청
          </span>
        </div>
      </div>

      {valueRequest ? (
        // 지금 값 → 바꿀 값. 반영한 요청은 "바꾸기 전 → 바꾼 값", 처리 불가는 "지금 값 → 요청한 값".
        <div className="grid grid-cols-1 items-stretch gap-[8px] md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-[12px]">
          <ValueBox
            label={r.status === "done" ? "바꾸기 전" : "지금 값"}
            value={r.before}
            empty="(비어 있음)"
            muted
          />
          <ArrowRight
            className="hidden size-[18px] self-center text-gray-300 md:block"
            aria-hidden
          />
          <ValueBox
            label={
              r.status === "done"
                ? "바꾼 값"
                : r.status === "rejected"
                  ? "요청한 값"
                  : "바꿀 값"
            }
            value={r.after}
            empty="(비우기)"
          />
        </div>
      ) : addStore ? (
        <ValueBox label="추가할 매장명" value={r.after} empty="(없음)" />
      ) : linkStore ? (
        <ValueBox
          label="연결할 매장"
          value={[r.storeCode, r.storeName].filter(Boolean).join(" ") || null}
          empty="(지운 매장)"
        />
      ) : (
        <ValueBox label="문의 내용" value={r.after} empty="(내용 없음)" />
      )}
      {r.memo && (
        <p className="whitespace-pre-wrap text-sm leading-[22px] text-tone-4a5565">
          <b className="mr-[6px] font-semibold text-black">남긴 말</b>
          {r.memo}
        </p>
      )}

      {/* 처리한 요청 — 남긴 답(처리 불가 사유 · 답변)을 그대로 보인다. */}
      {r.status !== "pending" && r.adminReply && (
        <p className="whitespace-pre-wrap text-sm leading-[22px] text-tone-4a5565">
          <b className="mr-[6px] font-semibold text-black">
            {r.status === "rejected" ? "처리 불가 사유" : "답변"}
          </b>
          {r.adminReply}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-[8px]">
        <span className="text-xs text-disabled">
          {r.status !== "pending" && r.handledAt
            ? `${dotDateTime(r.handledAt)} ${status.label}`
            : ""}
        </span>
        <div className="flex gap-[8px]">
          {r.status === "pending" && !panel && (
            <>
              {/* 처리 불가는 한 단계 옅게 — ghost(11-17 사용자). */}
              <Button
                size="sm"
                variant="ghost"
                isDisabled={busy}
                onPress={() => openPanel("reject")}
              >
                처리 불가
              </Button>
              <Button
                size="sm"
                variant={addStore ? "tertiary" : "primary"}
                isDisabled={busy}
                onPress={() =>
                  fieldRequest || linkStore ? save("done") : openPanel("answer")
                }
              >
                {linkStore
                  ? "연결 승인"
                  : fieldRequest
                    ? "반영하기"
                    : "답변하기"}
              </Button>
              {addStore && (
                // 등록된 매장에서 고른다(보낸 회원이 없으면 연결할 곳이 없어 새 매장 폼으로).
                <Button
                  size="sm"
                  variant="primary"
                  isDisabled={busy}
                  onPress={() =>
                    r.userId ? setPicking(true) : router.push(addStoreHref)
                  }
                >
                  {link.isPending ? "연결 중…" : "매장 등록하기"}
                </Button>
              )}
            </>
          )}
          {r.status === "rejected" && (
            <Button
              size="sm"
              variant="tertiary"
              isDisabled={update.isPending}
              onPress={() => save("pending")}
            >
              처리 전으로
            </Button>
          )}
        </div>
      </div>

      {/* "처리 불가" · "답변하기"를 누르면 열리는 칸 — 적고 보내면 제휴사 수정 기록에 그대로 보인다. */}
      {r.status === "pending" && panel && (
        <div
          className={
            panel === "reject"
              ? "flex flex-col gap-[8px] rounded-[12px] bg-tone-fff2f1 p-[12px]"
              : "flex flex-col gap-[8px] rounded-[12px] bg-gray-50 p-[12px]"
          }
        >
          <TextArea
            variant="primary"
            fullWidth
            autoFocus
            rows={3}
            aria-label={panel === "reject" ? "처리 불가 사유" : "답변"}
            placeholder={
              panel === "reject"
                ? "처리 불가 사유를 적어 주세요. 제휴사 수정 기록에 그대로 보여요."
                : "답변(선택) — 제휴사 수정 기록에 그대로 보여요. 비워 두면 처리 완료만 돼요."
            }
            value={reply}
            onChange={(e) => {
              setReply(e.target.value);
              setReplyError(null);
            }}
            className="bg-surface"
          />
          {replyError && (
            <p className="text-xs font-medium text-[#d65856]">{replyError}</p>
          )}
          <div className="flex justify-end gap-[8px]">
            <Button
              size="sm"
              variant="tertiary"
              isDisabled={update.isPending}
              onPress={() => setPanel(null)}
            >
              취소
            </Button>
            {panel === "reject" ? (
              <Button
                size="sm"
                variant="danger"
                isDisabled={update.isPending}
                onPress={() => save("rejected")}
              >
                처리 불가로 보내기
              </Button>
            ) : (
              <Button
                size="sm"
                variant="primary"
                isDisabled={update.isPending}
                onPress={() => save("done")}
              >
                처리 완료
              </Button>
            )}
          </div>
        </div>
      )}

      {addStore && r.userId && (
        <StoreSearchModal
          isOpen={picking}
          onOpenChange={setPicking}
          memberId={r.userId}
          onSelect={(store) => void linkPicked(store)}
          title="등록된 매장에서 찾기"
          description={`고르면 ${[r.partnerCode, r.userName || r.userLoginId].filter(Boolean).join(" ")} 회원에게 연결하고 요청을 처리 완료해요.`}
          initialKeyword={r.after ?? ""}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-[8px] border-t border-stroke pt-[14px]">
              <p className="text-sm text-disabled">
                찾는 매장이 없으면 새로 등록해요.
              </p>
              <Button
                size="sm"
                variant="tertiary"
                onPress={() => router.push(addStoreHref)}
              >
                <Plus className="size-[16px]" />새 매장으로 등록
              </Button>
            </div>
          }
        />
      )}
      {confirmDialog}
    </AdminPanel>
  );
}

/** 값 한 칸 — 위 작은 이름표, 아래 값(여러 줄 그대로). muted 면 흐린 글자(지금 값). */
function ValueBox({
  label,
  value,
  empty,
  muted = false,
}: {
  label: string;
  value: string | null;
  empty: string;
  muted?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-[4px] rounded-[12px] bg-gray-50 px-[14px] py-[12px]">
      <span className="text-xs font-medium text-disabled">{label}</span>
      <p
        className={
          muted
            ? "whitespace-pre-wrap break-words text-sm leading-[22px] text-tone-4a5565"
            : "whitespace-pre-wrap break-words text-sm font-semibold leading-[22px] text-black"
        }
      >
        {value || <span className="font-normal text-disabled">{empty}</span>}
      </p>
    </div>
  );
}
