"use client";

import { Button } from "@heroui/react";
import { type ReactNode, useState } from "react";

import {
  type PopAge,
  type PopMetric,
  type PopSex,
  type PopTarget,
  type PopTargetInput,
  useAdminPopTargetCreate,
  useAdminPopTargetDelete,
  useAdminPopTargets,
  useAdminPopTargetUpdate,
} from "@/hooks/popGrid";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { useSonner } from "@/hooks/useSonner";
import { extractApiError } from "@/lib/apiError";
import { popTargetText } from "@/lib/popGrid/targetText";
import { cn } from "@/lib/utils";

// 매체 찾기 인구 분포 창과 같은 자료·순서 — 여러 개를 고르면 앞의 것이 첫 자료(칸 색 기준), 나머지는 겹쳐 본다.
const METRICS: { key: PopMetric; label: string }[] = [
  { key: "live", label: "생활인구" },
  { key: "subway", label: "지하철" },
  { key: "household", label: "거주인구" },
];
const SEXES: { key: PopSex; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "M", label: "남성" },
  { key: "F", label: "여성" },
];
const AGES: { key: PopAge; label: string }[] = [
  { key: "10", label: "10대" },
  { key: "20", label: "20대" },
  { key: "30", label: "30대" },
  { key: "40", label: "40대" },
  { key: "50", label: "50대" },
  { key: "60", label: "60대 이상" },
];

const EMPTY: PopTargetInput = {
  label: "",
  metric: "live",
  extras: [],
  sex: "all",
  ages: [],
  sortOrder: 0,
  isPublished: true,
};

const updatedText = (t: PopTarget) => {
  if (!t.updatedAt) return "-";
  const d = new Date(t.updatedAt);
  return `${d.toLocaleDateString("ko-KR")}${t.updatedBy ? ` · ${t.updatedBy}` : ""}`;
};

/**
 * 어드민 "타깃 관리" — 매체 찾기 위쪽 줄 "타깃" 버튼 목록. 고르면 인구 분포를 켜고 여기서 정한 자료·성별·연령으로 맞춘다.
 * 노출한 것만 순서(작은 수부터)대로 나온다.
 */
