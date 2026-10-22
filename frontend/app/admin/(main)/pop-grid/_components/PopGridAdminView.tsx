"use client";

import { Button } from "@heroui/react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";

import {
  type AdminPopGridMonth,
  popGridApi,
  useAdminPopGridDelete,
  useAdminPopGridMonths,
  useAdminPopGridUpload,
} from "@/hooks/popGrid";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { useSonner } from "@/hooks/useSonner";
import { extractApiError } from "@/lib/apiError";
import { createSeoulZipWorker } from "@/lib/popGrid/createSeoulZipWorker";
import type {
  SeoulZipWorkerIn,
  SeoulZipWorkerOut,
} from "@/lib/popGrid/seoulZip.worker";

// 지도 층 이름과 같은 순서·이름.
const METRIC_COLUMNS: { key: string; label: string }[] = [
  { key: "live", label: "생활인구" },
  { key: "stay", label: "체류인구" },
  { key: "subway", label: "지하철" },
  { key: "bus", label: "버스" },
  { key: "walk", label: "보행" },
];
const SEOUL_LIVE_URL =
  "https://data.seoul.go.kr/dataList/OA-22784/F/1/datasetView.do";
const SEOUL_STAY_URL =
  "https://data.seoul.go.kr/dataList/OA-22892/F/1/datasetView.do";

const ymText = (ym: string) => `${ym.slice(0, 4)}년 ${Number(ym.slice(4))}월`;

function sourceText(m: AdminPopGridMonth): string {
  const kinds = new Set(Object.values(m.sources).map((s) => s.source));
  return [
    kinds.has("handover") && "인계 월 파일",
    kinds.has("seoul-raw") && "서울시 원자료",
  ]
    .filter(Boolean)
    .join(" + ");
}

function lastUpload(m: AdminPopGridMonth): string {
  const latest = Object.values(m.sources)
    .filter((s) => s.uploaded_at)
    .sort((a, b) => (a.uploaded_at! < b.uploaded_at! ? 1 : -1))[0];
  if (!latest) return "-";
  const d = new Date(latest.uploaded_at!);
  return `${d.toLocaleDateString("ko-KR")} ${d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} · ${latest.by ?? ""}`;
}

/**
 * 어드민 "유동인구 데이터" — 매체 찾기 지도 "유동인구" 층에 쓰는 서울 250m 격자 월별 값을 올리고 지운다.
 * ① 인계 월 파일(유동인구 지도 인계 패키지 period/YYYYMM.js) — 생활·체류·지하철·버스·보행 모두, 여러 달 한 번에.
 * ② 서울시 원자료 zip — 브라우저(Web Worker)가 격자별로 요약해 작은 파일(약 3MB)만 올린다. 생활·체류만 바뀐다.
 */
