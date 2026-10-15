"""서울 지하철·버스 일별 승하차 인원 — 역·정류장 위치와 하루 합계를 transit_station / transit_ridership 에 채운다.

- 지하철: 서울 열린데이터광장 OpenAPI `CardSubwayStatsNew`(노선·역별 하루 승하차, 하루 약 620줄).
  역 이름의 괄호(부역명)는 떼고, 같은 이름의 노선(환승역)은 한 역으로 묶는다. 위치는 `subwayStationMaster`.
- 버스: `CardBusStatisticsServiceNew`(노선·정류장별 하루 승하차, 하루 약 4만 줄). 노선별 값을 정류장으로 더한다.
  위치는 `tbisMasterStation`(정류장 ID = STOPS_ID). 위치를 모르는 역·정류장(서울 밖 등)은 넣지 않는다.
- 키는 실시간 인구·상권과 같은 SEOUL_OPENAPI_KEY. 서울시는 사흘쯤 뒤에 공개하므로(어제 값은 아직 없다) 공개된 가장
  최근 날을 쓴다. 오래된 날(KEEP_DAYS 넘게 지난 날)은 지운다.
- 매체 찾기 지도에서 실시간 인구 장소를 누르면 그 범위 안 역·정류장의 가장 최근 날 값을 보여 준다(transit_in_place).

백엔드가 켜져 있는 동안 SYNC_INTERVAL_S 마다 start_daily_sync() 스레드가 sync_new_days()를 부른다.
처음 채우거나 바로 갱신할 때는 scripts/sync_transit.py 를 쓴다.
"""
from __future__ import annotations

import datetime as dt
import logging
import math
import re
import threading
import time

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

from src.config import get_settings
from src.services import seoul_citydata as cd

logger = logging.getLogger(__name__)

BASE_URL = "http://openapi.seoul.go.kr:8088/{key}/json/{service}/{start}/{end}/{arg}"
PAGE_SIZE = 1000  # 서울시 OpenAPI 한 번에 최대 1,000건
TIMEOUT_S = 60.0
# 서울시가 하루 중 언제 공개하는지 정해져 있지 않아 6시간마다 확인한다.
SYNC_INTERVAL_S = 6 * 60 * 60
# DB가 비어 있을 때 어제부터 며칠 거슬러 올라가며 공개된 가장 최근 날을 찾을지
FIRST_LOOKBACK_DAYS = 10
# 이만큼 지난 날은 지운다(버스가 하루 약 1만 줄).
KEEP_DAYS = 31
# 장소 범위 밖이어도 이만큼(m) 안이면 그 장소의 역·정류장으로 친다 — 역 출구가 범위 테두리에 걸치는 경우.
PLACE_MARGIN_M = 200
BUS_TOP_N = 5

KINDS = ("subway", "bus")
_RIDERSHIP_SERVICE = {"subway": "CardSubwayStatsNew", "bus": "CardBusStatisticsServiceNew"}

_STATION_UPSERT = text(
    """
    INSERT INTO transit_station (station_id, kind, name, lines, latitude, longitude)
    VALUES (:station_id, :kind, :name, :lines, :latitude, :longitude)
    ON CONFLICT (station_id) DO UPDATE SET
        kind = EXCLUDED.kind, name = EXCLUDED.name, lines = EXCLUDED.lines,
        latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude
    """
)
_RIDERSHIP_UPSERT = text(
    """
    INSERT INTO transit_ridership (station_id, use_date, kind, ride_count, alight_count, lines)
    VALUES (:station_id, :use_date, :kind, :ride_count, :alight_count, :lines)
    ON CONFLICT (station_id, use_date) DO UPDATE SET
        kind = EXCLUDED.kind, ride_count = EXCLUDED.ride_count, alight_count = EXCLUDED.alight_count,
        lines = EXCLUDED.lines
    """
)


def next_day(day: str) -> str:
    """"20261231" → "20270101"."""
    return (dt.datetime.strptime(day, "%Y%m%d") + dt.timedelta(days=1)).strftime("%Y%m%d")


def prev_day(day: str) -> str:
    return (dt.datetime.strptime(day, "%Y%m%d") - dt.timedelta(days=1)).strftime("%Y%m%d")


def _today() -> str:
    return dt.date.today().strftime("%Y%m%d")


def subway_key(name: str) -> str:
    """"잠실(송파구청)" → "잠실" — 부역명을 떼어 노선마다 다른 표기를 한 역으로 묶는다."""
    return re.sub(r"\(.*?\)", "", name or "").strip()


