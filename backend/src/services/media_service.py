"""매체 목록 조회 — admin/media 페이지용 평면 매핑.

media 단일값 + 대표 플랜(plan_no=1)의 상품표시명을 합쳐 한 행으로 만든다.
"""
from __future__ import annotations

import json
import math
import os
import uuid
from datetime import datetime
from decimal import Decimal
from io import BytesIO
from pathlib import Path

import boto3
from fastapi import HTTPException, UploadFile
from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    Integer,
    Numeric,
    Text,
    and_,
    or_,
    cast,
    column,
    func,
    inspect as sa_inspect,
    select,
    table,
    false,
    text,
    true,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, array
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from src.config import get_settings
from src.models.media_image import MediaImage
from src.models.media_master import Media
from src.models.media_plan import MediaPlan
from src.services import operating_area as oa
from src.services.seoul_citydata import realtime_population
from src.services.graph.settings import SANGWON_MAX_DISTANCE_M
from src.utils.listing import in_date_range, paginate, parse_date

# admin 매체 상세/등록 폼 — 자동 관리 컬럼(수정 대상 아님)
_MEDIA_AUTO_COLS = {"created_at", "updated_at"}
_MEDIA_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
_MEDIA_IMAGE_MAX_BYTES = 10 * 1024 * 1024  # 10MB
_MEDIA_IMAGE_CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
}

_SALE_TYPE = {"SINGLE": "단품", "GROUP": "묶음"}
_EXPOSURE_TYPE = {"INSIDE": "공간형", "OUTSIDE": "외부형"}  # 설치 장소 — 어드민·매체 필터와 같은 표기
_DURATION_TYPE = {
    "YEARS": "년",
    "MONTHS": "개월",
    "WEEKS": "주",
    "DAYS": "일",
    "HOURS": "시간",
}


def _duration_text(p: MediaPlan) -> str | None:
    """계약 기간 — "1개월". 단위는 복수형(MONTHS)·단수형(MONTH) 둘 다 들어온다."""
    if not (p.contractual_duration and p.contractual_duration_type):
        return None
    t = p.contractual_duration_type
    unit = _DURATION_TYPE.get(t) or _DURATION_TYPE.get(f"{t}S") or t
    return f"{p.contractual_duration}{unit}"


def _media_badge(m: Media) -> str | None:
    if m.is_popular_yn:
        return "popular"
    if m.is_newly_built_yn:
        return "new"
    return None


def _fmt_spec_number(v) -> str:
    """10.0 → "10", 2.5 → "2.5"."""
    n = float(v)
    return str(int(n)) if n.is_integer() else f"{n:g}"


# 규격 단위 — m 하나로 쓴다(어드민·엑셀에서 고르지 않는다).
SPEC_UNIT = "m"


def spec_text(m: Media) -> str | None:
    """어드민에서 입력한 규격 — "10 × 5 m". 가로·세로 중 하나만 있으면 그것만."""
    if m.spec_width is None and m.spec_height is None:
        return None
    sides = [_fmt_spec_number(v) for v in (m.spec_width, m.spec_height) if v is not None]
    return f"{' × '.join(sides)} {m.spec_unit or SPEC_UNIT}"


# 소재 형식 — 코드 → 화면 이름(어드민·엑셀 선택지와 같다).
MATERIAL_FORMATS = {
    "MP4": "영상(MP4)",
    "IMAGE": "스틸컷(JPG·PNG)",
}
# DOOH(디지털 화면)에만 있는 값 — 다른 매체 타입이면 저장하지 않는다.
_DOOH_ONLY_COLS = (
    "spec_resolution_width",
    "spec_resolution_height",
    "operation_start_time",
    "operation_end_time",
)


def _minutes(hhmm: str) -> int:
    """"06:30" → 390. 24:00 까지 받는다. 형식이 틀리면 ValueError."""
    h, m = hhmm.split(":")
    hours, mins = int(h), int(m)
    if len(m) != 2 or not (0 <= mins < 60) or not (0 <= hours <= 24) or (hours == 24 and mins):
        raise ValueError(hhmm)
    return hours * 60 + mins


def operation_text(m: Media) -> str | None:
    """DOOH 운영 시간 — "06:00 ~ 24:00 (18시간)". 종료가 시작보다 이르면 다음 날까지로 센다."""
    start, end = m.operation_start_time, m.operation_end_time
    if not start or not end:
        return None
    span = (_minutes(end) - _minutes(start)) % (24 * 60) or 24 * 60
    hours, mins = divmod(span, 60)
    length = f"{hours}시간" + (f" {mins}분" if mins else "")
    return f"{start} ~ {end} ({length})"


def _apply_dooh_rules(values: dict) -> None:
    """DOOH가 아니면 해상도·운영 시간을 비우고, 운영 시간·소재 형식 값을 검사한다(values 를 고친다)."""
    if values.get("ooh_type") != "DOOH":
        for col in _DOOH_ONLY_COLS:
            values[col] = None
    times = [values.get("operation_start_time"), values.get("operation_end_time")]
    if any(times) and not all(times):
        raise HTTPException(status_code=400, detail="운영 시간은 시작과 종료를 함께 정해 주세요.")
    for t in times:
        if t:
            try:
                _minutes(t)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"운영 시간 형식이 올바르지 않습니다: {t}") from None
    formats = values.get("material_formats")
    if formats is not None:
        if not isinstance(formats, list) or any(f not in MATERIAL_FORMATS for f in formats):
            raise HTTPException(status_code=400, detail="소재 형식 값이 올바르지 않습니다.")
        values["material_formats"] = [f for f in MATERIAL_FORMATS if f in formats] or None


def _apply_spec_unit(values: dict) -> None:
    """규격(가로·세로)이 있으면 단위는 m, 없으면 비운다. values 를 그 자리에서 고친다."""
    has_spec = values.get("spec_width") is not None or values.get("spec_height") is not None
    values["spec_unit"] = SPEC_UNIT if has_spec else None


def _size_text(m: Media) -> str | None:
    """상세 "사이즈 및 규격" 문구 — 어드민 규격(spec_*)이 있으면 그것.

    없으면 예전 값: media_shape_summary 는 운영 데이터에서 크기가 아니라 형태 코드("HORIZONTAL_SHAPE",
    "HORIZONTAL_SHAPE,VERTICAL_SHAPE")가 들어 있어, 코드면 내보내지 않는다(섹션 숨김).
    규격 속성(properties_extra_json)의 가로·세로는 원천에서 정수로 잘려("0 × 2 m")
    크기 문구로 쓰지 않는다.
    """
    spec = spec_text(m)
    if spec:
        return spec
    summary = (m.media_shape_summary or "").strip()
    return summary if summary and "_SHAPE" not in summary else None


def _fmt_fee(v: int | None) -> str:
    return f"{v:,}" if v is not None else "-"


def _fmt_date(dt: datetime | None) -> str:
    return dt.date().isoformat() if dt is not None else "-"


# 운행 구가 많으면 카드 한 줄에 다 못 담아 앞의 몇 곳만 보이고 "외 N곳"으로 줄인다.
_AREA_DISTRICTS_SHOWN = 3


def _operating_area(m: Media) -> dict | None:
    """이동매체 운행 지역 — 지도에 핀 대신 영역으로 그리고, 카드·상세에 위치 대신 보여 준다.

    city=운행 시·도, district=운행 구(쉼표 구분, 비면 시·도 전역),
    moving_location_detail=노선 설명. 범위는 저장하지 않고 operating_area 가 이름으로 계산한다.
    """
    if m.media_source != "MOVING":
        return None
    districts = oa.parse_districts(m.district)
    short = oa.short_city(m.city)
    if districts:
        shown = "·".join(districts[:_AREA_DISTRICTS_SHOWN])
        if len(districts) > _AREA_DISTRICTS_SHOWN:
            shown += f" 외 {len(districts) - _AREA_DISTRICTS_SHOWN}곳"
        label = f"{short} {shown}" if short else shown
    elif short:
        # "전국"은 그대로("전국 전역"이 되지 않게).
        label = short if short == oa.NATIONWIDE else f"{short} 전역"
    else:
        label = "운행 지역 정보 없음"
    b = oa.area_bounds(m.city, districts)
    return dict(
        label=label,
        # 지도에 그릴 경계를 찾는 키 — 공식 이름(모르는 이름은 입력 그대로).
        city=oa.canonical_city(m.city) or (m.city or "").strip() or None,
        districts=districts,
        route=(m.moving_location_detail or "").strip() or None,
        bounds=dict(neLat=b[0], swLat=b[1], neLng=b[2], swLng=b[3]) if b else None,
    )


