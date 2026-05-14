"""Node ⑦ — LLM 자연어 설명 + pivot 제안.

상권별 후보 풀을 집계해 LLM 에 주고, summary / top_picks / pivots 생성.
"""
from __future__ import annotations

from typing import Optional

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from src.services.graph.db import get_db_conn
from src.services.graph.llm import get_chat
from src.services.graph.settings import SANGWON_MAX_DISTANCE_M, SANGWON_QUARTER
from src.services.graph.state import RecommendState


class PivotOption(BaseModel):
    label: str = Field(..., description="사용자가 클릭할 액션 라벨 (한국어 단문)")
    hint: str = Field(..., description="이 pivot 의 근거·기대 결과 한 줄 설명")
    suggested_slot_change: dict = Field(default_factory=dict)


class TopPick(BaseModel):
    media_id: int
    why: str = Field(..., description="이 매체가 추천된 이유 (한국어 한 줄)")


class RecommendExplanation(BaseModel):
    summary: str = Field(..., description="추천 요약 1~2 문장")
    top_picks: list[TopPick] = Field(default_factory=list)
    pivots: list[PivotOption] = Field(default_factory=list)


EXPLAIN_SYS = """당신은 한국 OOH 광고 추천 시스템의 큐레이터입니다.
추천 결과(Top-N 매체)와 후보 풀(다른 상권 옵션) 정보를 보고 광고주에게 자연스럽게 설명하세요.

[출력 규칙]
1) summary (1~2 문장): 추천 매체들이 어떤 상권·인구특성 기반인지, 왜 이 광고에 적합한지.
2) top_picks: 추천 상위 3개 매체별 한 줄 reasoning. 매체 위치·상권 특징을 구체로 언급.
3) pivots (2~3개): 광고주가 다른 방향을 탐색할 수 있는 대안.
   - 후보 풀의 "다른 상권 정보"를 분석해 흥미로운 차별점이 있는 상권을 발견.
   - 예: 추천 결과보다 여성 비중 ↑ / 광역 노출 ↑ / 다른 연령대 spike 인 상권.
   - 각 pivot 은 label(짧은 클릭 라벨) + hint(왜 흥미로운지) + suggested_slot_change(슬롯 변경 예시 dict).
   - suggested_slot_change 예: {"region": ["고속터미널"]} 또는 {"target": {"raw": "40대 여성 프리미엄"}}

JSON 외 텍스트 금지. 친절하고 간결한 한국어.
"""


_explain_llm = None


def _get_explain_llm():
    global _explain_llm
    if _explain_llm is None:
        _explain_llm = get_chat(temperature=0.3).with_structured_output(RecommendExplanation)
    return _explain_llm


def _summarize_candidate_sangwons(candidate_ids: list[int]) -> list[dict]:
    if not candidate_ids:
        return []
    sql = """
        SELECT sa.sangwon_name,
               COUNT(*) AS media_count,
               ROUND(AVG(m.ad_price)::numeric, 0)::bigint AS avg_price,
               sp.total_foot_traffic,
               ROUND(sp.age_20_foot::numeric/sp.total_foot_traffic*100, 1) AS pct_20s,
               ROUND(sp.age_30_foot::numeric/sp.total_foot_traffic*100, 1) AS pct_30s,
               ROUND(sp.age_40_foot::numeric/sp.total_foot_traffic*100, 1) AS pct_40s,
               ROUND(sp.age_50_foot::numeric/sp.total_foot_traffic*100, 1) AS pct_50s,
               ROUND(sp.female_foot::numeric/sp.total_foot_traffic*100, 1) AS pct_female
        FROM ad_media m
        JOIN sangwon_area sa ON sa.sangwon_code = m.sangwon_code
        JOIN sangwon_population sp
          ON sp.sangwon_code = m.sangwon_code AND sp.quarter_code = %s
        WHERE m.media_id = ANY(%s) AND m.sangwon_distance_m <= %s
        GROUP BY sa.sangwon_name, sp.total_foot_traffic, sp.age_20_foot, sp.age_30_foot,
                 sp.age_40_foot, sp.age_50_foot, sp.female_foot
        ORDER BY media_count DESC
    """
    rows: list[dict] = []
    with get_db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, [SANGWON_QUARTER, candidate_ids, SANGWON_MAX_DISTANCE_M])
            for r in cur.fetchall():
                # ad_price 가 모두 NULL 인 상권은 AVG → NULL. 유동인구 NULL 도 동일.
                if r[3] is None:
                    continue
                rows.append({
                    "sangwon": r[0],
                    "media_count": r[1],
                    "avg_price": int(r[2]) if r[2] is not None else 0,
                    "total_foot": int(r[3]),
                    "pct_20s": float(r[4] or 0),
                    "pct_30s": float(r[5] or 0),
                    "pct_40s": float(r[6] or 0),
                    "pct_50s": float(r[7] or 0),
                    "pct_female": float(r[8] or 0),
                })
    return rows


