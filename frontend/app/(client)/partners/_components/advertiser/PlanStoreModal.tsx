"use client";

import { Modal } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";

import { LoadingState } from "@/components/common/RouteStates";
import { partnersApi, partnersKeys } from "@/hooks/partners";
import type { PlanStore } from "@/lib/collabPlan";

import { PartnersStoreInfo } from "../PartnersStoreDetail";

/**
 * 기획안 지정 희망 매장 정보 팝업 — 기획안 비교에서 매장 이름을 누르면 그 매장 사진 · 정보 · 지도를 띄운다
 * (2026-11-13 사용자: "어느 매장인지 볼 수 있게 선택하면 해당 매장의 정보가 팝업으로"). 매장 상세 페이지와 같은 화면(PartnersStoreInfo).
 * 닫히는 동안에도 내용이 남게 store 는 쓰는 쪽이 들고 있고, 열림은 isOpen 으로만 바꾼다.
 */
export function PlanStoreModal({
  store,
  isOpen,
  onOpenChange,
}: {
  store: PlanStore | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container placement="center" size="lg" scroll="inside">
        <Modal.Dialog aria-label={store ? `${store.name} 매장 정보` : "매장 정보"} className="max-w-[640px]">
          <Modal.CloseTrigger />
          <Modal.Body className="pt-[40px] pb-[8px]">{store && <StoreBody id={store.id} />}</Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function StoreBody({ id }: { id: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: partnersKeys.store(id),
    queryFn: () => partnersApi.store(id),
    retry: false,
  });
  if (isLoading) return <LoadingState />;
  if (isError || !data)
    return (
      <p className="py-[48px] text-center text-[14px] font-semibold break-keep text-gray-600">
        지금은 매장 정보를 볼 수 없어요. 비공개로 바뀌었거나 콜라보를 쉬는 매장일 수 있어요.
      </p>
    );
  return <PartnersStoreInfo store={data} stacked />;
}
