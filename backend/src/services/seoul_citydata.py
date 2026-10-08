"""서울시 실시간 도시데이터 — 주요 121장소의 실시간 인구(citydata_ppltn).

매체 정보 팝업의 유동인구 카드에 쓴다. 서울시가 정한 121장소만 제공하므로 매체 좌표가
장소 영역 안에 있거나 영역에서 MATCH_MAX_DISTANCE_M 이내일 때만 그 장소로 잇고, 아니면
None(카드 숨김)이다. 여러 영역에 걸치면(관광특구 안의 역 등) 가장 좁은 영역을 고른다.

- 장소 영역: assets/geo/seoul-citydata-places.json
  (서울 열린데이터광장 OA-21778 "서울시 주요 121장소 영역", WGS84)
- 서울시는 5분마다 갱신하므로 장소별 응답을 CACHE_TTL_S 동안 재사용한다(호출 한도 보호).
- 키가 없거나 호출이 실패하면 None — 팝업은 카드 없이 그대로 열린다.
"""
from __future__ import annotations

import json
import logging
import math
import threading
import time
from functools import lru_cache
from pathlib import Path

import httpx

from src.config import get_settings

logger = logging.getLogger(__name__)

API_URL = "http://openapi.seoul.go.kr:8088/{key}/json/citydata_ppltn/1/5/{code}"
MATCH_MAX_DISTANCE_M = 1000
CACHE_TTL_S = 300
TIMEOUT_S = 3.0

_GEO_FILE = Path(__file__).resolve().parent.parent / "assets" / "geo" / "seoul-citydata-places.json"

Ring = list[tuple[float, float]]  # [(경도, 위도), ...]

# 위도 1도 ≈ 110.54km, 경도 1도 ≈ 111.32km × cos(위도)
_M_PER_DEG_LAT = 110_540
_M_PER_DEG_LNG = 111_320


class _Place:
    def __init__(self, code: str, name: str, rings: list[Ring]):
        self.code = code
        self.name = name
        self.rings = rings
        pts = [p for ring in rings for p in ring]
        self.min_x = min(p[0] for p in pts)
        self.max_x = max(p[0] for p in pts)
        self.min_y = min(p[1] for p in pts)
        self.max_y = max(p[1] for p in pts)
        self.area = sum(abs(_ring_area(r)) for r in rings)


def _ring_area(ring: Ring) -> float:
    return sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1])) / 2


@lru_cache(maxsize=1)
def _places() -> list[_Place]:
    data = json.loads(_GEO_FILE.read_text(encoding="utf-8"))
    return [
        _Place(p["code"], p["name"], [[(x, y) for x, y in ring] for ring in p["rings"]])
        for p in data["places"]
    ]


def _point_in_ring(x: float, y: float, ring: Ring) -> bool:
    inside = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def _distance_to_ring_m(x: float, y: float, ring: Ring) -> float:
    """점에서 외곽선까지의 최단 거리(m). 서울 범위라 평면 근사로 충분하다."""
    kx = _M_PER_DEG_LNG * math.cos(math.radians(y))
    best = math.inf
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        ax, ay = (x1 - x) * kx, (y1 - y) * _M_PER_DEG_LAT
        bx, by = (x2 - x) * kx, (y2 - y) * _M_PER_DEG_LAT
        dx, dy = bx - ax, by - ay
        seg = dx * dx + dy * dy
        t = 0.0 if seg == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / seg))
        best = min(best, math.hypot(ax + t * dx, ay + t * dy))
    return best


@lru_cache(maxsize=4096)
def match_place(lat: float, lng: float) -> tuple[str, str] | None:
    """좌표 → (장소 코드, 장소 이름). 영역 안이면 가장 좁은 영역, 아니면 가까운 영역(제한 거리 이내)."""
    x, y = lng, lat
    inside = [
        p
        for p in _places()
        if p.min_x <= x <= p.max_x
        and p.min_y <= y <= p.max_y
        and any(_point_in_ring(x, y, r) for r in p.rings)
    ]
    if inside:
        p = min(inside, key=lambda p: p.area)
        return p.code, p.name

    margin_y = MATCH_MAX_DISTANCE_M / _M_PER_DEG_LAT
    margin_x = MATCH_MAX_DISTANCE_M / (_M_PER_DEG_LNG * math.cos(math.radians(y)))
    nearest: tuple[float, _Place] | None = None
    for p in _places():
        if not (p.min_x - margin_x <= x <= p.max_x + margin_x and p.min_y - margin_y <= y <= p.max_y + margin_y):
            continue
        d = min(_distance_to_ring_m(x, y, r) for r in p.rings)
        if d <= MATCH_MAX_DISTANCE_M and (nearest is None or d < nearest[0]):
            nearest = (d, p)
    return (nearest[1].code, nearest[1].name) if nearest else None


