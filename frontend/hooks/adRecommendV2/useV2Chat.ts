"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { adSessionsApi } from "@/hooks/adSessions";
import { API_BASE_URL } from "@/lib/api";
import { SESSION_KEY } from "@/lib/session";

export type V2ResponseType =
  | "chat"
  | "list"
  | "need_more"
  | "confirmation_required"
  | "media_detail"
  | "proposal"
  | "limit_reached";

export type LimitAction = "login" | "business";

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

export interface V2ProposalRef {
  id: string;
  name: string;
  media_count: number;
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
  loadingLabel?: string;
  confirmation?: ConfirmationInfo;
  media?: V2MediaRef;
  proposal?: V2ProposalRef;
  cta?: string;
  limitAction?: LimitAction;
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

const POLL_INTERVAL_MS = 1200;
const POLL_MAX_ATTEMPTS = 50;

/** 가짜 스트리밍 로딩 문구(백엔드 async 처리 동안 순차 노출).
 * 작업 종류(추천/제안서/상세)를 특정하지 않는 중립 문구. */
const LOADING_LABELS = [
  "요청을 확인하고 있어요…",
  "내용을 처리하고 있어요…",
  "답변을 준비하고 있어요…",
];
/** 문구 한 단계 진행에 필요한 폴링 tick 수(느리게 전환). */
const LABEL_TICKS_PER_STEP = 2;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type JobStatus = "pending" | "processing" | "done" | "failed";

interface JobResponse {
  job_id: string;
  status: JobStatus;
  result: { events: Array<Record<string, unknown>> } | null;
  error: string | null;
}

type SavedMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  payload: Record<string, unknown> | null;
};

/** DB 저장 메시지(payload) → V2Message 복원. 세션 지속/복원용. */
function restoreMessage(saved: SavedMsg): V2Message {
  if (saved.role === "user") {
    return { id: saved.id, type: "user", content: saved.content };
  }
  const p = (saved.payload ?? {}) as Record<string, unknown>;
  const ptype = p.type as string | undefined;
  if (ptype === "confirmation_required") {
    return {
      id: saved.id,
      type: "assistant",
      confirmation: {
        message: (p.message as string) || saved.content,
        changes: p.changes as ChangeEntry[] | undefined,
        enriched_extracted: p.enriched_extracted as
          | Record<string, EnrichedCode[]>
          | undefined,
        previous_context_detail: p.previous_context_detail as
          | Record<string, EnrichedCode[]>
          | undefined,
      },
    };
  }
  if (
    ptype === "chat" ||
    ptype === "list" ||
    ptype === "need_more" ||
    ptype === "media_detail" ||
    ptype === "proposal"
  ) {
    return {
      id: saved.id,
      type: "assistant",
      response_type: ptype as V2ResponseType,
      message: (p.message as string) || saved.content,
      items: (p.items as V2MediaItem[]) ?? [],
      match_count: p.match_count as number | undefined,
      enriched_extracted: p.enriched_extracted as
        | Record<string, EnrichedCode[]>
        | undefined,
      previous_context_detail: p.previous_context_detail as
        | Record<string, EnrichedCode[]>
        | undefined,
      matched_categories: p.matched_categories as number | undefined,
      media: p.media as V2MediaRef | undefined,
      proposal: p.proposal as V2ProposalRef | undefined,
    };
  }
  return { id: saved.id, type: "assistant", message: saved.content };
}

