"""자주 묻는 질문 모델 — 설계서 §3.7 `faq`.

어드민에서 입력하는 정적 콘텐츠. 문의(inquiry)와는 별개.
created_by 는 admin 테이블 생성 후 FK 로 연결한다(현재는 plain 컬럼).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from src.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Faq(Base):
    __tablename__ = "faq"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    faq_type = Column(String(50), nullable=True)
    title = Column(String(300), nullable=False)
    content = Column(Text, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    is_published = Column(Boolean, nullable=False, default=True)
    created_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)
