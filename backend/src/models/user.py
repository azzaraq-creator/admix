"""인증 도메인 모델 — 사용자 + 리프레시 토큰 + 소셜 계정 + 비밀번호 재설정."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import object_session, relationship

from src.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# 회원 유형 순서 — 가입 화면 카드와 같다(프런트 lib/memberCategory.ts MEMBER_CATEGORIES).
CATEGORY_ORDER = ("general", "advertiser", "agency", "media_owner", "partner")


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # 로그인 아이디 — 이메일가입은 email 과 동일, SNS 가입은 제공자(카카오/네이버) 이메일.
    login_id = Column(String(255), nullable=False, unique=True, index=True)
    # 연락받을(인증) 이메일 — 수신 가능 여부만 검증하므로 중복 허용(unique 아님).
    email = Column(String(255), nullable=False, index=True)
    password = Column(String(255), nullable=True)
    name = Column(String(100), nullable=True)
    phone = Column(String(30), nullable=True, unique=True)
    role = Column(String(20), nullable=False, default="user")
    verified = Column(Boolean, nullable=False, default=False)
    verify_token = Column(String(255), nullable=True)
    # 회원(member) 운영 필드 — 설계서 §3.1
    # 개인/기업 구분 — 가입 시 더 이상 받지 않지만 기존 회원 데이터 보존용으로 남겨둔다.
    membership_type = Column(String(20), nullable=False, default="individual")  # individual/corporate
    # 회원 유형(가입 1단계 "회원 유형 선택") — advertiser/agency/media_owner/general/partner(제휴사: 매장·콜라보, 063).
    # 도입 전 가입자는 membership_type 으로 채웠다(개인→general, 기업→advertiser, 마이그레이션 041).
    member_category = Column(
        String(20), nullable=False, default="general", server_default="general"
    )
    company_name = Column(String(200), nullable=True)
    # 옛 광고주 브랜드 사진(066) — 브랜드가 여러 개가 되면서 advertiser_brands(068)로 옮겼다. 화면은 더 쓰지 않는다.
    brand_image_url = Column(String(500), nullable=True)
    # 광고주 담당자 정보(068, 모두 선택) — 가입 때 · 내 정보에서. 직함은 아래 position 을 같이 쓴다.
    contact_name = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)  # 소속팀
    business_card_url = Column(String(500), nullable=True)  # 명함 파일(/uploads/business-card/...)
    business_card_name = Column(String(255), nullable=True)
    # 제휴사(콜라보) 회원 고유번호(P-0001, 069) — 담당자가 어드민에서 미리 등록한 매장과 이 번호로 잇는다.
    partner_code = Column(String(12), nullable=True, unique=True)
    # 제휴사(콜라보) 기본협약 동의 — 동의 시각 · 협약 버전(065). 비어 있으면 아직 동의 전(로그인 시 이어서 하기 창).
    partner_agreed_at = Column(DateTime(timezone=True), nullable=True)
    partner_agreement_version = Column(String(20), nullable=True)
    # 동의 전 진행 상태(화면이 정한 JSON — 단계 · 읽은 주제 · 별지 확인 등). 다시 로그인하면 여기서 이어서 한다.
    partner_agreement_progress = Column(JSONB, nullable=True)
    # 기본협약 전자 서명(078) — 서명자 이름 · 구분(representative/delegate) · 서명 그림(PNG) · 동의 때 IP.
    # 서명 시각은 partner_agreed_at. 서명을 받기 전에 동의한 회원은 비어 있다.
    partner_signer_name = Column(String(100), nullable=True)
    partner_signer_role = Column(String(20), nullable=True)
    partner_signature_url = Column(String(500), nullable=True)
    partner_signed_ip = Column(String(64), nullable=True)
    # 직책 · 직함 — 어드민 회원 상세의 "직책", 광고주 담당자 정보의 "직함"(068).
    position = Column(String(100), nullable=True)
    industry = Column(String(100), nullable=True)
    marketing_consent = Column(Boolean, nullable=False, default=False)
    # 마케팅 정보 받을 방법(083) — 문자 · 이메일, 둘 다 가능. 동의(marketing_consent)가 켜져 있을 때만 쓴다.
    marketing_sms = Column(Boolean, nullable=False, default=False, server_default="false")
    marketing_email = Column(Boolean, nullable=False, default=False, server_default="false")
    # 슈퍼 계정 묶음(087) — 유형마다 따로 쓰는 계정들을 같은 값으로 묶어 프로필 메뉴 "계정 전환"으로 오간다. 보통 회원은 비어 있다.
    account_group_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    status = Column(String(20), nullable=False, default="active")  # active/dormant/sanctioned/withdrawn
    admin_memo = Column(Text, nullable=True)
    withdrawn_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    refresh_tokens = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )
    social_accounts = relationship(
        "SocialAccount", back_populates="user", cascade="all, delete-orphan"
    )
    password_resets = relationship(
        "PasswordReset", back_populates="user", cascade="all, delete-orphan"
    )
    business_registration = relationship(
        "BusinessRegistration",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    sanctions = relationship(
        "MemberSanction", back_populates="user", cascade="all, delete-orphan"
    )
    proposals = relationship(
        "Proposal", back_populates="member", passive_deletes=True
    )
    inquiries = relationship("Inquiry", back_populates="member")

    @property
    def linked_accounts(self) -> list[dict]:
        """같은 묶음(account_group_id)의 계정들 — 자기 자신 포함, 회원 유형 순서(일반 · 광고주 · 대행사 · 매체사 · 제휴사).
        묶음이 없으면 빈 목록. 탈퇴한 계정은 뺀다."""
        session = object_session(self)
        if self.account_group_id is None or session is None:
            return []
        rows = (
            session.query(User.id, User.member_category)
            .filter(User.account_group_id == self.account_group_id, User.status != "withdrawn")
            .all()
        )
        rows.sort(key=lambda r: CATEGORY_ORDER.index(r.member_category) if r.member_category in CATEGORY_ORDER else 99)
        return [{"id": r.id, "member_category": r.member_category} for r in rows]

    @property
    def sns_provider(self) -> str | None:
        """로그인에 사용된 소셜 제공자(kakao/naver). 이메일 가입은 None."""
        return self.social_accounts[0].provider if self.social_accounts else None


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token = Column(String(512), nullable=False, unique=True, index=True)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    user = relationship("User", back_populates="refresh_tokens")


class SocialAccount(Base):
    __tablename__ = "social_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider = Column(String(20), nullable=False)
    provider_id = Column(String(255), nullable=False)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    access_token = Column(Text, nullable=True)
    refresh_token = Column(Text, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    user = relationship("User", back_populates="social_accounts")

    __table_args__ = (
        UniqueConstraint("provider", "provider_id", name="uq_social_accounts_provider"),
    )


class EmailVerification(Base):
    """이메일 인증코드 — 회원가입/SNS 가입 시 수신 가능한 이메일 확인용.

    유저 생성 전에도 발급되므로 email 기준으로 관리(FK 없음).
    """
    __tablename__ = "email_verifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), nullable=False, index=True)
    code = Column(String(10), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    verified = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)


class PasswordReset(Base):
    __tablename__ = "password_resets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token = Column(String(255), nullable=False, unique=True, index=True)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    user = relationship("User", back_populates="password_resets")
