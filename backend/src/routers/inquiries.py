"""문의 관리 라우터 — admin/inquiries 페이지 연동."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

XLSX_MEDIA_TYPE = (
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)

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
    page: int = 1,
    page_size: int = 10,
    date_from: str | None = None,
    date_to: str | None = None,
    keyword: str | None = None,
    status: str | None = None,
    member_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("business")),
) -> InquiryListResponse:
    total, items = inquiry_service.list_inquiries(
        db,
        date_from=date_from,
        date_to=date_to,
        keyword=keyword,
        status=status,
        member_id=member_id,
        page=page,
        page_size=page_size,
    )
    return InquiryListResponse(total=total, items=items)


@router.get("/export")
def export_inquiries(
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("business")),
) -> Response:
    """문의 목록 xlsx 다운로드."""
    content = inquiry_service.export_inquiries_xlsx(db)
    return Response(
        content=content,
        media_type=XLSX_MEDIA_TYPE,
        headers={
            "Content-Disposition": 'attachment; filename="inquiries.xlsx"'
        },
    )


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
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_permission("business")),
) -> InquiryDetail:
    return inquiry_service.answer_inquiry(db, inquiry_id, body, admin, background)
