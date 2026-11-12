"""관심 매체 — 회원이 하트로 저장한 매체(users 1:N).

회원 전용(비회원은 로그인 창으로 보낸다). media_id 는 media.media_id 키.
같은 회원이 같은 매체를 두 번 담지 않도록 (member_id, media_id) 유니크.
memo — 담은 매체마다 남기는 메모(최대 500자, 080). 지금은 광고주 콜라보 "관심 매장" 카드 아래에서 쓴다.
하트를 끄면(행 삭제) 메모도 같이 사라진다.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from src.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MediaFavorite(Base):
    __tablename__ = "media_favorite"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    member_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    media_id = Column(
        String(20),
        ForeignKey("media.media_id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    memo = Column(String(500), nullable=True)

    __table_args__ = (
        UniqueConstraint("member_id", "media_id", name="uq_media_favorite_member_media"),
    )
