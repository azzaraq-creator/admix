"use client";

import {
  Button,
  Card,
  Chip,
  Input,
  Link,
  RouterProvider,
  TextArea,
} from "@heroui/react";
import { ChevronLeft, Copy, FileText, Phone, Search } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { HeroField } from "@/app/admin/(main)/media/_components/heroFields";
import { LoadingState } from "@/components/common/RouteStates";
import {
  adminCollabApi,
  useBizAction,
  useCollabMember,
  useLinkStore,
  useUnlinkStore,
  useUpdateCollabMember,
} from "@/hooks/adminCollab";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { useSonner } from "@/hooks/useSonner";
import { dotDateTime, type BizAction } from "@/lib/adminCollab";
import { extractApiError } from "@/lib/apiError";
import { bizStatusLabel } from "@/lib/bizStatus";
import { isOptimizable, mediaSrc } from "@/lib/media";
import type { AdminPartnerMember, AdminPartnersStore } from "@/lib/partners";
import {
  formatPhone,
  formatPhoneInput,
  PHONE_INPUT_MAX_LENGTH,
} from "@/lib/phone";
import { cn } from "@/lib/utils";

import { openOrDownloadBlob } from "../../_components/collabUi";
import { StoreSearchModal } from "../../_components/StoreSearchModal";

const MEMBERS_HREF = "/admin/collab/members";
const BIG = "h-[48px] text-base font-semibold sm:h-[40px] sm:text-sm";
/** 사업자 인증 버튼 — 휴대폰에선 한 줄을 꽉 채워 현장에서 누르기 쉽게. */
const BIG_BLOCK = `${BIG} w-full sm:w-auto`;

type BizCode = AdminPartnerMember["bizStatus"];

/** 사업자 상태마다 한 줄 안내 — 담당자가 지금 무엇을 하면 되는지. */
const BIZ_GUIDE: Record<BizCode, string> = {
  unregistered:
    "아직 사업자등록증을 올리지 않았어요. 현장에 함께 있다면 임시 승인으로 협약 단계로 넘겨 주세요.",
  reviewing: "등록증을 올렸어요. 파일을 확인하고 인증 완료 또는 반려해 주세요.",
  provisional:
    "임시 승인 상태예요. 협약은 진행할 수 있고, 나중에 등록증을 받아 인증 완료로 바꿔 주세요.",
  verified: "사업자 인증을 마쳤어요.",
  rejected: "반려한 상태예요. 다시 올리면 검토 대기로 바뀌어요.",
};

/** 사업자 상태 칩 색(HeroUI Chip). */
const BIZ_CHIP_COLOR: Record<
  BizCode,
  "default" | "accent" | "success" | "warning" | "danger"
> = {
  unregistered: "default",
  reviewing: "warning",
  provisional: "accent",
  verified: "success",
  rejected: "danger",
};

/** 기본협약 서명자 구분(078). */
const SIGNER_ROLE_LABEL: Record<string, string> = {
  representative: "대표자",
  delegate: "위임받은 담당자",
};

function BizChip({ status }: { status: BizCode }) {
  return (
    <Chip size="sm" variant="soft" color={BIZ_CHIP_COLOR[status]}>
      {bizStatusLabel(status)}
    </Chip>
  );
}

/** 머리 아래 계정 정보 한 칸 — 작은 이름표 · 값. */
function MetaItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-[2px]">
      <dt className="text-xs font-medium text-disabled">{label}</dt>
      <dd className="min-w-0 text-sm font-medium text-black">{children}</dd>
    </div>
  );
}

/** 구역 하나 — HeroUI Card(테두리만, 그림자 없음). */
function Section({
  title,
  desc,
  right,
  className,
  children,
}: {
  title: ReactNode;
  desc?: ReactNode;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card
      className={cn(
        "gap-[16px] border border-stroke p-[16px] shadow-none md:p-[24px]",
        className,
      )}
    >
      <Card.Header className="flex-row flex-wrap items-start justify-between gap-[8px]">
        <div className="flex min-w-0 flex-col gap-[2px]">
          <Card.Title className="text-base font-bold leading-[24px] text-black md:text-lg md:leading-[28px]">
            {title}
          </Card.Title>
          {desc && (
            <Card.Description className="text-sm">{desc}</Card.Description>
          )}
        </div>
        {right}
      </Card.Header>
      <Card.Content className="flex flex-col gap-[16px]">{children}</Card.Content>
    </Card>
  );
}

