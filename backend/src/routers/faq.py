"""FAQ CRUD 라우터.

admin 인증 가드는 admin 로그인 구현 후 쓰기 엔드포인트에 추가한다(현재 없음).
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from src.database import get_db
from src.schemas.faq import FaqCreate, FaqResponse, FaqUpdate
from src.services import faq_service

router = APIRouter(prefix="/faqs", tags=["faq"])


@router.post("", response_model=FaqResponse, status_code=status.HTTP_201_CREATED)
def create_faq(body: FaqCreate, db: Session = Depends(get_db)) -> FaqResponse:
    return faq_service.create_faq(db, body)


@router.get("", response_model=list[FaqResponse])
def list_faqs(
    faq_type: str | None = Query(default=None),
    published_only: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> list[FaqResponse]:
    return faq_service.list_faqs(db, faq_type=faq_type, published_only=published_only)


@router.get("/{faq_id}", response_model=FaqResponse)
def get_faq(faq_id: uuid.UUID, db: Session = Depends(get_db)) -> FaqResponse:
    return faq_service.get_faq(db, faq_id)


@router.patch("/{faq_id}", response_model=FaqResponse)
def update_faq(faq_id: uuid.UUID, body: FaqUpdate, db: Session = Depends(get_db)) -> FaqResponse:
    return faq_service.update_faq(db, faq_id, body)


@router.delete("/{faq_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_faq(faq_id: uuid.UUID, db: Session = Depends(get_db)) -> Response:
    faq_service.delete_faq(db, faq_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
