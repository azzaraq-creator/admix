"""유동인구 격자 지도 — 서울 250m 격자의 월별 생활인구·체류인구·지하철·보행 값을 저장하고 지도용으로 계산한다.

데이터는 어드민 "유동인구 데이터"에서 달마다 올린다. 올리는 파일은 두 가지 모두 같은 형식이다.
- 인계 월 파일: 유동인구 지도 인계 패키지의 `5_격자체류인구/period/YYYYMM.js` (2025-01~2026-09 가공본, 모든 자료).
- 서울시 원자료: 어드민 화면에서 서울시 zip(생활인구·체류인구 250m 내국인)을 고르면 브라우저가 격자별로 요약해
  같은 형식으로 만들어 올린다(생활·체류만 — 지하철·보행은 그 달 기존 값을 그대로 둔다).
형식: `SFMP_ADD({머리 JSON},'<base64(gzip(uint16 LE 값))>');` — 자료(field)마다 격자 8,617칸 값이 차례로,
값 = 정수 × scale[자료], 65535 = 그 달 자료 없음. 격자 순서는 assets/geo/pop-grid-cells.json 과 같다.

화면은 고른 달(여러 달이면 평균)·자료·시간대·성별·연령으로 격자 값을 받아 진하기로 칠한다.
- 새벽 3~5시(band dawn) 생활인구 평균도 저장한다(metric resident) — 지금 지도 "거주인구"는 행정동 세대수(household_dong)를 쓴다.
  서울시 원자료 zip으로 올린 달에만 있다(인계 월 파일엔 새벽 묶음이 없다).
- 성·연령 구분은 생활인구·체류인구에만 있다. 지하철·버스·보행은 고른 성·연령과 상관없이 전체 값이다.
- 통신 자료는 기지국 자리에 따라 한 칸에 몰려 잡히는 일이 많아(이웃의 4배 넘는 칸 151개, 2025-09 기지국 재배치)
  기본으로 이웃 8칸과 평균(가운데 가중 2, 750m 평활)을 낸다 — 인계 지도의 기본값과 같다.
"""
from __future__ import annotations

import base64
import calendar
import gzip
import json
import re
import sys
import threading
from array import array
from collections import OrderedDict
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.orm import Session

CELLS_PATH = Path(__file__).resolve().parents[1] / "assets" / "geo" / "pop-grid-cells.json"
MISSING = 65535

# 파일의 자료 이름 → (metric, seg). 시간대는 이름 가운데.
_FIELD_METRIC = {
    "spN": "live",
    "spS": "live_fs",
    "spL": "live_fl",
    "st": "stay",
    "st60": "stay60",
    "st240": "stay240",
    "sub": "subway",
    "bus": "bus",
    "wk": "walk",
    "sps": "live",
    "sts": "stay",
}
BANDS = {"24시간": "all", "출근": "am", "낮": "day", "퇴근": "pm", "야간": "night", "거주": "dawn"}
METRICS = ("live", "live_fs", "live_fl", "stay", "stay60", "stay240", "subway", "bus", "walk")
# 성·연령으로 나눌 수 있는 자료
SEG_METRICS = {"live", "stay", "resident"}
AGES = ("00", "10", "20", "30", "40", "50", "60", "70")
_SEG_RE = re.compile(r"^[MF](00|10|20|30|40|50|60|70)$")


# ---------- 격자 목록


