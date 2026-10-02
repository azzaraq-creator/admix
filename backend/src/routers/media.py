"""매체 조회 라우터(공개/클라이언트) — moving/fixed/상세/필터.

관리자 전체 목록은 routers/admin_media.py(/admin/media, media 권한) 참조.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from src.database import get_db
from src.schemas.media import (
    MediaCardListResponse,
    MediaClusterResponse,
    MediaDetail,
    MediaFilterOptions,
    PriceHistogramResponse,
)
from src.services import media_service

router = APIRouter(prefix="/media", tags=["media"])


@router.get("/moving", response_model=MediaCardListResponse)
def list_moving_media(
    category: list[str] | None = Query(None),
    ooh_type: list[str] | None = Query(None),
    exposure_type: list[str] | None = Query(None),
    media_shape: list[str] | None = Query(None),
    product_master_type: list[str] | None = Query(None),
    price_min: int | None = Query(None, ge=0),
    price_max: int | None = Query(None, ge=0),
    keyword: str | None = Query(None),
    db: Session = Depends(get_db),
) -> MediaCardListResponse:
    items = media_service.list_moving_media(
        db,
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


@router.get("/moving/filter-options", response_model=MediaFilterOptions)
def get_moving_filter_options(db: Session = Depends(get_db)) -> MediaFilterOptions:
    return MediaFilterOptions(**media_service.get_media_filter_options(db, "MOVING"))


@router.get("/fixed/filter-options", response_model=MediaFilterOptions)
def get_fixed_filter_options(db: Session = Depends(get_db)) -> MediaFilterOptions:
    return MediaFilterOptions(**media_service.get_media_filter_options(db, "FIXED"))


@router.get("/fixed/price-histogram", response_model=PriceHistogramResponse)
def get_fixed_price_histogram(
    category: list[str] | None = Query(None),
    ooh_type: list[str] | None = Query(None),
    exposure_type: list[str] | None = Query(None),
    media_shape: list[str] | None = Query(None),
    product_master_type: list[str] | None = Query(None),
    north_east_latitude: float | None = Query(None),
    south_west_latitude: float | None = Query(None),
    north_east_longitude: float | None = Query(None),
    south_west_longitude: float | None = Query(None),
    keyword: str | None = Query(None),
    db: Session = Depends(get_db),
) -> PriceHistogramResponse:
    """가격 필터 그래프 — 목록과 같은 조건(지도 영역·검색어·가격 외 필터)의 매체로 센 막대."""
    histogram = media_service.fixed_price_histogram_for_list(
        db,
        categories=category,
        ooh_types=ooh_type,
        exposure_types=exposure_type,
        media_shapes=media_shape,
        product_master_types=product_master_type,
        ne_lat=north_east_latitude,
        sw_lat=south_west_latitude,
        ne_lng=north_east_longitude,
        sw_lng=south_west_longitude,
        keyword=keyword,
    )
    return PriceHistogramResponse(histogram=histogram)


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
    keyword: str | None = Query(None),
    sort: str = Query("latest", pattern=media_service.MEDIA_SORT_PATTERN),
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
        keyword=keyword,
        sort=sort,
    )
    return MediaCardListResponse(total=total, items=items)


@router.get("/fixed/clusters", response_model=MediaClusterResponse)
def list_fixed_clusters(
    north_east_latitude: float | None = Query(None),
    south_west_latitude: float | None = Query(None),
    north_east_longitude: float | None = Query(None),
    south_west_longitude: float | None = Query(None),
    zoom_level: int = Query(..., ge=1, le=20),
    category: list[str] | None = Query(None),
    ooh_type: list[str] | None = Query(None),
    exposure_type: list[str] | None = Query(None),
    media_shape: list[str] | None = Query(None),
    product_master_type: list[str] | None = Query(None),
    price_min: int | None = Query(None, ge=0),
    price_max: int | None = Query(None, ge=0),
    keyword: str | None = Query(None),
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
        keyword=keyword,
    )
    return MediaClusterResponse(**data)


@router.get("/{media_id}", response_model=MediaDetail)
def get_media_detail(media_id: str, db: Session = Depends(get_db)) -> MediaDetail:
    detail = media_service.get_media_detail(db, media_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="media not found")
    return detail
