"""매장 운영 시간 — 요일별(월~일) 구분 · 겹침 막기 · 글(11-27 사용자: "요일별로 선택할 수 있는 옵션도")."""

import pytest
from fastapi import HTTPException

from src.services import partners_service as ps


def _slot(days: str, open_: str = "10:00", close: str = "22:00") -> dict:
    return {"days": days, "open": open_, "close": close}


def test_per_day_slots_sorted_and_text():
    hours = ps._clean_hours(
        {"slots": [_slot("sun", "12:00", "20:00"), _slot("weekday"), _slot("sat", "11:00", "21:00")], "closed": []}
    )
    # 월요일부터 덮는 순서로 — 평일 · 토요일 · 일요일
    assert [s["days"] for s in hours["slots"]] == ["weekday", "sat", "sun"]
    assert ps.hours_text(hours) == "평일 10:00 ~ 22:00 · 토요일 11:00 ~ 21:00 · 일요일 12:00 ~ 20:00"


def test_seven_single_days():
    days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    hours = ps._clean_hours({"slots": [_slot(d) for d in reversed(days)], "closed": ["holiday"]})
    assert [s["days"] for s in hours["slots"]] == days
    assert ps.hours_text(hours).endswith("일요일 10:00 ~ 22:00 (공휴일 휴무)")


@pytest.mark.parametrize(
    "pair",
    [("daily", "mon"), ("weekday", "tue"), ("weekend", "sat"), ("daily", "weekend"), ("fri", "fri")],
)
def test_overlapping_days_rejected(pair):
    with pytest.raises(HTTPException) as e:
        ps._clean_hours({"slots": [_slot(pair[0]), _slot(pair[1])]})
    assert e.value.status_code == 400 and "겹쳐요" in e.value.detail


def test_old_shapes_still_work():
    hours = ps._clean_hours({"slots": [_slot("weekend", "11:00", "21:00"), _slot("weekday")], "closed": ["mon"]})
    assert ps.hours_text(hours) == "평일 10:00 ~ 22:00 · 주말(공휴일) 11:00 ~ 21:00 (월요일 휴무)"
    assert ps.hours_text(ps._clean_hours({"slots": [_slot("daily")]})) == "매일 10:00 ~ 22:00"


def test_rest_weekday_label_and_order():
    """11-27 "월요일 외 평일" — 다른 줄이 고르지 않은 나머지 평일."""
    hours = ps._clean_hours(
        {"slots": [_slot("weekend", "11:00", "21:00"), _slot("rest_weekday"), _slot("mon", "10:00", "18:00")]}
    )
    assert [s["days"] for s in hours["slots"]] == ["mon", "rest_weekday", "weekend"]
    assert ps.hours_text(hours) == "월요일 10:00 ~ 18:00 · 월요일 외 평일 10:00 ~ 22:00 · 주말(공휴일) 11:00 ~ 21:00"


def test_rest_all_label():
    hours = ps._clean_hours({"slots": [_slot("rest"), _slot("mon", "12:00", "18:00"), _slot("wed", "12:00", "18:00")]})
    assert ps.hours_text(hours) == "월요일 12:00 ~ 18:00 · 수요일 12:00 ~ 18:00 · 월요일 · 수요일 외 매일 10:00 ~ 22:00"


@pytest.mark.parametrize(
    "days",
    [
        ["rest_weekday"],  # 뺄 다른 줄이 없음
        ["weekday", "rest_weekday"],  # 남는 평일이 없음
        ["mon", "rest_weekday", "rest"],  # 나머지는 한 줄만
        ["weekend", "rest_weekday"],  # 평일에 걸친 줄이 없음
        ["daily", "rest"],
    ],
)
def test_rest_invalid(days):
    with pytest.raises(HTTPException) as e:
        ps._clean_hours({"slots": [_slot(d) for d in days]})
    assert e.value.status_code == 400
