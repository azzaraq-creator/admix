"""세션/메시지 CRUD. 사용자 식별 없음 (인증 미사용 prototype)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.models.ad_session import AdMessage, AdSession, MessageRole
from src.services.graph.checkpoint_cleanup import delete_checkpoints_for_thread

TITLE_FROM_FIRST_USER_LEN = 40


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_thread_id() -> str:
    return f"thread-{uuid.uuid4().hex[:16]}"


def create_session(
    db: Session,
    title: Optional[str] = None,
    user_id: Optional[uuid.UUID] = None,
) -> AdSession:
    s = AdSession(title=title or "새 추천", thread_id=_new_thread_id(), user_id=user_id)
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


def _message_counts(db: Session) -> dict:
    """session_id → 메시지 수 매핑."""
    return dict(
        db.query(AdMessage.session_id, func.count(AdMessage.id))
        .group_by(AdMessage.session_id)
        .all()
    )


def export_chat_xlsx(db: Session) -> bytes:
    """전체 채팅 대화 내역을 xlsx 로 export — 턴(사용자 질문+챗봇 답변)별 1행."""
    from io import BytesIO

    from openpyxl import Workbook
    from sqlalchemy.orm import selectinload

    from src.models.user import User

    sessions = (
        db.query(AdSession)
        .options(selectinload(AdSession.messages))
        .order_by(AdSession.created_at)
        .all()
    )
    uids = {s.user_id for s in sessions if s.user_id}
    users = (
        {u.id: u for u in db.query(User).filter(User.id.in_(uids)).all()}
        if uids
        else {}
    )

    def _fmt(dt) -> str:
        return dt.strftime("%Y-%m-%d %H:%M") if dt is not None else ""

    wb = Workbook()
    ws = wb.active
    ws.title = "대화내역"
    ws.append(
        [
            "사용자ID",
            "사용자명",
            "세션ID",
            "세션제목",
            "turn",
            "사용자 질문",
            "챗봇 답변",
            "시각",
            "비고",
        ]
    )
    for s in sessions:
        u = users.get(s.user_id) if s.user_id else None
        uid = u.login_id if u else ""
        uname = (u.name or "") if u else "비회원"
        sid = str(s.id)
        stitle = s.title or ""
        turn = 0
        pending: Optional[tuple[str, str]] = None  # (질문, 시각)
        for m in s.messages:
            if m.role == MessageRole.user:
                if pending is not None:
                    turn += 1
                    ws.append(
                        [uid, uname, sid, stitle, turn, pending[0], "", pending[1], ""]
                    )
                pending = (m.content, _fmt(m.created_at))
            else:
                turn += 1
                q = pending[0] if pending else ""
                t = pending[1] if pending else _fmt(m.created_at)
                ws.append([uid, uname, sid, stitle, turn, q, m.content, t, ""])
                pending = None
        if pending is not None:
            turn += 1
            ws.append([uid, uname, sid, stitle, turn, pending[0], "", pending[1], ""])

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def list_chat_overview(db: Session) -> list[dict]:
    """admin 챗로그 개요 — 회원은 이름/이메일별 집계 1행, 비회원은 세션별 1행.

    행 형태:
      {kind: "member"|"guest", key, name, email, membership, room_count, message_count, last_used_at}
      - member: key = user_id (상세에서 세션 목록)
      - guest:  key = session_id (상세에서 단일 세션 메시지)
    """
    from src.models.user import User

    counts = _message_counts(db)
    sessions = db.query(AdSession).order_by(AdSession.updated_at.desc()).all()
    user_ids = {s.user_id for s in sessions if s.user_id}
    users = (
        {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()}
        if user_ids
        else {}
    )

    members: dict = {}
    guests: list[dict] = []
    for s in sessions:
        mc = counts.get(s.id, 0)
        u = users.get(s.user_id) if s.user_id else None
        if u is not None:
            agg = members.get(u.id)
            if agg is None:
                members[u.id] = dict(
                    kind="member",
                    key=str(u.id),
                    name=u.name or "-",
                    email=u.email,
                    membership=u.membership_type,
                    room_count=1,
                    message_count=mc,
                    last_used_at=s.updated_at,
                )
            else:
                agg["room_count"] += 1
                agg["message_count"] += mc
                if s.updated_at > agg["last_used_at"]:
                    agg["last_used_at"] = s.updated_at
        else:
            guests.append(
                dict(
                    kind="guest",
                    key=str(s.id),
                    name="비회원",
                    email="-",
                    membership=None,
                    room_count=1,
                    message_count=mc,
                    last_used_at=s.updated_at,
                )
            )
    rows = list(members.values()) + guests
    rows.sort(key=lambda r: r["last_used_at"], reverse=True)
    return rows


def get_user_chat_detail(db: Session, user_id: str) -> Optional[dict]:
    """회원 1명의 챗 상세 — 회원정보 + 세션 목록(메시지 수 포함)."""
    from src.models.user import User

    try:
        uid = uuid.UUID(user_id)
    except (ValueError, AttributeError):
        return None
    u = db.query(User).filter(User.id == uid).first()
    if u is None:
        return None
    counts = _message_counts(db)
    sessions = (
        db.query(AdSession)
        .filter(AdSession.user_id == uid)
        .order_by(AdSession.updated_at.desc())
        .all()
    )
    return dict(
        user_id=str(u.id),
        name=u.name or "-",
        email=u.email,
        membership=u.membership_type,
        sessions=[
            dict(
                id=str(s.id),
                title=s.title,
                message_count=counts.get(s.id, 0),
                created_at=s.created_at,
                updated_at=s.updated_at,
            )
            for s in sessions
        ],
    )


def count_user_chats(db: Session, user_id: uuid.UUID) -> int:
    """사용자의 전체 세션에 걸친 와리가리 챗 횟수 = user 역할 메시지 수.

    새 세션을 시작해도 과거 세션 메시지가 그대로 남아 누적 집계된다.
    """
    return (
        db.query(func.count(AdMessage.id))
        .join(AdSession, AdMessage.session_id == AdSession.id)
        .filter(AdSession.user_id == user_id, AdMessage.role == MessageRole.user)
        .scalar()
        or 0
    )


def count_session_chats(db: Session, session_id: str) -> int:
    """단일 세션(session_id)의 user 역할 메시지 수 = 비회원 게스트 대화 횟수.

    회원과 달리 게스트는 user_id 가 없어 세션 단위로만 누적 집계한다.
    """
    try:
        sid = uuid.UUID(str(session_id))
    except (ValueError, AttributeError):
        return 0
    return (
        db.query(func.count(AdMessage.id))
        .filter(AdMessage.session_id == sid, AdMessage.role == MessageRole.user)
        .scalar()
        or 0
    )


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
