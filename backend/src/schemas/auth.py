"""인증 요청/응답 스키마."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from src.schemas.member import BusinessRegistrationOut, MemberCategory


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str | None = None
    phone: str | None = None
    membership_type: str = "individual"
    member_category: MemberCategory | None = None
    company_name: str | None = None
    marketing_consent: bool = False
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
    # 회원 유형 — 가입 후에도 회원 정보에서 언제든 바꿀 수 있다. 사업자 인증 상태는 그대로 둔다.
    member_category: MemberCategory | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


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
    # 광고주 브랜드 사진(/uploads/... 또는 S3 주소) — 없으면 null.
    brand_image_url: str | None = None
    marketing_consent: bool = False
    created_at: datetime
    business_registration: BusinessRegistrationOut | None = None
    # 제휴사(콜라보) 기본협약 동의 시각 — 없으면 동의 전.
    partner_agreed_at: datetime | None = None


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
    member_category: MemberCategory | None = None
    # 시안상 SNS 가입도 "회원정보 입력" 단계를 거친다. 예전 클라이언트는 보내지 않으므로 선택값.
    name: str | None = None
    phone: str | None = None
    company_name: str | None = None