/**
 * 제휴사 회원 상세 — 위쪽에 사업자 인증(임시 승인 · 인증 완료 · 반려 · 되돌리기)을 크게 둔다.
 * 담당자가 매장에서 휴대폰으로 같이 가입하고 그 자리에서 임시 승인 → 협약으로 넘기는 흐름.
 * 모두 HeroUI 컴포넌트(2026-11-10 사용자) — 링크는 RouterProvider 로 새로고침 없이 넘어간다.
 */
export function CollabMemberDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { data: member, isLoading, isError } = useCollabMember(id);

  if (isLoading) return <LoadingState />;
  if (isError || !member)
    return (
      <div className="flex flex-col items-center gap-[12px] py-[80px]">
        <p className="text-sm text-disabled">회원을 찾을 수 없습니다.</p>
        <Button variant="tertiary" onPress={() => router.push(MEMBERS_HREF)}>
          목록
        </Button>
      </div>
    );
  return (
    <RouterProvider navigate={(href) => router.push(href)}>
      <MemberDetail member={member} />
    </RouterProvider>
  );
}

function MemberDetail({ member }: { member: AdminPartnerMember }) {
  const { success, error } = useSonner();

  const copyCode = async () => {
    if (!member.partnerCode) return;
    try {
      await navigator.clipboard.writeText(member.partnerCode);
      success("고유번호를 복사했어요.", member.partnerCode);
    } catch {
      error("복사하지 못했어요.");
    }
  };

  return (
    <div className="flex flex-col gap-[20px] md:gap-[24px]">
      <Link
        href={MEMBERS_HREF}
        className="flex w-fit items-center gap-[2px] text-sm font-medium text-tone-4a5565 no-underline hover:text-black"
      >
        <ChevronLeft className="size-[16px]" />
        제휴사 회원
      </Link>

      <div className="flex flex-col gap-[6px]">
        <div className="flex flex-wrap items-center gap-[8px]">
          <h1 className="text-xl font-bold leading-[28px] text-black md:text-2xl md:leading-[32px]">
            {member.name || member.loginId}
          </h1>
          {member.partnerCode && (
            <Button
              size="sm"
              variant="secondary"
              aria-label={`고유번호 ${member.partnerCode} 복사`}
              onPress={copyCode}
              className="font-bold text-primary-800"
            >
              {member.partnerCode}
              <Copy className="size-[14px]" />
            </Button>
          )}
        </div>
      </div>

      {/* 계정 한눈에 — 이름표(작게) 위 · 값 아래, PC 4칸 · 휴대폰 2칸(2026-11-10 사용자: 깔끔하고 읽기 쉽게). */}
      <Card variant="secondary" className="p-[16px] shadow-none md:px-[24px]">
        <dl className="grid grid-cols-2 gap-x-[24px] gap-y-[14px] md:grid-cols-4">
          <MetaItem label={member.snsProvider ? `아이디 · ${member.snsProvider}` : "아이디"}>
            <span className="block truncate" title={member.loginId}>
              {member.loginId}
            </span>
          </MetaItem>
          <MetaItem label="연락처">
            {member.phone ? (
              <Link
                href={`tel:${member.phone}`}
                className="inline-flex items-center gap-[4px] text-sm font-medium text-primary-800 no-underline"
              >
                <Phone className="size-[13px]" />
                <span className="tabular-nums">
                  {formatPhone(member.phone)}
                </span>
              </Link>
            ) : (
              <span className="text-disabled">없음</span>
            )}
          </MetaItem>
          <MetaItem label="가입일시">
            <span className="tabular-nums">
              {dotDateTime(member.createdAt)}
            </span>
          </MetaItem>
          <MetaItem label="마지막 업데이트">
            <span className="tabular-nums">
              {dotDateTime(member.updatedAt)}
            </span>
          </MetaItem>
        </dl>
      </Card>

      <BizSection member={member} />
      <AgreementSection member={member} />
      <StoresSection member={member} />
      <AccountSection member={member} />
    </div>
  );
}