def _num(v) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _get_json(url: str, tries: int = 3) -> dict:
    """서울시가 가끔 빈 응답·HTML 오류를 돌려줘(4만 줄을 40쪽 넘게 받다 보면) 잠깐 쉬고 다시 묻는다."""
    for attempt in range(tries):
        try:
            resp = httpx.get(url, timeout=TIMEOUT_S)
            resp.raise_for_status()
            return resp.json()
        except (httpx.HTTPError, ValueError):
            if attempt == tries - 1:
                raise
            time.sleep(2 * (attempt + 1))
    return {}


def _fetch_all(service: str, key: str, arg: str = "") -> list[dict]:
    """서비스 하나의 모든 줄(1,000건씩 나눠 받기). 공개 전·데이터 없음이면 빈 목록."""
    rows: list[dict] = []
    start = 1
    while True:
        url = BASE_URL.format(key=key, service=service, start=start, end=start + PAGE_SIZE - 1, arg=arg)
        body = _get_json(url).get(service)
        if not body:  # INFO-200 해당하는 데이터가 없습니다 등
            return rows
        page = body.get("row") or []
        rows.extend(page)
        total = int(body.get("list_total_count") or 0)
        start += PAGE_SIZE
        if not page or start > total:
            return rows


# ===== 위치 =====


def subway_stations(rows: list[dict]) -> list[dict]:
    """subwayStationMaster 줄 → 역 이름별 한 줄(노선 묶음, 좌표는 노선별 좌표의 평균)."""
    grouped: dict[str, dict] = {}
    for r in rows:
        lat, lng = _num(r.get("LAT")), _num(r.get("LOT"))
        name = subway_key(r.get("BLDN_NM"))
        if not name or not lat or not lng:
            continue
        g = grouped.setdefault(name, {"lines": [], "lats": [], "lngs": []})
        if r.get("ROUTE") and r["ROUTE"] not in g["lines"]:
            g["lines"].append(r["ROUTE"])
        g["lats"].append(lat)
        g["lngs"].append(lng)
    return [
        dict(
            station_id=f"subway:{name}",
            kind="subway",
            name=name,
            lines=",".join(g["lines"]),
            latitude=sum(g["lats"]) / len(g["lats"]),
            longitude=sum(g["lngs"]) / len(g["lngs"]),
        )
        for name, g in grouped.items()
    ]


def bus_stations(rows: list[dict]) -> list[dict]:
    """tbisMasterStation 줄 → 정류장(ID·이름·정류장 번호·좌표)."""
    out = []
    for r in rows:
        lat, lng = _num(r.get("LAT")), _num(r.get("LOT"))
        if not r.get("CRTR_ID") or not lat or not lng:
            continue
        out.append(
            dict(
                station_id=f"bus:{r['CRTR_ID']}",
                kind="bus",
                name=(r.get("CRTR_NM") or "").strip(),
                lines=(r.get("CRTR_NO") or "").strip() or None,
                latitude=lat,
                longitude=lng,
            )
        )
    return out


def sync_stations(db: Session) -> int:
    """지하철역·버스정류장 위치를 모두 받아 넣는다. 넣은 수를 돌려준다(키가 없으면 0)."""
    key = get_settings().seoul_openapi_key
    if not key:
        return 0
    rows = subway_stations(_fetch_all("subwayStationMaster", key)) + bus_stations(
        _fetch_all("tbisMasterStation", key)
    )
    if rows:
        db.execute(_STATION_UPSERT, rows)
        db.commit()
        logger.info("지하철역·버스정류장 위치 %d곳 저장", len(rows))
    return len(rows)


def stations_in_db(db: Session) -> int:
    return db.execute(text("SELECT count(*) FROM transit_station")).scalar() or 0


# ===== 일별 승하차 =====


