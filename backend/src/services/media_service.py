"""매체 목록 조회 — admin/media 페이지용 평면 매핑.

media 단일값 + 대표 플랜(plan_no=1)의 상품표시명을 합쳐 한 행으로 만든다.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import and_, text
from sqlalchemy.orm import Session

from src.models.media_master import Media
from src.models.media_plan import MediaPlan
from src.services.graph.settings import SANGWON_MAX_DISTANCE_M, SANGWON_QUARTER

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


def _media_card(m: Media) -> dict:
    name = " ".join(p for p in [(m.name or "").strip(), (m.second_name or "").strip()] if p)
    return dict(
        id=m.media_id,
        name=name or "-",
        minAdvertisementFeeKrw=m.min_advertisement_fee_krw,
        thumbnailUrl=m.thumbnail_url,
        badge=_media_badge(m),
    )


def list_moving_media(db: Session) -> list[dict]:
    rows = (
        db.query(Media)
        .filter(Media.media_source == "MOVING")
        .order_by(Media.media_id)
        .all()
    )
    return [_media_card(m) for m in rows]


def list_fixed_media(db: Session, *, limit: int, offset: int) -> tuple[int, list[dict]]:
    base = db.query(Media).filter(Media.media_source == "FIXED")
    total = base.count()
    rows = base.order_by(Media.media_id).limit(limit).offset(offset).all()
    return total, [_media_card(m) for m in rows]


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


def _media_population(db: Session, source_detail_id: int | None) -> dict | None:
    """media.source_detail_id → ad_media.media_id → 인접 상권(sangwon) 유동인구.

    rerank_sangwon 과 동일 분기/거리 기준. 거리 초과·미매칭이면 None(섹션 숨김).
    """
    if source_detail_id is None:
        return None
    row = db.execute(
        text(
            """
            SELECT sp.sangwon_name, sp.total_foot_traffic,
                   sp.male_foot, sp.female_foot,
                   sp.age_10_foot, sp.age_20_foot, sp.age_30_foot,
                   sp.age_40_foot, sp.age_50_foot, sp.age_60_foot
            FROM ad_media am
            JOIN sangwon_population sp
              ON sp.sangwon_code = am.sangwon_code
             AND sp.quarter_code = :quarter
            WHERE am.media_id = :sid
              AND am.sangwon_distance_m <= :max_dist
            LIMIT 1
            """
        ),
        {"quarter": SANGWON_QUARTER, "sid": source_detail_id, "max_dist": SANGWON_MAX_DISTANCE_M},
    ).first()
    if row is None or not row.total_foot_traffic:
        return None

    total = float(row.total_foot_traffic)
    male = float(row.male_foot or 0)
    female = float(row.female_foot or 0)
    gender_base = male + female
    male_pct = round(male / gender_base * 100) if gender_base else 0
    age_buckets = [
        ("10", row.age_10_foot, "under"),
        ("20대", row.age_20_foot, None),
        ("30대", row.age_30_foot, None),
        ("40대", row.age_40_foot, None),
        ("50대", row.age_50_foot, None),
        ("60", row.age_60_foot, "over"),
    ]
    age_ratios = [
        dict(label=label, value=round((val or 0) / total * 100, 1), bound=bound)
        for label, val, bound in age_buckets
    ]
    return dict(
        sangwonName=row.sangwon_name,
        monthlyFootTraffic=int(row.total_foot_traffic),
        malePct=male_pct,
        femalePct=(100 - male_pct) if gender_base else 0,
        ageRatios=age_ratios,
    )


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
        address=(m.accurate_address or m.address or m.full_address_jibun or None),
        thumbnailUrl=m.thumbnail_url,
        imageUrls=[img.image_url for img in m.images],
        sizeText=(m.media_shape_summary or None),
        features=features,
        plans=plans,
        population=_media_population(db, m.source_detail_id),
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