export function PopGridAdminView() {
  const { data, isLoading } = useAdminPopGridMonths();
  const upload = useAdminPopGridUpload();
  const remove = useAdminPopGridDelete();
  const { success, error } = useSonner();
  const { confirm, alert, confirmDialog } = useAdminConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [handoverBusy, setHandoverBusy] = useState<string | null>(null);

  const handleHandover = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    e.target.value = "";
    if (!files.length) return;
    const done: string[] = [];
    const failed: string[] = [];
    for (const f of files) {
      setHandoverBusy(
        `${f.name} 올리는 중… (${done.length + failed.length + 1}/${files.length})`,
      );
      try {
        const r = await upload.mutateAsync(f);
        const live = r.totals.live;
        done.push(
          `${ymText(r.ym)} — 자료 ${r.metrics.length}종${live ? ` · 서울 생활인구 ${Math.round(live / 10000).toLocaleString()}만 명` : ""}`,
        );
      } catch (err) {
        failed.push(`${f.name} — ${extractApiError(err, "올리지 못했어요")}`);
      }
    }
    setHandoverBusy(null);
    await alert({
      title: failed.length
        ? "일부를 올리지 못했어요"
        : `${done.length}개 달을 올렸어요`,
      description: [...done, ...failed].join("\n"),
      confirmText: "확인",
    });
  };

  const handleDelete = async (ym: string) => {
    const ok = await confirm({
      title: `${ymText(ym)} 값을 지울까요?`,
      description:
        "지도에서 이 달을 더 고를 수 없게 돼요. 파일을 다시 올리면 되살릴 수 있어요.",
      confirmText: "지우기",
      cancelText: "취소",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(ym);
      success(`${ymText(ym)} 값을 지웠어요.`);
    } catch {
      error("지우지 못했어요. 잠시 뒤 다시 해 주세요.");
    }
  };

  const months = data?.months ?? [];

  return (
    <div className="flex flex-col gap-[32px]">
      {confirmDialog}
      <div className="flex flex-col gap-[8px]">
        <h1 className="text-2xl leading-[32px] font-bold text-black">
          유동인구 데이터
        </h1>
        <p className="text-sm leading-[20px] text-gray-600">
          매체 찾기 지도의 「유동인구」 층에 쓰는 서울 250m 격자(
          {(data?.cellCount ?? 8617).toLocaleString()}칸) 월별 값이에요. 여기
          올린 달만 지도에서 고를 수 있어요. 같은 달을 다시 올리면 파일에 든
          자료만 새 값으로 바뀌어요.
        </p>
      </div>

      <div className="grid gap-[16px] lg:grid-cols-2">
        <section className="flex flex-col gap-[12px] rounded-[12px] border border-stroke p-[20px]">
          <div className="flex flex-col gap-[4px]">
            <h2 className="text-base leading-[24px] font-bold text-black">
              ① 인계 월 파일 올리기
            </h2>
            <p className="text-sm leading-[20px] text-gray-600">
              유동인구 지도 인계 패키지의{" "}
              <code>5_격자체류인구/period/YYYYMM.js</code> 파일(달마다 약 4MB).
              생활·체류인구와 지하철·버스·보행까지 모두 들어 있어요. 여러 개를
              한 번에 고를 수 있어요.
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".js"
            multiple
            className="hidden"
            onChange={handleHandover}
          />
          <div className="flex items-center gap-[12px]">
            <Button
              variant="outline"
              onPress={() => fileRef.current?.click()}
              isDisabled={!!handoverBusy}
            >
              월 파일 고르기
            </Button>
            {handoverBusy && (
              <span className="text-sm text-gray-600">{handoverBusy}</span>
            )}
          </div>
        </section>

        <SeoulRawUpload />
      </div>

      <section className="flex flex-col gap-[12px]">
        <h2 className="text-base leading-[24px] font-semibold text-black">
          들어 있는 달 {months.length ? `${months.length}개` : ""}
        </h2>
        {isLoading ? (
          <p className="text-sm text-gray-500">불러오는 중…</p>
        ) : months.length === 0 ? (
          <p className="text-sm text-gray-500">
            아직 올린 달이 없어요. 위에서 파일을 올리면 매체 찾기 지도에
            「유동인구」 층이 생겨요.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[12px] border border-stroke">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-tone-fafaf9 text-left text-gray-600">
                <tr>
                  <th className="px-[16px] py-[10px] font-semibold">달</th>
                  {METRIC_COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      className="px-[8px] py-[10px] text-center font-semibold"
                    >
                      {c.label}
                    </th>
                  ))}
                  <th className="px-[16px] py-[10px] font-semibold">출처</th>
                  <th className="px-[16px] py-[10px] font-semibold">
                    마지막으로 올린 때
                  </th>
                  <th className="px-[16px] py-[10px]" />
                </tr>
              </thead>
              <tbody>
                {[...months].reverse().map((m) => (
                  <tr key={m.ym} className="border-t border-stroke">
                    <td className="px-[16px] py-[10px] font-semibold whitespace-nowrap text-black">
                      {ymText(m.ym)}
                    </td>
                    {METRIC_COLUMNS.map((c) => {
                      const s = m.sources[c.key];
                      const has = m.metrics.includes(c.key);
                      return (
                        <td
                          key={c.key}
                          className="px-[8px] py-[10px] text-center"
                        >
                          {has ? (
                            <span
                              className="text-success"
                              title={
                                c.key === "walk" && s?.quarter
                                  ? `${s.quarter.slice(0, 4)}년 ${s.quarter.slice(4)}분기 값${s.fallback ? " (그 분기 미공개라 앞 분기 값)" : ""}`
                                  : undefined
                              }
                            >
                              ●
                              {c.key === "walk" && s?.fallback && (
                                <span className="ml-[2px] text-xs text-amber-600">
                                  앞 분기
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-[16px] py-[10px] whitespace-nowrap text-gray-600">
                      {sourceText(m)}
                    </td>
                    <td className="px-[16px] py-[10px] whitespace-nowrap text-gray-600">
                      {lastUpload(m)}
                    </td>
                    <td className="px-[16px] py-[10px] text-right">
                      <Button
                        size="sm"
                        variant="tertiary"
                        onPress={() => handleDelete(m.ym)}
                        isDisabled={remove.isPending}
                      >
                        지우기
                      </Button>
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

type Progress = { stage: string; file: string; done: number; total: number };

/**
 * ② 서울시 원자료 — 생활인구·체류인구 250m 내국인 월 zip(각 약 500MB)을 브라우저에서 요약해 올린다.
 * 압축을 풀면 5GB가 넘어 서버로 그대로 보낼 수 없다. 요약은 Web Worker 에서 돌아 화면이 멈추지 않는다(1~3분).
 */
function SeoulRawUpload() {
  const now = new Date();
  // 서울시는 한두 달 늦게 올린다 — 기본은 지난달.
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [year, setYear] = useState(prev.getFullYear());
  const [month, setMonth] = useState(prev.getMonth() + 1);
  const [live, setLive] = useState<File | null>(null);
  const [stay, setStay] = useState<File | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [busy, setBusy] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const upload = useAdminPopGridUpload();
  const { alert, confirmDialog } = useAdminConfirm();
  const ym = `${year}${String(month).padStart(2, "0")}`;

  useEffect(() => () => workerRef.current?.terminate(), []);

  const run = async () => {
    if (!live && !stay) return;
    setBusy(true);
    setProgress(null);
    try {
      const cells = (await popGridApi.cells()).map((c) => c[0]);
      const text = await new Promise<string>((resolve, reject) => {
        const worker = createSeoulZipWorker();
        workerRef.current = worker;
        worker.onmessage = (e: MessageEvent<SeoulZipWorkerOut>) => {
          const msg = e.data;
          if (msg.type === "progress") setProgress(msg);
          else if (msg.type === "done") resolve(msg.text);
          else reject(new Error(msg.message));
        };
        worker.onerror = () =>
          reject(new Error("요약하는 중에 오류가 났어요."));
        const start: SeoulZipWorkerIn = {
          type: "start",
          ym,
          cells,
          live: live ?? undefined,
          stay: stay ?? undefined,
        };
        worker.postMessage(start);
      }).finally(() => {
        workerRef.current?.terminate();
        workerRef.current = null;
      });
      setProgress({ stage: "upload", file: "", done: 0, total: 0 });
      const file = new File([text], `${ym}_seoul-raw.js`, {
        type: "text/javascript",
      });
      const r = await upload.mutateAsync(file);
      const lines = [
        `${ymText(r.ym)} — ${r.metrics.includes("live") ? "생활인구" : ""}${r.metrics.includes("live") && r.metrics.includes("stay") ? "·" : ""}${r.metrics.includes("stay") ? "체류인구" : ""}를 바꿨어요.`,
      ];
      if (r.totals.live)
        lines.push(
          `서울 생활인구(하루 평균) ${Math.round(r.totals.live / 10000).toLocaleString()}만 명 — 1,000만 명 남짓이면 정상이에요.`,
        );
      lines.push(
        "지하철·버스·보행은 이 방법으로 바뀌지 않아요(그 달에 있던 값 그대로).",
      );
      await alert({
        title: "올렸어요",
        description: lines.join("\n"),
        confirmText: "확인",
      });
      setLive(null);
      setStay(null);
    } catch (err) {
      await alert({
        title: "올리지 못했어요",
        description: extractApiError(
          err,
          err instanceof Error ? err.message : String(err),
        ),
        confirmText: "확인",
      });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const cancel = () => {
    workerRef.current?.postMessage({
      type: "cancel",
    } satisfies SeoulZipWorkerIn);
  };

  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : null;
  const stageText =
    progress?.stage === "live"
      ? "생활인구 요약 중"
      : progress?.stage === "stay"
        ? "체류인구 요약 중"
        : progress?.stage === "pack"
          ? "파일 만드는 중"
          : progress?.stage === "upload"
            ? "서버에 올리는 중"
            : "준비 중";

  return (
    <section className="flex flex-col gap-[12px] rounded-[12px] border border-stroke p-[20px]">
      {confirmDialog}
      <div className="flex flex-col gap-[4px]">
        <h2 className="text-base leading-[24px] font-bold text-black">
          ② 서울시 원자료로 올리기
        </h2>
        <p className="text-sm leading-[20px] text-gray-600">
          서울 열린데이터광장에서 받은 월 zip을 그대로 고르세요. 이 PC에서
          격자별로 요약한 뒤(1~3분) 약 3MB만 올려요. 생활·체류인구만 바뀌고,
          지하철·버스·보행은 그 달에 있던 값 그대로예요.
        </p>
      </div>

      <div className="flex items-center gap-[8px] text-sm">
        <span className="font-semibold text-black">자료 달</span>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          disabled={busy}
          className="h-[36px] rounded-[8px] border border-stroke bg-surface px-[8px]"
        >
          {Array.from(
            { length: now.getFullYear() - 2022 },
            (_, i) => 2023 + i,
          ).map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          disabled={busy}
          className="h-[36px] rounded-[8px] border border-stroke bg-surface px-[8px]"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m}월
            </option>
          ))}
        </select>
      </div>

      <ZipSlot
        title="생활인구 250m 내국인"
        hint={`250_LOCAL_RESD_${ym}.zip`}
        href={SEOUL_LIVE_URL}
        file={live}
        onFile={setLive}
        disabled={busy}
      />
      <ZipSlot
        title="체류인구 250m 내국인"
        hint={`SEOUL_STYTIME_04_250M_OPEN_NATIVE_${ym}.zip`}
        href={SEOUL_STAY_URL}
        file={stay}
        onFile={setStay}
        disabled={busy}
      />

      {busy && (
        <div className="flex flex-col gap-[6px]">
          <div className="flex justify-between text-xs text-gray-600">
            <span>
              {stageText}
              {progress?.file ? ` · ${progress.file}` : ""}
            </span>
            {pct != null && <span className="tabular-nums">{pct}%</span>}
          </div>
          <div className="h-[6px] overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${pct ?? 5}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex gap-[8px]">
        <Button
          variant="primary"
          onPress={run}
          isDisabled={busy || (!live && !stay)}
        >
          {busy ? "요약하는 중…" : `${ymText(ym)} 요약해서 올리기`}
        </Button>
        {busy && progress?.stage !== "upload" && (
          <Button variant="tertiary" onPress={cancel}>
            취소
          </Button>
        )}
      </div>
    </section>
  );
}

function ZipSlot({
  title,
  hint,
  href,
  file,
  onFile,
  disabled,
}: {
  title: string;
  hint: string;
  href: string;
  file: File | null;
  onFile: (f: File | null) => void;
  disabled: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center justify-between gap-[12px] rounded-[10px] bg-tone-fafaf9 px-[14px] py-[10px]">
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold text-black">
          {title}{" "}
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="ml-[4px] text-xs font-medium text-primary underline"
          >
            받는 곳
          </a>
        </span>
        <span className="truncate text-xs text-gray-500">
          {file ? `${file.name} · ${(file.size / 1e6).toFixed(0)}MB` : hint}
        </span>
      </div>
      <input
        ref={ref}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      <div className="flex shrink-0 gap-[4px]">
        {file && (
          <Button
            size="sm"
            variant="tertiary"
            onPress={() => onFile(null)}
            isDisabled={disabled}
          >
            빼기
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onPress={() => ref.current?.click()}
          isDisabled={disabled}
        >
          zip 고르기
        </Button>
      </div>
    </div>
  );
}
