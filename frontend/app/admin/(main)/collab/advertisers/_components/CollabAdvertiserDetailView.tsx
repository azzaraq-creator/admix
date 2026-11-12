"use client";

import { Button, Input, Link as HeroLink } from "@heroui/react";
import { ChevronLeft, FileText, Phone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { HeroField } from "@/app/admin/(main)/media/_components/heroFields";
import { LoadingState } from "@/components/common/RouteStates";
import { useAdminMe, isCollabOnlyAdmin } from "@/hooks/adminAuth";
import {
  adminCollabApi,
  useCollabAdvertiser,
  useUpdateAdvertiserBiz,
} from "@/hooks/adminCollab";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { useSonner } from "@/hooks/useSonner";
import {
  dotDate,
  dotDateTime,
  type AdminAdvertiserMember,
} from "@/lib/adminCollab";
import { extractApiError } from "@/lib/apiError";
import { BizStatusBadge, bizStatusLabel } from "@/lib/bizStatus";
import { formatPhone } from "@/lib/phone";

import {
  CollabPageHead,
  CollabSection,
  openFileInNewTab,
} from "../../_components/collabUi";
import { BrandThumb } from "./CollabAdvertisersListView";

/**
 * 광고주 회원 상세(11-10) — 콜라보 담당자가 의뢰한 광고주가 누구인지 확인하는 화면.
 * 담당자 정보 → 브랜드 → 사업자 인증 순(명함은 11-11 사용자 요청으로 뺌). 계정 수정 · 사업자 인증 처리는 admix 회원 관리에서 한다.
 * 상호 · 사업자번호만 여기서 직접 적어 저장한다(11-11 사용자).
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
        desc={
          <span className="flex flex-wrap items-center gap-x-[10px] gap-y-[2px]">
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
        }
      />

      <ContactSection member={member} />
      <BrandsSection member={member} />
      <BizSection member={member} />

      <p className="text-xs text-disabled">
        {canOpenAdmix ? (
          <>
            계정 정보 수정 · 사업자 인증 처리는{" "}
            <Link
              href={`/admin/members/${member.id}`}
              className="font-medium text-primary-800 underline"
            >
              admix 회원 관리
            </Link>
            에서 해요.
          </>
        ) : (
          "계정 정보 수정 · 사업자 인증 처리는 admix 회원 관리 권한이 있는 관리자에게 요청해 주세요."
        )}
      </p>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-[12px] text-sm">
      <dt className="w-[72px] shrink-0 text-disabled">{label}</dt>
      <dd className="min-w-0 break-all text-black">{children || "-"}</dd>
    </div>
  );
}

/** 파일 한 줄 — 이름 · 올린 때 + "파일 보기"(이미지 · PDF 는 새 탭, 그 밖은 내려받기). */
function FileRow({
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
  const [opening, setOpening] = useState(false);
  const { alert, confirmDialog } = useAdminConfirm();

  const open = async () => {
    setOpening(true);
    try {
      await openFileInNewTab(
        () => adminCollabApi.advertiserFile(memberId, kind),
        name,
      );
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
    <div className="flex flex-wrap items-center justify-between gap-[8px] rounded-[12px] bg-gray-50 px-[14px] py-[10px]">
      <span className="flex min-w-0 items-center gap-[8px]">
        <FileText className="size-[18px] shrink-0 text-tone-4a5565" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-black">
            {name}
          </span>
          {sub && <span className="text-xs text-disabled">{sub}</span>}
        </span>
      </span>
      <Button size="sm" variant="secondary" onPress={open} isDisabled={opening}>
        {opening ? "여는 중…" : "파일 보기"}
      </Button>
      {confirmDialog}
    </div>
  );
}

function ContactSection({ member }: { member: AdminAdvertiserMember }) {
  return (
    <CollabSection
      title="담당자 정보"
      desc="광고주가 가입할 때 · 내 정보에서 적은 내용이에요."
    >
      {/* 명함은 이 화면에서 보이지 않는다(11-11 사용자). */}
      <dl className="flex flex-col gap-[10px]">
        <InfoRow label="담당자">{member.contactName}</InfoRow>
        <InfoRow label="직함">{member.position}</InfoRow>
        <InfoRow label="소속팀">{member.department}</InfoRow>
        <InfoRow label="회사">{member.companyName}</InfoRow>
        <InfoRow label="업종">{member.industry}</InfoRow>
        <InfoRow label="연락처">{formatPhone(member.phone)}</InfoRow>
        <InfoRow label="이메일">{member.email}</InfoRow>
      </dl>
    </CollabSection>
  );
}

function BrandsSection({ member }: { member: AdminAdvertiserMember }) {
  return (
    <CollabSection
      title={`브랜드 ${member.brands.length}개`}
      desc="광고주가 콜라보 화면 '내 브랜드'에 등록한 브랜드예요. 콜라보 의뢰서에서 이 중 하나를 골라요."
    >
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
      {status === "rejected" && member.bizRejectReason && (
        <p className="text-xs text-[#ef4444]">
          반려 사유: {member.bizRejectReason}
        </p>
      )}
    </CollabSection>
  );
}

/**
 * 상호 · 사업자번호 — 관리자가 직접 적어 저장한다(11-11 사용자). 형식은 정하지 않는다(admix 회원 관리와 같다).
 * 바꾼 게 있을 때만 저장 버튼이 켜진다. 비우고 저장하면 지운다. 인증 상태는 그대로.
 */
function BizInfoForm({ member }: { member: AdminAdvertiserMember }) {
  const update = useUpdateAdvertiserBiz();
  const { alert, confirmDialog } = useAdminConfirm();
  const { success } = useSonner();
  const [bizName, setBizName] = useState(member.bizName ?? "");
  const [bizNo, setBizNo] = useState(member.bizNo ?? "");
  const nextName = bizName.trim() || null;
  const nextNo = bizNo.trim() || null;
  const changed =
    nextName !== (member.bizName ?? null) || nextNo !== (member.bizNo ?? null);

  const save = async () => {
    try {
      const saved = await update.mutateAsync({
        id: member.id,
        bizName: nextName,
        bizNo: nextNo,
      });
      setBizName(saved.bizName ?? "");
      setBizNo(saved.bizNo ?? "");
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
      className="flex flex-col gap-[12px] md:flex-row md:items-end"
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
        <HeroField label="사업자번호">
          <Input
            variant="secondary"
            fullWidth
            inputMode="numeric"
            autoComplete="off"
            aria-label="사업자번호"
            placeholder="000-00-00000"
            maxLength={30}
            value={bizNo}
            onChange={(e) => setBizNo(e.target.value)}
            className="h-[48px] text-base sm:h-[40px] sm:text-sm"
          />
        </HeroField>
      </div>
      <Button
        type="submit"
        variant="primary"
        isDisabled={!changed || update.isPending}
        className="h-[48px] w-full shrink-0 text-base font-semibold sm:h-[40px] sm:text-sm md:w-auto"
      >
        {update.isPending ? "저장 중…" : "저장"}
      </Button>
      {confirmDialog}
    </form>
  );
}
