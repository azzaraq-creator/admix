"""세션/메시지 CRUD. 사용자 식별 없음 (인증 미사용 prototype)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

from src.models.ad_session import AdMessage, AdSession, MessageRole
from src.services.graph.checkpoint_cleanup import delete_checkpoints_for_thread

TITLE_FROM_FIRST_USER_LEN = 40


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_thread_id() -> str:
    return f"thread-{uuid.uuid4().hex[:16]}"


def create_session(db: Session, title: Optional[str] = None) -> AdSession:
    s = AdSession(title=title or "새 추천", thread_id=_new_thread_id())
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def list_sessions(db: Session, limit: int = 50) -> List[AdSession]:
    return (
        db.query(AdSession)
        .order_by(AdSession.updated_at.desc())
        .limit(limit)
        .all()
    )


def get_session(db: Session, session_id: str) -> Optional[AdSession]:
    return db.query(AdSession).filter(AdSession.id == session_id).first()


def update_title(db: Session, session_id: str, title: str) -> Optional[AdSession]:
    s = get_session(db, session_id)
    if not s:
        return None
    s.title = title
    db.commit()
    db.refresh(s)
    return s


def delete_session(db: Session, session_id: str) -> bool:
    s = get_session(db, session_id)
    if not s:
        return False
    delete_checkpoints_for_thread(db, s.thread_id)
    db.delete(s)
    db.commit()
    return True


def add_message(
    db: Session,
    session_id: str,
    role: MessageRole,
    content: str,
    payload: Optional[dict] = None,
) -> AdMessage:
    """메시지 추가 + 첫 user 메시지로 title 자동 설정 + session.updated_at 갱신."""
    s = db.query(AdSession).filter(AdSession.id == session_id).first()
    if not s:
        raise ValueError(f"Session not found: {session_id}")

    if role == MessageRole.user and s.title == "새 추천":
        s.title = content.strip()[:TITLE_FROM_FIRST_USER_LEN] or s.title

    msg = AdMessage(session_id=session_id, role=role, content=content, payload=payload)
    db.add(msg)
    # SQLAlchemy onupdate 는 부모 컬럼 변경이 있어야 발화. 메시지 추가만으로는 안 됨.
    s.updated_at = _utcnow()
    db.commit()
    db.refresh(msg)
    return msg
