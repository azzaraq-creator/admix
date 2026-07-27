"""맞춤제안(counter-proposal) 파일 이력 — proposal 1:N.

전송할 때마다 새 버전이 한 행씩 쌓인다. proposal.counter_proposal_file_url 은
가장 최근 버전을 가리키는 포인터로 함께 갱신된다.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ProposalCounterFile(Base):
    __tablename__ = "proposal_counter_file"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    proposal_id = Column(
        UUID(as_uuid=True),
        ForeignKey("proposal.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    file_url = Column(String(1000), nullable=False)
    file_name = Column(String(500), nullable=False)
    title = Column(String(500), nullable=True)
    author_name = Column(String(100), nullable=True)
    slides_url = Column(String(1000), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    proposal = relationship("Proposal", back_populates="counter_files")
