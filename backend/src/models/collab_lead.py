"""콜라보 영업 DB(071) — 가입 전 제휴사(매장) 영업 기록. 원본 영업 앱(sales_records · sales_settings)을 옮겨 왔다.

칸 이름은 collab_lead_setting(원본 sales_settings 의 columns · customFields)을 따른다.
사용자 정의 칸(cf_*)은 custom 에 원본 값 그대로(숫자 칸에 글이 들어 있어도 고치지 않는다).
"""
from __future__ import annotations

import uuid

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from src.database import Base


class CollabLead(Base):
    __tablename__ = "collab_lead"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id = Column(String(64), unique=True, nullable=True)  # 원본 id — 다시 가져오면 같은 줄을 덮는다
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")  # 원본 파일 순서
    visit_date = Column(Date, nullable=True, index=True)  # 방문일(date)
    name = Column(String(200), nullable=False)  # 업체명
    region = Column(String(100), nullable=True)  # 지역
    address = Column(String(300), nullable=True)  # 주소
    biz_type = Column(String(100), nullable=True)  # 업체 유형(type)
    grade = Column(String(20), nullable=True)  # 기존 DB 등급
    purposes = Column(JSONB, nullable=False, default=list, server_default="[]")  # 방문 목적
    contacts = Column(JSONB, nullable=False, default=list, server_default="[]")  # 담당자 컨택 여부
    reactions = Column(JSONB, nullable=False, default=list, server_default="[]")  # 현장 반응
    potential = Column(String(50), nullable=True)  # 영업 가능성
    status = Column(String(100), nullable=True, index=True)  # 진행 상태
    followup_date = Column(Date, nullable=True)  # 후속 일정
    owner = Column(String(100), nullable=True)  # 담당자(admix 영업 담당)
    note = Column(Text, nullable=True)  # 비고
    revisit = Column(Boolean, nullable=False, default=False, server_default="false")  # 재방문(원본 yes/no)
    contact_name = Column(String(100), nullable=True)  # 매장 담당자 이름
    contact_title = Column(String(100), nullable=True)  # 직함
    contact_phone = Column(String(100), nullable=True)
    contact_email = Column(String(200), nullable=True)
    contact_other = Column(Text, nullable=True)  # 기타 연락처
    conversation = Column(Text, nullable=True)  # 대화 내용
    followup_memo = Column(Text, nullable=True)  # 후속 메모
    photo_ids = Column(JSONB, nullable=False, default=list, server_default="[]")  # 원본 앱 사진 id(파일은 없음)
    # 매장 사진(088) — [{url, kind, memo, uploadedAt}], 협업 확정 매장 사진과 같은 분류. 확정하면 매장 사진으로 옮겨진다.
    photos = Column(JSONB, nullable=False, default=list, server_default="[]")
    custom = Column(JSONB, nullable=False, default=dict, server_default="{}")  # 사용자 정의 칸 값(cf_*)
    source_data = Column(JSONB, nullable=True)  # 가져올 때의 원본 행 전체
    # 가입한 제휴사 회원(072) — 상세 맨 위 "회원 검색"에서 고른다. 회원을 지우면 연결만 풀린다.
    partner_user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # 협업 확정으로 만든 매장(076) — 확정해도 영업 기록 목록엔 남는다(11-12). 매장을 지우면 연결만 풀린다.
    store_id = Column(
        UUID(as_uuid=True), ForeignKey("cafe_store.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # 광고주 지도(090, 2026-11-13 사용자 — 협업 확정 전 매장도 지도에) — 주소(없으면 지번주소)를 화면이 카카오 지도로 찾은 위치.
    latitude = Column(Numeric(10, 7), nullable=True)
    longitude = Column(Numeric(10, 7), nullable=True)
    city = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    # 업체 유형(biz_type)을 맞춘 매장 유형(카페 · 식당 …) — 매장 찾기 유형 탭. 지도 줄을 맞출 때 같이 정한다.
    store_type_id = Column(Integer, ForeignKey("cafe_store_type.id", ondelete="SET NULL"), nullable=True)
    # 지도용 media 줄(CF-0001). 협업 확정 매장이 지도에 뜨면 그 매장이 이 줄(매체 ID)을 이어받고 여기는 비운다.
    media_id = Column(String(20), ForeignKey("media.media_id", ondelete="SET NULL"), nullable=True, unique=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    partner = relationship("User", foreign_keys=[partner_user_id], lazy="selectin")
    store = relationship("PartnersStore", foreign_keys=[store_id], lazy="selectin")
    store_type = relationship("PartnersStoreType", foreign_keys=[store_type_id], lazy="selectin")


class CollabLeadSetting(Base):
    """칸 설정 한 줄(id=1) — columns: [{key, label, visible}], custom_fields: [{key, type, label, section, visible, required}]."""

    __tablename__ = "collab_lead_setting"

    id = Column(Integer, primary_key=True)
    columns = Column(JSONB, nullable=False, default=list, server_default="[]")
    custom_fields = Column(JSONB, nullable=False, default=list, server_default="[]")
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
