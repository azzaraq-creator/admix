"""제휴사 협약 이력(099) — 협약서에 서명할 때마다 한 줄씩 쌓는다(2026-11-19 사용자: "재협약 할 경우 로그가 쌓이는 거야?" → "기록만 남기기").

users 의 partner_* 칸은 "지금 협약" 하나만 들고 다시 서명하면 덮어쓰므로, 지난 협약 기록은 여기에 남긴다.
지난 판 원문은 보관하지 않는다(기록만) — 그때 PDF 를 다시 만들 수는 없다.
해지(096)는 그 협약 줄에도 같이 적는다(가장 최근 줄).
"""
from __future__ import annotations

import uuid

from sqlalchemy import Column, Date, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID

from src.database import Base


class PartnerAgreementRecord(Base):
    __tablename__ = "partner_agreement_record"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    agreement_no = Column(String(40), nullable=True)  # 문서번호(097 · 098 전 협약은 없다)
    version = Column(String(20), nullable=True)  # 협약서 판
    requested_at = Column(DateTime(timezone=True), nullable=True)  # 요청일시
    started_at = Column(DateTime(timezone=True), nullable=True)  # 작성일시
    agreed_at = Column(DateTime(timezone=True), nullable=False)  # 체결일시(서명 접수)
    signer_name = Column(String(100), nullable=True)
    signer_role = Column(String(20), nullable=True)
    signature_url = Column(String(500), nullable=True)
    signed_ip = Column(String(64), nullable=True)
    termination_requested_at = Column(DateTime(timezone=True), nullable=True)  # 해지 누른 시각(096)
    termination_effective_on = Column(Date, nullable=True)  # 끝나는 날(KST, 그날부터 효력 없음)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
