"use client";

import { Button, Chip } from "@heroui/react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { MaskIcon } from "@/components/common/MaskIcon";
import { useStartRecruiting } from "@/hooks/adminCollab/mutations";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { useSonner } from "@/hooks/useSonner";
import type { AdminAdvCollabRequestDetail } from "@/lib/adminCollab";
import { kstDate, mdw } from "@/lib/advertiserPreview";
import { extractApiError } from "@/lib/apiError";
import { confirmedScheduleOf, type PlanContent } from "@/lib/collabPlan";
import type { AdminCollabDetail } from "@/lib/partners";
import { todayKst } from "@/lib/partnersPreview";

/**
 * 확정 → 매장 모집 시작(101, 2026-11-26 사용자: "광고주랑 기획안 확정되면 어드민에서 바로 매장 모집 시작할 수 있게").
 * 의뢰 상세 맨 위 줄과 "콜라보 관리 → 매장 모집" 화면이 같은 흐름(확인 창 → 콜라보를 만들어 의뢰에 잇기)을 쓴다.
 * 날짜는 확정 기획안 서류 · 광고주 화면과 같은 일정(confirmedScheduleOf — 확정 다음 날 모집 공지, 영업일 · 공휴일 규칙).
 * 모집 공지 날이 이미 지났으면 오늘부터 연다. 확정 기한은 그날 18시(콜라보 기본과 같다).
 */
export interface RecruitSource {
  id: string;
  /** 처음 의뢰한 때(ISO) — 일정 계산의 의뢰일 */
  createdAt: string;
  /** 광고주가 확정한 때(ISO) */
  confirmedAt: string;
  /** 광고주가 확정한 기획안(마지막 차수) 내용 */
  content: PlanContent;
}

/**
 * 모집 일정 — 누른 그날 바로 모집 시작(11-26 사용자: "시작 D-1 이게 아니라 시작 누른 순간 바로 모집 시작 … 일정도 바뀌어야").
 * 오늘을 모집 공지로 두고 모집 마감 · 검토 · 확정을 다시 센다(광고주 · 확정 기획안 화면도 모집을 열면 같은 날로 센다).
 * 설치 · 진행 · 철수는 광고주가 고른 날 그대로. late = 매장 확정이 설치 시작보다 늦어 열 수 없음.
 */
export function recruitPlanOf(src: RecruitSource) {
  const today = todayKst();
  const s = confirmedScheduleOf(
    src.content,
    kstDate(src.createdAt),
    src.confirmedAt,
    today,
  );
  return {
    recruitStart: today,
    recruitEnd: s.recruitEnd,
    confirmDue: s.confirmDue,
    installStart: s.installStart,
    startDate: s.startDate,
    endDate: s.endDate,
    removalDate: s.removalDate,
    late: s.confirmDue >= s.installStart,
  };
}

/** 며칠인지 — 시작 · 끝 날 모두 셈(11.27 ~ 12.06 = 10일). */
const daysOf = (from: string, to: string) =>
  `${Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1}일`;

