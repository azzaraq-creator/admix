"""제안 관리(admin) 응답 스키마 + 클라이언트 장바구니(플래닝) 스키마."""
from __future__ import annotations

from datetime import datetime
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


class ProposalPreviewItem(BaseModel):
    """내 기획안 목록 — 기획안명에 마우스를 올리면 뜨는 "기획안 요약"의 매체 한 줄."""

    media_id: str
    name: str
    address: Optional[str] = None
    thumbnail_url: Optional[str] = None
    # 선택한 상품(plan)의 광고비·제작비(1회분, 수량 미적용).
    advertisement_fee: Optional[int] = None
    production_fee: Optional[int] = None
    # 기획안에 담긴 시각 — "기획안 담기 완료" 토스트가 새로 담긴 순으로 보여 준다.
    created_at: Optional[datetime] = None


class ProposalSummary(BaseModel):
    id: str
    title: str
    status: str
    media_count: int
    total_amount: int
    updated_at: Optional[str] = None
    media_ids: list[str] = []
    created_at: Optional[str] = None
    # 아래는 내 기획안 목록(GET /proposals)에서만 채운다. 다른 응답에서는 기본값.
    advertisement_amount: Optional[int] = None  # 광고비 × 수량 합계
    production_amount: Optional[int] = None  # 제작비 × 수량 합계
    preview_items: list[ProposalPreviewItem] = []


class PlanOut(BaseModel):
    plan_no: int
    product_name: Optional[str] = None
    product_display_name: Optional[str] = None
    advertisement_fee: Optional[int] = None
    production_fee: Optional[int] = None
    operation_start_time: Optional[str] = None
    operation_end_time: Optional[str] = None
    # 상품 고르기 목록의 "영상 20초, 일 100회 송출" — 매체 정보 팝업과 같은 값.
    exposure_seconds: Optional[int] = None
    daily_broadcasts: Optional[int] = None


class ProposalItemOut(BaseModel):
    media_id: str
    name: Optional[str] = None  # 선택 상품명(서머리 슬라이드용) — 없으면 매체명
    media_name: Optional[str] = None  # 매체명(지금 보고 있는 기획안 패널·담기 알림용)
    created_at: Optional[str] = None  # 담은 시각 — 패널에서 최근에 담은 순으로 보여 준다
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
    months: int = 1
    production_count: int = 1
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
    title: Optional[str] = None
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
    # 매체 정보 팝업에서 고른 개월 수·제작 수 — {media_id: 값}. 없으면 1.
    months: Optional[dict[str, int]] = None
    production_counts: Optional[dict[str, int]] = None


class ReorderItemsRequest(BaseModel):
    media_ids: list[str] = Field(min_length=1)
    session_id: Optional[str] = None
    plans: Optional[dict[str, int]] = None  # {media_id: plan_no}
    dates: Optional[dict[str, dict[str, Optional[str]]]] = None  # {media_id: {start_date, end_date}}
    quantities: Optional[dict[str, Optional[int]]] = None  # {media_id: quantity}
    months: Optional[dict[str, int]] = None  # {media_id: 개월 수}
    production_counts: Optional[dict[str, int]] = None  # {media_id: 제작 수}
