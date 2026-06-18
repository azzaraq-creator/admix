"use client";

import { Check, List } from "lucide-react";
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

import { ACCOUNT_TYPE_OPTIONS, PERMISSIONS } from "./index";

const STATUS_OPTIONS = [
  { label: "활성화", value: "활성화" },
  { label: "비활성화", value: "비활성화" },
];

const EDIT_SAMPLE = {
  type: "관리자 계정",
  name: "홍길동",
  email: "hong@naver.com",
  password: "hong123@",
  role: "영업1팀/영업사원",
  phone: "01012345678",
  status: "활성화",
  createdAt: "2024-01-01",
};

const INPUT_CLASS =
  "h-[44px] w-full rounded-[6px] border border-stroke px-[14px] text-sm font-medium leading-[20px] text-black outline-none placeholder:text-[#a1a1a1] focus:border-primary";
const SELECT_TRIGGER_CLASS =
  "w-full rounded-[6px] border-stroke bg-white px-[14px] font-medium text-black data-[size=default]:h-[44px]";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-[12px]">
      <span className="flex w-[88px] shrink-0 items-center gap-[4px] text-base font-medium leading-[24px] text-[#2a2a2a]">
        {label}
        {required && <span className="text-[#d65856]">*</span>}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function AccountFormView({ mode }: { mode: "create" | "edit" }) {
  const router = useRouter();
  const { confirm, alert, confirmDialog } = useAdminConfirm();
  const isEdit = mode === "edit";

  const [perms, setPerms] = useState<string[]>(isEdit ? [...PERMISSIONS] : []);
  const togglePerm = (perm: string) =>
    setPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );

  const goList = () => router.push("/admin/roles");

  const handleSave = async () => {
    await alert({
      title: "저장 완료",
      description: "저장이 완료되었습니다.",
      confirmText: "확인",
    });
    if (!isEdit) goList();
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "삭제하시겠습니까?",
      description: "삭제된 계정은 복구할 수 없습니다.",
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

  return (
    <div className="flex flex-col gap-[24px]">
      <h1 className="text-2xl font-bold leading-[32px] text-black">
        {isEdit ? "계정 상세" : "계정 생성"}
      </h1>

      <div className="grid grid-cols-2 gap-x-[48px] gap-y-[16px]">
        <Field label="계정 유형" required>
          <Select defaultValue={isEdit ? EDIT_SAMPLE.type : ""}>
            <SelectTrigger className={SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="유형 선택" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="min-w-0">
              {ACCOUNT_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="이름" required>
          <input
            type="text"
            defaultValue={isEdit ? EDIT_SAMPLE.name : ""}
            placeholder="이름 입력"
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="이메일(ID)" required>
          <input
            type="text"
            defaultValue={isEdit ? EDIT_SAMPLE.email : ""}
            placeholder="이메일 입력"
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="비밀번호" required>
          <input
            type="text"
            defaultValue={isEdit ? EDIT_SAMPLE.password : ""}
            placeholder="비밀번호 입력"
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="부서/역할">
          <input
            type="text"
            defaultValue={isEdit ? EDIT_SAMPLE.role : ""}
            placeholder="부서/역할 입력"
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="전화번호">
          <input
            type="text"
            defaultValue={isEdit ? EDIT_SAMPLE.phone : ""}
            placeholder="전화번호 입력"
            className={INPUT_CLASS}
          />
        </Field>
        {isEdit && (
          <>
            <Field label="상태">
              <Select defaultValue={EDIT_SAMPLE.status}>
                <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                  <SelectValue placeholder="상태 선택" />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false} className="min-w-0">
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="생성일">
              <span className="text-sm font-medium leading-[20px] text-[#737586]">
                {EDIT_SAMPLE.createdAt}
              </span>
            </Field>
          </>
        )}
      </div>

      <p className="text-lg font-bold leading-[28px] text-black">권한 설정</p>
      <div className="grid grid-cols-3 gap-[16px]">
        {PERMISSIONS.map((perm) => {
          const checked = perms.includes(perm);
          return (
            <label
              key={perm}
              className="flex cursor-pointer items-center gap-[10px] rounded-[8px] border border-stroke px-[20px] py-[14px]"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => togglePerm(perm)}
                className="sr-only"
              />
              <span
                className={`flex size-[18px] shrink-0 items-center justify-center rounded-[4px] border ${
                  checked ? "border-primary bg-primary" : "border-stroke bg-white"
                }`}
              >
                {checked && (
                  <Check className="size-[12px] text-white" strokeWidth={3} />
                )}
              </span>
              <span className="text-base font-medium leading-[24px] text-black">
                {perm}
              </span>
            </label>
          );
        })}
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
            onClick={handleSave}
            className="flex h-[36px] items-center justify-center rounded-[6px] bg-primary px-[16px] text-sm font-medium leading-[20px] text-white transition-colors hover:bg-primary-800"
          >
            생성
          </button>
        )}
      </div>

      {confirmDialog}
    </div>
  );
}
