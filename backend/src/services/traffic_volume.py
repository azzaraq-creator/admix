"""서울시 교통량 — 측정 지점 139곳의 시간대 통행량을 날마다 받아 쌓고, 지도용 월평균을 낸다.

- 지점: 「서울시 교통량 지점 정보」(OA-13314, SpotInfo) — 이름·TM 좌표(EPSG:5181 → 위경도).
- 통행량: 「서울시 교통량 이력 정보」(OA-13316, VolInfo) — 지점 1곳 × 1시간씩만 물을 수 있어 하루치가 약 3,300번이다.
  유입(io_type 1)·유출(2) × 차로마다 대수가 오고, 모두 더한 것이 그 시간 그 지점의 통행량이다.
- 서버가 켜져 있는 동안 6시간마다 빠진 날을 최근 날부터 채운다(어제 → BACKFILL_DAYS 전까지, 한 번에 MAX_DAYS_PER_RUN일,
  지난 날을 채우는 동안은 10분 쉬고 이어 받는다).
  서울시가 막으면(호출 한도 등) 그날은 받은 것으로 치지 않고 멈췄다가 다음 차례에 다시 받는다.
- 매체 찾기 인구 분포 "차량": 고른 달의 지점별 하루 평균 통행량(값이 있는 날만으로 평균),
  지점이 있는 도로의 앞뒤 구간(도로 현황의 road_link) — 지도는 그 구간을 통행량 굵기 선으로 그린다.
"""
from __future__ import annotations

import json
import logging
import re
import xml.etree.ElementTree as ET
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

from src.config import get_settings
from src.services.sangwon_sync import tm_to_wgs84

logger = logging.getLogger(__name__)

XML_URL = "http://openapi.seoul.go.kr:8088/{key}/xml/{service}/{start}/{end}/{arg}"
TIMEOUT_S = 15.0
WORKERS = 10
# 지난 값은 최근 1년까지.
BACKFILL_DAYS = 365
# 한 번에 받는 날 수 — 하루 약 30초(3,300번).
MAX_DAYS_PER_RUN = 30
SYNC_INTERVAL_S = 6 * 60 * 60
BACKFILL_PAUSE_S = 10 * 60
KST = timezone(timedelta(hours=9))

_OK = "INFO-000"
_EMPTY = "INFO-200"  # 그 시간 값 없음
_SERVER_ERROR = "ERROR-500"


class TrafficApiError(RuntimeError):
    """서울시가 정상 응답을 주지 않음(호출 한도·키 오류·장애) — 그날은 받은 것으로 치지 않는다."""


def _url(key: str, service: str, arg: str, end: int = 1000) -> str:
    return XML_URL.format(key=key, service=service, start=1, end=end, arg=arg).rstrip("/")


def sync_spots(db: Session, client: httpx.Client, key: str) -> int:
    xml = client.get(_url(key, "SpotInfo", "", 1000)).text
    try:
        rows = [
            (r.findtext("spot_num"), r.findtext("spot_nm"), r.findtext("grs80tm_x"), r.findtext("grs80tm_y"))
            for r in ET.fromstring(xml).iter("row")
        ]
    except ET.ParseError:
        rows = []
    if not rows:
        raise TrafficApiError(f"지점 목록을 받지 못했어요: {xml[:200]}")
    for num, name, x, y in rows:
        lat, lng = tm_to_wgs84(float(x), float(y))
        db.execute(
            text(
                "INSERT INTO traffic_spot (spot_num, name, lat, lng) VALUES (:n, :nm, :lat, :lng) "
                "ON CONFLICT (spot_num) DO UPDATE SET name = :nm, lat = :lat, lng = :lng, updated_at = now()"
            ),
            {"n": num, "nm": name, "lat": lat, "lng": lng},
        )
    db.commit()
    return len(rows)


def _fetch_hour(client: httpx.Client, key: str, spot: str, ymd: str, hh: int) -> tuple[int, int] | None:
    """(유입, 유출) — 값이 없으면 None. 정상 응답이 아니면 TrafficApiError."""
    last = ""
    for attempt in range(4):
        if attempt:
            time.sleep(2 * attempt)
        try:
            xml = client.get(_url(key, "VolInfo", f"{spot}/{ymd}/{hh:02d}", 100)).text
        except httpx.HTTPError as e:
            last = str(e)
            continue
        m = re.search(r"<CODE>(.*?)</CODE>", xml)
        code = m.group(1) if m else ""
        if code == _EMPTY:
            return None
        # 서울시 서버 오류(ERROR-500)는 가끔 한 번씩 나서 잠시 뒤 다시 묻는다.
        if code == _SERVER_ERROR:
            last = code
            continue
        if code != _OK:
            raise TrafficApiError(f"{spot} {ymd} {hh:02d}시: {code} {xml[:200]}")
        vin = vout = 0
        for r in ET.fromstring(xml).iter("row"):
            vol = int(float(r.findtext("vol") or 0))
            if r.findtext("io_type") == "1":
                vin += vol
            else:
                vout += vol
        return vin, vout
    raise TrafficApiError(f"{spot} {ymd} {hh:02d}시: {last}")


