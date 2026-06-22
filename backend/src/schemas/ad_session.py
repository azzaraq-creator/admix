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
