"""관리자 계정(어드민) 요청/응답 스키마. admin/roles 페이지용.

permissions 는 menu_key 목록(dashboard·media·member·business·faq·account).
status 는 canonical "active"/"disabled" (표시 변환은 프론트 담당).
"""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class AdminAccountRow(BaseModel):
    no: str
    name: str
    email: str
    type: str
    role: str
    status: str
    createdAt: str


class AdminAccountListResponse(BaseModel):
    total: int
    items: list[AdminAccountRow]


class AdminAccountCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str = Field(min_length=1)
    account_type: str
    department: str | None = None
    phone: str | None = None
    status: str = "active"
    permissions: list[str] = []


class AdminAccountUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    account_type: str | None = None
    department: str | None = None
    phone: str | None = None
    status: str | None = None
    password: str | None = Field(default=None, min_length=8)
    permissions: list[str] | None = None


class AdminAccountDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str | None = None
    account_type: str | None = None
    department: str | None = None
    phone: str | None = None
    status: str
    permissions: list[str] = []
    created_at: datetime
    updated_at: datetime


class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember: bool = False


class AdminLoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    admin: AdminAccountDetail


class AdminRefreshRequest(BaseModel):
    refresh_token: str


class AdminTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
