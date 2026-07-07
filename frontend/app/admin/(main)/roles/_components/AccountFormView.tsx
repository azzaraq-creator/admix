"use client";

import { Check } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import {
  DeleteButton,
  ListButton,
  PrimaryButton,
} from "@/components/common/buttons";
import { extractApiError } from "@/lib/apiError";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAdminAccount,
  useCreateAdminAccount,
  useDeleteAdminAccount,
  useUpdateAdminAccount,
  type AdminAccountDetail,
  type AdminStatus,
} from "@/hooks/adminAccounts";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";

import { ACCOUNT_TYPE_OPTIONS, PERMISSION_KEYS, PERMISSIONS } from "./index";

const STATUS_OPTIONS: { label: string; value: AdminStatus }[] = [
  { label: "활성화", value: "active" },
  { label: "비활성화", value: "disabled" },
];

const INPUT_CLASS =
  "h-[44px] w-full rounded-[6px] border border-stroke px-[14px] text-sm font-medium leading-[20px] text-black outline-none placeholder:text-[#a1a1a1] focus:border-primary disabled:bg-[#f5f5f5] disabled:text-disabled";
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
  const params = useParams<{ id: string }>();
  const isEdit = mode === "edit";
  const id = isEdit ? params.id : null;
  const { data: detail } = useAdminAccount(id);

  if (isEdit && !detail) {
    return (
      <p className="text-sm font-medium leading-[20px] text-disabled">
        불러오는 중...
      </p>
    );
  }

  return <AccountForm mode={mode} id={id} detail={detail ?? null} />;
}

function AccountForm({
  mode,
  id,
  detail,
}: {
  mode: "create" | "edit";
  id: string | null;
  detail: AdminAccountDetail | null;
}) {
  const router = useRouter();
  const isEdit = mode === "edit";

  const { confirm, alert, confirmDialog } = useAdminConfirm();
  const createMutation = useCreateAdminAccount();
  const updateMutation = useUpdateAdminAccount();
  const deleteMutation = useDeleteAdminAccount();

  const [type, setType] = useState(detail?.account_type ?? "");
  const [name, setName] = useState(detail?.name ?? "");
  const [email, setEmail] = useState(detail?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(detail?.department ?? "");
  const [phone, setPhone] = useState(detail?.phone ?? "");
  const [status, setStatus] = useState<AdminStatus>(detail?.status ?? "active");
  const [perms, setPerms] = useState<string[]>(detail?.permissions ?? []);

  const togglePerm = (perm: string) => {
    const key = PERMISSION_KEYS[perm];
    setPerms((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  };

  const goList = () => router.push("/admin/roles");

  const handleSave = async () => {
    if (!type || !name.trim() || !email.trim()) {
      await alert({
        title: "입력 확인",
        description: "계정 유형·이름·이메일은 필수입니다.",
        confirmText: "확인",
      });
      return;
    }
    try {
      if (isEdit && id) {
        await updateMutation.mutateAsync({
          id,
          payload: {
            name: name.trim(),
            account_type: type,
            department: role.trim() || null,
            phone: phone.trim() || null,
            status,
            permissions: perms,
            ...(password ? { password } : {}),
          },
        });
      } else {
        if (password.length < 8) {
          await alert({
            title: "입력 확인",
            description: "비밀번호는 8자 이상이어야 합니다.",
            confirmText: "확인",
          });
          return;
        }
        await createMutation.mutateAsync({
          email: email.trim(),
          password,
          name: name.trim(),
          account_type: type,
          department: role.trim() || null,
          phone: phone.trim() || null,
          permissions: perms,
        });
      }
      await alert({
        title: "저장 완료",
        description: "저장이 완료되었습니다.",
        confirmText: "확인",
      });
      if (!isEdit) goList();
    } catch (err) {
      await alert({
        title: "저장 실패",
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    const ok = await confirm({
      title: "삭제하시겠습니까?",
      description: "삭제된 계정은 복구할 수 없습니다.",
      confirmText: "삭제",
    });
    if (!ok) return;
    try {
      await deleteMutation.mutateAsync(id);
      await alert({
        title: "삭제 완료",
        description: "삭제가 완료되었습니다.",
        confirmText: "확인",
      });
      goList();
    } catch (err) {
      await alert({
        title: "삭제 실패",
        description: extractApiError(err),
        confirmText: "확인",
      });
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col gap-[24px]">
      <h1 className="text-2xl font-bold leading-[32px] text-black">
        {isEdit ? "계정 상세" : "계정 생성"}
      </h1>

      <div className="grid grid-cols-2 gap-x-[48px] gap-y-[16px]">
        <Field label="계정 유형" required>
          <Select items={ACCOUNT_TYPE_OPTIONS} value={type} onValueChange={(v) => setType(v ?? "")}>
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
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름 입력"
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="이메일(ID)" required>
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일 입력"
            disabled={isEdit}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="비밀번호" required={!isEdit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              isEdit ? "변경 시 입력 (8자 이상)" : "비밀번호 입력 (8자 이상)"
            }
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="부서/역할">
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="부서/역할 입력"
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="전화번호">
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="전화번호 입력"
            className={INPUT_CLASS}
          />
        </Field>
        {isEdit && (
          <>
            <Field label="상태">
              <Select
                items={STATUS_OPTIONS}
                value={status}
                onValueChange={(v) => setStatus(v as AdminStatus)}
              >
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
              <span className="text-sm font-medium leading-[20px] text-disabled">
                {detail?.created_at?.slice(0, 10) ?? "-"}
              </span>
            </Field>
          </>
        )}
      </div>

      {type !== "마스터 계정" && (
        <>
          <p className="text-lg font-bold leading-[28px] text-black">권한 설정</p>
          <div className="grid grid-cols-3 gap-[16px]">
            {PERMISSIONS.map((perm) => {
              const checked = perms.includes(PERMISSION_KEYS[perm]);
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
        </>
      )}

      <div className="flex items-center justify-between">
        <ListButton onClick={goList} />

        {isEdit ? (
          <div className="flex items-center gap-[8px]">
            <DeleteButton onClick={handleDelete} />
            <PrimaryButton onClick={handleSave} disabled={saving}>
              저장
            </PrimaryButton>
          </div>
        ) : (
          <PrimaryButton onClick={handleSave} disabled={saving}>
            생성
          </PrimaryButton>
        )}
      </div>

      {confirmDialog}
    </div>
  );
}
