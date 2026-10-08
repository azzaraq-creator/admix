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
    with patch.object(ss, "get_settings", return_value=settings), patch.object(
        ss, "latest_quarter_in_db", return_value="20254"
    ), patch.object(ss, "fetch_quarter", side_effect=lambda q, key: published.get(q, [])) as fetch:
        assert ss.sync_new_quarters(db) == ["20261", "20262"]
    assert [c.args[0] for c in fetch.call_args_list] == ["20261", "20262", "20263"]
    assert db.commit.call_count == 2


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
