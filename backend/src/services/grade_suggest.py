"""등급 설문 자동 추천 — 어드민 매체 상세 "등급·추천"에서 담당자가 확인하고 넣는 추천 답과 근거.

답을 대신 저장하지 않는다. 어드민이 추천을 보고 "넣기"를 눌러 저장해야 답이 된다.
질문·답 값은 프론트 gradeSurveyQuestions.ts 와 같다(docs/policies/media-grade-survey.md).

- 실외 매체(서울): 서울시 도로 링크(road_link — 주요 도로만)로 도로와의 위치·마주한 도로 폭·신호 대기.
  교차로는 도로 구간 끝점 이름에 "사거리·교차로·오거리·삼거리"가 붙은 곳이다.
- 설명글·이름 키워드: 조명·야간 조명·양방향·정체 구간·교차로, 실내 매체의 놓인 곳·머무는 시간.
"""
from __future__ import annotations

import json
import math
import re

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.models.media_master import Media

# 교차로(끝점 이름) — 이 거리(m) 안이면 모서리, 그다음까지는 마주 봄. 신호 대기는 마주 봄 거리까지.
CORNER_M = 40
FACING_M = 100
# 마주한 도로 — 이 거리(m) 안 가장 가까운 도로 구간. 이 안에 큰 도로가 없으면 이면도로로 본다.
ROAD_NEAR_M = 50
SIDE_ROAD_M = 100
_SEARCH_M = max(FACING_M, SIDE_ROAD_M) + 50

_INTERSECTION = re.compile(r"(사거리|교차로|오거리|삼거리)")
# 서울시 도로 등급 → 마주한 도로 폭(차로). 05 기타는 폭이 제각각이라 추천하지 않는다.
_ROAD_WIDTH = {"02": "8_plus", "03": "8_plus", "04": "4_6"}
_ROAD_DIV_NAME = {"02": "도시고속도로", "03": "주간선도로", "04": "보조간선도로", "05": "기타 도로"}

# (정규식, 값, 근거) — 앞에 있는 것이 먼저.
_INDOOR_SPOT = [
    (re.compile(r"스크린도어|PSD|승강장"), "waiting", "승강장(열차 대기)"),
    (re.compile(r"엘리베이터"), "waiting", "엘리베이터 앞"),
    (re.compile(r"개찰구|게이트|출입구|입구"), "entrance", "출입구·개찰구"),
    (re.compile(r"환승\s*통로|연결\s*통로|통로|에스컬레이터|계단"), "main_path", "통로·에스컬레이터"),
]
_INDOOR_DWELL = {"waiting": "long", "entrance": "short", "main_path": "pass"}
_LIGHT = re.compile(r"조명|라이트|백라이트|와이드\s*칼라|야간")
_BOTH_WAYS = re.compile(r"양방향|양면")
_SLOW = re.compile(r"정체|서행|톨게이트|분기점|\bJC\b|\bIC\b|나들목")


def _dist_m(lat: float, lng: float, plat: float, plng: float) -> float:
    return math.hypot((plat - lat) * 110_540, (plng - lng) * 111_320 * math.cos(math.radians(lat)))


def _seg_dist_m(lat: float, lng: float, a: tuple[float, float], b: tuple[float, float]) -> float:
    """점에서 선분 a-b 까지 거리(m) — 매체 근처라 평면으로 본다."""
    kx = 111_320 * math.cos(math.radians(lat))
    ax, ay = (a[1] - lng) * kx, (a[0] - lat) * 110_540
    bx, by = (b[1] - lng) * kx, (b[0] - lat) * 110_540
    dx, dy = bx - ax, by - ay
    t = 0.0 if dx == dy == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / (dx * dx + dy * dy)))
    return math.hypot(ax + t * dx, ay + t * dy)


def _text(m: Media) -> str:
    return " ".join(p for p in [m.name, m.second_name, m.description, m.feature] if p)


def _keyword(pattern: re.Pattern, text_: str) -> str | None:
    hit = pattern.search(text_)
    return hit.group(0) if hit else None


