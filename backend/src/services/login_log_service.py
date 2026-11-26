"""회원 로그인 기록(100) 읽기 — 어드민 회원 상세에서 본다.

브라우저 정보(User-Agent)는 "Mac · Chrome"처럼 짧게 바꿔서 보낸다. 모르는 값이면 앞부분 그대로.
"""
from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from src.models.user_login_log import UserLoginLog

# 앞에 있는 것부터 본다 — 앱 안 브라우저 · Edge · 삼성 인터넷은 Chrome / Safari 글자도 같이 들고 온다.
_BROWSERS = (
    ("KAKAOTALK", "카카오톡"),
    ("NAVER(", "네이버 앱"),
    ("Instagram", "인스타그램"),
    ("SamsungBrowser", "삼성 인터넷"),
    ("Whale", "웨일"),
    ("Edg", "Edge"),
    ("OPR/", "Opera"),
    ("Firefox", "Firefox"),
    ("FxiOS", "Firefox"),
    ("CriOS", "Chrome"),
    ("Chrome", "Chrome"),
    ("Safari", "Safari"),
)


def _os(ua: str) -> str | None:
    if "iPhone" in ua:
        return "iPhone"
    if "iPad" in ua:
        return "iPad"
    if "Android" in ua:
        return "Android"
    if "Windows" in ua:
        return "Windows"
    if "Macintosh" in ua or "Mac OS X" in ua:
        return "Mac"
    if "Linux" in ua:
        return "Linux"
    return None


def device_label(ua: str | None) -> str | None:
    """User-Agent → "iPhone · Safari" · "Windows · Chrome". 둘 다 모르면 앞 40자."""
    if not ua:
        return None
    browser = next((name for key, name in _BROWSERS if key in ua), None)
    parts = [p for p in (_os(ua), browser) if p]
    return " · ".join(parts) if parts else ua[:40]


def recent(db: Session, user_id: uuid.UUID, limit: int = 100) -> dict:
    """최근 로그인 기록(최근 것부터)과 전체 개수."""
    q = db.query(UserLoginLog).filter(UserLoginLog.user_id == user_id)
    rows = q.order_by(UserLoginLog.created_at.desc()).limit(limit).all()
    return {
        "total": q.count(),
        "items": [
            {
                "id": str(r.id),
                "at": r.created_at.isoformat(),
                "method": r.method,
                "ip": r.ip,
                "device": device_label(r.user_agent),
            }
            for r in rows
        ],
    }
