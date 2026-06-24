"""제안서에 담긴 개별 매체 — proposal 1:N.

매체 마스터(media)의 스냅샷(name/price/thumbnail)을 담는다. media_id 는 media.media_id 키.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ProposalItem(Base):
    __tablename__ = "proposal_item"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    proposal_id = Column(
        UUID(as_uuid=True),
        ForeignKey("proposal.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    media_id = Column(String(20), nullable=False)  # media.media_id
    name = Column(String(300), nullable=True)
    price = Column(BigInteger, nullable=True)  # min_advertisement_fee_krw 스냅샷
    thumbnail_url = Column(String(1000), nullable=True)
    position = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    proposal = relationship("Proposal", back_populates="items")

    __table_args__ = (
        UniqueConstraint("proposal_id", "media_id", name="uq_proposal_item_media"),
    )
