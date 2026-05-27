"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
const MIN_INPUT_LEN = 3;

type ResponseType = "chat" | "list" | "need_more" | "confirmation_required";

interface ExtractedCodes {
  ind: string[];
  prd: string[];
  obj: string[];
  tgt: string[];
  loc: string[];
  cat: string[];
  assumptions: string[];
}

interface EnrichedCode {
  code: string;
  description: string;
}

interface ChangeEntry {
  category: string;
  type: string;
  old_values: string[];
  new_values: string[];
}

interface MediaItem {
  id: string;
  name: string;
  media_source: string;
  price?: string;
  thumbnail_url?: string;
  detail_images: string[];
}

interface ConfirmationInfo {
  message?: string;
  changes?: ChangeEntry[];
  enriched_extracted?: Record<string, EnrichedCode[]>;
  previous_context_detail?: Record<string, EnrichedCode[]>;
}

interface V2Message {
  id: string;
  type: "user" | "assistant";
  content?: string;
  response_type?: ResponseType;
  message?: string;
  items?: MediaItem[];
  match_count?: number;
  extracted?: ExtractedCodes;
  enriched_extracted?: Record<string, EnrichedCode[]>;
  previous_context?: Record<string, string[]>;
  previous_context_detail?: Record<string, EnrichedCode[]>;
  changes?: ChangeEntry[];
  matched_categories?: number;
  isLoading?: boolean;
  confirmation?: ConfirmationInfo;
}

const randomId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const CATEGORY_LABELS: Record<keyof Omit<ExtractedCodes, "assumptions">, string> = {
  ind: "업종",
  prd: "제품",
  obj: "목적",
  tgt: "타깃",
  loc: "지역",
  cat: "카테고리",
};

interface Props {
  sessionId: string;
}

