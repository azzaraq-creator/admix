"use client";

import { Button, buttonVariants } from "@heroui/react";
import { List } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AdminPanel } from "@/components/admin/AdminPanel";
import { DownloadIcon, FullscreenIcon } from "@/components/icons";
import {
  proposalsApi,
  useAcceptProposal,
  useAdminProposalDetail,
  type ProposalDetail,
  type ProposalItem,
} from "@/hooks/proposals";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { useSonner } from "@/hooks/useSonner";
import { formatDate } from "@/lib/date";

import { ProposalStatusBadge, type ProposalStatus } from "../../_components";
import { AdminSlideView, type AdminSlide } from "./AdminSlideView";
import { ProposalSlideLightbox } from "./ProposalSlideLightbox";

const HISTORY_HEADERS = ["제목", "작성자", "제안일", "적용 상태", "작업"];
const SUMMARY_PAGE_SIZE = 5;
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

const MEMBERSHIP_TEXT: Record<string, string> = {
  individual: "개인",
  corporate: "기업",
};

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center gap-[16px]">
      <span className="w-[160px] shrink-0 text-xl font-semibold leading-[24px] text-tone-6d6d6d">
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
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const { data: proposal } = useAdminProposalDetail(params.id);
  const acceptMutation = useAcceptProposal();
  const { confirm, confirmDialog } = useAdminConfirm();
  const { success } = useSonner();

  const accepted = proposal?.status === "계약완료";

  const handleAccept = async () => {
    const ok = await confirm({
      title: "집행을 수락하시겠습니까?",
      description: "수락하면 기획안 상태가 계약완료로 변경됩니다.",
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
        name: item.media_name ?? item.name ?? "이름 없음",
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

  const [exporting, setExporting] = useState(false);

  const handleExportPpt = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await proposalsApi.exportPpt(params.id);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${proposal?.title ?? "기획안"}.pptx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExporting(false);
    } catch {
      setExporting(false);
    }
  };

  const handleDownloadCounter = async (counterId: string, fileName: string) => {
    try {
      const res = await proposalsApi.downloadCounterProposal(
        params.id,
        counterId,
      );
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      return;
    }
  };
  const EMPTY = "-";

  return (
    // 회색 바탕 위 흰 카드(AdminPanel) — 회원 정보 · 슬라이드 · 맞춤제안 이력을 각각 카드로(2026-11-12).
    <div className="flex flex-col gap-[20px] md:gap-[24px]">
      <h1 className="text-2xl font-semibold leading-[32px] text-tone-2a2a2a">
        제안 상세
      </h1>
      <AdminPanel>
        <div className="flex flex-col gap-[16px]">
          <div className="flex flex-col gap-[16px] md:flex-row md:items-center">
            <InfoRow label="회원 유형">
              {member
                ? (MEMBERSHIP_TEXT[member.membership_type ?? ""] ?? EMPTY)
                : EMPTY}
            </InfoRow>
            <InfoRow label="회사명">{member?.company_name || EMPTY}</InfoRow>
          </div>
          <div className="flex flex-col gap-[16px] md:flex-row md:items-center">
            <InfoRow label="이름">{member?.name || EMPTY}</InfoRow>
            <InfoRow label="이메일">{member?.email || EMPTY}</InfoRow>
          </div>
          <div className="flex flex-col gap-[16px] md:flex-row md:items-center">
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
      </AdminPanel>

      <AdminPanel
        title={proposal?.title ?? ""}
        right={
          <Button
            variant="outline"
            onPress={handleExportPpt}
            isDisabled={exporting}
          >
            <DownloadIcon className="size-[16px]" />
            {exporting ? "생성 중…" : "PPT 다운로드"}
          </Button>
        }
      >
        <div className="flex flex-col gap-[12px] md:flex-row md:items-start">
          <div className="flex w-full shrink-0 md:w-[224px] flex-col gap-[14px] self-stretch rounded-[12px] bg-gray-50 p-[16px]">
            <p className="text-base leading-[1.4] text-black">슬라이드 목록</p>
            <div className="flex flex-col gap-[6px]">
              {slides.map((slide, index) => (
                // 고른 슬라이드는 회색 바탕(tertiary), 나머지는 테두리(outline). 높이를 고정해 바뀔 때 줄이 흔들리지 않게.
                <Button
                  key={index}
                  fullWidth
                  variant={index === selected ? "tertiary" : "outline"}
                  onPress={() => setSelected(index)}
                  className="h-[42px] justify-start gap-[14px] rounded-[18px] px-[8px]"
                >
                  <span className="flex w-[20px] shrink-0 items-center justify-center rounded-[4px] bg-tone-fdfdfd text-sm leading-[1.4] text-black">
                    {index + 1}
                  </span>
                  <span className="min-w-0 truncate text-sm leading-[1.4] text-black">
                    {slide.name}
                  </span>
                </Button>
              ))}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-[14px] rounded-[12px] bg-gray-50 p-[16px]">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-[4px] text-sm font-medium leading-[1.4] text-black">
                <span>{selected + 1}</span>
                <span>/</span>
                <span>{slides.length}</span>
              </p>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                onPress={() => setLightboxOpen(true)}
                isDisabled={slides.length === 0}
                aria-label="슬라이드 확대 보기"
                className="text-tone-2a2a2a"
              >
                <FullscreenIcon className="size-[24px]" />
              </Button>
            </div>
            <div className="relative aspect-[1920/1080] w-full overflow-hidden rounded-[4px] border border-stroke">
              {current && (
                <AdminSlideView
                  slide={current}
                  summaryProposal={summaryProposal}
                  updatedAt={proposal?.updated_at ?? null}
                />
              )}
            </div>
          </div>
        </div>
      </AdminPanel>

      <AdminPanel
        title="맞춤제안 이력"
        right={
          accepted ? (
            // 막힌 버튼은 마우스를 받지 않으므로(pointer-events: none) 안내 글(title)은 감싼 칸에 단다.
            <span
              title="계약 완료된 기획안은 맞춤제안을 작성할 수 없습니다."
              className="cursor-not-allowed"
            >
              <Button variant="outline" isDisabled>
                맞춤제안 작성
              </Button>
            </span>
          ) : (
            // 페이지 이동이라 링크(next/link)로 두고 모양만 HeroUI 버튼으로 맞춘다.
            <Link
              href={`/admin/proposals/${params.id}/write`}
              className={buttonVariants({ variant: "outline" })}
            >
              맞춤제안 작성
            </Link>
          )
        }
      >
        <div className="overflow-x-auto rounded-[12px]">
          <div className="flex h-[44px] min-w-[640px] items-center">
            {HISTORY_HEADERS.map((header) => (
              <div
                key={header}
                className="flex h-full flex-1 items-center justify-center bg-tone-f0f0f3 px-[24px] text-base font-normal leading-[24px] tracking-[-0.32px] text-tone-555555"
              >
                {header}
              </div>
            ))}
          </div>
          {counterFiles.length === 0 ? (
            <div className="flex h-[88px] items-center justify-center text-sm font-medium leading-[20px] text-disabled">
              등록된 맞춤제안이 없습니다.
            </div>
          ) : (
            counterFiles.map((cf, index) => (
              <div
                key={cf.id}
                className="flex h-[56px] min-w-[640px] items-center border-b border-tone-f0f0f3 text-sm font-medium leading-[20px] text-tone-2a2a2a"
              >
                <div className="flex min-w-0 flex-1 items-center justify-center px-[24px]">
                  <span className="truncate">{cf.title ?? cf.file_name}</span>
                </div>
                <div className="flex flex-1 items-center justify-center px-[24px] text-disabled">
                  {cf.author_name ?? "-"}
                </div>
                <div className="flex flex-1 items-center justify-center px-[24px]">
                  {formatDate(cf.created_at)}
                </div>
                <div className="flex flex-1 items-center justify-center px-[24px]">
                  {index === 0 ? "노출중" : "이전 버전"}
                </div>
                <div className="flex flex-1 items-center justify-center gap-[10px] px-[24px]">
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() =>
                      router.push(
                        `/admin/proposals/${params.id}/write/${cf.id}`,
                      )
                    }
                    className="w-[62px] text-xs font-semibold"
                  >
                    상세
                  </Button>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="outline"
                    onPress={() => handleDownloadCounter(cf.id, cf.file_name)}
                    aria-label="다운로드"
                    className="w-[62px]"
                  >
                    <DownloadIcon className="size-[16px]" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </AdminPanel>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onPress={() => router.push("/admin/proposals")}
          className="w-[100px]"
        >
          <List className="size-[16px]" />
          목록으로
        </Button>
        <Button
          variant="primary"
          onPress={handleAccept}
          isDisabled={accepted || acceptMutation.isPending}
        >
          {accepted ? "계약완료" : "집행 수락"}
        </Button>
      </div>

      {lightboxOpen && (
        <ProposalSlideLightbox
          slides={slides}
          index={selected}
          onIndexChange={setSelected}
          summaryProposal={summaryProposal}
          updatedAt={proposal?.updated_at ?? null}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {confirmDialog}
    </div>
  );
}
