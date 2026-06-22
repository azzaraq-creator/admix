"""매체 목록 조회 — admin/media 페이지용 평면 매핑.

media 단일값 + 대표 플랜(plan_no=1)의 상품표시명을 합쳐 한 행으로 만든다.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import and_
from sqlalchemy.orm import Session

from src.models.media_master import Media
from src.models.media_plan import MediaPlan

_SALE_TYPE = {"SINGLE": "단품", "GROUP": "묶음"}
_EXPOSURE_TYPE = {"INSIDE": "실내", "OUTSIDE": "실외"}
_DURATION_TYPE = {
    "YEARS": "년",
    "MONTHS": "개월",
    "WEEKS": "주",
    "DAYS": "일",
    "HOURS": "시간",
}


def _media_badge(m: Media) -> str | None:
    if m.is_popular_yn:
        return "popular"
    if m.is_newly_built_yn:
        return "new"
    return None


def _fmt_fee(v: int | None) -> str:
    return f"{v:,}" if v is not None else "-"


def _fmt_date(dt: datetime | None) -> str:
    return dt.date().isoformat() if dt is not None else "-"


def list_moving_media(db: Session) -> list[dict]:
    rows = (
        db.query(Media)
        .filter(Media.media_source == "MOVING")
        .order_by(Media.media_id)
        .all()
    )
    items: list[dict] = []
    for m in rows:
        name = " ".join(p for p in [(m.name or "").strip(), (m.second_name or "").strip()] if p)
        items.append(
            dict(
                id=m.media_id,
                name=name or "-",
                minAdvertisementFeeKrw=m.min_advertisement_fee_krw,
                thumbnailUrl=m.thumbnail_url,
                badge=_media_badge(m),
            )
        )
    return items


def _plan_subtitle(p: MediaPlan) -> str | None:
    parts: list[str] = []
    device_qty = p.active_device_quantity or p.default_device_quantity
    surface_qty = p.active_surface_quantity or p.default_surface_quantity
    if device_qty and surface_qty:
        parts.append(f"{device_qty}기 {surface_qty}면")
    if p.exposure_duration_seconds:
        parts.append(f"{p.exposure_duration_seconds}초")
    if p.contractual_duration and p.contractual_duration_type:
        unit = _DURATION_TYPE.get(p.contractual_duration_type, p.contractual_duration_type)
        parts.append(f"{p.contractual_duration}{unit}")
    return " / ".join(parts) or None


def get_media_detail(db: Session, media_id: str) -> dict | None:
    m = db.query(Media).filter(Media.media_id == media_id).first()
    if m is None:
        return None

    name = " ".join(p for p in [(m.name or "").strip(), (m.second_name or "").strip()] if p)

    badge = _media_badge(m)

    features: list[dict] = []

    def add(label: str, value: str | None) -> None:
        if value not in (None, "", "-"):
            features.append(dict(label=label, value=str(value)))

    add("매체 카테고리", m.category_small)
    add("타입", m.ooh_type)
    add("노출 종류", _EXPOSURE_TYPE.get(m.exposure_type, m.exposure_type))
    add("판매 형태", _SALE_TYPE.get(m.sales_type, m.sales_type))
    add("고정/이동", "이동" if m.media_source == "MOVING" else "고정")
    if m.device_quantity:
        add("기기 수량", f"{m.device_quantity}기")
    if m.lead_time_bizdays:
        add("리드타임", f"{m.lead_time_bizdays}영업일")

    plans = [
        dict(
            planNo=p.plan_no,
            title=p.product_display_name or p.product_name or "-",
            subtitle=_plan_subtitle(p),
        )
        for p in m.plans
        if p.product_master_type == "PM_INDIVIDUAL"
    ]

    return dict(
        id=m.media_id,
        name=name or "-",
        badge=badge,
        minAdvertisementFeeKrw=m.min_advertisement_fee_krw,
        maxAdvertisementFeeKrw=m.max_advertisement_fee_krw,
        description=m.description,
        thumbnailUrl=m.thumbnail_url,
        imageUrls=[img.image_url for img in m.images],
        sizeText=(m.media_shape_summary or None),
        features=features,
        plans=plans,
    )


def list_media(db: Session) -> list[dict]:
    rows = (
        db.query(Media, MediaPlan)
        .outerjoin(
            MediaPlan,
            and_(MediaPlan.media_id == Media.media_id, MediaPlan.plan_no == 1),
        )
        .order_by(Media.media_id)
        .all()
    )
    items: list[dict] = []
    for m, plan in rows:
        product = "-"
        if plan is not None:
            product = plan.product_display_name or plan.product_name or "-"
        name = " ".join(p for p in [(m.name or "").strip(), (m.second_name or "").strip()] if p)
        items.append(
            dict(
                no=m.media_id,
                mediaType="이동" if m.media_source == "MOVING" else "고정",
                name=name or "-",
                region=m.loc_label or "-",
                category=m.category_small or "-",
                product=product,
                adCost=_fmt_fee(m.min_advertisement_fee_krw),
                saleType=_SALE_TYPE.get(m.sales_type, m.sales_type or "-"),
                updatedAt=_fmt_date(m.source_updated_at),
                createdAt=_fmt_date(m.source_created_at),
            )
        )
    return items
