"""서울시 상권 유동인구 동기화 — 분기 계산, 페이지 나눠 받기, 새 분기까지만 넣기, 믹시 설명 문장."""
from unittest.mock import MagicMock, patch

from src.services import media_service as ms
from src.services import sangwon_sync as ss


def test_next_quarter():
    assert ss.next_quarter("20253") == "20254"
    assert ss.next_quarter("20254") == "20261"


def _api_row(code: str, quarter: str = "20262", total: float = 300.0) -> dict:
    return {
        "STDR_YYQU_CD": quarter, "TRDAR_CD": code, "TRDAR_CD_NM": f"상권{code}",
        "TOT_FLPOP_CO": total, "ML_FLPOP_CO": 140.0, "FML_FLPOP_CO": 160.0,
        "AGRDE_10_FLPOP_CO": 10.0, "AGRDE_20_FLPOP_CO": 90.0, "AGRDE_30_FLPOP_CO": 80.0,
        "AGRDE_40_FLPOP_CO": 60.0, "AGRDE_50_FLPOP_CO": 40.0, "AGRDE_60_ABOVE_FLPOP_CO": 20.0,
    }


def _resp(body: dict):
    r = MagicMock()
    r.json.return_value = body
    r.raise_for_status.return_value = None
    return r


def test_fetch_quarter_pages_until_total():
    page1 = {"VwsmTrdarFlpopQq": {"list_total_count": 1001, "row": [_api_row(str(i)) for i in range(1000)]}}
    page2 = {"VwsmTrdarFlpopQq": {"list_total_count": 1001, "row": [_api_row("1000")]}}
    with patch.object(ss.httpx, "get", side_effect=[_resp(page1), _resp(page2)]) as get:
        rows = ss.fetch_quarter("20262", "k")
    assert len(rows) == 1001 and get.call_count == 2
    assert "/1001/2000/20262" in get.call_args_list[1].args[0]
    r = rows[0]
    assert (r["sangwon_code"], r["quarter_code"], r["total_foot_traffic"]) == ("0", "20262", 300)
    assert (r["age_20_foot"], r["age_60_foot"]) == (90, 20)


def test_fetch_quarter_not_published_yet():
    no_data = {"RESULT": {"CODE": "INFO-200", "MESSAGE": "해당하는 데이터가 없습니다."}}
    with patch.object(ss.httpx, "get", return_value=_resp(no_data)):
        assert ss.fetch_quarter("20263", "k") == []


def test_sync_new_quarters_adds_until_unpublished():
    db = MagicMock()
    published = {"20261": [ss._to_row(_api_row("1", "20261"))], "20262": [ss._to_row(_api_row("1"))]}
    settings = type("S", (), {"seoul_openapi_key": "k"})()
    from src.services import ai_index

    with patch.object(ss, "get_settings", return_value=settings), patch.object(
        ss, "latest_quarter_in_db", return_value="20254"
    ), patch.object(ss, "fetch_quarter", side_effect=lambda q, key: published.get(q, [])) as fetch, patch.object(
        ss, "sync_areas", return_value=1650
    ) as areas, patch.object(ai_index, "sync_all") as resync:
        assert ss.sync_new_quarters(db) == ["20261", "20262"]
    assert [c.args[0] for c in fetch.call_args_list] == ["20261", "20262", "20263"]
    assert db.commit.call_count == 2
    # 새 분기가 들어오면 상권 위치도 다시 받고, 매체 연결·인구 요약을 다시 맞춘다.
    areas.assert_called_once()
    resync.assert_called_once()


def test_sync_new_quarters_fetches_areas_when_empty():
    """새 분기가 없어도 상권 위치가 비어 있으면(처음 도입) 받고 매체를 다시 맞춘다."""
    from src.services import ai_index

    settings = type("S", (), {"seoul_openapi_key": "k"})()
    with patch.object(ss, "get_settings", return_value=settings), patch.object(
        ss, "latest_quarter_in_db", return_value="20262"
    ), patch.object(ss, "fetch_quarter", return_value=[]), patch.object(
        ss, "areas_in_db", return_value=0
    ), patch.object(ss, "sync_areas", return_value=1650) as areas, patch.object(ai_index, "sync_all") as resync:
        assert ss.sync_new_quarters(MagicMock()) == []
    areas.assert_called_once()
    resync.assert_called_once()


