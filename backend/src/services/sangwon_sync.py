"""서울시 상권분석서비스 길단위인구(상권) — 분기별 상권 유동인구를 sangwon_population 에 채운다.

- 서울 열린데이터광장 OpenAPI `VwsmTrdarFlpopQq`(상권 약 1,650곳, 분기마다 공개). 키는 실시간 인구와 같다.
- DB에 있는 마지막 분기 다음 분기부터 차례로 받아, 서울시가 아직 공개하지 않은 분기를 만나면 멈춘다.
- 값은 분기 합계다(요일별·시간대별 값을 더하면 총 유동인구와 같다). 화면의 월평균은 3으로 나눠 보여 준다.
- 매체 정보 팝업은 그 상권의 가장 최신 분기, 매체 정렬(비율순)은 DB 전체의 최신 분기를 쓴다.

백엔드가 켜져 있는 동안 하루 한 번 start_daily_sync() 스레드가 sync_new_quarters()를 부른다.
처음 채우거나 바로 갱신할 때는 scripts/sync_sangwon_population.py 를 쓴다.
"""
from __future__ import annotations

import logging
import math
import threading
import time

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

from src.config import get_settings

logger = logging.getLogger(__name__)

API_URL = "http://openapi.seoul.go.kr:8088/{key}/json/VwsmTrdarFlpopQq/{start}/{end}/{quarter}"
# 상권 영역(위치) — 상권 1,650곳의 중심 좌표(서울시 TM, EPSG:5181)·구·동
AREA_URL = "http://openapi.seoul.go.kr:8088/{key}/json/TbgisTrdarRelm/{start}/{end}/"
PAGE_SIZE = 1000  # 서울시 OpenAPI 한 번에 최대 1,000건
TIMEOUT_S = 30.0
SYNC_INTERVAL_S = 24 * 60 * 60
# DB가 비어 있을 때 시작할 분기
FIRST_QUARTER = "20191"

_UPSERT = text(
    """
    INSERT INTO sangwon_population (
        sangwon_code, quarter_code, sangwon_name, total_foot_traffic,
        male_foot, female_foot,
        age_10_foot, age_20_foot, age_30_foot, age_40_foot, age_50_foot, age_60_foot
    ) VALUES (
        :sangwon_code, :quarter_code, :sangwon_name, :total_foot_traffic,
        :male_foot, :female_foot,
        :age_10_foot, :age_20_foot, :age_30_foot, :age_40_foot, :age_50_foot, :age_60_foot
    )
    ON CONFLICT (sangwon_code, quarter_code) DO UPDATE SET
        sangwon_name = EXCLUDED.sangwon_name,
        total_foot_traffic = EXCLUDED.total_foot_traffic,
        male_foot = EXCLUDED.male_foot,
        female_foot = EXCLUDED.female_foot,
        age_10_foot = EXCLUDED.age_10_foot,
        age_20_foot = EXCLUDED.age_20_foot,
        age_30_foot = EXCLUDED.age_30_foot,
        age_40_foot = EXCLUDED.age_40_foot,
        age_50_foot = EXCLUDED.age_50_foot,
        age_60_foot = EXCLUDED.age_60_foot
    """
)


# ===== 상권 위치(영역) =====
# 서울시 상권 영역 좌표는 TM 중부원점(EPSG:5181 — GRS80, 원점 38°N 127°E, 가산 200000/500000)이다.
_A = 6378137.0
_F = 1 / 298.257222101
_E2 = _F * (2 - _F)
_LAT0, _LON0 = math.radians(38.0), math.radians(127.0)
_FE, _FN = 200000.0, 500000.0


def _meridian_arc(phi: float) -> float:
    e2 = _E2
    return _A * (
        (1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256) * phi
        - (3 * e2 / 8 + 3 * e2**2 / 32 + 45 * e2**3 / 1024) * math.sin(2 * phi)
        + (15 * e2**2 / 256 + 45 * e2**3 / 1024) * math.sin(4 * phi)
        - (35 * e2**3 / 3072) * math.sin(6 * phi)
    )


