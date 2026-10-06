"""세션/메시지 입출력 스키마."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AdSessionCreate(BaseModel):
    title: Optional[str] = None


class AdSessionUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class ProposalChoicePicked(BaseModel):
    """믹시 "어느 기획안에 담을까요?" 목록에서 사용자가 고른 기획안."""

    proposal_id: str
    proposal_name: str = Field(max_length=300)
    # 어떤 목록이었는지 찾는 데 쓴다(같은 대화에 고르기 목록이 여러 번 나올 수 있다).
    media_ids: List[str] = []


class AdSessionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    thread_id: str
    created_at: datetime
    updated_at: datetime


class AdMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    role: Literal["user", "assistant"]
    content: str
    payload: Optional[dict[str, Any]] = None
    created_at: datetime

    @field_validator("role", mode="before")
    @classmethod
    def _coerce_role(cls, v: Any) -> Any:
        if isinstance(v, Enum):
            return v.value
        return v


class AdSessionDetail(AdSessionSummary):
    messages: List[AdMessageOut]


class StreamMessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class AdSessionAdminRow(BaseModel):
    id: str
    title: str
    message_count: int
    created_at: datetime
    updated_at: datetime


class AdChatOverviewRow(BaseModel):
    kind: Literal["member", "guest"]
    key: str  # member=user_id, guest=session_id
    name: str
    email: str
    membership: Optional[str] = None
    room_count: int
    message_count: int
    last_used_at: datetime


class AdChatOverviewResponse(BaseModel):
    total: int
    items: List[AdChatOverviewRow]


class AdUserChatDetail(BaseModel):
    user_id: str
    name: str
    email: str
    membership: Optional[str] = None
    sessions: List[AdSessionAdminRow]


class AdChatCount(BaseModel):
    # 로그인 사용자의 전체 세션에 걸친 와리가리 챗 횟수(user 메시지 수).
    chat_count: int
