"use client";

import {
  Button,
  Chip,
  Link as HeroLink,
  Input,
  Modal,
  Spinner,
  TextArea,
} from "@heroui/react";
import { ChevronLeft, ImagePlus, Phone, Trash2, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type ReactNode } from "react";

import { HeroSelect } from "@/app/admin/(main)/media/_components/heroFields";
import { LoadingState } from "@/components/common/RouteStates";
import {
  CommonTable,
  type TableColumn,
} from "@/components/common/Table/CommonTable";
import {
  useAddCollabNotice,
  useAddParticipant,
  useAdminCollab,
  useBulkParticipantStatus,
  useDeleteCollab,
  useDeleteCollabNotice,
  useDeleteParticipantPhoto,
  useUpdateParticipant,
  useUploadParticipantPhoto,
} from "@/hooks/adminCollab";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { useSonner } from "@/hooks/useSonner";
import {
  COLLAB_STATUS_LABEL,
  COLLAB_TYPE_LABEL,
  dotDate,
  dotDateTime,
  normalizeCode,
  PARTICIPANT_STATUS_LABEL,
  PHOTO_STEP_LABEL,
  PHOTO_STEPS,
  STANDING_LABEL,
} from "@/lib/adminCollab";
import { extractApiError } from "@/lib/apiError";
import { isOptimizable, mediaSrc } from "@/lib/media";
import type {
  AdminCollabDetail,
  AdminCollabParticipant,
  CollabPhotoStep,
  ParticipantStatus,
} from "@/lib/partners";
import { shrinkImage } from "@/lib/shrinkImage";

import {
  CollabPageHead,
  CollabSection,
  ParticipantChip,
  PhaseChip,
} from "../../_components/collabUi";

/** 콜라보 상세 — 일정 · 참여 매장(확정 요청 · 대리 확정 · 사진 · 재입고) · 공지. */
export function CollabDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { data, isLoading, isError } = useAdminCollab(id);
  if (isLoading) return <LoadingState />;
  if (isError || !data)
    return (
      <div className="flex flex-col items-center gap-[12px] py-[80px]">
        <p className="text-sm text-disabled">콜라보를 찾을 수 없습니다.</p>
        <Button
          variant="tertiary"
          onPress={() => router.push("/admin/collab/collabs")}
        >
          목록
        </Button>
      </div>
    );
  return <Detail collab={data} />;
}

