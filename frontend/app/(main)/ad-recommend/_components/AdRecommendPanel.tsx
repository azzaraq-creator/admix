"use client";

import { Loader2, Megaphone, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NODE_LABELS,
  type AdRecommendMedia,
  type AdRecommendPivot,
  type AdRecommendSlots,
  type AdRecommendTopPick,
} from "@/hooks/adRecommend";
import {
  adSessionsApi,
  adSessionsKeys,
  useAdSession,
  useCreateAdSession,
} from "@/hooks/adSessions";
import type { AdMessageOut } from "@/hooks/adSessions";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

type AssistantStatus = "progress" | "complete" | "error";

interface UserMessageVM {
  kind: "user";
  id: string;
  content: string;
}

interface AssistantMessageVM {
  kind: "assistant";
  id: string;
  status: AssistantStatus;
  activeStepLabel?: string;
  completedSteps: string[];
  slots?: AdRecommendSlots;
  matchedMedia?: AdRecommendMedia[];
  summary?: string;
  topPicks?: AdRecommendTopPick[];
  pivots?: AdRecommendPivot[];
  assistantText?: string;
  error?: string;
}

type MessageVM = UserMessageVM | AssistantMessageVM;

const randomId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);


// DB 메시지 → 화면용 VM 변환. payload 안 slots/matched_media 등을 그대로 가져옴.
function dbMessageToVM(m: AdMessageOut): MessageVM {
  if (m.role === "user") {
    return { kind: "user", id: m.id, content: m.content };
  }
  const p = (m.payload || {}) as Record<string, unknown>;
  return {
    kind: "assistant",
    id: m.id,
    status: "complete",
    completedSteps: [],
    slots: (p.slots as AdRecommendSlots) || undefined,
    matchedMedia: (p.matched_media as AdRecommendMedia[]) || undefined,
    summary: (p.summary as string) || undefined,
    topPicks: (p.top_picks as AdRecommendTopPick[]) || undefined,
    pivots: (p.pivots as AdRecommendPivot[]) || undefined,
    assistantText: m.content || undefined,
  };
}

interface Props {
  sessionId: string;
}

