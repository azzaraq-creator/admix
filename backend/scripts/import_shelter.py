#!/usr/bin/env python3
"""쉘터 매체목록 엑셀(쉘터매체목록_지면영상_YYYYMMDD.xlsx) → media + media_plan 적재.

- 원본은 한 줄이 광고면 하나다. 매체 하나 = 정류장 하나 × 지면/영상 × 매체구분(시트별)으로 묶고,
  판매그룹(같은 판넬 앞·뒤 면, 1기 2면)마다 상품 하나를 만든다. 상품 광고비 = 그 면들의 월 표시가 합.
- 시트: "쉘터_지면·영상"만. 올이즈웰전용(특정 광고주 전용 면)·미비항목(좌표 없음·테스트·판매 안 함)은 넣지 않는다.
- 카테고리: 쉘터 > 버스 정류장, 쉘터 > 택시 승강장(택시쉘터). 영상(디지털) 매체는 이름 뒤에 "(영상)"(에코큐브는 영상뿐이라 붙이지 않음). 매체구분(가로변 쉘터 등)은 설명·검색 태그에 남긴다.
  매체 ID 는 카테고리 접두로 자동 부여(media_service._next_media_id, 쉘터 SH-0001).
- 매체명은 정류장번호를 뗀 이름("01-080205 코아아트홀 옆" → "코아아트홀 옆"). 정류장번호는 stop_no(매체 정보 주소 아래)·
  설명 앞·검색 태그에 둔다 — 버스는 "-"를 뺀 ARS 번호(23-243 → 23243), 택시는 원본 그대로(01-080205).
  구분명은 카드에서 이름 뒤에 붙어 보이므로 쓰지 않는다.
- 디지털 단독 구좌(판매형태)는 세트 매체다 — 판매 유형 "패키지", 대표 상품은 세트상품 칸의 Half A/B PKG
  (월 3,000만, 그 패키지 전체 기·면 수), 개별 1면 상품도 함께 둔다. 같은 패키지 매체끼리 매체 정보에 목록으로 보인다
  (media_service._packages — 패키지 상품명이 같으면 같은 패키지). Full PKG(A+B, 5,000만)는 설명에 적는다.
- 판매방식 "세트 전용"(에코큐브 10기 세트)도 패키지다 — 개별 상품 없이 패키지 상품 하나만, 광고비는 비워 둔다(별도 협의).
  면 구성은 확인 전이라 면 수를 비우고, 노출 시간·운영 시간은 판매조건 칸("영상 30초 · 06:00~24:00")에서 읽는다.
- 등급은 KT 판매 등급(SA+ · SA-V · SA · S · A · L) 중 그 정류장에서 가장 높은 것, 직접 지정으로 둔다.
- 버스 쉘터 좌표는 서울시 버스정류장 좌표(transit_station, 정류장번호 = ARS 번호)로 바꾼다 — 엑셀(KT·KIMG) 좌표는
  같은 정류장인데 수백 m~수 km 어긋난 곳이 있다. 짝이 없는 정류장(택시쉘터 등)은 엑셀 좌표를 쓴다.
- 주소는 엑셀 지번 주소를 그대로 쓴다. --kakao 면 지번 주소로 도로명 주소·건물명을 찾아 채운다(좌표는 엑셀 값 유지).
- 매체를 지우지 않는다. 같은 매체가 이미 있는지도 보지 않으니, 다시 넣으려면 먼저 비운다.

사용법:
    python -m scripts.import_shelter <엑셀파일> --dry-run   # 묶음 수·예시만 보기
    python -m scripts.import_shelter <엑셀파일> [--kakao]
"""
from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from pathlib import Path

import openpyxl
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

load_dotenv()

from sqlalchemy import text

from src.database import SessionLocal
from src.models.media_master import Media
from src.services import ai_index, kakao_address
from src.services import media_service as ms