def tm_to_wgs84(x: float, y: float) -> tuple[float, float]:
    """서울시 TM(EPSG:5181) 좌표 → (위도, 경도). 횡메르카토르 역변환(Snyder) — 서울 범위에서 1m 안쪽 오차."""
    e2 = _E2
    ep2 = e2 / (1 - e2)
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    m = _meridian_arc(_LAT0) + (y - _FN)
    mu = m / (_A * (1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256))
    phi1 = (
        mu
        + (3 * e1 / 2 - 27 * e1**3 / 32) * math.sin(2 * mu)
        + (21 * e1**2 / 16 - 55 * e1**4 / 32) * math.sin(4 * mu)
        + (151 * e1**3 / 96) * math.sin(6 * mu)
        + (1097 * e1**4 / 512) * math.sin(8 * mu)
    )
    sin1, cos1, tan1 = math.sin(phi1), math.cos(phi1), math.tan(phi1)
    c1 = ep2 * cos1**2
    t1 = tan1**2
    n1 = _A / math.sqrt(1 - e2 * sin1**2)
    r1 = _A * (1 - e2) / (1 - e2 * sin1**2) ** 1.5
    d = (x - _FE) / n1
    lat = phi1 - (n1 * tan1 / r1) * (
        d**2 / 2
        - (5 + 3 * t1 + 10 * c1 - 4 * c1**2 - 9 * ep2) * d**4 / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1**2 - 252 * ep2 - 3 * c1**2) * d**6 / 720
    )
    lon = _LON0 + (
        d
        - (1 + 2 * t1 + c1) * d**3 / 6
        + (5 - 2 * c1 + 28 * t1 - 3 * c1**2 + 8 * ep2 + 24 * t1**2) * d**5 / 120
    ) / cos1
    return math.degrees(lat), math.degrees(lon)


# 칸 이름은 운영의 원천 표(sangwon_area, 원천 데이터 덤프)와 같다 — 마이그레이션 052 참고.
_AREA_UPSERT = text(
    """
    INSERT INTO sangwon_area (
        sangwon_code, sangwon_name, sangwon_type_code, sangwon_type_name, gu_code, gu_name,
        dong_code, dong_name, area_m2, tm_x, tm_y, latitude, longitude
    ) VALUES (
        :sangwon_code, :sangwon_name, :sangwon_type_code, :sangwon_type_name, :gu_code, :gu_name,
        :dong_code, :dong_name, :area_m2, :tm_x, :tm_y, :latitude, :longitude
    )
    ON CONFLICT (sangwon_code) DO UPDATE SET
        sangwon_name = EXCLUDED.sangwon_name,
        sangwon_type_code = EXCLUDED.sangwon_type_code,
        sangwon_type_name = EXCLUDED.sangwon_type_name,
        gu_code = EXCLUDED.gu_code,
        gu_name = EXCLUDED.gu_name,
        dong_code = EXCLUDED.dong_code,
        dong_name = EXCLUDED.dong_name,
        area_m2 = EXCLUDED.area_m2,
        tm_x = EXCLUDED.tm_x,
        tm_y = EXCLUDED.tm_y,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude
    """
)


def _area_row(r: dict) -> dict | None:
    try:
        x, y = float(r["XCNTS_VALUE"]), float(r["YDNTS_VALUE"])
        code = int(str(r["TRDAR_CD"]).strip())
    except (KeyError, TypeError, ValueError):
        return None
    lat, lng = tm_to_wgs84(x, y)
    text_or_none = lambda v: (str(v).strip() or None) if v is not None else None  # noqa: E731
    return dict(
        sangwon_code=code,
        sangwon_name=text_or_none(r.get("TRDAR_CD_NM")),
        sangwon_type_code=text_or_none(r.get("TRDAR_SE_CD")),
        sangwon_type_name=text_or_none(r.get("TRDAR_SE_CD_NM")),
        gu_code=_int(r.get("SIGNGU_CD")),
        gu_name=text_or_none(r.get("SIGNGU_CD_NM")),
        dong_code=_int(r.get("ADSTRD_CD")),
        dong_name=text_or_none(r.get("ADSTRD_CD_NM")),
        area_m2=_int(r.get("RELM_AR")),
        tm_x=round(x),
        tm_y=round(y),
        latitude=lat,
        longitude=lng,
    )


def sync_areas(db: Session) -> int:
    """상권 위치를 모두 받아 넣는다(약 1,650곳). 넣은 수를 돌려준다. 키가 없거나 실패하면 0."""
    key = get_settings().seoul_openapi_key
    if not key:
        return 0
    rows: list[dict] = []
    start = 1
    while True:
        resp = httpx.get(AREA_URL.format(key=key, start=start, end=start + PAGE_SIZE - 1), timeout=TIMEOUT_S)
        resp.raise_for_status()
        body = resp.json().get("TbgisTrdarRelm") or {}
        page = body.get("row") or []
        rows += [row for row in (_area_row(r) for r in page) if row]
        total = int(body.get("list_total_count") or 0)
        start += PAGE_SIZE
        if not page or start > total:
            break
    if rows:
        db.execute(_AREA_UPSERT, rows)
        db.commit()
        logger.info("상권 위치 %d곳 저장", len(rows))
    return len(rows)


