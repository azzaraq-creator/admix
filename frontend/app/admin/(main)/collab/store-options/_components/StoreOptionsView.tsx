"use client";

import { Button, Input, Modal, Tabs } from "@heroui/react";
import { Plus, X } from "lucide-react";
import { useState } from "react";

import { HeroField } from "@/app/admin/(main)/media/_components/heroFields";
import { LoadingState } from "@/components/common/RouteStates";
import {
  useCreateStoreType,
  useDeleteStoreType,
  useStoreTypes,
  useUpdateStoreType,
} from "@/hooks/adminCollab";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { useSonner } from "@/hooks/useSonner";
import { extractApiError } from "@/lib/apiError";
import {
  noteTone,
  PARTNERS_NOTE_MAX_LEN,
  PARTNERS_TAG_MAX_LEN,
  type StoreType,
} from "@/lib/partners";

import { ChipInput } from "../../_components/ChipInput";
import { CollabPageHead, CollabSection } from "../../_components/collabUi";

const NAME_MAX = 20;
const NOTE_CHIP_COLOR = {
  no: "danger",
  ok: "success",
  info: "default",
} as const;

/**
 * 매장 항목(/admin/collab/store-options) — 매장 유형(카페 · 식당 …)마다 "매장 어필" 칩 값과
 * 자주 쓰는 "조건 메모" 값을 정한다(2026-11-09 사용자, 070). 매장 폼은 고른 유형의 값을 칩으로 보여 준다.
 * 값은 쉼표(,)로 칩을 만들며 적는다.
 */
