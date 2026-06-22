"""매체 목록 라우터 — admin/media 페이지 연동."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from src.database import get_db
from src.schemas.media import MediaCardListResponse, MediaDetail, MediaListResponse
from src.services import media_service

router = APIRouter(prefix="/media", tags=["media"])


@router.get("", response_model=MediaListResponse)
def list_media(db: Session = Depends(get_db)) -> MediaListResponse:
    items = media_service.list_media(db)
    return MediaListResponse(total=len(items), items=items)


@router.get("/moving", response_model=MediaCardListResponse)
def list_moving_media(db: Session = Depends(get_db)) -> MediaCardListResponse:
    items = media_service.list_moving_media(db)
    return MediaCardListResponse(total=len(items), items=items)


@router.get("/fixed", response_model=MediaCardListResponse)
def list_fixed_media(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> MediaCardListResponse:
    total, items = media_service.list_fixed_media(db, limit=limit, offset=offset)
    return MediaCardListResponse(total=total, items=items)


@router.get("/{media_id}", response_model=MediaDetail)
def get_media_detail(media_id: str, db: Session = Depends(get_db)) -> MediaDetail:
    detail = media_service.get_media_detail(db, media_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="media not found")
    return detail
