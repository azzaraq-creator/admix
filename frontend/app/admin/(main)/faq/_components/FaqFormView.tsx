"use client";

import { List } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";

import { FAQ_TYPE_OPTIONS } from "./index";

const EDIT_SAMPLE = {
  author: "홍길동",
  createdAt: "2026-05-01",
  title: "ADMIX는 어떤 서비스인가요?",
  type: "이용 안내",
  content:
    "ADMIX는 옥외광고 매체를 AI를 통해 쉽고 빠르게 추천받고, 제안서를 만들어 컨택할 수 있는 플랫폼입니다.",
};

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-[12px]">
      <span className="w-[80px] shrink-0 text-base font-medium leading-[24px] text-[#2a2a2a]">
        {label}
      </span>
      <span className="text-base font-medium leading-[24px] text-[#737586]">
        {value}
      </span>
    </div>
  );
}

function FieldLabel({ label }: { label: string }) {
  return (
    <span className="flex w-[80px] shrink-0 items-center gap-[4px] text-base font-medium leading-[24px] text-[#2a2a2a]">
      {label}
      <span className="text-[#d65856]">*</span>
    </span>
  );
}

function FieldRow({ children }: { children: ReactNode }) {
  return <div className="flex items-start gap-[12px]">{children}</div>;
}

export function FaqFormView({ mode }: { mode: "create" | "edit" }) {
  const router = useRouter();
  const { confirm, alert, confirmDialog } = useAdminConfirm();
  const isEdit = mode === "edit";

  const [title, setTitle] = useState(isEdit ? EDIT_SAMPLE.title : "");
  const [type, setType] = useState(isEdit ? EDIT_SAMPLE.type : "");
  const [content, setContent] = useState(isEdit ? EDIT_SAMPLE.content : "");

  const goList = () => router.push("/admin/faq");

  const handleRegister = async () => {
    await alert({
      title: "등록 완료",
      description: "등록이 완료되었습니다.",
      confirmText: "확인",
    });
    goList();
  };

  const handleSave = async () => {
    await alert({
      title: "저장 완료",
      description: "저장이 완료되었습니다.",
      confirmText: "확인",
    });
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "삭제하시겠습니까?",
      description: "삭제된 FAQ는 복구할 수 없습니다.",
      confirmText: "삭제",
    });
    if (!ok) return;
    await alert({
      title: "삭제 완료",
      description: "삭제가 완료되었습니다.",
      confirmText: "확인",
    });
    goList();
  };

  const inputClass =
    "h-[44px] flex-1 rounded-[6px] border border-stroke px-[14px] text-sm font-medium leading-[20px] text-black outline-none placeholder:text-[#a1a1a1] focus:border-primary";

  return (
    <div className="flex flex-col gap-[24px]">
      <h1 className="text-2xl font-bold leading-[32px] text-black">FAQ 등록</h1>

      <div className="grid grid-cols-2 gap-x-[48px] gap-y-[16px]">
        <MetaRow label="작성자" value={isEdit ? EDIT_SAMPLE.author : "-"} />
        <MetaRow label="작성일" value={isEdit ? EDIT_SAMPLE.createdAt : "-"} />

        <FieldRow>
          <FieldLabel label="제목" />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력"
            className={inputClass}
          />
        </FieldRow>
        <FieldRow>
          <FieldLabel label="유형" />
          <Select value={type} onValueChange={(value) => setType(value as string)}>
            <SelectTrigger className="w-full rounded-[6px] border-stroke bg-white px-[14px] font-medium text-black data-[size=default]:h-[44px]">
              <SelectValue placeholder="유형 선택" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="min-w-0">
              {FAQ_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>

        <div className="col-span-2 flex items-start gap-[12px]">
          <FieldLabel label="내용" />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="내용 입력"
            className="h-[140px] flex-1 resize-none rounded-[6px] border border-stroke px-[14px] py-[12px] text-sm font-medium leading-[22px] text-black outline-none placeholder:text-[#a1a1a1] focus:border-primary"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goList}
          className="flex h-[36px] items-center justify-center gap-[6px] rounded-[6px] border border-[#ebebeb] bg-white px-[16px] text-sm font-medium leading-[20px] text-[#0a0a0a] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
        >
          <List className="size-[16px]" />
          목록으로
        </button>

        {isEdit ? (
          <div className="flex items-center gap-[8px]">
            <button
              type="button"
              onClick={handleDelete}
              className="flex h-[36px] items-center justify-center rounded-[6px] bg-[#f1f5f9] px-[16px] text-sm font-medium leading-[20px] text-[#2f3442] transition-colors hover:bg-[#e2e8f0]"
            >
              삭제
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex h-[36px] items-center justify-center rounded-[6px] bg-primary px-[16px] text-sm font-medium leading-[20px] text-white transition-colors hover:bg-primary-800"
            >
              저장
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleRegister}
            className="flex h-[36px] items-center justify-center rounded-[6px] bg-primary px-[16px] text-sm font-medium leading-[20px] text-white transition-colors hover:bg-primary-800"
          >
            등록
          </button>
        )}
      </div>

      {confirmDialog}
    </div>
  );
}
