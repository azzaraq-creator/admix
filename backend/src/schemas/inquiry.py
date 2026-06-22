"""문의 관리(admin) 요청/응답 스키마. admin/inquiries 페이지용."""
from __future__ import annotations

import uuid

from pydantic import BaseModel, Field


class InquiryRow(BaseModel):
    id: str
    name: str
    title: str
    content: str
    status: str
    submittedAt: str


class InquiryListResponse(BaseModel):
    total: int
    items: list[InquiryRow]


class InquiryDetail(BaseModel):
    id: uuid.UUID
    name: str
    email: str | None = None
    phone: str | None = None
    company: str | None = None
    subject: str
    content: str
    status: str
    submittedAt: str
    answer: str | None = None
    answerer: str | None = None
    answeredAt: str | None = None


class InquiryAnswerUpdate(BaseModel):
    answer: str = Field(min_length=1)
