"""제휴사(콜라보) 매장 — admix 담당자가 어드민 "콜라보 → 매장 관리"에서 등록하고, 제휴사 회원(고유번호 P-0001)과 잇는다.
제휴사는 내 매장에서 보기만 하고, 고칠 곳은 "수정 요청"(PartnersStoreRequest)으로 보낸다. 광고주는 콜라보할 매장을 찾아본다.

매장을 저장하면 매체 찾기에 보이도록 media 표에 "콜라보" 카테고리 줄을 함께 만든다(media_id, CF-0001).
그 줄은 partners_service.sync_media 가 매장 값으로 덮어쓴다 — 어드민 매체 관리·AI 추천에는 나오지 않는다.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from src.database import Base


# 매체 찾기에서 콜라보 매장이 쓰는 카테고리(대) — media_service·ai_index 가 같은 값을 쓴다.
PARTNERS_MEDIA_CATEGORY = "콜라보"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PartnersStoreType(Base):
    """매장 유형(카페 · 식당 …) — 유형마다 "매장 어필" 칩 값과 자주 쓰는 "조건 메모" 값을 둔다(070).
    어드민 "콜라보 → 매장 항목"에서 관리하고, 매장 폼은 고른 유형의 값을 칩으로 보여 준다(직접 입력도 된다)."""

    __tablename__ = "cafe_store_type"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(20), nullable=False, unique=True)
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")
    tags = Column(JSONB, nullable=False, default=list, server_default="[]")  # 매장 어필 칩 값
    notes = Column(JSONB, nullable=False, default=list, server_default="[]")  # 자주 쓰는 조건 메모
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)


class PartnersStore(Base):
    __tablename__ = "cafe_store"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # 매장 ID(S-0001) — 담당자가 미리 등록해 두고, 제휴사 회원 고유번호와 이 번호로 잇는다(069).
    store_code = Column(String(12), nullable=True, unique=True)
    # 연결된 제휴사 회원 — 한 회원이 매장 여러 곳을 가질 수 있다. 아직 연결 전이면 비어 있다.
    owner_user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # 매체 찾기에 보이는 media 줄(CF-0001). 숨김이거나 좌표가 없으면 비어 있다.
    media_id = Column(
        String(20), ForeignKey("media.media_id", ondelete="SET NULL"), nullable=True, unique=True
    )
    name = Column(String(200), nullable=False)
    # 매장 유형(카페 · 식당 …) — 매장 폼의 칩 값이 유형에 따라 바뀐다. 유형을 지우면 비워진다(070).
    store_type_id = Column(
        Integer, ForeignKey("cafe_store_type.id", ondelete="SET NULL"), nullable=True, index=True
    )
    address = Column(String(500), nullable=False)  # 도로명 주소
    address_detail = Column(String(200), nullable=True)
    city = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    latitude = Column(Numeric(10, 7), nullable=True)
    longitude = Column(Numeric(10, 7), nullable=True)
    # 사진 주소(최대 30장) — 분류 순으로 두고, 분류마다 첫 장이 그 분류의 대표 사진(매체 찾기 · 광고주 매장 카드에 보인다).
    image_urls = Column(JSONB, nullable=False, default=list, server_default="[]")
    # 사진 분류 — 사진 주소 → exterior 외관 · interior 내관 · counter 카운터 · menu 메뉴 · etc 기타(069, 073).
    image_kinds = Column(JSONB, nullable=False, default=dict, server_default="{}")
    # 사진 메모 — 사진 주소 → 짧은 메모(어드민이 적고, 광고주 매장 상세에서 사진 설명으로 보인다, 073).
    image_memos = Column(JSONB, nullable=False, default=dict, server_default="{}")
    # 사진 올린 때 — 사진 주소 → ISO 시각(UTC). 저장할 때 처음 보는 주소에만 붙고, 어드민 매장 폼 메모 아래에 보인다(075).
    image_dates = Column(JSONB, nullable=False, default=dict, server_default="{}")
    phone = Column(String(30), nullable=True)  # 매장 전화 또는 사장님 휴대폰
    owner_name = Column(String(100), nullable=True)
    tags = Column(JSONB, nullable=False, default=list, server_default="[]")  # 매장 어필(개수 제한 없음, 카드에서는 3개 + "+N")
    # 조건 메모 — "포스터 부착 불가", "신규 메뉴 가능"처럼 콜라보 때 참고할 매장 조건(어드민이 적는다, 개수 제한 없음, 069).
    notes = Column(JSONB, nullable=False, default=list, server_default="[]")
    # 운영 시간 글(화면에 보이는 것) — 어드민 입력값(hours)이 있으면 서버가 그 값으로 만든다.
    business_hours = Column(String(300), nullable=True)
    # 운영 시간 입력값 — {"slots": [{"days": daily|weekday|weekend, "open": "10:00", "close": "22:00"}] (2개까지),
    # "closed": ["mon", …, "sun", "holiday"]}(073). 예전에 글로만 적은 매장은 null.
    hours = Column(JSONB, nullable=True)
    status = Column(String(20), nullable=False, default="active", server_default="active")  # active/hidden
    admin_memo = Column(Text, nullable=True)
    # 콜라보 등급(S·A·B·C, 기준은 아직 정하지 않음)과 매장별 금액(1건, 원) — admix가 어드민에서 정한다. 광고주·어드민만 본다(067).
    collab_grade = Column(String(1), nullable=True)
    collab_fee = Column(Integer, nullable=True)
    # 등급 점수 — 항목(sales 매출 50 · seats 규모 20 · collab 공간 활용 30)별 {score, memo}. 어드민만 본다(077).
    grade_scores = Column(JSONB, nullable=False, default=dict, server_default="{}")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    owner = relationship("User")
    store_type = relationship("PartnersStoreType")


class PartnersStoreRequest(Base):
    """매장 수정 요청 — 제휴사가 내 매장 정보에서 바꿀 항목을 골라 새 값을 보내고(074),
    어드민 "콜라보 → 수정 요청"에서 반영(처리 완료)하거나 처리 불가(사유)로 답한다(069)."""

    __tablename__ = "cafe_store_request"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id = Column(
        UUID(as_uuid=True), ForeignKey("cafe_store.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    # 바꿀 항목 — name · address · hours · phone · owner_name · tags · notes(partners_service.REQUEST_FIELDS). 예전 자유 입력은 비어 있다.
    field = Column(String(20), nullable=True)
    # "무엇에서 → 무엇으로" 글(서버가 만든다). before_text 는 반영할 때 그때 매장 값으로 다시 맞춘다.
    before_text = Column(Text, nullable=True)
    after_text = Column(Text, nullable=True)
    # 반영할 값 그대로 — 주소는 {address, address_detail, city, district, latitude, longitude}, 운영 시간은 hours 입력값.
    after_value = Column(JSONB, nullable=True)
    # 담당자에게 남기는 메모(선택). 예전 자유 입력 요청은 이 글이 요청 자체.
    content = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="pending", server_default="pending")  # pending/done/rejected
    # 담당자 답 — 처리 불가(rejected)면 사유(꼭 적는다).
    admin_reply = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    # 마지막으로 바뀐 때 — 보냄 · 다시 보냄 · 처리(074).
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)
    handled_at = Column(DateTime(timezone=True), nullable=True)

    store = relationship("PartnersStore")
    user = relationship("User")