@lru_cache(maxsize=1)
def _cells() -> dict:
    data = json.loads(CELLS_PATH.read_text(encoding="utf-8"))
    rows = data["cells"]
    codes = [r[0] for r in rows]
    index = {c: i for i, c in enumerate(codes)}
    letters = "가나다라마바사아"

    def xy(code: str) -> tuple[int, int]:
        return (
            letters.index(code[0]) * 10_000 + int(code[2:6]),
            letters.index(code[1]) * 10_000 + int(code[6:10]),
        )

    # 이웃 8칸(있는 칸만) — 격자 코드의 10m 단위 좌표로 ±25(250m).
    at = {xy(c): i for i, c in enumerate(codes)}
    neighbors = []
    for c in codes:
        x, y = xy(c)
        neighbors.append(
            [at[(x + dx, y + dy)] for dx in (-25, 0, 25) for dy in (-25, 0, 25) if (dx or dy) and (x + dx, y + dy) in at]
        )
    # 지도에 보낼 압축본 — 칸 코드·구·동·네 모서리. 1.1MB → gzip 약 160KB, 처음 한 번만 받는다.
    payload = json.dumps({"cells": rows}, ensure_ascii=False, separators=(",", ":")).encode()
    return {
        "rows": rows,
        "codes": codes,
        "index": index,
        "neighbors": neighbors,
        "n": len(codes),
        "gzip": gzip.compress(payload, 6),
    }


def cells_gzip() -> bytes:
    return _cells()["gzip"]


def cell_count() -> int:
    return _cells()["n"]


# ---------- 파일 읽기


class PopGridFileError(ValueError):
    """올린 파일을 읽을 수 없음 — 메시지를 그대로 어드민에 보여 준다."""


def parse_period_file(content: bytes) -> tuple[dict, list[tuple[str, str, str, float, bytes]]]:
    """SFMP_ADD 파일 → (머리, [(metric, band, seg, scale, 값 bytes)]). 국적별 외국인(spSn) 등 안 쓰는 자료는 건너뛴다."""
    try:
        s = content.decode("utf-8-sig")
    except UnicodeDecodeError as e:
        raise PopGridFileError("파일을 읽을 수 없어요 — 인계 월 파일(YYYYMM.js)이나 어드민이 만든 요약 파일만 올릴 수 있어요.") from e
    if not s.lstrip().startswith("SFMP_ADD("):
        raise PopGridFileError("유동인구 월 파일 형식이 아니에요 — 인계 패키지의 period/YYYYMM.js 파일인지 확인해 주세요.")
    try:
        head_txt = s.split("SFMP_ADD(", 1)[1].split(",'", 1)[0]
        head = json.loads(head_txt)
        b64 = s.rsplit(",'", 1)[1].split("'", 1)[0]
        raw = gzip.decompress(base64.b64decode(b64))
    except (IndexError, ValueError, OSError) as e:
        raise PopGridFileError("파일 내용이 손상됐어요 — 다시 받아서 올려 주세요.") from e

    ym = str(head.get("ym", ""))
    if not re.fullmatch(r"20\d{2}(0[1-9]|1[0-2])", ym):
        raise PopGridFileError(f"자료 달을 알 수 없어요 (ym={ym!r}) — 12개월 평균 파일(nat12m.js 등)은 올릴 수 없어요.")
    n = int(head.get("n", 0))
    if n != cell_count():
        raise PopGridFileError(f"격자 수가 달라요 (파일 {n:,}칸, 지도 {cell_count():,}칸) — 같은 격자 체계의 파일이 아니에요.")
    fields: list[str] = head.get("fields") or []
    scales: list[float] = head.get("scale") or []
    if len(fields) != len(scales) or len(raw) != len(fields) * n * 2:
        raise PopGridFileError("파일 크기가 머리 정보와 맞지 않아요 — 파일이 잘렸을 수 있어요.")

    out = []
    for i, name in enumerate(fields):
        parts = name.split("_")
        metric = _FIELD_METRIC.get(parts[0])
        band = BANDS.get(parts[1]) if len(parts) > 1 else None
        if metric is None or band is None:
            continue
        if len(parts) == 2:
            seg = "ALL"
        elif len(parts) == 3 and parts[0] in ("sps", "sts") and _SEG_RE.match(parts[2]):
            seg = parts[2]
        else:
            continue
        out.append((metric, band, seg, float(scales[i]), raw[i * n * 2 : (i + 1) * n * 2]))
    if not out:
        raise PopGridFileError("파일에 지도에 쓸 자료가 없어요.")
    return head, out


