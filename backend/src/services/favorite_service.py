"""관심 매체 서비스 — 회원별 하트 저장·해제·목록."""
from __future__ import annotations

import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from src.models.media_favorite import MediaFavorite
from src.models.media_master import Media
from src.services.media_service import (
    _apply_media_sort,
    _media_base_query,
    _media_card,
    price_histogram,
)


def list_favorite_ids(db: Session, member_id: uuid.UUID) -> list[str]:
    """담은 매체 id — 최근에 담은 순."""
    rows = (
        db.query(MediaFavorite.media_id)
        .filter(MediaFavorite.member_id == member_id)
        .order_by(MediaFavorite.created_at.desc())
        .all()
    )
    return [r.media_id for r in rows]


def list_favorite_cards(
    db: Session,
    member_id: uuid.UUID,
    *,
    categories: list[str] | None = None,
    ooh_types: list[str] | None = None,
    exposure_types: list[str] | None = None,
    media_shapes: list[str] | None = None,
    product_master_types: list[str] | None = None,
    price_min: int | None = None,
    price_max: int | None = None,
    keyword: str | None = None,
    regions: list[str] | None = None,
    sort: str | None = None,
) -> list[dict]:
    """관심 매체 페이지용 카드 — 매체 찾기 목록과 같은 모양·같은 검색어/필터 조건.

    정렬은 매체 찾기와 같고, "최신순"만 최근에 담은 순이다.
    """
    base = _media_base_query(
        db,
        media_source=None,
        categories=categories,
        ooh_types=ooh_types,
        exposure_types=exposure_types,
        media_shapes=media_shapes,
        product_master_types=product_master_types,
        price_min=price_min,
        price_max=price_max,
        keyword=keyword,
        regions=regions,
    )
    base = base.join(MediaFavorite, MediaFavorite.media_id == Media.media_id).filter(
        MediaFavorite.member_id == member_id
    )
    rows = (
        _apply_media_sort(base, sort, latest=MediaFavorite.created_at)
        .options(selectinload(Media.images))
        .all()
    )
    return [_media_card(m) for m in rows]


def favorite_price_histogram(
    db: Session,
    member_id: uuid.UUID,
    *,
    categories: list[str] | None = None,
    ooh_types: list[str] | None = None,
    exposure_types: list[str] | None = None,
    media_shapes: list[str] | None = None,
    product_master_types: list[str] | None = None,
    keyword: str | None = None,
    regions: list[str] | None = None,
) -> list[int]:
    """관심 매체 가격 그래프 — 내가 담은 매체 중 검색어·가격 외 필터에 맞는 것으로 센다."""
    base = _media_base_query(
        db,
        media_source=None,
        categories=categories,
        ooh_types=ooh_types,
        exposure_types=exposure_types,
        media_shapes=media_shapes,
        product_master_types=product_master_types,
        price_min=None,
        price_max=None,
        keyword=keyword,
        regions=regions,
    )
    base = base.join(MediaFavorite, MediaFavorite.media_id == Media.media_id).filter(
        MediaFavorite.member_id == member_id
    )
    return price_histogram(db, base)


def add_favorite(db: Session, member_id: uuid.UUID, media_id: str) -> bool:
    """담기. 없는 매체면 False. 이미 담겨 있으면 그대로 둔다(멱등)."""
    if db.get(Media, media_id) is None:
        return False
    exists = (
        db.query(MediaFavorite.id)
        .filter(MediaFavorite.member_id == member_id, MediaFavorite.media_id == media_id)
        .first()
    )
    if exists:
        return True
    db.add(MediaFavorite(member_id=member_id, media_id=media_id))
    try:
        db.commit()
    except IntegrityError:
        # 같은 매체를 거의 동시에 두 번 누른 경우 — 이미 담긴 것으로 본다.
        db.rollback()
    return True


def remove_favorite(db: Session, member_id: uuid.UUID, media_id: str) -> None:
    """해제. 담겨 있지 않아도 성공으로 본다(멱등)."""
    db.query(MediaFavorite).filter(
        MediaFavorite.member_id == member_id, MediaFavorite.media_id == media_id
    ).delete(synchronize_session=False)
    db.commit()
