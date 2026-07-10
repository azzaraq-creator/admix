"""회원(member) 관리 요청/응답 스키마. admin/members 페이지용.

표시값(한글)은 서비스에서 canonical ↔ 한글 변환한다.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class MemberRow(BaseModel):
    no: str
    type: str
    loginId: str
    company: str
    name: str
    email: str
    phone: str
    bizStatus: str
    marketing: str
    status: str
    joinedAt: str


class MemberListResponse(BaseModel):
    total: int
    items: list[MemberRow]


class BusinessRegistrationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status: str
    business_name: str | None = None
    business_registration_no: str | None = None
    address: str | None = None
    business_type: str | None = None
    reject_reason: str | None = None
    license_file_url: str | None = None
    license_file_name: str | None = None
    license_uploaded_at: datetime | None = None
    verified_at: datetime | None = None


class SanctionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    reason: str
    start_date: date
    end_date: date | None = None
    created_at: datetime


class ProposalRow(BaseModel):
    id: uuid.UUID
    proposalName: str
    name: str
    totalAmount: str
    status: str
    registeredAt: str


class InquiryRow(BaseModel):
    id: uuid.UUID
    name: str
    title: str
    content: str
    status: str
    submittedAt: str


class MemberDetail(BaseModel):
    id: uuid.UUID
    login_id: str
    email: str
    name: str | None = None
    phone: str | None = None
    membership_type: str
    company_name: str | None = None
    position: str | None = None
    industry: str | None = None
    marketing_consent: bool
    status: str
    admin_memo: str | None = None
    created_at: datetime
    withdrawn_at: datetime | None = None
    proposal_count: int = 0
    inquiry_count: int = 0
    business_registration: BusinessRegistrationOut | None = None
    sanctions: list[SanctionOut] = []
    proposals: list[ProposalRow] = []
    inquiries: list[InquiryRow] = []


class MemberUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    membership_type: str | None = None
    company_name: str | None = None
    position: str | None = None
    industry: str | None = None
    marketing_consent: bool | None = None
    status: str | None = None
    admin_memo: str | None = None


class BusinessRegistrationUpdate(BaseModel):
    status: str | None = None
    business_name: str | None = None
    business_registration_no: str | None = None
    address: str | None = None
    business_type: str | None = None
    reject_reason: str | None = None
