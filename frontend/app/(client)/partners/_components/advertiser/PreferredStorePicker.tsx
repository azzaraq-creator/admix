"use client";

import { Button, Checkbox, Input, Label, Link, Modal } from "@heroui/react";
import { ExternalLink } from "lucide-react";
import { useState } from "react";

import { HEROUI_CHECKBOX_SCOPE } from "@/app/(client)/(auth)/signup/_components/signupUi";
import { MaskIcon } from "@/components/common/MaskIcon";
import { SpinningSymbol } from "@/components/common/SpinningSymbol";
import { wonText, type StoreRef } from "@/lib/advertiserPreview";
import { cn } from "@/lib/utils";

import { ADV_FIND_HREF, GradeMark, StoreThumb } from "./advUi";

/*
 * 의뢰서 "지정 희망 매장"의 "관심 매장 고르기" 팝업(11-11 사용자).
 * 관심 매장(매장 찾기에서 하트를 누른 매장, favoriteStores.ts)만 보인다(11-11 사용자: "관심 누른 매장만 뜨게").
 * 이미 고른 지정 희망 매장은 체크된 채로 열린다. 관심 매장이 아닌데 이미 지정된 매장은 목록엔 없고 그대로 남는다(의뢰서에서 X로 뺀다).
 * "고르기 완료"를 눌러야 반영되고, 닫거나 취소하면 그대로.
 */

export function PreferredStorePicker({
  isOpen,
  onOpenChange,
  stores,
  loading,
  picked,
  target,
  favoriteIds,
  onApply,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** 고를 수 있는 매장(매장 찾기와 같은 실제 매장). */
  stores: StoreRef[];
  loading: boolean;
  /** 관심 매장(StoreRef.id) — 이 매장들만 목록에 보인다. */
  favoriteIds: Set<string>;
  /** 지금 지정 희망 매장. */
  picked: StoreRef[];
  /** 목표 매장 수 — 넘기면 알려만 준다(막지는 않음, 의뢰 보낼 때 검사). */
  target: number;
  onApply: (next: StoreRef[]) => void;
}) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container placement="center" size="md" scroll="inside">
        <Modal.Dialog aria-label="관심 매장 고르기" className="max-w-[520px]">
          <Modal.CloseTrigger />
          {/* 열 때마다 지금 지정 희망 매장에서 다시 시작하도록 안쪽을 따로 둔다(닫히면 사라짐). */}
          <PickerBody
            stores={stores}
            loading={loading}
            picked={picked}
            target={target}
            favoriteIds={favoriteIds}
            onCancel={() => onOpenChange(false)}
            onApply={(next) => {
              onApply(next);
              onOpenChange(false);
            }}
          />
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function PickerBody({
  stores,
  loading,
  picked,
  target,
  favoriteIds,
  onCancel,
  onApply,
}: {
  stores: StoreRef[];
  loading: boolean;
  picked: StoreRef[];
  target: number;
  favoriteIds: Set<string>;
  onCancel: () => void;
  onApply: (next: StoreRef[]) => void;
}) {
  const [sel, setSel] = useState<string[]>(() => picked.map((p) => p.id));
  const [q, setQ] = useState("");

  // 관심 매장만. 고른 상태(sel)엔 목록 밖 지정 매장도 들어 있어 "고르기 완료" 때 그대로 남는다.
  const all = stores.filter((s) => favoriteIds.has(s.id));
  const word = q.trim().toLowerCase();
  const shown = word ? all.filter((s) => `${s.name} ${s.area}`.toLowerCase().includes(word)) : all;
  const toggle = (id: string, on: boolean) => setSel((x) => (on ? [...x, id] : x.filter((v) => v !== id)));
  const apply = () => {
    // 원래 순서는 지키고, 새로 고른 매장은 목록 순서대로 뒤에.
    const kept = picked.filter((p) => sel.includes(p.id));
    const added = all.filter((s) => sel.includes(s.id) && !kept.some((k) => k.id === s.id));
    onApply([...kept, ...added]);
  };

  return (
    <>
      <Modal.Header className="flex flex-col items-start gap-[4px] pr-[40px]">
        <Modal.Heading className="text-[18px] font-bold text-gray-900">관심 매장 고르기</Modal.Heading>
        <p className="text-[13px] break-keep text-gray-500">
          매장 찾기에서 하트를 누른 매장이에요. 고른 매장은 지정 희망 매장으로 들어가고, 매장 사정에 따라 함께하지 못할 수도 있어요.
        </p>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-[10px]">
        <div className="relative">
          <MaskIcon
            src="/icons/search.svg"
            className="pointer-events-none absolute top-1/2 left-[14px] size-[16px] -translate-y-1/2 text-gray-400"
          />
          <Input
            aria-label="매장 이름 · 지역으로 찾기"
            className="h-[40px] w-full rounded-[17px] pl-[38px]"
            value={q}
            placeholder="매장 이름 · 지역으로 찾기"
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {loading ? (
          <div className="flex justify-center py-[32px]">
            <SpinningSymbol className="size-[32px]" />
          </div>
        ) : shown.length ? (
          <ul className="flex flex-col gap-[6px]">
            {shown.map((s) => {
              const on = sel.includes(s.id);
              return (
                <li key={s.id}>
                  <Checkbox
                    isSelected={on}
                    onChange={(v) => toggle(s.id, v)}
                    className={cn(HEROUI_CHECKBOX_SCOPE, "flex w-full")}
                  >
                    <Checkbox.Content
                      className={cn(
                        "w-full cursor-pointer items-center gap-[10px] rounded-[16px] px-[10px] py-[8px] transition-colors",
                        on ? "bg-primary-50/60" : "bg-gray-50 data-[hovered=true]:bg-gray-100",
                      )}
                    >
                      <Checkbox.Control className="border border-gray-300 in-data-[selected=true]:border-accent in-data-[selected=true]:bg-accent">
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <StoreThumb store={s} className="size-[36px]" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex items-center gap-[6px]">
                          <GradeMark grade={s.grade} />
                          <Label className="truncate text-[14px] font-semibold text-gray-900">{s.name}</Label>
                        </span>
                        <span className="truncate text-[12px] text-gray-500">
                          {s.area} · {s.fee ? wonText(s.fee) : "금액 협의"}
                        </span>
                      </span>
                    </Checkbox.Content>
                  </Checkbox>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-[16px] bg-gray-50 px-[14px] py-[20px] text-center text-[13px] break-keep text-gray-500">
            {word ? (
              "찾는 매장이 없어요."
            ) : (
              <>
                관심 매장이 아직 없어요.{" "}
                <Link
                  href={ADV_FIND_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-[2px] text-[13px] font-semibold"
                >
                  매장 찾기
                  <ExternalLink aria-hidden className="size-[12px]" />
                  <span className="sr-only">(새 탭)</span>
                </Link>
                에서 하트를 눌러 담아 주세요.
              </>
            )}
          </p>
        )}
      </Modal.Body>
      <Modal.Footer className="flex items-center gap-[8px]">
        <span className={cn("mr-auto text-[12px] font-semibold", sel.length > target ? "text-error" : "text-gray-500")}>
          {sel.length}곳 골랐어요 · 목표 {target}곳
        </span>
        <Button variant="tertiary" onPress={onCancel} className="font-semibold">
          취소
        </Button>
        <Button onPress={apply} className="font-bold">
          고르기 완료
        </Button>
      </Modal.Footer>
    </>
  );
}