def ridership_rows(kind: str, day: str, rows: list[dict]) -> list[dict]:
    """서울시 줄(노선·역 또는 노선·정류장) → 역·정류장별 하루 승차·하차 합계(지하철은 들어간 노선도)."""
    totals: dict[str, list[int]] = {}
    lines: dict[str, list[str]] = {}
    for r in rows:
        if kind == "subway":
            name = subway_key(r.get("SBWY_STNS_NM"))
            sid = f"subway:{name}" if name else None
        else:
            sid = f"bus:{r['STOPS_ID']}" if r.get("STOPS_ID") else None
        if not sid:
            continue
        t = totals.setdefault(sid, [0, 0])
        t[0] += round(_num(r.get("GTON_TNOPE")))
        t[1] += round(_num(r.get("GTOFF_TNOPE")))
        line = kind == "subway" and r.get("SBWY_ROUT_LN_NM")
        if line and line not in lines.setdefault(sid, []):
            lines[sid].append(line)
    return [
        dict(
            station_id=sid,
            use_date=day,
            kind=kind,
            ride_count=on,
            alight_count=off,
            lines=",".join(lines[sid]) if lines.get(sid) else None,
        )
        for sid, (on, off) in totals.items()
    ]


def fetch_day(kind: str, day: str, key: str) -> list[dict]:
    return ridership_rows(kind, day, _fetch_all(_RIDERSHIP_SERVICE[kind], key, day))


def latest_day_in_db(db: Session, kind: str) -> str | None:
    return db.execute(
        text("SELECT max(use_date) FROM transit_ridership WHERE kind = :kind"), {"kind": kind}
    ).scalar()


def _save(db: Session, kind: str, day: str, rows: list[dict]) -> None:
    # 위치를 아는 역·정류장만 — 서울 밖 역(평택지제 등)·좌표 없는 정류장은 지도에 올릴 수 없다.
    known = {
        r[0]
        for r in db.execute(text("SELECT station_id FROM transit_station WHERE kind = :kind"), {"kind": kind})
    }
    rows = [r for r in rows if r["station_id"] in known]
    if rows:
        db.execute(_RIDERSHIP_UPSERT, rows)
    db.commit()
    logger.info("%s 승하차 %s %d곳 저장", "지하철" if kind == "subway" else "버스", day, len(rows))


def earliest_day_in_db(db: Session, kind: str) -> str | None:
    return db.execute(
        text("SELECT min(use_date) FROM transit_ridership WHERE kind = :kind"), {"kind": kind}
    ).scalar()


def backfill_days(db: Session, kind: str, key: str) -> list[str]:
    """DB 가장 오래된 날 앞으로 KEEP_DAYS 안쪽 날들을 거슬러 받아 넣는다(이미 채워졌으면 아무것도 안 함)."""
    earliest = earliest_day_in_db(db, kind)
    if earliest is None:
        return []
    cutoff = (dt.datetime.strptime(_today(), "%Y%m%d") - dt.timedelta(days=KEEP_DAYS)).strftime("%Y%m%d")
    added: list[str] = []
    day = prev_day(earliest)
    while day >= cutoff:
        rows = fetch_day(kind, day, key)
        if not rows:
            break
        _save(db, kind, day, rows)
        added.append(f"{kind}:{day}")
        day = prev_day(day)
    return added


def sync_new_days(db: Session) -> list[str]:
    """종류마다 DB 마지막 날 다음 날부터 어제까지 공개된 날을 받아 넣는다. 넣은 "subway:20261011" 같은 목록을 돌려준다.

    DB가 비어 있으면 어제부터 FIRST_LOOKBACK_DAYS 일 거슬러 공개된 가장 최근 하루만 받는다(처음에 오래 걸리지 않게).
    지하철은 이어서 KEEP_DAYS 안쪽 지난 날들도 거슬러 채운다(backfill_days).
    """
    key = get_settings().seoul_openapi_key
    if not key:
        return []
    if stations_in_db(db) == 0:
        sync_stations(db)
    today = _today()
    added: list[str] = []
    for kind in KINDS:
        latest = latest_day_in_db(db, kind)
        if latest is None:
            day = prev_day(today)
            for _ in range(FIRST_LOOKBACK_DAYS):
                rows = fetch_day(kind, day, key)
                if rows:
                    _save(db, kind, day, rows)
                    added.append(f"{kind}:{day}")
                    break
                day = prev_day(day)
            continue
        day = next_day(latest)
        # 오늘 값은 아직 다 모이지 않았다 — 어제까지만(보통 사흘쯤 늦게 공개돼 그 앞에서 멈춘다).
        while day < today:
            rows = fetch_day(kind, day, key)
            if not rows:
                break
            _save(db, kind, day, rows)
            added.append(f"{kind}:{day}")
            day = next_day(day)
    # 지하철은 KEEP_DAYS 동안을 채워 둔다 — 지하철역 안 매체의 월평균·요일별 승하차(media_service._station_population).
    added += backfill_days(db, "subway", key)
    if added:
        cutoff = (dt.date.today() - dt.timedelta(days=KEEP_DAYS)).strftime("%Y%m%d")
        db.execute(text("DELETE FROM transit_ridership WHERE use_date < :cutoff"), {"cutoff": cutoff})
        db.commit()
        # 역·정류장 위치는 바뀌는 일이 드물어 매달 1일 다음 첫 갱신 때만 다시 받는다.
        if any(a.endswith("01") for a in added):
            sync_stations(db)
    return added


