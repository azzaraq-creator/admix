"use client";

import { Alert, Card, Separator, Tabs } from "@heroui/react";
import { ArrowRight, CheckCircle2, Coffee, Inbox } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  PREVIEW_TODAY,
  categoryOf,
  chipOf,
  diffDays,
  md,
  nextActionOf,
  type CollabCategory,
  type PreviewCollab,
} from "@/lib/partnersPreview";

import { usePreviewState } from "./previewStore";
import {
  EmptyBox,
  LinkCard,
  PageHead,
  PartnerOnly,
  StatusChip,
} from "./workspaceUi";

/*
 * /partners/collabs — 콜라보 목록(프로토타입의 "콜라보" 탭 흉내).
 * 모집 중 · 예정 · 진행 중 · 완료 네 칸(HeroUI Tabs). 누르면 /partners/collabs/[id] 상세(진행 안내함).
 */

export const collabHref = (id: string) => `/partners/collabs/${id}`;

const SEGMENTS: { id: CollabCategory; label: string; empty: string }[] = [
  {
    id: "recruiting",
    label: "모집 중",
    empty: "지금 모집 중인 콜라보가 없어요. 새 모집은 이메일로 알려 드려요.",
  },
  {
    id: "upcoming",
    label: "예정",
    empty: "신청했거나 확정한 콜라보(설치 전)가 여기에 모여요.",
  },
  {
    id: "ongoing",
    label: "진행 중",
    empty:
      "지금 진행 중인 콜라보가 없어요. 매장 한 곳은 한 번에 1건을 진행해요.",
  },
  { id: "done", label: "완료", empty: "마친 콜라보가 여기에 쌓여요." },
];

