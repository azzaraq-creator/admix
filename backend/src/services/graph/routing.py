"""조건부 엣지 라우팅 함수들."""
from __future__ import annotations

from langchain_core.messages import AIMessage

from src.services.graph.nodes.present_initial import has_refinement_slots
from src.services.graph.settings import COMPLETENESS_THRESHOLD
from src.services.graph.state import RecommendState


def route_after_completeness(state: RecommendState) -> str:
    score = state.get("completeness_score") or 0
    return "clarification" if score < COMPLETENESS_THRESHOLD else "compatibility"


def route_after_compatibility(state: RecommendState) -> str:
    return "compatibility_llm" if (state.get("compat_violations") or []) else "db_filter"


def route_after_db_filter(state: RecommendState) -> str:
    """Stage 1 (initial) vs Stage 2 (refine) 분기.

    - 첫 추천(이전 AI 메시지 0개) → initial: present_initial_list 가격순 Top-N + 인터뷰.
    - 답변 받은 후(이전 AI 메시지 ≥1) → refine: rerank → explain. 슬롯 부족해도 더 질문 안 함.
    """
    msgs = state.get("messages") or []
    has_prior_ai = any(isinstance(m, AIMessage) for m in msgs)
    return "refine" if has_prior_ai else "initial"
