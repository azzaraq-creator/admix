"""서울시 실시간 도로 소통 정보(TOPIS, 열린데이터광장 OA-13291) — 매체 찾기 지도 "도로 현황".

- 도로 구간(링크) 모양은 road_link 에 저장해 둔다(sync_links — 표가 비었을 때 자동으로, 또는 scripts/sync_road_links.py).
  도로 구분(RoadDivInfo) → 도로(RoadInfo) → 도로별 링크(LinkWithLoad) → 링크 정보(LinkInfo)·꼭짓점(LinkVerInfo).
  꼭짓점은 TM 중부원점(EPSG:5181)이라 위경도로 바꾼다. 서울시 TOPIS OpenAPI는 XML만 준다.
- 실시간 속도(TrafficInfo)는 링크 하나씩만 물을 수 있어, 지도에 보이는 링크만 링크별로 CACHE_TTL_S 동안 캐시하고
  캐시가 없는 링크는 뒤에서 가져오며 pending 으로 센다 — 지도는 잠시 뒤 다시 묻는다(실시간 인구와 같은 방식).
- 소통 등급은 속도로 정한다 — 일반도로 15km/h 미만 정체·25 미만 서행·그 이상 원활(서울시 실시간 도시데이터와 같은 기준),
  도시고속도로 30 미만 정체·70 미만 서행·그 이상 원활(TOPIS 기준).
"""
from __future__ import annotations

import json
import logging
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

from src.config import get_settings
from src.services.sangwon_sync import tm_to_wgs84

logger = logging.getLogger(__name__)

XML_URL = "http://openapi.seoul.go.kr:8088/{key}/xml/{service}/{start}/{end}/{arg}"
TIMEOUT_S = 10.0
CACHE_TTL_S = 300
SYNC_INTERVAL_S = 24 * 60 * 60
# 지도 한 화면에서 한 번에 물을 링크 수 상한 — 넓게 보면 수천 개라 가운데에 가까운 것부터.
MAX_LINKS_PER_VIEW = 2500

ROAD_DIVS = ("02", "03", "04", "05")
EXPRESSWAY = "02"

_LINK_UPSERT = text(
    """
    INSERT INTO road_link (link_id, road_name, road_div_cd, axis_dir, st_node_nm, ed_node_nm, path,
                           min_lat, max_lat, min_lng, max_lng)
    VALUES (:link_id, :road_name, :road_div_cd, :axis_dir, :st_node_nm, :ed_node_nm, :path,
            :min_lat, :max_lat, :min_lng, :max_lng)
    ON CONFLICT (link_id) DO UPDATE SET
        road_name = EXCLUDED.road_name, road_div_cd = EXCLUDED.road_div_cd, axis_dir = EXCLUDED.axis_dir,
        st_node_nm = EXCLUDED.st_node_nm, ed_node_nm = EXCLUDED.ed_node_nm, path = EXCLUDED.path,
        min_lat = EXCLUDED.min_lat, max_lat = EXCLUDED.max_lat, min_lng = EXCLUDED.min_lng, max_lng = EXCLUDED.max_lng
    """
)

_ROW = re.compile(r"<row>(.*?)</row>", re.S)
_FIELD = re.compile(r"<(\w+)>([^<]*)</\1>")


def parse_rows(xml: str) -> list[dict]:
    """서울시 OpenAPI XML → 줄 목록(칸은 모두 문자). 데이터가 없으면 빈 목록."""
    return [dict(_FIELD.findall(row)) for row in _ROW.findall(xml or "")]


def _get(client: httpx.Client, key: str, service: str, arg: str = "", end: int = 1000) -> list[dict]:
    resp = client.get(XML_URL.format(key=key, service=service, start=1, end=end, arg=arg), timeout=TIMEOUT_S)
    resp.raise_for_status()
    return parse_rows(resp.text)


def traffic_level(speed: float, road_div_cd: str | None) -> str:
    """속도(km/h) → 원활·서행·정체."""
    jam, slow = (30, 70) if road_div_cd == EXPRESSWAY else (15, 25)
    return "정체" if speed < jam else "서행" if speed < slow else "원활"


# ===== 도로 구간 모양(저장) =====


def link_row(link_id: str, road_div_cd: str, axis_dir: str | None, info: dict, vertices: list[dict]) -> dict | None:
    """링크 정보·꼭짓점 → road_link 한 줄. 꼭짓점이 둘 미만이면 None."""
    pts = sorted(vertices, key=lambda v: int(v.get("ver_seq") or 0))
    path = []
    for v in pts:
        try:
            lat, lng = tm_to_wgs84(float(v["grs80tm_x"]), float(v["grs80tm_y"]))
        except (KeyError, ValueError):
            continue
        path.append([round(lat, 6), round(lng, 6)])
    if len(path) < 2:
        return None
    lats, lngs = [p[0] for p in path], [p[1] for p in path]
    return dict(
        link_id=link_id,
        road_name=info.get("road_name") or None,
        road_div_cd=road_div_cd,
        axis_dir=axis_dir,
        st_node_nm=info.get("st_node_nm") or None,
        ed_node_nm=info.get("ed_node_nm") or None,
        path=json.dumps(path, separators=(",", ":")),
        min_lat=min(lats),
        max_lat=max(lats),
        min_lng=min(lngs),
        max_lng=max(lngs),
    )