/** 모집 → 준비 → 진행을 한 막대에(오늘 위치 포함). */
export function PeriodBar({ c }: { c: PreviewCollab }) {
  const from = c.recruitStart;
  const total = Math.max(1, diffDays(c.removalDate, from) + 1);
  const pct = (d: string) =>
    Math.min(100, Math.max(0, (diffDays(d, from) / total) * 100));
  const seg = (a: string, b: string) => ({
    left: `${pct(a)}%`,
    width: `${Math.max(1.5, pct(b) - pct(a) + 100 / total)}%`,
  });
  const todayIn = PREVIEW_TODAY >= from && PREVIEW_TODAY <= c.removalDate;
  return (
    <div
      className="flex flex-col gap-[6px]"
      aria-label={`모집 ${md(c.recruitStart)}~${md(c.recruitEnd)}, 진행 ${md(c.startDate)}~${md(c.endDate)}`}
    >
      <div className="relative h-[8px] rounded-full bg-gray-100">
        <span
          className="absolute inset-y-0 rounded-full bg-primary-200"
          style={seg(c.recruitStart, c.recruitEnd)}
        />
        <span
          className="absolute inset-y-0 rounded-full bg-gray-300"
          style={seg(c.installDate, c.installDate)}
        />
        <span
          className="absolute inset-y-0 rounded-full bg-primary-500"
          style={seg(c.startDate, c.endDate)}
        />
        {todayIn && (
          <span
            title={`오늘 ${md(PREVIEW_TODAY)}`}
            className="absolute -top-[3px] h-[14px] w-[2px] -translate-x-1/2 rounded-full bg-gray-900"
            style={{ left: `${pct(PREVIEW_TODAY)}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-[11px] text-gray-500">
        <span>모집 ~{md(c.recruitEnd)}</span>
        <span>
          진행 {md(c.startDate)}~{md(c.endDate)}
        </span>
      </div>
    </div>
  );
}

function PlanCard({ c }: { c: PreviewCollab }) {
  const chip = chipOf(c);
  return (
    <LinkCard
      href={collabHref(c.id)}
      label={`${c.brand} ${c.title} ${chip.label}`}
      className="gap-[10px] p-[20px]"
    >
      <Card.Header className="flex-row items-center justify-between gap-[8px]">
        <b className="text-[13px] text-gray-500">{c.brand}</b>
        <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
      </Card.Header>
      <Card.Content className="gap-[10px]">
        <Card.Title className="text-[17px] font-bold text-gray-900">
          {c.title}
        </Card.Title>
        <Card.Description className="text-[13px] leading-[1.5] break-keep text-gray-600">
          {c.task}
        </Card.Description>
        <PeriodBar c={c} />
      </Card.Content>
      <Separator />
      <Card.Footer className="flex items-center justify-between gap-[8px] text-[13px] break-keep text-gray-600">
        {nextActionOf(c)}
        <ArrowRight className="size-[14px] shrink-0 text-gray-400" />
      </Card.Footer>
    </LinkCard>
  );
}

function Board({ tab }: { tab?: CollabCategory }) {
  const router = useRouter();
  const state = usePreviewState();
  const lists: Record<CollabCategory, PreviewCollab[]> = {
    recruiting: [],
    upcoming: [],
    ongoing: [],
    done: [],
  };
  for (const c of state.collabs) {
    const cat = categoryOf(c);
    if (cat) lists[cat].push(c);
  }
  lists.recruiting.sort(
    (a, b) =>
      Number(a.standing === "blocked") - Number(b.standing === "blocked") ||
      a.recruitEnd.localeCompare(b.recruitEnd),
  );
  lists.upcoming.sort(
    (a, b) =>
      Number(b.standing === "requested") - Number(a.standing === "requested") ||
      a.startDate.localeCompare(b.startDate),
  );
  lists.done.sort((a, b) => b.endDate.localeCompare(a.endDate));
  const segment = tab ?? (lists.recruiting.length ? "recruiting" : "ongoing");
  const held =
    lists.ongoing[0] ?? lists.upcoming.find((c) => c.standing === "confirmed");

  return (
    <div className="flex flex-col gap-[16px]">
      <PageHead
        title="콜라보"
        description="모집 중인 기획에 선착순으로 신청하고, 확정한 콜라보는 진행 안내함에서 챙겨요."
      />
      <Alert status="default" className="rounded-[18px]">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Description className="text-[13px] leading-[1.6] break-keep">
            매장 한 곳은 한 번에 콜라보 <b>1건</b>을 진행해요. 기간(설치~철수)이
            겹치는 모집에는 신청할 수 없고, 겹치지 않는 다음 콜라보는 미리
            신청할 수 있어요.
            {held && (
              <>
                {" "}
                · 지금 잡힌 콜라보: <b>{held.brand}</b> {md(held.installDate)}~
                {md(held.removalDate)}
              </>
            )}
          </Alert.Description>
        </Alert.Content>
      </Alert>
      <Tabs
        selectedKey={segment}
        onSelectionChange={(key) =>
          router.replace(`/partners/collabs?tab=${String(key)}`, {
            scroll: false,
          })
        }
      >
        <Tabs.ListContainer className="w-fit max-w-full overflow-x-auto rounded-[17px]">
          <Tabs.List aria-label="콜라보 목록">
            {SEGMENTS.map((s) => (
              <Tabs.Tab
                key={s.id}
                id={s.id}
                className="gap-[6px] rounded-[13px] whitespace-nowrap"
              >
                {s.label}
                <span className="tabular-nums opacity-60">
                  {lists[s.id].length}
                </span>
                <Tabs.Indicator className="rounded-[13px]" />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
        {SEGMENTS.map((s) => (
          <Tabs.Panel key={s.id} id={s.id} className="pt-[16px]">
            {lists[s.id].length ? (
              <div className="grid gap-[12px] md:grid-cols-2 xl:grid-cols-3">
                {lists[s.id].map((c) => (
                  <PlanCard key={c.id} c={c} />
                ))}
              </div>
            ) : (
              <EmptyBox
                icon={
                  s.id === "done" ? (
                    <CheckCircle2 className="size-[26px]" />
                  ) : s.id === "ongoing" ? (
                    <Inbox className="size-[26px]" />
                  ) : (
                    <Coffee className="size-[26px]" />
                  )
                }
              >
                {s.empty}
              </EmptyBox>
            )}
          </Tabs.Panel>
        ))}
      </Tabs>
    </div>
  );
}

export function CollabBoard({ tab }: { tab?: CollabCategory }) {
  return (
    <PartnerOnly>
      <Board tab={tab} />
    </PartnerOnly>
  );
}
