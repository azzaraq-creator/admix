"""클라이언트 문의 내역 라우터 — 로그인 회원 본인의 문의 조회. admin/inquiries 와 별개."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.user import User
from src.schemas.inquiry import (
    InquiryCreateRequest,
    MyInquiryDetail,
    MyInquiryListResponse,
)
from src.services import inquiry_service
from src.utils.deps import get_current_user

router = APIRouter(prefix="/inquiries", tags=["inquiries-client"])


@router.post("", response_model=MyInquiryDetail, status_code=201)
def create_my_inquiry(
    body: InquiryCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MyInquiryDetail:
    return MyInquiryDetail(**inquiry_service.create_inquiry(db, user.id, body))


@router.get("", response_model=MyInquiryListResponse)
def list_my_inquiries(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MyInquiryListResponse:
    items = inquiry_service.list_my_inquiries(db, user.id)
    return MyInquiryListResponse(total=len(items), items=items)


@router.get("/{inquiry_id}", response_model=MyInquiryDetail)
def get_my_inquiry(
    inquiry_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MyInquiryDetail:
    return MyInquiryDetail(**inquiry_service.get_my_inquiry(db, user.id, inquiry_id))
