"""admin 목록 공용 유틸 — 서버 사이드 필터(날짜 범위)·페이지네이션.

각 admin list 서비스가 매핑한 dict 목록에 대해 검색 파라미터로 필터링/페이지네이션한다.
날짜 값은 서비스가 반환하는 표시용 문자열("YYYY-MM-DD" 또는 ISO, "-")을 그대로 비교한다.
"""
from __future__ import annotations

from datetime import date
from typing import Optional, TypeVar

T = TypeVar("T")

MAX_PAGE_SIZE = 200


def parse_date(value: Optional[str]) -> Optional[date]:
    """쿼리 파라미터("YYYY-MM-DD" 또는 "YYYY.MM.DD")를 date 로. 실패 시 None."""
    if not value:
        return None
    text = value.replace(".", "-").strip()[:10]
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def in_date_range(
    value: Optional[str],
    date_from: Optional[date],
    date_to: Optional[date],
) -> bool:
    """표시용 날짜 문자열이 [date_from, date_to] 범위(양끝 포함)에 드는지.

    범위가 없으면 항상 통과. 값이 없거나("-") 파싱 불가면 범위 설정 시 제외.
    """
    if date_from is None and date_to is None:
        return True
    if not value or value == "-":
        return False
    try:
        d = date.fromisoformat(value.replace(".", "-")[:10])
    except ValueError:
        return False
    if date_from is not None and d < date_from:
        return False
    if date_to is not None and d > date_to:
        return False
    return True


def paginate(rows: list[T], page: int, page_size: int) -> tuple[int, list[T]]:
    """필터링된 전체 목록을 (total, page_slice) 로. total 은 슬라이싱 전 건수."""
    total = len(rows)
    safe_page = max(1, page)
    safe_size = max(1, min(page_size, MAX_PAGE_SIZE))
    start = (safe_page - 1) * safe_size
    return total, rows[start : start + safe_size]
