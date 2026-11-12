"use client";

import { Button, Chip, Tabs } from "@heroui/react";
import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useMemo, useState } from "react";

import { AdminPanel } from "@/components/admin/AdminPanel";
import { LoadingState } from "@/components/common/RouteStates";
import { useAdminCollabProgress } from "@/hooks/adminCollab";
import {
  type AdminCollabProgress,
  COLLAB_TYPE_LABEL,
  ITEM_PREP_LABEL,
  shortDate,
} from "@/lib/adminCollab";
import { isOptimizable, mediaSrc } from "@/lib/media";
import { COLLAB_PHASE_LABEL, type CollabPhase } from "@/lib/partners";
import { todayKst } from "@/lib/partnersPreview";

import { CollabPageHead, PhaseChip } from "../../_components/collabUi";

/** 진행 화면에 오는 단계 — 탭 순서(지금 돌아가는 것부터). 완료 · 취소는 콜라보 결과. */
const PHASES: CollabPhase[] = [
  "running",
  "selecting",
  "recruiting",
  "scheduled",
  "draft",
];
type Tab = "all" | CollabPhase;

const dayDiff = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
const dLabel = (n: number) => (n === 0 ? "오늘" : n > 0 ? `D-${n}` : `D+${-n}`);

/** 지금 하는 일 — 단계와 날짜로 한 줄. */
function nowText(c: AdminCollabProgress, today: string): string {
  const applied = c.counts.applied + c.counts.requested + c.counts.confirmed;
  switch (c.phase) {
    case "draft":
      return "비공개예요. 내용을 확인하고 공개로 바꾸면 모집 기간에 제휴사 화면에 보여요.";
    case "scheduled":
      return `모집 전이에요. ${shortDate(c.recruitStart)}부터 제휴사 화면에서 신청을 받아요.`;
    case "recruiting":
      return `매장 신청을 받고 있어요. 신청 ${applied}곳 / 목표 ${c.targetStores}곳.`;
    case "selecting":
      return `매장을 고르고 확정을 받는 중이에요. 확정 ${c.counts.confirmed}곳 / 목표 ${c.targetStores}곳.`;
    case "running":
      if (today < c.startDate)
        return `매장에 설치하는 기간이에요. ${shortDate(c.startDate)}에 콜라보가 시작돼요.`;
      if (today <= c.endDate)
        return `콜라보 ${dayDiff(c.startDate, today) + 1}일차예요(전체 ${dayDiff(c.startDate, c.endDate) + 1}일). 매장이 점검 사진을 올려요.`;
      return `콜라보가 끝났어요. ${shortDate(c.removalDate)}에 철수하고 남은 물품을 회수해요.`;
    default:
      return "";
  }
}

/** 손이 가야 하는 것 — 0이면 뺀다. */
function todosOf(c: AdminCollabProgress, today: string): string[] {
  const p = c.progress;
  const confirmed = c.counts.confirmed;
  const out: string[] = [];
  if (c.counts.requested > 0)
    out.push(`매장 확정 대기 ${c.counts.requested}곳`);
  if (today >= c.installDate && confirmed > p.installed)
    out.push(`설치 사진 없음 ${confirmed - p.installed}곳`);
  if (p.photoDue > 0) out.push(`점검 사진 늦음 ${p.photoDue}곳`);
  if (p.restock > 0) out.push(`재입고 요청 ${p.restock}곳`);
  return out;
}

/**
 * 콜라보 진행(어드민 "콜라보 관리 → 콜라보 진행", 2026-11-12 사용자) — 끝나지 않은 콜라보를 보면서
 * 뭘 준비해야 하는지(맨 위 "admix가 만들 것" + 콜라보마다 준비할 것) · 지금 뭘 하고 있는지 본다.
 * 다음 일정이 가까운 순. 끝난(완료 · 취소) 콜라보는 콜라보 결과로 옮겨 간다.
 */
