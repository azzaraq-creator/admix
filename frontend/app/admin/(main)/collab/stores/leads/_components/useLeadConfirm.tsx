"use client";

import { useCallback } from "react";

import { useConfirmCollabLead } from "@/hooks/adminCollab";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { useSonner } from "@/hooks/useSonner";
import { extractApiError } from "@/lib/apiError";
import type { CollabLead } from "@/lib/collabLeads";

/**
 * 협업 확정(076) — 묻고, 영업 기록 칸으로 협업 확정 카페에 비공개 매장을 만든다. 목록 줄 · 상세가 같이 쓴다.
 * 영업 기록은 지우지 않고 "협업 확정 전" 목록에서만 빠진다(매장을 지우면 다시 보인다).
 */
export function useLeadConfirm() {
  const mutation = useConfirmCollabLead();
  const { mutateAsync } = mutation;
  const { confirm, alert, confirmDialog } = useAdminConfirm();
  const { success } = useSonner();

  const run = useCallback(async (lead: Pick<CollabLead, "id" | "name">) => {
    const ok = await confirm({
      title: "협업 확정 카페로 옮길까요?",
      description: (
        <>
          <span className="font-semibold text-black">{lead.name}</span> — 업체명
          · 주소 · 업체 유형 · 매장 담당자 연락처 · 연결한 회원으로 협업 확정
          카페에 비공개 매장을 만들어요. 이 목록에서는 빠지고, 영업 기록은
          그대로 남아요.
        </>
      ),
      confirmText: "확정",
    });
    if (!ok) return null;
    try {
      const { store } = await mutateAsync(lead.id);
      success(
        "협업 확정 카페로 옮겼어요.",
        `${store.storeCode ?? ""} 비공개 — 사진 · 금액을 채우고 공개로 바꿔 주세요.`,
      );
      return store;
    } catch (err) {
      await alert({
        title: "확정 실패",
        description: extractApiError(err),
        confirmText: "확인",
      });
      return null;
    }
  }, [alert, confirm, mutateAsync, success]);

  return {
    run,
    /** 지금 확정 중인 기록 id */
    pendingId: mutation.isPending ? mutation.variables : undefined,
    dialog: confirmDialog,
  };
}
