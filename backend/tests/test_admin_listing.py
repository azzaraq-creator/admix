"""admin 목록 서버 사이드 필터/페이지네이션 검증.

listing 유틸은 순수 단위 테스트, member_service.list_members 는 실제 postgres 의
기존 데이터에 대해 불변식만 검증한다(레코드 삽입/삭제 없음, 읽기 전용).
"""
from __future__ import annotations

from datetime import date

import pytest
from sqlalchemy.orm import Session

from src.database import SessionLocal
from src.services import member_service
from src.utils.listing import in_date_range, paginate, parse_date


# ---------- 순수 유틸 ----------


def test_parse_date_accepts_dot_and_dash():
    assert parse_date("2026-07-24") == date(2026, 7, 24)
    assert parse_date("2026.07.24") == date(2026, 7, 24)
    assert parse_date("") is None
    assert parse_date(None) is None
    assert parse_date("garbage") is None


def test_in_date_range_bounds_inclusive():
    lo, hi = date(2026, 1, 1), date(2026, 12, 31)
    assert in_date_range("2026-06-15", lo, hi) is True
    assert in_date_range("2026-01-01", lo, hi) is True  # 하한 포함
    assert in_date_range("2026-12-31", lo, hi) is True  # 상한 포함
    assert in_date_range("2025-12-31", lo, hi) is False
    assert in_date_range("2027-01-01", lo, hi) is False


def test_in_date_range_no_bounds_passes_all():
    assert in_date_range("2026-06-15", None, None) is True
    assert in_date_range("-", None, None) is True


def test_in_date_range_missing_value_excluded_when_bounded():
    assert in_date_range("-", date(2026, 1, 1), None) is False
    assert in_date_range(None, None, date(2026, 12, 31)) is False


def test_in_date_range_single_bound():
    assert in_date_range("2026-06-15", date(2026, 6, 1), None) is True
    assert in_date_range("2026-05-15", date(2026, 6, 1), None) is False
    assert in_date_range("2026-06-15", None, date(2026, 6, 30)) is True
    assert in_date_range("2026-07-15", None, date(2026, 6, 30)) is False


def test_paginate_slices_and_reports_total():
    rows = list(range(23))
    total, items = paginate(rows, page=1, page_size=10)
    assert total == 23 and items == list(range(10))
    total, items = paginate(rows, page=3, page_size=10)
    assert total == 23 and items == [20, 21, 22]
    total, items = paginate(rows, page=99, page_size=10)
    assert total == 23 and items == []  # 범위 밖 페이지 → 빈 슬라이스


# ---------- member_service (read-only, 기존 데이터 대상) ----------


@pytest.fixture
def db() -> Session:
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


def test_list_members_baseline(db: Session):
    total, items = member_service.list_members(db, page=1, page_size=1000)
    all_rows = member_service.list_members_all(db)
    assert total == len(all_rows)
    assert len(items) == min(total, 1000)


def test_list_members_pagination(db: Session):
    total, items = member_service.list_members(db, page=1, page_size=3)
    assert len(items) <= 3
    if total > 3:
        _, page2 = member_service.list_members(db, page=2, page_size=3)
        assert items != page2  # 페이지가 다르면 내용도 다름


def test_list_members_keyword_matches_email_or_name(db: Session):
    all_rows = member_service.list_members_all(db)
    if not all_rows:
        pytest.skip("회원 데이터 없음")
    # 첫 회원 이메일 앞부분을 키워드로 → 결과 전부 email/name 에 포함
    sample = all_rows[0]["email"][:3].lower()
    total, items = member_service.list_members(db, keyword=sample, page=1, page_size=1000)
    assert total == len(items)
    for r in items:
        assert sample in r["email"].lower() or sample in r["name"].lower()


def test_list_members_future_date_from_empty(db: Session):
    total, items = member_service.list_members(db, date_from="2999-01-01")
    assert total == 0 and items == []


def test_list_members_status_filter(db: Session):
    total, items = member_service.list_members(db, status="정상", page=1, page_size=1000)
    for r in items:
        assert r["status"] == "정상"


# ---------- 나머지 도메인 서비스 스모크(read-only 불변식) ----------

from src.services import (  # noqa: E402
    admin_service,
    faq_service,
    inquiry_service,
    media_service,
    proposal_service,
)


def test_list_proposals_invariants(db: Session):
    total, items = proposal_service.list_proposals(db, page=1, page_size=5)
    assert len(items) <= 5 and total >= len(items)
    assert total == len(proposal_service.list_proposals_all(db))
    t0, i0 = proposal_service.list_proposals(db, date_from="2999-01-01")
    assert t0 == 0 and i0 == []
    _, filt = proposal_service.list_proposals(db, status="취소", page=1, page_size=1000)
    for r in filt:
        assert r["status"] == "취소"


def test_list_inquiries_invariants(db: Session):
    total, items = inquiry_service.list_inquiries(db, page=1, page_size=5)
    assert len(items) <= 5 and total >= len(items)
    assert total == len(inquiry_service.list_inquiries_all(db))
    t0, i0 = inquiry_service.list_inquiries(db, date_from="2999-01-01")
    assert t0 == 0 and i0 == []


def test_list_accounts_invariants(db: Session):
    total, items = admin_service.list_accounts(db, page=1, page_size=5)
    assert len(items) <= 5 and total >= len(items)
    assert total == len(admin_service.list_accounts_all(db))
    # status 는 dict 에 영문("active"/"inactive"), 검색은 한글 → 변환 비교 검증
    _, act = admin_service.list_accounts(db, status="활성", page=1, page_size=1000)
    for r in act:
        assert r["status"] == "active"


def test_list_media_invariants(db: Session):
    total, items = media_service.list_media(db, page=1, page_size=5)
    assert len(items) <= 5 and total >= len(items)
    t0, i0 = media_service.list_media(db, date_from="2999-01-01")
    assert t0 == 0 and i0 == []
    _, moving = media_service.list_media(db, media_type="이동", page=1, page_size=1000)
    for r in moving:
        assert r["mediaType"] == "이동"


def test_list_faqs_admin_invariants(db: Session):
    total, items = faq_service.list_faqs_admin(db, page=1, page_size=5)
    assert len(items) <= 5 and total >= len(items)
    # 공개 목록(전건)과 admin 필터없음 총계 일치
    assert total == len(faq_service.list_faqs(db))
    t0, i0 = faq_service.list_faqs_admin(db, date_from="2999-01-01")
    assert t0 == 0 and i0 == []
