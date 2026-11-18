"use client";

import { Button, Chip } from "@heroui/react";
import { ArrowRight } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { ScheduleCalendar } from "@/app/(client)/partners/_components/advertiser/ScheduleCalendar";
import { MaskIcon } from "@/components/common/MaskIcon";
import {
  PlanCompare,
  PlanEditor,
  type PeriodEditorProps,
  type PlanFileActions,
} from "@/components/collabPlan/PlanSheet";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { useAdminPartnersStores } from "@/hooks/adminPartners";
import { adminCollabApi } from "@/hooks/adminCollab/apis";
import { useSendAdvRequestRound } from "@/hooks/adminCollab/mutations";
import { useSonner } from "@/hooks/useSonner";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import {
  advRequestStatusOf,
  dotDateTime,
  type AdminAdvCollabRequestDetail,
} from "@/lib/adminCollab";
import { averageFee, kstDate } from "@/lib/advertiserPreview";
import { extractApiError } from "@/lib/apiError";
import {
  AUTHOR_LABEL,
  calendarMonthsOf,
  changedKeys,
  compareOf,
  derivedOf,
  fieldLabel,
  fieldText,
  filesOf,
  latestRound,
  planAvgOf,
  planCalendarOf,
  planErrorsOf,
  planStoreOf,
  roundLabel,
  roundNo,
  roundPayloadOf,
  shownFields,
  type PlanContent,
  type PlanFieldKey,
  type PlanVersion,
} from "@/lib/collabPlan";
import { PREVIEW_TODAY, addDays } from "@/lib/partnersPreview";
import { cn } from "@/lib/utils";

/**
 * 종이 한 장 — 의뢰서 탭과 같은 각진 흰 종이 · 옅은 그림자(2026-11-18 사용자: "너무 동글동글 흰색 카드로 되어 있어서 별로야.
 * 의뢰서는 의뢰서처럼 깔끔하게"). 종이는 다크 모드에서도 흰색 — light 로 안쪽 회색 · 칩 색을 라이트 값으로 묶는다
 * (없으면 다크에서 흰 종이 위 글자가 옅은 회색이 돼 안 읽혔다).
 */
const PAPER =
  "light rounded-[4px] bg-white text-black shadow-[0_1px_3px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.06)]";

/** 광고주에게 보내기 아이콘 — send.svg(11-12 사용자, 의뢰 보내기 · 기획안 상세 보내기와 같은 그림). */
const SEND_ICON = "/icons/proposal-detail/send.svg";

/**
 * 보내기 확인 창 — 고친 항목마다 카드 하나: 위에 항목 이름, 아래에 지금 → 수정 두 칸(2026-11-12 사용자: "내가 수정한 부분을 깔끔하게").
 * 11-18 사용자: 테두리 칸 + 회색 머리(표 모양)는 "별로야.. 카드형식으로" → 옅은 회색 카드 안에 흰 칸 두 개, 창도 넓게(wide, 600px).
 * 긴 글은 세 줄까지, 추가 기획은 글이 바뀐 때만 글을, 첨부는 더한 · 뺀 파일 이름을 카드 아래에 따로 적는다.
 */