export function PopTargetAdminView() {
  const { data: targets = [], isLoading } = useAdminPopTargets();
  const remove = useAdminPopTargetDelete();
  const { success, error } = useSonner();
  const { confirm, confirmDialog } = useAdminConfirm();
  // 고치는 중인 타깃 — "new"는 새로 만들기.
  const [editing, setEditing] = useState<number | "new" | null>(null);

  const handleDelete = async (t: PopTarget) => {
    const ok = await confirm({
      title: `「${t.label}」 타깃을 지울까요?`,
      description: "매체 찾기 타깃 목록에서 바로 빠져요. 되살릴 수 없어요.",
      confirmText: "지우기",
      cancelText: "취소",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(t.id);
      if (editing === t.id) setEditing(null);
      success(`「${t.label}」 타깃을 지웠어요.`);
    } catch (err) {
      error(extractApiError(err, "지우지 못했어요. 잠시 뒤 다시 해 주세요."));
    }
  };

  const editingTarget =
    editing === "new" ? null : targets.find((t) => t.id === editing);

  return (
    <div className="flex flex-col gap-[32px]">
      {confirmDialog}
      <div className="flex items-start justify-between gap-[16px]">
        <div className="flex flex-col gap-[8px]">
          <h1 className="text-2xl leading-[32px] font-bold text-black">
            타깃 관리
          </h1>
          <p className="text-sm leading-[20px] text-gray-600">
            매체 찾기 위쪽 줄 「타깃」 버튼 목록이에요. 고르면 인구 분포를 켜고
            여기서 정한 자료·성별·연령으로 맞춰요(기간·시간대는 그대로).
            성별·연령은 생활인구에만 걸려요.
          </p>
        </div>
        <Button
          className="shrink-0"
          onPress={() => setEditing("new")}
          isDisabled={editing === "new"}
        >
          타깃 추가
        </Button>
      </div>

      {editing != null && (editing === "new" || editingTarget) && (
        <TargetForm
          key={editing}
          target={editingTarget ?? null}
          nextOrder={Math.max(0, ...targets.map((t) => t.sortOrder)) + 1}
          onDone={() => setEditing(null)}
        />
      )}

      <section className="flex flex-col gap-[12px]">
        <h2 className="text-base leading-[24px] font-semibold text-black">
          타깃 {targets.length ? `${targets.length}개` : ""}
        </h2>
        {isLoading ? (
          <p className="text-sm text-gray-500">불러오는 중…</p>
        ) : targets.length === 0 ? (
          <p className="text-sm text-gray-500">
            아직 타깃이 없어요. 「타깃 추가」로 만들면 매체 찾기에 「타깃」
            버튼이 생겨요.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[12px] border border-stroke">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-tone-fafaf9 text-left text-gray-600">
                <tr>
                  <th className="w-[64px] px-[16px] py-[10px] text-center font-semibold">
                    순서
                  </th>
                  <th className="px-[16px] py-[10px] font-semibold">이름</th>
                  <th className="px-[16px] py-[10px] font-semibold">조건</th>
                  <th className="px-[16px] py-[10px] text-center font-semibold">
                    노출
                  </th>
                  <th className="px-[16px] py-[10px] font-semibold">수정일</th>
                  <th className="px-[16px] py-[10px]" />
                </tr>
              </thead>
              <tbody>
                {targets.map((t) => (
                  <tr
                    key={t.id}
                    className={cn(
                      "border-t border-stroke",
                      editing === t.id && "bg-primary-50",
                    )}
                  >
                    <td className="px-[16px] py-[10px] text-center text-gray-600">
                      {t.sortOrder}
                    </td>
                    <td className="px-[16px] py-[10px] font-semibold whitespace-nowrap text-black">
                      {t.label}
                    </td>
                    <td className="px-[16px] py-[10px] text-gray-700">
                      {popTargetText(t)}
                    </td>
                    <td className="px-[16px] py-[10px] text-center">
                      {t.isPublished ? (
                        <span className="text-success">●</span>
                      ) : (
                        <span className="text-gray-400">숨김</span>
                      )}
                    </td>
                    <td className="px-[16px] py-[10px] whitespace-nowrap text-gray-600">
                      {updatedText(t)}
                    </td>
                    <td className="px-[16px] py-[10px] text-right whitespace-nowrap">
                      <div className="inline-flex gap-[8px]">
                        <Button
                          size="sm"
                          variant="outline"
                          onPress={() => setEditing(t.id)}
                        >
                          수정
                        </Button>
                        <Button
                          size="sm"
                          variant="tertiary"
                          onPress={() => handleDelete(t)}
                          isDisabled={remove.isPending}
                        >
                          지우기
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/** 칩 하나 — 고르면 보라 테두리·연보라 바탕. */
function Chip({
  on,
  disabled,
  onClick,
  children,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-[36px] rounded-[18px] border px-[14px] text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        on
          ? "border-primary bg-primary-50 text-primary"
          : "border-stroke bg-surface text-gray-700 hover:bg-gray-100",
      )}
    >
      {children}
    </button>
  );
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-[16px] max-sm:flex-col max-sm:gap-[8px]">
      <span className="flex h-[36px] w-[80px] shrink-0 items-center text-sm font-semibold text-black">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
        {children}
        {hint && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
    </div>
  );
}

/** 타깃 만들기·고치기 — 고르는 대로 아래에 매체 찾기에 보일 조건 한 줄을 보여 준다. */
function TargetForm({
  target,
  nextOrder,
  onDone,
}: {
  target: PopTarget | null;
  nextOrder: number;
  onDone: () => void;
}) {
  const create = useAdminPopTargetCreate();
  const update = useAdminPopTargetUpdate();
  const { success, error } = useSonner();
  const [form, setForm] = useState<PopTargetInput>(
    target
      ? {
          label: target.label,
          metric: target.metric,
          extras: target.extras,
          sex: target.sex,
          ages: target.ages,
          sortOrder: target.sortOrder,
          isPublished: target.isPublished,
        }
      : { ...EMPTY, sortOrder: nextOrder },
  );
  const picked = [form.metric, ...form.extras];
  const segOk = form.metric === "live";

  const pickMetric = (key: PopMetric) => {
    const next = picked.includes(key)
      ? picked.filter((k) => k !== key)
      : [...picked, key];
    if (!next.length) return;
    // 위 순서대로 — 앞의 것이 첫 자료.
    const ordered = METRICS.map((m) => m.key).filter((k) => next.includes(k));
    setForm((f) => ({ ...f, metric: ordered[0], extras: ordered.slice(1) }));
  };

  const save = async () => {
    try {
      if (target) await update.mutateAsync({ id: target.id, ...form });
      else await create.mutateAsync(form);
      success(
        target
          ? `「${form.label.trim()}」 타깃을 수정했어요.`
          : `「${form.label.trim()}」 타깃을 만들었어요.`,
      );
      onDone();
    } catch (err) {
      error(extractApiError(err, "저장하지 못했어요. 잠시 뒤 다시 해 주세요."));
    }
  };

  const saving = create.isPending || update.isPending;

  return (
    <section className="flex flex-col gap-[20px] rounded-[12px] border border-primary-200 bg-primary-50/60 p-[20px]">
      <h2 className="text-base leading-[24px] font-bold text-black">
        {target ? `「${target.label}」 수정` : "새 타깃"}
      </h2>

      <FieldRow label="이름">
        <input
          value={form.label}
          maxLength={40}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          placeholder="예: 뷰티 2030"
          className="h-[40px] w-full max-w-[320px] rounded-[6px] border border-stroke bg-surface px-[12px] text-sm text-black outline-none placeholder:text-tone-a1a1a1 focus:border-primary"
        />
      </FieldRow>

      <FieldRow
        label="자료"
        hint="여러 개를 고르면 앞의 것으로 칸 색을 칠하고, 나머지는 그 위에 겹쳐 보여요."
      >
        <div className="flex flex-wrap gap-[8px]">
          {METRICS.map((m) => (
            <Chip
              key={m.key}
              on={picked.includes(m.key)}
              onClick={() => pickMetric(m.key)}
            >
              {m.label}
            </Chip>
          ))}
        </div>
      </FieldRow>

      <FieldRow
        label="성별"
        hint={segOk ? undefined : "생활인구를 고를 때만 걸려요."}
      >
        <div className="flex flex-wrap gap-[8px]">
          {SEXES.map((s) => (
            <Chip
              key={s.key}
              on={form.sex === s.key}
              disabled={!segOk}
              onClick={() => setForm((f) => ({ ...f, sex: s.key }))}
            >
              {s.label}
            </Chip>
          ))}
        </div>
      </FieldRow>

      <FieldRow
        label="연령"
        hint={
          segOk
            ? "여러 개를 고를 수 있어요. 하나도 안 고르면 전 연령이에요."
            : "생활인구를 고를 때만 걸려요."
        }
      >
        <div className="flex flex-wrap gap-[8px]">
          <Chip
            on={!form.ages.length}
            disabled={!segOk}
            onClick={() => setForm((f) => ({ ...f, ages: [] }))}
          >
            전체
          </Chip>
          {AGES.map((a) => (
            <Chip
              key={a.key}
              on={form.ages.includes(a.key)}
              disabled={!segOk}
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  ages: f.ages.includes(a.key)
                    ? f.ages.filter((x) => x !== a.key)
                    : AGES.map((x) => x.key).filter(
                        (k) => k === a.key || f.ages.includes(k),
                      ),
                }))
              }
            >
              {a.label}
            </Chip>
          ))}
        </div>
      </FieldRow>

      <FieldRow label="순서" hint="작은 수부터 위에 나와요.">
        <input
          type="number"
          value={form.sortOrder}
          onChange={(e) =>
            setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))
          }
          className="h-[40px] w-[100px] rounded-[6px] border border-stroke bg-surface px-[12px] text-sm text-black outline-none focus:border-primary"
        />
      </FieldRow>

      <FieldRow label="노출">
        <div className="flex flex-wrap gap-[8px]">
          <Chip
            on={form.isPublished}
            onClick={() => setForm((f) => ({ ...f, isPublished: true }))}
          >
            보이기
          </Chip>
          <Chip
            on={!form.isPublished}
            onClick={() => setForm((f) => ({ ...f, isPublished: false }))}
          >
            숨기기
          </Chip>
        </div>
      </FieldRow>

      <div className="flex flex-wrap items-center justify-between gap-[12px] border-t border-primary-200 pt-[16px]">
        <p className="text-sm text-gray-700">
          매체 찾기에 보일 조건:{" "}
          <span className="font-semibold text-primary">
            {popTargetText(form)}
          </span>
        </p>
        <div className="flex gap-[8px]">
          <Button variant="tertiary" onPress={onDone} isDisabled={saving}>
            취소
          </Button>
          <Button onPress={save} isDisabled={saving || !form.label.trim()}>
            {target ? "저장" : "만들기"}
          </Button>
        </div>
      </div>
    </section>
  );
}