_cache: dict[str, tuple[float, dict | None]] = {}
_cache_lock = threading.Lock()


def _fetch(code: str) -> dict | None:
    """장소 코드의 실시간 인구 원본 한 건. 실패하면 None(짧게 캐시해 연속 실패 호출을 막는다)."""
    now = time.monotonic()
    with _cache_lock:
        hit = _cache.get(code)
        if hit and hit[0] > now:
            return hit[1]

    row: dict | None = None
    try:
        resp = httpx.get(API_URL.format(key=get_settings().seoul_openapi_key, code=code), timeout=TIMEOUT_S)
        resp.raise_for_status()
        rows = resp.json().get("SeoulRtd.citydata_ppltn") or []
        row = rows[0] if rows else None
    except (httpx.HTTPError, ValueError) as e:
        logger.warning("서울시 실시간 인구 조회 실패 code=%s: %s", code, e)

    ttl = CACHE_TTL_S if row else 60
    with _cache_lock:
        _cache[code] = (now + ttl, row)
    return row


def _num(v) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def realtime_population(lat: float | None, lng: float | None) -> dict | None:
    """매체 좌표 → 매체 상세 응답의 population(MediaPopulation 모양). 데이터가 없으면 None."""
    if lat is None or lng is None or not get_settings().seoul_openapi_key:
        return None
    place = match_place(round(float(lat), 6), round(float(lng), 6))
    if place is None:
        return None
    row = _fetch(place[0])
    if row is None or not row.get("AREA_PPLTN_MAX"):
        return None

    male = _num(row.get("MALE_PPLTN_RATE"))
    female = _num(row.get("FEMALE_PPLTN_RATE"))
    gender_base = male + female
    male_pct = round(male / gender_base * 100) if gender_base else 0

    rate = lambda age: _num(row.get(f"PPLTN_RATE_{age}"))  # noqa: E731
    age_ratios = [
        dict(label="10", value=round(rate(0) + rate(10), 1), bound="under"),
        dict(label="20대", value=rate(20), bound=None),
        dict(label="30대", value=rate(30), bound=None),
        dict(label="40대", value=rate(40), bound=None),
        dict(label="50대", value=rate(50), bound=None),
        dict(label="60", value=round(rate(60) + rate(70), 1), bound="over"),
    ]
    return dict(
        source="realtime",
        placeName=row.get("AREA_NM") or place[1],
        congestLevel=row.get("AREA_CONGEST_LVL") or None,
        populationMin=int(_num(row.get("AREA_PPLTN_MIN"))),
        populationMax=int(_num(row.get("AREA_PPLTN_MAX"))),
        malePct=male_pct,
        femalePct=(100 - male_pct) if gender_base else 0,
        ageRatios=age_ratios,
        measuredAt=row.get("PPLTN_TIME") or None,
    )


def nearest_place(lat: float, lng: float) -> tuple[str, int] | None:
    """가장 가까운 장소 이름과 영역까지 거리(m, 안이면 0) — 어드민 안내용. 서울 밖처럼 멀면 None."""
    x, y = lng, lat
    best: tuple[float, _Place] | None = None
    for p in _places():
        if any(_point_in_ring(x, y, r) for r in p.rings):
            return p.name, 0
        d = min(_distance_to_ring_m(x, y, r) for r in p.rings)
        if best is None or d < best[0]:
            best = (d, p)
    if best is None or best[0] > 20_000:
        return None
    return best[1].name, round(best[0])


def check_realtime(lat: float | None, lng: float | None) -> dict:
    """어드민 매체 폼 — 이 좌표로 실시간 인구를 가져올 수 있는지.

    status: available(가져옴) / no_coords(좌표 없음) / out_of_range(121장소에서 멂) /
            unavailable(키 없음·서울시 호출 실패)
    """
    if lat is None or lng is None:
        return {"status": "no_coords", "population": None, "nearest": None}
    pop = realtime_population(lat, lng)
    if pop:
        return {"status": "available", "population": pop, "nearest": None}
    if match_place(round(float(lat), 6), round(float(lng), 6)) is None:
        near = nearest_place(float(lat), float(lng))
        return {
            "status": "out_of_range",
            "population": None,
            "nearest": {"name": near[0], "distanceM": near[1]} if near else None,
        }
    return {"status": "unavailable", "population": None, "nearest": None}