export function useV2Chat() {
  const [messages, setMessages] = useState<V2Message[]>([]);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  // 언마운트 시 진행 중인 폴링 루프를 중단(setState 누수 방지).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 마운트 시 저장된 세션 복원 (비회원도 새로고침/재방문에 챗봇 유지)
  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(SESSION_KEY) : null;
    if (!stored) return;
    let cancelled = false;
    (async () => {
      setSessionId(stored);
      setRestoring(true);
      try {
        const detail = await adSessionsApi.get(stored);
        if (cancelled) return;
        setMessages((detail.messages ?? []).map(restoreMessage));
      } catch {
        // 세션 만료/삭제 → 스토리지 정리 후 새 세션으로
        if (typeof window !== "undefined") localStorage.removeItem(SESSION_KEY);
        if (!cancelled) setSessionId(null);
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionId) return sessionId;
    const s = await adSessionsApi.create(null);
    setSessionId(s.id);
    if (typeof window !== "undefined") localStorage.setItem(SESSION_KEY, s.id);
    return s.id;
  }, [sessionId]);

  /**
   * 새 세션 시작: 화면 대화를 비우고 새 세션을 즉시 생성한다.
   * 서버의 기존 세션 레코드는 그대로 남으므로, 사용자의 전체 세션에 걸친
   * 누적 챗 횟수 집계에는 영향이 없다(새 세션이라고 카운트가 초기화되지 않음).
   */
  const newSession = useCallback(async () => {
    if (running) return;
    setMessages([]);
    setSessionId(null);
    if (typeof window !== "undefined") localStorage.removeItem(SESSION_KEY);
    try {
      const s = await adSessionsApi.create(null);
      setSessionId(s.id);
      if (typeof window !== "undefined") localStorage.setItem(SESSION_KEY, s.id);
    } catch (err) {
      // 생성 실패 시 다음 submit 의 ensureSession 이 다시 시도(지연 생성 폴백)
      const msg = err instanceof Error ? err.message : "새 세션 생성 실패";
      toast.error(msg);
    }
  }, [running]);

  /**
   * 하나의 message 이벤트 data를 assistant 메시지에 반영.
   * SSE 경로(removeSlot)와 async 폴링 경로(submit)가 공유한다.
   */
  const applyEventData = useCallback(
    (data: Record<string, unknown>, assistantId: string) => {
      const msgType = (data.type as V2ResponseType) || "chat";

      if (msgType === "confirmation_required") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  isLoading: false,
                  loadingLabel: undefined,
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
                loadingLabel: undefined,
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
                proposal: (data.proposal as V2ProposalRef) || undefined,
                cta: (data.cta as string) || undefined,
                limitAction: (data.action as LimitAction) || undefined,
              }
            : m,
        ),
      );
    },
    [],
  );

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
        applyEventData(data, assistantId);
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
    [applyEventData],
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

        // 백엔드 async(SQS+Lambda): job enqueue 후 상태 폴링.
        const enqueueRes = await fetch(`${API_BASE_URL}/recommend/v2/jobs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: q, session_id: sid }),
        });
        if (!enqueueRes.ok) {
          throw new Error(`API 요청 실패: ${enqueueRes.status}`);
        }
        const enqueued = (await enqueueRes.json()) as JobResponse;
        const jobId = enqueued.job_id;

        let settled = false;
        for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
          // 가짜 스트리밍: 여러 tick마다 다음 문구로 진행, 마지막 문구에서 고정.
          const label =
            LOADING_LABELS[
              Math.min(
                Math.floor(attempt / LABEL_TICKS_PER_STEP),
                LOADING_LABELS.length - 1,
              )
            ];
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId && m.isLoading
                ? { ...m, loadingLabel: label }
                : m,
            ),
          );

          await sleep(POLL_INTERVAL_MS);
          if (!mountedRef.current) return;

          const pollRes = await fetch(
            `${API_BASE_URL}/recommend/v2/jobs/${jobId}`,
          );
          if (!pollRes.ok) {
            throw new Error(`API 요청 실패: ${pollRes.status}`);
          }
          const job = (await pollRes.json()) as JobResponse;

          if (job.status === "done") {
            const events = job.result?.events ?? [];
            for (const ev of events) {
              applyEventData(ev, assistantId);
            }
            // 이벤트가 없으면 로딩만 해제.
            if (events.length === 0) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, isLoading: false, loadingLabel: undefined }
                    : m,
                ),
              );
            }
            settled = true;
            break;
          }

          if (job.status === "failed") {
            const msg = job.error || "처리 실패";
            toast.error(msg);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      isLoading: false,
                      loadingLabel: undefined,
                      message: `오류: ${msg}`,
                    }
                  : m,
              ),
            );
            settled = true;
            break;
          }
        }

        if (!settled) {
          const msg = "응답 시간 초과";
          toast.error(msg);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    isLoading: false,
                    loadingLabel: undefined,
                    message: `오류: ${msg}`,
                  }
                : m,
            ),
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "요청 실패";
        toast.error(msg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  isLoading: false,
                  loadingLabel: undefined,
                  message: `오류: ${msg}`,
                }
              : m,
          ),
        );
      } finally {
        setRunning(false);
      }
    },
    [running, ensureSession, applyEventData],
  );

  // 슬롯 제거는 EC2에서 동기 SSE 유지(LLM 없음) — job 폴링 불필요.
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
        const res = await fetch(`${API_BASE_URL}/recommend/v2/slot/remove`, {
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

  /** 마지막 assistant 응답이 대화 한도 도달인지 — 입력창 비활성/CTA용. */
  const lastMessage = messages[messages.length - 1];
  const limitReached =
    lastMessage?.type === "assistant" &&
    lastMessage.response_type === "limit_reached";
  const limitAction = limitReached ? lastMessage.limitAction : undefined;
  const limitCta = limitReached ? lastMessage.cta : undefined;

  return {
    messages,
    running,
    restoring,
    sessionId,
    submit,
    removeSlot,
    newSession,
    currentSlots,
    lastConfirmingId,
    limitReached,
    limitAction,
    limitCta,
  };
}
