"""회원 로그인 기록(100, 2026-11-26 사용자: "회원을 선택하면 로그인 로그를 확인할 수 있게").
로그인 · 가입 · 소셜 · 계정 전환은 한 줄씩. 자동 로그인은 오래 쉬었다가 다시 들어올 때만 — 쓰는 동안 바꾸는 토큰은 남기지 않는다."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.models.user import RefreshToken, User
from src.models.user_login_log import UserLoginLog
from src.services import auth_service
from src.services import partners_service as ps
from src.services.login_log_service import device_label
from src.utils.security import hash_token

from tests.test_collab_flow import db, partner  # noqa: F401 — 같은 회원 fixture

MAC_CHROME = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)
IPHONE_SAFARI = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "Version/18.1 Mobile/15E148 Safari/604.1"
)


def _logs(db: Session, user: User) -> list[UserLoginLog]:
    db.expire_all()
    return (
        db.query(UserLoginLog)
        .filter(UserLoginLog.user_id == user.id)
        .order_by(UserLoginLog.created_at)
        .all()
    )


def _age_refresh_token(db: Session, refresh: str, by: timedelta) -> None:
    row = db.query(RefreshToken).filter(RefreshToken.token == hash_token(refresh)).one()
    row.created_at = datetime.now(timezone.utc) - by
    db.commit()


def test_login_writes_one_row(db: Session, partner):  # noqa: F811
    auth_service.issue_tokens(db, partner, method="password", ip="1.2.3.4", user_agent=MAC_CHROME)
    auth_service.issue_tokens(db, partner)  # 방법 없이 준 토큰은 남기지 않는다
    logs = _logs(db, partner)
    assert [(r.method, r.ip) for r in logs] == [("password", "1.2.3.4")]


def test_refresh_while_using_is_not_logged(db: Session, partner):  # noqa: F811
    _, refresh = auth_service.issue_tokens(db, partner, method="password", user_agent=MAC_CHROME)
    _age_refresh_token(db, refresh, timedelta(hours=1, minutes=5))  # 1시간 토큰이 막 끝나 바꿈 = 쓰는 중
    auth_service.rotate_refresh_token(db, refresh, ip="1.2.3.4", user_agent=MAC_CHROME)
    assert [r.method for r in _logs(db, partner)] == ["password"]


def test_refresh_after_long_break_is_auto_login(db: Session, partner):  # noqa: F811
    _, refresh = auth_service.issue_tokens(db, partner, method="password", user_agent=MAC_CHROME)
    _age_refresh_token(db, refresh, timedelta(days=2))  # 이틀 쉬었다가 다시 들어옴
    _, refresh2 = auth_service.rotate_refresh_token(db, refresh, ip="5.6.7.8", user_agent=IPHONE_SAFARI)
    _age_refresh_token(db, refresh2, timedelta(minutes=70))  # 그 뒤 쓰는 동안 바꾼 건 그대로
    auth_service.rotate_refresh_token(db, refresh2, ip="5.6.7.8", user_agent=IPHONE_SAFARI)
    logs = _logs(db, partner)
    assert [(r.method, r.ip) for r in logs] == [("password", None), ("auto", "5.6.7.8")]


def test_admin_reads_newest_first_with_device(db: Session, partner):  # noqa: F811
    auth_service.issue_tokens(db, partner, method="kakao", user_agent=IPHONE_SAFARI)
    auth_service.issue_tokens(db, partner, method="password", ip="1.2.3.4", user_agent=MAC_CHROME)
    got = ps.admin_member_logins(db, str(partner.id))
    assert got["total"] == 2
    assert [(i["method"], i["device"], i["ip"]) for i in got["items"]] == [
        ("password", "Mac · Chrome", "1.2.3.4"),
        ("kakao", "iPhone · Safari", None),
    ]
    # 쪽 넘기기 — 1줄씩이면 2쪽은 더 오래된 줄, 전체 개수는 그대로
    second = ps.admin_member_logins(db, str(partner.id), page=2, size=1)
    assert second["total"] == 2 and [i["method"] for i in second["items"]] == ["kakao"]


def test_admin_logins_only_for_partner(db: Session, partner):  # noqa: F811
    partner.member_category = "advertiser"
    db.commit()
    with pytest.raises(HTTPException) as e:
        ps.admin_member_logins(db, str(partner.id))
    assert e.value.status_code == 404


@pytest.mark.parametrize(
    ("ua", "label"),
    [
        (MAC_CHROME, "Mac · Chrome"),
        (IPHONE_SAFARI, "iPhone · Safari"),
        (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
            "Windows · Edge",
        ),
        (
            "Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) "
            "SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
            "Android · 삼성 인터넷",
        ),
        (
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) "
            "Mobile/15E148 KAKAOTALK 10.9.0",
            "iPhone · 카카오톡",
        ),
        ("python-requests/2.32", "python-requests/2.32"),
        (None, None),
    ],
)
def test_device_label(ua, label):
    assert device_label(ua) == label


# ── 지난 기록 채우기(scripts/backfill_login_log, 11-26 사용자: "이전 로그인 기록 못 적어?") ──


def _nginx(at: str, request: str, status: int = 200, ip: str = "1.2.3.4", ua: str = MAC_CHROME) -> str:
    return f'{ip} - - [{at} +0000] "{request} HTTP/1.1" {status} 509 "https://www.admix.co.kr/" "{ua}"'


def test_backfill_matches_tokens_to_requests():
    from scripts.backfill_login_log import Token, parse, plan

    utc = timezone.utc
    week = timedelta(days=7)
    lines = [
        _nginx("12/Nov/2026:00:00:00", "GET /"),  # 접속 기록 시작
        _nginx("20/Nov/2026:10:00:01", "POST /auth/login"),
        _nginx("20/Nov/2026:11:05:00", "POST /auth/refresh"),  # 쓰는 중 바꾸기
        _nginx("21/Nov/2026:09:00:00", "POST /auth/refresh", ip="5.6.7.8", ua=IPHONE_SAFARI),  # 다음 날 다시
        _nginx("21/Nov/2026:09:30:00", "POST /auth/login", status=401),  # 실패는 빼고
        _nginx("22/Nov/2026:08:00:00", "GET /auth/sns/kakao/callback?code=x&state=y"),
        _nginx("23/Nov/2026:08:00:01", "POST /auth/register", status=201),  # 가입 — 넣지 않는다
        _nginx("23/Nov/2026:09:00:01", "POST /auth/switch-account"),  # 계정 전환 — 넣지 않는다
    ]
    hits, start = parse(lines)
    assert start == datetime(2026, 11, 12, tzinfo=utc)
    assert [h.kind for h in hits] == ["password", "refresh", "refresh", "kakao", "signup", "switch"]

    u = "user-1"
    at = lambda *a: datetime(2026, 11, *a, tzinfo=utc)  # noqa: E731
    tokens = [
        Token(u, at(1, 9, 0, 0), week),  # 접속 기록 전 — 뺀다
        Token(u, at(20, 10, 0, 0, 600_000), week),
        Token(u, at(20, 11, 4, 59, 900_000), week - timedelta(microseconds=300)),
        Token(u, at(21, 8, 59, 59, 800_000), week),
        Token(u, at(22, 7, 59, 59, 500_000), week),
        Token(u, at(22, 12, 0, 0), week),  # 요청을 못 찾음
        Token("user-2", at(23, 8, 0, 0, 700_000), timedelta(days=30)),
        Token(u, at(23, 9, 0, 0, 900_000), week),
    ]
    rows, skipped = plan(tokens, hits, start, None, set())
    assert [(r["method"], r["ip"]) for r in rows] == [
        ("password", "1.2.3.4"),
        ("auto", "5.6.7.8"),
        ("kakao", "1.2.3.4"),
    ]
    assert rows[1]["user_agent"] == IPHONE_SAFARI
    assert skipped == {
        "접속 기록 전": 1,
        "요청 못 찾음": 1,
        "쓰는 중 토큰 바꾸기": 1,
        "가입 · 계정 전환": 2,
        "이미 있음": 0,
    }

    # 이미 쌓이기 시작한 뒤의 토큰 · 몇 초 안 같은 회원 줄은 다시 넣지 않는다
    rows2, skipped2 = plan(tokens, hits, start, at(22, 0, 0, 0), {(u, at(20, 10, 0, 2))})
    assert [r["method"] for r in rows2] == ["auto"]
    assert skipped2["이미 있음"] == 1
