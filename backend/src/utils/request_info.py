"""요청한 곳 정보 — 로그인 기록(100)에 남길 IP · 브라우저."""
from __future__ import annotations

from fastapi import Request


def client_ip(request: Request) -> str | None:
    """요청한 곳 IP — 운영은 nginx 뒤라 X-Forwarded-For 첫 값, 없으면 바로 붙은 곳."""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64] or None
    return request.client.host if request.client else None


def user_agent(request: Request) -> str | None:
    return (request.headers.get("user-agent") or "")[:400] or None
