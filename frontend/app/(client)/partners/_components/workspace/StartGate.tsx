"use client";

import { Button, Modal } from "@heroui/react";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { LoadingState } from "@/components/common/RouteStates";
import { MaskIcon } from "@/components/common/MaskIcon";
import { useMe } from "@/hooks/auth";
import { useRecruitingCollabs, useStoreLinks } from "@/hooks/partners";
import { cn } from "@/lib/utils";

import { RecruitCard } from "./CollabBoard";
import { EmptyBox, GLASS_CARD, SHADOW_FLOAT, SectionHead } from "./workspaceUi";

/*
 * 대시보드 첫 단계(2026-11-09 사용자) — 협약 전이거나, 협약은 했지만 담당자가 아직 매장을 연결하지 않았을 때.
 * 매장 등록 안내 대신 지금 모집 중인 콜라보를 보여 주고, 카드를 누르면 "협약해야 볼 수 있어요" 창에서 협약으로 보낸다.
 * 매장 등록은 어드민만 — 제휴사는 회원 고유번호(P-0001)를 담당자에게 알려 주면 담당자가 매장을 잇는다.
 * 협약 뒤엔 가입 03 매장 연결(/partners/join/store)로 — 이미 등록된 매장이면 매장 ID로 연결을 요청한다(094, 11-17).
 * 확인 중인 연결 요청이 있으면 그 매장 이름을 보여 준다.
 */

const AGREEMENT_HREF = "/partners/join/agreement";
const STORE_LINK_HREF = "/partners/join/store";

export function StartGate({ agreed }: { agreed: boolean }) {
  const router = useRouter();
  const { data: me } = useMe();
  const recruiting = useRecruitingCollabs();
  const [gate, setGate] = useState(false);
  const code = me?.partner_code;
  const items = recruiting.data?.items ?? [];
  const links = useStoreLinks();
  const pending = agreed
    ? links.data?.find((r) => r.status === "pending")
    : undefined;

  return (
    <div className="flex flex-col gap-[28px] sm:gap-[36px]">
      {/* 다음 할 일 — 협약 전: 협약하기 / 협약 후: 매장 연결(매장 ID로 요청 · 담당자에게 고유번호) / 요청했으면 확인 기다림. */}
      <section
        className={cn(
          "flex flex-col gap-[14px] rounded-[24px] border p-[20px] sm:flex-row sm:items-center sm:justify-between sm:p-[24px]",
          GLASS_CARD,
          SHADOW_FLOAT,
        )}
      >
        <div className="flex min-w-0 items-start gap-[14px]">
          <span className="flex size-[44px] shrink-0 items-center justify-center rounded-[16px] bg-primary-50 text-primary-500">
            <MaskIcon
              src={agreed ? "/icons/store.svg" : "/icons/square-check.svg"}
              className="size-[22px]"
            />
          </span>
          <div className="min-w-0">
            <h2 className="text-[16px] font-bold break-keep text-gray-900 sm:text-[18px]">
              {pending
                ? "매장 연결을 요청했어요"
                : agreed
                  ? "매장을 연결하면 콜라보에 참여할 수 있어요"
                  : "협약서를 작성하면 콜라보에 참여할 수 있어요"}
            </h2>
            <p className="mt-[4px] text-[13px] leading-[1.6] break-keep text-gray-500 sm:text-[14px]">
              {pending
                ? `${pending.storeName ?? "요청한 매장"}에 연결을 요청했어요. 담당자가 확인하면 연결돼요.`
                : agreed
                  ? "매장 ID가 있으면 연결을 요청해 주세요. 처음 등록하는 매장이면 아래 회원 고유번호를 담당자에게 알려 주세요."
                  : "협약서를 작성하면 매장을 연결할 수 있어요."}
            </p>
            {code && !pending && (
              <p className="mt-[10px] inline-flex items-center gap-[8px] rounded-[12px] bg-gray-50 px-[12px] py-[6px] text-[13px] text-gray-600">
                회원 고유번호
                <b className="font-bold tracking-[0.02em] text-gray-900">
                  {code}
                </b>
              </p>
            )}
          </div>
        </div>
        <Button
          variant={pending ? "tertiary" : "primary"}
          onPress={() => router.push(agreed ? STORE_LINK_HREF : AGREEMENT_HREF)}
          className="h-[44px] shrink-0 rounded-[19px] px-[20px] font-bold max-sm:w-full"
        >
          {pending ? "요청 보기" : agreed ? "매장 연결하기" : "협약서 작성하기"}
          <ArrowRight className="size-[15px]" />
        </Button>
      </section>

      <section className="flex flex-col gap-[16px]">
        <SectionHead
          icon="/icons/megaphone.svg?v=2"
          small
          title="모집 중인 콜라보"
          count={recruiting.isPending ? undefined : items.length}
        />
        {recruiting.isPending ? (
          <LoadingState />
        ) : items.length ? (
          <div className="grid gap-[12px] md:grid-cols-2 xl:grid-cols-3">
            {items.map((c) => (
              <RecruitCard
                key={c.id}
                c={c}
                withPeriod
                today={recruiting.data?.today}
                onLockedPress={() => setGate(true)}
              />
            ))}
          </div>
        ) : (
          <EmptyBox
            icon={
              <MaskIcon src="/icons/face-sleep.svg" className="size-[26px]" />
            }
          >
            <b className="text-gray-700">지금 모집 중인 콜라보가 없어요.</b>새
            모집은 이메일 또는 알림톡으로 알려 드려요.
          </EmptyBox>
        )}
      </section>

      <GateModal
        agreed={agreed}
        code={code}
        isOpen={gate}
        onOpenChange={setGate}
        onNext={() => router.push(agreed ? STORE_LINK_HREF : AGREEMENT_HREF)}
      />
    </div>
  );
}

