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
    visitors: TodayTotal  # 홈 진입 수 (GA4). 미설정 시 0.
    proposalMonthly: list[int]
    visitorMonthly: list[int]  # 홈 진입 수 월별(연간 차트용)
    year: int