def fetch_day(db: Session, client: httpx.Client, key: str, ymd: str) -> int:
    """그날 모든 지점 24시간을 받아 저장한다 — 값이 있던 지점 수."""
    spots = [r[0] for r in db.execute(text("SELECT spot_num FROM traffic_spot ORDER BY spot_num")).all()]
    jobs = [(s, h) for s in spots for h in range(24)]
    with ThreadPoolExecutor(WORKERS) as ex:
        results = list(ex.map(lambda j: _fetch_hour(client, key, j[0], ymd, j[1]), jobs))
    by_spot: dict[str, list[tuple[int, int] | None]] = {}
    for (spot, _), r in zip(jobs, results):
        by_spot.setdefault(spot, []).append(r)
    saved = 0
    db.execute(text("DELETE FROM traffic_volume_day WHERE ymd = :d"), {"d": ymd})
    for spot, hours in by_spot.items():
        if not any(hours):
            continue
        db.execute(
            text(
                "INSERT INTO traffic_volume_day (spot_num, ymd, hours, vol_in, vol_out) VALUES (:s, :d, :h, :i, :o)"
            ),
            {
                "s": spot,
                "d": ymd,
                "h": [None if h is None else h[0] + h[1] for h in hours],
                "i": sum(h[0] for h in hours if h),
                "o": sum(h[1] for h in hours if h),
            },
        )
        saved += 1
    db.execute(
        text(
            "INSERT INTO traffic_volume_fetch (ymd, spots) VALUES (:d, :n) "
            "ON CONFLICT (ymd) DO UPDATE SET spots = :n, fetched_at = now()"
        ),
        {"d": ymd, "n": saved},
    )
    db.commit()
    return saved


def fill_missing_days(db: Session, max_days: int = MAX_DAYS_PER_RUN) -> list[str]:
    """어제부터 BACKFILL_DAYS 전까지 아직 안 받은 날을 최근 날부터 max_days일 받는다."""
    key = get_settings().seoul_openapi_key
    if not key:
        return []
    done = {r[0] for r in db.execute(text("SELECT ymd FROM traffic_volume_fetch")).all()}
    yesterday = datetime.now(KST).date() - timedelta(days=1)
    todo = [
        d.strftime("%Y%m%d")
        for d in (yesterday - timedelta(days=i) for i in range(BACKFILL_DAYS))
        if d.strftime("%Y%m%d") not in done
    ][:max_days]
    if not todo:
        return []
    added: list[str] = []
    with httpx.Client(timeout=TIMEOUT_S) as client:
        if not db.execute(text("SELECT 1 FROM traffic_spot LIMIT 1")).first():
            sync_spots(db, client, key)
        for ymd in todo:
            fetch_day(db, client, key, ymd)
            added.append(ymd)
    return added


def start_daily_sync() -> None:
    """백엔드가 켜져 있는 동안 SYNC_INTERVAL_S마다 빠진 날을 채운다(키가 없으면 시작하지 않는다)."""
    if not get_settings().seoul_openapi_key:
        return

    def loop() -> None:
        from src.database import SessionLocal

        while True:
            wait = SYNC_INTERVAL_S
            try:
                with SessionLocal() as db:
                    # 서버 프로세스가 여럿이어도 한 곳만 받는다.
                    if db.execute(text("SELECT pg_try_advisory_lock(61061)")).scalar():
                        try:
                            added = fill_missing_days(db)
                            if added:
                                logger.info("서울시 교통량 %d일 받음 (%s~%s)", len(added), added[-1], added[0])
                            # 지난 날을 아직 채우는 중이면 조금 쉬고 이어 받는다.
                            if len(added) >= MAX_DAYS_PER_RUN:
                                wait = BACKFILL_PAUSE_S
                        finally:
                            db.rollback()
                            db.execute(text("SELECT pg_advisory_unlock(61061)"))
                            db.commit()
            except Exception:  # 서울시 장애·호출 한도·DB 오류가 있어도 다음 차례에 다시 받는다.
                logger.exception("서울시 교통량 받기 실패")
            time.sleep(wait)

    threading.Thread(target=loop, name="traffic-volume-sync", daemon=True).start()


# ---------- 지도