export function AdRecommendPanel({ sessionId }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: session } = useAdSession(sessionId);

  // DB 메시지 + 진행 중 메시지 둘 다 messages 에 보관. stream 끝나면 invalidate 로 DB 동기화.
  const dbMessages = useMemo<MessageVM[]>(
    () => (session?.messages || []).map(dbMessageToVM),
    [session?.messages],
  );
  const [pendingMessages, setPendingMessages] = useState<MessageVM[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const messages = useMemo<MessageVM[]>(
    () => [...dbMessages, ...pendingMessages],
    [dbMessages, pendingMessages],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 세션 변경 시 pending 초기화
  useEffect(() => {
    setPendingMessages([]);
  }, [sessionId]);

  const updateAssistant = (id: string, patch: (m: AssistantMessageVM) => AssistantMessageVM) => {
    setPendingMessages((prev) =>
      prev.map((m) => (m.id === id && m.kind === "assistant" ? patch(m) : m)),
    );
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || running) return;

    const userId = randomId();
    const assistantId = randomId();
    setPendingMessages((prev) => [
      ...prev,
      { kind: "user", id: userId, content: q },
      {
        kind: "assistant",
        id: assistantId,
        status: "progress",
        completedSteps: [],
      },
    ]);
    setInput("");
    setRunning(true);

    try {
      const res = await fetch(`${API_URL}/chat/graph/sessions/${sessionId}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`SSE 연결 실패: ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let blockEnd = buffer.indexOf("\n\n");
        while (blockEnd >= 0) {
          const block = buffer.slice(0, blockEnd);
          buffer = buffer.slice(blockEnd + 2);
          handleEventBlock(block, assistantId, updateAssistant);
          blockEnd = buffer.indexOf("\n\n");
        }
      }

      // stream 끝. pendingMessages 는 그대로 유지 — progress 단계 + 결과가 함께 보이게.
      // DB 는 페이지 새로고침 시 자동 fetch. 세션 list 만 갱신 (사이드바 정렬용).
      await qc.invalidateQueries({ queryKey: adSessionsKeys.list() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "stream 실패";
      updateAssistant(assistantId, (prev) => ({
        ...prev,
        status: "error",
        error: msg,
        activeStepLabel: undefined,
      }));
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  const onPivot = (p: AdRecommendPivot) => {
    const slot = p.suggested_slot_change;
    const region = Array.isArray(slot.region) ? (slot.region as string[]).join(", ") : null;
    if (region) {
      setInput(`지역을 ${region}로 바꿔서 다시 추천해줘`);
      return;
    }
    if (
      slot.target &&
      typeof slot.target === "object" &&
      "raw" in (slot.target as Record<string, unknown>)
    ) {
      const raw = (slot.target as { raw?: string }).raw;
      if (raw) {
        setInput(`타겟을 ${raw}로 바꿔서 다시 추천해줘`);
        return;
      }
    }
    setInput(p.label);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-[var(--stroke-subtle)] px-6 py-3">
        <Megaphone size={18} className="text-[var(--accent-cosmos)]" />
        <h1 className="text-[15px] font-medium text-[var(--text-primary)]">
          {session?.title || "광고 매체 추천"}
        </h1>
        {session?.thread_id && (
          <span className="text-[11px] text-[var(--text-tertiary)]">
            · thread {session.thread_id.slice(-6)}
          </span>
        )}
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {messages.length === 0 && (
          <div className="mx-auto max-w-md text-center text-[13px] text-[var(--text-tertiary)]">
            예: <em>“강남에서 빌보드 광고 1억 예산으로 화장품 브랜딩하고 싶어요”</em>
            <br />
            지역 / 예산 / 매체 타입 / 제품 / 타겟 / 목적을 자연어로 말해주세요.
          </div>
        )}
        {messages.map((m) =>
          m.kind === "user" ? (
            <UserBubble key={m.id} content={m.content} />
          ) : (
            <AssistantBubble key={m.id} message={m} onPivot={onPivot} />
          ),
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={onSubmit}
        className="flex gap-2 border-t border-[var(--stroke-subtle)] px-6 py-3"
      >
        <Input
          placeholder={running ? "응답 생성 중..." : "메시지를 입력하세요"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={running}
        />
        <Button type="submit" disabled={!input.trim() || running}>
          {running ? "..." : "전송"}
        </Button>
      </form>
    </div>
  );
}

// SSE 이벤트 한 블록 처리 — assistant 메시지 mutate.
function handleEventBlock(
  block: string,
  assistantId: string,
  updateAssistant: (id: string, patch: (m: AssistantMessageVM) => AssistantMessageVM) => void,
) {
  let eventName = "message";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) eventName = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(dataLines.join("\n"));
  } catch {
    return;
  }

  if (eventName === "node") {
    const name = data.name as string;
    const update = (data.update || {}) as Record<string, unknown>;
    const label = NODE_LABELS[name] || name;
    updateAssistant(assistantId, (prev) => {
      const completed = prev.activeStepLabel
        ? [...prev.completedSteps, prev.activeStepLabel]
        : prev.completedSteps;
      return {
        ...prev,
        completedSteps: completed,
        activeStepLabel: label,
        slots: (update.slots as AdRecommendSlots) ?? prev.slots,
        matchedMedia:
          (update.matched_media as AdRecommendMedia[]) ?? prev.matchedMedia,
        summary: (update.summary as string) ?? prev.summary,
        topPicks: (update.top_picks as AdRecommendTopPick[]) ?? prev.topPicks,
        pivots: (update.pivots as AdRecommendPivot[]) ?? prev.pivots,
        assistantText:
          (update.assistant_message as string) ?? prev.assistantText,
      };
    });
    return;
  }
  if (eventName === "done") {
    updateAssistant(assistantId, (prev) => ({
      ...prev,
      status: "complete",
      completedSteps: prev.activeStepLabel
        ? [...prev.completedSteps, prev.activeStepLabel]
        : prev.completedSteps,
      activeStepLabel: undefined,
    }));
    return;
  }
  if (eventName === "error") {
    const msg = (data.message as string) || "stream error";
    updateAssistant(assistantId, (prev) => ({
      ...prev,
      status: "error",
      error: msg,
      activeStepLabel: undefined,
    }));
    toast.error(msg);
  }
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[rgba(124,58,237,0.18)] px-4 py-2 text-[13px] text-[var(--text-primary)]">
        {content}
      </div>
    </div>
  );
}

function AssistantBubble({
  message,
  onPivot,
}: {
  message: AssistantMessageVM;
  onPivot: (p: AdRecommendPivot) => void;
}) {
  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[85%] space-y-3 rounded-2xl rounded-bl-sm border border-[var(--stroke-subtle)] bg-white/5 px-4 py-3">
        {message.status === "error" ? (
          <div className="text-[13px] text-red-300">⚠ {message.error}</div>
        ) : (
          <>
            <ProgressView message={message} />
            {message.slots && <SlotsChips slots={message.slots} />}
            {message.matchedMedia && message.matchedMedia.length > 0 && (
              <MediaList items={message.matchedMedia} />
            )}
            {message.assistantText && (
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-[var(--text-primary)]">
                {message.assistantText}
              </p>
            )}
            {message.summary && (
              <SummaryCard
                summary={message.summary}
                topPicks={message.topPicks}
              />
            )}
            {message.pivots && message.pivots.length > 0 && (
              <PivotsRow pivots={message.pivots} onPivot={onPivot} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ProgressView({ message }: { message: AssistantMessageVM }) {
  const inProgress = message.status === "progress";
  // stream 끝난 후에도 step 흔적은 남겨두기 — 사용자가 어떤 단계 거쳤는지 확인.
  if (!inProgress && message.completedSteps.length === 0) return null;
  return (
    <div className="space-y-1 text-[12px]">
      {message.completedSteps.map((label, i) => (
        <div key={`${label}-${i}`} className="text-[var(--text-tertiary)]">
          ✓ {label}
        </div>
      ))}
      {inProgress && message.activeStepLabel && (
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          <Loader2 size={12} className="animate-spin text-[var(--accent-cosmos)]" />
          <span>{message.activeStepLabel} 중...</span>
        </div>
      )}
    </div>
  );
}

function SlotsChips({ slots }: { slots: AdRecommendSlots }) {
  const items: { label: string; value: string }[] = [];
  if (slots.region && slots.region.length > 0)
    items.push({ label: "지역", value: slots.region.join(", ") });
  if (typeof slots.budget === "number")
    items.push({ label: "예산", value: `${slots.budget.toLocaleString()}원` });
  if (slots.media_type && slots.media_type.length > 0)
    items.push({ label: "매체", value: slots.media_type.join(", ") });
  if (slots.product && slots.product.length > 0)
    items.push({ label: "제품", value: slots.product.join(", ") });
  if (slots.goal_label) items.push({ label: "목적", value: slots.goal_label });
  if (slots.target?.raw) items.push({ label: "타겟", value: slots.target.raw });
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <span
          key={it.label}
          className="rounded-md border border-[var(--stroke-subtle)] bg-white/5 px-2 py-0.5 text-[11px] text-[var(--text-secondary)]"
        >
          <span className="text-[var(--text-tertiary)]">{it.label}</span>{" "}
          <span className="text-[var(--text-primary)]">{it.value}</span>
        </span>
      ))}
    </div>
  );
}

function SummaryCard({
  summary,
  topPicks,
}: {
  summary: string;
  topPicks?: AdRecommendTopPick[];
}) {
  return (
    <div className="rounded-md border border-[rgba(165,180,252,0.16)] bg-[rgba(124,58,237,0.06)] p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
        <Sparkles size={11} /> Summary
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-primary)]">
        {summary}
      </p>
      {topPicks && topPicks.length > 0 && (
        <ul className="mt-2 space-y-1">
          {topPicks.map((tp) => (
            <li
              key={tp.media_id}
              className="text-[12px] text-[var(--text-secondary)]"
            >
              <span className="text-[var(--accent-cosmos)]">#{tp.media_id}</span>{" "}
              — {tp.why}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PivotsRow({
  pivots,
  onPivot,
}: {
  pivots: AdRecommendPivot[];
  onPivot: (p: AdRecommendPivot) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
        다른 방향 탐색
      </div>
      <div className="flex flex-wrap gap-1.5">
        {pivots.map((p, i) => (
          <button
            key={`${p.label}-${i}`}
            type="button"
            onClick={() => onPivot(p)}
            className="rounded-full border border-[var(--stroke-subtle)] bg-white/5 px-3 py-1 text-[11px] text-[var(--text-primary)] transition hover:bg-white/10"
            title={p.hint}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MediaList({ items }: { items: AdRecommendMedia[] }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
        Top {items.length} 매체
      </div>
      <ul className="space-y-1.5">
        {items.map((m, i) => (
          <li
            key={m.media_id}
            className="flex items-start gap-2 rounded-md border border-[var(--stroke-subtle)] p-2"
          >
            <div className="w-5 pt-0.5 text-[11px] text-[var(--text-tertiary)]">
              {i + 1}
            </div>
            {m.thumbnail_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.thumbnail_url}
                alt=""
                className="h-10 w-10 flex-shrink-0 rounded object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] text-[var(--text-primary)]">
                <span className="text-[var(--text-tertiary)]">#{m.media_id}</span>
                {" - "}
                <span>{m.media_name || "(매체명 없음)"}</span>
              </div>
              {m.product_display_name && (
                <div className="truncate text-[11px] text-[var(--text-secondary)]">
                  {m.product_display_name}
                </div>
              )}
              <div className="truncate text-[10px] text-[var(--text-tertiary)]">
                {m.district || m.city} · {m.parent_category}/{m.category}
                {m.sangwon_matched_name && ` · 상권: ${m.sangwon_matched_name}`}
              </div>
              {m.reason && (
                <div className="mt-1 text-[11px] leading-relaxed text-[var(--accent-cosmos)]">
                  → {m.reason}
                </div>
              )}
            </div>
            <div className="text-right text-[11px] text-[var(--text-primary)]">
              {typeof m.ad_price === "number"
                ? `${m.ad_price.toLocaleString()}원`
                : "N/A"}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
