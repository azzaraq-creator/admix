"""서울 지하철·버스 월별 승하차 — 달 계산, 역 이름 묶기, 시간대 합계, 새 달까지만 넣기, 장소 범위 안 역 고르기."""
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from src.services import transit_sync as ts


def test_day_math():
    assert ts.next_day("20261231") == "20270101"
    assert ts.prev_day("20261001") == "20260930"


def test_subway_key_strips_sub_name():
    assert ts.subway_key("잠실(송파구청)") == "잠실"
    assert ts.subway_key("서울역") == "서울역"


def test_subway_stations_groups_lines_by_name():
    rows = [
        {"BLDN_NM": "서울역", "ROUTE": "1호선", "LAT": "37.556", "LOT": "126.972"},
        {"BLDN_NM": "서울역", "ROUTE": "4호선", "LAT": "37.554", "LOT": "126.974"},
        {"BLDN_NM": "잠실(송파구청)", "ROUTE": "2호선", "LAT": "37.51", "LOT": "127.1"},
        {"BLDN_NM": "좌표없음", "ROUTE": "2호선", "LAT": "", "LOT": ""},
    ]
    out = {s["station_id"]: s for s in ts.subway_stations(rows)}
    assert set(out) == {"subway:서울역", "subway:잠실"}
    assert out["subway:서울역"]["lines"] == "1호선,4호선"
    assert abs(out["subway:서울역"]["latitude"] - 37.555) < 1e-9


def test_ridership_rows_sums_routes_per_stop():
    bus = [
        {"STOPS_ID": "100", "GTON_TNOPE": 163.0, "GTOFF_TNOPE": 219.0},
        {"STOPS_ID": "100", "GTON_TNOPE": 7.0, "GTOFF_TNOPE": 1.0},
        {"STOPS_ID": "200", "GTON_TNOPE": 1.0, "GTOFF_TNOPE": 0.0},
    ]
    out = {r["station_id"]: r for r in ts.ridership_rows("bus", "20261011", bus)}
    assert (out["bus:100"]["ride_count"], out["bus:100"]["alight_count"]) == (170, 220)
    assert out["bus:100"]["use_date"] == "20261011" and out["bus:100"]["lines"] is None
    subway = [
        {"SBWY_STNS_NM": "잠실(송파구청)", "SBWY_ROUT_LN_NM": "2호선", "GTON_TNOPE": "10", "GTOFF_TNOPE": "7"},
        {"SBWY_STNS_NM": "잠실", "SBWY_ROUT_LN_NM": "8호선", "GTON_TNOPE": "5", "GTOFF_TNOPE": "3"},
    ]
    (row,) = ts.ridership_rows("subway", "20261011", subway)
    assert (row["station_id"], row["ride_count"], row["alight_count"]) == ("subway:잠실", 15, 10)
    assert row["lines"] == "2호선,8호선"


def test_sync_new_days_stops_at_unpublished_and_before_today():
    db = MagicMock()
    settings = SimpleNamespace(seoul_openapi_key="k")
    published = {("subway", "20261010"), ("subway", "20261011"), ("bus", "20261011")}

    def fetch(kind, day, key):
        return [{"station_id": "x"}] if (kind, day) in published else []

    with patch.object(ts, "get_settings", return_value=settings), patch.object(
        ts, "stations_in_db", return_value=10
    ), patch.object(ts, "_today", return_value="20261014"), patch.object(
        ts, "latest_day_in_db", side_effect=lambda db, kind: {"subway": "20261009", "bus": "20261010"}[kind]
    ), patch.object(ts, "fetch_day", side_effect=fetch) as fetched, patch.object(ts, "_save") as save:
        added = ts.sync_new_days(db)
    assert added == ["subway:20261010", "subway:20261011", "bus:20261011"]
    # 공개 안 된 날(12일)에서 멈추고 오늘(14일)은 묻지 않는다.
    asked = [c.args[:2] for c in fetched.call_args_list]
    assert ("subway", "20261012") in asked and ("subway", "20261013") not in asked
    assert save.call_count == 3


def test_sync_new_days_first_run_takes_latest_published():
    db = MagicMock()
    settings = SimpleNamespace(seoul_openapi_key="k")
    with patch.object(ts, "get_settings", return_value=settings), patch.object(
        ts, "stations_in_db", return_value=10
    ), patch.object(ts, "_today", return_value="20261014"), patch.object(
        ts, "latest_day_in_db", return_value=None
    ), patch.object(
        ts, "fetch_day", side_effect=lambda kind, day, key: [{}] if day == "20261011" else []
    ), patch.object(ts, "_save"):
        assert ts.sync_new_days(db) == ["subway:20261011", "bus:20261011"]


def test_in_place_inside_or_near_border():
    square = [(127.0, 37.5), (127.01, 37.5), (127.01, 37.51), (127.0, 37.51), (127.0, 37.5)]
    place = SimpleNamespace(rings=[square])
    assert ts._in_place(place, 37.505, 127.005)
    # 테두리에서 약 110m 밖 — 여유(200m) 안
    assert ts._in_place(place, 37.511, 127.005)
    # 약 1.1km 밖
    assert not ts._in_place(place, 37.52, 127.005)


def test_get_json_retries_bad_response():
    bad = MagicMock()
    bad.raise_for_status.return_value = None
    bad.json.side_effect = ValueError("not json")
    good = MagicMock()
    good.raise_for_status.return_value = None
    good.json.return_value = {"ok": 1}
    with patch.object(ts.httpx, "get", side_effect=[bad, good]), patch.object(ts.time, "sleep"):
        assert ts._get_json("u") == {"ok": 1}