def _decode(data: bytes, scale: float) -> list[float | None]:
    q = array("H")
    q.frombytes(data)
    # 파일은 little-endian. 빅엔디언 서버는 없지만 혹시 몰라 맞춘다.
    if sys.byteorder == "big":
        q.byteswap()
    return [None if v == MISSING else v * scale for v in q]


# ---------- 저장


def save_month(db: Session, content: bytes, admin_name: str, filename: str) -> dict:
    """올린 파일을 그 달 값으로 저장한다. 파일에 있는 자료만 바꾸고, 없는 자료(예: 원자료 요약엔 지하철·보행이 없다)는 둔다."""
    head, entries = parse_period_file(content)
    ym = str(head["ym"])
    days = int(head.get("days") or 0) or _days_in_month(ym)
    source = "seoul-raw" if head.get("source") == "seoul-raw" else "handover"
    now = datetime.now(timezone.utc)
    metrics = sorted({e[0] for e in entries})
    missing_days = [int(d) for d in head.get("missingDays") or []]
    info = {
        "source": source,
        "missingDays": missing_days,
        "file": filename,
        "files": head.get("files") or [filename],
        "uploaded_at": now.isoformat(timespec="seconds"),
        "by": admin_name,
    }
    if head.get("walkQ") and "walk" in metrics:
        info_walk = dict(info, quarter=str(head["walkQ"]), fallback=bool(head.get("walkFallback")))
    else:
        info_walk = None

    row = db.execute(text("SELECT sources FROM pop_grid_month WHERE ym = :ym"), {"ym": ym}).first()
    sources = dict(row[0]) if row else {}
    for m in metrics:
        sources[m] = info_walk if (m == "walk" and info_walk) else info
    db.execute(
        text(
            "INSERT INTO pop_grid_month (ym, days, sources, updated_at) VALUES (:ym, :days, CAST(:sources AS JSONB), :now) "
            "ON CONFLICT (ym) DO UPDATE SET days = EXCLUDED.days, sources = EXCLUDED.sources, updated_at = EXCLUDED.updated_at"
        ),
        {"ym": ym, "days": days, "sources": json.dumps(sources, ensure_ascii=False), "now": now},
    )
    # 파일에 든 자료는 그 달 것을 통째로 바꾼다(성·연령 칸이 줄어든 파일이어도 옛 칸이 남지 않게).
    db.execute(
        text("DELETE FROM pop_grid_value WHERE ym = :ym AND metric = ANY(:metrics)"),
        {"ym": ym, "metrics": metrics},
    )
    db.execute(
        text(
            "INSERT INTO pop_grid_value (ym, metric, band, seg, scale, data) "
            "VALUES (:ym, :metric, :band, :seg, :scale, :data)"
        ),
        [
            {"ym": ym, "metric": m, "band": b, "seg": s, "scale": sc, "data": data}
            for m, b, s, sc, data in entries
        ],
    )
    db.commit()
    _clear_cache()

    # 어드민 확인용 — 서울 합계(24시간). 생활인구는 그 시각 평균 인원이라 서울 전체가 1,000만 명 남짓이면 정상.
    totals = {}
    for m, b, s, sc, data in entries:
        if b == "all" and s == "ALL":
            totals[m] = round(sum(v for v in _decode(data, sc) if v is not None))
    return {
        "ym": ym,
        "days": days,
        "missingDays": missing_days,
        "resident": any(b == "dawn" for _, b, _, _, _ in entries),
        "source": source,
        "metrics": metrics,
        "rows": len(entries),
        "totals": totals,
    }


def delete_month(db: Session, ym: str) -> bool:
    deleted = db.execute(text("DELETE FROM pop_grid_month WHERE ym = :ym"), {"ym": ym}).rowcount
    db.commit()
    _clear_cache()
    return bool(deleted)


