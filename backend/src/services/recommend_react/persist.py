"""ad_messages 저장 헬퍼(독립) — recommend_v2._persist_message 포팅."""
from __future__ import annotations

import uuid as uuid_lib
from typing import Optional


def persist_message(session_id: Optional[str], role, content: str, payload: Optional[dict]) -> None:
    if not session_id:
        return
    try:
        from src.database import SessionLocal
        from src.models.ad_session import AdSession
        from src.services import ad_session_service as svc

        try:
            sid = uuid_lib.UUID(session_id)
        except (ValueError, AttributeError):
            return
        with SessionLocal() as db:
            session = db.query(AdSession).filter(AdSession.id == sid).first()
            if session is None:
                session = AdSession(id=sid, thread_id=str(sid))
                db.add(session)
                db.flush()
            svc.add_message(db, str(sid), role, content, payload)
    except Exception as exc:  # noqa: BLE001
        print(f"[recommend_react] message save failed: {exc}", flush=True)
