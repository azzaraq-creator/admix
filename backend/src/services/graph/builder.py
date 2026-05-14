"""LangGraph 빌더 — 노트북 graph_v3 + Method C2 (sangwon) + explain 까지 통합."""
from __future__ import annotations

from typing import Literal

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from src.services.graph.nodes import (
    check_compatibility_db,
    clarification_one_slot,
    compatibility_llm_message,
    db_filter_final,
    explain_recommendations,
    extract_slots,
    present_initial_list,
    rerank_by_sangwon,
    rerank_by_vector,
    score_completeness,
)
from src.services.graph.routing import (
    route_after_compatibility,
    route_after_completeness,
    route_after_db_filter,
)
from src.services.graph.state import RecommendState

RerankMethod = Literal["vector", "sangwon"]


def build_graph(
    rerank: RerankMethod = "sangwon",
    explain: bool = True,
    checkpointer: BaseCheckpointSaver | None = None,
):
    """그래프 컴파일.

    Parameters
    ----------
    rerank : 'vector' (Method A) or 'sangwon' (Method C2 — 기본)
    explain : True 면 rerank 다음에 explain_recommendations 노드 연결
    checkpointer : 멀티턴 세션. None 이면 in-memory MemorySaver 사용 (운영은 외부 주입 권장)
    """
    builder = StateGraph(RecommendState)
    builder.add_node("extract_slots", extract_slots)
    builder.add_node("score_completeness", score_completeness)
    builder.add_node("clarification_one_slot", clarification_one_slot)
    builder.add_node("check_compatibility_db", check_compatibility_db)
    builder.add_node("compatibility_llm_message", compatibility_llm_message)
    builder.add_node("db_filter_final", db_filter_final)

    rerank_node_name = "rerank"
    rerank_fn = rerank_by_vector if rerank == "vector" else rerank_by_sangwon
    builder.add_node(rerank_node_name, rerank_fn)

    builder.add_edge(START, "extract_slots")
    builder.add_edge("extract_slots", "score_completeness")
    builder.add_conditional_edges(
        "score_completeness",
        route_after_completeness,
        {"clarification": "clarification_one_slot", "compatibility": "check_compatibility_db"},
    )
    builder.add_edge("clarification_one_slot", END)
    builder.add_conditional_edges(
        "check_compatibility_db",
        route_after_compatibility,
        {"compatibility_llm": "compatibility_llm_message", "db_filter": "db_filter_final"},
    )
    builder.add_edge("compatibility_llm_message", END)

    # Stage 분기 — 첫 추천이면 present_initial_list, 보강된 슬롯으로 정밀 추천이면 rerank.
    builder.add_node("present_initial_list", present_initial_list)
    builder.add_conditional_edges(
        "db_filter_final",
        route_after_db_filter,
        {"initial": "present_initial_list", "refine": rerank_node_name},
    )
    builder.add_edge("present_initial_list", END)

    if explain:
        builder.add_node("explain_recommendations", explain_recommendations)
        builder.add_edge(rerank_node_name, "explain_recommendations")
        builder.add_edge("explain_recommendations", END)
    else:
        builder.add_edge(rerank_node_name, END)

    return builder.compile(checkpointer=checkpointer or MemorySaver())
