"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ListButton, PrimaryButton } from "@/components/common/buttons";
import { DownloadIcon, MaximizeIcon } from "@/components/icons";
import { CoverThumb } from "@/components/proposals/CoverTemplate";
import { MediaThumb } from "@/components/proposals/MediaTemplate";
import { SummaryThumb } from "@/components/proposals/SummaryTemplate";
import { ThanksThumb } from "@/components/proposals/ThanksTemplate";
import {
  useAcceptProposal,
  useAdminProposalDetail,
  type ProposalDetail,
  type ProposalItem,
} from "@/hooks/proposals";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { useSonner } from "@/hooks/useSonner";

import { ProposalStatusBadge, type ProposalStatus } from "../../_components";

const HISTORY_HEADERS = ["제목", "작성자", "제안일", "적용 상태", "작업"];
const SUMMARY_PAGE_SIZE = 5;
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

const MEMBERSHIP_TEXT: Record<string, string> = {
  individual: "개인",
  corporate: "기업",
};

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

type AdminSlide =
  | { kind: "cover"; name: string }
  | { kind: "summary"; name: string; rows: ProposalItem[]; startIndex: number }
  | { kind: "media"; name: string; item: ProposalItem }
  | { kind: "thanks"; name: string };

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center gap-[16px]">
      <span className="w-[160px] shrink-0 text-xl font-semibold leading-[24px] text-[#6d6d6d]">
        {label}
      </span>
      <div className="min-w-0 flex-1 px-[12px] text-sm font-medium leading-[20px] text-black">
        {children}
      </div>
    </div>
  );
}

