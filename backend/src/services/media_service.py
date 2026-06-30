"""매체 목록 조회 — admin/media 페이지용 평면 매핑.

media 단일값 + 대표 플랜(plan_no=1)의 상품표시명을 합쳐 한 행으로 만든다.
"""
from __future__ import annotations

import math
from datetime import datetime

from sqlalchemy import and_, func, text
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
        lat=float(m.latitude) if m.latitude is not None else None,
        lng=float(m.longitude) if m.longitude is not None else None,
    )


def list_moving_media(db: Session) -> list[dict]:
    rows = (
        db.query(Media)
        .filter(Media.media_source == "MOVING")
        .order_by(Media.media_id)
        .all()
    )
    return [_media_card(m) for m in rows]


def _fixed_base_query(
    db: Session,
    *,
    categories: list[str] | None,
    ooh_types: list[str] | None,
    exposure_types: list[str] | None,
    media_shapes: list[str] | None,
    product_master_types: list[str] | None,
    price_min: int | None,
    price_max: int | None,
    ne_lat: float | None = None,
    sw_lat: float | None = None,
    ne_lng: float | None = None,
    sw_lng: float | None = None,
):
    """FIXED 매체 공통 필터 쿼리. 리스트·지도클러스터가 동일 조건을 공유한다."""
    base = db.query(Media).filter(Media.media_source == "FIXED")
    if categories:
        base = base.filter(Media.category_large.in_(categories))
    if ooh_types:
        base = base.filter(Media.ooh_type.in_(ooh_types))
    if exposure_types:
        base = base.filter(Media.exposure_type.in_(exposure_types))
    if media_shapes:
        base = base.filter(Media.media_shape.in_(media_shapes))
    if price_min is not None:
        base = base.filter(Media.min_advertisement_fee_krw >= price_min)
    if price_max is not None:
        base = base.filter(Media.min_advertisement_fee_krw <= price_max)
    if product_master_types:
        # 매체판매유형 = 해당 매체 플랜의 product_master_type 집합 기준(조인 IN)
        plan_media_ids = db.query(MediaPlan.media_id).filter(
            MediaPlan.product_master_type.in_(product_master_types)
        )
        base = base.filter(Media.media_id.in_(plan_media_ids))
    if None not in (ne_lat, sw_lat, ne_lng, sw_lng):
        # 지도 화면 영역(bounding box) 종속 — 리스트=지도 영역.
        base = base.filter(
            Media.latitude.isnot(None),
            Media.longitude.isnot(None),
            Media.latitude >= sw_lat,
            Media.latitude <= ne_lat,
            Media.longitude >= sw_lng,
            Media.longitude <= ne_lng,
        )
    return base


def list_fixed_media(
    db: Session,
    *,
    limit: int,
    offset: int,
    categories: list[str] | None = None,
    ooh_types: list[str] | None = None,
    exposure_types: list[str] | None = None,
    media_shapes: list[str] | None = None,
    product_master_types: list[str] | None = None,
    price_min: int | None = None,
    price_max: int | None = None,
    ne_lat: float | None = None,
    sw_lat: float | None = None,
    ne_lng: float | None = None,
    sw_lng: float | None = None,
) -> tuple[int, list[dict]]:
    base = _fixed_base_query(
        db,
        categories=categories,
        ooh_types=ooh_types,
        exposure_types=exposure_types,
        media_shapes=media_shapes,
        product_master_types=product_master_types,
        price_min=price_min,
        price_max=price_max,
        ne_lat=ne_lat,
        sw_lat=sw_lat,
        ne_lng=ne_lng,
        sw_lng=sw_lng,
    )
    total = base.count()
    rows = base.order_by(Media.media_id).limit(limit).offset(offset).all()
    return total, [_media_card(m) for m in rows]


# 지도 마커 클러스터링 — zoom_level 기반 그리드 셀 크기(도 단위).
# kakao 지도 레벨은 1=최대확대 … 14=최대축소. 축소(level↑)일수록 셀이 커져 더 많이 묶인다.
_CLUSTER_CELL_DEG_BASE = 0.0006
_CLUSTER_MIN_LEVEL = 1
# 이 레벨 이하(= 더 확대)에선 클러스터를 만들지 않고 개별 마커(핀)만 표시.
# 1 = 최대 확대(레벨1)일 때만 개별 핀. 레벨 2+에선 그리드 클러스터링이 줌에 따라 변한다.
_CLUSTER_DECLUSTER_LEVEL = 1


def _cluster_cell_deg(zoom_level: int) -> float:
    step = max(0, zoom_level - _CLUSTER_MIN_LEVEL)
    return _CLUSTER_CELL_DEG_BASE * (2 ** step)