def _days_in_month(ym: str) -> int:
    return calendar.monthrange(int(ym[:4]), int(ym[4:]))[1]


def list_months(db: Session) -> list[dict]:
    rows = db.execute(
        text(
            "SELECT m.ym, m.days, m.sources, m.updated_at, "
            "COALESCE(array_agg(DISTINCT v.metric) FILTER (WHERE v.metric IS NOT NULL), '{}') AS metrics, "
            "bool_or(v.metric = 'live' AND v.band = 'dawn') AS resident "
            "FROM pop_grid_month m LEFT JOIN pop_grid_value v ON v.ym = m.ym "
            "GROUP BY m.ym ORDER BY m.ym"
        )
    ).all()
    return [
        {
            "ym": r.ym,
            "days": r.days,
            # 거주인구는 생활인구 새벽 묶음이 있는 달에만 — 지도 자료 목록에서 따로 고른다.
            "metrics": sorted(r.metrics) + (["resident"] if r.resident else []),
            "sources": r.sources,
            "updatedAt": r.updated_at.isoformat(timespec="seconds") if r.updated_at else None,
        }
        for r in rows
    ]


# ---------- 지도 값 계산

_cache_lock = threading.Lock()
_decoded: OrderedDict[tuple, list[float | None]] = OrderedDict()
_results: OrderedDict[tuple, dict] = OrderedDict()
_DECODED_MAX = 600  # 한 줄 8,617칸 ≈ 70KB(파이썬 리스트) → 최대 40MB 남짓
_RESULTS_MAX = 200


def _clear_cache() -> None:
    with _cache_lock:
        _decoded.clear()
        _results.clear()


def _version(db: Session) -> str:
    """값이 바뀌었는지 — 서버 프로세스가 여럿이어도 업로드 뒤 옛 계산을 쓰지 않게 캐시 열쇠에 넣는다."""
    v = db.execute(text("SELECT count(*), max(updated_at) FROM pop_grid_month")).first()
    return f"{v[0]}:{v[1].isoformat() if v[1] else ''}"


def _rows(db: Session, version: str, months: list[str], metric: str, band: str, segs: list[str]) -> dict:
    """(달, seg) → 칸별 값. 풀어 둔 값은 캐시."""
    out: dict[tuple[str, str], list[float | None]] = {}
    need = []
    with _cache_lock:
        for ym in months:
            for seg in segs:
                key = (version, ym, metric, band, seg)
                if key in _decoded:
                    _decoded.move_to_end(key)
                    out[(ym, seg)] = _decoded[key]
                else:
                    need.append((ym, seg))
    if need:
        res = db.execute(
            text(
                "SELECT ym, seg, scale, data FROM pop_grid_value "
                "WHERE metric = :metric AND band = :band AND ym = ANY(:months) AND seg = ANY(:segs)"
            ),
            {"metric": metric, "band": band, "months": sorted({n[0] for n in need}), "segs": sorted({n[1] for n in need})},
        ).all()
        with _cache_lock:
            for r in res:
                vals = _decode(bytes(r.data), r.scale)
                out[(r.ym, r.seg)] = vals
                _decoded[(version, r.ym, metric, band, r.seg)] = vals
            while len(_decoded) > _DECODED_MAX:
                _decoded.popitem(last=False)
    return out


def segments(metric: str, sex: str, ages: list[str]) -> tuple[list[str], bool]:
    """고른 성·연령 → seg 목록, 그리고 성·연령이 실제로 걸렸는지. 60대 이상 = 60대 + 70세 이상."""
    if metric not in SEG_METRICS:
        return ["ALL"], False
    ages = [a for a in AGES if a in set(ages)]
    if "60" in ages and "70" not in ages:
        ages.append("70")
    if sex == "all" and not ages:
        return ["ALL"], False
    sexes = ["M", "F"] if sex == "all" else [sex]
    return [f"{s}{a}" for s in sexes for a in (ages or AGES)], True


