"use client";

import { Button, Chip, Tabs, TextArea } from "@heroui/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { LoadingState } from "@/components/common/RouteStates";
import {
  useCollabAdminSummary,
  useCollabRequests,
  useUpdateStoreRequest,
} from "@/hooks/adminCollab";
import { useSonner } from "@/hooks/useSonner";
import { dotDateTime } from "@/lib/adminCollab";
import { extractApiError } from "@/lib/apiError";
import type { AdminStoreRequest, StoreRequestStatus } from "@/lib/partners";

import { CollabPageHead, SimplePager } from "../../_components/collabUi";

type StatusTab = StoreRequestStatus | "all";
const PAGE_SIZE = 20;

/**
 * 매장 수정 요청함 — 제휴사가 "내 매장 → 우리 매장 정보"에서 줄(항목)을 골라 보낸 새 값(074).
 * "반영하기"를 누르면 매장 정보가 그 값으로 바뀌고 처리 완료, 안 되면 사유를 적고 "처리 불가"(제휴사 수정 기록에 사유가 보인다).
 * ?store_id= 로 들어오면 그 매장 요청만.
 */
export function CollabRequestsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeId = searchParams.get("store_id") ?? undefined;
  const [tab, setTab] = useState<StatusTab>("pending");
  const [page, setPage] = useState(1);
  const { data: summary } = useCollabAdminSummary();
  const { data, isLoading } = useCollabRequests({
    status: tab === "all" ? undefined : tab,
    store_id: storeId,
    page,
    page_size: PAGE_SIZE,
  });
  const storeName = storeId ? data?.items[0]?.storeName : undefined;

  return (
    <div className="flex flex-col gap-[24px]">
      <CollabPageHead
        title="수정 요청"
        desc="제휴사가 내 매장에서 보낸 수정 요청이에요. 반영하기를 누르면 매장 정보가 바뀐 값으로 저장돼요. 반영할 수 없으면 사유를 적고 처리 불가를 눌러 주세요 — 사유는 제휴사 수정 기록에 보여요."
      />

      <div className="flex flex-wrap items-center gap-[12px]">
        <Tabs
          key={summary?.requestsPending ?? "-"}
          selectedKey={tab}
          onSelectionChange={(key) => {
            setTab(key as StatusTab);
            setPage(1);
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
                    <span className="tabular-nums">
                      {summary.requestsPending}
                    </span>
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
      ) : !data?.items.length ? (
        <p className="rounded-[12px] border border-stroke py-[60px] text-center text-sm text-disabled">
          {tab === "pending" ? "처리할 요청이 없어요." : "요청이 없어요."}
        </p>
      ) : (
        <ul className="flex flex-col gap-[12px]">
          {data.items.map((r) => (
            <li key={r.id}>
              <RequestCard request={r} />
            </li>
          ))}
        </ul>
      )}

      <SimplePager
        page={page}
        pageSize={PAGE_SIZE}
        total={data?.total ?? 0}
        onChange={setPage}
      />
    </div>
  );
}

const STATUS_CHIP: Record<
  StoreRequestStatus,
  { label: string; color: "warning" | "success" | "danger" }
> = {
  pending: { label: "처리 전", color: "warning" },
  done: { label: "반영 완료", color: "success" },
  rejected: { label: "처리 불가", color: "danger" },
};