def _marker_from_row(r, lat: float, lng: float) -> dict:
    name = " ".join(
        p for p in [(r.name or "").strip(), (r.second_name or "").strip()] if p
    )
    return dict(
        id=r.media_id,
        lat=lat,
        lng=lng,
        name=name or "-",
        categoryLarge=r.category_large,
        minAdvertisementFeeKrw=r.min_advertisement_fee_krw,
    )


def list_fixed_clusters(
    db: Session,
    *,
    zoom_level: int,
    ne_lat: float,
    sw_lat: float,
    ne_lng: float,
    sw_lng: float,
    categories: list[str] | None = None,
    ooh_types: list[str] | None = None,
    exposure_types: list[str] | None = None,
    media_shapes: list[str] | None = None,
    product_master_types: list[str] | None = None,
    price_min: int | None = None,
    price_max: int | None = None,
) -> dict:
    """지도 화면(bbox) 안 FIXED 매체를 zoom_level 그리드로 묶어 클러스터/마커로 반환."""
    base = _fixed_base_query(
        db,
        categories=categories,
        ooh_types=ooh_types,
        exposure_types=exposure_types,
        media_shapes=media_shapes,
        product_master_types=product_master_types,
        price_min=price_min,
        price_max=price_max,
        ne_lat=ne_lat,
        sw_lat=sw_lat,
        ne_lng=ne_lng,
        sw_lng=sw_lng,
    )
    rows = base.with_entities(
        Media.media_id,
        Media.name,
        Media.second_name,
        Media.category_large,
        Media.latitude,
        Media.longitude,
        Media.min_advertisement_fee_krw,
    ).all()

    points = [
        (r, float(r.latitude), float(r.longitude))
        for r in rows
        if r.latitude is not None and r.longitude is not None
    ]

    # 확대 임계치 이하: 클러스터 없이 개별 핀만.
    if zoom_level <= _CLUSTER_DECLUSTER_LEVEL:
        markers = [_marker_from_row(r, lat, lng) for r, lat, lng in points]
        return dict(clusters=[], markers=markers)

    cell = _cluster_cell_deg(zoom_level)
    buckets: dict[tuple[int, int], list] = {}
    for r, lat, lng in points:
        key = (math.floor(lat / cell), math.floor(lng / cell))
        buckets.setdefault(key, []).append((r, lat, lng))

    clusters: list[dict] = []
    markers = []
    for members in buckets.values():
        if len(members) == 1:
            markers.append(_marker_from_row(*members[0]))
        else:
            n = len(members)
            clusters.append(
                dict(
                    lat=sum(m[1] for m in members) / n,
                    lng=sum(m[2] for m in members) / n,
                    count=n,
                )
            )
    return dict(clusters=clusters, markers=markers)


def get_fixed_filter_options(db: Session) -> dict:
    """매체검색 필터 옵션 — FIXED 매체 기준 distinct 값 + 가격(최소광고비) 범위."""

    def _distinct(col) -> list[str]:
        rows = (
            db.query(col)
            .filter(Media.media_source == "FIXED", col.isnot(None))
            .distinct()
            .order_by(col)
            .all()
        )
        return [r[0] for r in rows]

    pmt_rows = (
        db.query(MediaPlan.product_master_type)
        .join(Media, MediaPlan.media_id == Media.media_id)
        .filter(
            Media.media_source == "FIXED",
            MediaPlan.product_master_type.isnot(None),
        )
        .distinct()
        .order_by(MediaPlan.product_master_type)
        .all()
    )
    price = (
        db.query(
            func.min(Media.min_advertisement_fee_krw),
            func.max(Media.min_advertisement_fee_krw),
        )
        .filter(Media.media_source == "FIXED")
        .first()
    )
    price_min = price[0] if price else None
    price_max = price[1] if price else None
    return dict(
        categories=_distinct(Media.category_large),
        ooh_types=_distinct(Media.ooh_type),
        exposure_types=_distinct(Media.exposure_type),
        media_shapes=_distinct(Media.media_shape),
        product_master_types=[r[0] for r in pmt_rows],
        price_min=price_min,
        price_max=price_max,
        price_histogram=_price_histogram(db, price_min, price_max),
    )


_PRICE_HISTOGRAM_BUCKETS = 24


def _price_histogram(
    db: Session, price_min: int | None, price_max: int | None
) -> list[int]:
    """min~max 가격 구간을 균등 버킷으로 나눠 버킷별 FIXED 매체 수를 센다."""
    if price_min is None or price_max is None or price_max <= price_min:
        return []
    fees = (
        db.query(Media.min_advertisement_fee_krw)
        .filter(
            Media.media_source == "FIXED",
            Media.min_advertisement_fee_krw.isnot(None),
        )
        .all()
    )
    n = _PRICE_HISTOGRAM_BUCKETS
    span = price_max - price_min
    counts = [0] * n
    for (fee,) in fees:
        idx = int((fee - price_min) * n / span)
        if idx >= n:
            idx = n - 1
        elif idx < 0:
            idx = 0
        counts[idx] += 1
    return counts


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
