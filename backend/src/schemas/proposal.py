"""제안 관리(admin) 응답 스키마. admin/proposals 페이지용."""
from __future__ import annotations

from pydantic import BaseModel


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
