"""FAQ CRUD 비즈니스 로직."""
from __future__ import annotations

import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.models.faq import Faq
from src.schemas.faq import FaqCreate, FaqUpdate


def create_faq(db: Session, data: FaqCreate) -> Faq:
    faq = Faq(**data.model_dump())
    db.add(faq)
    db.commit()
    db.refresh(faq)
    return faq


def list_faqs(
    db: Session, faq_type: str | None = None, published_only: bool = False
) -> list[Faq]:
    q = db.query(Faq)
    if faq_type is not None:
        q = q.filter(Faq.faq_type == faq_type)
    if published_only:
        q = q.filter(Faq.is_published.is_(True))
    return q.order_by(Faq.sort_order, Faq.created_at).all()


def get_faq(db: Session, faq_id: uuid.UUID) -> Faq:
    faq = db.query(Faq).filter(Faq.id == faq_id).first()
    if faq is None:
        raise HTTPException(status_code=404, detail="FAQ를 찾을 수 없습니다.")
    return faq


def update_faq(db: Session, faq_id: uuid.UUID, data: FaqUpdate) -> Faq:
    faq = get_faq(db, faq_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(faq, field, value)
    db.commit()
    db.refresh(faq)
    return faq


def delete_faq(db: Session, faq_id: uuid.UUID) -> None:
    faq = get_faq(db, faq_id)
    db.delete(faq)
    db.commit()
