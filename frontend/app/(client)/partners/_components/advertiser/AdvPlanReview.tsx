"use client";

import { Button, Card } from "@heroui/react";
import { CheckCircle2, Send } from "lucide-react";
import { useMemo, useState } from "react";

import { MaskIcon } from "@/components/common/MaskIcon";
import {
  PlanCompare,
  PlanEditor,
  PlanHistory,
  type PlanFileActions,
} from "@/components/collabPlan/PlanSheet";
import { partnersApi, usePartnersStores } from "@/hooks/partners";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { averageFee, type AdvCollab } from "@/lib/advertiserPreview";
import { extractApiError } from "@/lib/apiError";
import {
  AUTHOR_LABEL,
  changedKeys,
  compareOf,
  fieldLabel,
  latestRound,
  planAvgOf,
  planErrorsOf,
  planStoreOf,
  roundLabel,
  roundNo,
  roundPayloadOf,
  type PlanBlock,
  type PlanContent,
  type PlanFieldKey,
  type PlanStore,
} from "@/lib/collabPlan";
import { kstStamp } from "@/lib/partnersPreview";

import { PanelCard } from "../workspace/workspaceUi";
import { useRememberSentRequest } from "./advStore";
import { ConfirmModal, say } from "./advUi";
import { PlanStoreModal } from "./PlanStoreModal";

const CARD = "gap-[14px] bg-surface p-[18px] backdrop-blur-none sm:p-[24px]";

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
  // 지정 희망 매장 정보 팝업(11-13) — 닫히는 동안에도 내용이 남게 매장은 따로 둔다.
  const [storeView, setStoreView] = useState<PlanStore | null>(null);
  const [storeOpen, setStoreOpen] = useState(false);
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

  const at = latest.createdAt ? kstStamp(latest.createdAt) : "";
  const head = confirmed
    ? {
        title: `${roundLabel(latest)} 기획안으로 확정했어요`,
        hint: block.confirmedAt ? kstStamp(block.confirmedAt) : undefined,
      }
    : myTurn
      ? {
          title: `admix가 ${roundNo(latest.round)}차 기획안을 보냈어요`,
          hint: `${at} · 바뀐 항목을 확인하고 확정하거나 다시 고쳐 보내 주세요`,
        }
      : {
          title: "고친 기획안을 admix가 검토하고 있어요",
          hint: `${at}에 보냈어요 · admix가 다시 기획안을 보내면 알려 드려요`,
        };

  return (
    <div className="grid gap-[16px] lg:grid-cols-[minmax(0,1fr)_300px]">
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
                <Send className="size-[16px]" />
                admix에 보내기
              </Button>
            </div>
          </PanelCard>
        ) : (
          <PanelCard className={CARD}>
            <div className="flex flex-wrap items-start justify-between gap-x-[12px] gap-y-[10px]">
              <div className="flex min-w-0 flex-col">
                <Card.Title className="text-[16px] font-bold break-keep text-gray-900">
                  {head.title}
                </Card.Title>
                {head.hint && (
                  <Card.Description className="text-[12px] break-keep text-gray-500">
                    {head.hint}
                  </Card.Description>
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
                    <CheckCircle2 className="size-[16px]" />
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
              onStore={(s) => {
                setStoreView(s);
                setStoreOpen(true);
              }}
            />
          </PanelCard>
        )}
      </div>

      <PanelCard className={`${CARD} h-fit`}>
        <div className="flex flex-col">
          <Card.Title className="text-[16px] font-bold text-gray-900">
            주고받은 기획안
          </Card.Title>
          <Card.Description className="text-[12px] text-gray-500">
            {AUTHOR_LABEL.admix}와 {cmp.versions.length}차까지 주고받았어요
          </Card.Description>
        </div>
        <PlanHistory versions={cmp.versions} formatAt={kstStamp} />
      </PanelCard>

      <PlanStoreModal store={storeView} isOpen={storeOpen} onOpenChange={setStoreOpen} />
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
