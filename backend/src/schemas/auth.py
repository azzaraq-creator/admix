"""인증 요청/응답 스키마."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str | None = None
    phone: str | None = None
    membership_type: str = "individual"
    company_name: str | None = None
    marketing_consent: bool = False


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember: bool = False


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
    email: str
    name: str | None = None
    phone: str | None = None
    role: str
    verified: bool
    membership_type: str = "individual"
    company_name: str | None = None
    marketing_consent: bool = False
    created_at: datetime


class OAuthUrlResponse(BaseModel):
    url: str