def sync_links(db: Session) -> int:
    """서울시 도로 링크를 모두 받아 넣는다(약 5,300개, 1만 번 넘게 물어 몇 분 걸린다). 넣은 수(키가 없으면 0)."""
    key = get_settings().seoul_openapi_key
    if not key:
        return 0
    with httpx.Client() as client, ThreadPoolExecutor(max_workers=16) as pool:
        axes = [(div, r["axis_cd"]) for div in ROAD_DIVS for r in _get(client, key, "RoadInfo", div) if r.get("axis_cd")]
        links: dict[str, tuple[str, str | None]] = {}
        for (div, _), rows in zip(axes, pool.map(lambda a: _get(client, key, "LinkWithLoad", a[1]), axes)):
            for r in rows:
                if r.get("link_id"):
                    links.setdefault(r["link_id"], (div, r.get("axis_dir")))

        def one(link_id: str) -> dict | None:
            try:
                info = _get(client, key, "LinkInfo", link_id, end=5)
                vertices = _get(client, key, "LinkVerInfo", link_id)
            except httpx.HTTPError as e:
                logger.warning("도로 링크 조회 실패 link=%s: %s", link_id, e)
                return None
            div, axis_dir = links[link_id]
            return link_row(link_id, div, axis_dir, info[0] if info else {}, vertices)

        rows = [r for r in pool.map(one, list(links)) if r]
    if rows:
        db.execute(_LINK_UPSERT, rows)
        db.commit()
        logger.info("서울시 도로 링크 %d개 저장", len(rows))
    return len(rows)


def links_in_db(db: Session) -> int:
    return db.execute(text("SELECT count(*) FROM road_link")).scalar() or 0


def start_daily_sync() -> None:
    """도로 링크 표가 비어 있으면 받는다 — 하루 한 번 확인(키가 없으면 시작하지 않는다)."""
    if not get_settings().seoul_openapi_key:
        return

    def loop() -> None:
        from src.database import SessionLocal

        while True:
            try:
                with SessionLocal() as db:
                    if links_in_db(db) == 0:
                        sync_links(db)
            except Exception:
                logger.exception("서울시 도로 링크 받기 실패")
            time.sleep(SYNC_INTERVAL_S)

    threading.Thread(target=loop, name="road-link-sync", daemon=True).start()


# ===== 실시간 속도(지도) =====

_cache: dict[str, tuple[float, float | None]] = {}  # 링크 → (만료 시각, 속도 km/h)
_cache_lock = threading.Lock()
_inflight: set[str] = set()
_pool = ThreadPoolExecutor(max_workers=16, thread_name_prefix="road-traffic")
_client = httpx.Client()


def _fetch_speed(link_id: str) -> None:
    speed: float | None = None
    try:
        rows = _get(_client, get_settings().seoul_openapi_key, "TrafficInfo", link_id, end=5)
        if rows and rows[0].get("prcs_spd"):
            speed = float(rows[0]["prcs_spd"])
    except (httpx.HTTPError, ValueError) as e:
        logger.warning("서울시 도로 소통 조회 실패 link=%s: %s", link_id, e)
    with _cache_lock:
        # 실패는 1분만 기억한다(연속 실패 호출을 막되 곧 다시 묻게).
        _cache[link_id] = (time.monotonic() + (CACHE_TTL_S if speed is not None else 60), speed)
        _inflight.discard(link_id)


def traffic_in_bounds(db: Session, ne_lat: float, sw_lat: float, ne_lng: float, sw_lng: float) -> dict:
    """지도 영역에 걸친 서울시 도로 링크의 실시간 소통 — {"enabled", "links": [...], "pending"}.

    link: {id, road, level(원활·서행·정체), speed(km/h), path: [[위도, 경도], ...]}
    캐시가 없는 링크는 뒤에서 가져오고 pending 으로 센다.
    """
    if not get_settings().seoul_openapi_key:
        return {"enabled": False, "links": [], "pending": 0}
    rows = db.execute(
        text(
            """
            SELECT link_id, road_name, road_div_cd, path FROM road_link
            WHERE min_lat <= :ne_lat AND max_lat >= :sw_lat AND min_lng <= :ne_lng AND max_lng >= :sw_lng
            ORDER BY abs((min_lat + max_lat) / 2 - :c_lat) + abs((min_lng + max_lng) / 2 - :c_lng)
            LIMIT :limit
            """
        ),
        {
            "ne_lat": ne_lat,
            "sw_lat": sw_lat,
            "ne_lng": ne_lng,
            "sw_lng": sw_lng,
            "c_lat": (ne_lat + sw_lat) / 2,
            "c_lng": (ne_lng + sw_lng) / 2,
            "limit": MAX_LINKS_PER_VIEW,
        },
    ).all()
    now = time.monotonic()
    links: list[dict] = []
    to_fetch: list[str] = []
    pending = 0
    with _cache_lock:
        for r in rows:
            hit = _cache.get(r.link_id)
            if not hit or hit[0] <= now:
                pending += 1
                if r.link_id not in _inflight:
                    _inflight.add(r.link_id)
                    to_fetch.append(r.link_id)
                # 만료된 값이라도 있으면 그대로 그려 둔다(다시 받는 동안 선이 사라지지 않게).
                if not hit:
                    continue
            speed = hit[1]
            if speed is None:
                continue
            links.append(
                dict(
                    id=r.link_id,
                    road=r.road_name or "",
                    level=traffic_level(speed, r.road_div_cd),
                    speed=round(speed),
                    path=json.loads(r.path),
                )
            )
    for link_id in to_fetch:
        _pool.submit(_fetch_speed, link_id)
    return {"enabled": True, "links": links, "pending": pending}
