"""협업 확정 매장 값 → 영업 기록 한 번 맞추기(2026-11-25 사용자: "수정 요청을 반영하면 영업 기록도 같이").

    python -m scripts.sync_collab_leads_from_stores [--apply]

그전에는 확정할 때 한 번만 복사해서, 그 뒤 매장에서 고친 값(수정 요청 반영 · 어드민 매장 수정)이 영업 기록엔 없다.
협업 확정한 영업 기록마다 업체명 · 주소 · 위치 · 매장 정보를 지금 매장 값으로 다시 적는다(collab_lead_service.follow_store).
바뀐 기록만 지도 줄을 다시 맞춘다 — 매장이 지도에 떠 있으면 매장 줄, 비공개면 영업 기록 줄(090). 매체 ID 는 옮기지 않는다.
--apply 없이 돌리면 무엇이 바뀌는지만 보여 준다 — 읽기 전용 트랜잭션이라 DB 에 아무것도 쓰지 않는다(운영에서 먼저 돌려 볼 것).
"""
from __future__ import annotations

import sys

from sqlalchemy import text

from src.database import SessionLocal
from src.models.collab_lead import CollabLead
from src.services import collab_lead_service as cl
from src.services import partners_service


def _diff(before: dict, after: dict) -> list[str]:
    labels = {"name": "업체명", "address": "주소", "custom": "지번주소", "location": "위치", "storeInfo": "매장 정보"}
    return [labels[k] for k in labels if before[k] != after[k]]


def _view(lead: CollabLead) -> dict:
    return {
        "name": lead.name,
        "address": lead.address,
        "custom": {k: (lead.custom or {}).get(k) for k in (cl.LOT_ADDRESS_KEY, cl.LOT_DETAIL_KEY)},
        "location": (lead.latitude, lead.longitude, lead.city, lead.district),
        "storeInfo": dict(lead.store_info or {}),
    }


def main(apply: bool) -> int:
    db = SessionLocal()
    changed = 0
    try:
        if not apply:
            db.execute(text("SET TRANSACTION READ ONLY"))
        # 매장은 selectin 으로 같이 읽힌다. 미리 보기는 고친 값을 내보내지 않게(autoflush 없이) 비교만 한다.
        leads = db.query(CollabLead).filter(CollabLead.store_id.isnot(None)).order_by(CollabLead.sort_order).all()
        with db.no_autoflush:
            for lead in leads:
                store = lead.store
                if store is None:
                    continue
                before = _view(lead)
                if not cl.follow_store(lead, store):
                    continue
                changed += 1
                what = " · ".join(_diff(before, _view(lead)))
                print(f"  {store.store_code} {lead.name} — {what}")
                if before["name"] != lead.name:
                    print(f"      업체명 {before['name']!r} → {lead.name!r}")
                if before["address"] != lead.address:
                    print(f"      주소 {before['address']!r} → {lead.address!r}")
                if apply:
                    db.flush()
                    partners_service.sync_media(db, store)
        if apply:
            db.commit()
        else:
            db.rollback()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    print(f"협업 확정 영업 기록 {len(leads)}곳 — 매장 값과 달라 맞춘 기록 {changed}곳{'' if apply else ' (저장 안 함, --apply 로 저장)'}")
    return 0


if __name__ == "__main__":
    sys.exit(main("--apply" in sys.argv[1:]))
