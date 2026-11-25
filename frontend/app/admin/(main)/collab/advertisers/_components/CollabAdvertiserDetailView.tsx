"use client";

import { Button, Input, Link as HeroLink, TextArea } from "@heroui/react";
import { ChevronLeft, Phone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { HeroField } from "@/app/admin/(main)/media/_components/heroFields";
import { MaskIcon } from "@/components/common/MaskIcon";
import { LoadingState } from "@/components/common/RouteStates";
import { useAdminMe, isCollabOnlyAdmin } from "@/hooks/adminAuth";
import {
  adminCollabApi,
  useAdvertiserBizAction,
  useCollabAdvertiser,
  useUpdateAdvertiserBiz,
} from "@/hooks/adminCollab";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { useSonner } from "@/hooks/useSonner";
import {
  dotDate,
  dotDateTime,
  type AdminAdvertiserMember,
  type AdvertiserBizAction,
  type AdvertiserBizRejection,
} from "@/lib/adminCollab";
import { extractApiError } from "@/lib/apiError";
import { formatBizNoInput, isBizNoComplete } from "@/lib/bizNo";
import { BizStatusBadge, bizStatusLabel } from "@/lib/bizStatus";
import { formatPhone } from "@/lib/phone";

import {
  CollabPageHead,
  CollabSection,
  MarketingChecks,
  openFileInNewTab,
} from "../../_components/collabUi";
import { BrandThumb } from "./CollabAdvertisersListView";

/**
 * 광고주 회원 상세(11-10) — 콜라보 담당자가 의뢰한 광고주가 누구인지 확인하는 화면.
 * 담당자 정보 → 브랜드 → 사업자 인증 순(명함은 11-11 사용자 요청으로 뺌). 계정 수정은 admix 회원 관리에서 한다.
 * 상호 · 사업자번호는 여기서 직접 적어 저장하고(11-11 사용자), 사업자 인증(인증 완료 · 반려 · 되돌리기)도 여기서 한다(11-18 사용자).
 */
export function CollabAdvertiserDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { data: member, isLoading, isError } = useCollabAdvertiser(id);

  if (isLoading) return <LoadingState />;
  if (isError || !member)
    return (
      <div className="flex flex-col items-center gap-[12px] py-[80px]">
        <p className="text-sm text-disabled">회원을 찾을 수 없습니다.</p>
        <Button
          variant="tertiary"
          onPress={() => router.push("/admin/collab/advertisers")}
        >
          목록
        </Button>
      </div>
    );
  return <AdvertiserDetail member={member} />;
}

function AdvertiserDetail({ member }: { member: AdminAdvertiserMember }) {
  const { data: me } = useAdminMe();
  // 콜라보 권한만 있는 관리자는 admix 회원 관리에 못 들어가므로 링크 대신 안내 문구.
  const canOpenAdmix = !!me && !isCollabOnlyAdmin(me);

  return (
    <div className="flex flex-col gap-[20px] md:gap-[24px]">
      <Link
        href="/admin/collab/advertisers"
        className="flex w-fit items-center gap-[2px] text-sm font-medium text-tone-4a5565 hover:text-black"
      >
        <ChevronLeft className="size-[16px]" />
        광고주 회원
      </Link>

      <CollabPageHead
        title={member.name || member.loginId}
        extra={
          member.companyName && (
            <span className="rounded-[8px] bg-primary-50 px-[10px] py-[4px] text-sm font-bold text-primary-800">
              {member.companyName}
            </span>
          )
        }
      >
        {/* 아이디 · 연락처 · 가입일은 제목 오른쪽에(11-18 사용자) — 제목 줄 높이에 맞춰 가운데. */}
        <span className="flex min-h-[28px] flex-wrap items-center gap-x-[10px] gap-y-[2px] text-sm font-medium text-disabled md:min-h-[32px]">
          <span>
            {member.snsProvider ? `${member.snsProvider} · ` : ""}
            {member.loginId}
          </span>
          {member.phone && (
            <HeroLink
              href={`tel:${member.phone}`}
              className="flex items-center gap-[2px] text-xs text-primary-800 no-underline"
            >
              <Phone className="size-[12px]" />
              {formatPhone(member.phone)}
            </HeroLink>
          )}
          <span>가입 {dotDateTime(member.createdAt)}</span>
        </span>
      </CollabPageHead>

      <ContactSection member={member} />
      <BrandsSection member={member} />
      <BizSection member={member} />

      <p className="text-xs text-disabled">
        {canOpenAdmix ? (
          <>
            계정 정보 수정은{" "}
            <Link
              href={`/admin/members/${member.id}`}
              className="font-medium text-primary-800 underline"
            >
              admix 회원 관리
            </Link>
            에서 해요.
          </>
        ) : (
          "계정 정보 수정은 admix 회원 관리 권한이 있는 관리자에게 요청해 주세요."
        )}
      </p>
    </div>
  );
}

