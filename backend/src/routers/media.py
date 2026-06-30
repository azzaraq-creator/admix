"""매체 목록 라우터 — admin/media 페이지 연동."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from src.database import get_db
from src.schemas.media import (
    MediaCardListResponse,
    MediaClusterResponse,
    MediaDetail,
    MediaFilterOptions,
    MediaListResponse,
)
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


@router.get("/fixed/filter-options", response_model=MediaFilterOptions)
def get_fixed_filter_options(db: Session = Depends(get_db)) -> MediaFilterOptions:
    return MediaFilterOptions(**media_service.get_fixed_filter_options(db))


@router.get("/fixed", response_model=MediaCardListResponse)
def list_fixed_media(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    category: list[str] | None = Query(None),
    ooh_type: list[str] | None = Query(None),
    exposure_type: list[str] | None = Query(None),
    media_shape: list[str] | None = Query(None),
    product_master_type: list[str] | None = Query(None),
    price_min: int | None = Query(None, ge=0),
    price_max: int | None = Query(None, ge=0),
    north_east_latitude: float | None = Query(None),
    south_west_latitude: float | None = Query(None),
    north_east_longitude: float | None = Query(None),
    south_west_longitude: float | None = Query(None),
    db: Session = Depends(get_db),
) -> MediaCardListResponse:
    total, items = media_service.list_fixed_media(
        db,
        limit=limit,
        offset=offset,
        categories=category,
        ooh_types=ooh_type,
        exposure_types=exposure_type,
        media_shapes=media_shape,
        product_master_types=product_master_type,
        price_min=price_min,
        price_max=price_max,
        ne_lat=north_east_latitude,
        sw_lat=south_west_latitude,
        ne_lng=north_east_longitude,
        sw_lng=south_west_longitude,
    )
    return MediaCardListResponse(total=total, items=items)


@router.get("/fixed/clusters", response_model=MediaClusterResponse)
def list_fixed_clusters(
    north_east_latitude: float = Query(...),
    south_west_latitude: float = Query(...),
    north_east_longitude: float = Query(...),
    south_west_longitude: float = Query(...),
    zoom_level: int = Query(..., ge=1, le=20),
    category: list[str] | None = Query(None),
    ooh_type: list[str] | None = Query(None),
    exposure_type: list[str] | None = Query(None),
    media_shape: list[str] | None = Query(None),
    product_master_type: list[str] | None = Query(None),
    price_min: int | None = Query(None, ge=0),
    price_max: int | None = Query(None, ge=0),
    db: Session = Depends(get_db),
) -> MediaClusterResponse:
    data = media_service.list_fixed_clusters(
        db,
        zoom_level=zoom_level,
        ne_lat=north_east_latitude,
        sw_lat=south_west_latitude,
        ne_lng=north_east_longitude,
        sw_lng=south_west_longitude,
        categories=category,
        ooh_types=ooh_type,
        exposure_types=exposure_type,
        media_shapes=media_shape,
        product_master_types=product_master_type,
        price_min=price_min,
        price_max=price_max,
    )
    return MediaClusterResponse(**data)


@router.get("/{media_id}", response_model=MediaDetail)
def get_media_detail(media_id: str, db: Session = Depends(get_db)) -> MediaDetail:
    detail = media_service.get_media_detail(db, media_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="media not found")
    return detail