function BizSection({ member }: { member: AdminPartnerMember }) {
  const action = useBizAction();
  const { confirm, alert, confirmDialog } = useAdminConfirm();
  const { success } = useSonner();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [opening, setOpening] = useState(false);
  const status = member.bizStatus;
  const hasFile = !!member.bizFileName;

  const run = async (
    act: BizAction,
    done: string,
    detail?: string,
    why?: string,
  ) => {
    try {
      await action.mutateAsync({ id: member.id, action: act, reason: why });
      success(done, detail);
      setRejecting(false);
      setReason("");
    } catch (err) {
      await alert({
        title: "처리하지 못했어요",
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  const provisional = async () => {
    const ok = await confirm({
      title: "임시 승인할까요?",
      description:
        "등록증 없이 기본협약으로 넘어갈 수 있어요. 나중에 등록증을 받아 인증 완료로 바꿔 주세요.",
      confirmText: "임시 승인",
    });
    if (ok)
      await run(
        "provisional",
        "임시 승인했어요.",
        "제휴사 화면에서 협약을 이어서 할 수 있어요.",
      );
  };
  const verify = async () => {
    const ok = await confirm({
      title: "사업자 인증을 마칠까요?",
      description: hasFile
        ? "올린 사업자등록증을 확인했다면 인증 완료로 바꿔요."
        : "아직 올린 등록증 파일이 없어요. 실물을 확인했다면 인증 완료로 바꿔요.",
      confirmText: "인증 완료",
    });
    if (ok) await run("verify", "사업자 인증을 마쳤어요.");
  };
  const reset = async () => {
    const ok = await confirm({
      title: "인증 상태를 되돌릴까요?",
      description: hasFile
        ? "검토 대기로 돌아가요."
        : "미등록으로 돌아가요. 이미 동의한 협약은 그대로예요.",
      confirmText: "되돌리기",
    });
    if (ok) await run("reset", "인증 상태를 되돌렸어요.");
  };

  const openFile = async () => {
    setOpening(true);
    try {
      const blob = await adminCollabApi.bizFile(member.id);
      openOrDownloadBlob(blob, member.bizFileName ?? "사업자등록증");
    } catch (err) {
      await alert({
        title: "파일을 열지 못했어요",
        description: extractApiError(err),
        confirmText: "확인",
      });
    } finally {
      setOpening(false);
    }
  };

  const canProvisional = ["unregistered", "reviewing", "rejected"].includes(
    status,
  );
  const canVerify =
    status !== "verified" && (hasFile || status === "provisional");
  const canReject =
    hasFile && (status === "reviewing" || status === "provisional");
  const canReset = ["provisional", "verified", "rejected"].includes(status);
  const busy = action.isPending;

  return (
    <Section
      title="사업자 인증"
      right={<BizChip status={status} />}
      className={
        status === "unregistered" || status === "reviewing"
          ? "border-primary/40 bg-primary-50/30"
          : undefined
      }
    >
      <p className="text-sm text-tone-4a5565">{BIZ_GUIDE[status]}</p>

      <div className="flex flex-col gap-[4px] text-sm">
        {hasFile ? (
          <Card
            variant="secondary"
            className="flex-row flex-wrap items-center justify-between gap-[8px] px-[14px] py-[10px] shadow-none"
          >
            <span className="flex min-w-0 items-center gap-[8px]">
              <FileText className="size-[18px] shrink-0 text-tone-4a5565" />
              <span className="min-w-0">
                <span className="block truncate font-semibold text-black">
                  {member.bizFileName}
                </span>
                <span className="text-xs text-disabled">
                  {dotDateTime(member.bizUploadedAt)} 올림
                </span>
              </span>
            </span>
            <Button
              size="sm"
              variant="secondary"
              onPress={openFile}
              isDisabled={opening}
            >
              {opening ? "여는 중…" : "파일 보기"}
            </Button>
          </Card>
        ) : (
          <p className="text-xs text-disabled">올린 등록증 파일이 없어요.</p>
        )}
        {member.bizProvisionalAt && (
          <p className="text-xs text-disabled">
            임시 승인 {dotDateTime(member.bizProvisionalAt)}
          </p>
        )}
        {member.bizVerifiedAt && status === "verified" && (
          <p className="text-xs text-disabled">
            인증 완료 {dotDateTime(member.bizVerifiedAt)}
          </p>
        )}
        {status === "rejected" && member.bizRejectReason && (
          <p className="text-xs text-[#ef4444]">
            반려 사유: {member.bizRejectReason}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-[8px] sm:flex sm:flex-wrap">
        {canProvisional && (
          <Button
            variant="primary"
            className={BIG_BLOCK}
            onPress={provisional}
            isDisabled={busy}
          >
            임시 승인
          </Button>
        )}
        {canVerify && (
          <Button
            variant={canProvisional ? "secondary" : "primary"}
            className={BIG_BLOCK}
            onPress={verify}
            isDisabled={busy}
          >
            인증 완료
          </Button>
        )}
        {canReject && !rejecting && (
          <Button
            variant="danger-soft"
            className={BIG_BLOCK}
            onPress={() => setRejecting(true)}
            isDisabled={busy}
          >
            반려
          </Button>
        )}
        {canReset && (
          <Button
            variant="tertiary"
            className={BIG_BLOCK}
            onPress={reset}
            isDisabled={busy}
          >
            되돌리기
          </Button>
        )}
      </div>

      {rejecting && (
        <div className="flex flex-col gap-[8px]">
          <TextArea
            variant="secondary"
            fullWidth
            rows={2}
            aria-label="반려 사유"
            placeholder="반려 사유(제휴사에게 보여요) 예: 사진이 흐려 사업자번호가 보이지 않아요."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-[8px]">
            <Button
              variant="danger"
              className={BIG_BLOCK}
              isDisabled={busy}
              onPress={() =>
                run(
                  "reject",
                  "반려했어요.",
                  undefined,
                  reason.trim() || undefined,
                )
              }
            >
              반려하기
            </Button>
            <Button
              variant="tertiary"
              className={BIG_BLOCK}
              onPress={() => {
                setRejecting(false);
                setReason("");
              }}
            >
              닫기
            </Button>
          </div>
        </div>
      )}
      {confirmDialog}
    </Section>
  );
}

/**
 * 기본협약 — 동의 시각 · 판(version)과 전자 서명(078: 서명자 이름 · 구분 · 손 서명 그림 · 동의 때 IP, 서명 시각 = 동의 시각).
 * 서명 도입 전에 동의한 회원은 서명 기록이 비어 있다.
 */
function AgreementSection({ member }: { member: AdminPartnerMember }) {
  const agreed = !!member.agreedAt;
  const signature = member.signatureUrl ? mediaSrc(member.signatureUrl) : null;
  return (
    <Section
      title="기본협약"
      right={
        <Chip size="sm" variant="soft" color={agreed ? "success" : "warning"}>
          {agreed ? "협약 완료" : "협약 전"}
        </Chip>
      }
    >
      <p className="text-sm text-tone-4a5565">
        {agreed
          ? `${dotDateTime(member.agreedAt)}에 기본협약(${member.agreementVersion ?? "-"})에 동의했어요.`
          : member.bizStatus === "unregistered" ||
              member.bizStatus === "rejected"
            ? "사업자등록증을 올리거나 임시 승인을 받아야 협약할 수 있어요."
            : "제휴사 화면에서 협약을 이어서 하면 돼요."}
      </p>
      {agreed &&
        (signature ? (
          <div className="flex flex-col gap-[12px] sm:flex-row sm:items-center sm:gap-[20px]">
            {/* 투명 PNG(짙은 남색 잉크) — 흰 바탕 위에. */}
            <div className="relative h-[96px] w-full max-w-[260px] overflow-hidden rounded-[10px] border border-stroke bg-white">
              <Image
                src={signature}
                alt={`${member.signerName ?? "서명자"} 서명`}
                fill
                sizes="260px"
                unoptimized={!isOptimizable(signature)}
                className="object-contain p-[8px]"
              />
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-[12px] gap-y-[4px] text-sm">
              <dt className="text-disabled">서명자</dt>
              <dd className="font-medium text-black">
                {member.signerName ?? "-"}
                {member.signerRole && (
                  <span className="ml-[6px] text-tone-4a5565">
                    {SIGNER_ROLE_LABEL[member.signerRole] ?? member.signerRole}
                  </span>
                )}
              </dd>
              <dt className="text-disabled">서명 시각</dt>
              <dd className="tabular-nums text-black">
                {dotDateTime(member.agreedAt)}
              </dd>
              <dt className="text-disabled">IP</dt>
              <dd className="tabular-nums text-black">
                {member.signedIp ?? "-"}
              </dd>
            </dl>
          </div>
        ) : (
          <p className="text-xs text-disabled">
            서명 기록 없음(서명 도입 전 동의)
          </p>
        ))}
    </Section>
  );
}

function StoresSection({ member }: { member: AdminPartnerMember }) {
  const link = useLinkStore();
  const unlink = useUnlinkStore();
  const { confirm, alert, confirmDialog } = useAdminConfirm();
  const { success } = useSonner();
  const [searching, setSearching] = useState(false);

  /** 매장 검색 창에서 고른 매장 — 다른 회원 매장이면 옮길지 묻는다. */
  const doLink = async (store: AdminPartnersStore) => {
    setSearching(false);
    if (!store.storeCode) return;
    if (store.ownerUserId && store.ownerUserId !== member.id) {
      const owner =
        `${store.ownerPartnerCode ?? ""} ${store.ownerMemberName || store.ownerCompanyName || store.ownerLoginId || ""}`.trim();
      const ok = await confirm({
        title: "이 회원으로 옮길까요?",
        description: `${store.name}은(는) 지금 ${owner || "다른 회원"}에게 연결돼 있어요. 옮기면 그 회원의 내 매장에서 빠져요.`,
        confirmText: "옮기기",
      });
      if (!ok) return;
    }
    try {
      await link.mutateAsync({ id: member.id, storeCode: store.storeCode });
      success("매장을 연결했어요.", `${store.storeCode} ${store.name}`);
    } catch (err) {
      await alert({
        title: "연결하지 못했어요",
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  const doUnlink = async (storeId: string, name: string) => {
    const ok = await confirm({
      title: `${name} 연결을 끊을까요?`,
      description:
        "매장은 지워지지 않고 연결 전 매장으로 남아요. 이 회원의 내 매장에서 빠져요.",
      confirmText: "연결 끊기",
    });
    if (!ok) return;
    try {
      await unlink.mutateAsync({ id: member.id, storeId });
      success("연결을 끊었어요.", name);
    } catch (err) {
      await alert({
        title: "연결을 끊지 못했어요",
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  return (
    <Section
      title={`매장 ${member.stores.length}곳`}
      desc="어드민에 등록한 매장을 검색해 이 회원과 연결해요. 다른 회원에게 연결돼 있던 매장이면 이 회원으로 옮겨요."
      right={
        <Link
          href="/admin/collab/stores?linked=no"
          className="text-xs font-medium text-primary-800"
        >
          연결 전 매장 보기
        </Link>
      }
    >
      {member.stores.length > 0 && (
        <ul className="flex flex-col gap-[8px]">
          {member.stores.map((s) => (
            <li key={s.id}>
              <Card
                variant="secondary"
                className="flex-row items-center justify-between gap-[8px] px-[14px] py-[10px] shadow-none"
              >
                <Link
                  href={`/admin/collab/stores/${s.id}`}
                  className="flex min-w-0 items-center gap-[8px] text-sm text-black no-underline"
                >
                  <span className="shrink-0 font-bold">
                    {s.storeCode ?? "-"}
                  </span>
                  <span className="min-w-0 truncate underline-offset-2 hover:underline">
                    {s.name}
                  </span>
                  <Chip
                    size="sm"
                    variant="soft"
                    color={s.status === "active" ? "accent" : "default"}
                  >
                    {s.status === "active" ? "공개" : "비공개"}
                  </Chip>
                </Link>
                <Button
                  size="sm"
                  variant="tertiary"
                  isDisabled={unlink.isPending}
                  onPress={() => doUnlink(s.id, s.name)}
                >
                  연결 끊기
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {/* 매장 상세의 "회원 검색"처럼 — 검색 창에서 골라 바로 연결한다(2026-11-10 사용자). */}
      <Button
        variant="primary"
        className={`${BIG} w-full sm:w-fit`}
        isDisabled={link.isPending}
        onPress={() => setSearching(true)}
      >
        <Search className="size-[16px]" />
        {link.isPending ? "연결 중…" : "매장 검색해서 연결"}
      </Button>
      <StoreSearchModal
        isOpen={searching}
        onOpenChange={setSearching}
        memberId={member.id}
        onSelect={(store) => void doLink(store)}
      />
      {confirmDialog}
    </Section>
  );
}

/**
 * 계정 정보 — 연락처는 여기서 바꾼다(입력하면 '-'가 자동으로, 저장은 숫자만). 비밀번호는 어드민에서 바꾸지 않고 따로 문의(2026-11-10 사용자).
 */
function AccountSection({ member }: { member: AdminPartnerMember }) {
  const update = useUpdateCollabMember();
  const { confirm, alert, confirmDialog } = useAdminConfirm();
  const { success } = useSonner();
  const [phone, setPhone] = useState(() => formatPhoneInput(member.phone ?? ""));
  const digits = phone.replace(/\D/g, "");
  const changed = digits !== (member.phone ?? "");
  const invalid = digits.length > 0 && (digits.length < 9 || digits.length > 11);

  const save = async () => {
    if (invalid) return;
    if (!digits) {
      const ok = await confirm({
        title: "연락처를 지울까요?",
        description: "비워 두고 저장하면 이 회원의 연락처가 없어져요.",
        confirmText: "지우기",
      });
      if (!ok) return;
    }
    try {
      await update.mutateAsync({ id: member.id, phone: digits || null });
      success(
        "연락처를 바꿨어요.",
        digits ? formatPhone(digits) : "연락처를 지웠어요.",
      );
    } catch (err) {
      await alert({
        title: "연락처를 바꾸지 못했어요",
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  return (
    <Section title="계정 정보">
      <div className="grid grid-cols-1 gap-x-[24px] gap-y-[16px] md:grid-cols-2">
        <HeroField
          label="연락처"
          error={invalid ? "9 ~ 11자리 숫자로 적어 주세요." : undefined}
        >
          <form
            className="flex items-center gap-[8px]"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Input
              variant="secondary"
              fullWidth
              type="tel"
              inputMode="tel"
              autoComplete="off"
              aria-label="연락처"
              placeholder="010-1234-5678"
              maxLength={PHONE_INPUT_MAX_LENGTH}
              value={phone}
              onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
              className="h-[48px] text-base sm:h-[40px] sm:text-sm"
            />
            <Button
              type="submit"
              variant="primary"
              className={`${BIG} shrink-0`}
              isDisabled={!changed || invalid || update.isPending}
            >
              {update.isPending ? "저장 중…" : "저장"}
            </Button>
          </form>
        </HeroField>
      </div>
      <p className="text-xs text-disabled">
        비밀번호는 여기서 바꿀 수 없어요. 따로 문의해 주세요.
      </p>
      {confirmDialog}
    </Section>
  );
}
