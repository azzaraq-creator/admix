"""점검일은 진행 기간 50% 날 한 번(2026-11-26 사용자: "점검일은 50%일 때만 해. 일단은.")."""
from datetime import date

from src.services.collab_service import make_checks


def test_one_check_at_half():
    # 01.01 ~ 01.04(4일) → 2일차 01.02 — 광고주 일정의 중간 보고와 같은 날.
    assert make_checks(date(2027, 1, 1), date(2027, 1, 4)) == [{"step": "check1", "date": "2027-01-02", "day": 2}]


def test_half_rounds_like_screen():
    # 5일 × 0.5 = 2.5 → 화면 Math.round 처럼 3일차(파이썬 round 는 2).
    assert make_checks(date(2027, 1, 1), date(2027, 1, 5))[0]["day"] == 3
    # 하루짜리도 1일차.
    assert make_checks(date(2027, 1, 1), date(2027, 1, 1))[0]["day"] == 1
