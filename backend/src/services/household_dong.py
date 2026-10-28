"""행정동 세대수 — 행정안전부 「지역별(행정동) 세대원수별 주민등록 세대수」를 저장하고 지도용 값으로 바꾼다.

데이터는 공공데이터포털(data.go.kr/data/15097974)에서 받는다. 서울 행정동만 담는다.
- 자동: 인증키(DATA_GO_KR_SERVICE_KEY)가 있으면 하루 한 번 API 목록을 보고, 2025-01부터 DB에 없는 달을 받아 넣는다.
  이 API는 달마다 주소(uddi)가 따로라 목록(Swagger 문서, 키 없이 공개)에서 기준연월을 읽는다.
- 수동: 어드민 "유동인구 데이터" ③에 CSV를 올리거나 "지금 받아 오기"를 누른다.
지도 "거주인구" 자료는 격자로 나뉜 자료가 아니라 동마다 값 하나라, 250m 칸을 그 칸의 동(pop-grid-cells.json)의 값으로 칠한다
(동 경계가 250m 계단 모양이 된다). 동 이름은 구 + 동 이름(가운뎃점·마침표·공백을 뺀 것)으로 맞춘다.
- 칸 숫자는 동마다 가운데 칸 하나에만 적는다(labelCells). 색 단계·서울 상위 %는 칸이 아니라 동 기준이다.
- 격자 목록에 없는 동(2026-09 기준 동대문구 신설동·용두동 — 격자 목록이 옛 동 이름이다)은 지도에 나오지 않는다.
"""
from __future__ import annotations

import csv
import io
import logging
import re
import threading
import time
from collections import OrderedDict
from datetime import datetime, timezone
from functools import lru_cache

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

from src.config import get_settings
from src.services import pop_grid

logger = logging.getLogger(__name__)

SOURCE = "행정안전부 주민등록 세대수(행정동)"
_COUNT_COLUMNS = [f"{n}인세대" for n in range(1, 10)] + ["10인이상세대"]
_REQUIRED = ["행정기관코드", "기준연월", "시도명", "시군구명", "읍면동명", "전체세대수", *_COUNT_COLUMNS]


class HouseholdFileError(ValueError):
    """올린 파일을 읽을 수 없음 — 메시지를 그대로 어드민에 보여 준다."""


def _norm(name: str) -> str:
    return re.sub(r"[\s·.ㆍ,]", "", name or "")


def _ym_of(value: str) -> str | None:
    """기준연월 "2026-09-30" · "202609" · "2026-09" → "202609"."""
    digits = re.sub(r"\D", "", value or "")
    ym = digits[:6]
    return ym if re.fullmatch(r"20\d{2}(0[1-9]|1[0-2])", ym) else None


def _int(value: str | int | None) -> int:
    v = str(value if value is not None else "").replace(",", "").strip()
    return int(float(v)) if v else 0


def _rows_from_records(records) -> tuple[str, list[dict]]:
    """CSV 줄·API 줄(같은 칸 이름) → (기준연월, 서울 행정동 줄)."""
    rows, yms = [], set()
    for r in records:
        if str(r.get("시도명") or "").strip() != "서울특별시":
            continue
        ym = _ym_of(str(r.get("기준연월", "")))
        if ym is None:
            raise HouseholdFileError(f"기준연월을 알 수 없어요 ({r.get('기준연월')!r}).")
        yms.add(ym)
        rows.append(
            {
                "adm_code": str(r["행정기관코드"] or "").strip(),
                "gu": str(r["시군구명"] or "").strip(),
                "dong": str(r["읍면동명"] or "").strip(),
                "total": _int(r["전체세대수"]),
                "counts": [_int(r[c]) for c in _COUNT_COLUMNS],
            }
        )
    # 시군구 합계 줄(읍면동명이 빈 줄)이 섞인 파일도 있어 뺀다.
    rows = [r for r in rows if r["dong"] and r["adm_code"]]
    if not rows:
        raise HouseholdFileError("파일에 서울 행정동 줄이 없어요.")
    if len(yms) > 1:
        raise HouseholdFileError(f"한 파일에 여러 달이 섞여 있어요 ({', '.join(sorted(yms))}) — 한 달 파일만 올려 주세요.")
    return yms.pop(), rows


def parse_csv(content: bytes) -> tuple[str, list[dict]]:
    """CSV → (기준연월, 서울 행정동 줄). 공공데이터포털 파일은 CP949, 엑셀에서 다시 저장하면 UTF-8(BOM)일 수 있다."""
    for enc in ("utf-8-sig", "cp949"):
        try:
            s = content.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise HouseholdFileError("파일을 읽을 수 없어요 — 공공데이터포털에서 받은 CSV 파일인지 확인해 주세요.")
    reader = csv.DictReader(io.StringIO(s))
    cols = [c.strip() for c in reader.fieldnames or []]
    reader.fieldnames = cols
    missing = [c for c in _REQUIRED if c not in cols]
    if missing:
        raise HouseholdFileError(
            f"「지역별(행정동) 세대원수별 주민등록 세대수」 파일이 아닌 것 같아요 (없는 칸: {', '.join(missing[:4])})."
        )
    return _rows_from_records(reader)


