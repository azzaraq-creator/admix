"""Node ⑥-C2 — Method C2: 상권 인구분포 × LLM 추론 weights.

거리 ≤ SANGWON_MAX_DISTANCE_M 매체는 sangwon_population 실측, 그 외는 매체 자체 demo_*_pct fallback.
"""
from __future__ import annotations

from typing import Optional

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from src.services.graph.db import get_db_conn
from src.services.graph.llm import get_chat
from src.services.graph.settings import (
    DEMO_AGE_KEYS,
    DEMO_GENDER_KEYS,
    SANGWON_MAX_DISTANCE_M,
    SANGWON_QUARTER,
    TOP_N,
)
from src.services.graph.state import RecommendState


class DemographicWeights(BaseModel):
    """매체 ad_media 컬럼과 동일 키. 연령 6개 합≈1.0, 성별 2개 합≈1.0."""

    demo_age_under_10s_pct: float = Field(0.0, ge=0.0, le=1.0)
    demo_age_20s_pct: float = Field(0.0, ge=0.0, le=1.0)
    demo_age_30s_pct: float = Field(0.0, ge=0.0, le=1.0)
    demo_age_40s_pct: float = Field(0.0, ge=0.0, le=1.0)
    demo_age_50s_pct: float = Field(0.0, ge=0.0, le=1.0)
    demo_age_60s_plus_pct: float = Field(0.0, ge=0.0, le=1.0)
    demo_male_pct: float = Field(0.0, ge=0.0, le=1.0)
    demo_female_pct: float = Field(0.0, ge=0.0, le=1.0)


class DemographicInference(BaseModel):
    weights: DemographicWeights
    reasoning: str = Field("", description="추론 근거 (한국어 한 줄)")


DEMO_SYS_PROMPT = """당신은 한국 OOH 광고의 타겟 인구통계 추론기입니다.
사용자가 광고하려는 product/target/goal 정보로부터 광고 노출 효과가 가장 큰 타겟 인구통계 분포를 추론하세요.

[8축 출력 — 매체 ad_media 컬럼과 동일 키]
- 연령 6개 (합 ≈ 1.0): demo_age_under_10s_pct, demo_age_20s_pct, demo_age_30s_pct,
                       demo_age_40s_pct, demo_age_50s_pct, demo_age_60s_plus_pct
- 성별 2개 (합 ≈ 1.0): demo_male_pct, demo_female_pct

[추론 가이드]
- 사용자가 명시한 target (예: "20대 여성") → 우선 적용.
- 명시 없으면 product/goal 에서 일반적 주 소비자 분포로 추론.
- 예: 화장품 → 여성 0.8, 20-30대 비중 ↑
      장난감 → 30-40대 (구매자) 약간, 어린이 직접 비중↑
      게임/IT → 10-30대 + 남성 약간 우위
      효도·은퇴여행 → 50-60대 + 가족 키워드
      음식·식품 → 거의 균등 (전 연령·성별)
- 정보 매우 부족 → 모든 가중치 0.125 (균등) + reasoning 에 '정보 부족' 기록.

reasoning 은 한국어 한 줄로 추론 근거.
"""


_demo_llm = None


def _get_demo_llm():
    global _demo_llm
    if _demo_llm is None:
        _demo_llm = get_chat(temperature=0.0).with_structured_output(DemographicInference)
    return _demo_llm


def _build_demo_prompt(slots: dict) -> str:
    target = slots.get("target") or {}
    is_dict = isinstance(target, dict)
    return (
        f"[광고 정보]\n"
        f"- product: {slots.get('product')}\n"
        f"- target.raw: {target.get('raw') if is_dict else None}\n"
        f"- target.ageGroups: {target.get('ageGroups') if is_dict else None}\n"
        f"- target.gender: {target.get('gender') if is_dict else None}\n"
        f"- target.keywords: {target.get('keywords') if is_dict else None}\n"
        f"- goal: {slots.get('goal')}\n"
        f"- goal_label: {slots.get('goal_label')}\n\n"
        "위 정보를 종합해 8축 demographic vector + 한국어 reasoning 출력."
    )


def infer_demographic_weights(slots: dict) -> Optional[DemographicInference]:
    try:
        return _get_demo_llm().invoke([
            SystemMessage(content=DEMO_SYS_PROMPT),
            HumanMessage(content=_build_demo_prompt(slots)),
        ])
    except Exception:
        return None