export function ProposalDetailView() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [selected, setSelected] = useState(0);

  const { data: proposal } = useAdminProposalDetail(params.id);
  const acceptMutation = useAcceptProposal();
  const { confirm, confirmDialog } = useAdminConfirm();
  const { success } = useSonner();

  const accepted = proposal?.status === "계약 완료";

  const handleAccept = async () => {
    const ok = await confirm({
      title: "집행을 수락하시겠습니까?",
      description:
        "수락하면 제안서 상태가 계약 완료로 변경됩니다.",
      confirmText: "집행 수락",
    });
    if (!ok) return;
    await acceptMutation.mutateAsync(params.id);
    success("집행이 수락되었습니다.");
  };

  const slides = useMemo<AdminSlide[]>(() => {
    const items = proposal?.items ?? [];
    const pages: ProposalItem[][] = [];
    for (let i = 0; i < items.length; i += SUMMARY_PAGE_SIZE) {
      pages.push(items.slice(i, i + SUMMARY_PAGE_SIZE));
    }
    if (pages.length === 0) pages.push([]);
    return [
      { kind: "cover", name: "표지" },
      ...pages.map((rows, index) => ({
        kind: "summary" as const,
        name: pages.length > 1 ? `서머리 ${index + 1}` : "서머리",
        rows,
        startIndex: index * SUMMARY_PAGE_SIZE,
      })),
      ...items.map((item) => ({
        kind: "media" as const,
        name: item.name ?? "이름 없음",
        item,
      })),
      { kind: "thanks", name: "THANK YOU" },
    ];
  }, [proposal?.items]);

  // SummaryTemplate 가 기대하는 ProposalDetail 형태로 변환(admin 응답엔 회원정보가 추가됨)
  const summaryProposal = useMemo<ProposalDetail | null>(() => {
    if (!proposal) return null;
    const items = proposal.items;
    return {
      id: proposal.id,
      title: proposal.title,
      status: proposal.status,
      media_count: items.length,
      total_amount: proposal.total_amount,
      updated_at: proposal.updated_at,
      media_ids: items.map((item) => item.media_id),
      items,
    };
  }, [proposal]);

  const current = slides[selected] ?? slides[0];
  const member = proposal?.member;
  const counterFiles = proposal?.counter_files ?? [];
  const EMPTY = "-";

  return (
    <div className="flex flex-col gap-[32px]">
      <div className="flex flex-col gap-[16px] rounded-[8px] border border-[#e5e7eb] bg-white p-[44px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]">
        <h1 className="pb-[8px] text-2xl font-semibold leading-[32px] text-[#2a2a2a]">
          제안 상세
        </h1>
        <div className="flex flex-col gap-[16px]">
          <div className="flex items-center gap-[16px]">
            <InfoRow label="회원 유형">
              {member
                ? (MEMBERSHIP_TEXT[member.membership_type ?? ""] ?? EMPTY)
                : EMPTY}
            </InfoRow>
            <InfoRow label="회사명">{member?.company_name || EMPTY}</InfoRow>
          </div>
          <div className="flex items-center gap-[16px]">
            <InfoRow label="이름">{member?.name || EMPTY}</InfoRow>
            <InfoRow label="이메일">{member?.email || EMPTY}</InfoRow>
          </div>
          <div className="flex items-center gap-[16px]">
            <InfoRow label="전화번호">{member?.phone || EMPTY}</InfoRow>
            <InfoRow label="상태">
              {proposal && (
                <ProposalStatusBadge
                  status={proposal.status as ProposalStatus}
                />
              )}
            </InfoRow>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-[24px] rounded-[8px] border border-[#e5e7eb] bg-white p-[44px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]">
        <div className="flex items-center justify-between">
          <p className="text-2xl font-semibold leading-[32px] text-[#2a2a2a]">
            {proposal?.title ?? ""}
          </p>
          <button
            type="button"
            className="flex h-[36px] items-center gap-[10px] rounded-[6px] border border-[#ebebeb] bg-white px-[17px] text-sm font-medium leading-[20px] text-[#0a0a0a] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
          >
            <DownloadIcon className="size-[16px]" />
            PPT 다운로드
          </button>
        </div>

        <div className="flex items-start gap-[11px]">
          <div className="flex w-[224px] shrink-0 flex-col gap-[14px] self-stretch rounded-[6px] border border-[#cdcdcd] p-[16px]">
            <p className="text-base leading-[1.4] text-black">슬라이드 목록</p>
            <div className="flex flex-col gap-[6px]">
              {slides.map((slide, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelected(index)}
                  className={`flex items-center gap-[14px] rounded-[4px] border px-[8px] py-[10px] text-left ${
                    index === selected
                      ? "border-[#cdcdcd] bg-[#f3f4f3]"
                      : "border-[#cdcdcd] hover:bg-[#fafafa]"
                  }`}
                >
                  <span className="flex w-[20px] shrink-0 items-center justify-center rounded-[4px] bg-[#fdfdfd] text-sm leading-[1.4] text-black">
                    {index + 1}
                  </span>
                  <span className="truncate text-sm leading-[1.4] text-black">
                    {slide.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-[14px] rounded-[6px] border border-[#cdcdcd] p-[16px]">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-[4px] text-sm font-medium leading-[1.4] text-black">
                <span>{selected + 1}</span>
                <span>/</span>
                <span>{slides.length}</span>
              </p>
              <MaximizeIcon className="size-[24px] text-[#2a2a2a]" />
            </div>
            <div className="relative aspect-[1920/1080] w-full overflow-hidden rounded-[4px] border border-[#e4e5ee]">
              {current?.kind === "cover" && (
                <CoverThumb updatedAt={proposal?.updated_at ?? null} />
              )}
              {current?.kind === "summary" && summaryProposal && (
                <SummaryThumb
                  proposal={summaryProposal}
                  rows={current.rows}
                  startIndex={current.startIndex}
                />
              )}
              {current?.kind === "media" && <MediaThumb item={current.item} />}
              {current?.kind === "thanks" && <ThanksThumb />}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-[24px] rounded-[6px] border border-[#cdcdcd] p-[16px]">
          <div className="flex items-start justify-between">
            <p className="text-xl font-semibold leading-[24px] text-[#2a2a2a]">
              맞춤제안 이력
            </p>
            <Link
              href={`/admin/proposals/${params.id}/write`}
              className="flex h-[36px] items-center rounded-[6px] border border-[#ebebeb] bg-white px-[17px] text-sm font-medium leading-[20px] text-[#0a0a0a] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
            >
              맞춤제안 작성
            </Link>
          </div>
          <div className="overflow-hidden">
            <div className="flex h-[44px] items-center">
              {HISTORY_HEADERS.map((header) => (
                <div
                  key={header}
                  className="flex h-full flex-1 items-center justify-center bg-[#f0f0f3] px-[24px] text-base font-normal leading-[24px] tracking-[-0.32px] text-[#555]"
                >
                  {header}
                </div>
              ))}
            </div>
            {counterFiles.length === 0 ? (
              <div className="flex h-[88px] items-center justify-center text-sm font-medium leading-[20px] text-[#737586]">
                등록된 맞춤제안이 없습니다.
              </div>
            ) : (
              counterFiles.map((cf) => (
                <div
                  key={cf.id}
                  className="flex h-[56px] items-center border-b border-[#f0f0f3] text-sm font-medium leading-[20px] text-[#2a2a2a]"
                >
                  <div className="flex flex-1 items-center justify-center truncate px-[24px]">
                    {cf.file_name}
                  </div>
                  <div className="flex flex-1 items-center justify-center px-[24px] text-[#737586]">
                    -
                  </div>
                  <div className="flex flex-1 items-center justify-center px-[24px]">
                    {formatDate(cf.created_at)}
                  </div>
                  <div className="flex flex-1 items-center justify-center px-[24px]">
                    전송 완료
                  </div>
                  <div className="flex flex-1 items-center justify-center px-[24px]">
                    <a
                      href={`${API_BASE}${cf.file_url}`}
                      download={cf.file_name}
                      className="flex items-center gap-[6px] rounded-[6px] border border-[#ebebeb] bg-white px-[12px] py-[6px] text-sm font-medium leading-[20px] text-[#0a0a0a] shadow-[0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
                    >
                      <DownloadIcon className="size-[14px]" />
                      다운로드
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <ListButton
            onClick={() => router.push("/admin/proposals")}
            className="w-[100px] gap-[10px] px-0"
          />
          <PrimaryButton
            onClick={handleAccept}
            disabled={accepted || acceptMutation.isPending}
          >
            {accepted ? "계약 완료" : "집행 수락"}
          </PrimaryButton>
        </div>
      </div>

      {confirmDialog}
    </div>
  );
}
