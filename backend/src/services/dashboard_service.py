"""관리자 대시보드 집계 — 회원/제안/문의 카운트 + 연간 월별 제안 건수.

방문자 수는 추적 인프라가 없어 대시보드에서 제외(프런트 목데이터 유지).
날짜 경계는 KST(UTC+9) 기준으로 계산한다.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.models.inquiry import Inquiry
from src.models.proposal import Proposal
from src.models.user import User

KST = timezone(timedelta(hours=9))


def _bounds():
    now = datetime.now(KST)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week = today - timedelta(days=now.weekday())
    month = today.replace(day=1)
    year = today.replace(month=1, day=1)
    next_year = year.replace(year=year.year + 1)
    return today, week, month, year, next_year


def get_dashboard(db: Session) -> dict:
    today, week, month, year, next_year = _bounds()

    def _count(model, since=None) -> int:
        q = db.query(func.count(model.id))
        if since is not None:
            q = q.filter(model.created_at >= since)
        return int(q.scalar() or 0)

    monthly = [0] * 12
    rows = (
        db.query(Proposal.created_at)
        .filter(Proposal.created_at >= year, Proposal.created_at < next_year)
        .all()
    )
    for (created,) in rows:
        monthly[created.astimezone(KST).month - 1] += 1

    return {
        "members": {"today": _count(User, today), "total": _count(User)},
        "proposals": {"today": _count(Proposal, today), "total": _count(Proposal)},
        "inquiries": {
            "today": _count(Inquiry, today),
            "week": _count(Inquiry, week),
            "month": _count(Inquiry, month),
            "total": _count(Inquiry),
        },
        "proposalMonthly": monthly,
        "year": year.year,
    }
