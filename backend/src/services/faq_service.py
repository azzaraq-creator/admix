"""FAQ CRUD 비즈니스 로직."""
from __future__ import annotations

import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from src.models.faq import Faq
from src.schemas.faq import FaqCreate, FaqUpdate
from src.utils.listing import in_date_range, paginate, parse_date


def _to_response(faq: Faq) -> dict:
    return dict(
        id=faq.id,
        faq_type=faq.faq_type,
        title=faq.title,
        content=faq.content,
        sort_order=faq.sort_order,
        is_published=faq.is_published,
        created_by=faq.created_by,
        author=faq.created_by_name or (faq.creator.name if faq.creator else None),
        created_at=faq.created_at,
        updated_at=faq.updated_at,
    )


def _get_or_404(db: Session, faq_id: uuid.UUID) -> Faq:
    faq = db.query(Faq).filter(Faq.id == faq_id).first()
    if faq is None:
        raise HTTPException(status_code=404, detail="FAQ를 찾을 수 없습니다.")
    return faq


def create_faq(db: Session, data: FaqCreate, author_name: str | None = None) -> dict:
    faq = Faq(**data.model_dump(), created_by_name=author_name)
    db.add(faq)
    db.commit()
    db.refresh(faq)
    return _to_response(faq)


def list_faqs(
    db: Session, faq_type: str | None = None, published_only: bool = False
) -> list[dict]:
    q = db.query(Faq).options(joinedload(Faq.creator))
    if faq_type is not None:
        q = q.filter(Faq.faq_type == faq_type)
    if published_only:
        q = q.filter(Faq.is_published.is_(True))
    return [_to_response(f) for f in q.order_by(Faq.sort_order, Faq.created_at).all()]


def list_faqs_admin(
    db: Session,
    *,
    date_from: str | None = None,
    date_to: str | None = None,
    keyword: str | None = None,
    faq_type: str | None = None,
    page: int = 1,
    page_size: int = 10,
) -> tuple[int, list[dict]]:
    """admin FAQ 목록 — 작성일(created_at) 기간·유형·키워드(제목) 필터 + 페이지네이션."""
    q = db.query(Faq).options(joinedload(Faq.creator))
    if faq_type is not None:
        q = q.filter(Faq.faq_type == faq_type)
    rows = [_to_response(f) for f in q.order_by(Faq.sort_order, Faq.created_at).all()]

    df = parse_date(date_from)
    dt = parse_date(date_to)
    kw = (keyword or "").strip().lower()

    def keep(r: dict) -> bool:
        if kw and kw not in r["title"].lower():
            return False
        created = r["created_at"]
        created_str = created.date().isoformat() if created else "-"
        if not in_date_range(created_str, df, dt):
            return False
        return True

    filtered = [r for r in rows if keep(r)]
    return paginate(filtered, page, page_size)


def get_faq(db: Session, faq_id: uuid.UUID) -> dict:
    return _to_response(_get_or_404(db, faq_id))


def update_faq(db: Session, faq_id: uuid.UUID, data: FaqUpdate) -> dict:
    faq = _get_or_404(db, faq_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(faq, field, value)
    db.commit()
    db.refresh(faq)
    return _to_response(faq)


def delete_faq(db: Session, faq_id: uuid.UUID) -> None:
    faq = _get_or_404(db, faq_id)
    db.delete(faq)
    db.commit()
