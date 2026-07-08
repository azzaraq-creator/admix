"""SMTP 이메일 발송 유틸 (STARTTLS).

Gmail 앱 비밀번호 등 SMTP 자격증명은 config(.env)에서 읽는다.
SMTP 미설정 시 발송을 건너뛰고 False 반환(요청은 실패시키지 않음).
"""
from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from src.config import get_settings

logger = logging.getLogger(__name__)


def send_email(
    to: str, subject: str, text_body: str, html_body: str | None = None
) -> bool:
    s = get_settings()
    if not s.smtp_host or not s.smtp_user:
        logger.warning("SMTP 미설정 — 이메일 발송 생략 (to=%s, subject=%s)", to, subject)
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = s.smtp_from or s.smtp_user
    msg["To"] = to
    msg.set_content(text_body)
    if html_body:
        msg.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=10) as server:
            server.starttls()
            server.login(s.smtp_user, s.smtp_password)
            server.send_message(msg)
        return True
    except Exception:
        logger.exception("이메일 발송 실패 (to=%s)", to)
        return False