def test_sync_new_quarters_without_key_does_nothing():
    settings = type("S", (), {"seoul_openapi_key": ""})()
    with patch.object(ss, "get_settings", return_value=settings), patch.object(ss, "fetch_quarter") as fetch:
        assert ss.sync_new_quarters(MagicMock()) == []
    fetch.assert_not_called()


def test_population_fact():
    realtime = dict(source="realtime", placeName="강남역", populationMin=80000, populationMax=82000,
                    congestLevel="붐빔", malePct=48, femalePct=52, measuredAt="2026-10-07 15:05")
    assert ms.population_fact(realtime) == "실시간 인구(강남역 15:05 기준): 80,000~82,000명, 혼잡도 붐빔, 남 48% / 여 52%"
    monthly = dict(source="sangwon", placeName="강남역 상권 · 2026년 2분기", populationMin=2477865,
                   populationMax=2477865, malePct=47, femalePct=53)
    assert ms.population_fact(monthly) == "월평균 유동인구(강남역 상권 · 2026년 2분기): 2,477,865명, 남 47% / 여 53%"
    assert ms.population_fact(None) is None


def test_to_row_keeps_weekday_and_hour():
    api = _api_row("1") | {
        "TMZON_00_06_FLPOP_CO": 50.0, "TMZON_21_24_FLPOP_CO": 30.0,
        "MON_FLPOP_CO": 40.0, "TUES_FLPOP_CO": 41.0, "THUR_FLPOP_CO": 43.0, "SUN_FLPOP_CO": 46.0,
    }
    r = ss._to_row(api)
    assert (r["hour_00_06"], r["hour_21_24"]) == (50, 30)
    assert (r["mon_foot"], r["tue_foot"], r["thu_foot"], r["sun_foot"]) == (40, 41, 43, 46)
    assert r["wed_foot"] is None  # 원천에 없으면 비운다


def test_refill_quarters_overwrites_given_quarters():
    db = MagicMock()
    settings = type("S", (), {"seoul_openapi_key": "k"})()
    rows = {"20261": [ss._to_row(_api_row("1", "20261"))], "20262": []}
    with patch.object(ss, "get_settings", return_value=settings), patch.object(
        ss, "fetch_quarter", side_effect=lambda q, key: rows[q]
    ):
        assert ss.refill_quarters(db, ["20261", "20262"]) == {"20261": 1, "20262": 0}
    assert db.execute.call_count == 1 and db.commit.call_count == 1


def test_weekday_counts_in_quarter():
    # 2026년 2분기는 91일(딱 13주), 2025년 4분기는 92일(10/1 수 ~ 12/31 수 — 수요일만 14번).
    assert ms._weekday_counts("20262") == [13] * 7
    assert ms._weekday_counts("20254") == [13, 13, 14, 13, 13, 13, 13]
    assert ms._weekday_counts("2026") is None


def test_weekday_daily_divides_by_weekday_count():
    row = type("R", (), dict(
        mon_foot=1300, tue_foot=1300, wed_foot=1400, thu_foot=1300,
        fri_foot=1300, sat_foot=2600, sun_foot=650,
    ))()
    daily = ms._weekday_daily(row, "20254")
    assert [d["label"] for d in daily] == ["월", "화", "수", "목", "금", "토", "일"]
    assert [d["value"] for d in daily] == [100, 100, 100, 100, 100, 200, 50]


def test_weekday_daily_none_when_columns_empty():
    row = type("R", (), dict(
        mon_foot=None, tue_foot=None, wed_foot=None, thu_foot=None,
        fri_foot=None, sat_foot=None, sun_foot=None,
    ))()
    assert ms._weekday_daily(row, "20262") is None


def _station_media(**kw):
    base = dict(category_large="지하철", latitude=37.5, longitude=127.0, sangwon_code="1", name="", second_name=None)
    return type("M", (), base | kw)()


def _ridership(totals: dict[str, int]):
    return [type("R", (), dict(use_date=d, total=t))() for d, t in totals.items()]