function ChangeSummary({
  keys,
  before,
  after,
}: {
  keys: PlanFieldKey[];
  before: PlanContent;
  after: PlanContent;
}) {
  const partsOf = (k: PlanFieldKey) => {
    if (k !== "extraPlan")
      return { pair: { b: fieldText(before, k), a: fieldText(after, k) }, files: [] as string[] };
    const b = (before.extraPlan ?? "").trim();
    const a = (after.extraPlan ?? "").trim();
    const ids = (c: PlanContent) => new Set(filesOf(c).map((f) => f.id));
    const added = filesOf(after).filter((f) => !ids(before).has(f.id));
    const removed = filesOf(before).filter((f) => !ids(after).has(f.id));
    return {
      pair: b !== a ? { b: b || "-", a: a || "-" } : null,
      files: [
        ...(added.length ? [`${added.map((f) => f.name).join(", ")} 더함`] : []),
        ...(removed.length ? [`${removed.map((f) => f.name).join(", ")} 뺌`] : []),
      ],
    };
  };
  return (
    <ul className="-mx-[2px] flex max-h-[min(62dvh,560px)] flex-col gap-[10px] overflow-y-auto px-[2px] whitespace-normal">
      {keys.map((k) => {
        const { pair, files } = partsOf(k);
        return (
          <li key={k} className="flex shrink-0 flex-col gap-[10px] rounded-[16px] bg-gray-50 p-[14px]">
            <p className="text-sm font-bold text-black">{fieldLabel(k)}</p>
            {pair && (
              <div className="grid gap-[6px] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-stretch">
                <div className="flex flex-col gap-[2px] rounded-[12px] bg-surface px-[12px] py-[10px]">
                  <span className="text-xs text-disabled">지금</span>
                  <span className="line-clamp-3 text-sm leading-[20px] break-keep text-gray-500">{pair.b}</span>
                </div>
                <ArrowRight aria-hidden className="hidden size-[14px] self-center text-gray-400 sm:block" />
                <div className="flex flex-col gap-[2px] rounded-[12px] bg-surface px-[12px] py-[10px]">
                  <span className="text-xs font-semibold text-primary-700">수정</span>
                  <span className="line-clamp-3 text-sm leading-[20px] font-semibold break-keep text-gray-900">
                    {pair.a}
                  </span>
                </div>
              </div>
            )}
            {files.map((f) => (
              <p key={f} className="flex items-baseline gap-[6px] text-xs leading-[18px]">
                <span className="shrink-0 font-semibold text-primary-700">첨부</span>
                <span className="min-w-0 break-all text-gray-700">{f}</span>
              </p>
            ))}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * 어드민 콜라보 의뢰 → 기획안(085, 2026-11-12 사용자) — 광고주 의뢰서를 항목별로 고쳐 광고주에게 보낸다.
 * 광고주가 다시 고쳐 보내면 수정 전(admix가 보낸 차수) · 후(광고주 차수)를 나란히 보고, 또 고쳐 보낸다. 확정은 광고주가.
 * 바꾼 항목이 없어도 보낼 수 있다(이대로 진행해도 된다는 기획안). 광고주 확인을 기다리는 중에도 다시 고쳐 보낼 수 있다.
 */
export function CollabPlanView({ doc }: { doc: AdminAdvCollabRequestDetail }) {
  const send = useSendAdvRequestRound();
  const { success, error } = useSonner();
  const { confirm, confirmDialog } = useAdminConfirm();
  // 지정 희망 매장 넣기 — 공개 매장만(광고주 매장 찾기와 같은 매장).
  const stores = useAdminPartnersStores({ status: "active", page_size: 100 });
  const options = useMemo(
    () => (stores.data?.items ?? []).map(planStoreOf),
    [stores.data],
  );

  // 추가 기획 첨부(11-12) — 광고주 의뢰서 첨부("request") · admix가 기획안에 붙인 파일. 고칠 때 파일 첨부 · 빼기.
  const fileActions: PlanFileActions = {
    load: (f) => adminCollabApi.advRequestPlanFile(doc.id, f.id),
    onError: (err) => error("첨부 파일을 열지 못했어요", extractApiError(err)),
  };
  const uploadFile = (file: File) =>
    adminCollabApi.uploadAdvRequestPlanFile(doc.id, file);

  const cmp = compareOf(doc, doc.createdAt);
  const latest = cmp.after;
  const avg = planAvgOf(doc, averageFee(options));
  const status = advRequestStatusOf(doc.status);
  const closed = doc.status === "cancelled" || doc.status === "confirmed";

  const [draft, setDraft] = useState<PlanContent | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Partial<Record<PlanFieldKey, string>>>(
    {},
  );
  const editing = draft !== null;
  // 예상 일정 달력(11-17 사용자: "광고주의 예상 일정처럼 아래에 캘린더로") — 고치는 중이면 고친 내용으로 다시 계산한 일정,
  // 아니면 마지막 차수에 적힌 일정. "의뢰"는 광고주가 처음 의뢰한 날.
  const requestDate = kstDate(doc.createdAt);
  const calendar = draft
    ? planCalendarOf(draft, derivedOf(draft, avg).schedule)
    : planCalendarOf(latest.content);
  const changed = draft ? changedKeys(latest.content, draft) : [];
  const dirty =
    editing &&
    (changed.length > 0 || Object.values(notes).some((v) => v.trim()));

  const { confirm: confirmLeave, confirmDialog: leaveDialog } =
    useAdminConfirm();
  useUnsavedChangesGuard(
    dirty,
    () =>
      confirmLeave({
        title: "고치던 기획안이 있어요",
        description: "지금 나가면 고친 내용이 사라져요. 그래도 나갈까요?",
        cancelText: "계속 고치기",
        confirmText: "나가기",
      }),
    { interceptLinks: true },
  );

  const start = () => {
    setDraft(structuredClone(latest.content));
    setNotes({});
    setErrors({});
  };
  const stop = async () => {
    if (dirty) {
      const ok = await confirm({
        title: "고친 내용을 버릴까요?",
        description: "고친 항목과 적은 수정 이유가 사라져요.",
        confirmText: "버리기",
        cancelText: "계속 고치기",
      });
      if (!ok) return;
    }
    setDraft(null);
  };

  const submit = async () => {
    if (!draft) return;
    const e = planErrorsOf(draft, latest.content);
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) {
      error(
        "고칠 항목을 확인해 주세요",
        `${fieldLabel(first)} — ${e[first as PlanFieldKey]}`,
      );
      return;
    }
    const n = changed.length;
    const ok = await confirm({
      title: n
        ? `${n}개 항목을 고쳐 광고주에게 보낼까요?`
        : "바꾼 항목 없이 보낼까요?",
      description: n ? (
        <ChangeSummary keys={changed} before={latest.content} after={draft} />
      ) : (
        "의뢰 내용 그대로 진행해도 된다는 기획안이에요. 광고주가 바로 확정할 수 있어요."
      ),
      confirmText: "보내기",
      wide: n > 0,
    });
    if (!ok) return;
    try {
      // 그사이 광고주가 보낸 차수가 있으면 서버가 409 로 막는다(펼쳐 둔 차수 baseRound).
      await send.mutateAsync({
        id: doc.id,
        payload: roundPayloadOf(draft, notes, latestRound(doc), avg),
      });
      setDraft(null);
      success("기획안을 광고주에게 보냈어요.");
    } catch (err) {
      error("기획안을 보내지 못했어요", extractApiError(err));
    }
  };

  const lastAt = latest.createdAt ? dotDateTime(latest.createdAt) : "";
  // 지금 상황 문장("2차 · admix 기획안을 보냈어요 …")은 뺐다(11-18 사용자: "이런 문구는 없애도 될 듯") — 상태 칩 · 차수 기록으로 본다.
  const startText =
    doc.status === "proposed"
      ? "다시 고쳐 보내기"
      : doc.rounds.length
        ? "항목별로 고치기"
        : "기획안 만들기";

  // 진행 기간 고치기 — 의뢰서처럼 일정 달력에서 시작일 → 끝날을 눌러 고른다(2026-11-18 사용자). 고르면 모집 · 준비 · 설치 · 철수까지
  // 고친 내용으로 다시 칠한다. 고를 수 있는 날은 내일부터, 최소 3일(기획안 검사와 같다). 모집 코스는 따로 고른다.
  // 고른 기간 글은 PlanEditor 가 "진행 기간" 이름표 오른쪽에 적는다.
  const periodCalendar = (p: PeriodEditorProps) => (
    <ScheduleCalendar
      s={calendar?.s ?? null}
      requestDate={requestDate}
      prepLabel={calendar?.prepLabel}
      months={3}
      select={{
        start: p.start,
        end: p.end,
        min: addDays(PREVIEW_TODAY, 1),
        minDays: 3,
        onChange: p.onChange,
      }}
    />
  );

  // 종이 머리 — 제목 · 오른쪽 차수 정보(의뢰서 탭 머리와 같은 이름 | 값).
  const head = editing
    ? {
        title: "항목별로 고치기",
        meta: [
          ["고치는 차수", roundLabel(latest)],
          ["수정", `${changed.length}개 항목`],
        ],
      }
    : {
        // 서류 이름으로(11-18 사용자: "수정 전 · 후" 타이틀 바꿔줘) — 차수 기록과 같은 "2차 기획안".
        title: docNameOf(latest),
        meta: [
          ...(cmp.before
            ? [["비교", `${roundLabel(cmp.before)} → ${roundLabel(latest)}`]]
            : []),
          // 광고주가 보낸 차수면 어느 광고주인지 브랜드명으로(2026-11-18 사용자: "어떤 광고주인지, 브랜드명이 나와야지!")
          [
            "보낸 쪽",
            latest.author === "advertiser"
              ? doc.brandName || AUTHOR_LABEL.advertiser
              : AUTHOR_LABEL[latest.author],
          ],
          ["보낸 때", lastAt || "-"],
        ],
      };

  return (
    <div className="flex flex-col gap-[16px] md:gap-[20px]">
      {/* 지금 상황 — 카드 없이 한 줄 · 아래 선 */}
      <div className="flex flex-wrap items-center gap-[10px] border-b border-gray-200 pb-[14px]">
        <Chip size="sm" variant="soft" color={status.color}>
          {status.label}
        </Chip>
        {!closed && !editing && (
          <Button
            className="ml-auto"
            size="sm"
            variant={doc.status === "proposed" ? "tertiary" : "primary"}
            onPress={start}
          >
            {startText}
          </Button>
        )}
      </div>

      {/* 차수 기록 — 오른쪽 칸 대신 종이 위 가로 띠로(11-18 사용자: "다른 데에 배치하고, 문서가 더 크게").
          고치는 동안엔 뺀다(같은 날: "수정 단계에서는 차수 기록 안 뜨게"). */}
      {!editing && (
        <RoundHistory
          versions={cmp.versions}
          confirmedAt={doc.status === "confirmed" ? doc.confirmedAt : null}
        />
      )}

      <div className="flex flex-col">
        <article
          className={cn(
            PAPER,
            "flex min-w-0 flex-col gap-[28px] px-[20px] py-[24px] md:gap-[36px] md:px-[40px] md:py-[36px]",
          )}
        >
          <section className="flex flex-col gap-[16px]">
            <header className="flex flex-wrap items-end justify-between gap-x-[16px] gap-y-[8px]">
              <h2 className="text-xl font-extrabold md:text-2xl">
                {head.title}
              </h2>
              <dl className="grid grid-cols-[auto_auto] gap-x-[12px] gap-y-[2px] text-xs text-tone-4a5565">
                {head.meta.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt>{k}</dt>
                    <dd className="text-right font-semibold text-black">{v}</dd>
                  </div>
                ))}
              </dl>
            </header>

            {editing && draft ? (
              <>
                <PlanEditor
                  base={latest.content}
                  draft={draft}
                  onDraft={(next) => {
                    setDraft(next);
                    if (Object.keys(errors).length)
                      setErrors(planErrorsOf(next, latest.content));
                  }}
                  notes={notes}
                  onNotes={setNotes}
                  errors={errors}
                  storeOptions={options}
                  avg={avg}
                  fileActions={fileActions}
                  onUploadFile={uploadFile}
                  renderPeriod={periodCalendar}
                />
                <div className="flex flex-wrap items-center justify-end gap-[8px]">
                  <Button
                    variant="tertiary"
                    onPress={stop}
                    isDisabled={send.isPending}
                  >
                    취소
                  </Button>
                  <Button
                    variant="primary"
                    onPress={submit}
                    isPending={send.isPending}
                  >
                    <MaskIcon src={SEND_ICON} className="size-[16px]" />
                    광고주에게 보내기
                  </Button>
                </div>
              </>
            ) : (
              <PlanCompare
                look="doc"
                before={cmp.before}
                after={latest}
                notes={cmp.notes}
                beforeLabel={cmp.before ? roundLabel(cmp.before) : undefined}
                afterLabel={roundLabel(latest)}
                fileActions={fileActions}
                storeHref={(s) => `/admin/collab/stores/${s.id}`}
              />
            )}
          </section>
        </article>
      </div>

      {/* 예상 일정 — 종이 · 차수 기록 아래 화면 폭 전체(11-18 사용자: "3달로 되면 깨지네" — 종이 안에선 석 달이 찌그러졌다).
          고치는 동안엔 진행 기간 칸의 달력이 예상 일정까지 보여 줘서 뺀다. */}
      {calendar && !editing && (
        <section
          className={cn(
            PAPER,
            "flex flex-col gap-[12px] px-[20px] py-[24px] md:px-[40px] md:py-[32px]",
          )}
        >
          <h3 className="border-b-2 border-black pb-[10px] text-base font-extrabold md:text-lg">
            예상 일정
          </h3>
          <ScheduleCalendar
            s={calendar.s}
            requestDate={requestDate}
            prepLabel={calendar.prepLabel}
            months={calendarMonthsOf(calendar.s, requestDate)}
          />
        </section>
      )}
      {confirmDialog}
      {leaveDialog}
    </div>
  );
}

/** 차수의 서류 이름 — 처음(0차)은 광고주 의뢰서, 그 뒤는 기획안. "1차 의뢰서" · "2차 기획안". */
const docNameOf = (v: PlanVersion) =>
  `${roundNo(v.round)}차 ${v.round === 0 ? "의뢰서" : "기획안"}`;

/**
 * 차수 기록 — 왼쪽 남색 머리 칸 + 가로 타임라인(2026-11-18 사용자: "조금은 무게감 있게" → "다른 데에 배치하고, 문서가 더 크게").
 * 차수마다 점 · 이름 · 보낸 쪽 · 일시 · 바꾼 항목, 점끼리 선으로 잇는다. 마지막 차수는 진한 점, 광고주가 확정했으면 맨 끝에 "확정".
 * 차수가 많아 넘치면 옆으로 밀어 본다. 휴대폰은 머리 칸이 위로.
 */
function RoundHistory({
  versions,
  confirmedAt,
}: {
  versions: PlanVersion[];
  confirmedAt: string | null | undefined;
}) {
  const last = versions.length - 1;
  return (
    <section className={cn(PAPER, "flex flex-col overflow-hidden md:flex-row")}>
      <div className="flex shrink-0 items-baseline justify-between gap-[8px] bg-admin-nav px-[18px] py-[14px] text-white md:w-[140px] md:flex-col md:justify-center md:gap-[4px]">
        <h2 className="text-base font-bold">차수 기록</h2>
        <span className="text-xs text-white/60">
          {roundNo(versions[last]?.round ?? 0)}차까지
        </span>
      </div>
      <ol className="flex min-w-0 flex-1 overflow-x-auto px-[20px] py-[18px]">
        {versions.map((v, i) => {
          const isLast = i === last && !confirmedAt;
          const prev = versions
            .slice(0, i)
            .reverse()
            .find((x) => x.author !== v.author);
          const changed = prev ? changedKeys(prev.content, v.content) : [];
          const labelOf = (k: PlanFieldKey) =>
            shownFields(v.content).find((f) => f.key === k)?.label ?? k;
          return (
            <TimelineItem
              key={v.round}
              dot={isLast ? "current" : "past"}
              hasNext={i < last || !!confirmedAt}
            >
              <div className="flex flex-wrap items-center gap-x-[6px] gap-y-[2px]">
                <span
                  className={cn(
                    "text-sm font-bold",
                    isLast ? "text-black" : "text-gray-700",
                  )}
                >
                  {docNameOf(v)}
                </span>
                <Chip
                  size="sm"
                  variant="soft"
                  color={v.author === "admix" ? "accent" : "default"}
                >
                  {AUTHOR_LABEL[v.author]}
                </Chip>
              </div>
              {v.createdAt && (
                <span className="text-xs text-disabled">
                  {dotDateTime(v.createdAt)}
                </span>
              )}
              {v.round > 0 &&
                (changed.length ? (
                  <ul className="mt-[4px] flex flex-wrap gap-[4px]">
                    {changed.map((k) => (
                      <li
                        key={k}
                        className="rounded-[4px] bg-gray-100 px-[6px] py-[2px] text-xs text-gray-700"
                      >
                        {labelOf(k)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-xs text-gray-600">
                    바꾼 항목 없이 보냄
                  </span>
                ))}
            </TimelineItem>
          );
        })}
        {confirmedAt && (
          <TimelineItem dot="done" hasNext={false}>
            <span className="text-sm font-bold text-black">광고주 확정</span>
            <span className="text-xs text-disabled">
              {dotDateTime(confirmedAt)}
            </span>
          </TimelineItem>
        )}
      </ol>
    </section>
  );
}

/** 타임라인 한 칸 — 위에 점 · 다음 칸 점까지 이어지는 선, 아래에 내용. */
function TimelineItem({
  dot,
  hasNext,
  children,
}: {
  dot: "past" | "current" | "done";
  hasNext: boolean;
  children: ReactNode;
}) {
  return (
    <li className="relative flex w-[240px] shrink-0 flex-col gap-[10px] pr-[24px]">
      {hasNext && (
        <span
          aria-hidden
          className="absolute top-[6px] right-[6px] left-[24px] h-[2px] bg-gray-200"
        />
      )}
      <span
        aria-hidden
        className={cn(
          "relative ml-[2px] size-[14px] shrink-0 rounded-full",
          dot === "past" && "border-2 border-gray-300 bg-white",
          dot === "current" && "bg-admin-nav ring-4 ring-gray-200",
          dot === "done" && "bg-primary ring-4 ring-primary-100",
        )}
      />
      <div className="flex min-w-0 flex-col gap-[2px]">{children}</div>
    </li>
  );
}