/** 모집 시작 흐름 — run(의뢰)로 확인 창을 띄우고 콜라보를 만든다. 지금 여는 의뢰 id 는 pendingId. */
export function useStartRecruitingFlow(
  onStarted?: (collab: AdminCollabDetail) => void,
) {
  const start = useStartRecruiting();
  const { confirm, alert, confirmDialog } = useAdminConfirm();
  const { success } = useSonner();

  const run = async (src: RecruitSource) => {
    const plan = recruitPlanOf(src);
    if (plan.late) {
      await alert({
        title: "지금 열면 일정이 맞지 않아요",
        description: `오늘 모집을 시작해도 매장 확정(${mdw(plan.confirmDue)})이 설치 시작(${mdw(plan.installStart)})보다 늦어요. 광고주와 일정을 다시 맞춰 주세요.`,
        confirmText: "확인",
      });
      return;
    }
    const ok = await confirm({
      title: "매장 모집을 시작할까요?",
      // 안내는 한 줄, 일정 · 매장은 이름표와 값을 줄 맞춘 회색 상자(11-26 사용자: "제휴사 매장에 바로 보여요" 빼기 ·
      // "좀 더 깔끔하게 한 눈에 보기 쉽게").
      description: (
        <span className="flex flex-col gap-[12px]">
          <span>확정한 기획안으로 모집 공고를 열어요.</span>
          <span className="grid grid-cols-[auto_1fr] gap-x-[16px] gap-y-[8px] rounded-[10px] bg-gray-50 px-[14px] py-[12px]">
            {[
              {
                label: "모집",
                value: `${mdw(plan.recruitStart)} ~ ${mdw(plan.recruitEnd)}`,
                days: daysOf(plan.recruitStart, plan.recruitEnd),
              },
              {
                label: "진행",
                value: `${mdw(plan.startDate)} ~ ${mdw(plan.endDate)}`,
                days: daysOf(plan.startDate, plan.endDate),
              },
              {
                label: "매장",
                value: `최소 ${src.content.minStores}곳 · 목표 ${src.content.targetStores}곳`,
              },
            ].map((row) => (
              <span key={row.label} className="contents">
                <span className="text-tone-4a5565">{row.label}</span>
                <span className="flex flex-wrap items-center gap-[6px] font-semibold text-black">
                  {row.value}
                  {/* 며칠인지는 테두리 칩으로(11-26 사용자: "Chip으로 보여줘" · "Chip에 테두리를 넣어줘"). */}
                  {row.days && (
                    <Chip
                      size="sm"
                      variant="soft"
                      className="border border-gray-200"
                    >
                      {row.days}
                    </Chip>
                  )}
                </span>
              </span>
            ))}
          </span>
        </span>
      ),
      cancelText: "취소",
      confirmText: "모집 시작",
    });
    if (!ok) return;
    try {
      const collab = await start.mutateAsync({
        id: src.id,
        payload: {
          recruit_start: plan.recruitStart,
          recruit_end: plan.recruitEnd,
          confirm_due: `${plan.confirmDue}T18:00`,
          install_date: plan.installStart,
          removal_date: plan.removalDate,
        },
      });
      success("매장 모집을 시작했어요.");
      onStarted?.(collab);
    } catch (err) {
      await alert({
        title: "모집을 시작하지 못했어요",
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  return {
    run,
    pendingId: start.isPending ? (start.variables?.id ?? null) : null,
    dialog: confirmDialog,
  };
}

/** 의뢰 상세 맨 위 줄 — 아직이면 "매장 모집 시작"(열면 그 콜라보로), 열었으면 "콜라보 진행 보기". */
export function StartRecruiting({
  doc,
  content,
  confirmedAt,
}: {
  doc: AdminAdvCollabRequestDetail;
  content: PlanContent;
  confirmedAt: string;
}) {
  const router = useRouter();
  const flow = useStartRecruitingFlow((collab) =>
    router.push(`/admin/collab/collabs/${collab.id}`),
  );

  if (doc.collabId)
    return (
      <Link
        href={`/admin/collab/collabs/${doc.collabId}`}
        className="flex items-center gap-[4px] text-sm font-semibold text-primary no-underline hover:underline"
      >
        매장 모집 중 · 콜라보 진행 보기
        <ArrowRight className="size-[14px]" />
      </Link>
    );

  return (
    <>
      <Button
        size="sm"
        variant="primary"
        isPending={flow.pendingId === doc.id}
        onPress={() =>
          void flow.run({
            id: doc.id,
            createdAt: doc.createdAt,
            confirmedAt,
            content,
          })
        }
      >
        {/* 모집 목록의 "모집 시작"과 같은 채운 확성기(11-26 사용자: "fill-megaphone.svg로"). */}
        <MaskIcon src="/icons/fill-megaphone.svg" className="size-[16px]" />
        매장 모집 시작
      </Button>
      {flow.dialog}
    </>
  );
}