def save_month(db: Session, content: bytes, admin_name: str, filename: str) -> dict:
    """CSV 한 달치로 그 달 값을 통째로 바꾼다."""
    ym, rows = parse_csv(content)
    return _save_rows(db, ym, rows, admin_name, filename)


def _save_rows(db: Session, ym: str, rows: list[dict], admin_name: str, filename: str) -> dict:
    """그 달 값을 통째로 바꾼다(지우고 넣기를 한 번에 — 반쯤 들어간 달이 보이지 않게)."""
    now = datetime.now(timezone.utc)
    db.execute(text("DELETE FROM household_dong WHERE ym = :ym"), {"ym": ym})
    db.execute(
        text(
            "INSERT INTO household_dong (ym, adm_code, gu, dong, total, counts, file, uploaded_by, updated_at) "
            "VALUES (:ym, :adm_code, :gu, :dong, :total, :counts, :file, :by, :now)"
        ),
        [dict(r, ym=ym, file=filename[:200], by=admin_name[:64], now=now) for r in rows],
    )
    db.commit()
    _clear_cache()
    known = {(r["gu"], _norm(r["dong"])) for r in rows}
    unmatched = sorted({f"{g} {d}" for g, d in _cell_dongs()[1] if (g, d) not in known})
    not_on_map = [f"{r['gu']} {r['dong']}" for r in rows if (r["gu"], _norm(r["dong"])) not in _cell_dongs()[1]]
    return {
        "ym": ym,
        "dongs": len(rows),
        "total": sum(r["total"] for r in rows),
        # 격자에 있는데 파일에 없는 동 — 그 칸은 "자료 없음"
        "missingOnMap": unmatched,
        # 파일에 있는데 격자 목록에 없는 동 — 지도에 안 나온다
        "notOnMap": not_on_map,
    }


def delete_month(db: Session, ym: str) -> bool:
    deleted = db.execute(text("DELETE FROM household_dong WHERE ym = :ym"), {"ym": ym}).rowcount
    db.commit()
    _clear_cache()
    return bool(deleted)


def list_months(db: Session) -> list[dict]:
    rows = db.execute(
        text(
            "SELECT ym, count(*) AS dongs, sum(total) AS total, max(file) AS file, max(uploaded_by) AS by, "
            "max(updated_at) AS updated_at FROM household_dong GROUP BY ym ORDER BY ym"
        )
    ).all()
    return [
        {
            "ym": r.ym,
            "dongs": r.dongs,
            "total": int(r.total or 0),
            "file": r.file,
            "by": r.by,
            "updatedAt": r.updated_at.isoformat(timespec="seconds") if r.updated_at else None,
        }
        for r in rows
    ]


# ---------- 칸 ↔ 동


@lru_cache(maxsize=1)
def _cell_dongs() -> tuple[list[tuple[str, str] | None], set[tuple[str, str]], list[int]]:
    """(칸마다 (구, 동 이름) 열쇠, 격자에 있는 동 열쇠, 동마다 숫자를 적을 가운데 칸 번호)."""
    rows = pop_grid._cells()["rows"]
    keys: list[tuple[str, str] | None] = [(r[1], _norm(r[2])) if r[2] else None for r in rows]
    centers = [(sum(r[3][0::2]) / 4, sum(r[3][1::2]) / 4) for r in rows]
    members: dict[tuple[str, str], list[int]] = {}
    for i, k in enumerate(keys):
        if k:
            members.setdefault(k, []).append(i)
    label_cells = []
    for idxs in members.values():
        lat = sum(centers[i][0] for i in idxs) / len(idxs)
        lng = sum(centers[i][1] for i in idxs) / len(idxs)
        label_cells.append(min(idxs, key=lambda i: (centers[i][0] - lat) ** 2 + (centers[i][1] - lng) ** 2))
    return keys, set(members), sorted(label_cells)


# ---------- 지도 값

_cache_lock = threading.Lock()
_results: OrderedDict[tuple, dict] = OrderedDict()
_RESULTS_MAX = 50


def _clear_cache() -> None:
    with _cache_lock:
        _results.clear()


def _version(db: Session) -> str:
    v = db.execute(text("SELECT count(*), max(updated_at) FROM household_dong")).first()
    return f"{v[0]}:{v[1].isoformat() if v[1] else ''}"


def months(db: Session) -> list[str]:
    return [r[0] for r in db.execute(text("SELECT DISTINCT ym FROM household_dong ORDER BY ym")).all()]


def _dong_totals(db: Session, months: list[str]) -> tuple[dict[tuple[str, str], float], list[str]]:
    """동 열쇠 → 고른 달 평균 세대수(그 동이 있는 달만), 그리고 값이 있는 달."""
    res = db.execute(
        text("SELECT ym, gu, dong, total FROM household_dong WHERE ym = ANY(:months)"), {"months": months}
    ).all()
    sums: dict[tuple[str, str], list[int]] = {}
    used = set()
    for r in res:
        used.add(r.ym)
        sums.setdefault((r.gu, _norm(r.dong)), []).append(r.total)
    return {k: sum(v) / len(v) for k, v in sums.items()}, sorted(used)