def _month_values(rows: dict, ym: str, segs: list[str], n: int) -> list[float | None] | None:
    arrays = [rows[(ym, s)] for s in segs if (ym, s) in rows]
    if not arrays:
        return None
    if len(arrays) == 1:
        return arrays[0]
    out: list[float | None] = []
    for vals in zip(*arrays):
        present = [v for v in vals if v is not None]
        out.append(sum(present) if present else None)
    return out


def _smooth(values: list[float | None]) -> list[float | None]:
    """750m 평활 — 가운데 가중 2 + 이웃 8칸. 자료 없는 이웃은 빼고 평균, 가운데가 자료 없음이면 그대로 자료 없음."""
    nb = _cells()["neighbors"]
    out: list[float | None] = []
    for i, v in enumerate(values):
        if v is None:
            out.append(None)
            continue
        total, weight = 2 * v, 2
        for j in nb[i]:
            w = values[j]
            if w is not None:
                total += w
                weight += 1
        out.append(total / weight)
    return out


def _breaks(values: list[float | None]) -> list[float]:
    """색 단계 경계 — 값이 있는 칸 중 상위 40·20·10·5·1% 자리 값(작은 것부터). 진할수록 서울 상위."""
    vs = sorted(v for v in values if v is not None and v > 0)
    if not vs:
        return []
    return [round(vs[min(len(vs) - 1, int(len(vs) * q))], 2) for q in (0.6, 0.8, 0.9, 0.95, 0.99)]


def grid_values(
    db: Session,
    months: list[str],
    metric: str,
    band: str,
    sex: str,
    ages: list[str],
    smooth: bool,
) -> dict:
    """지도 한 장 — 칸별 값(격자 순서, 자료 없음은 null)과 색 단계 경계."""
    if metric == "household":
        # 행정동 세대수 — 격자 자료가 아니라 동마다 값 하나(household_dong).
        from src.services import household_dong

        return household_dong.grid_values(db, months)
    if metric == "resident":
        # 거주인구 = 생활인구 새벽 3~5시. 시간대 칩은 상관없다.
        return dict(grid_values(db, months, "live", "dawn", sex, ages, smooth), metric="resident", band="dawn")
    if metric in _COMBOS:
        return _combo_values(db, metric, months, band, sex, ages, smooth)
    n = cell_count()
    version = _version(db)
    segs, filtered = segments(metric, sex, ages)
    months = sorted(set(months))
    key = (version, tuple(months), metric, band, tuple(segs), smooth)
    with _cache_lock:
        if key in _results:
            _results.move_to_end(key)
            return _results[key]

    rows = _rows(db, version, months, metric, band, segs)
    per_month = {ym: _month_values(rows, ym, segs, n) for ym in months}
    used = [ym for ym, v in per_month.items() if v is not None]
    if not used:
        values: list[float | None] = [None] * n
    else:
        # 여러 달은 평균 — 그 칸에 자료가 있는 달만.
        values = []
        for vals in zip(*(per_month[ym] for ym in used)):
            present = [v for v in vals if v is not None]
            values.append(sum(present) / len(present) if present else None)
    raw_total = sum(v for v in values if v is not None)
    if smooth:
        values = _smooth(values)
    result = {
        "months": used,
        "missingMonths": [ym for ym in months if ym not in used],
        "metric": metric,
        "band": band,
        "filtered": filtered,
        "smooth": smooth,
        # 소수 한 자리 — 연령 한 칸 값은 1명 아래일 수도 있다.
        "values": [None if v is None else round(v, 1) for v in values],
        "breaks": _breaks(values),
        "total": round(raw_total),
        "cellsWithData": sum(1 for v in values if v is not None),
    }
    with _cache_lock:
        _results[key] = result
        while len(_results) > _RESULTS_MAX:
            _results.popitem(last=False)
    return result


