"use client";

import { Button, Card } from "@heroui/react";
import { useMemo, useState } from "react";

import { MaskIcon } from "@/components/common/MaskIcon";
import {
  PlanCompare,
  PlanEditor,
  type PeriodEditorProps,
  type PlanFileActions,
} from "@/components/collabPlan/PlanSheet";
import { partnersApi, usePartnersStores } from "@/hooks/partners";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import {
  averageFee,
  earliestRequestStart,
  kstDate,
  PREVIEW_TODAY,
  type AdvCollab,
} from "@/lib/advertiserPreview";
import { extractApiError } from "@/lib/apiError";
import {
  changedKeys,
  compareOf,
  derivedOf,
  fieldLabel,
  latestRound,
  planAvgOf,
  planCalendarOf,
  planErrorsOf,
  planStoreOf,
  roundLabel,
  roundNo,
  roundPayloadOf,
  type PlanBlock,
  type PlanContent,
  type PlanFieldKey,
  type PlanStore,
  type PlanVersion,
} from "@/lib/collabPlan";
import { kstStamp } from "@/lib/partnersPreview";
import { cn } from "@/lib/utils";

import { PanelCard } from "../workspace/workspaceUi";
import { useRememberSentRequest } from "./advStore";
import { ConfirmModal, say } from "./advUi";
import { PlanStoreDetail } from "./PlanStoreModal";
import { ScheduleCalendar } from "./ScheduleCalendar";

const CARD = "gap-[14px] bg-surface p-[18px] backdrop-blur-none sm:p-[24px]";
/** 보내기 아이콘 — 의뢰 보내기 · 어드민 기획안 보내기와 같은 종이비행기(11-18 사용자 "send.svg로"). */
const SEND_ICON = "/icons/proposal-detail/send.svg";

/**
 * "기획안" 탭(085, 2026-11-12 사용자) — admix가 보낸 기획안을 수정 전 · 후로 나란히 보고, 이대로 확정하거나
 * 항목을 직접 고쳐 다시 보낸다(admix와 같은 방식, 항목마다 수정 이유). 몇 차례든 오갈 수 있다.
 */
