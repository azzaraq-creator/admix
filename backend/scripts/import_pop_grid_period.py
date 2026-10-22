"""유동인구 격자 지도 — 인계 월 파일(period/YYYYMM.js)을 DB에 한꺼번에 넣는다.

어드민 "유동인구 데이터"에서 한 달씩 올리는 것과 같은 저장(services/pop_grid.save_month)이다. 여러 달을 한 번에
넣을 때(처음 2025년 1~12월 등) 쓴다. 이미 있는 달은 파일에 든 자료로 바꾼다.

사용: python -m scripts.import_pop_grid_period <period 폴더 또는 파일...> [--from 202501] [--to 202512]
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

from src.database import SessionLocal
from src.services import pop_grid


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("paths", nargs="+")
    ap.add_argument("--from", dest="start", default="000000")
    ap.add_argument("--to", dest="end", default="999999")
    args = ap.parse_args()

    files: list[Path] = []
    for p in map(Path, args.paths):
        files += sorted(p.glob("[0-9][0-9][0-9][0-9][0-9][0-9].js")) if p.is_dir() else [p]
    files = [f for f in files if args.start <= re.sub(r"\D", "", f.stem)[:6] <= args.end]
    if not files:
        raise SystemExit("넣을 파일이 없어요")

    db = SessionLocal()
    try:
        for f in files:
            r = pop_grid.save_month(db, f.read_bytes(), "import_pop_grid_period", f.name)
            live = r["totals"].get("live")
            print(f"{r['ym']} {len(r['metrics'])}종 {r['rows']}줄 · 생활인구 서울 합 {live:,}명" if live else f"{r['ym']} {r['metrics']}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
