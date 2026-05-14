"""RecommendState + 슬롯 스키마.

Python 3.9 호환: typing.TypedDict 대신 typing_extensions 사용 (필수).
"""
from __future__ import annotations

from typing import Annotated, Literal, Optional

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field, field_validator
from typing_extensions import TypedDict

GoalLabel = Literal["visit", "branding", "reach", "conversion"]
Status = Literal[
    "starting",
    "awaiting_slots",
    "compat_blocked",
    "filtered",
    "ranked",
    "explained",
    "error",
]
Gender = Literal["male", "female", "mixed", "unknown"]


class TargetStruct(BaseModel):
    """가벼운 타겟 구조화. raw 보존 + 추출 메타."""

    raw: str = Field("", description="발화 원본 타겟 표현")
    ageGroups: list[str] = Field(default_factory=list)
    gender: Gender = Field("unknown")
    keywords: list[str] = Field(default_factory=list)

    @field_validator("ageGroups", "keywords", mode="before")
    @classmethod
    def _none_to_empty(cls, v):
        # LLM 이 null 반환 시 ValidationError 방지.
        return [] if v is None else v


class Slots(TypedDict, total=False):
    region: list[str]
    budget: Optional[int]
    target: Optional[dict]      # TargetStruct.model_dump() 결과
    product: list[str]
    goal: list[str]
    goal_label: Optional[GoalLabel]
    media_type: list[str]


class CompatViolation(TypedDict, total=False):
    pair: str
    slots_involved: list[str]
    sql_count: int
    detail: str
    # 충돌 슬롯의 실측 통계 (min/avg/count 원 단위)
    stats: dict
    # 대안 제안 후보. {"regions_for_type": [...], "types_in_region": [...], "regions_with_type": [...]}
    alternatives: dict


class RecommendState(TypedDict, total=False):
    messages: Annotated[list[BaseMessage], add_messages]
    slots: Slots
    completeness_score: Optional[int]
    completeness_missing: list[str]
    compat_violations: list[CompatViolation]
    matched_media: list[dict]
    matched_count: Optional[int]
    # rerank 이전 hard-filter 통과 매체 id 전체 — explain pivot 다양성용.
    candidate_pool_ids: list[int]
    status: Status
    assumptions: list[str]
    # explain_recommendations 결과 (rerank 이후 단계).
    summary: Optional[str]
    top_picks: list[dict]
    pivots: list[dict]
