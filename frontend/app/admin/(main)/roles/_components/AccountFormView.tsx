"use client";

import {
  Button,
  Checkbox,
  Input,
  Label,
  ListBox,
  Select,
} from "@heroui/react";
import { List } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { LoadingState } from "@/components/common/RouteStates";
import { extractApiError } from "@/lib/apiError";
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

/**
 * HeroUI 체크박스는 bg-accent(프로젝트에선 옅은 보라 --app-accent)로 칠해져, 이 안에서만 HeroUI 원래 액센트
 * (브랜드 보라 바탕 + 흰 체크)로 되돌린다.
 */
const CHECKBOX_ACCENT =
  "[--app-accent:var(--accent)] [--app-accent-foreground:var(--accent-foreground)]";

/** 하나 고르기(HeroUI Select + ListBox). 빈 값("")이면 placeholder 가 보인다. */
function OptionSelect({
  label,
  placeholder,
  value,
  options,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string | null) => void;
}) {
  return (
    <Select
      aria-label={label}
      placeholder={placeholder}
      fullWidth
      selectedKey={value || null}
      onSelectionChange={(key) => onChange(key == null ? null : String(key))}
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item
              key={option.value}
              id={option.value}
              textValue={option.label}
            >
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

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
      <span className="flex w-[88px] shrink-0 items-center gap-[4px] text-base font-medium leading-[24px] text-tone-2a2a2a">
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
    return <LoadingState />;
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
          <OptionSelect
            label="계정 유형"
            placeholder="유형 선택"
            value={type}
            options={ACCOUNT_TYPE_OPTIONS}
            onChange={(v) => setType(v ?? "")}
          />
        </Field>
        <Field label="이름" required>
          <Input
            aria-label="이름"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름 입력"
          />
        </Field>
        <Field label="이메일(ID)" required>
          <Input
            aria-label="이메일(ID)"
            fullWidth
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일 입력"
            disabled={isEdit}
          />
        </Field>
        <Field label="비밀번호" required={!isEdit}>
          <Input
            aria-label="비밀번호"
            fullWidth
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              isEdit ? "변경 시 입력 (8자 이상)" : "비밀번호 입력 (8자 이상)"
            }
          />
        </Field>
        <Field label="부서/역할">
          <Input
            aria-label="부서/역할"
            fullWidth
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="부서/역할 입력"
          />
        </Field>
        <Field label="전화번호">
          <Input
            aria-label="전화번호"
            fullWidth
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="전화번호 입력"
          />
        </Field>
        {isEdit && (
          <>
            <Field label="상태">
              <OptionSelect
                label="상태"
                placeholder="상태 선택"
                value={status}
                options={STATUS_OPTIONS}
                onChange={(v) => {
                  if (v) setStatus(v as AdminStatus);
                }}
              />
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
            {PERMISSIONS.map((perm) => (
              // 테두리 칸 어디를 눌러도 체크된다(누르는 영역 = Checkbox.Content).
              <Checkbox
                key={perm}
                isSelected={perms.includes(PERMISSION_KEYS[perm])}
                onChange={() => togglePerm(perm)}
                className={`${CHECKBOX_ACCENT} flex rounded-[8px] border border-stroke`}
              >
                <Checkbox.Content className="w-full cursor-pointer items-center gap-[10px] px-[20px] py-[14px]">
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  {/* Checkbox.Content 가 이미 <label> 이라 글자는 span 으로(label 안 label 방지). */}
                  <Label
                    elementType="span"
                    className="cursor-pointer text-base font-medium leading-[24px] text-black"
                  >
                    {perm}
                  </Label>
                </Checkbox.Content>
              </Checkbox>
            ))}
          </div>
        </>
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" onPress={goList}>
          <List className="size-[16px]" />
          목록으로
        </Button>

        {isEdit ? (
          <div className="flex items-center gap-[8px]">
            <Button variant="tertiary" onPress={handleDelete}>
              삭제
            </Button>
            <Button variant="primary" onPress={handleSave} isDisabled={saving}>
              저장
            </Button>
          </div>
        ) : (
          <Button variant="primary" onPress={handleSave} isDisabled={saving}>
            생성
          </Button>
        )}
      </div>

      {confirmDialog}
    </div>
  );
}
