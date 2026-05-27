#!/usr/bin/env python3
"""
엑셀 → DB 임포트 스크립트 (Recommend V2)

Sheet1: 매체 데이터 (행1=영문헤더, 행2=한글헤더, 행3+=데이터)
Sheet2: 키워드 사전 (코드 prefix로 IND/PRD/OBJ/TGT/LOC/CAT 자동 분류)

영문 헤더 기반으로 컬럼 인덱스를 동적으로 찾고, 못 찾으면 기존 인덱스로 fallback.
CAT 카테고리는 detail.mediaItemCategory.displayValue 값을 사용.
Sheet2 에 CAT 사전이 없으면 distinct displayValue 를 CAT-01, CAT-02... 로 자동 등록.

사용법:
    python -m scripts.import_media <엑셀파일>
"""
from __future__ import annotations

import re
import sys
import uuid
from pathlib import Path

import openpyxl
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

load_dotenv()

from src.config import get_settings
from src.models.media import KeywordCategory, MediaItem, MediaKeyword

engine = create_engine(get_settings().database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)

# 영문 헤더 매핑 — 못 찾으면 fallback 인덱스 사용
HEADER_TO_FALLBACK_IDX = {
    "media_source": 0,
    "detail.name": 2,
    "list.advertisement_fee": 3,
    "IND (업종 라벨)": 11,
    "PRD (제품 라벨)": 12,
    "OBJ (목적 라벨)": 13,
    "TGT (타깃 라벨)": 14,
    "LOC (지역 라벨)": 15,
    "detail.mediaItemCategory.displayValue": None,  # 동적 탐색만, fallback 없음
    "thumbnail_url": 20,
    "all_image_urls": 22,
}

CODE_RE = re.compile(r"(IND-\d+|PRD-\d+|OBJ-\d+|TGT-\d+|LOC-\d+|CAT-\d+)")


def _clean(v) -> str:
    if v is None:
        return ""
    s = str(v).strip()
    return "" if s.lower() == "none" else s


def _parse_label_string(text: str) -> list[str]:
    if not text:
        return []
    return CODE_RE.findall(text)


def _category_from_code(code: str) -> KeywordCategory | None:
    prefix = code.split("-")[0] if "-" in code else ""
    try:
        return KeywordCategory(prefix)
    except ValueError:
        return None


def _resolve_header_indexes(ws) -> dict[str, int | None]:
    """Sheet1 1행 영문 헤더에서 컬럼 인덱스 dict 생성."""
    header_row = next(ws.iter_rows(min_row=1, max_row=1, values_only=True), ())
    headers = [_clean(h) for h in header_row]
    out: dict[str, int | None] = {}
    for name, fallback in HEADER_TO_FALLBACK_IDX.items():
        try:
            out[name] = headers.index(name)
        except ValueError:
            out[name] = fallback
    return out


def _cell(row, idx: int | None) -> str:
    if idx is None or idx < 0 or idx >= len(row):
        return ""
    return _clean(row[idx])


def _sheet1_from_row(row, idx: dict[str, int | None]) -> dict:
    raw_ind = _cell(row, idx["IND (업종 라벨)"])
    raw_prd = _cell(row, idx["PRD (제품 라벨)"])
    raw_obj = _cell(row, idx["OBJ (목적 라벨)"])
    raw_tgt = _cell(row, idx["TGT (타깃 라벨)"])
    raw_loc = _cell(row, idx["LOC (지역 라벨)"])
    raw_cat = _cell(row, idx["detail.mediaItemCategory.displayValue"])
    return dict(
        media_source=_cell(row, idx["media_source"]),
        name=_cell(row, idx["detail.name"]),
        advertisement_fee=_cell(row, idx["list.advertisement_fee"]),
        thumbnail_url=_cell(row, idx["thumbnail_url"]),
        all_image_urls=_cell(row, idx["all_image_urls"]),
        ind_codes=_parse_label_string(raw_ind),
        prd_codes=_parse_label_string(raw_prd),
        obj_codes=_parse_label_string(raw_obj),
        tgt_codes=_parse_label_string(raw_tgt),
        loc_codes=_parse_label_string(raw_loc),
        cat_codes=[],  # 임포트 후 raw_cat → Sheet2 매핑으로 채움
        raw_ind=raw_ind or None,
        raw_prd=raw_prd or None,
        raw_obj=raw_obj or None,
        raw_tgt=raw_tgt or None,
        raw_loc=raw_loc or None,
        raw_cat=raw_cat or None,
    )


def import_keywords(wb, session: Session) -> int:
    """Sheet2: 코드 prefix로 카테고리 자동 분류."""
    ws = wb["Sheet2"]
    count = 0
    skipped = 0
    for row in ws.iter_rows(min_row=1, values_only=True):
        if not row:
            continue
        code_cell = _clean(row[0]) if len(row) > 0 else ""
        if not CODE_RE.fullmatch(code_cell):
            continue
        category = _category_from_code(code_cell)
        if category is None:
            skipped += 1
            continue
        label = _clean(row[1]) if len(row) > 1 else ""
        kw_text = _clean(row[2]) if len(row) > 2 else ""
        keywords = [k.strip() for k in re.split(r"[,/\n]+", kw_text) if k.strip()]
        if not keywords:
            keywords = [label] if label else []
        if not keywords:
            continue
        description = label or None
        existing = (
            session.query(MediaKeyword)
            .filter_by(category=category, code=code_cell)
            .first()
        )
        if existing:
            existing.keywords = keywords
            existing.description = description
        else:
            session.add(
                MediaKeyword(
                    id=uuid.uuid4(),
                    category=category,
                    code=code_cell,
                    keywords=keywords,
                    description=description,
                )
            )
        count += 1
    session.commit()
    if skipped:
        print(f"  [skip] 알 수 없는 카테고리 {skipped}건")
    return count


