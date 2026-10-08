"""이동매체 운행 지역 — 시·도/구 이름과 행정구역 경계로 지도 영역과 겹치는지 판단한다.

이동매체는 좌표가 없고 운행 시·도(media.city)와 운행 구(media.district, 쉼표 구분 — 비면 시·도
전역)만 입력한다. 매체 찾기 목록을 지도 영역으로 거를 때 필요한 범위는 저장하지 않고 경계
데이터로 그때그때 계산한다(입력한 구와 범위가 어긋날 일이 없게).

- 서울: 구 경계(assets/geo/seoul-gu.json).
- 그 밖의 시·도: 시·도 경계(assets/geo/korea-sido.json). 구·시·군을 적어도 시·도 전체로 본다.
- "전국"·비어 있음·알 수 없는 이름: 범위 없음 — 지도 어디를 보든 목록에 나온다.

사각형 범위로만 비교하면 경기도처럼 서울을 둘러싼 지역이 서울 어디를 봐도 걸리므로, 경계 다각형과
지도 영역(사각형)이 실제로 겹치는지 본다. 경계 파일은 프런트 public/geo 와 같은 파일이다
(southkorea-maps, kostat 2013, 간략화).
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

NATIONWIDE = "전국"
SEOUL = "서울특별시"

# (북위 최대, 북위 최소, 동경 최대, 동경 최소)
Bounds = tuple[float, float, float, float]
# 외곽선 — [(경도, 위도), ...]
Ring = list[tuple[float, float]]

_GEO_DIR = Path(__file__).resolve().parent.parent / "assets" / "geo"

# (공식 이름, 짧은 이름, 옛 이름들) — 경계 파일의 이름은 공식 이름이다.
_PROVINCES: list[tuple[str, str, tuple[str, ...]]] = [
    ("서울특별시", "서울", ()),
    ("부산광역시", "부산", ()),
    ("대구광역시", "대구", ()),
    ("인천광역시", "인천", ()),
    ("광주광역시", "광주", ()),
    ("대전광역시", "대전", ()),
    ("울산광역시", "울산", ()),
    ("세종특별자치시", "세종", ()),
    ("경기도", "경기", ()),
    ("강원특별자치도", "강원", ("강원도",)),
    ("충청북도", "충북", ()),
    ("충청남도", "충남", ()),
    ("전북특별자치도", "전북", ("전라북도",)),
    ("전라남도", "전남", ()),
    ("경상북도", "경북", ()),
    ("경상남도", "경남", ()),
    ("제주특별자치도", "제주", ("제주도",)),
]

# 입력값(공식·짧은·옛 이름) → 공식 이름
_CANONICAL: dict[str, str] = {}
_SHORT: dict[str, str] = {}
for _full, _short, _aliases in _PROVINCES:
    for _name in (_full, _short, *_aliases):
        _CANONICAL[_name] = _full
    _SHORT[_full] = _short


class _Region:
    def __init__(self, rings: list[Ring]):
        self.rings = rings
        pts = [p for ring in rings for p in ring]
        self.bounds: Bounds = (
            max(p[1] for p in pts),
            min(p[1] for p in pts),
            max(p[0] for p in pts),
            min(p[0] for p in pts),
        )


def _load(file: str, key: str) -> dict[str, _Region]:
    data = json.loads((_GEO_DIR / file).read_text(encoding="utf-8"))
    return {
        r["name"]: _Region([[(x, y) for x, y in ring] for ring in r["rings"]])
        for r in data[key]
    }


@lru_cache(maxsize=1)
def _seoul_gu() -> dict[str, _Region]:
    return _load("seoul-gu.json", "districts")


@lru_cache(maxsize=1)
def _sido() -> dict[str, _Region]:
    return _load("korea-sido.json", "provinces")


def seoul_gu_names() -> list[str]:
    return list(_seoul_gu())


def canonical_city(city: str | None) -> str | None:
    """시·도 이름을 공식 이름으로. "전국"은 그대로, 모르는 이름은 None."""
    city = (city or "").strip()
    if city == NATIONWIDE:
        return NATIONWIDE
    return _CANONICAL.get(city)


def city_names(canon: str) -> list[str]:
    """공식 시·도 이름 → 입력에 쓰일 수 있는 이름 전부(공식·짧은·옛 이름)."""
    return [name for name, c in _CANONICAL.items() if c == canon]


def province_order() -> list[str]:
    """시·도 공식 이름 — 화면에 보여 줄 순서(서울·광역시·도)."""
    return [full for full, _, _ in _PROVINCES]


def short_city(city: str | None) -> str | None:
    """카드에 보여 줄 짧은 이름 — "서울특별시" → "서울". 모르는 이름은 입력 그대로."""
    canon = canonical_city(city)
    if canon == NATIONWIDE:
        return NATIONWIDE
    if canon:
        return _SHORT[canon]
    return (city or "").strip() or None


def parse_districts(district: str | None) -> list[str]:
    return [d.strip() for d in (district or "").split(",") if d.strip()]


def area_bounds(city: str | None, districts: list[str]) -> Bounds | None:
    """운행 범위(사각형) — 서울은 고른 구를 합친 범위(구가 없거나 모르는 구뿐이면 서울 전체), 그 밖은 시·도."""
    canon = canonical_city(city)
    if canon is None or canon == NATIONWIDE:
        return None
    regions = [_seoul_gu()[d] for d in districts if d in _seoul_gu()] if canon == SEOUL else []
    if not regions:
        regions = [_sido()[canon]]
    boxes = [r.bounds for r in regions]
    return (
        max(b[0] for b in boxes),
        min(b[1] for b in boxes),
        max(b[2] for b in boxes),
        min(b[3] for b in boxes),
    )


# ── 다각형 ∩ 사각형 ──────────────────────────────────────────────


def _point_in_ring(x: float, y: float, ring: Ring) -> bool:
    inside = False
    for i in range(len(ring)):
        x1, y1 = ring[i]
        x2, y2 = ring[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def _segments_cross(a, b, c, d) -> bool:
    def orient(p, q, r):
        v = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
        return (v > 0) - (v < 0)

    return orient(a, b, c) != orient(a, b, d) and orient(c, d, a) != orient(c, d, b)


def _region_overlaps(region: _Region, vp: Bounds) -> bool:
    ne_lat, sw_lat, ne_lng, sw_lng = vp
    b = region.bounds
    if b[1] > ne_lat or b[0] < sw_lat or b[3] > ne_lng or b[2] < sw_lng:
        return False
    corners = [(sw_lng, sw_lat), (ne_lng, sw_lat), (ne_lng, ne_lat), (sw_lng, ne_lat)]
    edges = list(zip(corners, corners[1:] + corners[:1]))
    for ring in region.rings:
        # 경계의 꼭짓점이 영역 안 → 겹침
        if any(sw_lng <= x <= ne_lng and sw_lat <= y <= ne_lat for x, y in ring):
            return True
        # 영역이 경계 안에 통째로 들어감
        if _point_in_ring(sw_lng, sw_lat, ring):
            return True
        # 경계선이 영역 변을 가로지름
        for i in range(len(ring)):
            p, q = ring[i - 1], ring[i]
            if any(_segments_cross(p, q, c, d) for c, d in edges):
                return True
    return False


def viewport_matches(ne_lat: float, sw_lat: float, ne_lng: float, sw_lng: float) -> dict:
    """지도 영역과 겹치는 지역 — 매체 찾기 목록 SQL 조건에 쓴다.

    반환: cities(겹치는 서울 외 시·도의 입력 가능 이름 전부), seoul_names(서울 입력 가능 이름),
    seoul_overlaps(서울이 겹치는지), seoul_gus(겹치는 서울 구), known_names(알려진 시·도 이름 전부).
    """
    vp = (ne_lat, sw_lat, ne_lng, sw_lng)
    hit = {name for name, region in _sido().items() if _region_overlaps(region, vp)}
    return dict(
        cities=[n for n, c in _CANONICAL.items() if c in hit and c != SEOUL],
        seoul_names=[n for n, c in _CANONICAL.items() if c == SEOUL],
        seoul_overlaps=SEOUL in hit,
        seoul_gus=[gu for gu, region in _seoul_gu().items() if _region_overlaps(region, vp)]
        if SEOUL in hit
        else [],
        known_names=list(_CANONICAL) + [NATIONWIDE],
    )
