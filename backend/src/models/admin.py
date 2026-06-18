"""관리자 모델 — 설계서 §3.4 `admin`.

어드민 로그인 계정. 메뉴별 접근 권한(admin_permission)은 별도 테이블(미생성).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Admin(Base):
    __tablename__ = "admin"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=True)
    name = Column(String(100), nullable=True)
    account_type = Column(String(50), nullable=True)
    department = Column(String(100), nullable=True)
    phone = Column(String(30), nullable=True)
    status = Column(String(20), nullable=False, default="active")
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    faqs = relationship("Faq", back_populates="creator")