def _road_suggestions(db: Session, m: Media) -> dict[str, dict]:
    """서울 실외 매체 — 근처 교차로·도로 구간으로 도로와의 위치·도로 폭·신호 대기."""
    lat, lng = float(m.latitude), float(m.longitude)
    dlat = _SEARCH_M / 110_540
    dlng = _SEARCH_M / (111_320 * math.cos(math.radians(lat)))
    links = db.execute(
        text(
            """
            SELECT road_name, road_div_cd, st_node_nm, ed_node_nm, path FROM road_link
            WHERE max_lat >= :lat0 AND min_lat <= :lat1 AND max_lng >= :lng0 AND min_lng <= :lng1
            """
        ),
        {"lat0": lat - dlat, "lat1": lat + dlat, "lng0": lng - dlng, "lng1": lng + dlng},
    ).all()
    if not links:
        # 서울 안인데 주요 도로가 150m 안에 하나도 없다 — 골목·이면도로.
        return {"road_position": dict(value="side_road", reason=f"{SIDE_ROAD_M}m 안에 큰 도로가 없음")}

    nearest_int: tuple[float, str] | None = None
    nearest_road: tuple[float, str | None, str | None] | None = None
    for road_name, div, st_name, ed_name, path in links:
        pts = [tuple(p) for p in json.loads(path)]
        for name, pt in ((st_name, pts[0]), (ed_name, pts[-1])):
            if name and _INTERSECTION.search(name):
                d = _dist_m(lat, lng, *pt)
                if nearest_int is None or d < nearest_int[0]:
                    nearest_int = (d, name)
        d = min(_seg_dist_m(lat, lng, a, b) for a, b in zip(pts, pts[1:])) if len(pts) > 1 else math.inf
        if nearest_road is None or d < nearest_road[0]:
            nearest_road = (d, road_name, div)

    out: dict[str, dict] = {}
    if nearest_int and nearest_int[0] <= FACING_M:
        d, name = nearest_int
        out["road_position"] = dict(
            value="corner" if d <= CORNER_M else "facing_intersection",
            reason=f"{name} {round(d)}m",
        )
        out["signal_wait"] = dict(value="yes", reason=f"{name} {round(d)}m — 신호 대기 구간")
    elif nearest_road and nearest_road[0] <= ROAD_NEAR_M:
        d, road_name, div = nearest_road
        out["road_position"] = dict(value="main_road", reason=f"{road_name or _ROAD_DIV_NAME.get(div, '큰 도로')} {round(d)}m")
    elif not nearest_road or nearest_road[0] > SIDE_ROAD_M:
        out["road_position"] = dict(value="side_road", reason=f"{SIDE_ROAD_M}m 안에 큰 도로가 없음")
    if nearest_road and nearest_road[0] <= ROAD_NEAR_M and nearest_road[2] in _ROAD_WIDTH:
        d, road_name, div = nearest_road
        out["road_width"] = dict(
            value=_ROAD_WIDTH[div],
            reason=f"{road_name or ''} {_ROAD_DIV_NAME[div]} {round(d)}m".strip(),
        )
    return out


def _indoor_suggestions(m: Media) -> dict[str, dict]:
    """놓인 곳·머무는 시간 — 매체 이름을 먼저 보고(예: "환승 통로"), 없으면 설명글."""
    for where, text_ in (("이름", " ".join(p for p in [m.name, m.second_name] if p)), ("설명", _text(m))):
        for pattern, spot, label in _INDOOR_SPOT:
            hit = _keyword(pattern, text_)
            if hit:
                reason = f"{where}에 '{hit}' — {label}"
                return {
                    "spot": dict(value=spot, reason=reason),
                    "dwell": dict(value=_INDOOR_DWELL[spot], reason=reason),
                }
    return {}


def suggest(db: Session, m: Media) -> dict[str, dict]:
    """질문 ID → {value, reason}. 매체 종류에 맞지 않는 질문도 섞여 있을 수 있다(화면이 그 매체 질문만 보여 준다)."""
    if m.media_source == "MOVING":
        return {}
    text_ = _text(m)
    out: dict[str, dict] = {}

    if m.exposure_type == "INSIDE":
        out |= _indoor_suggestions(m)
    else:
        seoul = (m.city or "").startswith("서울") and m.latitude is not None and m.longitude is not None
        if seoul:
            out |= _road_suggestions(db, m)
        # 도로 데이터는 교차로 이름이 빠진 곳이 있어(예: 고속터미널 사거리) 설명에 교차로가 있으면 그쪽을 믿는다.
        if out.get("road_position", {}).get("value") not in ("corner", "facing_intersection"):
            hit = _keyword(_INTERSECTION, text_)
            if hit:
                out["road_position"] = dict(value="facing_intersection", reason=f"설명에 '{hit}'")
                out.setdefault("signal_wait", dict(value="yes", reason=f"설명에 '{hit}' — 신호 대기 구간"))
        if "signal_wait" not in out:
            hit = _keyword(re.compile(r"정체|신호\s*대기"), text_)
            if hit:
                out["signal_wait"] = dict(value="yes", reason=f"설명에 '{hit}'")
        hit = _keyword(_BOTH_WAYS, text_)
        if hit:
            out["view_directions"] = dict(value="both", reason=f"설명에 '{hit}'")
        hit = _keyword(_SLOW, text_)
        if hit:
            out["vehicle_speed"] = dict(value="slow", reason=f"설명에 '{hit}'")

    hit = _keyword(_LIGHT, text_)
    if hit:
        reason = f"설명에 '{hit}'"
        out["night_light"] = dict(value="yes", reason=reason)
        out["lighting"] = dict(value="yes", reason=reason)
    return out
