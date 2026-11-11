"use client";

import { LoadingState } from "@/components/common/RouteStates";
import { MaskIcon } from "@/components/common/MaskIcon";
import { useMe } from "@/hooks/auth";
import { useSelectedPartnerStore } from "@/hooks/partners";

import { StoreFront } from "./StoreFront";
import { StorePicker } from "./workspace/workspaceUi";

/**
 * 내 매장(/partners/stores) — 담당자가 연결해 준 매장을 본다(2026-11-09: 매장 등록 · 수정은 어드민만, 069).
 * 매장이 여러 곳이면 위에서 고른다(StorePicker — 대시보드 · 콜라보 참여 · 참여 이력과 같은 매장).
 * 아직 연결된 매장이 없으면 회원 고유번호를 보여 주고 담당자에게 알려 달라고 안내한다.
 */
export function PartnersStoreDashboard() {
  const { data: me } = useMe();
  const { stores, store, isPending } = useSelectedPartnerStore();
  const bizStatus = me?.business_registration?.status ?? "unregistered";

  if (isPending) return <LoadingState />;

  if (!store) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-[14px] px-[24px] pb-[44px] text-center">
        <span className="flex size-[56px] items-center justify-center rounded-[20px] bg-primary-50 text-primary-500">
          <MaskIcon src="/icons/store.svg" className="size-[26px]" />
        </span>
        <h1 className="text-[18px] font-bold text-gray-900">
          아직 연결된 매장이 없어요
        </h1>
        <p className="max-w-[380px] text-[14px] leading-[1.6] break-keep text-gray-500">
          매장 정보는 admix 담당자가 등록하고 회원님 계정에 연결해 드려요.
          {me?.partner_code && (
            <>
              {" "}
              담당자에게 회원 고유번호{" "}
              <b className="font-bold text-gray-900 tabular-nums">
                {me.partner_code}
              </b>
              를 알려 주세요.
            </>
          )}
        </p>
      </section>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-[16px]">
      {stores.length > 1 && <StorePicker />}
      <StoreFront key={store.id} store={store} bizStatus={bizStatus} />
    </div>
  );
}
