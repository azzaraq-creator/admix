"""서울시 실시간 도로 소통(TOPIS) — XML 읽기, 속도 → 등급, 링크 모양, 지도 영역 캐시."""
import json
import time
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from src.services import road_traffic as rt


def test_parse_rows_reads_xml():
    xml = (
        '<?xml version="1.0"?><TrafficInfo><list_total_count>1</list_total_count><RESULT><CODE>INFO-000</CODE>'
        "</RESULT><row><link_id>1220020700</link_id><prcs_spd>15</prcs_spd><prcs_trv_time>132</prcs_trv_time></row>"
        "</TrafficInfo>"
    )
    assert rt.parse_rows(xml) == [{"link_id": "1220020700", "prcs_spd": "15", "prcs_trv_time": "132"}]
    assert rt.parse_rows("<RoadInfo><RESULT><CODE>INFO-200</CODE></RESULT></RoadInfo>") == []


def test_traffic_level_by_road_type():
    assert [rt.traffic_level(s, "03") for s in (14, 15, 24.9, 25)] == ["정체", "서행", "서행", "원활"]
    assert [rt.traffic_level(s, "02") for s in (29, 30, 69, 70)] == ["정체", "서행", "서행", "원활"]


def test_link_row_converts_tm_and_sorts_vertices():
    vertices = [
        {"ver_seq": "2", "grs80tm_x": "203186", "grs80tm_y": "443930"},
        {"ver_seq": "1", "grs80tm_x": "202956", "grs80tm_y": "443842"},
    ]
    row = rt.link_row("1220020700", "03", "상행", {"road_name": "역삼로"}, vertices)
    path = json.loads(row["path"])
    # 강남 역삼로 근처(위도 37.49, 경도 127.03), 꼭짓점 순서대로
    assert abs(path[0][0] - 37.49) < 0.01 and abs(path[0][1] - 127.03) < 0.01
    assert path[0][1] < path[1][1]
    assert row["road_name"] == "역삼로" and row["min_lng"] == path[0][1]
    assert rt.link_row("x", "03", None, {}, vertices[:1]) is None


def test_traffic_in_bounds_returns_cached_and_queues_missing():
    db = MagicMock()
    path = json.dumps([[37.5, 127.0], [37.501, 127.001]])
    db.execute.return_value.all.return_value = [
        SimpleNamespace(link_id="A", road_name="강남대로", road_div_cd="03", path=path),
        SimpleNamespace(link_id="B", road_name="올림픽대로", road_div_cd="02", path=path),
    ]
    settings = SimpleNamespace(seoul_openapi_key="k")
    rt._cache.clear()
    rt._inflight.clear()
    rt._cache["A"] = (time.monotonic() + 60, 12.0)
    with patch.object(rt, "get_settings", return_value=settings), patch.object(rt._pool, "submit") as submit:
        out = rt.traffic_in_bounds(db, 37.6, 37.4, 127.1, 126.9)
        again = rt.traffic_in_bounds(db, 37.6, 37.4, 127.1, 126.9)
    rt._cache.clear()
    rt._inflight.clear()
    assert out["pending"] == 1 and [l["id"] for l in out["links"]] == ["A"]
    assert out["links"][0]["level"] == "정체" and out["links"][0]["path"] == [[37.5, 127.0], [37.501, 127.001]]
    # 이미 가져오는 중인 링크는 다시 맡기지 않는다.
    assert submit.call_count == 1 and again["pending"] == 1