function RequestCard({ request: r }: { request: AdminStoreRequest }) {
  const update = useUpdateStoreRequest();
  const { success, error } = useSonner();
  const [reply, setReply] = useState(r.adminReply ?? "");
  const [replyError, setReplyError] = useState<string | null>(null);
  const status = STATUS_CHIP[r.status] ?? STATUS_CHIP.pending;
  const replyChanged = reply.trim() !== (r.adminReply ?? "");

  const save = async (next?: StoreRequestStatus) => {
    // 처리 불가는 사유가 꼭 있어야 한다 — 제휴사 수정 기록에 그대로 보인다.
    if (next === "rejected" && !reply.trim()) {
      setReplyError("처리 불가 사유를 적어 주세요.");
      return;
    }
    try {
      await update.mutateAsync({
        id: r.id,
        payload: {
          ...(replyChanged || next
            ? { admin_reply: reply.trim() || null }
            : {}),
          ...(next ? { status: next } : {}),
        },
      });
      success(
        next === "done"
          ? r.field
            ? "매장 정보에 반영했어요."
            : "처리 완료로 바꿨어요."
          : next === "rejected"
            ? "처리 불가로 답했어요."
            : next === "pending"
              ? "처리 전으로 되돌렸어요."
              : "답을 저장했어요.",
      );
    } catch (err) {
      error("저장하지 못했어요.", extractApiError(err));
    }
  };

  return (
    <article className="flex flex-col gap-[12px] rounded-[12px] border border-stroke p-[16px] md:p-[20px]">
      <div className="flex flex-wrap items-center justify-between gap-[8px]">
        <div className="flex min-w-0 flex-wrap items-center gap-x-[10px] gap-y-[4px] text-sm">
          <Chip size="sm" variant="soft" color="accent">
            {r.fieldLabel}
          </Chip>
          <Link
            href={`/admin/collab/stores/${r.storeId}`}
            className="font-semibold text-black underline-offset-2 hover:underline"
          >
            {r.storeCode} {r.storeName ?? "(지운 매장)"}
          </Link>
          {r.userId && (
            <Link
              href={`/admin/collab/members/${r.userId}`}
              className="text-tone-4a5565 underline-offset-2 hover:underline"
            >
              {r.partnerCode} {r.userName || r.userLoginId}
            </Link>
          )}
          <span className="text-xs text-disabled">
            {dotDateTime(r.createdAt)} 요청
          </span>
        </div>
        <Chip size="sm" variant="soft" color={status.color}>
          {status.label}
        </Chip>
      </div>

      {r.field ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-[16px] gap-y-[6px] rounded-[10px] bg-tone-fafafc px-[14px] py-[12px] text-sm leading-[22px]">
          <dt className="text-disabled">이전</dt>
          <dd
            className={
              r.status === "done"
                ? "text-tone-4a5565 line-through"
                : "text-tone-4a5565"
            }
          >
            {r.before ?? "(비어 있음)"}
          </dd>
          <dt className="text-disabled">변경</dt>
          <dd className="font-semibold text-black">{r.after ?? "(비우기)"}</dd>
        </dl>
      ) : (
        <p className="whitespace-pre-wrap rounded-[10px] bg-tone-fafafc px-[14px] py-[12px] text-sm leading-[22px] text-black">
          {r.after}
        </p>
      )}
      {r.memo && (
        <p className="whitespace-pre-wrap text-sm leading-[22px] text-tone-4a5565">
          <b className="mr-[6px] font-semibold text-black">남긴 말</b>
          {r.memo}
        </p>
      )}

      <div className="flex flex-col gap-[4px]">
        <TextArea
          variant="secondary"
          fullWidth
          rows={2}
          aria-label="답변 · 처리 불가 사유"
          placeholder={
            r.status === "done"
              ? "제휴사에게 보일 답(선택)"
              : "처리 불가 사유(처리 불가일 때 필수) 또는 제휴사에게 보일 답"
          }
          value={reply}
          onChange={(e) => {
            setReply(e.target.value);
            setReplyError(null);
          }}
        />
        {replyError && (
          <p className="text-xs font-medium text-[#d65856]">{replyError}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-[8px]">
        <span className="text-xs text-disabled">
          {r.status !== "pending" && r.handledAt
            ? `${dotDateTime(r.handledAt)} ${status.label}`
            : ""}
        </span>
        <div className="flex gap-[8px]">
          {replyChanged && (
            <Button
              size="sm"
              variant="secondary"
              isDisabled={update.isPending}
              onPress={() => save()}
            >
              답만 저장
            </Button>
          )}
          {r.status === "pending" && (
            <>
              <Button
                size="sm"
                variant="danger-soft"
                isDisabled={update.isPending}
                onPress={() => save("rejected")}
              >
                처리 불가
              </Button>
              <Button
                size="sm"
                variant="primary"
                isDisabled={update.isPending}
                onPress={() => save("done")}
              >
                {r.field ? "반영하기" : "처리 완료"}
              </Button>
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
    </article>
  );
}
