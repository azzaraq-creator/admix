"""관리자 리프레시 토큰 모델 — admin 자동로그인/세션 유지용.

user.RefreshToken 과 동일 패턴(회전·재사용 탐지·폐기)이나 FK 는 admin 을 향한다.
원본 토큰은 저장하지 않고 SHA-256 해시만 저장.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AdminRefreshToken(Base):
    __tablename__ = "admin_refresh_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token = Column(String(512), nullable=False, unique=True, index=True)
    admin_id = Column(
        UUID(as_uuid=True), ForeignKey("admin.id", ondelete="CASCADE"), nullable=False
    )
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    admin = relationship("Admin", back_populates="refresh_tokens")
