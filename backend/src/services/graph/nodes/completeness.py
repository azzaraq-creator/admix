"""Node ② — 슬롯 완전성 점수 + clarification 분기."""
from __future__ import annotations

from langchain_core.messages import AIMessage

from src.services.graph.settings import (
    CLARIFY_PRIORITY,
    CLARIFY_PROMPTS,
    COMPLETENESS_THRESHOLD,
    SLOT_WEIGHTS,
)
from src.services.graph.state import RecommendState


def _slot_filled(slots: dict, key: str) -> bool:
    v = slots.get(key)
    if v is None:
        return False
    if isinstance(v, list):
        return len(v) > 0
    if isinstance(v, dict):
        # target struct
        return bool(
            v.get("raw")
            or v.get("ageGroups")
            or v.get("keywords")
            or (v.get("gender") and v.get("gender") != "unknown")
        )
    if isinstance(v, int):
        return v > 0
    return bool(v)


def score_completeness(state: RecommendState) -> dict:
    slots = state.get("slots") or {}
    total = 0
    missing: list[str] = []
    for key, w in SLOT_WEIGHTS.items():
        if _slot_filled(slots, key):
            total += w
        else:
            missing.append(key)
    return {"completeness_score": total, "completeness_missing": missing}


def clarification_one_slot(state: RecommendState) -> dict:
    """점수 부족 시 우선순위 가장 높은 1개 슬롯만 질문."""
    missing = state.get("completeness_missing") or []
    target_slot = next((k for k in CLARIFY_PRIORITY if k in missing), "region")
    prompt = CLARIFY_PROMPTS[target_slot]
    return {
        "messages": [AIMessage(content=prompt)],
        "status": "awaiting_slots",
        "assumptions": (state.get("assumptions") or []) + [f"clarification: {target_slot} 누락 → 질문"],
    }


def passes_completeness(state: RecommendState) -> bool:
    return (state.get("completeness_score") or 0) >= COMPLETENESS_THRESHOLD
