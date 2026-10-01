"""관심 매체 라우터 — 회원 전용(토큰 필수).

- GET    /favorites/ids          담은 매체 id 목록(하트 켜짐 표시용)
- GET    /favorites              관심 매체 페이지 카드 목록(매체 찾기와 같은 검색어·필터)
- PUT    /favorites/{media_id}   담기(멱등)
- DELETE /favorites/{media_id}   해제(멱등)
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.user import User
from src.schemas.media import MediaCardListResponse
from src.services import favorite_service
from src.utils.deps import get_current_user

router = APIRouter(prefix="/favorites", tags=["favorites"])


class FavoriteIdsResponse(BaseModel):
    media_ids: list[str]


@router.get("/ids", response_model=FavoriteIdsResponse)
def list_favorite_ids(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FavoriteIdsResponse:
    return FavoriteIdsResponse(media_ids=favorite_service.list_favorite_ids(db, user.id))


@router.get("", response_model=MediaCardListResponse)
def list_favorites(
    category: list[str] | None = Query(None),
    ooh_type: list[str] | None = Query(None),
    exposure_type: list[str] | None = Query(None),
    media_shape: list[str] | None = Query(None),
    product_master_type: list[str] | None = Query(None),
    price_min: int | None = Query(None, ge=0),
    price_max: int | None = Query(None, ge=0),
    keyword: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MediaCardListResponse:
    """관심 매체 카드 — 매체 찾기(/media/fixed)와 같은 검색어·필터 파라미터를 받는다(지도 영역·페이지는 없음)."""
    items = favorite_service.list_favorite_cards(
        db,
        user.id,
        categories=category,
        ooh_types=ooh_type,
        exposure_types=exposure_type,
        media_shapes=media_shape,
        product_master_types=product_master_type,
        price_min=price_min,
        price_max=price_max,
        keyword=keyword,
    )
    return MediaCardListResponse(total=len(items), items=items)


@router.put("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
def add_favorite(
    media_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    if not favorite_service.add_favorite(db, user.id, media_id):
        raise HTTPException(status_code=404, detail="매체를 찾을 수 없습니다.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favorite(
    media_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    favorite_service.remove_favorite(db, user.id, media_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