def _media_card(m: Media) -> dict:
    name = " ".join(p for p in [(m.name or "").strip(), (m.second_name or "").strip()] if p)
    # 카드 이미지: 썸네일 우선 → media_image(sort_order) 순, 중복 제거 후 최대 3장.
    images: list[str] = []
    for url in (img.image_url for img in m.images):
        if url and url not in images:
            images.append(url)
    images = images[:3]
    return dict(
        id=m.media_id,
        name=name or "-",
        minAdvertisementFeeKrw=m.min_advertisement_fee_krw,
        minProductionFeeKrw=m.min_production_fee_krw,
        address=m.address,
        categoryLarge=m.category_large,
        categorySmall=m.category_small,
        salesType=_SALE_TYPE.get(m.sales_type, m.sales_type),
        thumbnailUrl=images[0] if images else None,
        images=images,
        badge=_media_badge(m),
        lat=float(m.latitude) if m.latitude is not None else None,
        lng=float(m.longitude) if m.longitude is not None else None,
        mediaSource=m.media_source or "FIXED",
        operatingArea=_operating_area(m),
    )


def list_moving_media(
    db: Session,
    *,
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
    keyword: str | None = None,
    regions: list[str] | None = None,
    sort: str | None = None,
) -> list[dict]:
    """이동매체 카드 — 수가 적어 페이지 없이 모두 준다.

    지도 영역(bbox)을 주면 운행 범위가 그 영역과 겹치는 매체만 남긴다(매체 찾기 목록).
    """
    base = _media_base_query(
        db,
        media_source="MOVING",
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
        keyword=keyword,
        regions=regions,
    )
    rows = _apply_media_sort(base, sort).options(selectinload(Media.images)).all()
    return [_media_card(m) for m in rows]


def _moving_area_overlaps(ne_lat: float, sw_lat: float, ne_lng: float, sw_lng: float):
    """이동매체 운행 지역이 지도 영역과 겹치는지 — 시·도/구 이름으로 판단한다(operating_area).

    운행 지역을 모르는 매체(시·도 없음·"전국"·모르는 이름)는 어느 영역에서든 보인다.
    """
    vp = oa.viewport_matches(ne_lat, sw_lat, ne_lng, sw_lng)
    city = func.trim(func.coalesce(Media.city, ""))
    districts = func.string_to_array(
        func.replace(func.coalesce(Media.district, ""), " ", ""), ","
    )
    no_district = func.trim(func.coalesce(Media.district, "")) == ""

    def has_any(names: list[str]):
        return districts.op("&&")(cast(array(names), ARRAY(Text)))

    conds = [city == "", city == oa.NATIONWIDE, ~city.in_(vp["known_names"])]
    if vp["cities"]:
        conds.append(city.in_(vp["cities"]))
    if vp["seoul_overlaps"]:
        # 구를 안 적었거나 아는 구가 하나도 없으면 서울 전체로 본다.
        seoul_whole = or_(no_district, ~has_any(oa.seoul_gu_names()))
        seoul_gu = has_any(vp["seoul_gus"]) if vp["seoul_gus"] else false()
        conds.append(and_(city.in_(vp["seoul_names"]), or_(seoul_whole, seoul_gu)))
    return or_(*conds)


def _parse_regions(regions: list[str] | None) -> dict[str, list[str] | None]:
    """지역 필터 값 — "서울특별시"(시·도 전체) 또는 "서울특별시 강남구"(구·군) → {시·도: [구·군] 또는 None}.

    시·도는 짧은·옛 이름도 받는다("서울 강남구"). 모르는 시·도는 버린다.
    """
    picked: dict[str, list[str] | None] = {}
    for raw in regions or []:
        parts = (raw or "").split(maxsplit=1)
        if not parts:
            continue
        canon = oa.canonical_city(parts[0])
        if canon is None or canon == oa.NATIONWIDE:
            continue
        if len(parts) == 1:
            picked[canon] = None  # 시·도 전체가 구·군 선택보다 우선
        elif picked.get(canon, []) is not None:
            picked.setdefault(canon, []).append(parts[1].strip())
    return picked


def _fixed_region_of(city: str | None, district: str | None, address: str | None):
    """고정매체의 (시·도 공식 이름, 구·군) — 칸이 비면 주소 앞부분("서울 강남구 …")에서 읽는다."""
    tokens = (address or "").split()
    canon = oa.canonical_city(city) or (oa.canonical_city(tokens[0]) if tokens else None)
    gu = (district or "").strip() or (tokens[1] if len(tokens) > 1 else "")
    if not gu.endswith(("구", "시", "군")):
        gu = ""
    return canon, gu


def _region_condition(regions: list[str] | None):
    """지역 필터 SQL 조건 — 없으면 None.

    - 고정매체: 시·도(city, 비면 주소 첫 단어)와 구·군(district, 비면 주소 둘째 단어)으로 고른다.
    - 이동매체: 운행 지역으로 고른다. 운행 구·군이 고른 것과 하나라도 겹치거나, 구·군 없이 그 시·도
      전체를 다니면 나온다. "전국" 매체는 어느 지역을 골라도 나온다. 운행 지역을 모르는 매체는 빠진다.
    """
    picked = _parse_regions(regions)
    if not picked:
        return None
    city = func.trim(func.coalesce(Media.city, ""))
    addr = func.trim(func.coalesce(Media.address, ""))
    fixed_gu = func.coalesce(
        func.nullif(func.trim(func.coalesce(Media.district, "")), ""),
        func.split_part(addr, " ", 2),
    )
    moving_gus = func.string_to_array(
        func.replace(func.coalesce(Media.district, ""), " ", ""), ","
    )
    no_district = func.trim(func.coalesce(Media.district, "")) == ""

    fixed_conds = []
    moving_conds = [city == oa.NATIONWIDE]
    for canon, gus in picked.items():
        names = oa.city_names(canon)
        fixed_city = or_(city.in_(names), and_(city == "", func.split_part(addr, " ", 1).in_(names)))
        if gus is None:
            fixed_conds.append(fixed_city)
            moving_conds.append(city.in_(names))
        else:
            fixed_conds.append(and_(fixed_city, fixed_gu.in_(gus)))
            moving_conds.append(
                and_(
                    city.in_(names),
                    or_(no_district, moving_gus.op("&&")(cast(array(gus), ARRAY(Text)))),
                )
            )
    return or_(
        and_(Media.media_source == "FIXED", or_(*fixed_conds)),
        and_(Media.media_source == "MOVING", or_(*moving_conds)),
    )


def _region_options(db: Session, media_source: str | None) -> list[dict]:
    """지역 필터 선택지 — 매체가 있는 시·도와 그 안의 구·군(고정매체 위치 + 이동매체 운행 지역)."""
    rows = (
        db.query(Media.media_source, Media.city, Media.district, Media.address)
        .filter(_source_filter(media_source))
        .all()
    )
    tree: dict[str, set[str]] = {}
    for source, city, district, address in rows:
        if source == "MOVING":
            canon = oa.canonical_city(city)
            if canon is None or canon == oa.NATIONWIDE:
                continue
            tree.setdefault(canon, set()).update(oa.parse_districts(district))
        else:
            canon, gu = _fixed_region_of(city, district, address)
            if canon is None:
                continue
            tree.setdefault(canon, set())
            if gu:
                tree[canon].add(gu)
    return [
        dict(sido=canon, label=oa.short_city(canon), districts=sorted(tree[canon]))
        for canon in oa.province_order()
        if canon in tree
    ]


def _media_base_query(
    db: Session,
    *,
    media_source: str | None = "FIXED",
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
    keyword: str | None = None,
    regions: list[str] | None = None,
):
    """매체 공통 필터 쿼리. 리스트·지도클러스터가 동일 조건을 공유한다.

    media_source=None 이면 고정·이동 매체를 모두 대상으로 한다.
    """
    base = db.query(Media)
    if media_source is not None:
        base = base.filter(Media.media_source == media_source)
    kw = (keyword or "").strip().lower()
    if kw:
        # 매체명(name+second_name) + 주소·지역 라벨·검색 태그를 합친 문자열에 토큰별 AND 부분일치.
        # 주소는 여러 단어라 통짜 substring이 아니라 공백 토큰마다 매칭해야 견고하다.
        searchable = func.lower(
            func.concat(
                func.coalesce(Media.name, ""),
                " ",
                func.coalesce(Media.second_name, ""),
                " ",
                func.coalesce(Media.accurate_address, ""),
                " ",
                func.coalesce(Media.address, ""),
                " ",
                func.coalesce(Media.full_address_jibun, ""),
                " ",
                func.coalesce(Media.loc_label, ""),
                " ",
                # 이동매체는 주소 대신 운행 지역·노선으로 찾는다.
                func.coalesce(Media.city, ""),
                " ",
                func.coalesce(Media.district, ""),
                " ",
                func.coalesce(Media.moving_location_detail, ""),
                " ",
                # 검색 태그(JSON 배열, 예: ["강남", "대형", "전광판"]) — 글자로 펼쳐 함께 찾는다.
                func.coalesce(cast(Media.list_labels, Text), ""),
            )
        )
        for token in kw.split():
            base = base.filter(searchable.like(f"%{token}%"))
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
    region_cond = _region_condition(regions)
    if region_cond is not None:
        base = base.filter(region_cond)
    if None not in (ne_lat, sw_lat, ne_lng, sw_lng):
        # 지도 화면 영역(bounding box) 종속 — 리스트=지도 영역.
        # 고정매체는 좌표가 영역 안에 있어야 하고, 이동매체는 운행 지역이 영역과 겹치면 된다.
        point_in = and_(
            Media.latitude.isnot(None),
            Media.longitude.isnot(None),
            Media.latitude >= sw_lat,
            Media.latitude <= ne_lat,
            Media.longitude >= sw_lng,
            Media.longitude <= ne_lng,
        )
        area_overlaps = _moving_area_overlaps(ne_lat, sw_lat, ne_lng, sw_lng)
        if media_source == "FIXED":
            base = base.filter(point_in)
        elif media_source == "MOVING":
            base = base.filter(area_overlaps)
        else:
            base = base.filter(
                or_(
                    and_(Media.media_source == "MOVING", area_overlaps),
                    and_(Media.media_source == "FIXED", point_in),
                )
            )
    return base