export function AdvPlanReview({
  c,
  block,
}: {
  c: AdvCollab;
  block: PlanBlock;
}) {
  const requestId = c.requestId!;
  // 추가 기획 첨부(11-12) — admix 가 기획안에 붙인 파일 · 내 의뢰서 첨부를 받아 본다(기획안에서 첨부를 바꾸지는 않는다).
  const fileActions: PlanFileActions = {
    load: (f) => partnersApi.collabRequestPlanFile(requestId, f.id),
    onError: (err) => say(extractApiError(err) || "첨부 파일을 열지 못했어요."),
  };
  const rememberSent = useRememberSentRequest();
  const stores = usePartnersStores({});
  const options = useMemo(
    () => (stores.data ?? []).map(planStoreOf),
    [stores.data],
  );

  const cmp = compareOf(block, c.originalAt);
  const latest = cmp.after;
  const avg = planAvgOf(block, averageFee(options));
  const myTurn = c.requestStatus === "proposed";
  const confirmed = c.requestStatus === "confirmed";

  const [draft, setDraft] = useState<PlanContent | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Partial<Record<PlanFieldKey, string>>>(
    {},
  );
  const [dialog, setDialog] = useState<"send" | "confirm" | "discard" | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  // 지정 희망 매장 상세 팝업(11-13, 11-18 매장 찾기와 같은 상세 팝업으로) — 누른 매장, 닫으면 null.
  const [storeView, setStoreView] = useState<PlanStore | null>(null);
  const editing = draft !== null;
  const changed = draft ? changedKeys(latest.content, draft) : [];
  const dirty =
    editing &&
    (changed.length > 0 || Object.values(notes).some((v) => v.trim()));

  const [leaving, setLeaving] = useState<((ok: boolean) => void) | null>(null);
  useUnsavedChangesGuard(
    dirty,
    () => new Promise<boolean>((resolve) => setLeaving(() => resolve)),
    { interceptLinks: true },
  );
  const answerLeave = (ok: boolean) => {
    leaving?.(ok);
    setLeaving(null);
  };

  const start = () => {
    setDraft(structuredClone(latest.content));
    setNotes({});
    setErrors({});
  };
  const askSend = () => {
    if (!draft) return;
    const e = planErrorsOf(draft, latest.content);
    setErrors(e);
    const first = Object.keys(e)[0] as PlanFieldKey | undefined;
    if (first) return say(`${fieldLabel(first)} — ${e[first]}`);
    if (!changed.length)
      return say("바꾼 항목이 없어요. 그대로 괜찮으면 확정해 주세요.");
    setDialog("send");
  };

  const send = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      // 그사이 admix가 다시 보낸 차수가 있으면 서버가 409 로 막는다(펼쳐 둔 차수 baseRound).
      rememberSent(
        await partnersApi.sendCollabRequestRound(
          requestId,
          roundPayloadOf(draft, notes, latestRound(block), avg),
        ),
      );
      setDraft(null);
      setDialog(null);
      say("고친 기획안을 admix에 보냈어요. admix가 확인하고 다시 알려 드려요.");
    } catch (err) {
      say(
        extractApiError(err) ||
          "기획안을 보내지 못했어요. 잠시 뒤 다시 해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    setBusy(true);
    try {
      rememberSent(
        await partnersApi.confirmCollabRequest(requestId, latestRound(block)),
      );
      setDialog(null);
      say("기획안을 확정했어요. admix가 이 내용으로 콜라보를 준비해요.");
    } catch (err) {
      say(extractApiError(err) || "확정하지 못했어요. 잠시 뒤 다시 해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  // 머리 — 제목 오른쪽에 일시만(11-18 사용자: 안내 글은 빼고 "일시만 뜨게 해주고, 타이틀 우측에").
  // 광고주 차례면 제목은 "n차 기획안"만(같은 날 "타이틀을 2차 기획안이라고만"). 지금 상황 설명은 위 상태 칸 · 아래 띠가 한다.
  const at = latest.createdAt ? kstStamp(latest.createdAt) : "";
  const head = confirmed
    ? {
        title: `${roundNo(latest.round)}차 기획안으로 확정했어요`,
        at: block.confirmedAt ? kstStamp(block.confirmedAt) : at,
      }
    : myTurn
      ? { title: `${roundNo(latest.round)}차 기획안`, at }
      : { title: "고친 기획안을 admix가 검토하고 있어요", at };

  // 진행 기간 고치기 — 의뢰서처럼 예상 일정 달력에서 시작일 → 끝날을 눌러 고른다(2026-11-18 사용자: "의뢰서의 캘린더와 동일하게").
  // 고르면 모집 · 준비 · 설치 · 철수 · 중간 보고까지 고친 내용으로 다시 칠한다. 최소 3일(기획안 검사와 같다).
  // 고를 수 있는 첫날도 의뢰서와 같게(11-18 사용자 "응") — 오늘 보내도 admix 검토 · 모집 · 확정 · 준비 · 설치를 최소로 마친 다음 날부터,
  // 그 전 날은 툴팁으로 이유. 지금 기간이 그보다 이르면 그대로 둘 수는 있다(안 바꾼 기간은 검사하지 않는다).
  const calendar = draft ? planCalendarOf(draft, derivedOf(draft, avg).schedule) : null;
  const periodCalendar = (p: PeriodEditorProps) => (
    <ScheduleCalendar
      s={calendar?.s ?? null}
      requestDate={c.requestedAt ? kstDate(c.requestedAt) : PREVIEW_TODAY}
      prepLabel={calendar?.prepLabel}
      months={3}
      select={{
        start: p.start,
        end: p.end,
        min: earliestRequestStart(PREVIEW_TODAY, draft?.targetStores || 1),
        minReason: "admix 검토 · 매장 모집 · 확정 · 준비 · 설치 기간이 필요해요.",
        minDays: 3,
        onChange: p.onChange,
      }}
    />
  );

  // 기획안은 화면 너비 전체로 — "주고받은 기획안"은 기획안 카드 바깥 위에(2026-11-18 사용자: 오른쪽 칸을 "다른 데에 배치"
  // → 카드 머리 아래 띠 → 같은 날 "2차 기획안 바깥에 배치해 줘").
  return (
    <div className="flex flex-col gap-[16px]">
      <RoundTrail versions={cmp.versions} />
      <div className="flex min-w-0 flex-col gap-[16px]">
        {editing && draft ? (
          <PanelCard className={CARD}>
            <div className="flex flex-col">
              <Card.Title className="text-[16px] font-bold break-keep text-gray-900">
                항목별로 고치기
              </Card.Title>
              <Card.Description className="text-[12px] break-keep text-gray-500">
                {roundLabel(latest)}에서 고쳐요 · {changed.length}개 항목 수정 ·
                고친 항목엔 이유를 적어 주면 admix가 빨리 이해해요
              </Card.Description>
            </div>
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
              renderPeriod={periodCalendar}
            />
            <div className="flex flex-wrap items-center justify-end gap-[8px]">
              <Button
                variant="tertiary"
                onPress={() => (dirty ? setDialog("discard") : setDraft(null))}
                isDisabled={busy}
                className="h-[44px] rounded-[19px] px-[16px] font-semibold"
              >
                취소
              </Button>
              <Button
                onPress={askSend}
                isDisabled={busy}
                className="h-[44px] rounded-[19px] px-[18px] font-bold"
              >
                <MaskIcon src={SEND_ICON} className="size-[16px]" />
                admix에 보내기
              </Button>
            </div>
          </PanelCard>
        ) : (
          <PanelCard className={CARD}>
            <div className="flex flex-wrap items-start justify-between gap-x-[12px] gap-y-[10px]">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-[8px] gap-y-[2px]">
                <Card.Title className="text-[16px] font-bold break-keep text-gray-900">
                  {head.title}
                </Card.Title>
                {head.at && (
                  <span className="text-[12px] whitespace-nowrap text-gray-500">
                    {head.at}
                  </span>
                )}
              </div>
              {myTurn && (
                <div className="flex flex-wrap gap-[8px]">
                  <Button
                    variant="tertiary"
                    onPress={start}
                    className="h-[40px] rounded-[17px] px-[14px] font-semibold"
                  >
                    <MaskIcon
                      src="/icons/square-pen.svg"
                      className="size-[16px]"
                    />
                    다시 고치기
                  </Button>
                  <Button
                    onPress={() => setDialog("confirm")}
                    className="h-[40px] rounded-[17px] px-[16px] font-bold"
                  >
                    <MaskIcon src="/icons/square-check.svg" className="size-[16px]" />
                    이대로 확정
                  </Button>
                </div>
              )}
            </div>
            <PlanCompare
              before={cmp.before}
              after={latest}
              notes={cmp.notes}
              beforeLabel={
                cmp.before ? `수정 전 · ${roundLabel(cmp.before)}` : undefined
              }
              afterLabel={`수정 후 · ${roundLabel(latest)}`}
              fileActions={fileActions}
              onStore={setStoreView}
            />
          </PanelCard>
        )}
      </div>

      {storeView && <PlanStoreDetail store={storeView} onClose={() => setStoreView(null)} />}
      <ConfirmModal
        isOpen={dialog === "confirm"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`${roundNo(latest.round)}차 기획안으로 확정할까요?`}
        confirmLabel="이대로 확정"
        isDisabled={busy}
        example={false}
        onConfirm={() => void confirm()}
      >
        <p>확정하면 admix가 이 기획안대로 매장 모집을 준비해요.</p>
        <p>확정 뒤 바꿀 게 생기면 admix에 문의해 주세요.</p>
      </ConfirmModal>

      <ConfirmModal
        isOpen={dialog === "send"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`${changed.length}개 항목을 고쳐 admix에 보낼까요?`}
        confirmLabel="보내기"
        isDisabled={busy}
        example={false}
        onConfirm={() => void send()}
      >
        <p className="font-semibold text-gray-900">
          {changed.map(fieldLabel).join(", ")}
        </p>
        <p>
          admix가 수정 전 · 후를 보고 다시 기획안을 보내요. 그동안은 확정할 수
          없어요.
        </p>
      </ConfirmModal>

      <ConfirmModal
        isOpen={dialog === "discard"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="고친 내용을 버릴까요?"
        confirmLabel="버리기"
        danger
        example={false}
        onConfirm={() => {
          setDraft(null);
          setDialog(null);
        }}
      >
        <p>고친 항목과 적은 수정 이유가 사라져요.</p>
      </ConfirmModal>

      <ConfirmModal
        isOpen={!!leaving}
        onOpenChange={(o) => !o && answerLeave(false)}
        title="고치던 기획안이 있어요"
        confirmLabel="나가기"
        danger
        example={false}
        onConfirm={() => answerLeave(true)}
      >
        <p>지금 나가면 고친 내용이 사라져요. 그래도 나갈까요?</p>
      </ConfirmModal>
    </div>
  );
}

/**
 * 주고받은 기획안 — 기획안 카드 바깥 위 가로 타임라인(11-18 사용자: 오른쪽 칸을 "다른 데에 배치" → "문구 칸을 없애주고, UI를 다시"
 * → "2차 기획안 바깥에 배치해 줘").
 * 이름표 · 회색 상자 없이 점 · 점선으로 차수를 잇는다. 차수마다 이름, 아래 작게 보낸 때 · 수정 항목 수.
 * 마지막 차수(지금 보는 것)만 보라 점 · 보라 글자. 바뀐 항목 이름은 아래 비교에 "수정"으로 보여서 여기선 개수만.
 */
function RoundTrail({ versions }: { versions: PlanVersion[] }) {
  return (
    <ol aria-label="주고받은 기획안" className="flex flex-wrap items-center gap-y-[10px] px-[6px]">
      {versions.map((v, i) => {
        const last = i === versions.length - 1;
        const prev = versions
          .slice(0, i)
          .reverse()
          .find((x) => x.author !== v.author);
        const n = prev ? changedKeys(prev.content, v.content).length : 0;
        const sub = [v.createdAt ? kstStamp(v.createdAt) : "", v.round > 0 ? (n ? `${n}개 수정` : "바꾼 항목 없음") : ""]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={v.round} className="flex items-center">
            {i > 0 && <span aria-hidden className="mx-[12px] w-[28px] border-t border-dashed border-gray-300 sm:w-[40px]" />}
            <span className="flex items-center gap-[8px]">
              <span
                aria-hidden
                className={cn(
                  "size-[8px] shrink-0 rounded-full",
                  last ? "bg-primary-500 ring-4 ring-primary-100 dark:ring-primary-500/20" : "bg-gray-300",
                )}
              />
              <span className="flex flex-col">
                <span className={cn("text-[13px] leading-[18px] font-semibold", last ? "text-primary-700" : "text-gray-700")}>
                  {roundLabel(v)}
                </span>
                {sub && <span className="text-[11px] leading-[16px] text-gray-500">{sub}</span>}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