export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-[12px] text-sm">
      <dt className="w-[72px] shrink-0 text-disabled">{label}</dt>
      <dd className="min-w-0 break-all text-black">{children || "-"}</dd>
    </div>
  );
}

/** 파일 한 줄 — 이름 · 올린 때 + "파일 보기"(이미지 · PDF 는 새 탭, 그 밖은 내려받기). */
export function FileRow({
  memberId,
  kind,
  name,
  sub,
}: {
  memberId: string;
  kind: "business-card" | "biz-file";
  name: string;
  sub?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-[8px] rounded-[12px] bg-gray-50 px-[14px] py-[10px]">
      <span className="flex min-w-0 items-center gap-[8px]">
        <MaskIcon
          src="/icons/file-text.svg"
          className="size-[18px] shrink-0 text-tone-4a5565"
        />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-black">
            {name}
          </span>
          {sub && <span className="text-xs text-disabled">{sub}</span>}
        </span>
      </span>
      <OpenFileButton
        name={name}
        load={() => adminCollabApi.advertiserFile(memberId, kind)}
      />
    </div>
  );
}

/** 파일 보기 — 받아서 새 탭에 연다. 실패하면 알림 창. */
function OpenFileButton({
  name,
  load,
}: {
  name: string;
  load: () => Promise<Blob>;
}) {
  const [opening, setOpening] = useState(false);
  const { alert, confirmDialog } = useAdminConfirm();

  const open = async () => {
    setOpening(true);
    try {
      await openFileInNewTab(load, name);
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

  return (
    <>
      <Button size="sm" variant="secondary" onPress={open} isDisabled={opening}>
        {opening ? "여는 중…" : "파일 보기"}
      </Button>
      {confirmDialog}
    </>
  );
}

function ContactSection({ member }: { member: AdminAdvertiserMember }) {
  return (
    <CollabSection title="담당자 정보">
      {/* 명함은 이 화면에서 보이지 않는다(11-11 사용자). */}
      <dl className="flex flex-col gap-[10px]">
        <InfoRow label="담당자">{member.contactName}</InfoRow>
        <InfoRow label="직함">{member.position}</InfoRow>
        <InfoRow label="소속팀">{member.department}</InfoRow>
        <InfoRow label="회사">{member.companyName}</InfoRow>
        <InfoRow label="업종">{member.industry}</InfoRow>
        <InfoRow label="연락처">{formatPhone(member.phone)}</InfoRow>
        <InfoRow label="이메일">{member.email}</InfoRow>
        {/* 받을 방법(문자 · 이메일, 083)을 체크박스로(11-24 사용자). */}
        <InfoRow label="마케팅 수신">
          <MarketingChecks member={member} />
        </InfoRow>
      </dl>
    </CollabSection>
  );
}

function BrandsSection({ member }: { member: AdminAdvertiserMember }) {
  return (
    <CollabSection title={`브랜드 ${member.brands.length}개`}>
      {member.brands.length ? (
        <ul className="grid grid-cols-2 gap-[10px] sm:grid-cols-3 lg:grid-cols-4">
          {member.brands.map((b) => (
            <li
              key={b.id}
              className="flex items-center gap-[10px] rounded-[12px] bg-gray-50 p-[10px]"
            >
              <BrandThumb brand={b} size={48} className="rounded-[10px]" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold text-black">
                  {b.name}
                </span>
                <span className="text-xs text-disabled">
                  {dotDate(b.createdAt)} 등록
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-disabled">아직 등록한 브랜드가 없어요.</p>
      )}
    </CollabSection>
  );
}

function BizSection({ member }: { member: AdminAdvertiserMember }) {
  const status = member.bizStatus;
  return (
    <CollabSection
      title="사업자 인증"
      right={<BizStatusBadge status={bizStatusLabel(status)} />}
    >
      <BizInfoForm member={member} />
      {member.bizFileName ? (
        <FileRow
          memberId={member.id}
          kind="biz-file"
          name={member.bizFileName}
          sub={
            member.bizUploadedAt
              ? `${dotDateTime(member.bizUploadedAt)} 올림`
              : null
          }
        />
      ) : (
        <p className="text-xs text-disabled">올린 사업자등록증이 없어요.</p>
      )}
      {status === "verified" && member.bizVerifiedAt && (
        <p className="text-xs text-disabled">
          인증 완료 {dotDateTime(member.bizVerifiedAt)}
        </p>
      )}
      {/* 앞에 점 하나 · 사유 뒤에 반려한 일시(11-18 사용자). */}
      {status === "rejected" && (
        <p className="flex flex-wrap items-center gap-x-[6px] gap-y-[2px] text-xs text-[#ef4444]">
          <span
            aria-hidden
            className="size-[4px] shrink-0 rounded-full bg-current"
          />
          <span className="break-keep">
            {member.bizRejectReason
              ? `반려 사유: ${member.bizRejectReason}`
              : "반려했어요."}
          </span>
          {member.bizRejectedAt && (
            <span className="text-disabled">
              {dotDateTime(member.bizRejectedAt)}
            </span>
          )}
        </p>
      )}
      <BizActions member={member} />
      <PastRejections member={member} />
    </CollabSection>
  );
}

/**
 * 지난 반려 내역(095, 11-18 사용자: "그 전 반려내역도 보이게, 어드민에서만") — 최근 것부터.
 * 지금 반려 상태면 맨 앞(지금 반려)은 위 빨간 줄에 이미 있어서 뺀다. 그때 올린 파일이 남아 있으면 열어 볼 수 있다.
 */
function PastRejections({ member }: { member: AdminAdvertiserMember }) {
  const all = member.bizRejections ?? [];
  const past = member.bizStatus === "rejected" ? all.slice(1) : all;
  if (!past.length) return null;
  return (
    <div className="flex flex-col gap-[8px] border-t border-gray-100 pt-[16px]">
      <h3 className="text-sm font-bold text-black">
        지난 반려 내역{" "}
        <span className="font-medium text-disabled">{past.length}건</span>
      </h3>
      <ul className="flex flex-col gap-[8px]">
        {past.map((r) => (
          <PastRejectionRow key={r.id} memberId={member.id} r={r} />
        ))}
      </ul>
    </div>
  );
}

function PastRejectionRow({
  memberId,
  r,
}: {
  memberId: string;
  r: AdvertiserBizRejection;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-[8px] rounded-[12px] bg-gray-50 px-[14px] py-[10px]">
      <span className="flex min-w-0 flex-col gap-[2px]">
        <span className="text-sm leading-[20px] break-keep text-black">
          {r.reason ?? "사유 없이 반려했어요."}
        </span>
        <span className="text-xs break-all text-disabled">
          {[r.rejectedAt && dotDateTime(r.rejectedAt), r.rejectedBy, r.fileName]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      {r.fileName && r.hasFile && (
        <OpenFileButton
          name={r.fileName}
          load={() => adminCollabApi.advertiserRejectionFile(memberId, r.id)}
        />
      )}
    </li>
  );
}

const ACTION_BUTTON =
  "h-[48px] w-full text-base font-semibold sm:h-[40px] sm:w-auto sm:text-sm";

/**
 * 사업자 인증 처리 — 인증 완료 · 반려(사유) · 되돌리기(11-18 사용자: "승인, 반려는 어디서 해?").
 * 제휴사 회원 상세와 같은 규칙이지만 임시 승인은 없다. 승인 전 광고주는 콜라보 화면이 잠겨 있다(인증 완료여야 열린다).
 */
function BizActions({ member }: { member: AdminAdvertiserMember }) {
  const action = useAdvertiserBizAction();
  const { confirm, alert, confirmDialog } = useAdminConfirm();
  const { success } = useSonner();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  // 반려 칸이 열리면 사유 칸 · 반려하기 버튼까지 화면에 다 보이게 내린다(카드가 화면 아래쪽일 때).
  const rejectRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (rejecting)
      rejectRef.current?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
  }, [rejecting]);
  const status = member.bizStatus;
  const hasFile = !!member.bizFileName;
  const busy = action.isPending;

  const run = async (act: AdvertiserBizAction, done: string, why?: string) => {
    try {
      await action.mutateAsync({ id: member.id, action: act, reason: why });
      success(done);
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
  const verify = async () => {
    const ok = await confirm({
      title: "사업자 인증을 마칠까요?",
      description:
        "올린 사업자등록증을 확인했다면 인증 완료로 바꿔요. 광고주가 콜라보를 바로 쓸 수 있어요.",
      confirmText: "인증 완료",
    });
    if (ok) await run("verify", "사업자 인증을 마쳤어요.");
  };
  const reset = async () => {
    const ok = await confirm({
      title: "인증 상태를 되돌릴까요?",
      description: hasFile ? "검토 대기로 돌아가요." : "미등록으로 돌아가요.",
      confirmText: "되돌리기",
    });
    if (ok) await run("reset", "인증 상태를 되돌렸어요.");
  };

  const canVerify = status !== "verified" && hasFile;
  const canReject =
    hasFile && (status === "reviewing" || status === "provisional");
  const canReset = ["provisional", "verified", "rejected"].includes(status);
  if (!canVerify && !canReject && !canReset) return null;

  return (
    <>
      {/* 오른쪽 정렬, 주 버튼(인증 완료)이 맨 오른쪽 · 반려는 ghost(11-18 사용자). */}
      <div className="grid grid-cols-1 gap-[8px] sm:flex sm:flex-wrap sm:justify-end">
        {canReject && !rejecting && (
          <Button
            variant="ghost"
            className={ACTION_BUTTON}
            onPress={() => setRejecting(true)}
            isDisabled={busy}
          >
            반려
          </Button>
        )}
        {canReset && (
          <Button
            variant="tertiary"
            className={ACTION_BUTTON}
            onPress={reset}
            isDisabled={busy}
          >
            되돌리기
          </Button>
        )}
        {canVerify && (
          <Button
            variant="primary"
            className={ACTION_BUTTON}
            onPress={verify}
            isDisabled={busy}
          >
            인증 완료
          </Button>
        )}
      </div>
      {rejecting && (
        <div ref={rejectRef} className="flex flex-col gap-[8px]">
          {/* 반려를 누르면 바로 이 칸에 커서가 가서 사유를 적는다(11-18 사용자). */}
          <TextArea
            variant="secondary"
            fullWidth
            rows={2}
            autoFocus
            aria-label="반려 사유"
            placeholder="반려 사유(광고주 내 정보에 보여요) 예: 사진이 흐려 사업자번호가 보이지 않아요."
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-[8px] sm:justify-end">
            <Button
              variant="tertiary"
              className={ACTION_BUTTON}
              onPress={() => {
                setRejecting(false);
                setReason("");
              }}
            >
              닫기
            </Button>
            <Button
              variant="danger"
              className={ACTION_BUTTON}
              isDisabled={busy}
              onPress={() =>
                run("reject", "반려했어요.", reason.trim() || undefined)
              }
            >
              반려하기
            </Button>
          </div>
        </div>
      )}
      {confirmDialog}
    </>
  );
}

/**
 * 상호 · 사업자번호 — 관리자가 직접 적어 저장한다(11-11 사용자). 비우고 저장하면 지운다. 인증 상태는 그대로.
 * 사업자번호는 숫자만 10자리까지 받아 000-00-00000 으로 하이픈을 저절로 넣는다(11-18 사용자, 가입 화면과 같다).
 * 바꾼 게 있을 때만 저장 버튼이 켜지고, 10자리를 다 채우지 않았으면 저장하지 않고 칸 아래에 알린다.
 */
function BizInfoForm({ member }: { member: AdminAdvertiserMember }) {
  const update = useUpdateAdvertiserBiz();
  const { alert, confirmDialog } = useAdminConfirm();
  const { success } = useSonner();
  const [bizName, setBizName] = useState(member.bizName ?? "");
  const savedNo = formatBizNoInput(member.bizNo ?? "") || null;
  const [bizNo, setBizNo] = useState(savedNo ?? "");
  const [noError, setNoError] = useState(false);
  const nextName = bizName.trim() || null;
  const nextNo = bizNo || null;
  const changed = nextName !== (member.bizName ?? null) || nextNo !== savedNo;

  const save = async () => {
    if (nextNo && !isBizNoComplete(nextNo)) {
      setNoError(true);
      return;
    }
    try {
      const saved = await update.mutateAsync({
        id: member.id,
        bizName: nextName,
        bizNo: nextNo,
      });
      setBizName(saved.bizName ?? "");
      setBizNo(formatBizNoInput(saved.bizNo ?? ""));
      success("사업자 정보를 저장했어요.");
    } catch (err) {
      await alert({
        title: "저장하지 못했어요",
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  return (
    <form
      className="flex flex-col gap-[12px] md:flex-row md:items-start"
      onSubmit={(e) => {
        e.preventDefault();
        if (changed && !update.isPending) void save();
      }}
    >
      <div className="grid flex-1 grid-cols-1 gap-[12px] md:grid-cols-2">
        <HeroField label="상호">
          <Input
            variant="secondary"
            fullWidth
            aria-label="상호"
            placeholder="상호를 적어 주세요"
            maxLength={200}
            value={bizName}
            onChange={(e) => setBizName(e.target.value)}
            className="h-[48px] text-base sm:h-[40px] sm:text-sm"
          />
        </HeroField>
        <HeroField
          label="사업자번호"
          error={noError ? "숫자 10자리를 모두 적어 주세요." : undefined}
        >
          <Input
            variant="secondary"
            fullWidth
            inputMode="numeric"
            autoComplete="off"
            aria-label="사업자번호"
            aria-invalid={noError || undefined}
            placeholder="000-00-00000"
            maxLength={12}
            value={bizNo}
            onChange={(e) => {
              setBizNo(formatBizNoInput(e.target.value));
              setNoError(false);
            }}
            onBlur={() => setNoError(!!bizNo && !isBizNoComplete(bizNo))}
            className="h-[48px] text-base sm:h-[40px] sm:text-sm"
          />
        </HeroField>
      </div>
      <Button
        type="submit"
        variant="primary"
        isDisabled={!changed || update.isPending}
        className="h-[48px] w-full shrink-0 text-base font-semibold sm:h-[40px] sm:text-sm md:mt-[26px] md:w-auto"
      >
        {update.isPending ? "저장 중…" : "저장"}
      </Button>
      {confirmDialog}
    </form>
  );
}