/** 협약 전 · 매장 연결 전에 모집 카드를 누르면. */
function GateModal({
  agreed,
  code,
  isOpen,
  onOpenChange,
  onNext,
}: {
  agreed: boolean;
  code?: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** 협약 전: 기본협약으로 · 협약 후: 매장 연결로. */
  onNext: () => void;
}) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container placement="center" size="sm">
        <Modal.Dialog aria-label="콜라보 참여 안내">
          <Modal.CloseTrigger />
          <Modal.Header className="flex flex-col items-start gap-[10px] pr-[36px]">
            <span className="flex size-[44px] items-center justify-center rounded-[16px] bg-primary-50 text-primary-500">
              <MaskIcon
                src={agreed ? "/icons/store.svg" : "/icons/square-check.svg"}
                className="size-[22px]"
              />
            </span>
            <Modal.Heading className="text-[17px] font-bold break-keep text-gray-900">
              {agreed
                ? "매장이 연결되면 볼 수 있어요"
                : "협약서를 작성해야 볼 수 있어요"}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p className="text-[14px] leading-[1.6] break-keep text-gray-600">
              {agreed
                ? "매장을 연결하면 콜라보 내용을 보고 신청할 수 있어요. 매장 ID가 있으면 연결을 요청해 주세요."
                : "콜라보 내용을 보고 신청하려면 협약서를 작성해 주세요. 사업자등록증도 올려 주세요."}
            </p>
            {agreed && code && (
              <p className="mt-[12px] rounded-[14px] bg-gray-50 px-[14px] py-[10px] text-[13px] text-gray-600">
                처음 등록하는 매장이면 담당자에게 회원 고유번호{" "}
                <b className="font-bold text-gray-900">{code}</b>를 알려 주세요.
              </p>
            )}
          </Modal.Body>
          <Modal.Footer className="flex gap-[8px]">
            <Button
              variant="tertiary"
              onPress={() => onOpenChange(false)}
              className="h-[44px] flex-1 rounded-[19px] font-semibold"
            >
              닫기
            </Button>
            <Button
              onPress={onNext}
              className="h-[44px] flex-1 rounded-[19px] font-bold"
            >
              {agreed ? "매장 연결하기" : "협약서 작성하기"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
