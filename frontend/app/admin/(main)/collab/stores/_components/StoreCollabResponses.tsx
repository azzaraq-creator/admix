"use client";

import { Chip, Tabs } from "@heroui/react";
import Link from "next/link";
import { useState } from "react";

import { AdminPanel } from "@/components/admin/AdminPanel";
import { useAdminStoreCollabs } from "@/hooks/adminPartners";
import { dotDateTime, shortDate } from "@/lib/adminCollab";
import type { AdminStoreCollabs, StoreCollabResponse } from "@/lib/partners";

type Item = AdminStoreCollabs["items"][number];

const RESPONSE_LABEL: Record<StoreCollabResponse, string> = {
  joined: "참여",
  passed: "미참여",
  silent: "무응답",
  waiting: "답 기다림",
};
const TABS: StoreCollabResponse[] = ["joined", "passed", "silent", "waiting"];

const EMPTY: Record<StoreCollabResponse, string> = {
  joined: "참여한 콜라보가 없어요.",
  passed: "미참여로 답한 콜라보가 없어요.",
  silent: "무응답으로 끝난 콜라보가 없어요.",
  waiting: "답을 기다리는 콜라보가 없어요.",
};

/** 참여한 콜라보가 어떻게 됐는지 — 참여 줄 상태 · 콜라보 단계로. */
function outcomeOf(it: Item): {
  label: string;
  color: "default" | "accent" | "success" | "warning" | "danger";
} {
  if (it.phase === "cancelled")
    return { label: "콜라보 취소", color: "danger" };
  switch (it.status) {
    case "requested":
      return { label: "확정 요청", color: "warning" };
    case "confirmed":
      if (it.phase === "done") return { label: "진행 완료", color: "success" };
      if (it.phase === "running") return { label: "진행 중", color: "success" };
      return { label: "확정", color: "success" };
    case "declined":
      return { label: "확정 전 빠짐", color: "default" };
    case "cancelled":
      return { label: "취소", color: "danger" };
    default:
      return { label: "신청함", color: "accent" };
  }
}

/**
 * 매장 상세 "콜라보 참여"(2026-11-12 사용자) — 새 콜라보마다 물은 참여 / 미참여, 모집이 끝날 때까지 답이 없으면 무응답.
 * 위에 수, 아래 탭마다 콜라보 기록(참여는 그 뒤 어떻게 됐는지까지). 끝난 콜라보는 결과 보고서로, 나머지는 콜라보 상세로 간다.
 */
export function StoreCollabResponses({ storeId }: { storeId: string }) {
  const { data, isLoading } = useAdminStoreCollabs(storeId);
  const [tab, setTab] = useState<StoreCollabResponse>("joined");
  const counts = data?.counts;
  const tabs = TABS.filter(
    (t) => t !== "waiting" || (counts?.waiting ?? 0) > 0,
  );
  const items = (data?.items ?? []).filter((it) => it.response === tab);

  return (
    <AdminPanel
      title="콜라보 참여"
      desc="새 콜라보마다 참여 · 미참여를 물어요. 모집이 끝날 때까지 답이 없으면 무응답이에요."
    >
      {isLoading || !data ? (
        <p className="text-sm text-disabled">불러오는 중…</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-[8px] md:max-w-[480px]">
            {(["joined", "passed", "silent"] as const).map((k) => (
              <div
                key={k}
                className="flex flex-col gap-[2px] rounded-[12px] bg-gray-50 px-[14px] py-[10px]"
              >
                <span className="text-xs text-disabled">
                  {RESPONSE_LABEL[k]}
                </span>
                <span className="text-xl font-bold text-black">
                  {data.counts[k]}
                </span>
              </div>
            ))}
          </div>
          {/* 언제부터 답할 수 있었는지 · 세지 않는 모집 안내는 뺐다(2026-11-12 사용자). 답 기다리는 수는 탭에 보인다. */}
          {!data.since && (
            <p className="text-xs text-disabled">
              연결 회원이 기본협약을 마치면 새 콜라보마다 참여 여부를 물어요.
            </p>
          )}

          <Tabs
            selectedKey={tab}
            onSelectionChange={(key) => setTab(key as StoreCollabResponse)}
          >
            <Tabs.ListContainer className="w-fit max-w-full overflow-x-auto">
              <Tabs.List aria-label="응답">
                {tabs.map((t) => (
                  <Tabs.Tab
                    key={t}
                    id={t}
                    className="gap-[4px] px-[12px] whitespace-nowrap"
                  >
                    {RESPONSE_LABEL[t]}
                    <span className="text-disabled">{data.counts[t]}</span>
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>

          {items.length ? (
            <ul className="flex flex-col">
              {items.map((it, i) => (
                <li
                  key={it.collabId}
                  className={i ? "border-t border-gray-100" : undefined}
                >
                  <Row it={it} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-[12px] text-sm text-disabled">{EMPTY[tab]}</p>
          )}
        </>
      )}
    </AdminPanel>
  );
}

function Row({ it }: { it: Item }) {
  const ended = it.phase === "done" || it.phase === "cancelled";
  const outcome = it.response === "joined" ? outcomeOf(it) : null;
  return (
    <Link
      href={
        ended
          ? `/admin/collab/results/${it.collabId}`
          : `/admin/collab/collabs/${it.collabId}`
      }
      className="flex flex-wrap items-center justify-between gap-x-[16px] gap-y-[4px] py-[12px] no-underline"
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-xs text-disabled">{it.brandName}</span>
        <span className="truncate text-sm font-semibold text-black hover:underline">
          {it.title}
        </span>
        <span className="text-xs text-disabled">
          콜라보 {shortDate(it.startDate)} ~ {shortDate(it.endDate)} · 모집 마감{" "}
          {shortDate(it.recruitEnd)}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-[4px] text-xs text-disabled">
        {outcome && (
          <Chip size="sm" variant="soft" color={outcome.color}>
            {outcome.label}
          </Chip>
        )}
        {it.response === "joined" && (
          <span>
            {it.confirmNo
              ? `확정서 ${it.confirmNo}`
              : `신청 ${dotDateTime(it.appliedAt)}`}
          </span>
        )}
        {it.response === "passed" && (
          <span>미참여 답 {dotDateTime(it.answeredAt)}</span>
        )}
        {it.response === "silent" && (
          <span>{shortDate(it.recruitEnd)} 모집 마감까지 답 없음</span>
        )}
        {it.response === "waiting" && (
          <span>{shortDate(it.recruitEnd)}까지 답을 기다려요</span>
        )}
      </span>
    </Link>
  );
}
