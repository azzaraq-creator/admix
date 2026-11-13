"""인증 요청/응답 스키마."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from src.schemas.member import BusinessRegistrationOut, MemberCategory


class PartnerStoreInfo(BaseModel):
    """제휴사 가입 "매장 정보"(089, 2026-11-13 사용자) — 상호 · 사업자 번호 · 대표자명 · 주소는 필수, 상세 주소는 선택.
    사업자 번호는 숫자 10자리('-'는 있어도 없어도 된다 — 서버가 000-00-00000 으로 맞춰 저장)."""

    business_name: str = Field(max_length=200)
    business_registration_no: str = Field(max_length=30)
    representative_name: str = Field(max_length=100)
    address: str = Field(max_length=500)
    address_detail: str | None = Field(default=None, max_length=200)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str | None = None
    phone: str | None = None
    membership_type: str = "individual"
    member_category: MemberCategory | None = None
    company_name: str | None = None
    marketing_consent: bool = False
    # 마케팅 정보 받을 방법(083) — 제휴사 가입 약관 단계에서 고른다. 안 보내면 동의했을 때 둘 다.
    marketing_sms: bool | None = None
    marketing_email: bool | None = None
    # 제휴사(콜라보)는 꼭 보낸다(089) — 다른 유형은 보내도 저장하지 않는다.
    store_info: PartnerStoreInfo | None = None
    session_id: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember: bool = False
    session_id: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class ProfileUpdateRequest(BaseModel):
    name: str | None = None
    company_name: str | None = None
    phone: str | None = None
    marketing_consent: bool | None = None
    # 마케팅 정보 받을 방법(083) — 문자 · 이메일, 둘 다 가능. 동의를 켠 채 둘 다 끌 수는 없다.
    marketing_sms: bool | None = None
    marketing_email: bool | None = None
    # 회원 유형 — 가입 후에도 회원 정보에서 언제든 바꿀 수 있다. 사업자 인증 상태는 그대로 둔다.
    member_category: MemberCategory | None = None
    # 광고주 담당자 정보(068) — 빈 문자열이면 지운다.
    contact_name: str | None = Field(default=None, max_length=100)
    position: str | None = Field(default=None, max_length=100)
    department: str | None = Field(default=None, max_length=100)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


class LinkedAccountOut(BaseModel):
    """슈퍼 계정 묶음(087)의 계정 하나 — 프로필 메뉴 "계정 전환" 목록."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    member_category: str


class SwitchAccountRequest(BaseModel):
    """계정 전환 — 같은 묶음의 다른 계정으로 새 토큰을 받는다. 지금 리프레시 토큰을 주면 폐기한다."""
    user_id: uuid.UUID
    remember: bool = False
    refresh_token: str | None = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    login_id: str
    email: str
    sns_provider: str | None = None
    name: str | None = None
    phone: str | None = None
    role: str
    verified: bool
    membership_type: str = "individual"
    member_category: MemberCategory | None = None
    company_name: str | None = None
    # 광고주 담당자 정보(068) — 이름 · 직함 · 소속팀 · 명함 파일.
    contact_name: str | None = None
    position: str | None = None
    department: str | None = None
    business_card_url: str | None = None
    business_card_name: str | None = None
    marketing_consent: bool = False
    marketing_sms: bool = False
    marketing_email: bool = False
    created_at: datetime
    business_registration: BusinessRegistrationOut | None = None
    # 제휴사(콜라보) 기본협약 동의 시각 — 없으면 동의 전.
    partner_agreed_at: datetime | None = None
    # 기본협약 전자 서명(078) — 협약서 서명란에 보인다. 서명 도입 전에 동의했으면 비어 있다.
    partner_signer_name: str | None = None
    partner_signer_role: str | None = None
    partner_signature_url: str | None = None
    # 제휴사(콜라보) 회원 고유번호(P-0001, 069) — 담당자가 매장을 이 번호로 연결한다.
    partner_code: str | None = None
    # 슈퍼 계정 묶음(087) — 자기 자신 포함. 보통 회원은 빈 목록이고 계정 전환 메뉴가 없다.
    linked_accounts: list[LinkedAccountOut] = []


class OAuthUrlResponse(BaseModel):
    url: str


class EmailVerifyRequest(BaseModel):
    email: EmailStr


class EmailVerifyConfirm(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=10)


class SnsCompleteRequest(BaseModel):
    email: EmailStr
    marketing_consent: bool = False
    # 마케팅 정보 받을 방법(083) — RegisterRequest 와 같다.
    marketing_sms: bool | None = None
    marketing_email: bool | None = None
    member_category: MemberCategory | None = None
    # 시안상 SNS 가입도 "회원정보 입력" 단계를 거친다. 예전 클라이언트는 보내지 않으므로 선택값.
    name: str | None = None
    phone: str | None = None
    company_name: str | None = None
    # 제휴사(콜라보) 매장 정보(089) — RegisterRequest 와 같다.
    store_info: PartnerStoreInfo | None = None
