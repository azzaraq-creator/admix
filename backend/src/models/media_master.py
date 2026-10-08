"""매체 마스터 모델 — 설계서 docs/policies/database-design.md §2.1 `media`.

엑셀(01_매체마스터) 한 행 = 한 매체. 반복그룹(plan/prop)·유동인구·라벨·이미지는
자식 테이블로 분리 예정이며, 이 테이블은 단일값 컬럼만 보관한다.
loc_code(→location_label), market_profile_id(→market_profile) FK 는 대상 테이블
생성 후 연결한다(현재는 plain 컬럼).
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from src.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Media(Base):
    __tablename__ = "media"

    media_id = Column(String(20), primary_key=True)
    source_detail_id = Column(BigInteger, nullable=True, unique=True)
    name = Column(String(300), nullable=True)
    second_name = Column(String(200), nullable=True)
    building_name = Column(String(300), nullable=True)
    category_small = Column(String(200), nullable=True)
    category_large = Column(String(200), nullable=True)
    category_id = Column(Integer, nullable=True)
    parent_category_code = Column(String(50), nullable=True)
    ooh_type = Column(String(50), nullable=True)
    exposure_type = Column(String(50), nullable=True)
    sales_type = Column(String(100), nullable=True)
    media_source = Column(String(50), nullable=True)
    loc_code = Column(String(20), nullable=True, index=True)
    loc_label = Column(String(200), nullable=True)
    market_profile_id = Column(BigInteger, nullable=True)
    market_area = Column(String(200), nullable=True)
    market_dong = Column(String(100), nullable=True)
    legal_dong = Column(String(100), nullable=True)
    accurate_address = Column(String(500), nullable=True)
    full_address_jibun = Column(String(500), nullable=True)
    address = Column(String(500), nullable=True)
    address_detail = Column(String(500), nullable=True)
    district = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    latitude = Column(Numeric, nullable=True)
    longitude = Column(Numeric, nullable=True)
    market_keyword = Column(String(300), nullable=True)
    moving_location_detail = Column(String(500), nullable=True)
    audience_summary = Column(Text, nullable=True)
    min_advertisement_fee_krw = Column(BigInteger, nullable=True)
    max_advertisement_fee_krw = Column(BigInteger, nullable=True)
    min_production_fee_krw = Column(BigInteger, nullable=True)
    max_production_fee_krw = Column(BigInteger, nullable=True)
    production_fees_summary = Column(Text, nullable=True)
    any_production_fee_yn = Column(Boolean, nullable=True)
    plan_count = Column(Integer, nullable=True)
    execution_status = Column(String(50), nullable=True)
    lead_time_bizdays = Column(Integer, nullable=True)
    device_quantity = Column(Integer, nullable=True)
    surface_quantity = Column(Integer, nullable=True)
    # 규격 — 가로·세로(m, spec_unit 은 항상 "m"), DOOH 화면 해상도(px).
    spec_width = Column(Numeric, nullable=True)
    spec_height = Column(Numeric, nullable=True)
    spec_unit = Column(String(10), nullable=True)
    spec_resolution_width = Column(Integer, nullable=True)
    spec_resolution_height = Column(Integer, nullable=True)
    # 소재 형식 코드 목록 — MP4(영상), IMAGE(스틸컷 JPG·PNG)
    material_formats = Column(JSONB(none_as_null=True), nullable=True)
    # DOOH 운영 시간 — "06:00" ~ "24:00"(종료가 시작보다 이르면 다음 날까지).
    operation_start_time = Column(String(5), nullable=True)
    operation_end_time = Column(String(5), nullable=True)
    # 수동 인구 — 실시간 인구(서울시 121장소)를 가져올 수 없을 때 매체 정보 팝업에 보여 준다.
    # 비율은 %(연령 10 = 10대 이하, 60 = 60대 이상).
    population_count = Column(Integer, nullable=True)
    population_note = Column(String(100), nullable=True)
    population_male_pct = Column(Numeric, nullable=True)
    population_female_pct = Column(Numeric, nullable=True)
    population_age_10 = Column(Numeric, nullable=True)
    population_age_20 = Column(Numeric, nullable=True)
    population_age_30 = Column(Numeric, nullable=True)
    population_age_40 = Column(Numeric, nullable=True)
    population_age_50 = Column(Numeric, nullable=True)
    population_age_60 = Column(Numeric, nullable=True)
    media_shape = Column(String(100), nullable=True)
    media_shape_summary = Column(Text, nullable=True)
    properties_count = Column(Integer, nullable=True)
    properties_summary = Column(Text, nullable=True)
    properties_extra_json = Column(JSONB(none_as_null=True), nullable=True)
    final_grade = Column(String(1), nullable=True, index=True)
    feature = Column(String(100), nullable=True)
    quality_score = Column(Numeric, nullable=True)
    gangnam_dong_grade = Column(String(1), nullable=True)
    gangnam_grade_reason = Column(Text, nullable=True)
    grade_method = Column(String(100), nullable=True)
    grade_evidence = Column(Text, nullable=True)
    area_evidence = Column(Text, nullable=True)
    ind_evidence = Column(Text, nullable=True)
    thumbnail_url = Column(String(1000), nullable=True)
    image_count = Column(Integer, nullable=True)
    is_newly_built_yn = Column(Boolean, nullable=True)
    is_popular_yn = Column(Boolean, nullable=True)
    # 인기 업종 — 쉼표로 여러 개(예: "패션,화장품").
    popular_type = Column(String(300), nullable=True)
    special_remarks = Column(Text, nullable=True)
    children_count = Column(Integer, nullable=True)
    device_type = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    markers_vo = Column(JSONB(none_as_null=True), nullable=True)
    properties_type = Column(String(50), nullable=True)
    road_view_heading = Column(Numeric, nullable=True)
    road_view_latitude = Column(Numeric, nullable=True)
    road_view_longitude = Column(Numeric, nullable=True)
    road_view_pitch = Column(Numeric, nullable=True)
    map_bounds_vo = Column(JSONB(none_as_null=True), nullable=True)
    recommended_media_items = Column(JSONB(none_as_null=True), nullable=True)
    list_labels = Column(JSONB(none_as_null=True), nullable=True)
    company_media_id = Column(BigInteger, nullable=True)
    company_mapper_user_id = Column(BigInteger, nullable=True)
    source_created_at = Column(DateTime(timezone=True), nullable=True)
    source_updated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    images = relationship(
        "MediaImage",
        back_populates="media",
        cascade="all, delete-orphan",
        order_by="MediaImage.sort_order",
    )
    plans = relationship(
        "MediaPlan",
        back_populates="media",
        cascade="all, delete-orphan",
        order_by="MediaPlan.plan_no",
    )
