"use client";

import { Button, Spinner } from "@heroui/react";
import { useRef } from "react";

import { useAlertConfirm } from "@/hooks/useAlertConfirm";
import { useMe, useUploadBusinessRegistration } from "@/hooks/auth";
import { useDeletePartnersStore, useMyPartnersStores } from "@/hooks/partners";
import { useSonner } from "@/hooks/useSonner";
import { extractApiError } from "@/lib/apiError";
import { PARTNERS_MEDIA_CATEGORY } from "@/lib/partners";
import { cn } from "@/lib/utils";

import { PartnersStoreForm } from "./PartnersStoreForm";
import { StoreFront } from "./StoreFront";
import { GLASS_CARD } from "./workspace/workspaceUi";

/** 매장을 등록할 수 있는 사업자 등록 상태 — 올리기만 해도(검토 중) 된다(백엔드 REGISTRABLE_BIZ_STATUS). */
const REGISTRABLE = new Set(["reviewing", "verified"]);

/**
 * 내 매장(/partners/stores) — 매장이 없으면 곧바로 매장 등록 폼, 있으면 사장님이 우리 매장을 보는 화면(StoreFront — 매장 이름 · 광고주에게 보이는 화면 미리보기 · 매장 정보 · 사진첩).
 * 등록한 뒤엔 따로 고치는 폼이 없다 — 매장명까지 모두 StoreFront 에서 그 자리에서 바로 저장.
 * 매장은 회원 한 명당 한 곳만(서버 partners_service._ensure_no_other_store).
 * 사업자등록증을 아직 안 올렸으면 등록 폼 위에서 먼저 올리게 한다.
 */
export function PartnersStoreDashboard() {
  const { data: me } = useMe();
  const { data: stores, isLoading } = useMyPartnersStores();
  const remove = useDeletePartnersStore();
  const { confirm, confirmDialog } = useAlertConfirm();
  const { deleted, error } = useSonner();

  const bizStatus = me?.business_registration?.status ?? "unregistered";
  const canRegister = REGISTRABLE.has(bizStatus);

  if (isLoading || !stores) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // 매장이 없으면 곧바로 등록 폼(1인 1개라 "매장 추가"는 없다).
  if (stores.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-[16px]">
        <header className="flex flex-col gap-[4px]">
          <h1 className="text-[22px] font-bold text-gray-900 sm:text-[26px]">
            환영해요! 매장을 등록해 주세요
          </h1>
          <p className="text-[13px] break-keep text-gray-500 sm:text-[14px]">
            등록한 매장은 admix 매체 찾기의 &lsquo;{PARTNERS_MEDIA_CATEGORY}
            &rsquo;에 바로 보이고, 광고주가 찾아볼 수 있어요.
          </p>
        </header>
        {canRegister ? (
          <PartnersStoreForm />
        ) : (
          <LicenseGate status={bizStatus} />
        )}
      </div>
    );
  }

  // 매장은 1인 1개 — 등록한 매장을 사장님 화면(StoreFront)으로 보여 준다.
  const store = stores[0];
  const onDelete = async () => {
    const ok = await confirm({
      title: "매장을 삭제할까요?",
      description: `${store.name} 매장이 매체 찾기에서도 사라져요. 되돌릴 수 없어요.`,
      confirmText: "삭제",
      destructive: true,
      icon: "trash",
    });
    if (!ok) return;
    remove.mutate(store.id, {
      onSuccess: () => deleted("매장을 삭제했어요."),
      onError: (e) => error(extractApiError(e, "매장을 삭제하지 못했어요.")),
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-[16px]">
      <StoreFront store={store} bizStatus={bizStatus} onDelete={onDelete} />
      {confirmDialog}
    </div>
  );
}

/** 사업자등록증 올리기 — 올리면(검토 중) 바로 매장 등록 폼이 열린다. */
function LicenseGate({ status }: { status: string }) {
  const upload = useUploadBusinessRegistration();
  const { success, error } = useSonner();
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-[12px] rounded-[24px] border px-[20px] py-[36px] text-center",
        GLASS_CARD,
      )}
    >
      <p className="text-[17px] font-bold text-gray-900">
        먼저 사업자등록증을 올려 주세요
      </p>
      <p className="max-w-[420px] text-[13px] leading-[1.6] break-keep text-gray-500">
        제휴사(콜라보)는 사업자등록증을 올려야 매장을 등록할 수 있어요. 올리면
        바로 매장을 등록할 수 있고, 관리자가 확인해요.
        {status === "rejected" &&
          " (이전에 올린 파일은 반려됐어요. 다시 올려 주세요.)"}
      </p>
      <Button
        variant="primary"
        isPending={upload.isPending}
        onPress={() => fileRef.current?.click()}
        className="h-[44px] rounded-[19px] px-[22px] font-semibold"
      >
        {upload.isPending && <Spinner size="sm" color="current" />}
        사업자등록증 올리기
      </Button>
      <p className="text-[12px] text-gray-400">PDF · PNG · JPG, 10MB 이하</p>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          upload.mutate(file, {
            onSuccess: () =>
              success(
                "사업자등록증을 올렸어요.",
                "이제 매장을 등록할 수 있어요.",
              ),
            onError: (err) =>
              error(extractApiError(err, "사업자등록증을 올리지 못했어요.")),
          });
        }}
      />
    </div>
  );
}
