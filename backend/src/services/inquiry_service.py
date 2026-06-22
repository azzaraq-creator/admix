"""문의 관리 비즈니스 로직 — admin/inquiries 목록·상세·답변."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.models.admin import Admin
from src.models.inquiry import Inquiry
from src.schemas.inquiry import InquiryAnswerUpdate

_STATUS = {"pending": "답변 대기", "answered": "답변 완료"}


def _fmt_date(dt) -> str:
    return dt.date().isoformat() if dt is not None else "-"


def _fmt_dt(dt) -> str | None:
    return dt.isoformat() if dt is not None else None


def list_inquiries(db: Session) -> list[dict]:
    rows = db.query(Inquiry).order_by(Inquiry.created_at.desc()).all()
    return [
        dict(
            id=str(q.id),
            name=q.name or "-",
            title=q.subject,
            content=q.content,
            status=_STATUS.get(q.status, q.status),
            submittedAt=_fmt_date(q.created_at),
        )
        for q in rows
    ]


def _get_or_404(db: Session, inquiry_id: uuid.UUID) -> Inquiry:
    q = db.query(Inquiry).filter(Inquiry.id == inquiry_id).first()
    if q is None:
        raise HTTPException(status_code=404, detail="문의를 찾을 수 없습니다.")
    return q


def _detail(db: Session, q: Inquiry) -> dict:
    answerer = None
    if q.answered_by is not None:
        admin = db.query(Admin).filter(Admin.id == q.answered_by).first()
        answerer = admin.name if admin else None
    return dict(
        id=q.id,
        name=q.name or "-",
        email=q.email,
        phone=q.phone,
        company=q.company,
        subject=q.subject,
        content=q.content,
        status=_STATUS.get(q.status, q.status),
        submittedAt=_fmt_date(q.created_at),
        answer=q.answer,
        answerer=answerer,
        answeredAt=_fmt_dt(q.answered_at),
    )


def get_inquiry(db: Session, inquiry_id: uuid.UUID) -> dict:
    return _detail(db, _get_or_404(db, inquiry_id))


def answer_inquiry(
    db: Session, inquiry_id: uuid.UUID, data: InquiryAnswerUpdate, admin: Admin
) -> dict:
    q = _get_or_404(db, inquiry_id)
    q.answer = data.answer
    q.status = "answered"
    q.answered_by = admin.id
    q.answered_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(q)
    return _detail(db, q)
