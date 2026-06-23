"""제안 관리(admin) 응답 스키마 + 클라이언트 장바구니(플래닝) 스키마."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class ProposalRow(BaseModel):
    id: str
    name: str
    member: str
    mediaCount: str
    totalAmount: str
    status: str
    registeredAt: str


class ProposalListResponse(BaseModel):
    total: int
    items: list[ProposalRow]


# ===== 클라이언트(장바구니) =====


class ProposalSummary(BaseModel):
    id: str
    title: str
    status: str
    media_count: int
    total_amount: int
    updated_at: Optional[str] = None


class ProposalItemOut(BaseModel):
    media_id: str
    name: Optional[str] = None
    price: Optional[int] = None
    thumbnail_url: Optional[str] = None


class ProposalDetail(ProposalSummary):
    items: list[ProposalItemOut] = []


class CreateProposalRequest(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    session_id: Optional[str] = None


class RenameProposalRequest(BaseModel):
    title: str = Field(min_length=1, max_length=300)


class AddItemsRequest(BaseModel):
    media_ids: list[str] = Field(min_length=1)
    session_id: Optional[str] = None
