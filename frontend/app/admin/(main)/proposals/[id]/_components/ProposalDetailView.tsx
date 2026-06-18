"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { ListButton, PrimaryButton } from "@/components/admin/buttons";
import { DownloadIcon, MaximizeIcon } from "@/components/icons";

import { ProposalStatusBadge } from "../../_components";

const SLIDES = [
  "표지",
  "서머리",
  "맥스비전 신사역 가로수길 방면 계단",
  "맥스비전 신사역 가로수길 방면 계단",
  "맥스비전 신사역 가로수길 방면 계단",
  "마무리",
];

const HISTORY_HEADERS = ["제목", "작성자", "제안일", "적용 상태", "작업"];

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

  return (
    <div className="flex flex-col gap-[32px]">
      <div className="flex flex-col gap-[16px] rounded-[8px] border border-[#e5e7eb] bg-white p-[44px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]">
        <h1 className="pb-[8px] text-2xl font-semibold leading-[32px] text-[#2a2a2a]">
          제안 상세
        </h1>
        <div className="flex flex-col gap-[16px]">
          <div className="flex items-center gap-[16px]">
            <InfoRow label="회원 유형">기업</InfoRow>
            <InfoRow label="회사명">ADMIX</InfoRow>
          </div>
          <div className="flex items-center gap-[16px]">
            <InfoRow label="이름">홍길동</InfoRow>
            <InfoRow label="이메일">hong@naver.com</InfoRow>
          </div>
          <div className="flex items-center gap-[16px]">
            <InfoRow label="전화번호">01012345678</InfoRow>
            <InfoRow label="상태">
              <ProposalStatusBadge status="신규" />
            </InfoRow>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-[24px] rounded-[8px] border border-[#e5e7eb] bg-white p-[44px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]">
        <div className="flex items-center justify-between">
          <p className="text-2xl font-semibold leading-[32px] text-[#2a2a2a]">
            광고 제안서_2026
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
              {SLIDES.map((title, index) => (
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
                    {title}
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
                <span>{SLIDES.length}</span>
              </p>
              <MaximizeIcon className="size-[24px] text-[#2a2a2a]" />
            </div>
            <div className="relative aspect-[1920/1080] w-full overflow-hidden rounded-[4px]">
              <Image
                src="/admin/proposal-cover.png"
                alt="제안서 미리보기"
                fill
                sizes="(max-width: 1280px) 100vw, 1100px"
                className="object-cover"
              />
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
            <div className="flex h-[88px] items-center justify-center text-sm font-medium leading-[20px] text-[#737586]">
              등록된 맞춤제안이 없습니다.
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <ListButton
            onClick={() => router.push("/admin/proposals")}
            className="w-[100px] gap-[10px] px-0"
          />
          <PrimaryButton>집행 수락</PrimaryButton>
        </div>
      </div>
    </div>
  );
}
