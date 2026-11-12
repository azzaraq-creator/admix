"use client";

import { Button, Chip } from "@heroui/react";
import { useMemo, useState } from "react";

import { AdminPanel } from "@/components/admin/AdminPanel";
import { MaskIcon } from "@/components/common/MaskIcon";
import {
  PlanCompare,
  PlanEditor,
  type PlanFileActions,
  PlanHistory,
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
import { averageFee } from "@/lib/advertiserPreview";
import { extractApiError } from "@/lib/apiError";
import {
  changedKeys,
  compareOf,
  fieldLabel,
  fieldText,
  filesOf,
  latestRound,
  planAvgOf,
  planErrorsOf,
  planStoreOf,
  roundLabel,
  roundPayloadOf,
  type PlanContent,
  type PlanFieldKey,
} from "@/lib/collabPlan";

/** 광고주에게 보내기 아이콘 — send.svg(11-12 사용자, 의뢰 보내기 · 기획안 상세 보내기와 같은 그림). */
const SEND_ICON = "/icons/proposal-detail/send.svg";

/**
 * 보내기 확인 창 — 고친 항목마다 이름 · 지금 · 수정(2026-11-12 사용자: "내가 수정한 부분을 깔끔하게").
 * 긴 글은 두 줄까지, 추가 기획은 글이 바뀐 때만 글을, 첨부는 더한 · 뺀 파일 이름을 따로 적는다.
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
  const lines = (k: PlanFieldKey) => {
    if (k !== "extraPlan")
      return [
        { tag: "지금", text: fieldText(before, k) },
        { tag: "수정", text: fieldText(after, k) },
      ];
    const out: { tag: string; text: string }[] = [];
    const b = (before.extraPlan ?? "").trim();
    const a = (after.extraPlan ?? "").trim();
    if (b !== a)
      out.push({ tag: "지금", text: b || "-" }, { tag: "수정", text: a || "-" });
    const ids = (c: PlanContent) => new Set(filesOf(c).map((f) => f.id));
    const added = filesOf(after).filter((f) => !ids(before).has(f.id));
    const removed = filesOf(before).filter((f) => !ids(after).has(f.id));
    if (added.length)
      out.push({ tag: "첨부", text: `${added.map((f) => f.name).join(", ")} 더함` });
    if (removed.length)
      out.push({ tag: "첨부", text: `${removed.map((f) => f.name).join(", ")} 뺌` });
    return out;
  };
  return (
    <div className="flex flex-col gap-[12px] whitespace-normal">
      <ul className="flex max-h-[320px] flex-col divide-y divide-gray-100 overflow-y-auto rounded-[12px] bg-gray-50 px-[14px]">
        {keys.map((k) => (
          <li key={k} className="flex flex-col gap-[4px] py-[10px]">
            <span className="text-sm font-semibold text-black">
              {fieldLabel(k)}
            </span>
            {lines(k).map((l, i) => (
              <span
                key={i}
                className="grid grid-cols-[32px_minmax(0,1fr)] gap-[6px] text-xs leading-[18px]"
              >
                <span className="text-disabled">{l.tag}</span>
                <span
                  className={
                    l.tag === "지금"
                      ? "line-clamp-2 break-keep text-gray-500"
                      : "line-clamp-2 break-keep font-semibold text-gray-800"
                  }
                >
                  {l.text}
                </span>
              </span>
            ))}
          </li>
        ))}
      </ul>
      <p className="break-keep">
        광고주는 수정 전 · 후를 같이 보고 확정하거나 다시 고쳐 보내요.
      </p>
    </div>
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

  // 지금 상황 한 줄 — 누구 차례인지.
  const lastAt = latest.createdAt ? dotDateTime(latest.createdAt) : "";
  const situation =
    doc.status === "cancelled"
      ? "광고주가 취소한 의뢰예요. 기획안을 더 보낼 수 없어요."
      : doc.status === "confirmed"
        ? `광고주가 ${roundLabel(latest)} 기획안을 확정했어요${doc.confirmedAt ? ` · ${dotDateTime(doc.confirmedAt)}` : ""}`
        : doc.status === "proposed"
          ? `${roundLabel(latest)} 기획안을 보냈어요 · ${lastAt} — 광고주 확인을 기다리고 있어요.`
          : doc.status === "revised"
            ? `광고주가 기획안을 고쳐 보냈어요(${roundLabel(latest)}) · ${lastAt} — 확인하고 다시 보내 주세요.`
            : "광고주 의뢰서를 항목별로 고쳐 기획안으로 보내 주세요. 바꿀 게 없으면 그대로 보내도 돼요.";
  const startText =
    doc.status === "proposed"
      ? "다시 고쳐 보내기"
      : doc.rounds.length
        ? "항목별로 고치기"
        : "기획안 만들기";

  return (
    <div className="grid grid-cols-1 gap-[20px] md:gap-[24px] lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-[20px] md:gap-[24px]">
        <AdminPanel>
          <div className="flex flex-wrap items-center gap-[10px]">
            <Chip size="sm" variant="soft" color={status.color}>
              {status.label}
            </Chip>
            <p className="min-w-0 flex-1 break-keep text-sm text-gray-700">
              {situation}
            </p>
            {!closed && !editing && (
              <Button
                size="sm"
                variant={doc.status === "proposed" ? "tertiary" : "primary"}
                onPress={start}
              >
                {startText}
              </Button>
            )}
          </div>
        </AdminPanel>

        {editing && draft ? (
          <AdminPanel
            title="항목별로 고치기"
            desc={`${roundLabel(latest)}에서 고쳐요 · ${changed.length}개 항목 수정`}
          >
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
          </AdminPanel>
        ) : (
          <AdminPanel
            title={cmp.before ? "수정 전 · 후" : roundLabel(latest)}
            desc={
              cmp.before
                ? `${roundLabel(cmp.before)} → ${roundLabel(latest)}`
                : undefined
            }
          >
            <PlanCompare
              before={cmp.before}
              after={latest}
              notes={cmp.notes}
              beforeLabel={cmp.before ? roundLabel(cmp.before) : undefined}
              afterLabel={roundLabel(latest)}
              fileActions={fileActions}
            />
          </AdminPanel>
        )}
      </div>

      <AdminPanel
        title="차수 기록"
        desc={`${cmp.versions.length}차까지`}
        className="h-fit"
      >
        <PlanHistory versions={cmp.versions} formatAt={dotDateTime} />
      </AdminPanel>
      {confirmDialog}
      {leaveDialog}
    </div>
  );
}
