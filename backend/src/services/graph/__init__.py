"""광고 매체 추천 LangGraph 패키지.

노트북 prototype (notebooks/05_recommend_graph_v2.ipynb) 을 모듈화한 구조.
빌더: ``from src.services.graph.builder import build_graph``
"""
from src.services.graph.builder import build_graph
from src.services.graph.state import RecommendState, Slots, TargetStruct

__all__ = ["build_graph", "RecommendState", "Slots", "TargetStruct"]
