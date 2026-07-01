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


# ===== 클라이언트(로그인 회원 본인 문의 내역) =====


class InquiryCreateRequest(BaseModel):
    subject: str = Field(min_length=1, max_length=300)
    content: str = Field(min_length=1)
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    company: str | None = None


class MyInquiryRow(BaseModel):
    id: str
    subject: str
    status: str  # pending | answered (원본값 — 프론트에서 매핑)
    createdAt: str | None = None


class MyInquiryListResponse(BaseModel):
    total: int
    items: list[MyInquiryRow]


class MyInquiryDetail(BaseModel):
    id: str
    name: str
    email: str | None = None
    phone: str | None = None
    company: str | None = None
    subject: str
    content: str
    status: str
    createdAt: str | None = None
    answer: str | None = None
    answererName: str | None = None
    answeredAt: str | None = None