export function AdRecommendV2Panel({ sessionId }: Props) {
  const [messages, setMessages] = useState<V2Message[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submitMessage = async (text: string, opts?: { allowShort?: boolean }) => {
    const q = text.trim();
    if (running) return;
    if (!opts?.allowShort && q.length < MIN_INPUT_LEN) return;
    if (!q) return;

    const userId = randomId();
    const assistantId = randomId();

    setMessages((prev) => [
      ...prev,
      { id: userId, type: "user", content: q },
      { id: assistantId, type: "assistant", isLoading: true },
    ]);
    setInput("");
    setRunning(true);

    try {
      const res = await fetch(`${API_URL}/recommend/v2/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, session_id: sessionId }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`API 요청 실패: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let blockEnd = buffer.indexOf("\n\n");
        while (blockEnd >= 0) {
          const block = buffer.slice(0, blockEnd);
          buffer = buffer.slice(blockEnd + 2);
          handleEventBlock(block, assistantId);
          blockEnd = buffer.indexOf("\n\n");
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "요청 실패";
      toast.error(msg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, isLoading: false, message: `오류: ${msg}` }
            : m,
        ),
      );
    } finally {
      setRunning(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitMessage(input);
  };

  // 마지막 메시지가 confirmation_required 인지 확인 — 빠른 답 버튼 활성화용
  const lastConfirming = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.type !== "assistant") continue;
      if (m.confirmation) return m.id;
      // 다른 어시스턴트 응답이 나왔다면 confirmation 은 종료된 상태
      if (m.message || m.items?.length) return null;
    }
    return null;
  })();

  const handleEventBlock = (block: string, assistantId: string) => {
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

    if (eventName === "message") {
      const msgType = (data.type as ResponseType) || "chat";

      if (msgType === "confirmation_required") {
        // 확인 요청 이벤트는 후속 message 이벤트가 본 응답을 덮어쓰므로
        // confirmation 서브필드에 별도 저장한다 (덮어쓰기 방지).
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  isLoading: false,
                  confirmation: {
                    message: (data.message as string) || "",
                    changes: (data.changes as ChangeEntry[]) || undefined,
                    enriched_extracted:
                      (data.enriched_extracted as Record<string, EnrichedCode[]>) || undefined,
                    previous_context_detail:
                      (data.previous_context_detail as Record<string, EnrichedCode[]>) || undefined,
                  },
                }
              : m,
          ),
        );
        return;
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                isLoading: false,
                response_type: msgType,
                message: (data.message as string) || "",
                items: (data.items as MediaItem[]) || [],
                match_count: (data.match_count as number) || 0,
                extracted: (data.extracted as ExtractedCodes) || undefined,
                enriched_extracted:
                  (data.enriched_extracted as Record<string, EnrichedCode[]>) || undefined,
                previous_context:
                  (data.previous_context as Record<string, string[]>) || undefined,
                previous_context_detail:
                  (data.previous_context_detail as Record<string, EnrichedCode[]>) || undefined,
                changes: (data.changes as ChangeEntry[]) || undefined,
                matched_categories: (data.matched_categories as number) || undefined,
              }
            : m,
        ),
      );
    } else if (eventName === "done") {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, isLoading: false } : m,
        ),
      );
    } else if (eventName === "error") {
      const msg = (data.message as string) || "알 수 없는 오류";
      toast.error(msg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, isLoading: false, message: `오류: ${msg}` } : m,
        ),
      );
    }
  };

  const firstUserMessage = messages.find((m) => m.type === "user");
  const headerTitle = firstUserMessage?.content?.slice(0, 40) || "V2 광고 매체 추천";

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-[var(--stroke-subtle)] px-6 py-3">
        <Sparkles size={18} className="text-[var(--accent-cosmos)]" />
        <h1 className="text-[15px] font-medium text-[var(--text-primary)]">
          {headerTitle}
        </h1>
        <span className="rounded bg-[rgba(124,58,237,0.2)] px-2 py-0.5 text-[10px] text-[var(--accent-cosmos)]">
          V2
        </span>
        {sessionId && (
          <span className="text-[11px] text-[var(--text-tertiary)]">
            · {sessionId.slice(-6)}
          </span>
        )}
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {messages.length === 0 && (
          <div className="mx-auto max-w-md text-center text-[13px] text-[var(--text-tertiary)]">
            예: <em>“강남역 근처 빌보드, 2030 타깃, 브랜드 광고 5000만원”</em>
            <br />
            지역, 예산, 제품, 업종, 목적, 타깃을 자연어로 알려주세요.
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id}>
            {m.type === "user" ? (
              <UserBubble content={m.content!} />
            ) : (
              <AssistantBubble message={m} />
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {lastConfirming && (
        <div className="flex items-center gap-2 border-t border-[var(--stroke-subtle)] px-6 py-2">
          <span className="text-[11px] text-[var(--text-tertiary)]">
            조건을 교체할까요?
          </span>
          <Button
            type="button"
            size="sm"
            disabled={running}
            onClick={() => void submitMessage("예", { allowShort: true })}
            className="bg-[rgba(124,58,237,0.25)] hover:bg-[rgba(124,58,237,0.4)]"
          >
            예, 교체
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={running}
            onClick={() => void submitMessage("아니오", { allowShort: true })}
          >
            아니오
          </Button>
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="flex items-start gap-2 border-t border-[var(--stroke-subtle)] px-6 py-3"
      >
        <div className="flex flex-1 flex-col gap-1">
          <Input
            placeholder={running ? "검색 중..." : "매체 조건을 입력하세요"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={running}
          />
          {input.trim().length > 0 && input.trim().length < MIN_INPUT_LEN && (
            <p className="text-[11px] text-[var(--text-tertiary)]">
              {MIN_INPUT_LEN}자 이상 입력해주세요
            </p>
          )}
        </div>
        <Button
          type="submit"
          disabled={input.trim().length < MIN_INPUT_LEN || running}
        >
          {running ? <Loader2 className="animate-spin" size={16} /> : "검색"}
        </Button>
      </form>
    </div>
  );
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

function AssistantBubble({ message }: { message: V2Message }) {
  if (message.isLoading) {
    return (
      <div className="flex justify-start">
        <div className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
          <Loader2 size={14} className="animate-spin text-[var(--accent-cosmos)]" />
          <span>검색 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[85%] space-y-3 rounded-2xl rounded-bl-sm border border-[var(--stroke-subtle)] bg-white/5 px-4 py-3">
        {message.confirmation && <ConfirmationView info={message.confirmation} />}
        {message.response_type === "need_more" && (
          <NeedMoreView message={message} />
        )}
        {message.message && (
          <p className="whitespace-pre-line text-[13px] leading-relaxed text-[var(--text-primary)]">
            {message.message}
          </p>
        )}
        {message.response_type === "list" && message.items && message.items.length > 0 && (
          <MediaList items={message.items} />
        )}
        {message.response_type === "list" && (
          <MergedSlotsView
            enriched={message.enriched_extracted}
            previous={message.previous_context_detail}
          />
        )}
        {message.match_count !== undefined && message.items && message.items.length === 0 && !message.message && (
          <div className="text-[12px] text-[var(--text-tertiary)]">
            조건에 맞는 매체가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

function ConfirmationView({ info }: { info: ConfirmationInfo }) {
  return (
    <div className="space-y-2 rounded-md border border-[rgba(234,179,8,0.35)] bg-[rgba(234,179,8,0.08)] px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[rgba(234,179,8,0.95)]">
        <span>⚠️</span>
        <span>조건 변경 확인 필요</span>
      </div>
      {info.message && (
        <p className="whitespace-pre-line text-[12px] leading-relaxed text-[var(--text-primary)]">
          {info.message}
        </p>
      )}
      {info.changes && info.changes.length > 0 && (
        <ul className="space-y-1 text-[11px] text-[var(--text-secondary)]">
          {info.changes.map((ch, i) => {
            const catLabel =
              CATEGORY_LABELS[ch.category as keyof typeof CATEGORY_LABELS] || ch.category;
            return (
              <li key={`${ch.category}-${i}`}>
                <span className="text-[var(--text-tertiary)]">{catLabel}</span>{" "}
                {(ch.old_values || []).join(", ") || "(없음)"} → {(ch.new_values || []).join(", ") || "(없음)"}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function mergeEnriched(
  ...sources: Array<Record<string, EnrichedCode[]> | undefined>
): Record<string, EnrichedCode[]> {
  const merged: Record<string, Map<string, string>> = {};
  for (const src of sources) {
    if (!src) continue;
    for (const [cat, items] of Object.entries(src)) {
      if (!Array.isArray(items)) continue;
      if (!merged[cat]) merged[cat] = new Map();
      for (const item of items) {
        if (!item || !item.code) continue;
        merged[cat].set(item.code, item.description || "");
      }
    }
  }
  const out: Record<string, EnrichedCode[]> = {};
  for (const [cat, m] of Object.entries(merged)) {
    out[cat] = Array.from(m.entries()).map(([code, description]) => ({ code, description }));
  }
  return out;
}

function MergedSlotsView({
  enriched,
  previous,
}: {
  enriched?: Record<string, EnrichedCode[]>;
  previous?: Record<string, EnrichedCode[]>;
}) {
  // 리스트 후 conversationHistory.extracted (= 이전 컨텍스트) 와 현재 enriched_extracted 를 머지하여
  // 누적된 현재 슬롯을 보여준다.
  const merged = mergeEnriched(previous, enriched);

  const rows: { label: string; items: EnrichedCode[] }[] = [];
  for (const [cat, label] of Object.entries(CATEGORY_LABELS)) {
    const items = merged[cat] || [];
    if (items.length > 0) rows.push({ label, items });
  }
  if (rows.length === 0) return null;

  return (
    <div className="space-y-1.5 border-t border-[var(--stroke-subtle)] pt-2">
      <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
        누적 슬롯
      </div>
      <div className="flex flex-wrap gap-1.5">
        {rows.map(({ label, items }) => (
          <span
            key={label}
            className="rounded-md border border-[rgba(124,58,237,0.3)] bg-[rgba(124,58,237,0.1)] px-2 py-0.5 text-[11px]"
          >
            <span className="text-[var(--text-tertiary)]">{label}</span>{" "}
            <span className="text-[var(--text-primary)]">
              {items.map((e) => e.description || e.code).join(", ")}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function NeedMoreView({ message }: { message: V2Message }) {
  // enriched_extracted 우선 (description) + previous_context_detail 머지.
  // 백엔드가 enriched 를 보내지 않는 예외 케이스만 raw extracted 로 폴백.
  const fromEnriched = message.enriched_extracted || message.previous_context_detail;
  const matchedCats: { label: string; values: string[] }[] = [];

  if (fromEnriched) {
    const merged = mergeEnriched(message.previous_context_detail, message.enriched_extracted);
    for (const [cat, label] of Object.entries(CATEGORY_LABELS)) {
      const items = merged[cat] || [];
      if (items.length > 0) {
        matchedCats.push({
          label,
          values: items.map((e) => e.description || e.code),
        });
      }
    }
  } else if (message.extracted) {
    const ext = message.extracted;
    for (const [cat, label] of Object.entries(CATEGORY_LABELS)) {
      const vals = ext[cat as keyof Omit<ExtractedCodes, "assumptions">];
      if (vals && vals.length > 0) {
        matchedCats.push({ label, values: vals });
      }
    }
  } else {
    return null;
  }

  if (matchedCats.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
        매칭된 조건
      </div>
      <div className="flex flex-wrap gap-1.5">
        {matchedCats.map(({ label, values }) => (
          <span
            key={label}
            className="rounded-md border border-[rgba(124,58,237,0.3)] bg-[rgba(124,58,237,0.1)] px-2 py-0.5 text-[11px]"
          >
            <span className="text-[var(--text-tertiary)]">{label}</span>
            {" "}
            <span className="text-[var(--text-primary)]">{values.join(", ")}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function MediaList({ items }: { items: MediaItem[] }) {
  return (
    <div>
      <div className="mb-2 text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
        추천 매체 ({items.length}개)
      </div>
      <ul className="space-y-2">
        {items.map((m, i) => (
          <li
            key={m.id}
            className="flex items-start gap-3 rounded-md border border-[var(--stroke-subtle)] p-2"
          >
            <div className="w-5 pt-0.5 text-[11px] text-[var(--text-tertiary)]">
              {i + 1}
            </div>
            {m.thumbnail_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.thumbnail_url}
                alt=""
                className="h-12 w-12 flex-shrink-0 rounded object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] text-[var(--text-primary)]">
                {m.name || "(매체명 없음)"}
              </div>
              <div className="truncate text-[11px] text-[var(--text-secondary)]">
                {m.media_source}
              </div>
            </div>
            <div className="text-right text-[12px] text-[var(--text-primary)]">
              {m.price || "가격 문의"}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
