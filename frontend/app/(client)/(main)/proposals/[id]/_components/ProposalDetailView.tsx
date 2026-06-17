"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { ImageLightbox } from "@/components/common/ImageLightbox";
import {
  CircleAlertIcon,
  DownloadIcon,
  FileInputIcon,
  FileXIcon,
  GripVerticalIcon,
  MaximizeIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import { useConfirm } from "@/hooks/useConfirm";
import { useSonner } from "@/hooks/useSonner";
import { cn } from "@/lib/utils";

import { Sidebar } from "../../../_components/Sidebar";

type Slide = { id: string; name: string };

const INITIAL_SLIDES: Slide[] = [
  { id: "s1", name: "표지" },
  { id: "s2", name: "서머리" },
  { id: "s3", name: "대편 버스" },
  { id: "s4", name: "옥외 광고" },
  { id: "s5", name: "THANK YOU" },
];

const PREVIEW = "/proposals/sample.png";
const ZOOM_MIN = 25;
const ZOOM_MAX = 200;
const ZOOM_STEP = 25;

export function ProposalDetailView({
  plan,
}: {
  plan?: "guest" | "member";
}) {
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();
  const { success } = useSonner();

  const [name, setName] = useState("광고 제안서_2026");
  const [editing, setEditing] = useState(false);
  const [slides, setSlides] = useState<Slide[]>(INITIAL_SLIDES);
  const [selectedId, setSelectedId] = useState("s1");
  const [zoom, setZoom] = useState(100);
  const [lightbox, setLightbox] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const dragIndex = useRef<number | null>(null);

  const handleDrop = (dropIndex: number) => {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from === null || from === dropIndex) return;
    setSlides((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(dropIndex, 0, moved);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (plan !== "member") {
      await confirm({
        title: "제안서 제출은 로그인 후 이용 가능해요.",
        description:
          "제안서를 제출하고 맞춤 제안을 받으시려면 회원가입을 진행해 주세요.",
        confirmText: "로그인 화면으로",
      });
      return;
    }
    const ok = await confirm({
      title: "제안서를 제출하시겠습니까?",
      description:
        "관리자 검토 후 맞춤제안 또는 집행 가능 여부가 안내되며, 제출 후에는 제안서 내용을 수정할 수 없습니다.",
      confirmText: "제출",
    });
    if (ok) setSubmitted(true);
  };

  const handleCancelSubmit = async () => {
    const ok = await confirm({
      title: "제출을 취소하시겠습니까?",
      description: "취소된 제출서는 추후 다시 제출할 수 있습니다.",
      confirmText: "확인",
    });
    if (ok) setSubmitted(false);
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "제안서를 삭제하시겠습니까?",
      description: (
        <>
          <span className="font-semibold text-[#2f3442]">{name}</span>가 내
          제안서에서 삭제됩니다.
        </>
      ),
      confirmText: "삭제",
    });
    if (ok) router.push("/proposals");
  };

  const handleDeleteSlide = async (slide: Slide) => {
    const ok = await confirm({
      title: "슬라이드를 삭제하시겠습니까?",
      description: (
        <>
          <span className="font-semibold text-[#2f3442]">{slide.name}</span>{" "}
          슬라이드가 제안서에서 삭제됩니다.
        </>
      ),
      confirmText: "삭제",
    });
    if (ok) setSlides((prev) => prev.filter((item) => item.id !== slide.id));
  };

  return (
    <div className="flex h-screen w-full bg-white">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-[24px] border-b border-[#e8e8e8] bg-white px-[24px] py-[30px]">
          <div className="flex min-w-0 flex-1 flex-col gap-[12px]">
            <div className="flex items-center gap-[12px]">
              {editing ? (
                <input
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onBlur={() => setEditing(false)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") setEditing(false);
                  }}
                  className="min-w-0 border-b border-primary text-[20px] font-bold leading-[28px] tracking-[-0.08px] text-black outline-none"
                />
              ) : (
                <p className="text-[20px] font-bold leading-[28px] tracking-[-0.08px] text-black">
                  {name}
                </p>
              )}
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="제안서명 수정"
                className="text-[#757575]"
              >
                <PencilIcon className="size-[18px]" />
              </button>
            </div>
            <div className="flex items-center gap-[12px]">
              <span className="rounded-[6px] bg-[#f6f6f6] px-[10px] py-[4px] text-xs font-medium leading-[16px] tracking-[0.0048px] text-[#545454]">
                작성중
              </span>
              <p className="text-sm font-medium leading-[20px] text-[#757575]">
                2024.05.20 15:30
              </p>
            </div>
          </div>
          <div className="flex items-center gap-[8px]">
            <button
              type="button"
              className="flex items-center justify-center gap-[8px] rounded-[8px] border border-primary bg-white px-[16px] py-[12px] text-base font-medium text-primary"
            >
              <DownloadIcon className="size-[24px]" />
              내보내기
            </button>
            {submitted ? (
              <button
                type="button"
                onClick={handleCancelSubmit}
                className="flex items-center justify-center gap-[8px] rounded-[8px] bg-[#f1f5f9] px-[16px] py-[12px] text-base font-medium text-[#2f3442]"
              >
                <FileXIcon className="size-[24px]" />
                제출취소
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                className="flex items-center justify-center gap-[8px] rounded-[8px] bg-primary px-[16px] py-[12px] text-base font-medium text-white"
              >
                <FileInputIcon className="size-[24px]" />
                제출하기
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              aria-label="제안서 삭제"
              className="flex items-center justify-center rounded-[8px] border border-[#ff6c64] bg-white p-[12px] text-[#ff6c64]"
            >
              <TrashIcon className="size-[24px]" />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="flex w-[284px] shrink-0 flex-col border-r border-[#e8e8e8]">
            <div className="flex h-[48px] items-center px-[24px]">
              <p className="text-sm font-medium leading-[20px] text-[#757575]">
                슬라이드 <span className="text-primary">{slides.length}</span>
              </p>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-[16px] overflow-y-auto px-[24px] py-[16px]">
              {slides.map((slide, index) => (
                <div
                  key={slide.id}
                  draggable
                  onDragStart={() => {
                    dragIndex.current = index;
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={() => {
                    dragIndex.current = null;
                  }}
                  className="flex items-center border-l-2 border-transparent hover:border-primary"
                >
                  <GripVerticalIcon className="size-[16px] shrink-0 cursor-grab text-[#c9cad3] active:cursor-grabbing" />
                  <div className="flex min-w-0 flex-1 items-start">
                    <p className="w-[20px] shrink-0 pt-[8px] text-sm font-medium leading-[20px] text-[#757575]">
                      {index + 1}
                    </p>
                    <div className="flex min-w-0 flex-1 flex-col gap-[8px] pl-[6px]">
                      <button
                        type="button"
                        onClick={() => setSelectedId(slide.id)}
                        className={cn(
                          "group relative aspect-[198/111] w-full overflow-hidden rounded-[8px]",
                          selectedId === slide.id
                            ? "border-[3px] border-primary"
                            : "border border-stroke",
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={PREVIEW}
                          alt=""
                          className="size-full object-cover"
                        />
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label="슬라이드 삭제"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteSlide(slide);
                          }}
                          className="absolute right-[6px] top-[6px] hidden items-center rounded-full bg-black/70 p-[5px] text-white group-hover:flex"
                        >
                          <TrashIcon className="size-[12px]" />
                        </span>
                      </button>
                      <p className="text-center text-sm font-medium leading-[20px] text-black">
                        {slide.name}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-stroke px-[24px] py-[12px]">
              <Link
                href="/fixed"
                className="flex w-full items-center justify-center gap-[8px] rounded-[8px] border border-primary bg-white px-[16px] py-[12px] text-base font-medium text-primary"
              >
                <PlusIcon className="size-[24px]" />
                매체추가
              </Link>
            </div>
          </aside>

          <section className="relative flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-[#e8e8e8] px-[24px] py-[6px]">
              <p className="flex items-center gap-[6px] text-sm font-medium leading-[20px] text-[#757575]">
                <span>최종 수정</span>
                <span>2024.05.20 15:30</span>
              </p>
              <button
                type="button"
                onClick={() => success("저장이 완료되었습니다.")}
                className="rounded-[8px] border border-primary bg-white px-[12px] py-[8px] text-sm font-medium text-primary"
              >
                저장하기
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-white p-[40px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={PREVIEW}
                alt="슬라이드 미리보기"
                className="rounded-[8px] object-contain"
                style={{ width: `${zoom}%` }}
              />
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-[40px] flex justify-center">
              <div className="pointer-events-auto flex items-center rounded-[12px] border border-[#f6f6f6] bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setLightbox(true)}
                  aria-label="전체보기"
                  className="border-r border-[#f6f6f6] px-[14px] py-[10px] text-[#2f3442]"
                >
                  <MaximizeIcon className="size-[18px]" />
                </button>
                <div className="flex items-center gap-[20px] px-[14px] py-[10px]">
                  <button
                    type="button"
                    onClick={() =>
                      setZoom((v) => Math.max(ZOOM_MIN, v - ZOOM_STEP))
                    }
                    aria-label="축소"
                    className="text-[#2f3442]"
                  >
                    <MinusIcon className="size-[18px]" />
                  </button>
                  <span className="w-[36px] text-center text-sm font-medium leading-[20px] text-black">
                    {zoom}%
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setZoom((v) => Math.min(ZOOM_MAX, v + ZOOM_STEP))
                    }
                    aria-label="확대"
                    className="text-[#2f3442]"
                  >
                    <PlusIcon className="size-[18px]" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {lightbox && (
        <ImageLightbox images={[PREVIEW]} onClose={() => setLightbox(false)} />
      )}
      {confirmDialog}

      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-[16px] bg-white p-[24px] text-center sm:hidden">
        <CircleAlertIcon className="size-[40px] text-primary" />
        <p className="text-base font-medium leading-[24px] text-black">
          제안서 편집은 PC 환경에서
          <br />
          이용해 주세요.
        </p>
        <button
          type="button"
          onClick={() => router.push("/proposals")}
          className="rounded-[8px] bg-primary px-[24px] py-[12px] text-base font-semibold text-white"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