export function StoreOptionsView() {
  const { data: types, isLoading } = useStoreTypes();
  const [picked, setPicked] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const list = types ?? [];
  // 고른 유형이 지워졌거나 아직 안 골랐으면 첫 유형.
  const current = list.find((t) => t.id === picked) ?? list[0];

  return (
    <div className="flex flex-col gap-[24px]">
      <CollabPageHead
        title="매장 항목"
        desc="매장 유형마다 매장 어필 칩과 자주 쓰는 조건 메모를 정해요. 매장 화면에서 유형을 고르면 여기 값이 칩으로 보여요."
      >
        <Button variant="primary" onPress={() => setAdding(true)}>
          <Plus className="size-[16px]" />
          유형 추가
        </Button>
      </CollabPageHead>

      {isLoading ? (
        <LoadingState />
      ) : !current ? (
        <p className="py-[40px] text-center text-sm text-disabled">
          아직 매장 유형이 없어요. &quot;유형 추가&quot;로 카페 · 식당 같은
          유형을 만들어 주세요.
        </p>
      ) : (
        <>
          <Tabs
            selectedKey={String(current.id)}
            onSelectionChange={(key) => setPicked(Number(key))}
          >
            <Tabs.ListContainer className="w-fit max-w-full overflow-x-auto rounded-[17px]">
              <Tabs.List aria-label="매장 유형">
                {list.map((t) => (
                  <Tabs.Tab
                    key={t.id}
                    id={String(t.id)}
                    className="whitespace-nowrap rounded-[13px]"
                  >
                    {t.name}
                    <span className="ml-[4px] text-xs font-medium text-disabled">
                      {t.storeCount}
                    </span>
                    <Tabs.Indicator className="rounded-[13px]" />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
          {/* 유형을 바꾸면 편집 칸을 새로 — 저장 안 한 글이 다른 유형으로 넘어가지 않게. */}
          <TypeEditor
            key={`${current.id}-${current.name}-${current.tags.join()}-${current.notes.join()}`}
            type={current}
            onDeleted={() => setPicked(null)}
          />
        </>
      )}

      <AddTypeModal
        isOpen={adding}
        onOpenChange={setAdding}
        onCreated={(t) => {
          setPicked(t.id);
          setAdding(false);
        }}
      />
    </div>
  );
}

function TypeEditor({
  type,
  onDeleted,
}: {
  type: StoreType;
  onDeleted: () => void;
}) {
  const update = useUpdateStoreType();
  const remove = useDeleteStoreType();
  const { confirm, alert, confirmDialog } = useAdminConfirm();
  const { success } = useSonner();
  const [name, setName] = useState(type.name);
  const [tags, setTags] = useState(type.tags);
  const [notes, setNotes] = useState(type.notes);
  const dirty =
    name.trim() !== type.name ||
    tags.join("\n") !== type.tags.join("\n") ||
    notes.join("\n") !== type.notes.join("\n");

  const save = async () => {
    if (!name.trim()) {
      await alert({
        title: "유형 이름을 적어 주세요",
        confirmText: "확인",
      });
      return;
    }
    try {
      await update.mutateAsync({
        id: type.id,
        payload: { name: name.trim(), tags, notes },
      });
      success("매장 항목을 저장했어요.");
    } catch (err) {
      await alert({
        title: "저장 실패",
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  const del = async () => {
    const ok = await confirm({
      title: `'${type.name}' 유형을 지울까요?`,
      description: type.storeCount
        ? `이 유형인 매장 ${type.storeCount}곳은 "미지정"이 돼요. 매장에 들어간 칩 · 조건 메모는 그대로 남아요.`
        : "이 유형의 칩 · 조건 값이 함께 지워져요.",
      confirmText: "삭제",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(type.id);
      onDeleted();
    } catch (err) {
      await alert({
        title: "삭제 실패",
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  return (
    <div className="flex flex-col gap-[16px]">
      <CollabSection
        title="유형"
        desc={`이 유형인 매장 ${type.storeCount}곳`}
      >
        <div className="max-w-[360px]">
          <HeroField label="유형 이름" required>
            <Input
              variant="secondary"
              fullWidth
              aria-label="유형 이름"
              maxLength={NAME_MAX}
              placeholder="예: 카페"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </HeroField>
        </div>
      </CollabSection>

      <CollabSection
        title={`매장 어필 칩 ${tags.length}개`}
        desc="매장 화면에서 눌러 고르는 해시태그예요(개수 제한 없음, 카드에는 3개까지 보여요). 직접 적고 쉼표(,)를 누르면 칩이 돼요."
      >
        <ChipInput
          ariaLabel="매장 어필 칩 값"
          placeholder="예: 뷰맛집, 포토존, 주차가능"
          values={tags}
          onChange={setTags}
          maxLength={PARTNERS_TAG_MAX_LEN}
          prefix="#"
        />
      </CollabSection>

      <CollabSection
        title={`자주 쓰는 조건 메모 ${notes.length}개`}
        desc={'매장 화면 "조건 메모"에서 눌러 넣는 값이에요. "불가 · 없음"은 빨강, "가능"은 초록으로 보여요.'}
      >
        <ChipInput
          ariaLabel="자주 쓰는 조건 메모 값"
          placeholder="예: 포스터 부착 불가, 신규 메뉴 가능"
          values={notes}
          onChange={setNotes}
          maxLength={PARTNERS_NOTE_MAX_LEN}
          colorOf={(n) => NOTE_CHIP_COLOR[noteTone(n)]}
        />
      </CollabSection>

      <div className="flex items-center justify-between border-t border-stroke pt-[20px]">
        <Button
          variant="danger-soft"
          onPress={del}
          isDisabled={remove.isPending}
        >
          유형 삭제
        </Button>
        <div className="flex items-center gap-[8px]">
          {dirty && (
            <Button
              variant="tertiary"
              onPress={() => {
                setName(type.name);
                setTags(type.tags);
                setNotes(type.notes);
              }}
            >
              되돌리기
            </Button>
          )}
          <Button
            variant="primary"
            onPress={save}
            isDisabled={!dirty || update.isPending}
          >
            {update.isPending ? "저장 중…" : "저장"}
          </Button>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}

/** 유형 추가 — 이름만 받고 만든 뒤 그 유형 탭으로 간다(값은 탭에서 채운다). */
function AddTypeModal({
  isOpen,
  onOpenChange,
  onCreated,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (t: StoreType) => void;
}) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container placement="center" className="px-[16px] sm:px-0">
          <Modal.Dialog
            aria-label="유형 추가"
            className="flex w-full max-w-[420px] flex-col gap-[16px] rounded-[20px] bg-surface p-[20px] sm:p-[24px]"
          >
            <Modal.CloseTrigger
              aria-label="닫기"
              className="right-[16px] top-[16px] size-[32px] rounded-full bg-transparent p-0 text-gray-400 data-[hovered=true]:bg-gray-50 data-[hovered=true]:text-black"
            >
              <X className="size-[18px]" />
            </Modal.CloseTrigger>
            <Modal.Header className="flex flex-col gap-[4px] p-0 pr-[36px]">
              <Modal.Heading className="text-lg font-bold leading-[26px] text-black">
                유형 추가
              </Modal.Heading>
              <p className="text-sm text-disabled">
                예: 베이커리, 주점. 만든 뒤 칩 · 조건 값을 채워 주세요.
              </p>
            </Modal.Header>
            {isOpen && (
              <AddTypeBody
                onCancel={() => onOpenChange(false)}
                onCreated={onCreated}
              />
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function AddTypeBody({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (t: StoreType) => void;
}) {
  const create = useCreateStoreType();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError("유형 이름을 적어 주세요.");
      return;
    }
    try {
      onCreated(await create.mutateAsync({ name: name.trim() }));
    } catch (err) {
      setError(extractApiError(err));
    }
  };

  return (
    <>
      <HeroField label="유형 이름" required error={error ?? undefined}>
        <Input
          variant="secondary"
          fullWidth
          autoFocus
          aria-label="새 유형 이름"
          maxLength={NAME_MAX}
          placeholder="예: 베이커리"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
        />
      </HeroField>
      <div className="flex justify-end gap-[8px]">
        <Button variant="tertiary" onPress={onCancel}>
          취소
        </Button>
        <Button
          variant="primary"
          onPress={submit}
          isDisabled={create.isPending}
        >
          {create.isPending ? "만드는 중…" : "만들기"}
        </Button>
      </div>
    </>
  );
}