# 유동인구(종합) — 인계 지도 "종합 유동 지수"와 같은 산식. 생활·체류·보행은 KT 통신 한 원천(같은 사람을 세 방식으로 센 값)이라
# 한 묶음(70)으로, 교통카드 지하철·버스 승하차(30)는 따로 — 같은 원천을 여러 개 넣어도 한 지역이 부풀지 않게.
# 생활·체류인구(people) — 단위가 달라(그 시각 인원 / 시간당 머물기 시작한 인원) 그대로 더할 수 없어 같은 점수로 바꿔
# 생활 40 : 체류 20(유동인구의 통신 묶음과 같은 비율)으로 합친다. 교통카드는 넣지 않는다.
# metric → (통신 묶음 안 가중, 교통카드 묶음 가중 — 0이면 넣지 않음)
_COMBOS: dict[str, tuple[dict[str, int], int]] = {
    "flow": ({"live": 40, "stay": 20, "walk": 10}, 30),
    "people": ({"live": 40, "stay": 20}, 0),
}
_TELECOM_GROUP = 70


def _scores(values: list[float | None]) -> list[float | None]:
    """규모 점수 — 서울 칸 상위 1% 값 = 50점, 그 2배 이상 = 100점(자료마다 단위가 달라 점수로 맞춘다)."""
    vs = sorted(v for v in values if v is not None and v > 0)
    if not vs:
        return [None if v is None else 0.0 for v in values]
    p99 = vs[min(len(vs) - 1, int(len(vs) * 0.99))]
    return [None if v is None else min(100.0, v / p99 * 50) for v in values]


def _combo_values(
    db: Session, metric: str, months: list[str], band: str, sex: str, ages: list[str], smooth: bool
) -> dict:
    """여러 자료를 점수로 맞춰 합친 지도(_COMBOS) → 0~100점. 칸에 없는 자료는 그 몫을 빼고 나머지로 평균.
    성·연령은 생활·체류에만 걸린다(나머지는 구분 자료가 없다)."""
    telecom, transit_weight = _COMBOS[metric]
    n = cell_count()
    version = _version(db)
    months = sorted(set(months))
    key = (version, tuple(months), metric, band, sex, tuple(sorted(ages)), smooth)
    with _cache_lock:
        if key in _results:
            _results.move_to_end(key)
            return _results[key]

    names = list(telecom) + (["subway", "bus"] if transit_weight else [])
    parts = {m: grid_values(db, months, m, band, sex, ages, smooth) for m in names}
    scores = {m: _scores(parts[m]["values"]) for m in telecom}
    if transit_weight:
        # 지하철·버스는 같은 단위(승하차 건수)라 더해서 한 자료로. 역·정류장이 없는 칸의 0은 실제 0이다.
        sub, bus = parts["subway"]["values"], parts["bus"]["values"]
        transit = [None if a is None and b is None else (a or 0) + (b or 0) for a, b in zip(sub, bus)]
        scores["transit"] = _scores(transit)

    values: list[float | None] = []
    for i in range(n):
        tel_w = tel_s = 0.0
        for m, w in telecom.items():
            v = scores[m][i]
            if v is not None:
                tel_s += v * w
                tel_w += w
        tr = scores["transit"][i] if transit_weight else None
        groups = []
        if tel_w:
            groups.append((tel_s / tel_w, _TELECOM_GROUP))
        if tr is not None:
            groups.append((tr, transit_weight))
        values.append(sum(v * w for v, w in groups) / sum(w for _, w in groups) if groups else None)

    used = sorted({ym for p in parts.values() for ym in p["months"]})
    result = {
        "months": used,
        "missingMonths": [ym for ym in months if ym not in used],
        "metric": metric,
        "band": band,
        "filtered": parts["live"]["filtered"],
        "smooth": smooth,
        "values": [None if v is None else round(v, 1) for v in values],
        "breaks": _breaks(values),
        "total": 0,
        "cellsWithData": sum(1 for v in values if v is not None),
    }
    with _cache_lock:
        _results[key] = result
        while len(_results) > _RESULTS_MAX:
            _results.popitem(last=False)
    return result