# 지점을 도로 위 선으로 — 도로 현황의 도로 구간(road_link)에서 지점이 있는 도로를 찾아 앞뒤 ROAD_REACH_M 안 구간을 쓴다.
# 이름이 같은 도로가 NAME_MATCH_M 안에 있으면 그 도로, 없으면(다리·터널은 이름이 다르다) NEAREST_MATCH_M 안 가장 가까운 도로.
# 맞는 도로가 없으면(서울 밖 시계 지점 등) 빈 목록 — 지도는 원으로 그린다.
ROAD_REACH_M = 600
NAME_MATCH_M = 150
NEAREST_MATCH_M = 60
_road_cache: dict[tuple, dict[str, list]] = {}


def _seg_dist_m(lat: float, lng: float, path: list) -> float:
    """점에서 꺾은선까지 거리(m) — 서울 범위 평면 근사."""
    kx, ky = 88_000, 111_000
    best = float("inf")
    for (a1, o1), (a2, o2) in zip(path, path[1:]):
        px, py = (lng - o1) * kx, (lat - a1) * ky
        dx, dy = (o2 - o1) * kx, (a2 - a1) * ky
        t = max(0.0, min(1.0, (px * dx + py * dy) / ((dx * dx + dy * dy) or 1)))
        best = min(best, ((px - t * dx) ** 2 + (py - t * dy) ** 2) ** 0.5)
    return best


def _road_paths(db: Session) -> dict[str, list]:
    """지점 번호 → 그릴 도로 구간 꼭짓점 목록들([[위도, 경도], …] 목록). 지점·도로 구간 수가 바뀔 때만 다시 계산한다."""
    key = tuple(db.execute(text("SELECT (SELECT count(*) FROM traffic_spot), (SELECT count(*) FROM road_link)")).one())
    if key in _road_cache:
        return _road_cache[key]
    links = [
        (r.road_name or "", json.loads(r.path), r.min_lat, r.max_lat, r.min_lng, r.max_lng)
        for r in db.execute(text("SELECT road_name, path, min_lat, max_lat, min_lng, max_lng FROM road_link")).all()
    ]
    # 위경도 여유 — ROAD_REACH_M 보다 조금 넉넉히.
    pad_lat, pad_lng = 0.008, 0.01
    out: dict[str, list] = {}
    for s in db.execute(text("SELECT spot_num, name, lat, lng FROM traffic_spot")).all():
        near = [
            (_seg_dist_m(s.lat, s.lng, path), name, path)
            for name, path, a1, a2, o1, o2 in links
            if a1 - pad_lat <= s.lat <= a2 + pad_lat and o1 - pad_lng <= s.lng <= o2 + pad_lng
        ]
        road = s.name.split("(")[0].strip()
        named = sorted(n for n in near if n[1] and (n[1] in road or road in n[1]))
        if named and named[0][0] <= NAME_MATCH_M:
            target = named[0][1]
        else:
            nearest = min(near, default=None, key=lambda n: n[0])
            target = nearest[1] if nearest and nearest[0] <= NEAREST_MATCH_M else None
        out[s.spot_num] = [p for d, n, p in near if target and n == target and d <= ROAD_REACH_M]
    _road_cache.clear()
    _road_cache[key] = out
    return out




def months(db: Session) -> list[str]:
    """받은 날이 있는 달(오래된 것부터)."""
    return [r[0] for r in db.execute(text("SELECT DISTINCT left(ymd, 6) FROM traffic_volume_fetch ORDER BY 1")).all()]


def volumes(db: Session, yms: list[str]) -> dict:
    """고른 달(여러 달은 날 평균)의 지점별 하루 평균 통행량(오가는 방향 합, 대).
    값이 있는 날만으로 평균, 0대인 지점은 뺀다. 고른 달에 받은 날이 없으면 빈 목록."""
    rows = db.execute(
        text(
            """
            SELECT s.spot_num, s.name, s.lat, s.lng, avg(v.vol_in + v.vol_out) AS value
            FROM traffic_volume_day v
            JOIN traffic_spot s ON s.spot_num = v.spot_num
            WHERE left(v.ymd, 6) = ANY(:ms)
            GROUP BY s.spot_num
            HAVING avg(v.vol_in + v.vol_out) > 0
            ORDER BY s.spot_num
            """
        ),
        {"ms": yms},
    ).all()
    days = db.execute(
        text("SELECT count(*) FROM traffic_volume_fetch WHERE left(ymd, 6) = ANY(:ms)"), {"ms": yms}
    ).scalar()
    roads = _road_paths(db)
    return {
        "days": days,
        "spots": [
            {
                "num": r.spot_num,
                "name": r.name,
                "lat": r.lat,
                "lng": r.lng,
                # 그 지점이 있는 도로 앞뒤 구간(양방향) — 비었으면 원으로.
                "paths": roads.get(r.spot_num, []),
                "value": round(float(r.value)),
            }
            for r in rows
        ],
    }