SHEETS = ("쉘터_지면·영상",)
HEADER_ROW = 2
GRADE_ORDER = ["SA+", "SA-V", "SA", "S", "A", "L"]
CITY_SHORT = {
    "서울특별시": "서울", "부산광역시": "부산", "대구광역시": "대구", "인천광역시": "인천",
    "광주광역시": "광주", "대전광역시": "대전", "울산광역시": "울산", "세종특별자치시": "세종",
    "경기도": "경기", "강원도": "강원", "강원특별자치도": "강원", "충청북도": "충북", "충청남도": "충남",
    "전라북도": "전북", "전북특별자치도": "전북", "전라남도": "전남", "경상북도": "경북", "경상남도": "경남",
    "제주특별자치도": "제주",
}
BATCH = 200
# 판매조건 칸: "Half A·B PKG 각 3,000만 · Full PKG 5,000만 · 개별 1기 강남권 150만/그 외 100만 · 20초 1일 120회"
SET_SALE_FORM = "디지털 단독 구좌"
PACKAGE_FEE = 30_000_000
PACKAGE_NOTE = "세트 상품: Half A·B PKG 각 월 3,000만 원 · A·B 함께(Full PKG) 월 5,000만 원"
DIGITAL_SECONDS = 20
DIGITAL_DAILY_PLAYS = 120
SET_ONLY_SALE = "세트 전용"  # 판매방식 — 개별로 팔지 않는다


def _s(v) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _int(v) -> int | None:
    try:
        return int(v) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _size(v) -> tuple[float, float] | None:
    """"1160*1710"(mm) → (1.16, 1.71) m."""
    m = re.match(r"^\s*(\d+(?:\.\d+)?)\s*[*xX×]\s*(\d+(?:\.\d+)?)\s*$", str(v or ""))
    return (float(m[1]) / 1000, float(m[2]) / 1000) if m else None


def _pixels(v) -> tuple[int, int] | None:
    m = re.match(r"^\s*(\d+)\s*[*xX×]\s*(\d+)\s*$", str(v or ""))
    return (int(m[1]), int(m[2])) if m else None


def _hhmm(v) -> str | None:
    s = _s(v)
    return s[:5] if s and re.match(r"^\d{2}:\d{2}", s) else None


def _condition_seconds(conditions: str | None) -> int | None:
    m = re.search(r"(\d+)\s*초", conditions or "")
    return int(m[1]) if m else None


def _condition_hours(conditions: str | None) -> tuple[str, str] | None:
    m = re.search(r"(\d{2}:\d{2})\s*~\s*(\d{2}:\d{2})", conditions or "")
    return (m[1], m[2]) if m else None


def _tags(raw) -> list[str]:
    out: list[str] = []
    for t in str(raw or "").split("/"):
        t = t.strip().lstrip("#").strip()
        if t and t not in out:
            out.append(t)
    return out


def read_rows(path: str) -> list[dict]:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    rows: list[dict] = []
    for name in SHEETS:
        ws = wb[name]
        it = ws.iter_rows(min_row=HEADER_ROW, values_only=True)
        header = [_s(h) for h in next(it)]
        for values in it:
            if all(v in (None, "") for v in values):
                continue
            row = dict(zip(header, values))
            row["_sheet"] = name
            rows.append(row)
    return rows


def package_name(row: dict) -> str | None:
    """세트상품 "디지털 가로변쉘터 Half A PKG (Full 포함)" → "디지털 가로변쉘터 Half A PKG". 세트 매체가 아니면 None."""
    if row["판매형태"] != SET_SALE_FORM and row["판매방식"] != SET_ONLY_SALE:
        return None
    name = _s(row["세트상품"])
    return name.split(" (")[0] if name else None


def package_sizes(rows: list[dict]) -> dict[str, tuple[int, int]]:
    """패키지 → (기 수, 면 수). 면번호가 없는(면 구성 미확인) 패키지는 면 수 None."""
    devices: dict[str, set] = defaultdict(set)
    faces: dict[str, int] = defaultdict(int)
    for r in rows:
        name = package_name(r)
        if name:
            devices[name].add((r["정류장번호"], _int(r["구조번호"])))
            faces[name] += 1 if _int(r["면번호"]) is not None else 0
    return {k: (len(devices[k]), faces[k] or None) for k in devices}