def cell_trend(
    db: Session,
    code: str,
    metric: str,
    band: str,
    sex: str,
    ages: list[str],
    smooth: bool,
) -> dict | None:
    """격자 한 칸의 달별 값 — 칸을 눌렀을 때 "언제 많았나" 막대."""
    idx = _cells()["index"].get(code)
    if idx is None:
        return None
    if metric == "household":
        from src.services import household_dong

        return household_dong.cell_trend(db, idx)
    all_months = [r[0] for r in db.execute(text("SELECT ym FROM pop_grid_month ORDER BY ym")).all()]
    out = []
    for ym in all_months:
        g = grid_values(db, [ym], metric, band, sex, ages, smooth)
        out.append({"ym": ym, "value": g["values"][idx]})
    row = _cells()["rows"][idx]
    return {"code": code, "gu": row[1], "dong": row[2], "months": out}


def available_months(db: Session) -> list[dict]:
    """지도에서 고를 수 있는 달과 그 달에 있는 자료. 행정동 세대수가 있는 달은 "household"를 붙인다."""
    from src.services import household_dong

    out = {m["ym"]: list(m["metrics"]) for m in list_months(db)}
    for ym in household_dong.months(db):
        out.setdefault(ym, []).append("household")
    return [{"ym": ym, "metrics": out[ym]} for ym in sorted(out)]


# ---------- 매체 상세 — 매체가 있는 칸의 값(지도 칸 숫자와 같은 기준)

# 시간대별 그래프 — 지도의 시간대 칩과 같은 이름·순서.
_DETAIL_BANDS = (("am", "출근 7~9시"), ("day", "낮 10~16시"), ("pm", "퇴근 17~19시"), ("night", "야간 20~23시"))
# 매체 상세 연령 칸 — (화면 라벨, 경계, 격자 연령). 10대 이하 = 0~19세, 60대 이상 = 60세 이상(segments 가 70을 붙인다).
_DETAIL_AGES = (
    ("10", "under", ["00", "10"]),
    ("20대", None, ["20"]),
    ("30대", None, ["30"]),
    ("40대", None, ["40"]),
    ("50대", None, ["50"]),
    ("60", "over", ["60"]),
)