def start_daily_sync() -> None:
    """백엔드가 켜져 있는 동안 SYNC_INTERVAL_S 마다 새 날을 확인한다(키가 없으면 시작하지 않는다)."""
    if not get_settings().seoul_openapi_key:
        return

    def loop() -> None:
        from src.database import SessionLocal

        while True:
            try:
                with SessionLocal() as db:
                    sync_new_days(db)
            except Exception:  # 서울시 장애·DB 오류가 있어도 다음 확인 때 다시 시도한다.
                logger.exception("지하철·버스 승하차 자동 갱신 실패")
            time.sleep(SYNC_INTERVAL_S)

    threading.Thread(target=loop, name="transit-sync", daemon=True).start()


# ===== 지도: 실시간 인구 장소의 지하철·버스 =====


def _in_place(place, lat: float, lng: float) -> bool:
    if any(cd._point_in_ring(lng, lat, r) for r in place.rings):
        return True
    return min(cd._distance_to_ring_m(lng, lat, r) for r in place.rings) <= PLACE_MARGIN_M


def transit_in_place(db: Session, code: str) -> dict | None:
    """실시간 인구 장소(서울시 주요 121장소) 범위 안 지하철역·버스정류장의 가장 최근 날 승하차.

    {"name", "subway": {"date", "stations": [{name, lines, ride, alight}]},
     "bus": {"date", "stopCount", "ride", "alight", "top": [{name, arsNo, ride, alight}]}}
    date 는 "20261011". 장소 코드를 모르면 None. 데이터가 아직 없으면 date 가 None 이고 목록이 빈다.
    """
    place = next((p for p in cd._places() if p.code == code), None)
    if place is None:
        return None
    lat_c = (place.min_y + place.max_y) / 2
    dy = PLACE_MARGIN_M / cd._M_PER_DEG_LAT
    dx = PLACE_MARGIN_M / (cd._M_PER_DEG_LNG * math.cos(math.radians(lat_c)))
    days = {kind: latest_day_in_db(db, kind) for kind in KINDS}
    rows = db.execute(
        text(
            """
            SELECT s.station_id, s.kind, s.name, s.lines, s.latitude, s.longitude,
                   r.use_date, r.ride_count, r.alight_count, r.lines AS counted_lines
            FROM transit_station s
            JOIN transit_ridership r ON r.station_id = s.station_id
             AND r.use_date = CASE s.kind WHEN 'subway' THEN :subway_day ELSE :bus_day END
            WHERE s.latitude BETWEEN :lat0 AND :lat1 AND s.longitude BETWEEN :lng0 AND :lng1
            """
        ),
        {
            "lat0": place.min_y - dy,
            "lat1": place.max_y + dy,
            "lng0": place.min_x - dx,
            "lng1": place.max_x + dx,
            "subway_day": days["subway"],
            "bus_day": days["bus"],
        },
    ).all()
    rows = [r for r in rows if _in_place(place, r.latitude, r.longitude)]
    subway = sorted((r for r in rows if r.kind == "subway"), key=lambda r: -(r.ride_count + r.alight_count))
    bus = sorted((r for r in rows if r.kind == "bus"), key=lambda r: -(r.ride_count + r.alight_count))
    return dict(
        name=place.name,
        subway=dict(
            date=days["subway"],
            stations=[
                dict(
                    name=r.name,
                    # 승하차 합계에 들어간 노선(없으면 역 정보의 노선).
                    lines=[x for x in (r.counted_lines or r.lines or "").split(",") if x],
                    ride=int(r.ride_count),
                    alight=int(r.alight_count),
                )
                for r in subway
            ],
        ),
        bus=dict(
            date=days["bus"],
            stopCount=len(bus),
            ride=sum(int(r.ride_count) for r in bus),
            alight=sum(int(r.alight_count) for r in bus),
            top=[
                dict(name=r.name, arsNo=r.lines, ride=int(r.ride_count), alight=int(r.alight_count))
                for r in bus[:BUS_TOP_N]
            ],
        ),
    )