def test_station_population_monthly_and_weekday():
    # 2026-10-05(월) ~ 10-11(일) 일주일, 하루 1만~1.6만.
    days = {f"202610{d:02d}": 10_000 + (d - 5) * 1_000 for d in range(5, 12)}
    db = MagicMock()
    db.execute.return_value.all.return_value = _ridership(days)
    sangwon = {"source": "sangwon", "placeName": "상권", "malePct": 40, "femalePct": 60, "ageRatios": [], "weekdayDaily": None}
    with patch.object(ms, "_nearest_subway_station", return_value=("subway:고속터미널", "고속터미널")), patch.object(
        ms, "_sangwon_population", return_value=sangwon
    ):
        pop = ms._station_population(db, _station_media())
    assert pop["source"] == "station"
    assert pop["placeName"] == "고속터미널역 · 최근 7일"
    assert pop["populationMax"] == round(13_000 * 365 / 12)  # 하루 평균 1.3만을 한 달로
    assert (pop["malePct"], pop["femalePct"]) == (40, 60)  # 비율은 상권 값
    assert [d["value"] for d in pop["weekdayDaily"]] == [10_000 + i * 1_000 for i in range(7)]


def test_station_population_none_cases():
    db = MagicMock()
    # 지하철 매체가 아니면 역을 찾지 않는다.
    with patch.object(ms, "_nearest_subway_station") as near:
        assert ms._station_population(db, _station_media(category_large="전광판")) is None
    near.assert_not_called()
    # 근처에 역이 없거나, 쌓인 날이 일주일이 안 되면 상권 값으로.
    with patch.object(ms, "_nearest_subway_station", return_value=None):
        assert ms._station_population(db, _station_media()) is None
    db.execute.return_value.all.return_value = _ridership({"20261010": 1, "20261011": 2})
    with patch.object(ms, "_nearest_subway_station", return_value=("subway:a", "a")):
        assert ms._station_population(db, _station_media()) is None


def test_media_population_prefers_station_over_sangwon():
    m = _station_media(media_source="FIXED")
    with patch.object(ms, "_manual_population", return_value=None), patch.object(
        ms, "_station_population", return_value={"source": "station"}
    ), patch.object(ms, "_sangwon_population", return_value={"source": "sangwon"}):
        assert ms.media_population(MagicMock(), m)["source"] == "station"


def test_population_fact_station_title():
    pop = {"source": "station", "placeName": "고속터미널역 · 최근 28일", "populationMax": 5_700_000, "malePct": 45, "femalePct": 55}
    assert ms.population_fact(pop).startswith("월평균 역 승하차(고속터미널역 · 최근 28일): 5,700,000명")


def _stations_db(rows):
    db = MagicMock()
    db.execute.return_value.all.return_value = rows
    return db


def test_nearest_station_prefers_name_over_coordinates():
    # 좌표는 노들역(100m)이 더 가깝지만 이름에 "노량진역"이 있으면 600m 떨어진 노량진역.
    m = _station_media(name="Canvas 9", second_name="노량진역", latitude=37.5, longitude=127.0)
    rows = [
        ("subway:노들", "노들", 37.5 + 100 / 110_540, 127.0),
        ("subway:노량진", "노량진", 37.5 + 600 / 110_540, 127.0),
    ]
    assert ms._nearest_subway_station(_stations_db(rows), m) == ("subway:노량진", "노량진")


def test_nearest_station_name_match_longest_and_exact():
    m = _station_media(name="서울역 1호선 PSD", second_name=None, latitude=37.5, longitude=127.0)
    rows = [
        ("subway:서울", "서울", 37.5, 127.0),  # GTX — "서울역"으로도 맞지만 이름이 짧다
        ("subway:서울역", "서울역", 37.5 + 50 / 110_540, 127.0),
    ]
    assert ms._nearest_subway_station(_stations_db(rows), m)[0] == "subway:서울역"


def test_nearest_station_falls_back_to_300m_and_ignores_far_name():
    m = _station_media(name="강남역 PSD", second_name=None, latitude=37.5, longitude=127.0)
    far = [("subway:강남", "강남", 37.5 + 2_000 / 110_540, 127.0)]  # 이름은 맞지만 2km
    assert ms._nearest_subway_station(_stations_db(far), m) is None
    near = [("subway:역삼", "역삼", 37.5 + 200 / 110_540, 127.0)]
    assert ms._nearest_subway_station(_stations_db(near), m) == ("subway:역삼", "역삼")
