"""recommend_v2 단위 테스트.

LLM 호출은 monkeypatch 로 모킹해서 결정적으로 검증.
DB 는 실제 postgres 사용 (Phase 1 임포트가 끝나야 통과).
"""
from __future__ import annotations

import pytest
from sqlalchemy.orm import Session

from src.database import SessionLocal
from src.models.media import KeywordCategory, MediaItem, MediaKeyword
from src.services import recommend_v2 as v2
from src.services.recommend_v2 import (
    ExtractedCodes,
    _ad_fee_int,
    _has_any_filter,
    _split_image_urls,
    filter_media_items,
    load_keyword_catalog,
    recommend_v2,
    sort_by_price_desc,
)


@pytest.fixture
def db() -> Session:
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


# ---------- 순수 헬퍼 ----------


def test_has_any_filter_false_when_empty():
    assert _has_any_filter(ExtractedCodes()) is False


def test_has_any_filter_true_when_one_filled():
    assert _has_any_filter(ExtractedCodes(loc=["LOC-01"])) is True


def test_split_image_urls_empty():
    assert _split_image_urls(None) == []
    assert _split_image_urls("") == []


def test_split_image_urls_pipe_separated():
    raw = "https://a.jpg | https://b.jpg|https://c.jpg"
    assert _split_image_urls(raw) == ["https://a.jpg", "https://b.jpg", "https://c.jpg"]


# ---------- DB 필터 ----------


def test_catalog_loaded_with_main_categories(db):
    """5개 메인 카테고리(IND/PRD/OBJ/TGT/LOC) 는 사전이 채워져 있어야 함.
    CAT 는 임포트 시 자동 등록되므로 강제하지 않음."""
    cat = load_keyword_catalog(db)
    for c in (
        KeywordCategory.IND,
        KeywordCategory.PRD,
        KeywordCategory.OBJ,
        KeywordCategory.TGT,
        KeywordCategory.LOC,
    ):
        assert len(cat[c]) > 0, f"카테고리 {c.value} 비어있음"


def test_filter_by_loc_only_returns_some(db):
    """LOC-01 (강남) 코드를 가진 매체는 다수 존재."""
    codes = ExtractedCodes(loc=["LOC-01"])
    rows, total = filter_media_items(db, codes, limit=5)
    assert total > 0
    assert len(rows) <= 5
    for r in rows:
        assert "LOC-01" in (r.loc_codes or [])


def test_filter_and_across_categories(db):
    """LOC + IND 동시 매칭: 두 조건 모두 만족."""
    codes = ExtractedCodes(loc=["LOC-01"], ind=["IND-03"])
    rows, total = filter_media_items(db, codes, limit=10)
    for r in rows:
        assert "LOC-01" in (r.loc_codes or [])
        assert "IND-03" in (r.ind_codes or [])


def test_filter_empty_codes_returns_all(db):
    """모든 카테고리 비어있으면 필터 미적용 → 전체."""
    codes = ExtractedCodes()
    rows, total = filter_media_items(db, codes, limit=3)
    assert total > 0
    assert len(rows) == 3


def test_filter_nonexistent_code_returns_zero(db):
    """존재하지 않는 코드 → 0 건."""
    codes = ExtractedCodes(loc=["LOC-9999"])
    rows, total = filter_media_items(db, codes, limit=10)
    assert total == 0
    assert rows == []


# ---------- sort_by_price_desc ----------


def test_ad_fee_int_parses_digits():
    class _M:
        def __init__(self, fee):
            self.advertisement_fee = fee

    assert _ad_fee_int(_M("10,000,000")) == 10_000_000
    assert _ad_fee_int(_M("10000000")) == 10_000_000
    assert _ad_fee_int(_M("")) == 0
    assert _ad_fee_int(_M(None)) == 0
    assert _ad_fee_int(_M("문의")) == 0


def test_sort_by_price_desc(db):
    rows, _ = filter_media_items(db, ExtractedCodes(loc=["LOC-01"]), limit=20)
    sorted_rows = sort_by_price_desc(rows, top_k=10)
    prices = [_ad_fee_int(r) for r in sorted_rows]
    assert prices == sorted(prices, reverse=True)
    assert len(sorted_rows) <= 10


# ---------- recommend_v2 (LLM 모킹) ----------


def _stub_extract(codes: ExtractedCodes):
    def _fn(_user_text: str, _db: Session) -> ExtractedCodes:
        return codes
    return _fn


def test_recommend_v2_empty_input_returns_chat(db):
    res = recommend_v2("", db)
    assert res.type == "chat"
    assert res.match_count == 0


def test_recommend_v2_no_filter_returns_chat(monkeypatch, db):
    monkeypatch.setattr(v2, "extract_keywords", _stub_extract(ExtractedCodes()))
    res = recommend_v2("아무 말이나", db)
    assert res.type == "chat"
    assert res.match_count == 0
    assert "구체적" in (res.message or "")


def test_recommend_v2_single_slot_returns_need_more(monkeypatch, db):
    """슬롯 1개만 매칭 → need_more (조건 추가 요청)."""
    monkeypatch.setattr(v2, "extract_keywords", _stub_extract(ExtractedCodes(loc=["LOC-01"])))
    res = recommend_v2("강남에서 광고", db)
    assert res.type == "need_more"
    assert res.match_count == 0


def test_recommend_v2_zero_match_returns_chat(monkeypatch, db):
    """슬롯 2개 이상 매칭이지만 결과 0건 → chat 안내."""
    monkeypatch.setattr(
        v2, "extract_keywords",
        _stub_extract(ExtractedCodes(loc=["LOC-9999"], ind=["IND-9999"])),
    )
    res = recommend_v2("강남에서 광고", db)
    assert res.type == "chat"
    assert res.match_count == 0
    assert "찾기 어려" in (res.message or "")


def test_recommend_v2_many_matches_returns_list_sorted_by_price(monkeypatch, db):
    """슬롯 2개 이상 매칭 → 광고비 내림차순 정렬."""
    # 광고비 정렬 검증을 위해 후보가 많은 조건. 메인 카테고리 2개 사용.
    monkeypatch.setattr(
        v2, "extract_keywords",
        _stub_extract(ExtractedCodes(loc=["LOC-01"], ind=["IND-03"])),
    )
    res = recommend_v2("강남 화장품 광고 추천", db, top_k=20)
    if res.match_count == 0:
        pytest.skip("DB에 매칭되는 데이터가 없어 정렬 검증 건너뜀")
    assert res.type == "list"
    # 광고비 내림차순 검증
    prices = []
    for it in res.items:
        digits = "".join(c for c in (it.price or "") if c.isdigit())
        prices.append(int(digits) if digits else 0)
    assert prices == sorted(prices, reverse=True)
    item = res.items[0]
    assert item.id and item.name and item.media_source
