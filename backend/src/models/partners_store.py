"""제휴사(콜라보) 매장 — 제휴사 회원이 /partners 대시보드에서 등록하고, 광고주가 콜라보할 매장를 찾아본다.

매장을 저장하면 매체 찾기에 보이도록 media 표에 "콜라보" 카테고리 줄을 함께 만든다(media_id, CF-0001).
그 줄은 partners_service.sync_media 가 매장 값으로 덮어쓴다 — 어드민 매체 관리·AI 추천에는 나오지 않는다.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from src.database import Base


# 매체 찾기에서 콜라보 매장이 쓰는 카테고리(대) — media_service·ai_index 가 같은 값을 쓴다.
PARTNERS_MEDIA_CATEGORY = "콜라보"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PartnersStore(Base):
    __tablename__ = "cafe_store"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # 등록한 제휴사 회원 — 어드민이 직접 만든 매장은 비어 있을 수 있다.
    owner_user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # 매체 찾기에 보이는 media 줄(CF-0001). 숨김이거나 좌표가 없으면 비어 있다.
    media_id = Column(
        String(20), ForeignKey("media.media_id", ondelete="SET NULL"), nullable=True, unique=True
    )
    name = Column(String(200), nullable=False)
    address = Column(String(500), nullable=False)  # 도로명 주소
    address_detail = Column(String(200), nullable=True)
    city = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    latitude = Column(Numeric(10, 7), nullable=True)
    longitude = Column(Numeric(10, 7), nullable=True)
    image_urls = Column(JSONB, nullable=False, default=list, server_default="[]")  # 최대 10장, 첫 장이 대표
    phone = Column(String(30), nullable=True)  # 매장 전화 또는 사장님 휴대폰
    owner_name = Column(String(100), nullable=True)
    tags = Column(JSONB, nullable=False, default=list, server_default="[]")  # 매장 어필, 최대 3개
    business_hours = Column(String(300), nullable=True)
    status = Column(String(20), nullable=False, default="active", server_default="active")  # active/hidden
    admin_memo = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    owner = relationship("User")