def areas_in_db(db: Session) -> int:
    return db.execute(text("SELECT count(*) FROM sangwon_area")).scalar() or 0


def next_quarter(code: str) -> str:
    """"20254" → "20261"."""
    year, q = int(code[:4]), int(code[4:])
    return f"{year + 1}1" if q >= 4 else f"{year}{q + 1}"


def _int(v) -> int | None:
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def _to_row(r: dict) -> dict:
    return dict(
        sangwon_code=str(r["TRDAR_CD"]),
        quarter_code=str(r["STDR_YYQU_CD"]),
        sangwon_name=r.get("TRDAR_CD_NM"),
        total_foot_traffic=_int(r.get("TOT_FLPOP_CO")),
        male_foot=_int(r.get("ML_FLPOP_CO")),
        female_foot=_int(r.get("FML_FLPOP_CO")),
        age_10_foot=_int(r.get("AGRDE_10_FLPOP_CO")),
        age_20_foot=_int(r.get("AGRDE_20_FLPOP_CO")),
        age_30_foot=_int(r.get("AGRDE_30_FLPOP_CO")),
        age_40_foot=_int(r.get("AGRDE_40_FLPOP_CO")),
        age_50_foot=_int(r.get("AGRDE_50_FLPOP_CO")),
        age_60_foot=_int(r.get("AGRDE_60_ABOVE_FLPOP_CO")),
    )


def fetch_quarter(quarter: str, key: str) -> list[dict]:
    """한 분기의 상권 유동인구 전부. 아직 공개 전이면 빈 목록(서울시는 '데이터 없음' 응답)."""
    rows: list[dict] = []
    start = 1
    while True:
        url = API_URL.format(key=key, start=start, end=start + PAGE_SIZE - 1, quarter=quarter)
        resp = httpx.get(url, timeout=TIMEOUT_S)
        resp.raise_for_status()
        body = resp.json().get("VwsmTrdarFlpopQq")
        if not body:  # INFO-200 해당하는 데이터가 없습니다 등
            return rows
        page = body.get("row") or []
        rows.extend(_to_row(r) for r in page if str(r.get("STDR_YYQU_CD")) == quarter)
        total = int(body.get("list_total_count") or 0)
        start += PAGE_SIZE
        if not page or start > total:
            return rows


def latest_quarter_in_db(db: Session) -> str | None:
    return db.execute(text("SELECT max(quarter_code) FROM sangwon_population")).scalar()


def sync_new_quarters(db: Session) -> list[str]:
    """DB 마지막 분기 다음부터 공개된 분기를 받아 넣는다. 넣은 분기 목록을 돌려준다."""
    key = get_settings().seoul_openapi_key
    if not key:
        return []
    latest = latest_quarter_in_db(db)
    quarter = next_quarter(latest) if latest else FIRST_QUARTER
    added: list[str] = []
    while True:
        rows = fetch_quarter(quarter, key)
        if not rows:
            break
        db.execute(_UPSERT, rows)
        db.commit()
        logger.info("상권 유동인구 %s분기 %d곳 저장", quarter, len(rows))
        added.append(quarter)
        quarter = next_quarter(quarter)
    # 상권 위치가 아직 없으면(처음) 받는다 — 매체를 좌표로 상권에 잇는 데 쓴다. 새 분기가 나오면 영역도 다시 받는다.
    areas_added = 0
    if added or areas_in_db(db) == 0:
        areas_added = sync_areas(db)
    if added or areas_added:
        # 새 분기 인구·상권 위치로 매체의 상권 연결·믹시 타깃 태그·인구 요약을 다시 맞춘다.
        from src.services import ai_index

        ai_index.sync_all(db)
    return added


def start_daily_sync() -> None:
    """백엔드가 켜져 있는 동안 하루 한 번 새 분기를 확인한다(키가 없으면 시작하지 않는다)."""
    if not get_settings().seoul_openapi_key:
        return

    def loop() -> None:
        from src.database import SessionLocal

        while True:
            try:
                with SessionLocal() as db:
                    sync_new_quarters(db)
            except Exception:  # 서울시 장애·DB 오류가 있어도 다음 날 다시 시도한다.
                logger.exception("상권 유동인구 자동 갱신 실패")
            time.sleep(SYNC_INTERVAL_S)

    threading.Thread(target=loop, name="sangwon-sync", daemon=True).start()
