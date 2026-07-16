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
    deleted: bool = False  # 계약완료 삭제 건 = 상태 유지 + "삭제됨" 표기
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
    media_ids: list[str] = []


class PlanOut(BaseModel):
    plan_no: int
    product_name: Optional[str] = None
    product_display_name: Optional[str] = None
    advertisement_fee: Optional[int] = None
    production_fee: Optional[int] = None
    operation_start_time: Optional[str] = None
    operation_end_time: Optional[str] = None


class ProposalItemOut(BaseModel):
    media_id: str
    name: Optional[str] = None
    price: Optional[int] = None
    production_fee: Optional[int] = None
    thumbnail_url: Optional[str] = None
    category: Optional[str] = None
    region: Optional[str] = None
    product: Optional[str] = None
    address: Optional[str] = None
    ooh_type: Optional[str] = None
    description: Optional[str] = None
    device_quantity: Optional[int] = None
    surface_quantity: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    spec: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    quantity: Optional[int] = None
    selected_plan_no: Optional[int] = None
    plans: list[PlanOut] = []


class CounterSlide(BaseModel):
    image: str
    thumb: str


class ProposalDetail(ProposalSummary):
    items: list[ProposalItemOut] = []
    counter_proposal_slides_url: Optional[str] = None
    counter_proposal_slides: list[CounterSlide] = []
    counter_proposal_file_name: Optional[str] = None


class AdminProposalMember(BaseModel):
    membership_type: Optional[str] = None
    company_name: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class AdminProposalCounterFile(BaseModel):
    id: str
    file_url: str
    file_name: str
    author_name: Optional[str] = None
    slides_url: Optional[str] = None
    slides: list[CounterSlide] = []
    created_at: Optional[str] = None


class AdminProposalDetail(BaseModel):
    id: str
    title: str
    status: str
    deleted: bool = False
    total_amount: int = 0
    updated_at: Optional[str] = None
    counter_proposal_file_url: Optional[str] = None
    counter_proposal_file_name: Optional[str] = None
    counter_files: list[AdminProposalCounterFile] = []
    member: Optional[AdminProposalMember] = None
    items: list[ProposalItemOut] = []


class CreateProposalRequest(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    session_id: Optional[str] = None


class RenameProposalRequest(BaseModel):
    title: str = Field(min_length=1, max_length=300)


class AddItemsRequest(BaseModel):
    media_ids: list[str] = Field(min_length=1)
    session_id: Optional[str] = None
    plans: Optional[dict[str, int]] = None  # {media_id: plan_no} — 담을 때 지정한 플랜


class ReorderItemsRequest(BaseModel):
    media_ids: list[str] = Field(min_length=1)
    session_id: Optional[str] = None
    plans: Optional[dict[str, int]] = None  # {media_id: plan_no}
    dates: Optional[dict[str, dict[str, Optional[str]]]] = None  # {media_id: {start_date, end_date}}
    quantities: Optional[dict[str, Optional[int]]] = None  # {media_id: quantity}
