"use client";

import { useCallback } from "react";

import { useCancelCollabLead, useConfirmCollabLead } from "@/hooks/adminCollab";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { useSonner } from "@/hooks/useSonner";
import { extractApiError } from "@/lib/apiError";
import {
  storeAddressOf,
  type CollabLead,
  type CollabLeadLocation,
} from "@/lib/collabLeads";
import { locateAddress } from "@/lib/kakaoMap";

/**
 * 협업 확정 매장 위치 — 화면에서 카카오 지도로 먼저 찾는다. 서버 주소 검색은 키가 없거나(로컬)
 * 층 · 호수가 붙은 주소를 못 찾아 상세 지도가 안 뜨던 것(11-12 치르 · 베를린하우스). 못 찾으면 null — 서버가 한 번 더.
 * 확정 버튼과 회원 연결 저장(연결 = 협업 확정)이 같이 쓴다.
 */
export async function findLeadLocation(
  lead: Pick<CollabLead, "address" | "custom">,
): Promise<CollabLeadLocation | null> {
  const found = await locateAddress(storeAddressOf(lead)).catch(() => null);
  return (
    found && {
      latitude: found.lat,
      longitude: found.lng,
      city: found.city,
      district: found.district,
    }
  );
}

/**
 * 협업 확정(076) — 묻고, 영업 기록 칸으로 협업 확정 매장에 비공개 매장을 만든다. 목록 줄 · 상세가 같이 쓴다.
 * 영업 기록은 지우지 않고 목록에도 그대로 남는다(11-12 사용자 — 칸이 달라 두 목록을 따로 둔다). 확정 버튼 자리에 매장 번호가 뜬다.
 * 협업 취소(11-12 사용자, 상세에서) — 확정의 반대: 만든 매장을 지우고 확정 전으로. 참여 · 수정 요청 기록이 있으면 서버가 막는다.
 */
export function useLeadConfirm() {
  const mutation = useConfirmCollabLead();
  const { mutateAsync } = mutation;
  const cancelMutation = useCancelCollabLead();
  const { mutateAsync: cancelAsync } = cancelMutation;
  const { confirm, alert, confirmDialog } = useAdminConfirm();
  const { success } = useSonner();

  const run = useCallback(
    async (lead: Pick<CollabLead, "id" | "name" | "address" | "custom">) => {
      const ok = await confirm({
        // 11-12 사용자 — 제목은 묻는 말, 본문은 매장명 한 줄 + 짧은 설명.
        title: "협업 확정하실 건가요?",
        description: (
          <>
            <p>
              매장명:{" "}
              <span className="font-semibold text-black">{lead.name}</span>
            </p>
            <p className="mt-[6px] break-keep">
              협업 확정 매장에 비공개로 추가돼요. 영업 기록은 그대로 남아요.
            </p>
          </>
        ),
        confirmText: "확정",
      });
      if (!ok) return null;
      try {
        const { store } = await mutateAsync({
          id: lead.id,
          location: await findLeadLocation(lead),
        });
        success(
          "협업 확정했어요.",
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
    },
    [alert, confirm, mutateAsync, success],
  );

  const cancel = useCallback(
    async (
      lead: Pick<CollabLead, "id" | "name" | "storeCode" | "partnerCode">,
    ) => {
      const ok = await confirm({
        title: "협업 취소하실 건가요?",
        description: (
          <>
            <p>
              매장명:{" "}
              <span className="font-semibold text-black">{lead.name}</span>
            </p>
            <p className="mt-[6px] break-keep">
              협업 확정 매장{lead.storeCode ? `(${lead.storeCode})` : ""}이
              지워지고 확정 전으로 돌아가요. 매장에 넣은 사진 · 금액 · 등급도
              함께 사라져요.
              {lead.partnerCode &&
                ` 연결한 회원(${lead.partnerCode})도 끊겨요.`}
            </p>
          </>
        ),
        confirmText: "협업 취소",
        cancelText: "닫기",
      });
      if (!ok) return false;
      try {
        const { storeCode } = await cancelAsync(lead.id);
        success(
          "협업을 취소했어요.",
          storeCode ? `${storeCode} 매장을 지웠어요.` : undefined,
        );
        return true;
      } catch (err) {
        await alert({
          title: "협업 취소 실패",
          description: extractApiError(err),
          confirmText: "확인",
        });
        return false;
      }
    },
    [alert, cancelAsync, confirm, success],
  );

  return {
    run,
    cancel,
    /** 지금 협업 취소 중인지 */
    cancelling: cancelMutation.isPending,
    /** 지금 확정 중인 기록 id */
    pendingId: mutation.isPending ? mutation.variables?.id : undefined,
    dialog: confirmDialog,
  };
}