def grid_values(db: Session, months: list[str]) -> dict:
    """지도 한 장 — pop_grid.grid_values 와 같은 모양. 칸 값 = 그 칸 동의 세대수."""
    months = sorted(set(months))
    key = (_version(db), tuple(months))
    with _cache_lock:
        if key in _results:
            _results.move_to_end(key)
            return _results[key]
    totals, used = _dong_totals(db, months)
    keys, _, label_cells = _cell_dongs()
    values = [None if k is None or k not in totals else round(totals[k], 1) for k in keys]
    # 색 단계는 동 기준 — 칸으로 세면 넓은 동이 여러 번 세진다.
    dong_values = [v for v in totals.values() if v > 0]
    result = {
        "months": used,
        "missingMonths": [ym for ym in months if ym not in used],
        "metric": "household",
        "band": "all",
        "filtered": False,
        "smooth": False,
        "values": values,
        "breaks": pop_grid._breaks(dong_values),
        "total": round(sum(totals.values())),
        "cellsWithData": sum(1 for v in values if v is not None),
        "labelCells": [i for i in label_cells if values[i] is not None],
    }
    with _cache_lock:
        _results[key] = result
        while len(_results) > _RESULTS_MAX:
            _results.popitem(last=False)
    return result


def cell_trend(db: Session, idx: int) -> dict:
    """칸 하나(= 그 동)의 달별 세대수."""
    keys = _cell_dongs()[0]
    key = keys[idx]
    out = []
    for ym in months(db):
        totals, _ = _dong_totals(db, [ym])
        out.append({"ym": ym, "value": totals.get(key) if key else None})
    row = pop_grid._cells()["rows"][idx]
    return {"code": row[0], "gu": row[1], "dong": row[2], "months": out}


# ---------- 공공데이터포털 API 자동 받기

_OAS_URL = "https://infuser.odcloud.kr/oas/docs?namespace=15097974/v1"
_API_BASE = "https://api.odcloud.kr/api"
# 지도에서 고르는 기간 — 2025년 1월부터 받는다.
SYNC_FROM = "202501"
SYNC_INTERVAL_S = 24 * 3600
API_FILE = "공공데이터포털 API"


def api_months() -> list[tuple[str, str]]:
    """API에 올라온 달 — [(기준연월 "202609", 주소 "/15097974/v1/uddi:…")] 오래된 것부터. 키 없이 받는 공개 문서."""
    r = httpx.get(_OAS_URL, timeout=30)
    r.raise_for_status()
    out = []
    for path, spec in (r.json().get("paths") or {}).items():
        m = re.search(r"_(20\d{6})$", (spec.get("get") or {}).get("summary") or "")
        if m:
            out.append((m.group(1)[:6], path))
    return sorted(out)


def fetch_month(path: str, key: str) -> tuple[str, list[dict]]:
    """한 달치 전국 약 3,600줄을 한 번에 받아 서울 행정동만."""
    r = httpx.get(
        _API_BASE + path,
        params={"page": 1, "perPage": 10000, "returnType": "JSON", "serviceKey": key},
        timeout=60,
    )
    r.raise_for_status()
    body = r.json()
    data = body.get("data") or []
    if body.get("totalCount") and len(data) < body["totalCount"]:
        raise HouseholdFileError(f"API가 일부만 줬어요 ({len(data)}/{body['totalCount']}줄).")
    return _rows_from_records(data)


def sync_new_months(db: Session, by: str = "자동 갱신") -> list[str]:
    """2025-01부터 API에는 있는데 DB에 없는 달을 받아 넣는다. 넣은 달 목록을 돌려준다(키가 없으면 빈 목록)."""
    key = get_settings().data_go_kr_service_key
    if not key:
        return []
    have = set(months(db))
    added = []
    for ym, path in api_months():
        if ym < SYNC_FROM or ym in have:
            continue
        got_ym, rows = fetch_month(path, key)
        _save_rows(db, got_ym, rows, by, API_FILE)
        logger.info("행정동 세대수 %s %d곳 저장", got_ym, len(rows))
        added.append(got_ym)
    return added


def start_daily_sync() -> None:
    """백엔드가 켜져 있는 동안 하루 한 번 새 달을 확인한다(키가 없으면 시작하지 않는다)."""
    if not get_settings().data_go_kr_service_key:
        return

    def loop() -> None:
        from src.database import SessionLocal

        while True:
            try:
                with SessionLocal() as db:
                    # 서버 프로세스가 여럿이어도 한 곳만 받는다.
                    if db.execute(text("SELECT pg_try_advisory_lock(59059)")).scalar():
                        try:
                            sync_new_months(db)
                        finally:
                            db.execute(text("SELECT pg_advisory_unlock(59059)"))
                            db.commit()
            except Exception:  # 공공데이터포털 장애·DB 오류가 있어도 다음 날 다시 시도한다.
                logger.exception("행정동 세대수 자동 갱신 실패")
            time.sleep(SYNC_INTERVAL_S)

    threading.Thread(target=loop, name="household-sync", daemon=True).start()
