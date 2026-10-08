"""이동매체 운행 지역 — 이름 정규화·범위·지도 영역 겹침(경계 데이터만 쓰는 순수 함수)."""
from __future__ import annotations

from src.services import operating_area as oa

# (북위 최대, 북위 최소, 동경 최대, 동경 최소) — 지도 영역
GANGNAM_STATION = (37.51, 37.49, 127.04, 127.01)
HONGDAE = (37.565, 37.55, 126.93, 126.91)
BUNDANG = (37.40, 37.36, 127.13, 127.09)
BUSAN = (35.2, 35.1, 129.1, 129.0)


def test_city_names_normalize():
    assert oa.canonical_city("서울") == "서울특별시"
    assert oa.canonical_city(" 강원도 ") == "강원특별자치도"
    assert oa.canonical_city("전국") == "전국"
    assert oa.canonical_city("없는도") is None
    assert oa.short_city("전라북도") == "전북"
    assert oa.short_city("없는도") == "없는도"


def test_area_bounds():
    gangnam = oa.area_bounds("서울특별시", ["강남구"])
    seoul = oa.area_bounds("서울특별시", [])
    assert gangnam and seoul
    # 구 범위는 서울 범위 안
    assert gangnam[0] <= seoul[0] and gangnam[1] >= seoul[1]
    # 모르는 구뿐이면 서울 전체
    assert oa.area_bounds("서울", ["없는구"]) == seoul
    assert oa.area_bounds("전국", []) is None
    assert oa.area_bounds(None, []) is None


def test_viewport_matches_uses_real_boundaries():
    gangnam = oa.viewport_matches(*GANGNAM_STATION)
    # 경기도는 서울을 둘러싸지만 강남역 영역과는 겹치지 않는다(사각형 비교면 겹친다).
    assert "경기도" not in gangnam["cities"]
    assert gangnam["seoul_overlaps"]
    assert "강남구" in gangnam["seoul_gus"]
    assert "마포구" not in gangnam["seoul_gus"]

    hongdae = oa.viewport_matches(*HONGDAE)
    assert "마포구" in hongdae["seoul_gus"]
    assert "강남구" not in hongdae["seoul_gus"]

    bundang = oa.viewport_matches(*BUNDANG)
    assert {"경기도", "경기"} <= set(bundang["cities"])
    assert not bundang["seoul_overlaps"]

    busan = oa.viewport_matches(*BUSAN)
    assert "부산광역시" in busan["cities"]
    assert not busan["seoul_overlaps"]
