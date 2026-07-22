"use client";

import { useRouter } from "next/navigation";

import { useConfirm } from "@/hooks/useConfirm";

import type { ProposalLimitDetail } from "./apis";

// 제안서 생성 한도 도달 안내 다이얼로그. 생성 진입점(내 제안서 / 담기 모달) 공용.
export function useProposalLimitDialog() {
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();

  const showLimitDialog = async (tier: ProposalLimitDetail["tier"]) => {
    if (tier === "guest") {
      const ok = await confirm({
        title: "제안서 생성 한도 도달",
        description:
          "무료 체험용 제안서 생성 한도 1건을 모두 사용했어요.\n회원가입 후 더 많은 제안서를 생성하고 관리해 보세요.",
        confirmText: "회원가입하기",
      });
      if (ok) router.push("/signup");
    } else {
      const ok = await confirm({
        title: "제안서 생성 한도 도달",
        description:
          "제안서 생성 한도 5건을 모두 사용했어요.\n사업자 인증을 완료하면 무제한으로 이용할 수 있어요.",
        confirmText: "프로필 이동",
      });
      if (ok) router.push("/profile");
    }
  };

  return { showLimitDialog, limitDialog: confirmDialog };
}
