"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import { adSessionsApi } from "@/hooks/adSessions";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

export type V2ResponseType =
  | "chat"
  | "list"
  | "need_more"
  | "confirmation_required"
  | "media_detail";

export type SlotKey = "ind" | "prd" | "obj" | "tgt" | "loc" | "cat" | "budget";

export const CATEGORY_LABELS: Record<SlotKey, string> = {
  ind: "업종",
  prd: "제품",
  obj: "목적",
  tgt: "타깃",
  loc: "지역",
  cat: "카테고리",
  budget: "예산",
};

export interface EnrichedCode {
  code: string;
  description: string;
}

export interface ChangeEntry {
  category: string;
  type: string;
  old_values: string[];
  new_values: string[];
}

export interface V2MediaItem {
  id: string;
  media_id?: string | null;
  name: string;
  media_source: string;
  price?: string;
  thumbnail_url?: string;
  detail_images: string[];
  latitude?: number | null;
  longitude?: number | null;
  category_large?: string | null;
  category_small?: string | null;
}

export interface ConfirmationInfo {
  message?: string;
  changes?: ChangeEntry[];
  enriched_extracted?: Record<string, EnrichedCode[]>;
  previous_context_detail?: Record<string, EnrichedCode[]>;
}

export interface V2MediaRef {
  id?: string;
  media_id?: string | null;
  name?: string;
  thumbnail_url?: string | null;
}

export interface V2Message {
  id: string;
  type: "user" | "assistant";
  content?: string;
  response_type?: V2ResponseType;
  message?: string;
  items?: V2MediaItem[];
  match_count?: number;
  enriched_extracted?: Record<string, EnrichedCode[]>;
  previous_context_detail?: Record<string, EnrichedCode[]>;
  matched_categories?: number;
  isLoading?: boolean;
  confirmation?: ConfirmationInfo;
  media?: V2MediaRef;
}

const randomId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/** 여러 enriched 소스(현재 컨텍스트 + 이번 추출)를 코드 기준 머지. */
export function mergeEnriched(
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
    out[cat] = Array.from(m.entries()).map(([code, description]) => ({
      code,
      description,
    }));
  }
  return out;
}

const MIN_INPUT_LEN = 3;

export function useV2Chat() {
  const [messages, setMessages] = useState<V2Message[]>([]);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionId) return sessionId;
    const s = await adSessionsApi.create(null);
    setSessionId(s.id);
    return s.id;
  }, [sessionId]);

  const handleEventBlock = useCallback(
    (block: string, assistantId: string) => {
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
        const msgType = (data.type as V2ResponseType) || "chat";

        if (msgType === "confirmation_required") {
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
                        (data.enriched_extracted as Record<
                          string,
                          EnrichedCode[]
                        >) || undefined,
                      previous_context_detail:
                        (data.previous_context_detail as Record<
                          string,
                          EnrichedCode[]
                        >) || undefined,
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
                  items: (data.items as V2MediaItem[]) || [],
                  match_count: (data.match_count as number) || 0,
                  enriched_extracted:
                    (data.enriched_extracted as Record<
                      string,
                      EnrichedCode[]
                    >) || undefined,
                  previous_context_detail:
                    (data.previous_context_detail as Record<
                      string,
                      EnrichedCode[]
                    >) || undefined,
                  matched_categories:
                    (data.matched_categories as number) || undefined,
                  media: (data.media as V2MediaRef) || undefined,
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
            m.id === assistantId
              ? { ...m, isLoading: false, message: `오류: ${msg}` }
              : m,
          ),
        );
      }
    },
    [],
  );

  const consumeStream = useCallback(
    async (res: Response, assistantId: string) => {
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
    },
    [handleEventBlock],
  );

  const submit = useCallback(
    async (text: string, opts?: { allowShort?: boolean }) => {
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
      setRunning(true);

      try {
        const sid = await ensureSession();
        const res = await fetch(`${API_URL}/recommend/v2/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: q, session_id: sid }),
        });
        await consumeStream(res, assistantId);
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
    },
    [running, ensureSession, consumeStream],
  );

  const removeSlot = useCallback(
    async (category: string, code: string, label: string) => {
      if (running || !sessionId) return;
      const catLabel =
        CATEGORY_LABELS[category as SlotKey] || category;
      const noteText = `"${catLabel}: ${label}" 조건 제거`;
      const userId = randomId();
      const assistantId = randomId();
      setMessages((prev) => [
        ...prev,
        { id: userId, type: "user", content: noteText },
        { id: assistantId, type: "assistant", isLoading: true },
      ]);
      setRunning(true);

      try {
        const res = await fetch(`${API_URL}/recommend/v2/slot/remove`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId, category, code }),
        });
        await consumeStream(res, assistantId);
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
    },
    [running, sessionId, consumeStream],
  );

  /** 가장 최근 assistant 메시지 기준 누적 슬롯(현재 조건). */
  const currentSlots: Record<string, EnrichedCode[]> = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.type !== "assistant") continue;
      if (m.previous_context_detail || m.enriched_extracted) {
        return mergeEnriched(m.previous_context_detail, m.enriched_extracted);
      }
    }
    return {};
  })();

  /** 마지막 메시지가 확인 대기(confirmation)인지 — 빠른답 버튼 활성화용. */
  const lastConfirmingId: string | null = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.type !== "assistant") continue;
      if (m.confirmation) return m.id;
      if (m.message || m.items?.length) return null;
    }
    return null;
  })();

  return {
    messages,
    running,
    sessionId,
    submit,
    removeSlot,
    currentSlots,
    lastConfirmingId,
  };
}
