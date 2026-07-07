"""관리자 대시보드 응답 스키마."""
from __future__ import annotations

from pydantic import BaseModel


class TodayTotal(BaseModel):
    today: int
    total: int


class InquiryMetric(BaseModel):
    today: int
    week: int
    month: int
    total: int


class DashboardResponse(BaseModel):
    members: TodayTotal
    proposals: TodayTotal
    inquiries: InquiryMetric
    proposalMonthly: list[int]
    year: int
