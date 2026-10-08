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
    north_east_latitude: float | None = Query(None),
    south_west_latitude: float | None = Query(None),
    north_east_longitude: float | None = Query(None),
    south_west_longitude: float | None = Query(None),
    keyword: str | None = Query(None),
    # 지역 — "서울특별시"(시·도 전체) 또는 "서울특별시 강남구". 여러 개면 OR.
    region: list[str] | None = Query(None),
    sort: str = Query("latest", pattern=media_service.MEDIA_SORT_PATTERN),
    db: Session = Depends(get_db),
) -> MediaCardListResponse:
    """이동매체 목록. 지도 영역을 주면 운행 범위가 그 영역과 겹치는 매체만(매체 찾기 목록)."""
    items = media_service.list_moving_media(
        db,
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
        regions=region,
        sort=sort,
    )
    return MediaCardListResponse(total=len(items), items=items)


@router.get("/moving/filter-options", response_model=MediaFilterOptions)
def get_moving_filter_options(db: Session = Depends(get_db)) -> MediaFilterOptions:
    return MediaFilterOptions(**media_service.get_media_filter_options(db, "MOVING"))


@router.get("/filter-options", response_model=MediaFilterOptions)
def get_media_filter_options(db: Session = Depends(get_db)) -> MediaFilterOptions:
    """고정·이동 매체 전체 기준 필터 옵션 — 두 매체를 함께 보여 주는 매체 찾기·관심 매체가 쓴다."""
    return MediaFilterOptions(**media_service.get_media_filter_options(db, None))


@router.get("/fixed/filter-options", response_model=MediaFilterOptions)
def get_fixed_filter_options(db: Session = Depends(get_db)) -> MediaFilterOptions:
    return MediaFilterOptions(**media_service.get_media_filter_options(db, "FIXED"))


@router.get("/fixed/price-histogram", response_model=PriceHistogramResponse)
def get_fixed_price_histogram(
    source: str = Query("all", pattern=media_service.FIND_SOURCE_PATTERN),
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
    # 지역 — "서울특별시"(시·도 전체) 또는 "서울특별시 강남구". 여러 개면 OR.
    region: list[str] | None = Query(None),
    db: Session = Depends(get_db),
) -> PriceHistogramResponse:
    """가격 필터 그래프 — 목록과 같은 조건(지도 영역·검색어·가격 외 필터)의 매체로 센 막대.

    탭(source)이 전체면 매체 찾기 목록과 같이 그 영역을 다니는 이동매체도 함께 센다.
    """
    histogram = media_service.find_price_histogram(
        db,
        source=source,
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
        regions=region,
    )
    return PriceHistogramResponse(histogram=histogram)


@router.get("/fixed", response_model=MediaCardListResponse)
def list_fixed_media(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    # 매체 찾기 탭 — all(고정+이동)·fixed·moving. 예전 호출(파라미터 없음)은 고정매체만.
    source: str = Query("fixed", pattern=media_service.FIND_SOURCE_PATTERN),
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
    # 지역 — "서울특별시"(시·도 전체) 또는 "서울특별시 강남구". 여러 개면 OR.
    region: list[str] | None = Query(None),
    sort: str = Query("latest", pattern=media_service.MEDIA_SORT_PATTERN),
    db: Session = Depends(get_db),
) -> MediaCardListResponse:
    total, items, counts = media_service.list_fixed_media(
        db,
        limit=limit,
        offset=offset,
        source=source,
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
        regions=region,
        sort=sort,
    )
    return MediaCardListResponse(total=total, items=items, sourceCounts=counts)


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
    # 지역 — "서울특별시"(시·도 전체) 또는 "서울특별시 강남구". 여러 개면 OR.
    region: list[str] | None = Query(None),
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
        regions=region,
    )
    return MediaClusterResponse(**data)


@router.get("/{media_id}", response_model=MediaDetail)
def get_media_detail(media_id: str, db: Session = Depends(get_db)) -> MediaDetail:
    detail = media_service.get_media_detail(db, media_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="media not found")
    return detail