export function CollabProgressView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, isLoading } = useAdminCollabProgress();
  const [tab, setTab] = useState<Tab>(() => {
    const p = searchParams.get("phase") as CollabPhase | null;
    return p && PHASES.includes(p) ? p : "all";
  });
  const today = todayKst();
  const rows = useMemo(() => data ?? [], [data]);
  const countOf = (t: Tab) =>
    t === "all" ? rows.length : rows.filter((c) => c.phase === t).length;
  const shown = tab === "all" ? rows : rows.filter((c) => c.phase === tab);

  return (
    <div className="flex flex-col gap-[20px] md:gap-[24px]">
      <CollabPageHead
        title="콜라보 진행"
        desc="끝나지 않은 콜라보예요. 다음 일정이 가까운 순서로 보여요. 끝난 콜라보는 콜라보 결과에 모여요."
      >
        <Button
          variant="primary"
          size="sm"
          onPress={() => router.push("/admin/collab/collabs/new")}
        >
          새 콜라보
        </Button>
      </CollabPageHead>

      {isLoading ? (
        <LoadingState />
      ) : (
        <>
          <AdmixMakes rows={rows} today={today} />

          <Tabs
            selectedKey={tab}
            onSelectionChange={(key) => setTab(key as Tab)}
          >
            <Tabs.ListContainer className="w-fit max-w-full overflow-x-auto">
              <Tabs.List aria-label="단계">
                {(["all", ...PHASES] as Tab[]).map((t) => (
                  <Tabs.Tab
                    key={t}
                    id={t}
                    className="gap-[4px] px-[12px] whitespace-nowrap"
                  >
                    {t === "all" ? "전체" : COLLAB_PHASE_LABEL[t]}
                    <span className="text-disabled">{countOf(t)}</span>
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>

          {shown.length ? (
            <div className="grid grid-cols-1 gap-[16px] xl:grid-cols-2">
              {shown.map((c) => (
                <ProgressCard key={c.id} c={c} today={today} />
              ))}
            </div>
          ) : (
            <AdminPanel>
              <p className="py-[32px] text-center text-sm text-disabled">
                {tab === "all"
                  ? "진행 중인 콜라보가 없어요. 오른쪽 위 '새 콜라보'로 만들 수 있어요."
                  : `${COLLAB_PHASE_LABEL[tab]} 콜라보가 없어요.`}
              </p>
            </AdminPanel>
          )}
        </>
      )}
    </div>
  );
}

/**
 * admix가 만들 것 — 진행 항목 중 준비 주체가 "admix 제작"인 것만 모아 설치일 순으로.
 * 설치 전까지 매장 수만큼 만들어야 해서 매장당 수량 · 확정(또는 목표) 매장 수를 같이 보인다.
 */
function AdmixMakes({
  rows,
  today,
}: {
  rows: AdminCollabProgress[];
  today: string;
}) {
  const makes = rows
    .flatMap((c) =>
      c.items.filter((it) => it.prep === "admix").map((it) => ({ c, it })),
    )
    .sort((a, b) => a.c.installDate.localeCompare(b.c.installDate));

  return (
    <AdminPanel
      title="admix가 만들 것"
      desc={makes.length ? `${makes.length}건 · 설치일 순` : undefined}
    >
      {makes.length ? (
        <ul className="flex flex-col">
          {makes.map(({ c, it }, i) => {
            const d = dayDiff(today, c.installDate);
            // 확정 매장이 생기면 그 수로, 아직이면 목표 매장 수로 만든다.
            const stores = c.counts.confirmed || c.targetStores;
            return (
              <li
                key={`${c.id}-${it.label}`}
                className={
                  i ? "border-t border-gray-100 py-[12px]" : "pb-[12px]"
                }
              >
                <Link
                  href={`/admin/collab/collabs/${c.id}`}
                  className="flex flex-wrap items-center justify-between gap-x-[16px] gap-y-[4px]"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold text-black">
                      {it.label}
                      {it.note && (
                        <span className="font-normal text-tone-4a5565">
                          {" "}
                          — {it.note}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-disabled">
                      {c.brandName} · {c.title}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end text-xs">
                    <span className="text-black">
                      {c.quantity
                        ? `매장당 ${c.quantity.toLocaleString()}개 × ${stores}곳`
                        : `${stores}곳`}
                      <span className="text-disabled">
                        {c.counts.confirmed ? " (확정)" : " (목표)"}
                      </span>
                    </span>
                    <span className="text-disabled">
                      설치 {shortDate(c.installDate)} 전까지 ·{" "}
                      <span className={d <= 3 ? "text-black" : undefined}>
                        {dLabel(d)}
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-disabled">
          admix가 만들 항목이 없어요. 콜라보 수정 → 진행 항목에서 누가
          준비하는지를 &apos;admix 제작&apos;으로 고르면 여기에 모여요.
        </p>
      )}
    </AdminPanel>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[72px_1fr] gap-[12px] text-sm">
      <dt className="text-disabled">{label}</dt>
      <dd className="min-w-0 text-black">{children}</dd>
    </div>
  );
}

/** 콜라보 한 장 — 다음 일정 · 지금 하는 일 · 매장 수 · 손이 가야 하는 것 · 준비할 것. */
function ProgressCard({ c, today }: { c: AdminCollabProgress; today: string }) {
  const p = c.progress;
  const brandSrc = c.brandImageUrl ? mediaSrc(c.brandImageUrl) : null;
  const todos = todosOf(c, today);
  // admix 제작 → 브랜드 제작 → 브랜드 보유 → 미정 순.
  const order = { admix: 0, made: 1, ready: 2 } as const;
  const items = [...c.items].sort(
    (a, b) => (a.prep ? order[a.prep] : 3) - (b.prep ? order[b.prep] : 3),
  );
  const showPhotos = today >= c.installDate && c.counts.confirmed > 0;

  return (
    <AdminPanel contentClassName="gap-[16px]">
      <Link
        href={`/admin/collab/collabs/${c.id}`}
        className="group flex items-center gap-[12px]"
      >
        <span className="relative size-[44px] shrink-0 overflow-hidden rounded-[10px] bg-zinc-100">
          {brandSrc && (
            <Image
              src={brandSrc}
              alt=""
              fill
              sizes="44px"
              unoptimized={!isOptimizable(brandSrc)}
              className="object-cover"
            />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs text-disabled">
            {c.brandName} · {COLLAB_TYPE_LABEL[c.type] ?? c.type}
          </span>
          <span className="truncate text-[15px] font-bold text-black group-hover:underline">
            {c.title}
          </span>
        </span>
        <PhaseChip phase={c.phase} />
        <ChevronRight className="size-[16px] shrink-0 text-disabled" />
      </Link>

      <dl className="flex flex-col gap-[8px]">
        <Row label="다음 일정">
          {p.nextDate ? (
            <>
              {p.nextLabel} · {shortDate(p.nextDate)}{" "}
              <span className="text-disabled">
                {dLabel(dayDiff(today, p.nextDate))}
              </span>
            </>
          ) : (
            "-"
          )}
        </Row>
        <Row label="지금">{nowText(c, today)}</Row>
        <Row label="매장">
          신청 {c.counts.applied} · 확정 요청 {c.counts.requested} · 확정{" "}
          {c.counts.confirmed}
          <span className="text-disabled"> / 목표 {c.targetStores}곳</span>
          {showPhotos && (
            <span className="text-disabled">
              {" "}
              · 설치 사진 {p.installed}/{c.counts.confirmed}
            </span>
          )}
        </Row>
        {/* 매장 응답(11-12) — 새 콜라보마다 참여 / 미참여를 묻는다. 모집 중엔 아직 답 안 한 수, 끝나면 무응답. */}
        {c.phase !== "draft" && c.phase !== "scheduled" && (
          <Row label="응답">
            참여 {p.responses.joined} · 미참여 {p.responses.passed}
            <span className="text-disabled">
              {c.phase === "recruiting"
                ? ` · 아직 ${p.responses.waiting}`
                : ` · 무응답 ${p.responses.silent}`}
            </span>
          </Row>
        )}
        <Row label="준비할 것">
          {items.length ? (
            <ul className="flex flex-col gap-[4px]">
              {items.map((it) => (
                <li key={it.label} className="flex items-baseline gap-[6px]">
                  <Chip
                    size="sm"
                    variant="soft"
                    color={it.prep === "admix" ? "accent" : "default"}
                    className="shrink-0"
                  >
                    {it.prep ? ITEM_PREP_LABEL[it.prep] : "미정"}
                  </Chip>
                  <span className="min-w-0">
                    {it.label}
                    {it.note && (
                      <span className="text-disabled"> — {it.note}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-disabled">진행 항목이 없어요.</span>
          )}
        </Row>
      </dl>

      {todos.length > 0 && (
        <div className="flex flex-wrap gap-[6px]">
          {todos.map((t) => (
            <Chip key={t} size="sm" variant="soft" color="warning">
              {t}
            </Chip>
          ))}
        </div>
      )}
    </AdminPanel>
  );
}
