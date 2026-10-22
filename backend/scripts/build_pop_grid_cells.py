"""유동인구 격자 지도의 격자 목록(src/assets/geo/pop-grid-cells.json)을 만든다 — 한 번만 돌리는 스크립트.

원본은 유동인구 지도 인계 패키지의 `5_격자체류인구/_indexes/격자_지도데이터_v2.json`(서울 250m 격자 8,617칸).
칸 순서가 인계 월 파일(period/YYYYMM.js)·어드민 업로드 파일의 값 순서와 같아야 하므로 원본 순서를 그대로 둔다.

격자 코드 "다사52505350" = 국가지점번호 방식(EPSG:5179, UTM-K) 왼쪽 아래 모서리 — 앞 두 글자가 100km 칸,
뒤 숫자 4자리씩이 그 안의 x·y(10m 단위). 네 모서리를 위경도로 바꿔 지도에 사각형으로 그린다.

사용: python scripts/build_pop_grid_cells.py <격자_지도데이터_v2.json 경로>
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "src" / "assets" / "geo" / "pop-grid-cells.json"
LETTERS = "가나다라마바사아"
CELL_M = 250

# UTM-K(EPSG:5179) — GRS80 타원체, 원점 위도 38°·경도 127.5°, 축척 0.9996, 가산 x 1,000,000 · y 2,000,000.
_A = 6378137.0
_F = 1 / 298.257222101
_E2 = _F * (2 - _F)
_EP2 = _E2 / (1 - _E2)
_K0 = 0.9996
_LAT0 = math.radians(38.0)
_LON0 = math.radians(127.5)
_FE, _FN = 1_000_000.0, 2_000_000.0


def _meridian(phi: float) -> float:
    e2, e4, e6 = _E2, _E2**2, _E2**3
    return _A * (
        (1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi
        - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * math.sin(2 * phi)
        + (15 * e4 / 256 + 45 * e6 / 1024) * math.sin(4 * phi)
        - (35 * e6 / 3072) * math.sin(6 * phi)
    )


_M0 = _meridian(_LAT0)


def utmk_to_wgs84(x: float, y: float) -> tuple[float, float]:
    """UTM-K 좌표(m) → (위도, 경도). 횡메르카토르 역변환(Snyder) — 서울 범위에서 1cm 안팎."""
    m = _M0 + (y - _FN) / _K0
    mu = m / (_A * (1 - _E2 / 4 - 3 * _E2**2 / 64 - 5 * _E2**3 / 256))
    e1 = (1 - math.sqrt(1 - _E2)) / (1 + math.sqrt(1 - _E2))
    phi1 = (
        mu
        + (3 * e1 / 2 - 27 * e1**3 / 32) * math.sin(2 * mu)
        + (21 * e1**2 / 16 - 55 * e1**4 / 32) * math.sin(4 * mu)
        + (151 * e1**3 / 96) * math.sin(6 * mu)
        + (1097 * e1**4 / 512) * math.sin(8 * mu)
    )
    s, c, t = math.sin(phi1), math.cos(phi1), math.tan(phi1)
    n1 = _A / math.sqrt(1 - _E2 * s * s)
    r1 = _A * (1 - _E2) / (1 - _E2 * s * s) ** 1.5
    c1 = _EP2 * c * c
    t1 = t * t
    d = (x - _FE) / (n1 * _K0)
    lat = phi1 - (n1 * t / r1) * (
        d**2 / 2
        - (5 + 3 * t1 + 10 * c1 - 4 * c1**2 - 9 * _EP2) * d**4 / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1**2 - 252 * _EP2 - 3 * c1**2) * d**6 / 720
    )
    lon = _LON0 + (
        d
        - (1 + 2 * t1 + c1) * d**3 / 6
        + (5 - 2 * c1 + 28 * t1 - 3 * c1**2 + 8 * _EP2 + 24 * t1**2) * d**5 / 120
    ) / c
    return math.degrees(lat), math.degrees(lon)


def cell_origin(code: str) -> tuple[int, int]:
    """격자 코드 → 왼쪽 아래 모서리 UTM-K 좌표(m)."""
    x = 700_000 + LETTERS.index(code[0]) * 100_000 + int(code[2:6]) * 10
    y = 1_300_000 + LETTERS.index(code[1]) * 100_000 + int(code[6:10]) * 10
    return x, y


def main(src: str) -> None:
    data = json.loads(Path(src).read_text(encoding="utf-8"))
    fields = data["fields"]
    i_cell, i_lat, i_lon, i_gu, i_dong = (fields.index(k) for k in ("cell", "lat", "lon", "gu", "dong"))
    cells = []
    worst = 0.0
    for row in data["cells"]:
        code = row[i_cell]
        x, y = cell_origin(code)
        # 모서리 넷(왼아래·오른아래·오른위·왼위) — 서울은 UTM-K 중앙 경선(127.5°)에서 조금 서쪽이라 격자가 0.3°쯤 기운다.
        corners = [utmk_to_wgs84(x + dx, y + dy) for dx, dy in ((0, 0), (CELL_M, 0), (CELL_M, CELL_M), (0, CELL_M))]
        clat, clon = utmk_to_wgs84(x + CELL_M / 2, y + CELL_M / 2)
        worst = max(worst, abs(clat - row[i_lat]) * 111_000, abs(clon - row[i_lon]) * 88_000)
        cells.append([code, row[i_gu], row[i_dong], [round(v, 6) for c in corners for v in c]])
    if worst > 5:
        raise SystemExit(f"중심 좌표가 원본과 {worst:.1f}m 어긋남 — 좌표계 확인 필요")
    OUT.write_text(
        json.dumps(
            {
                "source": "유동인구 지도 인계 패키지 격자_지도데이터_v2.json (서울 250m 격자)",
                "fields": ["code", "gu", "dong", "corners(위도,경도 ×4: 왼아래·오른아래·오른위·왼위)"],
                "cells": cells,
            },
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    print(f"{len(cells)} cells → {OUT} (원본 중심과 최대 {worst:.2f}m 차이)")


if __name__ == "__main__":
    main(sys.argv[1])