def group_rows(rows: list[dict]) -> list[list[dict]]:
    groups: dict[tuple, list[dict]] = defaultdict(list)
    for r in rows:
        groups[(r["_sheet"], r["정류장번호"], r["중분류"], r["매체구분"])].append(r)
    out = []
    for items in groups.values():
        items.sort(key=lambda r: (_int(r["구조번호"]) or 0, _int(r["면번호"]) or 0))
        out.append(items)
    out.sort(key=lambda g: (str(g[0]["정류장번호"]), g[0]["중분류"], g[0]["_sheet"]))
    return out


def _plans(items: list[dict], dooh: bool) -> list[dict]:
    """판매그룹마다 상품 하나 — 원본 순서(구조 → 면)대로."""
    by_group: dict[str, list[dict]] = {}
    for r in items:
        by_group.setdefault(r["판매그룹"], []).append(r)
    plans = []
    for faces in by_group.values():
        first = faces[0]
        structure = _int(first["구조번호"])
        nos = [str(_int(f["면번호"])) for f in faces if _int(f["면번호"]) is not None]
        where = f"{structure}번 승차대" if structure else "승차대"
        what = f"{'·'.join(nos)}면" if nos else "면 구성 확인 필요"
        kind = "영상" if dooh else (_s(first["판매형태"]) or "").split(" (")[0]
        plans.append({
            "product_display_name": f"{where} {what} ({kind})" if kind else f"{where} {what}",
            "product_master_type": "PM_INDIVIDUAL",
            "contractual_duration": _int(first["최소기간"]) or 1,
            "contractual_duration_type": "MONTHS",
            "advertisement_fee": sum(_int(f["월 표시가(원)"]) or 0 for f in faces) or None,
            "production_fee": None,
            "exposure_duration_seconds": (_int(first["소재길이(초)"]) or DIGITAL_SECONDS) if dooh else None,
            "broadcasts_count_manual": DIGITAL_DAILY_PLAYS if dooh else None,
            "default_device_quantity": 1,
            "default_surface_quantity": len(faces),
        })
    return plans


def bus_stop_points(db) -> dict[str, tuple[float, float]]:
    """서울시 버스정류장 ARS 번호 → 좌표(transit_sync 가 받아 둔 정류장 마스터)."""
    rows = db.execute(text("SELECT lines, latitude, longitude FROM transit_station WHERE kind = 'bus'"))
    return {r.lines: (r.latitude, r.longitude) for r in rows if r.lines}


