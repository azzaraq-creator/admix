"""영업 기록 위치 넣기(090) — 화면(카카오 지도)이 찾은 위치를 영업 기록에 넣고 광고주 지도 줄을 만든다.

    python -m scripts.apply_collab_lead_locations <locations.json> [--dry-run]

서버 카카오 주소 검색은 키가 없거나 층 · 호수가 섞인 주소를 못 읽어서, 위치는 브라우저의 카카오 지도로 찾는다.
locations.json — [{sourceId, address, location: {latitude, longitude, city, district}}] (원본 id 로 맞춘다 — 로컬 · 운영 id 가 달라서).
지금 영업 기록 주소(없으면 지번주소)가 파일의 address 와 다르면 건너뛴다(그사이 주소를 고친 기록은 화면에서 저장하면 새로 찾는다).
이미 위치가 있는 기록도 건너뛴다. 끝나면 모든 영업 기록 지도 줄을 다시 맞춘다(협업 확정 매장이 지도에 떠 있으면 매장이 그 자리).
"""
from __future__ import annotations

import json
import sys

from src.database import SessionLocal
from src.models.collab_lead import CollabLead
from src.services import collab_lead_service as cl


def main(path: str, dry_run: bool) -> int:
    with open(path, encoding="utf-8") as f:
        items = json.load(f)
    by_source = {str(it.get("sourceId") or ""): it for it in items if it.get("sourceId")}
    db = SessionLocal()
    applied = skipped_moved = skipped_has = missing = 0
    try:
        leads = db.query(CollabLead).order_by(CollabLead.sort_order).all()
        for lead in leads:
            it = by_source.get(lead.source_id or "")
            if it is None:
                missing += 1
                continue
            if lead.latitude is not None and lead.longitude is not None:
                skipped_has += 1
                continue
            if cl._store_address_of(lead)[0] != (it.get("address") or ""):
                skipped_moved += 1
                print(f"  주소가 달라 건너뜀: {lead.name} — 지금 {cl._store_address_of(lead)[0]!r} / 파일 {it.get('address')!r}")
                continue
            loc = cl._location_of(it.get("location"))
            if not loc:
                missing += 1
                continue
            cl._set_location(lead, loc)
            applied += 1
        db.flush()
        for lead in leads:
            cl.sync_lead_media(db, lead)
        on_map = sum(1 for lead in leads if lead.media_id)
        if dry_run:
            db.rollback()
        else:
            db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    print(
        f"영업 기록 {len(leads)}곳 — 위치 넣음 {applied} · 이미 있음 {skipped_has} · 주소 바뀜 {skipped_moved} · 파일에 없음 {missing}"
        f" → 지도에 영업 기록으로 {on_map}곳{' (dry-run, 저장 안 함)' if dry_run else ''}"
    )
    return 0


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(args[0], "--dry-run" in sys.argv))
