"""문의 관리 라우터 — admin/inquiries 페이지 연동."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.admin import Admin
from src.schemas.inquiry import (
    InquiryAnswerUpdate,
    InquiryDetail,
    InquiryListResponse,
)
from src.services import inquiry_service
from src.utils.deps import require_permission

router = APIRouter(prefix="/admin/inquiries", tags=["inquiries"])


@router.get("", response_model=InquiryListResponse)
def list_inquiries(
    db: Session = Depends(get_db), _: Admin = Depends(require_permission("business"))
) -> InquiryListResponse:
    items = inquiry_service.list_inquiries(db)
    return InquiryListResponse(total=len(items), items=items)


@router.get("/{inquiry_id}", response_model=InquiryDetail)
def get_inquiry(
    inquiry_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("business")),
) -> InquiryDetail:
    return inquiry_service.get_inquiry(db, inquiry_id)


@router.patch("/{inquiry_id}/answer", response_model=InquiryDetail)
def answer_inquiry(
    inquiry_id: uuid.UUID,
    body: InquiryAnswerUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_permission("business")),
) -> InquiryDetail:
    return inquiry_service.answer_inquiry(db, inquiry_id, body, admin)
