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
import threading
import time

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

from src.config import get_settings

logger = logging.getLogger(__name__)

API_URL = "http://openapi.seoul.go.kr:8088/{key}/json/VwsmTrdarFlpopQq/{start}/{end}/{quarter}"
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
