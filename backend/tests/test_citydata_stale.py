"""실시간 인구 — 캐시가 만료돼 다시 받는 동안에도 마지막 값을 보낸다(켜자마자 비어 보이지 않게)."""
import time
from unittest import mock

from src.services import seoul_citydata as sc


def _bounds(p):
    return (p.max_y, p.min_y, p.max_x, p.min_x)


def test_stale_row_is_shown_while_refetching():
    p = sc._places()[0]
    row = {"AREA_NM": p.name, "AREA_CONGEST_LVL": "보통", "AREA_PPLTN_MIN": "1", "AREA_PPLTN_MAX": "2"}
    with mock.patch.object(sc, "get_settings") as gs, mock.patch.object(sc, "_fetch_in_background") as fb:
        gs.return_value.seoul_openapi_key = "x"
        sc._cache.clear()
        sc._last_good.clear()
        # 한 번도 받은 적 없는 장소는 빠지고 pending
        r = sc.crowd_in_bounds(*_bounds(p))
        assert p.code not in [x["code"] for x in r["places"]] and r["pending"] >= 1
        # 만료됐어도 마지막 값이 있으면 보내고, 뒤에서 다시 받는다
        sc._cache[p.code] = (time.monotonic() - 1, row)
        sc._last_good[p.code] = row
        r = sc.crowd_in_bounds(*_bounds(p))
        assert p.code in [x["code"] for x in r["places"]]
        assert fb.called
        # 최근 호출이 실패해도(캐시 None) 마지막 정상 값을 보인다
        sc._cache[p.code] = (time.monotonic() + 60, None)
        r = sc.crowd_in_bounds(*_bounds(p))
        assert p.code in [x["code"] for x in r["places"]]
    sc._cache.clear()
    sc._last_good.clear()