def auto_register_cat_keywords(session: Session, raw_values: list[str]) -> int:
    """Sheet2 에 CAT 사전이 없거나 raw 값에 대응되는 코드가 없으면 자동 등록."""
    distinct = sorted({v.strip() for v in raw_values if v and v.strip()})
    if not distinct:
        return 0

    existing = session.query(MediaKeyword).filter_by(category=KeywordCategory.CAT).all()
    # description(=원본 displayValue) 또는 keywords[0] 이 일치하는 코드는 재사용
    by_desc: dict[str, MediaKeyword] = {}
    for kw in existing:
        if kw.description:
            by_desc[kw.description.strip()] = kw
        for k in (kw.keywords or []):
            by_desc.setdefault(k.strip(), kw)

    # 다음 CAT-XX 번호
    used_nums = set()
    for kw in existing:
        m = re.match(r"CAT-(\d+)", kw.code or "")
        if m:
            used_nums.add(int(m.group(1)))
    next_num = 1

    def _next_code() -> str:
        nonlocal next_num
        while next_num in used_nums:
            next_num += 1
        used_nums.add(next_num)
        return f"CAT-{next_num:02d}"

    added = 0
    for val in distinct:
        if val in by_desc:
            continue
        code = _next_code()
        session.add(
            MediaKeyword(
                id=uuid.uuid4(),
                category=KeywordCategory.CAT,
                code=code,
                keywords=[val],
                description=val,
            )
        )
        added += 1
    if added:
        session.commit()
    return added


def map_raw_cat_to_codes(session: Session) -> int:
    """Sheet2 CAT 사전을 사용해 media_items.cat_codes 채움."""
    cat_rows = session.query(MediaKeyword).filter_by(category=KeywordCategory.CAT).all()
    # 정확 일치 우선: description / keywords 의 trim 값 → code
    code_by_value: dict[str, str] = {}
    for r in cat_rows:
        if r.description:
            code_by_value.setdefault(r.description.strip(), r.code)
        for k in (r.keywords or []):
            code_by_value.setdefault(k.strip(), r.code)

    updated = 0
    items = session.query(MediaItem).filter(MediaItem.raw_cat.isnot(None)).all()
    for it in items:
        val = (it.raw_cat or "").strip()
        if not val:
            continue
        code = code_by_value.get(val)
        if code:
            it.cat_codes = [code]
            updated += 1
        else:
            it.cat_codes = []
    session.commit()
    return updated


def import_media_items(wb, session: Session, replace: bool = True) -> tuple[int, list[str]]:
    """Sheet1 임포트. (count, raw_cat_values) 리턴."""
    if replace:
        session.query(MediaItem).delete()
        session.flush()
    ws = wb["Sheet1"]
    idx = _resolve_header_indexes(ws)
    count = 0
    raw_cat_values: list[str] = []
    for row in ws.iter_rows(min_row=3, values_only=True):
        if not row or not _cell(row, idx["media_source"]):
            continue
        data = _sheet1_from_row(row, idx)
        if not data["name"]:
            continue
        if data.get("raw_cat"):
            raw_cat_values.append(data["raw_cat"])
        session.add(MediaItem(id=uuid.uuid4(), **data))
        count += 1
        if count % 200 == 0:
            session.flush()
    session.commit()
    return count, raw_cat_values


def main(path: str) -> None:
    p = Path(path)
    print(f"[import] 파일: {p}")
    wb = openpyxl.load_workbook(p, data_only=True)
    print(f"[import] 시트: {wb.sheetnames}")

    session = SessionLocal()
    try:
        if "Sheet2" in wb.sheetnames:
            kw_count = import_keywords(wb, session)
            print(f"[import] keywords upsert: {kw_count}건")

        mi_count = 0
        raw_cat_values: list[str] = []
        if "Sheet1" in wb.sheetnames:
            mi_count, raw_cat_values = import_media_items(wb, session)
            print(f"[import] media_items upsert: {mi_count}건")

        # CAT 자동 등록 + 매핑
        if raw_cat_values:
            added = auto_register_cat_keywords(session, raw_cat_values)
            if added:
                print(f"[import] CAT 자동 등록: {added}건")
            mapped = map_raw_cat_to_codes(session)
            print(f"[import] cat_codes 매핑: {mapped}건")

        print("\n[검증]")
        print(f"  media_keywords: {session.query(MediaKeyword).count()}건")
        for cat in KeywordCategory:
            n = session.query(MediaKeyword).filter_by(category=cat).count()
            print(f"    {cat.value}: {n}건")
        print(f"  media_items: {session.query(MediaItem).count()}건")
    finally:
        session.close()
    print("[완료]")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("사용법: python -m scripts.import_media <엑셀파일>")
        sys.exit(1)
    main(sys.argv[1])