def build_media(
    items: list[dict],
    kakao_cache: dict | None,
    stops: dict[str, tuple[float, float]] | None = None,
    sizes: dict[str, tuple[int, int]] | None = None,
) -> tuple[dict, list[dict]]:
    first = items[0]
    dooh = first["중분류"] == "쉘터광고(영상)"
    kind = _s(first["매체구분"])
    stop_no = _s(first["정류장번호"])
    name = _s(first["매체명"])
    if stop_no and name.startswith(stop_no):
        name = name[len(stop_no):].strip() or name
    place = name
    shown_no = stop_no if kind == "택시쉘터" else (stop_no or "").replace("-", "") or None
    # 에코큐브는 영상 매체뿐이라 "(영상)"을 붙이지 않는다.
    if dooh and kind != "에코큐브":
        name = f"{name} (영상)"
    jibun = _s(next((r["주소"] for r in items if _s(r["주소"])), None))
    road = _s(next((r["도로명주소"] for r in items if _s(r["도로명주소"])), None))
    city_raw = _s(first["시도"])
    grades = {_s(r["등급"]) for r in items} & set(GRADE_ORDER)
    grade = next((g for g in GRADE_ORDER if g in grades), None)
    structures = {(r["정류장번호"], _int(r["구조번호"])) for r in items}
    facility = sorted({_s(r["시설타입"]) for r in items if _s(r["시설타입"])})
    tags = _tags(next((r["분석태그 원본"] for r in items if _s(r["분석태그 원본"])), None))
    conditions = _s(first["판매조건"])
    set_name = _s(first["세트상품"])
    packages = sorted({n for n in (package_name(r) for r in items) if n})
    set_only = first["판매방식"] == SET_ONLY_SALE
    faces_known = any(_int(r["면번호"]) is not None for r in items)
    remarks = " · ".join(x for x in [conditions, f"세트상품: {set_name}" if set_name else None] if x)
    size = next((s for s in (_size(r["내경"]) for r in items) if s), None)
    pixels = next((p for p in (_pixels(r["해상도"]) for r in items) if p), None)
    data = {
        "name": name,
        "media_source": "FIXED",
        "sales_type": "GROUP" if packages else "SINGLE",
        "stop_no": shown_no,
        "category_large": "쉘터",
        "category_small": "택시 승강장" if kind == "택시쉘터" else "버스 정류장",
        "ooh_type": "DOOH" if dooh else "OOH",
        "exposure_type": "OUTSIDE",
        "media_shape": "VERTICAL_SHAPE" if size and size[1] > size[0] else None,
        "description": (
            f"정류장번호 {shown_no} · {_s(first['시군구']) or ''} {place} {kind} {'영상' if dooh else '지면'} 광고 · "
            f"승차대 {len(structures)}기" + (f" {len(items)}면" if faces_known else "") + (f" · 시설타입 {', '.join(facility)}" if facility else "")
        ).strip(),
        "address": road or jibun,
        "full_address_jibun": jibun,
        "legal_dong": _s(first["법정동(원본)"]),
        "city": CITY_SHORT.get(city_raw or "", city_raw),
        "district": _s(first["시군구"]),
        "latitude": float(first["위도"]),
        "longitude": float(first["경도"]),
        "device_quantity": len(structures),
        "surface_quantity": len(items) if faces_known else None,
        "spec_width": size[0] if size else None,
        "spec_height": size[1] if size else None,
        "spec_resolution_width": pixels[0] if pixels else None,
        "spec_resolution_height": pixels[1] if pixels else None,
        "operation_start_time": _hhmm(first["운영시작"]),
        "operation_end_time": _hhmm(first["운영종료"]),
        "material_formats": ["IMAGE"] if dooh else None,
        "list_labels": [x for x in [shown_no, kind] if x] + [t for t in tags if t not in (shown_no, kind)] or None,
        "special_remarks": remarks or None,
        "final_grade": grade,
        "final_grade_manual": grade is not None,
        "execution_status": "가능",
        # 한꺼번에 옮겨 오는 기존 매체라 "신규" 뱃지를 붙이지 않는다(비우면 등록 후 14일 자동 신규).
        "is_newly_built_yn": False,
    }
    if kakao_cache is not None and jibun:
        if jibun not in kakao_cache:
            try:
                kakao_cache[jibun] = kakao_address.lookup(jibun)
            except kakao_address.AddressLookupError as exc:
                kakao_cache[jibun] = str(exc)
        found = kakao_cache[jibun]
        if isinstance(found, dict):
            for key in ("accurate_address", "building_name", "legal_dong", "city", "district"):
                if found.get(key):
                    data[key] = found[key]
            road_name = (found.get("accurate_address") or "").split(" (")[0]
            if road_name and not road:
                data["address"] = road_name
    stop = (stops or {}).get((stop_no or "").replace("-", "")) if kind != "택시쉘터" else None
    if stop:
        data["latitude"], data["longitude"] = stop
    hours = _condition_hours(conditions) if dooh else None
    if hours and not (data["operation_start_time"] or data["operation_end_time"]):
        data["operation_start_time"], data["operation_end_time"] = hours
    # 시작·종료 중 하나만 있으면 저장 검사에 걸린다 — 둘 다 비운다.
    if not (data["operation_start_time"] and data["operation_end_time"]):
        data["operation_start_time"] = data["operation_end_time"] = None
    if set_only:
        # 에코큐브는 면 구성 확인 전이라 크기·해상도·소재 형식을 비운다(매체 정보에 안 보인다).
        for key in ("spec_width", "spec_height", "spec_resolution_width", "spec_resolution_height", "media_shape", "material_formats"):
            data[key] = None
    if packages and not set_only:
        data["description"] = f"{data['description']} · {PACKAGE_NOTE}"
    package_plans = [
        {
            "product_display_name": name,
            "product_master_type": "PM_PACKAGE",
            "contractual_duration": 1,
            "contractual_duration_type": "MONTHS",
            # 세트 전용(에코큐브)은 가격 협의 — 광고비를 비워 두면 화면에 별도 협의로 보인다.
            "advertisement_fee": None if set_only else PACKAGE_FEE,
            "production_fee": None,
            "exposure_duration_seconds": _condition_seconds(conditions) if set_only else DIGITAL_SECONDS,
            "broadcasts_count_manual": None if set_only else DIGITAL_DAILY_PLAYS,
            "default_device_quantity": (sizes or {}).get(name, (1, 1))[0],
            "default_surface_quantity": (sizes or {}).get(name, (1, 1))[1],
        }
        for name in packages
    ]
    return data, package_plans + ([] if set_only else _plans(items, dooh))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("xlsx")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--kakao", action="store_true", help="지번 주소로 도로명 주소·건물명 찾기")
    args = ap.parse_args()

    rows = read_rows(args.xlsx)
    groups = group_rows(rows)
    sizes = package_sizes(rows)
    print("세트 상품", sizes)
    built = [build_media(g, None, None, sizes) for g in groups] if args.dry_run else None
    print(f"면 {len(rows)}개 → 매체 {len(groups)}개")
    if built is not None:
        by_cat: dict[tuple, int] = defaultdict(int)
        for data, plans in built:
            by_cat[(data["category_large"], data["category_small"], data["ooh_type"])] += 1
        for k, n in sorted(by_cat.items()):
            print("  ", *k, n)
        print("상품", sum(len(p) for _, p in built))
        for data, plans in built[:2]:
            print(data)
            print(plans)
        return

    kakao_cache: dict | None = {} if args.kakao else None
    db = SessionLocal()
    inserted, failed, new_ids = 0, [], []
    stops = bus_stop_points(db)
    print(f"서울시 버스정류장 좌표 {len(stops)}곳")
    try:
        for i, items in enumerate(groups, start=1):
            data, plans = build_media(items, kakao_cache, stops, sizes)
            data = {k: v for k, v in data.items() if v is not None}
            ms._apply_spec_unit(data)
            try:
                ms._apply_dooh_rules(data)
                ms._validate_media_values(data)
                with db.begin_nested():
                    data["media_id"] = ms._next_media_id(db, data["category_large"])
                    media = Media(**data)
                    db.add(media)
                    db.flush()
                    ms._sync_plans(db, media, plans)
                    ms._apply_plan_aggregates(media)
                    db.flush()
                inserted += 1
                new_ids.append(media.media_id)
            except Exception as exc:  # noqa: BLE001 — 한 매체가 실패해도 나머지는 넣는다
                failed.append((items[0]["지면코드"], getattr(exc, "detail", None) or repr(exc)))
            if i % BATCH == 0:
                db.commit()
                print(f"  {i}/{len(groups)}")
        db.commit()
        ai_index.sync_media_ids(db, new_ids)
    finally:
        db.close()
    print(f"넣음 {inserted}, 실패 {len(failed)}")
    for code, reason in failed[:30]:
        print("  ", code, reason)
    if kakao_cache is not None:
        misses = [k for k, v in kakao_cache.items() if isinstance(v, str)]
        print(f"카카오 주소 검색 {len(kakao_cache)}건, 못 찾음 {len(misses)}건")


if __name__ == "__main__":
    main()
