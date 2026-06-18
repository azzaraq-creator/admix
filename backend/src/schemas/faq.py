"""FAQ 요청/응답 스키마."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class FaqCreate(BaseModel):
    faq_type: str | None = None
    title: str = Field(min_length=1, max_length=300)
    content: str = Field(min_length=1)
    sort_order: int = 0
    is_published: bool = True
    created_by: uuid.UUID | None = None


class FaqUpdate(BaseModel):
    faq_type: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=300)
    content: str | None = Field(default=None, min_length=1)
    sort_order: int | None = None
    is_published: bool | None = None


class FaqResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    faq_type: str | None = None
    title: str
    content: str
    sort_order: int
    is_published: bool
    created_by: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime
