"""서울시 실시간 인구 — 매체 좌표 → 121장소 연결, 응답 변환."""
from unittest.mock import patch

from src.services import seoul_citydata as sc


def test_match_place_inside_picks_narrowest_area():
    # 강남역 사거리 — 강남 MICE 관광특구 등 넓은 영역보다 '강남역'이 먼저다.
    assert sc.match_place(37.49795, 127.02763) == ("POI014", "강남역")


def test_match_place_outside_seoul_is_none():
    # 부산 서면
    assert sc.match_place(35.1579, 129.0597) is None


def test_match_place_nearest_within_1km():
    # 논현동 학동사거리 — 121장소 밖, 가장 가까운 가로수길이 약 685m.
    assert sc.match_place(37.5143, 127.0319)[1] == "가로수길"


def test_match_place_within_distance():
    p = next(p for p in sc._places() if p.code == "POI014")
    # 영역 최북단에서 북쪽으로 약 100m
    lat = p.max_y + 100 / sc._M_PER_DEG_LAT
    lng = next(x for ring in p.rings for x, y in ring if y == p.max_y)
    assert sc.match_place(lat, lng) is not None
    # 약 1.5km 떨어지면 잇지 않는다(그 방향에 다른 장소가 있을 수 있어 코드만 비교).
    far = sc.match_place(p.max_y + 1500 / sc._M_PER_DEG_LAT, lng)
    assert far is None or far[0] != "POI014"


ROW = {
    "AREA_NM": "강남역",
    "AREA_CD": "POI014",
    "AREA_CONGEST_LVL": "붐빔",
    "AREA_PPLTN_MIN": "80000",
    "AREA_PPLTN_MAX": "82000",
    "MALE_PPLTN_RATE": "48.0",
    "FEMALE_PPLTN_RATE": "52.0",
    "PPLTN_RATE_0": "0.8",
    "PPLTN_RATE_10": "4.6",
    "PPLTN_RATE_20": "24.6",
    "PPLTN_RATE_30": "26.5",
    "PPLTN_RATE_40": "20.1",
    "PPLTN_RATE_50": "13.3",
    "PPLTN_RATE_60": "6.2",
    "PPLTN_RATE_70": "3.9",
    "PPLTN_TIME": "2026-10-07 15:05",
}


def _settings(key: str):
    return type("S", (), {"seoul_openapi_key": key})()


def test_realtime_population_shape():
    with patch.object(sc, "get_settings", return_value=_settings("k")), patch.object(sc, "_fetch", return_value=ROW):
        pop = sc.realtime_population(37.49795, 127.02763)
    assert pop["placeName"] == "강남역"
    assert pop["congestLevel"] == "붐빔"
    assert (pop["populationMin"], pop["populationMax"]) == (80000, 82000)
    assert (pop["malePct"], pop["femalePct"]) == (48, 52)
    ages = {a["label"]: a["value"] for a in pop["ageRatios"]}
    assert ages == {"10": 5.4, "20대": 24.6, "30대": 26.5, "40대": 20.1, "50대": 13.3, "60": 10.1}
    assert pop["measuredAt"] == "2026-10-07 15:05"


def test_realtime_population_none_without_key_or_coords_or_data():
    with patch.object(sc, "get_settings", return_value=_settings("")):
        assert sc.realtime_population(37.49795, 127.02763) is None
    with patch.object(sc, "get_settings", return_value=_settings("k")):
        assert sc.realtime_population(None, 127.0) is None
        with patch.object(sc, "_fetch", return_value=None):
            assert sc.realtime_population(37.49795, 127.02763) is None


def _media(**kw):
    from src.models.media_master import Media

    m = Media(latitude=kw.pop("lat", None), longitude=kw.pop("lng", None))
    for k, v in kw.items():
        setattr(m, k, v)
    return m


def test_media_population_prefers_realtime_then_manual():
    from src.services import media_service as ms

    manual = dict(population_count=450000, population_note="2025년 3분기 월평균", population_male_pct=48,
                  population_age_10=8, population_age_20=30, population_age_30=25,
                  population_age_40=15, population_age_50=10, population_age_60=12)
    m = _media(lat=37.49795, lng=127.02763, **manual)
    sangwon = {"source": "sangwon"}
    with patch.object(ms, "realtime_population", return_value={"source": "realtime"}):
        assert ms.media_population(None, m) == {"source": "realtime"}
    with patch.object(ms, "realtime_population", return_value=None), patch.object(
        ms, "_sangwon_population", return_value=sangwon
    ):
        pop = ms.media_population(None, m)
        # 직접 입력이 없으면 원천 상권 월평균 유동인구
        assert ms.media_population(None, _media(lat=37.49795, lng=127.02763)) == sangwon
    assert pop["source"] == "manual"
    assert pop["placeName"] == "2025년 3분기 월평균"
    assert (pop["populationMin"], pop["populationMax"]) == (450000, 450000)
    assert (pop["malePct"], pop["femalePct"]) == (48, 52)  # 여성은 100에서 뺀다
    assert [a["value"] for a in pop["ageRatios"]] == [8, 30, 25, 15, 10, 12]
    assert pop["congestLevel"] is None and pop["measuredAt"] is None


def test_media_population_none_without_realtime_or_count():
    from src.services import media_service as ms

    with patch.object(ms, "realtime_population", return_value=None), patch.object(
        ms, "_sangwon_population", return_value=None
    ):
        assert ms.media_population(None, _media(population_male_pct=50)) is None


def test_check_realtime_statuses():
    assert sc.check_realtime(None, None)["status"] == "no_coords"
    with patch.object(sc, "realtime_population", return_value={"source": "realtime"}):
        assert sc.check_realtime(37.49795, 127.02763)["status"] == "available"
    with patch.object(sc, "realtime_population", return_value=None):
        busan = sc.check_realtime(35.1579, 129.0597)
        assert busan["status"] == "out_of_range" and busan["nearest"] is None
        # 래미안 대치팰리스 — 가장 가까운 선릉역이 1km 넘게 떨어져 있다.
        daechi = sc.check_realtime(37.4953, 127.062)
        assert daechi["status"] == "out_of_range" and daechi["nearest"]["name"] == "선릉역"
        assert sc.check_realtime(37.49795, 127.02763)["status"] == "unavailable"


def test_media_population_none_for_moving():
    from src.services import media_service as ms

    m = _media(media_source="MOVING", population_count=100000, population_male_pct=50)
    with patch.object(ms, "realtime_population", return_value=None), patch.object(
        ms, "_sangwon_population", return_value={"source": "sangwon"}
    ):
        assert ms.media_population(None, m) is None


def test_quarter_label():
    from src.services import media_service as ms

    assert ms._quarter_label("20254") == "2025년 4분기"
    assert ms._sangwon_label("성남시 상권") == "성남시 상권"
    assert ms._sangwon_label("역삼역") == "역삼역 상권"