def _fetch_sangwon_demographics(media_ids: list[int]) -> dict[int, dict]:
    """매체 id → {연령 6, 성별 2 비율 + 상권 이름/거리}. 거리 ≤ SANGWON_MAX_DISTANCE_M 만."""
    if not media_ids:
        return {}
    sql = """
        SELECT m.media_id,
               sp.total_foot_traffic,
               sp.age_10_foot, sp.age_20_foot, sp.age_30_foot,
               sp.age_40_foot, sp.age_50_foot, sp.age_60_foot,
               sp.male_foot, sp.female_foot,
               sp.sangwon_name,
               m.sangwon_distance_m
        FROM ad_media m
        JOIN sangwon_population sp
          ON sp.sangwon_code = m.sangwon_code
         AND sp.quarter_code = %s
        WHERE m.media_id = ANY(%s)
          AND m.sangwon_distance_m <= %s
    """
    out: dict[int, dict] = {}
    with get_db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, [SANGWON_QUARTER, media_ids, SANGWON_MAX_DISTANCE_M])
            for r in cur.fetchall():
                mid, total, a10, a20, a30, a40, a50, a60, male, female, sw_name, dist = r
                if not total:
                    continue
                t = float(total)
                out[mid] = {
                    "sangwon_name": sw_name,
                    "sangwon_distance_m": float(dist),
                    "age_under_10s_pct": 0.0,  # 서울 데이터엔 under_10s 미분리.
                    "age_20s_pct": float(a20) / t,
                    "age_30s_pct": float(a30) / t,
                    "age_40s_pct": float(a40) / t,
                    "age_50s_pct": float(a50) / t,
                    "age_60s_plus_pct": float(a60) / t,
                    "age_10s_pct_supplementary": float(a10) / t,
                    "male_pct": float(male) / t,
                    "female_pct": float(female) / t,
                }
    return out


def rerank_by_sangwon(state: RecommendState) -> dict:
    """그래프 노드 시그니처. matched_media 위에 sangwon_score 부여 후 Top-N 정렬."""
    matched = state.get("matched_media") or []
    slots = state.get("slots") or {}
    if not matched:
        return {"matched_media": [], "matched_count": 0, "status": "ranked"}

    inferred = infer_demographic_weights(slots)
    if inferred is None:
        return {
            "matched_media": matched[:TOP_N],
            "matched_count": min(len(matched), TOP_N),
            "status": "ranked",
            "assumptions": (state.get("assumptions") or []) + ["rerank_sangwon: 데모 weight 추론 실패"],
        }

    w = inferred.weights.model_dump()
    ids = [m["media_id"] for m in matched]
    sw_data = _fetch_sangwon_demographics(ids)

    for m in matched:
        sw = sw_data.get(m["media_id"])
        if sw is not None:
            age_score = (
                sw["age_20s_pct"] * w["demo_age_20s_pct"]
                + sw["age_30s_pct"] * w["demo_age_30s_pct"]
                + sw["age_40s_pct"] * w["demo_age_40s_pct"]
                + sw["age_50s_pct"] * w["demo_age_50s_pct"]
                + sw["age_60s_plus_pct"] * w["demo_age_60s_plus_pct"]
            )
            gender_score = sw["male_pct"] * w["demo_male_pct"] + sw["female_pct"] * w["demo_female_pct"]
            m["sangwon_score_source"] = "sangwon"
            m["sangwon_matched_name"] = sw["sangwon_name"]
            m["sangwon_matched_distance_m"] = sw["sangwon_distance_m"]
        else:
            # fallback: 매체 자체 demo_*_pct (DB 는 0~100 스케일 → /100).
            age_score = sum(float(m.get(k) or 0.0) / 100.0 * w[k] for k in DEMO_AGE_KEYS)
            gender_score = sum(float(m.get(k) or 0.0) / 100.0 * w[k] for k in DEMO_GENDER_KEYS)
            m["sangwon_score_source"] = "media_fallback"
            m["sangwon_matched_name"] = None
            m["sangwon_matched_distance_m"] = None
        m["sw_age_score"] = round(age_score, 4)
        m["sw_gender_score"] = round(gender_score, 4)
        m["sangwon_score"] = round((age_score + gender_score) / 2, 4)

    ranked = sorted(matched, key=lambda x: -x.get("sangwon_score", 0))
    top = ranked[:TOP_N]

    return {
        "matched_media": top,
        "matched_count": len(top),
        "status": "ranked",
        "assumptions": (state.get("assumptions") or []) + [f"rerank_sangwon: {inferred.reasoning}"],
    }