# 매체 찾기·관심 매체 정렬 — 프론트 MediaSortKey 와 같은 값.
# 비율 정렬(ratio-*)은 상세 팝업의 "월평균 유동인구"와 같은 상권 데이터(분기·거리 기준)로 매긴다.
MEDIA_SORT_KEYS = (
    "latest",
    "popular",
    "priceDesc",
    "priceAsc",
    "ratio-female",
    "ratio-male",
    "ratio-age10",
    "ratio-age20",
    "ratio-age30",
    "ratio-age40",
    "ratio-age50",
    "ratio-age60",
)
MEDIA_SORT_PATTERN = "^(" + "|".join(MEDIA_SORT_KEYS) + ")$"

_ad_media = table(
    "ad_media",
    column("media_id"),
    column("sangwon_code"),
    column("sangwon_distance_m"),
)
_sangwon_population = table(
    "sangwon_population",
    column("sangwon_code"),
    column("quarter_code"),
    column("total_foot_traffic"),
    column("male_foot"),
    column("female_foot"),
    column("age_10_foot"),
    column("age_20_foot"),
    column("age_30_foot"),
    column("age_40_foot"),
    column("age_50_foot"),
    column("age_60_foot"),
)
# 최신 분기를 고르는 서브쿼리용 — 같은 표를 정렬 조인과 따로 본다.
_sangwon_latest = _sangwon_population.alias("sangwon_latest")


def _population_ratio(target: str):
    """상권 유동인구에서 target(female/male/ageNN)이 차지하는 비율 식. 성별은 남+여 합 기준."""
    sp = _sangwon_population.c
    if target in ("female", "male"):
        num = sp.female_foot if target == "female" else sp.male_foot
        den = func.coalesce(sp.male_foot, 0) + func.coalesce(sp.female_foot, 0)
    else:
        num = getattr(sp, f"age_{target.removeprefix('age')}_foot")
        den = sp.total_foot_traffic
    return cast(num, Float) / func.nullif(cast(den, Float), 0)


def _apply_media_sort(base, sort: str | None, *, latest=None):
    """정렬을 건다. 같은 값끼리는 media_id 로 순서를 고정해 페이지가 겹치거나 빠지지 않게 한다.

    latest: "최신순"의 기준 열(기본은 매체 등록일). 관심 매체는 담은 시각을 넘긴다.
    """
    latest_col = latest if latest is not None else Media.created_at
    if sort == "popular":
        return base.order_by(
            Media.is_popular_yn.desc().nullslast(), latest_col.desc(), Media.media_id
        )
    if sort in ("priceDesc", "priceAsc"):
        fee = Media.min_advertisement_fee_krw
        return base.order_by(
            (fee.desc() if sort == "priceDesc" else fee.asc()).nullslast(), Media.media_id
        )
    if sort and sort.startswith("ratio-"):
        am, sp = _ad_media.c, _sangwon_population.c
        ratio = (
            select(
                am.media_id.label("sid"),
                func.max(_population_ratio(sort.removeprefix("ratio-"))).label("ratio"),
            )
            .select_from(
                _ad_media.join(
                    _sangwon_population,
                    and_(
                        sp.sangwon_code == am.sangwon_code,
                        # DB의 최신 분기(서울시 상권 유동인구, sangwon_sync 가 채운다)
                        sp.quarter_code
                        == select(func.max(_sangwon_latest.c.quarter_code)).scalar_subquery(),
                    ),
                )
            )
            .where(am.sangwon_distance_m <= SANGWON_MAX_DISTANCE_M)
            .group_by(am.media_id)
            .subquery()
        )
        return base.outerjoin(ratio, ratio.c.sid == Media.source_detail_id).order_by(
            ratio.c.ratio.desc().nullslast(), Media.media_id
        )
    return base.order_by(latest_col.desc(), Media.media_id)


# 매체 찾기 탭 — all(전체)·fixed(고정)·moving(이동) → media_source 조건.
FIND_SOURCES = {"all": None, "fixed": "FIXED", "moving": "MOVING"}
FIND_SOURCE_PATTERN = "^(all|fixed|moving)$"


def find_price_histogram(
    db: Session,
    *,
    source: str = "all",
    categories: list[str] | None = None,
    ooh_types: list[str] | None = None,
    exposure_types: list[str] | None = None,
    media_shapes: list[str] | None = None,
    product_master_types: list[str] | None = None,
    ne_lat: float | None = None,
    sw_lat: float | None = None,
    ne_lng: float | None = None,
    sw_lng: float | None = None,
    keyword: str | None = None,
    regions: list[str] | None = None,
) -> list[int]:
    """매체 찾기 가격 그래프 — 목록과 같은 조건(지도 영역·검색어·가격 외 필터)의 매체로 센다.

    탭(source)이 전체면 고정매체와 그 영역을 다니는 이동매체를 함께 센다.
    """
    base = _media_base_query(
        db,
        media_source=FIND_SOURCES[source],
        categories=categories,
        ooh_types=ooh_types,
        exposure_types=exposure_types,
        media_shapes=media_shapes,
        product_master_types=product_master_types,
        price_min=None,
        price_max=None,
        ne_lat=ne_lat,
        sw_lat=sw_lat,
        ne_lng=ne_lng,
        sw_lng=sw_lng,
        keyword=keyword,
        regions=regions,
    )
    return price_histogram(db, base)


