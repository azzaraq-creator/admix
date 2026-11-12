"""광고주 콜라보 의뢰(081) — 광고주가 콜라보 화면 "새 콜라보 의뢰"에서 보낸 의뢰서(2026-11-11 사용자).

보내기 전에 확인 창에서 "확실해요"를 체크하고 보낸다. 어드민 "콜라보 의뢰"에서 서류(의뢰서)처럼 읽는다.
광고주 화면의 진행 단계(모집 · 확정 · 입금 …)는 아직 예시 데이터라, 여기엔 보낸 내용과 그때 계산한 예상 비용 · 일정만 남긴다.

- items: 고른 기본안 [{key, prep, note}] — key 는 promo · consumable · goods · display · menu · space,
  prep 은 ready(준비되어 있어요) · made(제작 예정이에요) · admix(admix에 제작을 맡길게요).
- preferred: 지정 희망 매장 — 보낼 때 서버가 매장 표에서 이름 · 지역 · 등급 · 금액을 찾아 그대로 적어 둔다(나중에 매장이 바뀌어도 의뢰 당시 값).
- estimate · schedule: 광고주 화면이 그때 보여 준 예상 비용 · 예상 일정(참고용).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from src.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AdvertiserCollabRequest(Base):
    __tablename__ = "advertiser_collab_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # 문서 번호 — CR-YYMMDD-NN(보낸 날 KST 기준 순번).
    code = Column(String(20), nullable=False, unique=True)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    brand_id = Column(
        UUID(as_uuid=True), ForeignKey("advertiser_brands.id", ondelete="SET NULL"), nullable=True
    )
    brand_name = Column(String(100), nullable=False)
    brand_image_url = Column(String(500), nullable=True)
    title = Column(String(30), nullable=False)
    summary = Column(String(100), nullable=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    # 콜라보 담당자 — 전화번호는 숫자만.
    contact_name = Column(String(10), nullable=False)
    contact_phone = Column(String(20), nullable=False)
    contact_role = Column(String(20), nullable=False)
    items = Column(JSONB, nullable=False, default=list)
    extra_plan = Column(Text, nullable=True)
    plan_file_url = Column(String(500), nullable=True)
    plan_file_name = Column(String(255), nullable=True)
    plan_file_size = Column(Integer, nullable=True)
    course = Column(String(20), nullable=False)  # standard(14일) · rush(7일)
    min_stores = Column(Integer, nullable=False)
    target_stores = Column(Integer, nullable=False)
    preferred = Column(JSONB, nullable=False, default=list)
    memo = Column(Text, nullable=True)
    estimate = Column(JSONB, nullable=True)
    schedule = Column(JSONB, nullable=True)
    # submitted(접수) · proposed(admix 기획안 보냄, 085) · revised(광고주가 고쳐 보냄) · confirmed(광고주 확정) ·
    # cancelled(광고주가 취소, 084). 이 줄은 광고주가 처음 보낸 의뢰서 그대로 두고, 고친 내용은 차수 표에 쌓는다.
    status = Column(String(20), nullable=False, default="submitted")
    # 광고주가 의뢰를 취소한 때(084) — 지우지 않고 내 콜라보 · 어드민에 "취소"로 남긴다.
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    # 광고주가 admix 기획안을 확인(확정)한 때(085).
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    # 어드민이 처음 연 때 — 비어 있으면 사이드 메뉴 "콜라보 의뢰" 옆 숫자에 센다.
    admin_viewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    # 기획안 차수(085) — 1차부터 순서대로. 0차(처음 의뢰서)는 이 줄 자체.
    rounds = relationship(
        "AdvertiserCollabRequestRound",
        order_by="AdvertiserCollabRequestRound.round_no",
        lazy="selectin",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class AdvertiserCollabRequestRound(Base):
    """기획안 차수(085) — admix가 의뢰를 항목별로 고쳐 보내거나, 광고주가 그걸 다시 고쳐 보낼 때마다 한 줄.

    content 는 그 차수의 의뢰 내용 전부(캠페인명 · 기간 · 코스 · 매장 수 · 기본안 · 추가 기획 · 지정 희망 매장 · 예상 비용 · 일정),
    notes 는 항목별 수정 이유 {항목 키: 글}, changed 는 비교 기준(base_round_no) 차수와 달라진 항목 키 목록.
    항목 키: title · summary · period · course · stores · item:<기본안 키> · extraPlan · preferred.
    """

    __tablename__ = "advertiser_collab_request_rounds"
    __table_args__ = (UniqueConstraint("request_id", "round_no", name="uq_collab_request_round_no"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id = Column(
        UUID(as_uuid=True),
        ForeignKey("advertiser_collab_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    round_no = Column(Integer, nullable=False)
    author = Column(String(20), nullable=False)  # admix · advertiser
    base_round_no = Column(Integer, nullable=False, default=0)
    content = Column(JSONB, nullable=False)
    notes = Column(JSONB, nullable=False, default=dict)
    changed = Column(JSONB, nullable=False, default=list)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("admin.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
