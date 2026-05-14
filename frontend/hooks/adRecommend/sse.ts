// SSE 파서 + fetch 호출. EventSource 는 POST 미지원이라 ReadableStream 으로 직접 처리.

export interface AdRecommendSlots {
  region?: string[];
  budget?: number;
  product?: string[];
  goal?: string[];
  goal_label?: string;
  media_type?: string[];
  target?: {
    raw?: string;
    ageGroups?: string[];
    gender?: string;
    keywords?: string[];
  };
}

export interface AdRecommendMedia {
  media_id: number;
  media_name?: string;
  product_display_name?: string;
  city?: string;
  district?: string;
  latitude?: number | null;
  longitude?: number | null;
  ad_price?: number | null;
  parent_category?: string;
  category?: string;
  ooh_type?: string;
  detail_url?: string;
  thumbnail_url?: string;
  sangwon_matched_name?: string | null;
  sangwon_score?: number;
  vector_sim?: number;
  reason?: string;  // Stage 2 explain 노드가 Top-3 매체에 첨부.
}

export interface AdRecommendTopPick {
  media_id: number;
  why: string;
}

export interface AdRecommendPivot {
  label: string;
  hint: string;
  suggested_slot_change: Record<string, unknown>;
}

export interface AdRecommendNodeUpdate {
  slots?: AdRecommendSlots;
  matched_media?: AdRecommendMedia[];
  matched_count?: number;
  matched_media_size?: number;
  candidate_pool_ids_size?: number;
  summary?: string;
  top_picks?: AdRecommendTopPick[];
  pivots?: AdRecommendPivot[];
  assistant_message?: string;
  status?: string;
  completeness_score?: number;
  completeness_missing?: string[];
  compat_violations?: Array<Record<string, unknown>>;
  assumptions?: string[];
}

export type AdRecommendEvent =
  | { event: "thread"; data: { thread_id: string } }
  | { event: "node"; data: { name: string; update: AdRecommendNodeUpdate } }
  | { event: "done"; data: Record<string, never> }
  | { event: "error"; data: { message: string } };

export interface StreamGraphArgs {
  message: string;
  threadId?: string;
  signal?: AbortSignal;
  onEvent: (ev: AdRecommendEvent) => void;
}

// 노드 이름 → 사용자에게 보여줄 한국어 라벨.
export const NODE_LABELS: Record<string, string> = {
  extract_slots: "슬롯 추출",
  score_completeness: "완전성 점수 계산",
  clarification_one_slot: "추가 질문 작성",
  check_compatibility_db: "조건 호환성 검사",
  compatibility_llm_message: "조건 충돌 안내 작성",
  db_filter_final: "매체 풀 검색",
  present_initial_list: "첫 추천 정리",
  rerank: "타겟 기반 추천 정렬",
  explain_recommendations: "추천 이유 생성",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function streamGraph(args: StreamGraphArgs): Promise<void> {
  const res = await fetch(`${API_URL}/chat/graph/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: args.message,
      thread_id: args.threadId ?? null,
    }),
    signal: args.signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`SSE 연결 실패: ${res.status} ${res.statusText}`);
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
      const ev = parseBlock(block);
      if (ev) args.onEvent(ev);
      blockEnd = buffer.indexOf("\n\n");
    }
  }
}

function parseBlock(block: string): AdRecommendEvent | null {
  let eventName = "message";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) eventName = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  try {
    const data = JSON.parse(dataLines.join("\n"));
    return { event: eventName, data } as AdRecommendEvent;
  } catch {
    return null;
  }
}