def _explain(
    top_media: list[dict],
    all_candidate_ids: list[int],
    slots: dict,
    inference_reasoning: Optional[str],
) -> Optional[RecommendExplanation]:
    if not top_media:
        return None

    sw_summary = _summarize_candidate_sangwons(all_candidate_ids)

    top3_lines = []
    for m in top_media[:3]:
        if m.get("ad_price") is None:
            continue
        sw_label = (
            f" | 상권={m.get('sangwon_matched_name')} ({(m.get('sangwon_matched_distance_m') or 0):.0f}m)"
            if m.get("sangwon_matched_name") else ""
        )
        top3_lines.append(
            f"  - #{m['media_id']} {m.get('product_display_name') or m.get('media_name')} "
            f"({m.get('district')}, {m.get('parent_category')}) {m.get('ad_price'):,}원" + sw_label
        )
    top3_str = "\n".join(top3_lines)

    sw_lines = []
    for s in sw_summary[:12]:
        sw_lines.append(
            f"  - {s['sangwon']}: 매체 {s['media_count']}건, 유동인구 {s['total_foot']:,}, "
            f"20대 {s['pct_20s']:.1f}%, 30대 {s['pct_30s']:.1f}%, 40대 {s['pct_40s']:.1f}%, "
            f"50대 {s['pct_50s']:.1f}%, 여성 {s['pct_female']:.1f}%, 평균가 {s['avg_price']:,}원"
        )
    sw_block = "\n".join(sw_lines)

    target = slots.get("target") or {}
    target_raw = target.get("raw") if isinstance(target, dict) else None
    budget = slots.get("budget")
    budget_line = f"- budget: {budget:,}원" if budget else "- budget: (미지정)"
    user_prompt = f"""[광고주 슬롯]
- region: {slots.get('region')}
{budget_line}
- product: {slots.get('product')}
- target.raw: {target_raw}
- goal: {slots.get('goal')} (label={slots.get('goal_label')})
- media_type: {slots.get('media_type')}

[추론된 타겟 인구통계]
{inference_reasoning or '(없음)'}

[추천 Top-3 매체]
{top3_str}

[후보 풀 상권 분포 — pivot 후보]
{sw_block}

위를 분석해 RecommendExplanation 출력. pivots 는 위 후보 상권 중 흥미로운 차별점을 가진 곳을 골라 제안.
"""
    try:
        return _get_explain_llm().invoke([
            SystemMessage(content=EXPLAIN_SYS),
            HumanMessage(content=user_prompt),
        ])
    except Exception:
        return None


def _extract_inference_reasoning(assumptions: list[str]) -> Optional[str]:
    """rerank_by_sangwon 이 assumptions 에 남긴 'rerank_sangwon: <reasoning>' 추출."""
    for a in reversed(assumptions or []):
        if isinstance(a, str) and a.startswith("rerank_sangwon: "):
            return a[len("rerank_sangwon: "):]
    return None


def explain_recommendations(state: RecommendState) -> dict:
    """Graph 노드: state.matched_media (rerank 후 Top-N) + 후보 풀로 자연어 설명 생성."""
    matched = state.get("matched_media") or []
    if not matched:
        return {"status": "explained"}

    slots = state.get("slots") or {}
    # db_filter 가 보존한 hard-filter 전체 후보. 없으면 Top-N 으로 fallback (pivot 다양성↓).
    candidate_ids = state.get("candidate_pool_ids") or [m["media_id"] for m in matched]
    reasoning = _extract_inference_reasoning(state.get("assumptions") or [])

    explanation = _explain(matched, candidate_ids, slots, reasoning)
    if explanation is None:
        return {"status": "explained"}

    # top_picks (Top-3) reason 을 matched_media 의 reason 필드로 첨부 → UI 카드에 표시.
    reason_map = {tp.media_id: tp.why for tp in explanation.top_picks}
    for m in matched:
        if m["media_id"] in reason_map:
            m["reason"] = reason_map[m["media_id"]]

    return {
        "summary": explanation.summary,
        "top_picks": [tp.model_dump() for tp in explanation.top_picks],
        "pivots": [p.model_dump() for p in explanation.pivots],
        "matched_media": matched,
        "status": "explained",
    }
