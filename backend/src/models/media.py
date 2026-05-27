"""Media tables for Recommend V2 — keywords (Sheet2) and media items (Sheet1)."""
from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from src.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class KeywordCategory(str, enum.Enum):
    IND = "IND"   # 업종
    PRD = "PRD"   # 제품
    OBJ = "OBJ"   # 목적
    TGT = "TGT"   # 타깃
    LOC = "LOC"   # 지역
    CAT = "CAT"   # 카테고리 (detail.mediaItemCategory.displayValue)


class MediaKeyword(Base):
    """Sheet2 키워드 사전: IND/PRD/OBJ/TGT/LOC 코드 + 키워드 목록."""

    __tablename__ = "media_keywords"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category = Column(Enum(KeywordCategory, name="media_keyword_category"), nullable=False, index=True)
    code = Column(String(20), nullable=False, index=True)   # e.g. "IND-01"
    keywords = Column(JSONB, nullable=False)                # e.g. ["금융", "은행", "시중은행"]
    description = Column(String(500), nullable=True)        # e.g. "금융 관련 업종"
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    __table_args__ = (
        Index("ix_media_keywords_category_code", "category", "code", unique=True),
    )


class MediaItem(Base):
    """Sheet1 매체 데이터."""

    __tablename__ = "media_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # 매체 식별
    media_source = Column(String(50), nullable=False, index=True)   # e.g. "FIXED"
    name = Column(String(200), nullable=False)                    # e.g. "신사 BK빌딩"
    # 가격/이미지
    advertisement_fee = Column(String(50), nullable=True)         # 원화 문자열 "10000000"
    thumbnail_url = Column(String(500), nullable=True)
    all_image_urls = Column(Text, nullable=True)                   # "url1 | url2"
    # 라벨 코드 배열 (Sheet2 코드 참조)
    ind_codes = Column(JSONB, nullable=False, default=list)         # ["IND-05", "IND-03"]
    prd_codes = Column(JSONB, nullable=False, default=list)         # ["PRD-06"]
    obj_codes = Column(JSONB, nullable=False, default=list)         # ["OBJ-03"]
    tgt_codes = Column(JSONB, nullable=False, default=list)         # ["TGT-30"]
    loc_codes = Column(JSONB, nullable=False, default=list)         # ["LOC-01"]
    cat_codes = Column(JSONB, nullable=False, default=list)         # ["CAT-01"]
    # 원본 라벨 문자열 (임포트 시 원문 보존)
    raw_ind = Column(Text, nullable=True)
    raw_prd = Column(Text, nullable=True)
    raw_obj = Column(Text, nullable=True)
    raw_tgt = Column(Text, nullable=True)
    raw_loc = Column(Text, nullable=True)
    raw_cat = Column(Text, nullable=True)   # detail.mediaItemCategory.displayValue 원문
    # 메타
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    __table_args__ = (
        Index("ix_media_items_ind_codes", "ind_codes", postgresql_using="gin"),
        Index("ix_media_items_prd_codes", "prd_codes", postgresql_using="gin"),
        Index("ix_media_items_obj_codes", "obj_codes", postgresql_using="gin"),
        Index("ix_media_items_tgt_codes", "tgt_codes", postgresql_using="gin"),
        Index("ix_media_items_loc_codes", "loc_codes", postgresql_using="gin"),
        Index("ix_media_items_cat_codes", "cat_codes", postgresql_using="gin"),
    )