function Detail({ collab: c }: { collab: AdminCollabDetail }) {
  const router = useRouter();
  const remove = useDeleteCollab();
  const { confirm, alert, confirmDialog } = useAdminConfirm();
  const { success } = useSonner();
  const brandSrc = c.brandImageUrl ? mediaSrc(c.brandImageUrl) : null;

  const handleDelete = async () => {
    const ok = await confirm({
      title: "콜라보를 지울까요?",
      description:
        "참여 기록 · 사진 · 공지도 함께 지워져요. 확정한 매장이 있으면 지울 수 없고, 공개 상태를 '취소'로 바꿔 이력을 남겨요.",
      confirmText: "지우기",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(c.id);
      success("콜라보를 지웠어요.");
      router.push("/admin/collab/collabs");
    } catch (err) {
      await alert({
        title: "지우지 못했어요",
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  return (
    <div className="flex flex-col gap-[20px] md:gap-[24px]">
      <Link
        href="/admin/collab/collabs"
        className="flex w-fit items-center gap-[2px] text-sm font-medium text-tone-4a5565 hover:text-black"
      >
        <ChevronLeft className="size-[16px]" />
        콜라보
      </Link>

      <CollabPageHead
        title={
          <span className="flex items-center gap-[12px]">
            {brandSrc && (
              <span className="relative size-[44px] shrink-0 overflow-hidden rounded-[10px] bg-zinc-100">
                <Image
                  src={brandSrc}
                  alt=""
                  fill
                  sizes="44px"
                  unoptimized={!isOptimizable(brandSrc)}
                  className="object-cover"
                />
              </span>
            )}
            <span className="flex flex-col">
              <span className="text-sm font-medium text-disabled">
                {c.brandName}
              </span>
              {c.title}
            </span>
          </span>
        }
        extra={
          <>
            <PhaseChip phase={c.phase} />
            {c.status !== "published" && (
              <Chip size="sm" variant="soft">
                {COLLAB_STATUS_LABEL[c.status]}
              </Chip>
            )}
          </>
        }
      >
        <Button
          size="sm"
          variant="secondary"
          onPress={() => router.push(`/admin/collab/collabs/${c.id}/edit`)}
        >
          수정
        </Button>
        <Button
          size="sm"
          variant="danger-soft"
          onPress={handleDelete}
          isDisabled={remove.isPending}
        >
          지우기
        </Button>
      </CollabPageHead>

      <InfoSection c={c} />
      <ParticipantsSection c={c} />
      <NoticesSection c={c} />
      {confirmDialog}
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-[12px] text-sm">
      <dt className="w-[96px] shrink-0 text-disabled">{label}</dt>
      <dd className="min-w-0 flex-1 text-black">{children}</dd>
    </div>
  );
}

function InfoSection({ c }: { c: AdminCollabDetail }) {
  const n = c.counts;
  return (
    <CollabSection title="일정 · 내용">
      <div className="flex flex-wrap gap-[8px]">
        {(
          [
            ["신청", n.applied],
            ["확정 요청", n.requested],
            ["확정", n.confirmed],
            ["미참여", n.declined],
            ["취소", n.cancelled],
          ] as const
        ).map(([label, v]) => (
          <span
            key={label}
            className="rounded-[8px] bg-tone-fafafc px-[10px] py-[6px] text-sm"
          >
            <span className="text-disabled">{label}</span>{" "}
            <b className="tabular-nums">{v ?? 0}</b>
          </span>
        ))}
        <span className="rounded-[8px] bg-primary-50 px-[10px] py-[6px] text-sm text-primary-800">
          목표 <b className="tabular-nums">{c.targetStores}</b>곳
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-x-[32px] gap-y-[10px] md:grid-cols-2">
        <InfoRow label="모집">
          {dotDate(c.recruitStart)} ~ {dotDate(c.recruitEnd)}
        </InfoRow>
        <InfoRow label="최종 확정 기한">
          {c.confirmDue ? dotDateTime(c.confirmDue) : "모집 마감 다음 날 18시"}
        </InfoRow>
        <InfoRow label="설치">{dotDate(c.installDate)}</InfoRow>
        <InfoRow label="콜라보 기간">
          {dotDate(c.startDate)} ~ {dotDate(c.endDate)}
        </InfoRow>
        <InfoRow label="철수">{dotDate(c.removalDate)}</InfoRow>
        <InfoRow label="점검 사진일">
          {c.checks.length
            ? c.checks
                .map((k) => `${PHOTO_STEP_LABEL[k.step]} ${dotDate(k.date)}`)
                .join(" · ")
            : "-"}
        </InfoRow>
        <InfoRow label="유형">{COLLAB_TYPE_LABEL[c.type] ?? c.type}</InfoRow>
        <InfoRow label="공간 · 수량">
          {[c.space, c.quantity ? `${c.quantity.toLocaleString()}개` : null]
            .filter(Boolean)
            .join(" · ") || "-"}
        </InfoRow>
        <InfoRow label="할 일">{c.task || "-"}</InfoRow>
        <InfoRow label="매장 혜택">{c.benefit || "-"}</InfoRow>
        <InfoRow label="진행 항목">
          {c.items.length
            ? c.items.map((it) => (
                <span key={it.label} className="block">
                  <b>{it.label}</b>
                  {it.note ? ` — ${it.note}` : ""}
                </span>
              ))
            : "-"}
        </InfoRow>
        {c.adminMemo && <InfoRow label="관리자 메모">{c.adminMemo}</InfoRow>}
      </dl>
    </CollabSection>
  );
}

type Row = AdminCollabParticipant;

const BULK: {
  status: ParticipantStatus;
  label: string;
  title: string;
  desc: string;
}[] = [
  {
    status: "requested",
    label: "확정 요청 보내기",
    title: "확정 요청을 보낼까요?",
    desc: "매장 화면에 '확정할 콜라보'로 떠요. 최종 확정 기한까지 매장이 확정해요.",
  },
  {
    status: "declined",
    label: "미참여",
    title: "미참여로 바꿀까요?",
    desc: "이번 콜라보에서 빠져요. 매장 참여 이력에 미참여로 남아요.",
  },
  {
    status: "cancelled",
    label: "취소",
    title: "참여를 취소할까요?",
    desc: "확정한 매장도 취소돼요. 매장 참여 이력에 취소로 남아요.",
  },
  {
    status: "applied",
    label: "신청으로 되돌리기",
    title: "신청 상태로 되돌릴까요?",
    desc: "확정 요청 · 미참여 · 취소를 거두고 신청 상태로 돌아가요.",
  },
];

function ParticipantsSection({ c }: { c: AdminCollabDetail }) {
  const add = useAddParticipant();
  const bulk = useBulkParticipantStatus();
  const { confirm, alert, confirmDialog } = useAdminConfirm();
  const { success } = useSonner();
  const [selected, setSelected] = useState<Row[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const open = c.participants.find((p) => p.id === openId) ?? null;

  const candidates = c.participants.filter((p) => p.standing === "candidate");
  const selectedIds = selected
    .map((s) => s.id)
    .filter((sid) => c.participants.some((p) => p.id === sid));

  const columns = useMemo<TableColumn<Row>[]>(
    () => [
      {
        name: "rank",
        label: "순서",
        className: "text-disabled",
        renderer: (p) => p.rank ?? "-",
      },
      {
        name: "standing",
        label: "입장",
        // 신청 상태일 때만 의미 있다(선정 후보 n · 예비 n) — 나머지는 상태 칸과 같다.
        renderer: (p) =>
          p.status === "applied" ? (
            <span className="whitespace-nowrap">
              {STANDING_LABEL[p.standing] ?? p.standing}
              {p.slotNo ? ` ${p.slotNo}` : ""}
            </span>
          ) : (
            <span className="text-disabled">-</span>
          ),
      },
      {
        name: "store",
        label: "매장",
        renderer: (p) => (
          <span className="flex flex-col text-left">
            <span className="whitespace-nowrap font-semibold">
              {p.storeCode} {p.storeName}
            </span>
            <span
              className="max-w-[220px] truncate text-xs text-disabled"
              title={p.storeAddress ?? ""}
            >
              {p.storeAddress}
            </span>
          </span>
        ),
      },
      {
        name: "owner",
        label: "회원",
        renderer: (p) =>
          p.partnerCode ? (
            <span className="flex flex-col text-left">
              <span className="whitespace-nowrap">
                {p.partnerCode} {p.ownerName}
              </span>
              {p.ownerPhone && (
                <span className="text-xs text-disabled">{p.ownerPhone}</span>
              )}
            </span>
          ) : (
            <span className="text-disabled">연결 전</span>
          ),
      },
      {
        name: "status",
        label: "상태",
        renderer: (p) => <ParticipantChip status={p.status} />,
      },
      {
        name: "appliedAt",
        label: "신청",
        className: "whitespace-nowrap text-disabled",
        renderer: (p) => dotDateTime(p.appliedAt),
      },
      {
        name: "confirm",
        label: "확정",
        renderer: (p) =>
          p.confirmNo ? (
            <span className="flex flex-col whitespace-nowrap text-left">
              <span className="font-semibold">{p.confirmNo}</span>
              <span className="text-xs text-disabled">
                {p.confirmer} · {dotDateTime(p.confirmedAt)}
              </span>
            </span>
          ) : (
            "-"
          ),
      },
      {
        name: "photos",
        label: "사진",
        renderer: (p) =>
          p.status === "confirmed" ? (
            <span className="tabular-nums">
              {new Set(p.photos.map((ph) => ph.step)).size}/
              {1 + c.checks.length}
            </span>
          ) : (
            "-"
          ),
      },
      {
        name: "restock",
        label: "재입고",
        renderer: (p) =>
          p.restockRequestedAt ? (
            <Chip size="sm" variant="soft" color="warning">
              요청 {dotDate(p.restockRequestedAt)}
            </Chip>
          ) : (
            "-"
          ),
      },
      {
        name: "memo",
        label: "메모",
        renderer: (p) =>
          p.adminMemo ? (
            <span className="block max-w-[140px] truncate" title={p.adminMemo}>
              {p.adminMemo}
            </span>
          ) : (
            "-"
          ),
      },
    ],
    [c.checks.length],
  );

  const runBulk = async (b: (typeof BULK)[number]) => {
    if (!selectedIds.length) return;
    const ok = await confirm({
      title: b.title,
      description: `${selectedIds.length}곳 — ${b.desc}`,
      confirmText: b.label,
    });
    if (!ok) return;
    try {
      await bulk.mutateAsync({
        collabId: c.id,
        ids: selectedIds,
        status: b.status,
      });
      success(
        `${selectedIds.length}곳을 ${PARTICIPANT_STATUS_LABEL[b.status]}(으)로 바꿨어요.`,
      );
      setSelected([]);
    } catch (err) {
      await alert({
        title: "바꾸지 못했어요",
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  const addStore = async () => {
    const storeCode = normalizeCode(code, "S");
    if (!storeCode) return;
    try {
      await add.mutateAsync({ collabId: c.id, storeCode });
      success("매장을 신청 목록에 넣었어요.", storeCode);
      setCode("");
    } catch (err) {
      await alert({
        title: "넣지 못했어요",
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  return (
    <CollabSection
      title={`참여 매장 ${c.participants.length}곳`}
      desc="신청 순서대로 목표 수만큼 선정 후보예요. 고른 매장에 확정 요청을 보내면 매장이 직접 확정해요. 줄을 누르면 사진 · 재입고 · 대리 확정을 해요."
      right={
        <form
          className="flex gap-[8px]"
          onSubmit={(e) => {
            e.preventDefault();
            void addStore();
          }}
        >
          <Input
            variant="secondary"
            aria-label="매장 ID로 추가"
            placeholder="매장 ID (S-0001)"
            className="w-[160px]"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            className="h-[36px]"
            isDisabled={!code.trim() || add.isPending}
          >
            신청 넣기
          </Button>
        </form>
      }
    >
      <div className="flex flex-wrap items-center gap-[8px]">
        <span className="text-sm text-tone-4a5565">
          {selectedIds.length}곳 선택
        </span>
        <Button
          size="sm"
          variant="tertiary"
          isDisabled={!candidates.length}
          onPress={() => setSelected(candidates)}
        >
          선정 후보 {candidates.length}곳 고르기
        </Button>
        {selectedIds.length > 0 && (
          <Button size="sm" variant="ghost" onPress={() => setSelected([])}>
            선택 풀기
          </Button>
        )}
        <span className="mx-[4px] hidden h-[20px] w-px bg-stroke sm:block" />
        {BULK.map((b) => (
          <Button
            key={b.status}
            size="sm"
            variant={b.status === "requested" ? "primary" : "secondary"}
            isDisabled={!selectedIds.length || bulk.isPending}
            onPress={() => runBulk(b)}
          >
            {b.label}
          </Button>
        ))}
      </div>

      <CommonTable<Row>
        columnList={columns}
        data={c.participants}
        idKey="id"
        useSearch={false}
        useCheckbox
        selected={selected}
        onChangeSelected={setSelected}
        pageSize={200}
        emptyMessage="아직 신청한 매장이 없어요."
        onRowClick={(p) => setOpenId(p.id)}
      />

      <ParticipantModal
        collab={c}
        participant={open}
        onClose={() => setOpenId(null)}
      />
      {confirmDialog}
    </CollabSection>
  );
}

const STATUS_OPTIONS = (
  ["applied", "requested", "confirmed", "declined", "cancelled"] as const
).map((s) => ({ value: s, label: PARTICIPANT_STATUS_LABEL[s] }));

/** 참여 매장 한 곳 — 상태(대리 확정 포함) · 단계별 사진 · 재입고 처리 · 메모. */
function ParticipantModal({
  collab: c,
  participant: p,
  onClose,
}: {
  collab: AdminCollabDetail;
  participant: AdminCollabParticipant | null;
  onClose: () => void;
}) {
  return (
    <Modal isOpen={!!p} onOpenChange={(v) => !v && onClose()}>
      <Modal.Backdrop>
        <Modal.Container placement="center" className="px-[16px] sm:px-0">
          <Modal.Dialog
            aria-label="참여 매장"
            className="max-h-[90dvh] w-full max-w-[640px] gap-0 overflow-y-auto rounded-[20px] bg-surface p-[20px] sm:p-[28px]"
          >
            <Modal.CloseTrigger
              aria-label="닫기"
              className="right-[16px] top-[16px] size-[32px] rounded-full bg-transparent p-0 text-gray-400 data-[hovered=true]:bg-gray-50 data-[hovered=true]:text-black"
            >
              <X className="size-[18px]" />
            </Modal.CloseTrigger>
            {p && <ParticipantBody key={p.id} c={c} p={p} />}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function ParticipantBody({
  c,
  p,
}: {
  c: AdminCollabDetail;
  p: AdminCollabParticipant;
}) {
  const update = useUpdateParticipant();
  const { success, error } = useSonner();
  const [status, setStatus] = useState<ParticipantStatus>(p.status);
  const [confirmer, setConfirmer] = useState("");
  const [memo, setMemo] = useState(p.adminMemo ?? "");

  const patch = async (
    payload: Parameters<typeof update.mutateAsync>[0]["payload"],
    done: string,
  ) => {
    try {
      await update.mutateAsync({ id: p.id, payload });
      success(done);
    } catch (err) {
      error("저장하지 못했어요.", extractApiError(err));
    }
  };

  const stepDate = (step: CollabPhotoStep) =>
    step === "install"
      ? c.installDate
      : (c.checks.find((k) => k.step === step)?.date ?? null);

  return (
    <div className="flex flex-col gap-[20px]">
      <Modal.Header className="flex flex-col gap-[4px] p-0 pr-[36px]">
        <Modal.Heading className="text-lg font-bold leading-[26px] text-black">
          {p.storeCode} {p.storeName}
        </Modal.Heading>
        <p className="flex flex-wrap items-center gap-x-[8px] text-sm text-tone-4a5565">
          {p.partnerCode ? (
            <span>
              {p.partnerCode} {p.ownerName}
            </span>
          ) : (
            <span className="text-disabled">회원 연결 전</span>
          )}
          {p.ownerPhone && (
            <HeroLink
              href={`tel:${p.ownerPhone}`}
              className="flex items-center gap-[2px] text-xs text-primary-800 no-underline"
            >
              <Phone className="size-[12px]" />
              {p.ownerPhone}
            </HeroLink>
          )}
        </p>
        <p className="text-xs text-disabled">{p.storeAddress}</p>
      </Modal.Header>

      <div className="flex flex-col gap-[10px] rounded-[12px] border border-stroke p-[14px]">
        <div className="flex flex-wrap items-center gap-[8px] text-sm">
          <ParticipantChip status={p.status} />
          {p.status === "applied" && (
            <span className="text-tone-4a5565">
              {STANDING_LABEL[p.standing] ?? p.standing}
              {p.slotNo ? ` ${p.slotNo}` : ""}
            </span>
          )}
          <span className="text-xs text-disabled">
            신청 {dotDateTime(p.appliedAt)}
            {p.requestedAt && ` · 확정 요청 ${dotDateTime(p.requestedAt)}`}
          </span>
        </div>
        {p.confirmNo && (
          <p className="text-sm">
            확정 <b>{p.confirmNo}</b> · {p.confirmer} ·{" "}
            {dotDateTime(p.confirmedAt)}
          </p>
        )}
        <div className="flex flex-wrap items-end gap-[8px]">
          <div className="w-[150px]">
            <HeroSelect
              ariaLabel="상태"
              allowEmpty={false}
              value={status}
              onChange={(v) => setStatus(v as ParticipantStatus)}
              options={STATUS_OPTIONS}
            />
          </div>
          {status === "confirmed" && p.status !== "confirmed" && (
            <Input
              variant="secondary"
              aria-label="확정한 사람"
              placeholder="확정한 사람(비우면 admix 대리 확정)"
              className="min-w-[200px] flex-1"
              value={confirmer}
              onChange={(e) => setConfirmer(e.target.value)}
            />
          )}
          <Button
            size="sm"
            variant="primary"
            className="h-[36px]"
            isDisabled={status === p.status || update.isPending}
            onPress={() =>
              patch(
                {
                  status,
                  ...(status === "confirmed"
                    ? { confirmer: confirmer.trim() || null }
                    : {}),
                },
                `${PARTICIPANT_STATUS_LABEL[status]}(으)로 바꿨어요.`,
              )
            }
          >
            상태 바꾸기
          </Button>
        </div>
      </div>

      {p.restockRequestedAt && (
        <div className="flex items-center justify-between gap-[8px] rounded-[12px] bg-tone-fdf6e3 px-[14px] py-[10px] text-sm">
          <span>
            재입고 요청 <b>{dotDateTime(p.restockRequestedAt)}</b>
          </span>
          <Button
            size="sm"
            variant="secondary"
            isDisabled={update.isPending}
            onPress={() =>
              patch({ restock_done: true }, "재입고 요청을 처리했어요.")
            }
          >
            처리 완료
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-[10px]">
        <p className="text-sm font-semibold text-black">설치 · 점검 사진</p>
        <div className="grid grid-cols-2 gap-[10px] sm:grid-cols-4">
          {PHOTO_STEPS.filter(
            (s) => s === "install" || c.checks.some((k) => k.step === s),
          ).map((step) => (
            <PhotoSlot
              key={step}
              participantId={p.id}
              step={step}
              date={stepDate(step)}
              photo={p.photos.find((ph) => ph.step === step) ?? null}
            />
          ))}
        </div>
        <p className="text-xs text-disabled">
          설치 사진은 admix가, 점검 사진은 매장이 올려요. 매장 대신 올려도
          돼요(긴 변 1600px로 줄여요).
        </p>
      </div>

      <div className="flex flex-col gap-[8px]">
        <p className="text-sm font-semibold text-black">관리자 메모</p>
        <TextArea
          variant="secondary"
          fullWidth
          rows={2}
          aria-label="관리자 메모"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
        <Button
          size="sm"
          variant="secondary"
          className="self-end"
          isDisabled={memo.trim() === (p.adminMemo ?? "") || update.isPending}
          onPress={() =>
            patch({ admin_memo: memo.trim() || null }, "메모를 저장했어요.")
          }
        >
          메모 저장
        </Button>
      </div>
    </div>
  );
}

function PhotoSlot({
  participantId,
  step,
  date,
  photo,
}: {
  participantId: string;
  step: CollabPhotoStep;
  date: string | null;
  photo: AdminCollabParticipant["photos"][number] | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadParticipantPhoto();
  const remove = useDeleteParticipantPhoto();
  const { error } = useSonner();
  const src = photo ? mediaSrc(photo.url) : null;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const small = await shrinkImage(file, { maxSide: 1600 });
      await upload.mutateAsync({ participantId, step, file: small });
    } catch (err) {
      error("사진을 올리지 못했어요.", extractApiError(err));
    }
  };

  return (
    <div className="flex flex-col gap-[6px]">
      <div className="flex items-baseline justify-between gap-[4px] text-xs">
        <span className="font-semibold text-black">
          {PHOTO_STEP_LABEL[step]}
        </span>
        <span className="text-disabled">
          {date ? dotDate(date).slice(5) : ""}
        </span>
      </div>
      <div className="relative aspect-square overflow-hidden rounded-[10px] border border-stroke bg-tone-fafafc">
        {src ? (
          <>
            <HeroLink
              href={src}
              target="_blank"
              rel="noreferrer"
              aria-label="사진 크게 보기"
              className="absolute inset-0 block"
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="160px"
                unoptimized={!isOptimizable(src)}
                className="object-cover"
              />
            </HeroLink>
            <Button
              isIconOnly
              size="sm"
              variant="tertiary"
              aria-label="사진 지우기"
              isDisabled={remove.isPending}
              onPress={() =>
                photo &&
                remove
                  .mutateAsync(photo.id)
                  .catch((err) =>
                    error("지우지 못했어요.", extractApiError(err)),
                  )
              }
              className="absolute right-[4px] top-[4px]"
            >
              <Trash2 className="size-[12px]" />
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            isDisabled={upload.isPending}
            onPress={() => inputRef.current?.click()}
            className="size-full h-full flex-col gap-[4px] rounded-none text-xs font-medium text-tone-4a5565 data-[hovered=true]:text-primary-800"
          >
            {upload.isPending ? (
              <Spinner size="sm" />
            ) : (
              <>
                <ImagePlus className="size-[20px]" />
                올리기
              </>
            )}
          </Button>
        )}
      </div>
      {photo && (
        <span className="text-[11px] text-disabled">
          {photo.by === "admix" ? "admix" : "매장"} · {dotDateTime(photo.at)}
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function NoticesSection({ c }: { c: AdminCollabDetail }) {
  const add = useAddCollabNotice();
  const remove = useDeleteCollabNotice();
  const { confirm, alert, confirmDialog } = useAdminConfirm();
  const { success } = useSonner();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const submit = async () => {
    if (!title.trim() || !body.trim()) return;
    try {
      await add.mutateAsync({
        collabId: c.id,
        payload: { title: title.trim(), body: body.trim() },
      });
      success("공지를 올렸어요.");
      setTitle("");
      setBody("");
    } catch (err) {
      await alert({
        title: "올리지 못했어요",
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  const del = async (id: string, t: string) => {
    const ok = await confirm({
      title: "공지를 지울까요?",
      description: t,
      confirmText: "지우기",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(id);
      success("공지를 지웠어요.");
    } catch (err) {
      await alert({
        title: "지우지 못했어요",
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  return (
    <CollabSection
      title={`공지 ${c.notices.length}건`}
      desc="확정 요청을 받았거나 확정한 매장의 콜라보 상세에 보여요."
    >
      {c.notices.length > 0 && (
        <ul className="flex flex-col divide-y divide-stroke rounded-[10px] border border-stroke">
          {c.notices.map((n) => (
            <li key={n.id} className="flex items-start gap-[12px] p-[14px]">
              <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
                <p className="text-sm font-semibold text-black">{n.title}</p>
                <p className="whitespace-pre-wrap text-sm text-tone-4a5565">
                  {n.body}
                </p>
                <p className="text-xs text-disabled">
                  {n.author} · {dotDateTime(n.createdAt)}
                </p>
              </div>
              <Button
                isIconOnly
                size="sm"
                variant="tertiary"
                aria-label="공지 지우기"
                onPress={() => del(n.id, n.title)}
              >
                <Trash2 className="size-[14px]" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-[8px]">
        <Input
          variant="secondary"
          fullWidth
          aria-label="공지 제목"
          placeholder="제목 예: 설치를 마쳤어요"
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <TextArea
          variant="secondary"
          fullWidth
          rows={3}
          aria-label="공지 내용"
          placeholder="내용"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <Button
          variant="primary"
          size="sm"
          className="self-end"
          isDisabled={!title.trim() || !body.trim() || add.isPending}
          onPress={submit}
        >
          공지 올리기
        </Button>
      </div>
      {confirmDialog}
    </CollabSection>
  );
}
