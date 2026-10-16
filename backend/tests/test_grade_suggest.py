"""등급 설문 자동 추천 — 도로 데이터(교차로·도로 등급)와 이름·설명 키워드."""
import json
from types import SimpleNamespace
from unittest.mock import MagicMock

from src.services import grade_suggest as gs

LAT, LNG = 37.5, 127.0
M_PER_DEG_LAT = 110_540


def _media(**kw):
    base = dict(
        media_source="FIXED", exposure_type="OUTSIDE", city="서울", latitude=LAT, longitude=LNG,
        name="", second_name=None, description="", feature=None,
    )
    return SimpleNamespace(**(base | kw))


def _link(north_m: float, *, div="03", name="테헤란로", st="A", ed="B"):
    """매체에서 north_m 만큼 북쪽을 동서로 지나는 도로 구간(끝점 이름 st·ed)."""
    lat = LAT + north_m / M_PER_DEG_LAT
    path = json.dumps([[lat, LNG - 0.0005], [lat, LNG + 0.0005]])
    return (name, div, st, ed, path)


def _db(links):
    db = MagicMock()
    db.execute.return_value.all.return_value = links
    return db


def test_intersection_near_is_facing_and_signal_wait():
    # 서쪽 끝점(약 44m 서쪽, 30m 북쪽 → 약 53m)이 "역삼사거리".
    out = gs.suggest(_db([_link(30, st="역삼사거리")]), _media())
    assert out["road_position"]["value"] == "facing_intersection"
    assert "역삼사거리" in out["road_position"]["reason"]
    assert out["signal_wait"]["value"] == "yes"
    assert out["road_width"]["value"] == "8_plus"  # 주간선도로 30m


def test_main_road_without_intersection():
    out = gs.suggest(_db([_link(20, div="04", name="신반포로")]), _media())
    assert out["road_position"]["value"] == "main_road"
    assert out["road_width"] == {"value": "4_6", "reason": "신반포로 보조간선도로 20m"}
    assert "signal_wait" not in out


def test_no_big_road_nearby_is_side_road():
    out = gs.suggest(_db([]), _media())
    assert out["road_position"]["value"] == "side_road"
    assert "road_width" not in out


def test_description_intersection_beats_main_road():
    # 도로 데이터에 교차로 이름이 없어도 설명에 사거리가 있으면 마주 봄.
    out = gs.suggest(_db([_link(20)]), _media(description="고속터미널 사거리에 위치한 전광판"))
    assert out["road_position"] == {"value": "facing_intersection", "reason": "설명에 '사거리'"}
    assert out["signal_wait"]["value"] == "yes"


def test_outside_seoul_uses_description_only():
    db = _db([])
    out = gs.suggest(db, _media(city="부산", description="양방향 노출, 정체 구간, 야간 조명"))
    db.execute.assert_not_called()
    assert out["view_directions"]["value"] == "both"
    assert out["vehicle_speed"]["value"] == "slow"
    assert out["signal_wait"]["value"] == "yes"
    assert out["night_light"]["value"] == "yes" and out["lighting"]["value"] == "yes"
    assert "road_position" not in out


def test_indoor_name_before_description():
    out = gs.suggest(
        _db([]),
        _media(exposure_type="INSIDE", name="맥스비전 고속터미널역 2-7호선 환승 통로", description="개찰구 앞 동선"),
    )
    assert out["spot"]["value"] == "main_path" and out["dwell"]["value"] == "pass"
    assert out["spot"]["reason"].startswith("이름에 '환승 통로'")


def test_indoor_psd_is_waiting_long():
    out = gs.suggest(_db([]), _media(exposure_type="INSIDE", name="고속터미널역 3호선 PSD"))
    assert (out["spot"]["value"], out["dwell"]["value"]) == ("waiting", "long")


def test_moving_has_no_suggestions():
    assert gs.suggest(_db([]), _media(media_source="MOVING", description="야간 조명")) == {}