def list_fixed_media(
    db: Session,
    *,
    limit: int,
    offset: int,
    source: str = "fixed",
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
    keyword: str | None = None,
    regions: list[str] | None = None,
    sort: str | None = None,
) -> tuple[int, list[dict], dict[str, int]]:
    """매체 찾기 목록 — (탭 매체 수, 카드, 탭별 매체 수 {all, fixed, moving}).

    source=all 이면 고정매체와 운행 범위가 지도 영역과 겹치는 이동매체를 한 목록으로 섞어
    같은 정렬로 페이지를 나눈다. 탭별 매체 수는 탭과 무관하게 같은 조건으로 센다.
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
        ne_lat=ne_lat,
        sw_lat=sw_lat,
        ne_lng=ne_lng,
        sw_lng=sw_lng,
        keyword=keyword,
        regions=regions,
    )
    by_source = dict(
        base.with_entities(Media.media_source, func.count())
        .group_by(Media.media_source)
        .all()
    )
    counts = dict(fixed=by_source.get("FIXED", 0), moving=by_source.get("MOVING", 0))
    counts["all"] = counts["fixed"] + counts["moving"]

    media_source = FIND_SOURCES[source]
    base = base.filter(
        Media.media_source == media_source
        if media_source is not None
        else Media.media_source.in_(("FIXED", "MOVING"))
    )
    total = counts[source]
    rows = (
        _apply_media_sort(base, sort)
        .options(selectinload(Media.images))
        .limit(limit)
        .offset(offset)
        .all()
    )
    return total, [_media_card(m) for m in rows], counts


# 지도 마커 클러스터링 — zoom_level 기반 그리드 셀 크기(도 단위).
# kakao 지도 레벨은 1=최대확대 … 14=최대축소. 축소(level↑)일수록 셀이 커져 더 많이 묶인다.
_CLUSTER_CELL_DEG_BASE = 0.0003
_CLUSTER_MIN_LEVEL = 1
# 이 레벨 이하(= 더 확대)에선 클러스터를 만들지 않고 개별 마커(핀)만 표시.
# 1 = 최대 확대(레벨1)일 때만 개별 핀. 레벨 2+에선 그리드 클러스터링이 줌에 따라 변한다.
_CLUSTER_DECLUSTER_LEVEL = 1


def _cluster_cell_deg(zoom_level: int) -> float:
    step = max(0, zoom_level - _CLUSTER_MIN_LEVEL)
    return _CLUSTER_CELL_DEG_BASE * (2 ** step)


def _images_by_media(db: Session, media_ids: list[str]) -> dict[str, list[str]]:
    """media_id → media_image url 목록(sort_order). 마커 카드 이미지용 일괄 조회."""
    if not media_ids:
        return {}
    rows = (
        db.query(MediaImage.media_id, MediaImage.image_url)
        .filter(MediaImage.media_id.in_(media_ids))
        .order_by(MediaImage.media_id, MediaImage.sort_order)
        .all()
    )
    out: dict[str, list[str]] = {}
    for mid, url in rows:
        out.setdefault(mid, []).append(url)
    return out


def _marker_from_row(r, lat: float, lng: float, img_map: dict) -> dict:
    name = " ".join(
        p for p in [(r.name or "").strip(), (r.second_name or "").strip()] if p
    )
    if r.is_popular_yn:
        badge = "popular"
    elif r.is_newly_built_yn:
        badge = "new"
    else:
        badge = None
    # 카드 이미지: 썸네일 우선 → media_image(sort_order), 중복 제거 최대 3장 — 검색 리스트(_media_card)와 동일.
    images: list[str] = []
    for url in img_map.get(r.media_id, []):
        if url and url not in images:
            images.append(url)
    images = images[:3]
    return dict(
        id=r.media_id,
        lat=lat,
        lng=lng,
        name=name or "-",
        categoryLarge=r.category_large,
        categorySmall=r.category_small,
        address=r.address,
        minAdvertisementFeeKrw=r.min_advertisement_fee_krw,
        minProductionFeeKrw=r.min_production_fee_krw,
        thumbnailUrl=images[0] if images else None,
        images=images,
        badge=badge,
    )


def list_fixed_clusters(
    db: Session,
    *,
    zoom_level: int,
    ne_lat: float | None = None,
    sw_lat: float | None = None,
    ne_lng: float | None = None,
    sw_lng: float | None = None,
    categories: list[str] | None = None,
    ooh_types: list[str] | None = None,
    exposure_types: list[str] | None = None,
    media_shapes: list[str] | None = None,
    product_master_types: list[str] | None = None,
    price_min: int | None = None,
    price_max: int | None = None,
    keyword: str | None = None,
    regions: list[str] | None = None,
) -> dict:
    """FIXED 매체를 zoom_level 그리드로 묶어 클러스터/마커로 반환.

    bbox(ne/sw)가 주어지면 그 영역으로 한정, None이면 전체 매체 대상.
    keyword가 주어지면 매체명 부분일치로 한정(지도=리스트 동일 조건).
    """
    base = _media_base_query(
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
        keyword=keyword,
        regions=regions,
    )
    rows = base.with_entities(
        Media.media_id,
        Media.name,
        Media.second_name,
        Media.category_large,
        Media.category_small,
        Media.address,
        Media.latitude,
        Media.longitude,
        Media.min_advertisement_fee_krw,
        Media.min_production_fee_krw,
        Media.thumbnail_url,
        Media.is_popular_yn,
        Media.is_newly_built_yn,
    ).all()

    points = [
        (r, float(r.latitude), float(r.longitude))
        for r in rows
        if r.latitude is not None and r.longitude is not None
    ]

    # 마커로 나갈 행 결정(확대 임계치 이하: 전부 개별 핀 / 그 외: 1개짜리 버킷만).
    clusters: list[dict] = []
    if zoom_level <= _CLUSTER_DECLUSTER_LEVEL:
        marker_points = points
    else:
        cell = _cluster_cell_deg(zoom_level)
        buckets: dict[tuple[int, int], list] = {}
        for r, lat, lng in points:
            key = (math.floor(lat / cell), math.floor(lng / cell))
            buckets.setdefault(key, []).append((r, lat, lng))
        marker_points = []
        for members in buckets.values():
            if len(members) == 1:
                marker_points.append(members[0])
            else:
                n = len(members)
                clusters.append(
                    dict(
                        lat=sum(m[1] for m in members) / n,
                        lng=sum(m[2] for m in members) / n,
                        count=n,
                    )
                )

    # 마커 매체 이미지 일괄 조회 → 검색 리스트와 동일한 카드 이미지(최대 3장).
    img_map = _images_by_media(db, [r.media_id for r, _, _ in marker_points])
    markers = [
        _marker_from_row(r, lat, lng, img_map) for r, lat, lng in marker_points
    ]
    return dict(clusters=clusters, markers=markers)


def _source_filter(media_source: str | None):
    """media_source=None(고정·이동 전체)이면 거르지 않는다."""
    return Media.media_source == media_source if media_source is not None else true()


def get_media_filter_options(db: Session, media_source: str | None = "FIXED") -> dict:
    """매체검색 필터 옵션 — 매체 기준 distinct 값 + 가격(최소광고비) 범위.

    media_source=None 이면 고정·이동 매체 전체 기준(매체 찾기·관심 매체).
    """

    def _distinct(col) -> list[str]:
        rows = (
            db.query(col)
            .filter(_source_filter(media_source), col.isnot(None))
            .distinct()
            .order_by(col)
            .all()
        )
        return [r[0] for r in rows]

    pmt_rows = (
        db.query(MediaPlan.product_master_type)
        .join(Media, MediaPlan.media_id == Media.media_id)
        .filter(
            _source_filter(media_source),
            MediaPlan.product_master_type.isnot(None),
        )
        .distinct()
        .order_by(MediaPlan.product_master_type)
        .all()
    )
    price_min, price_max = _price_axis(db, media_source)
    return dict(
        categories=_distinct(Media.category_large),
        ooh_types=_distinct(Media.ooh_type),
        exposure_types=_distinct(Media.exposure_type),
        media_shapes=_distinct(Media.media_shape),
        product_master_types=[r[0] for r in pmt_rows],
        price_min=price_min,
        price_max=price_max,
        price_histogram=_price_histogram(db, price_min, price_max, media_source),
        regions=_region_options(db, media_source),
    )


_PRICE_HISTOGRAM_BUCKETS = 24


def _price_axis(
    db: Session, media_source: str | None = "FIXED"
) -> tuple[int | None, int | None]:
    """가격 슬라이더 가로축 — 전체 매체의 최소광고비 최솟값·최댓값(목록 범위와 무관하게 고정)."""
    price = (
        db.query(
            func.min(Media.min_advertisement_fee_krw),
            func.max(Media.min_advertisement_fee_krw),
        )
        .filter(_source_filter(media_source))
        .first()
    )
    return (price[0], price[1]) if price else (None, None)


def _price_histogram(
    db: Session,
    price_min: int | None,
    price_max: int | None,
    media_source: str | None = "FIXED",
    base=None,
) -> list[int]:
    """min~max 가격 구간을 균등 버킷으로 나눠 버킷별 매체 수를 센다.

    base: 셀 대상 매체 쿼리(지도 영역·검색어·필터를 건 목록). 없으면 전체 매체.
    """
    if price_min is None or price_max is None or price_max <= price_min:
        return []
    if base is None:
        base = db.query(Media).filter(_source_filter(media_source))
    fees = (
        base.filter(Media.min_advertisement_fee_krw.isnot(None))
        .with_entities(Media.min_advertisement_fee_krw)
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


def price_histogram(db: Session, base) -> list[int]:
    """가격 필터 그래프 — 가로축은 전체 매체(고정·이동) 기준, 막대는 base(지금 목록) 기준으로 센다.

    가로축까지 목록마다 바뀌면 이미 고른 가격 범위가 슬라이더 밖으로 밀려나므로 축은 고정한다.
    필터 옵션(get_media_filter_options(media_source=None))의 가로축과 같은 값이다.
    """
    price_min, price_max = _price_axis(db, None)
    return _price_histogram(db, price_min, price_max, base=base)


def _plan_subtitle(p: MediaPlan) -> str | None:
    parts: list[str] = []
    device_qty = p.active_device_quantity or p.default_device_quantity
    surface_qty = p.active_surface_quantity or p.default_surface_quantity
    if device_qty and surface_qty:
        parts.append(f"{device_qty}기 {surface_qty}면")
    if p.exposure_duration_seconds:
        parts.append(f"{p.exposure_duration_seconds}초")
    duration = _duration_text(p)
    if duration:
        parts.append(duration)
    return " / ".join(parts) or None


def _manual_population(m: Media) -> dict | None:
    """어드민에서 직접 입력한 월평균 유동인구 — 인구수가 있을 때만. 비율이 비면 0으로 둔다."""
    if not m.population_count:
        return None

    def pct(v) -> float:
        return float(v) if v is not None else 0.0

    male, female = pct(m.population_male_pct), pct(m.population_female_pct)
    # 한쪽만 적었으면 나머지는 100에서 뺀다.
    if m.population_male_pct is not None and m.population_female_pct is None:
        female = max(0.0, 100 - male)
    elif m.population_female_pct is not None and m.population_male_pct is None:
        male = max(0.0, 100 - female)
    return dict(
        source="manual",
        placeName=(m.population_note or "").strip(),
        congestLevel=None,
        populationMin=int(m.population_count),
        populationMax=int(m.population_count),
        malePct=round(male),
        femalePct=round(female),
        ageRatios=[
            dict(label="10", value=pct(m.population_age_10), bound="under"),
            dict(label="20대", value=pct(m.population_age_20), bound=None),
            dict(label="30대", value=pct(m.population_age_30), bound=None),
            dict(label="40대", value=pct(m.population_age_40), bound=None),
            dict(label="50대", value=pct(m.population_age_50), bound=None),
            dict(label="60", value=pct(m.population_age_60), bound="over"),
        ],
        measuredAt=None,
    )


def _quarter_label(code: str) -> str:
    """"20254" → "2025년 4분기"."""
    return f"{code[:4]}년 {code[4:]}분기" if len(code) == 5 else code


def _sangwon_label(name: str | None) -> str:
    name = (name or "").strip()
    return name if name.endswith("상권") else f"{name} 상권"


def _sangwon_population(db: Session, source_detail_id: int | None) -> dict | None:
    """원천 상권 데이터의 월평균 유동인구 — media.source_detail_id → ad_media → 인접 상권(sangwon).

    그 상권의 가장 최신 분기(서울시 상권분석서비스, sangwon_sync 가 채운다)를 쓴다 — 새 분기에 빠진
    상권도 직전 분기 값이 보이게. 서울시 값은 분기 합계라 3으로 나눠 월평균으로 보여 준다(비율은 그대로).
    거리 초과·미매칭·유동량 0이면 None.
    """
    if source_detail_id is None:
        return None
    row = db.execute(
        text(
            """
            SELECT sp.quarter_code, sp.sangwon_name, sp.total_foot_traffic,
                   sp.male_foot, sp.female_foot,
                   sp.age_10_foot, sp.age_20_foot, sp.age_30_foot,
                   sp.age_40_foot, sp.age_50_foot, sp.age_60_foot
            FROM ad_media am
            JOIN sangwon_population sp
              ON sp.sangwon_code = am.sangwon_code
            WHERE am.media_id = :sid
              AND am.sangwon_distance_m <= :max_dist
              AND sp.total_foot_traffic > 0
            ORDER BY sp.quarter_code DESC
            LIMIT 1
            """
        ),
        {"sid": source_detail_id, "max_dist": SANGWON_MAX_DISTANCE_M},
    ).first()
    if row is None or not row.total_foot_traffic:
        return None
    monthly = round(row.total_foot_traffic / 3)

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
    return dict(
        source="sangwon",
        # 상권 이름에 "상권"이 이미 붙어 있으면(예: "성남시 상권") 다시 붙이지 않는다.
        placeName=f"{_sangwon_label(row.sangwon_name)} · {_quarter_label(row.quarter_code)}",
        congestLevel=None,
        populationMin=monthly,
        populationMax=monthly,
        malePct=male_pct,
        femalePct=(100 - male_pct) if gender_base else 0,
        ageRatios=[
            dict(label=label, value=round((val or 0) / total * 100, 1), bound=bound)
            for label, val, bound in age_buckets
        ],
        measuredAt=None,
    )


def population_fact(pop: dict | None) -> str | None:
    """믹시 매체 설명용 한 줄 — 매체 상세 응답의 population(실시간·월평균)을 글로."""
    if not pop or not pop.get("populationMax"):
        return None
    gender = f"남 {pop.get('malePct')}% / 여 {pop.get('femalePct')}%"
    if pop.get("source") == "realtime":
        lo, hi = pop.get("populationMin") or 0, pop["populationMax"]
        count = f"{hi:,}명" if lo == hi else f"{lo:,}~{hi:,}명"
        when = f" {pop['measuredAt'][11:16]} 기준" if pop.get("measuredAt") else ""
        congest = f", 혼잡도 {pop['congestLevel']}" if pop.get("congestLevel") else ""
        return f"실시간 인구({pop.get('placeName')}{when}): {count}{congest}, {gender}"
    basis = f"({pop['placeName']})" if pop.get("placeName") else ""
    return f"월평균 유동인구{basis}: {pop['populationMax']:,}명, {gender}"


def sangwon_population_of(db: Session, media_id: str) -> dict | None:
    """어드민 인구 데이터 탭 안내용 — 매체의 원천 상권 월평균 유동인구."""
    m = db.get(Media, media_id)
    return _sangwon_population(db, m.source_detail_id) if m else None


def media_population(db: Session, m: Media) -> dict | None:
    """매체 정보 팝업의 인구 — ① 실시간(서울시 121장소) ② 어드민에서 직접 입력한 월평균 유동인구
    ③ 원천 상권 데이터의 월평균 유동인구 순으로 먼저 있는 것. 이동 매체는 보여 주지 않는다."""
    if m.media_source == "MOVING":
        return None
    return (
        realtime_population(m.latitude, m.longitude)
        or _manual_population(m)
        or _sangwon_population(db, m.source_detail_id)
    )


def proposal_slide_facts(m: Media) -> dict:
    """기획안 매체 슬라이드·PPT 에 더 보여 줄 정보 — 매체 상세 팝업과 같은 표기."""
    area = _operating_area(m)
    resolution = (
        f"{m.spec_resolution_width} × {m.spec_resolution_height} px"
        if m.spec_resolution_width and m.spec_resolution_height
        else None
    )
    return dict(
        media_source=m.media_source or "FIXED",
        operating_area=area["label"] if area else None,
        operating_route=area["route"] if area else None,
        resolution=resolution,
        material_formats=(
            ", ".join(MATERIAL_FORMATS.get(f, f) for f in (m.material_formats or [])) or None
        ),
        operation=operation_text(m),
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
    add("설치 장소", _EXPOSURE_TYPE.get(m.exposure_type, m.exposure_type))
    add("판매 형태", _SALE_TYPE.get(m.sales_type, m.sales_type))
    add("고정/이동", "이동" if m.media_source == "MOVING" else "고정")
    area = _operating_area(m)
    if area:
        add("운행 지역", area["label"])
        add("운행 노선", area["route"])
    if m.device_quantity:
        add("기기 수량", f"{m.device_quantity}기")
    if m.lead_time_bizdays:
        add("리드타임", f"{m.lead_time_bizdays}영업일")
    if m.spec_resolution_width and m.spec_resolution_height:
        add("해상도", f"{m.spec_resolution_width} × {m.spec_resolution_height} px")
    add("소재 형식", ", ".join(MATERIAL_FORMATS.get(f, f) for f in (m.material_formats or [])))
    add("운영 시간", operation_text(m))

    plans = [
        dict(
            planNo=p.plan_no,
            title=p.product_display_name or p.product_name or "-",
            subtitle=_plan_subtitle(p),
        )
        for p in m.plans
        if p.product_master_type == "PM_INDIVIDUAL"
    ]
    # 매체 정보 팝업의 "안건" 옵션 — 기획안이 고르는 플랜과 같은 범위(전체 플랜, plan_no 순).
    # 프론트가 "[1안] 영상 20초, 100회, 1개월 10,000,000원"처럼 이어 붙인다.
    plan_options = [
        dict(
            planNo=p.plan_no,
            title=p.product_display_name or p.product_name or "-",
            adFeeKrw=p.advertisement_fee,
            productionFeeKrw=p.production_fee,
            exposureSeconds=p.exposure_duration_seconds,
            exposureCount=p.exposure_count,
            # 일 송출 수 — 직접 입력값 우선, 없으면 자동 계산값, 그것도 없으면 노출 횟수.
            # 원천은 모르는 값을 0으로 채워 두므로 0은 "정보 없음"(None)으로 내보낸다.
            dailyBroadcasts=(
                p.broadcasts_count_manual
                or p.broadcasts_count_auto
                or p.exposure_count
                or None
            ),
            durationText=_duration_text(p),
        )
        for p in sorted(m.plans, key=lambda p: p.plan_no)
    ]

    return dict(
        id=m.media_id,
        name=name or "-",
        mediaSource=m.media_source or "FIXED",
        badge=badge,
        minAdvertisementFeeKrw=m.min_advertisement_fee_krw,
        maxAdvertisementFeeKrw=m.max_advertisement_fee_krw,
        minProductionFeeKrw=m.min_production_fee_krw,
        categoryLarge=m.category_large,
        categorySmall=m.category_small,
        salesType=_SALE_TYPE.get(m.sales_type, m.sales_type),
        oohType=m.ooh_type,
        description=m.description,
        # 이동매체는 정해진 위치가 없어 운행 지역을 위치 자리에 보여 준다.
        address=(
            area["label"]
            if area
            else (m.accurate_address or m.address or m.full_address_jibun or None)
        ),
        thumbnailUrl=m.thumbnail_url,
        imageUrls=[img.image_url for img in m.images],
        sizeText=_size_text(m),
        features=features,
        plans=plans,
        planOptions=plan_options,
        population=media_population(db, m),
    )


def list_media(
    db: Session,
    *,
    date_from: str | None = None,
    date_to: str | None = None,
    keyword: str | None = None,
    media_type: str | None = None,
    page: int = 1,
    page_size: int = 10,
) -> tuple[int, list[dict]]:
    """등록일(createdAt) 기간·유형·키워드(매체명) 필터 + 페이지네이션. (total, items) 반환."""
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

    df = parse_date(date_from)
    dt = parse_date(date_to)
    kw = (keyword or "").strip().lower()

    def keep(r: dict) -> bool:
        if media_type and r["mediaType"] != media_type:
            return False
        if kw and kw not in r["name"].lower():
            return False
        if not in_date_range(r["createdAt"], df, dt):
            return False
        return True

    filtered = [r for r in items if keep(r)]
    return paginate(filtered, page, page_size)


# ===== admin 매체 상세/등록/수정 (media 전 컬럼) =====


def _media_columns() -> list[str]:
    """Media 모델의 전체 컬럼명(선언 순서)."""
    return [c.key for c in sa_inspect(Media).mapper.column_attrs]


def _is_blank(v) -> bool:
    return v is None or (isinstance(v, str) and v.strip() == "")


def _coerce_import_value(col, raw):
    """xlsx 셀 값을 컬럼 타입에 맞는 파이썬 값으로 변환(Y/N·JSON·날짜·숫자 문자열 포함).

    셀은 openpyxl 네이티브 타입(int/float/bool/datetime) 또는 문자열로 들어온다.
    빈 값은 None. 변환 불가 시 ValueError 를 던져 호출부가 행 단위로 처리한다.
    """
    if _is_blank(raw):
        return None
    if isinstance(raw, str):
        raw = raw.strip()

    col_type = col.type
    if isinstance(col_type, Boolean):
        if isinstance(raw, bool):
            return raw
        s = str(raw).strip().lower()
        if s in ("y", "true", "1"):
            return True
        if s in ("n", "false", "0"):
            return False
        raise ValueError(f"Y/N 값이 올바르지 않습니다: {raw!r}")
    if isinstance(col_type, JSONB):
        if isinstance(raw, (dict, list)):
            return raw
        return json.loads(raw)
    if isinstance(col_type, DateTime):
        if isinstance(raw, datetime):
            return raw
        return datetime.fromisoformat(str(raw))
    if isinstance(col_type, (Integer, BigInteger)):
        if isinstance(raw, bool):
            raise ValueError(f"정수 값이 올바르지 않습니다: {raw!r}")
        if isinstance(raw, (int, float)):
            return int(raw)
        return int(str(raw))
    if isinstance(col_type, Numeric):
        return float(raw)
    return str(raw)


_IMPORT_MAX_ERRORS = 50


def import_media_xlsx(db: Session, content: bytes) -> dict:
    """예전 영문 양식(1행 = DB 컬럼명) 일괄등록 — media_id(=No) 기준 중복 제외, 없는 행만 삽입.

    지금 양식(한글 칸 이름)은 media_excel.import_media_xlsx 가 받고, 영문 양식이면 여기로 넘긴다.

    media_id 칸이 없거나 비어 있으면 고정 F000001·이동 M000001 형식으로 자동 부여한다
    (이 경우 같은 파일을 두 번 올리면 두 번 들어간다).

    반환: {total, inserted, skipped, failed, errors}. best-effort — 행별 savepoint 로
    한 행이 실패해도 나머지는 계속 삽입한다.
    """
    from openpyxl import load_workbook

    try:
        wb = load_workbook(BytesIO(content), read_only=True, data_only=True)
    except Exception:
        raise HTTPException(status_code=400, detail="엑셀 파일을 읽을 수 없습니다.")

    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    try:
        header_row = next(rows)
    except StopIteration:
        raise HTTPException(status_code=400, detail="빈 파일입니다.")

    headers = [str(h).strip() if h is not None else "" for h in header_row]
    editable = set(_media_columns()) - _MEDIA_AUTO_COLS
    col_index = {h: i for i, h in enumerate(headers) if h in editable}
    mid_idx = headers.index("media_id") if "media_id" in headers else None
    columns = sa_inspect(Media).columns
    existing_ids = {r[0] for r in db.query(Media.media_id).all()}

    seen: set[str] = set()
    inserted = skipped = failed = 0
    errors: list[dict] = []

    def cell(row: tuple, idx: int):
        return row[idx] if idx < len(row) else None

    for row_no, row in enumerate(rows, start=2):
        if all(_is_blank(c) for c in row):
            continue

        mid_raw = cell(row, mid_idx) if mid_idx is not None else None
        # media_id 를 비우면 자동으로 매긴다(아래 저장 직전에). 이 경우 중복은 거를 수 없다.
        mid = "" if _is_blank(mid_raw) else str(mid_raw).strip()

        if mid and (mid in existing_ids or mid in seen):
            skipped += 1
            continue

        data: dict = {}
        row_error: str | None = None
        for col_name, idx in col_index.items():
            try:
                data[col_name] = _coerce_import_value(columns[col_name], cell(row, idx))
            except (ValueError, TypeError, json.JSONDecodeError) as exc:
                row_error = f"{col_name}: {exc}"
                break
        if row_error:
            failed += 1
            if len(errors) < _IMPORT_MAX_ERRORS:
                errors.append({"row": row_no, "media_id": mid, "reason": row_error})
            continue

        if _is_blank(data.get("name")):
            failed += 1
            if len(errors) < _IMPORT_MAX_ERRORS:
                errors.append({"row": row_no, "media_id": mid, "reason": "매체명(name) 누락"})
            continue

        try:
            _validate_media_values(data)
        except HTTPException as exc:
            failed += 1
            if len(errors) < _IMPORT_MAX_ERRORS:
                errors.append({"row": row_no, "media_id": mid, "reason": exc.detail})
            continue

        data["media_id"] = mid or _next_media_id(db, data.get("media_source"))
        try:
            with db.begin_nested():
                db.add(Media(**data))
                db.flush()
            inserted += 1
            seen.add(data["media_id"])
        except Exception:
            failed += 1
            if len(errors) < _IMPORT_MAX_ERRORS:
                errors.append({"row": row_no, "media_id": mid, "reason": "저장 실패"})

    db.commit()
    return {
        "total": inserted + skipped + failed,
        "inserted": inserted,
        "skipped": skipped,
        "failed": failed,
        "errors": errors,
    }


def _image_dict(img: MediaImage) -> dict:
    return dict(
        id=str(img.id),
        image_url=img.image_url,
        sort_order=img.sort_order,
        is_thumbnail=img.is_thumbnail,
    )


def _serialize_media(m: Media) -> dict:
    """Media 전 컬럼 + 이미지 목록을 JSON 친화 dict 로 직렬화."""
    data: dict = {}
    for col in _media_columns():
        val = getattr(m, col)
        data[col] = float(val) if isinstance(val, Decimal) else val
    data["images"] = [_image_dict(img) for img in m.images]
    data["plans"] = [_plan_dict(p) for p in sorted(m.plans, key=lambda p: p.plan_no)]
    return data


def _get_media_or_404(db: Session, media_id: str) -> Media:
    m = db.query(Media).filter(Media.media_id == media_id).first()
    if m is None:
        raise HTTPException(status_code=404, detail="매체를 찾을 수 없습니다.")
    return m


def get_admin_media(db: Session, media_id: str) -> dict:
    return _serialize_media(_get_media_or_404(db, media_id))


# ── 상품(media_plan) — 어드민 매체 폼에서 추가·수정·삭제 ─────────────────────

# 어드민이 고치는 상품 칸. 나머지(원천 운영 시간·디바이스 유형 등)는 손대지 않는다.
_PLAN_EDITABLE = (
    "product_display_name",
    "product_master_type",
    "contractual_duration",
    "contractual_duration_type",
    "advertisement_fee",
    "production_fee",
    "exposure_duration_seconds",
    "broadcasts_count_manual",
    "default_device_quantity",
    "default_surface_quantity",
)
_PLAN_MASTER_TYPES = {"PM_INDIVIDUAL", "PM_PACKAGE", "PM_NETWORK"}
_PLAN_DURATION_TYPES = {"YEARS", "MONTHS", "WEEKS", "DAYS"}
_PLAN_NON_NEGATIVE = (
    "advertisement_fee",
    "production_fee",
    "exposure_duration_seconds",
    "broadcasts_count_manual",
    "default_device_quantity",
    "default_surface_quantity",
)


def _plan_dict(p: MediaPlan) -> dict:
    return {"plan_no": p.plan_no, **{k: getattr(p, k) for k in _PLAN_EDITABLE}}


def _clean_plan(raw: dict, index: int, ooh_type: str | None) -> dict:
    """어드민이 보낸 상품 한 개 검사 — 잘못되면 몇 번째 상품인지 알려 준다."""
    if not isinstance(raw, dict):
        raise HTTPException(status_code=400, detail="상품 형식이 올바르지 않습니다.")
    where = f"{index}번째 상품"
    data = {k: raw.get(k) for k in _PLAN_EDITABLE}
    name = (data["product_display_name"] or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail=f"{where}: 상품명을 입력해 주세요.")
    data["product_display_name"] = name
    if data["product_master_type"] not in _PLAN_MASTER_TYPES:
        raise HTTPException(status_code=400, detail=f"{where}: 판매 방식을 골라 주세요.")
    if data["contractual_duration_type"] not in _PLAN_DURATION_TYPES:
        raise HTTPException(status_code=400, detail=f"{where}: 계약 기간 단위를 골라 주세요.")
    if not isinstance(data["contractual_duration"], int) or data["contractual_duration"] < 1:
        raise HTTPException(status_code=400, detail=f"{where}: 계약 기간은 1 이상이어야 합니다.")
    for k in _PLAN_NON_NEGATIVE:
        v = data[k]
        if v is not None and (not isinstance(v, (int, float)) or v < 0):
            raise HTTPException(status_code=400, detail=f"{where}: 금액·수량은 0 이상이어야 합니다.")
    if ooh_type == "DOOH":
        data["production_fee"] = None  # DOOH는 제작비가 없다.
    if ooh_type == "OOH":
        # 노출 시간·일 송출 수는 영상(DOOH) 송출 값이라 OOH는 저장하지 않는다.
        data["exposure_duration_seconds"] = None
        data["broadcasts_count_manual"] = None
    return data


def _sync_plans(db: Session, m: Media, raw_plans: list) -> None:
    """상품 목록을 보낸 그대로 맞춘다 — plan_no 가 있으면 고치고, 없으면 새로, 빠진 것은 지운다.

    plan_no 는 기획안(proposal_item.selected_plan_no)이 상품을 가리키는 번호라 바꾸지 않는다.
    새 상품은 이 매체에서 한 번도 쓰지 않은 번호를 받는다(지운 번호를 다시 쓰면 그 번호를 고른 기획안이
    다른 상품을 가리키게 된다).
    """
    from src.models.proposal_item import ProposalItem

    if not isinstance(raw_plans, list) or not raw_plans:
        raise HTTPException(status_code=400, detail="상품을 하나 이상 등록해 주세요.")
    cleaned = [_clean_plan(raw, i, m.ooh_type) for i, raw in enumerate(raw_plans, start=1)]
    by_no = {p.plan_no: p for p in m.plans}
    keep = {raw.get("plan_no") for raw in raw_plans if raw.get("plan_no") in by_no}
    for no, plan in by_no.items():
        if no not in keep:
            db.delete(plan)
    used = (
        db.query(func.max(ProposalItem.selected_plan_no))
        .filter(ProposalItem.media_id == m.media_id)
        .scalar()
        or 0
    )
    next_no = max([used, *by_no.keys()], default=0) + 1
    for raw, data in zip(raw_plans, cleaned):
        common = dict(
            data,
            product_name=data["product_display_name"],
            is_advertisement_fee_yn=data["advertisement_fee"] is not None,
            is_production_fee_yn=data["production_fee"] is not None,
            ooh_type=m.ooh_type,
        )
        plan = by_no.get(raw.get("plan_no"))
        if plan is not None:
            for k, v in common.items():
                setattr(plan, k, v)
        else:
            db.add(MediaPlan(media_id=m.media_id, plan_no=next_no, **common))
            next_no += 1
    db.flush()
    db.expire(m, ["plans"])


def _apply_plan_aggregates(m: Media) -> None:
    """매체의 광고비·제작비 범위, 제작비 유무, 상품 수를 상품에서 계산한다(목록 카드·필터가 쓰는 값)."""
    ads = [p.advertisement_fee for p in m.plans if p.advertisement_fee is not None]
    prods = [p.production_fee for p in m.plans if p.production_fee is not None]
    m.min_advertisement_fee_krw = min(ads) if ads else None
    m.max_advertisement_fee_krw = max(ads) if ads else None
    m.min_production_fee_krw = min(prods) if prods else None
    m.max_production_fee_krw = max(prods) if prods else None
    m.any_production_fee_yn = bool(prods)
    m.plan_count = len(m.plans)


# 매체 ID 자동 부여 — 고정 F000001, 이동 M000001(접두 1자 + 6자리 일련번호).
_MEDIA_ID_PREFIX = {"FIXED": "F", "MOVING": "M"}
_MEDIA_ID_DIGITS = 6
_MEDIA_ID_RETRIES = 5


def _next_media_id(db: Session, media_source: str | None) -> str:
    """접두(고정 F·이동 M)별 다음 일련번호. 같은 접두의 가장 큰 번호 + 1."""
    prefix = _MEDIA_ID_PREFIX.get(media_source or "FIXED", "F")
    pattern = f"^{prefix}[0-9]{{{_MEDIA_ID_DIGITS}}}$"
    last = (
        db.query(func.max(Media.media_id))
        .filter(Media.media_id.op("~")(pattern))
        .scalar()
    )
    seq = int(last[len(prefix):]) + 1 if last else 1
    return f"{prefix}{seq:0{_MEDIA_ID_DIGITS}d}"


# 음수가 될 수 없는 숫자 칸, (최소, 최대) 짝, 범위가 정해진 칸.
_NON_NEGATIVE_COLS = (
    "spec_width",
    "spec_height",
    "spec_resolution_width",
    "spec_resolution_height",
    "min_advertisement_fee_krw",
    "max_advertisement_fee_krw",
    "min_production_fee_krw",
    "max_production_fee_krw",
    "device_quantity",
    "surface_quantity",
    "properties_count",
    "lead_time_bizdays",
)
_MIN_MAX_PAIRS = (
    ("min_advertisement_fee_krw", "max_advertisement_fee_krw", "광고비"),
    ("min_production_fee_krw", "max_production_fee_krw", "제작비"),
)
_QUALITY_SCORE_RANGE = (0, 100)


_PRODUCTION_FEE_COLS = ("min_production_fee_krw", "max_production_fee_krw")


def _apply_production_fee_rule(values: dict) -> None:
    """DOOH는 제작비가 없고, 제작비 유무가 '없음'이면 제작비 금액도 비운다(어드민 폼과 같은 규칙).

    values 를 그 자리에서 고친다. 유무가 비어 있으면(정리 전 데이터) 건드리지 않는다.
    """
    if values.get("ooh_type") == "DOOH":
        values["any_production_fee_yn"] = False
    if values.get("any_production_fee_yn") is False:
        for col in _PRODUCTION_FEE_COLS:
            values[col] = None


def _validate_media_values(values: dict) -> None:
    """저장 전 값 검사 — 어드민 폼이 먼저 막지만, API 를 직접 불러도 같은 규칙을 지킨다."""
    for col in _NON_NEGATIVE_COLS:
        v = values.get(col)
        if v is not None and v < 0:
            raise HTTPException(status_code=400, detail=f"{col} 는 0 이상이어야 합니다.")
    for lo_col, hi_col, label in _MIN_MAX_PAIRS:
        lo, hi = values.get(lo_col), values.get(hi_col)
        if lo is not None and hi is not None and hi < lo:
            raise HTTPException(
                status_code=400, detail=f"최대 {label}는 최소 {label}보다 작을 수 없습니다."
            )
    score = values.get("quality_score")
    if score is not None and not (_QUALITY_SCORE_RANGE[0] <= score <= _QUALITY_SCORE_RANGE[1]):
        raise HTTPException(status_code=400, detail="품질 점수는 0~100 사이여야 합니다.")


def create_media(db: Session, payload: dict) -> dict:
    """매체 등록. media_id 는 받지 않고 고정 F000001·이동 M000001 형식으로 자동 부여한다.

    payload["plans"] 가 있으면 상품도 함께 만들고, 광고비·제작비 범위는 상품에서 계산한다.
    """
    editable = set(_media_columns()) - _MEDIA_AUTO_COLS - {"media_id"}
    data = {k: v for k, v in payload.items() if k in editable}
    raw_plans = payload.get("plans")
    if _is_blank(data.get("name")):
        raise HTTPException(status_code=400, detail="매체명은 필수입니다.")
    _apply_production_fee_rule(data)
    _apply_spec_unit(data)
    _apply_dooh_rules(data)
    _validate_media_values(data)
    # 동시에 등록하면 같은 번호가 나올 수 있어, 겹치면 다음 번호로 다시 시도한다.
    for _ in range(_MEDIA_ID_RETRIES):
        data["media_id"] = _next_media_id(db, data.get("media_source"))
        try:
            with db.begin_nested():
                m = Media(**data)
                db.add(m)
                db.flush()
            break
        except IntegrityError:
            continue
    else:
        raise HTTPException(status_code=409, detail="매체 ID를 매기지 못했습니다. 다시 시도해 주세요.")
    if raw_plans is not None:
        try:
            _sync_plans(db, m, raw_plans)
        except HTTPException:
            db.rollback()
            raise
        _apply_plan_aggregates(m)
    db.commit()
    db.refresh(m)
    return _serialize_media(m)


def update_media(db: Session, media_id: str, payload: dict) -> dict:
    m = _get_media_or_404(db, media_id)
    editable = set(_media_columns()) - _MEDIA_AUTO_COLS - {"media_id"}
    changes = {k: v for k, v in payload.items() if k in editable}
    # 일부 칸만 고쳐도 규칙은 저장될 값 전체로 본다. 제작비 규칙은 유무·매체 타입(ooh_type)을 고칠 때만 건다
    # (다른 칸만 고친 정리 전 데이터의 제작비 금액을 지우지 않게).
    merged = {col: changes.get(col, getattr(m, col)) for col in _media_columns()}
    if {"any_production_fee_yn", "ooh_type"} & changes.keys():
        _apply_production_fee_rule(merged)
        for col in ("any_production_fee_yn", *_PRODUCTION_FEE_COLS):
            changes[col] = merged[col]
    if {"spec_width", "spec_height"} & changes.keys():
        _apply_spec_unit(merged)
        changes["spec_unit"] = merged["spec_unit"]
    if {"ooh_type", "material_formats", *_DOOH_ONLY_COLS} & changes.keys():
        _apply_dooh_rules(merged)
        for col in ("material_formats", *_DOOH_ONLY_COLS):
            changes[col] = merged[col]
    _validate_media_values(merged)
    for key, value in changes.items():
        setattr(m, key, value)
    # 상품 목록을 보냈으면 맞추고, 광고비·제작비 범위를 상품에서 다시 계산한다.
    if "plans" in payload:
        try:
            _sync_plans(db, m, payload["plans"])
        except HTTPException:
            db.rollback()
            raise
        _apply_plan_aggregates(m)
    db.commit()
    db.refresh(m)
    return _serialize_media(m)


def delete_media(db: Session, media_id: str) -> None:
    db.delete(_get_media_or_404(db, media_id))
    db.commit()


_s3_client_cache = None


def _s3_client():
    """S3 클라이언트(EC2 인스턴스 역할로 인증). 최초 1회 생성 후 재사용."""
    global _s3_client_cache
    if _s3_client_cache is None:
        _s3_client_cache = boto3.client("s3", region_name=get_settings().aws_region)
    return _s3_client_cache


def _s3_public_url(bucket: str, region: str, key: str) -> str:
    return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"


def _s3_key_from_url(url: str, bucket: str) -> str | None:
    """S3 퍼블릭 URL 에서 object key 추출. 우리 버킷이 아니면(legacy /uploads 등) None."""
    marker = f"https://{bucket}.s3."
    if not url.startswith(marker) or ".amazonaws.com/" not in url:
        return None
    return url.split(".amazonaws.com/", 1)[1]


def _local_media_image_path(image_url: str) -> Path | None:
    """로컬 저장 이미지(/uploads/media/...) URL → 디스크 경로. 다른 URL 이면 None."""
    if not image_url.startswith("/uploads/media/"):
        return None
    return Path(get_settings().upload_dir) / image_url.removeprefix("/uploads/")


def add_media_image(db: Session, media_id: str, file: UploadFile) -> dict:
    """업로드 파일을 S3(로컬 개발은 upload_dir)에 저장하고 media_image 행에 URL 기록. 첫 이미지는 대표(is_thumbnail)로.

    thumbnail_url 컬럼은 건드리지 않는다(별도 텍스트 필드로 독립 관리).
    """
    m = _get_media_or_404(db, media_id)
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in _MEDIA_IMAGE_EXTS:
        raise HTTPException(status_code=400, detail="지원하지 않는 이미지 형식입니다.")
    content = file.file.read(_MEDIA_IMAGE_MAX_BYTES + 1)
    if len(content) > _MEDIA_IMAGE_MAX_BYTES:
        raise HTTPException(status_code=400, detail="이미지 용량은 10MB 이하만 가능합니다.")

    settings = get_settings()
    key = f"media/{media_id}/{uuid.uuid4().hex}{ext}"
    if settings.media_image_storage == "local":
        # 로컬 개발 — S3 대신 upload_dir 에 저장하고 /uploads 로 내려준다(main.py 의 StaticFiles).
        dest = Path(settings.upload_dir) / key
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(content)
        image_url = f"/uploads/{key}"
    else:
        _s3_client().put_object(
            Bucket=settings.s3_bucket,
            Key=key,
            Body=content,
            ContentType=_MEDIA_IMAGE_CONTENT_TYPES.get(ext, "application/octet-stream"),
        )
        image_url = _s3_public_url(settings.s3_bucket, settings.aws_region, key)

    next_order = max((img.sort_order for img in m.images), default=-1) + 1
    is_first = len(m.images) == 0
    db.add(
        MediaImage(
            media_id=media_id,
            image_url=image_url,
            sort_order=next_order,
            is_thumbnail=is_first,
        )
    )
    m.image_count = len(m.images) + 1
    db.commit()
    db.refresh(m)
    return _serialize_media(m)


def delete_media_image(db: Session, media_id: str, image_id: str) -> dict:
    m = _get_media_or_404(db, media_id)
    img = (
        db.query(MediaImage)
        .filter(MediaImage.id == image_id, MediaImage.media_id == media_id)
        .first()
    )
    if img is None:
        raise HTTPException(status_code=404, detail="이미지를 찾을 수 없습니다.")
    was_thumb = img.is_thumbnail
    image_url = img.image_url
    db.delete(img)
    db.flush()
    if was_thumb:
        remaining = (
            db.query(MediaImage)
            .filter(MediaImage.media_id == media_id)
            .order_by(MediaImage.sort_order)
            .first()
        )
        if remaining:
            remaining.is_thumbnail = True
    m.image_count = (
        db.query(func.count(MediaImage.id)).filter(MediaImage.media_id == media_id).scalar()
    )
    db.commit()

    # DB 삭제 후 S3 객체(로컬 저장이면 파일) 정리(legacy /uploads·외부 URL 은 스킵). 실패해도 요청은 성공 처리(고아 객체는 무해).
    settings = get_settings()
    key = _s3_key_from_url(image_url, settings.s3_bucket)
    if key:
        try:
            _s3_client().delete_object(Bucket=settings.s3_bucket, Key=key)
        except Exception:
            pass
    local_path = _local_media_image_path(image_url)
    if local_path is not None:
        local_path.unlink(missing_ok=True)

    db.refresh(m)
    return _serialize_media(m)


def set_media_thumbnail(db: Session, media_id: str, image_id: str) -> dict:
    """대표 이미지 지정 — 대표 표시(is_thumbnail)를 옮기고 그 사진을 맨 앞(sort_order 0)으로 올린다.

    카드·지도 팝업은 사진 순서를, 기획안은 대표 표시를 먼저 보므로 둘 다 맞춰 같은 사진이 대표가 되게 한다.
    """
    m = _get_media_or_404(db, media_id)
    target = next((img for img in m.images if str(img.id) == image_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="이미지를 찾을 수 없습니다.")
    ordered = [target] + [img for img in m.images if img is not target]
    for order, img in enumerate(ordered):
        img.sort_order = order
        img.is_thumbnail = img is target
    db.commit()
    db.refresh(m)
    return _serialize_media(m)


def admin_media_field_options(db: Session) -> dict:
    """어드민 매체 폼 선택지 — 지금 매체들에 들어 있는 값으로 만든다(새 값은 폼에서 직접 추가).

    categories: 대분류 → 소분류 목록, grade_methods: 등급 산정 방식.
    """
    categories: dict[str, list[str]] = {}
    pairs = (
        db.query(Media.category_large, Media.category_small)
        .filter(Media.category_large.isnot(None))
        .distinct()
        .order_by(Media.category_large, Media.category_small)
        .all()
    )
    for large, small in pairs:
        smalls = categories.setdefault(large, [])
        if small and small not in smalls:
            smalls.append(small)
    grade_methods = [
        r[0]
        for r in db.query(Media.grade_method)
        .filter(Media.grade_method.isnot(None))
        .distinct()
        .order_by(Media.grade_method)
        .all()
    ]
    return dict(categories=categories, grade_methods=grade_methods)