@lru_cache(maxsize=1)
def _cell_lookup() -> tuple[float, float, dict[tuple[int, int], list[int]]]:
    """좌표 → 칸 찾기용 묶음 — 칸 중심을 약 250m 상자에 넣는다(이웃 상자까지 보면 칸 하나를 놓치지 않는다)."""
    step_lat, step_lng = 0.00225, 0.0028
    buckets: dict[tuple[int, int], list[int]] = {}
    for i, row in enumerate(_cells()["rows"]):
        k = row[3]
        lat, lng = sum(k[0::2]) / 4, sum(k[1::2]) / 4
        buckets.setdefault((int(lat // step_lat), int(lng // step_lng)), []).append(i)
    return step_lat, step_lng, buckets


def cell_at(lat: float, lng: float) -> int | None:
    """좌표가 들어 있는 칸(격자 순서 번호) — 서울 밖이면 None. 칸은 네 모서리로 된 거의 직사각형이라 상자로 본다."""
    step_lat, step_lng, buckets = _cell_lookup()
    by, bx = int(lat // step_lat), int(lng // step_lng)
    rows = _cells()["rows"]
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            for i in buckets.get((by + dy, bx + dx), ()):
                k = rows[i][3]
                if min(k[0::2]) <= lat < max(k[0::2]) and min(k[1::2]) <= lng < max(k[1::2]):
                    return i
    return None


def _latest_year_months(db: Session) -> list[str]:
    """지도 처음 조건과 같은 기간 — 생활인구가 있는 가장 최근 해의 모든 달."""
    yms = [
        r[0]
        for r in db.execute(
            text("SELECT DISTINCT ym FROM pop_grid_value WHERE metric = 'live' ORDER BY ym")
        ).all()
    ]
    if not yms:
        return []
    year = yms[-1][:4]
    return [ym for ym in yms if ym.startswith(year)]


def _period_label(months: list[str]) -> str:
    """기간 — "2025년 1월~12월 평균", 한 달이면 "2025년 3월 평균"."""
    year = months[0][:4]
    first, last = int(months[0][4:]), int(months[-1][4:])
    return f"{year}년 {first}월 평균" if first == last else f"{year}년 {first}월~{last}월 평균"


def _top_pct(values: list[float | None], v: float) -> float:
    """서울 칸 가운데 몇 % 안에 드는지 — 값이 있는 칸 기준(지도 칸 정보 카드의 "서울 상위 N%"와 같은 계산)."""
    present = [x for x in values if x is not None]
    if not present:
        return 100.0
    above = sum(1 for x in present if x > v)
    return max(0.1, round(above / len(present) * 100, 1))


def media_cell_population(db: Session, lat: float, lng: float) -> dict | None:
    """매체 주변 유동인구 — 매체가 있는 250m 칸과 이웃 8칸(750m 네모, 가운데에서 약 375m)의 생활인구를 더한 값.

    화면 이름은 "가시거리 375m 이내 총 유동인구". 칸 값은 평활하지 않은 원래 값을 더한다(평활 값을 더하면 이웃이 겹쳐 세진다).
    기간은 지도 처음 조건과 같은 최근 해 전체 평균. 생활인구라 시간대마다 "한 시각에 그 안에 머무는 평균 인원"이고,
    총 인원(populationMin/Max)은 출근·낮·퇴근·야간 네 시간대 값을 더한 것이다(화면 "총 N명").
    성별·연령 비율과 시간대별 값도 같은 9칸·같은 기간으로 낸다. 순위는 지도 칸 정보 카드와 같은 종합 기준 서울 상위 %
    (매체 칸 하나 기준, 믹시 설명용). 서울 밖이거나 값이 없으면 None.
    """
    idx = cell_at(lat, lng)
    if idx is None:
        return None
    months = _latest_year_months(db)
    if not months:
        return None
    area = [idx, *_cells()["neighbors"][idx]]

    def value(metric: str = "live", band: str = "all", sex: str = "all", ages: list[str] | None = None):
        vals = grid_values(db, months, metric, band, sex, ages or [], False)["values"]
        present = [vals[i] for i in area if vals[i] is not None]
        return sum(present) if present else None

    bands = [dict(label=label, value=round(value(band=band) or 0)) for band, label in _DETAIL_BANDS]
    total = sum(b["value"] for b in bands)
    if not total:
        return None
    flow = grid_values(db, months, "flow", "all", "all", [], True)["values"]
    male, female = value(sex="M") or 0, value(sex="F") or 0
    by_age = [(label, bound, value(ages=ages) or 0) for label, bound, ages in _DETAIL_AGES]
    age_total = sum(v for _, _, v in by_age)
    male_pct = round(male / (male + female) * 100) if male + female else 0
    row = _cells()["rows"][idx]
    return dict(
        source="grid",
        placeName=f"{row[2]} · {_period_label(months)}",
        congestLevel=None,
        populationMin=total,
        populationMax=total,
        malePct=male_pct,
        femalePct=(100 - male_pct) if male + female else 0,
        ageRatios=[
            dict(label=label, value=round(v / age_total * 100, 1) if age_total else 0.0, bound=bound)
            for label, bound, v in by_age
        ],
        measuredAt=None,
        seoulTopPct=_top_pct(flow, flow[idx]) if flow[idx] is not None else None,
        bandAverages=bands,
    )
