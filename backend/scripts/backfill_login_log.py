"""지난 로그인 기록 채우기(100, 2026-11-26 사용자: "이전 로그인 기록 못 적어?").

    zcat -f /var/log/nginx/access.log* | docker exec -i ooh-backend python -m scripts.backfill_login_log [--apply]

로그인 기록(user_login_log)은 배포한 뒤부터 쌓인다. 그 전 로그인은 두 곳에 흔적이 있다.
- refresh_tokens: 토큰을 줄 때마다(로그인 · 가입 · 소셜 · 계정 전환 · 토큰 바꾸기) 한 줄 — 지우지 않아 처음부터 다 있다. 시각만 있다.
- nginx 접속 기록(EC2 /var/log/nginx, 14일 치): 어느 주소로 왔는지(로그인 · 가입 · 토큰 바꾸기 …) · IP · 브라우저.
둘을 시각으로 맞춰(토큰 시각 1초 전 ~ 3초 뒤의 성공한 요청) 방법 · IP · 브라우저를 채운다.
토큰 바꾸기는 지금 규칙과 같게 — 바로 앞 토큰이 끝나고(1시간) 30분 넘게 쉬었다가 바꾼 것만 "자동 로그인"으로 남긴다.

남기지 않는 것(미리 보기에 개수를 보여 준다):
- 접속 기록이 없는 때(14일보다 오래된 토큰) — 방법 · IP 를 알 수 없다.
- 시각이 맞는 요청을 못 찾은 토큰.
- 이미 쌓이기 시작한 뒤(로그인 기록 첫 줄 이후)의 토큰과, 같은 회원 · 같은 시각 줄이 이미 있는 것 — 두 번 돌려도 겹치지 않는다.
--apply 없이 돌리면 무엇을 넣을지만 보여 준다 — 읽기 전용 트랜잭션이라 DB 에 아무것도 쓰지 않는다.
"""
from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Iterable

# nginx 기본(combined) 형식: IP - - [26/Nov/2026:01:47:08 +0000] "POST /auth/refresh HTTP/1.1" 200 509 "referer" "UA"
_LINE = re.compile(
    r'^(?P<ip>\S+) \S+ \S+ \[(?P<time>[^\]]+)\] "(?P<verb>[A-Z]+) (?P<path>\S+)[^"]*" (?P<status>\d{3}) \S+ "[^"]*" "(?P<ua>[^"]*)"'
)
_TIME = re.compile(r"^\S+ \S+ \S+ \[(?P<time>[^\]]+)\]")
_SNS = re.compile(r"^/auth/sns/(?P<provider>[a-z]+)/callback(?:\?|$)")
_POST_KIND = {
    "/auth/login": "password",
    "/auth/register": "signup",
    "/auth/refresh": "refresh",
    "/auth/switch-account": "switch",
}

ACCESS = timedelta(hours=1)  # 접근 토큰 수명(settings.jwt_access_expires 와 같게)
IDLE = timedelta(minutes=30)  # auth_service.AUTO_LOGIN_IDLE
BEFORE, AFTER = timedelta(seconds=1), timedelta(seconds=3)  # 토큰 시각 기준 요청 시각 범위


@dataclass
class Hit:
    at: datetime
    kind: str  # password · signup · refresh · switch · kakao · naver
    ip: str
    ua: str


@dataclass
class Token:
    user_id: object
    created_at: datetime
    lifetime: timedelta  # 7일(로그인 유지 안 함) · 30일(로그인 유지) — 토큰을 바꿔도 그대로


def _parse_time(raw: str) -> datetime:
    return datetime.strptime(raw, "%d/%b/%Y:%H:%M:%S %z")


def parse(lines: Iterable[str]) -> tuple[list[Hit], datetime | None]:
    """접속 기록 줄 → 성공한 로그인 · 토큰 요청들과 기록이 시작된 시각(가장 이른 줄)."""
    hits: list[Hit] = []
    start: datetime | None = None
    for line in lines:
        t = _TIME.match(line)
        if not t:
            continue
        try:
            at = _parse_time(t.group("time"))
        except ValueError:
            continue
        start = at if start is None or at < start else start
        m = _LINE.match(line)
        if not m or m.group("status") not in ("200", "201"):
            continue
        verb, path = m.group("verb"), m.group("path")
        kind = _POST_KIND.get(path) if verb == "POST" else None
        if verb == "GET" and (sns := _SNS.match(path)):
            kind = sns.group("provider")
        if kind:
            hits.append(Hit(at=at, kind=kind, ip=m.group("ip"), ua=m.group("ua")))
    hits.sort(key=lambda h: h.at)
    return hits, start


def plan(
    tokens: list[Token],
    hits: list[Hit],
    log_start: datetime | None,
    cutoff: datetime | None,
    existing: set[tuple[str, datetime]],
) -> tuple[list[dict], dict[str, int]]:
    """넣을 줄(user_id · method · ip · user_agent · created_at)과 빠진 이유별 개수."""
    tokens = sorted(tokens, key=lambda t: t.created_at)
    used: set[int] = set()
    rows: list[dict] = []
    skipped = {"접속 기록 전": 0, "요청 못 찾음": 0, "쓰는 중 토큰 바꾸기": 0, "이미 있음": 0}
    by_user: dict[str, list[Token]] = {}
    for tok in tokens:
        earlier = by_user.setdefault(str(tok.user_id), [])
        # 바꾸기 전 토큰 — 같은 회원 · 같은 수명(만료 시각과 만든 시각이 몇 ms 달라 1분 안이면 같다) · 1시간 넘게 앞선 것 중 마지막.
        prev = next(
            (
                p
                for p in reversed(earlier)
                if abs(p.lifetime - tok.lifetime) < timedelta(minutes=1)
                and p.created_at <= tok.created_at - ACCESS + AFTER
            ),
            None,
        )
        earlier.append(tok)
        if cutoff is not None and tok.created_at >= cutoff:
            continue  # 새 코드가 이미 남기고 있는 때
        if log_start is None or tok.created_at < log_start:
            skipped["접속 기록 전"] += 1
            continue
        lo, hi = tok.created_at - BEFORE, tok.created_at + AFTER
        cands = [i for i, h in enumerate(hits) if i not in used and lo <= h.at <= hi]
        if not cands:
            skipped["요청 못 찾음"] += 1
            continue
        i = min(cands, key=lambda k: abs(hits[k].at - tok.created_at))
        used.add(i)
        hit = hits[i]
        method = hit.kind
        if method == "refresh":
            idle = tok.created_at - prev.created_at - ACCESS if prev else None
            if idle is not None and idle <= IDLE:
                skipped["쓰는 중 토큰 바꾸기"] += 1
                continue
            method = "auto"
        if (str(tok.user_id), tok.created_at) in existing:
            skipped["이미 있음"] += 1
            continue
        rows.append(
            {
                "user_id": tok.user_id,
                "method": method,
                "ip": hit.ip[:64] or None,
                "user_agent": hit.ua[:400] or None,
                "created_at": tok.created_at,
            }
        )
    return rows, skipped


def main(apply: bool) -> int:
    from sqlalchemy import func, text

    from src.database import SessionLocal
    from src.models.user import RefreshToken, User
    from src.models.user_login_log import UserLoginLog

    hits, log_start = parse(sys.stdin)
    db = SessionLocal()
    try:
        if not apply:
            db.execute(text("SET TRANSACTION READ ONLY"))
        tokens = [
            Token(user_id=uid, created_at=c, lifetime=e - c)
            for uid, c, e in db.query(RefreshToken.user_id, RefreshToken.created_at, RefreshToken.expires_at)
        ]
        cutoff = db.query(func.min(UserLoginLog.created_at)).scalar()
        existing = {(str(u), c) for u, c in db.query(UserLoginLog.user_id, UserLoginLog.created_at)}
        rows, skipped = plan(tokens, hits, log_start, cutoff, existing)
        users = {
            str(u.id): u.partner_code or u.login_id
            for u in db.query(User).filter(User.id.in_({r["user_id"] for r in rows})).all()
        } if rows else {}
        print(f"접속 기록 시작 {log_start} · 로그인 기록 첫 줄 {cutoff} · 토큰 {len(tokens)}개 · 로그인 요청 {len(hits)}개")
        counts: dict[str, int] = {}
        for r in rows:
            counts[r["method"]] = counts.get(r["method"], 0) + 1
        print("넣을 줄:", len(rows), counts)
        print("뺀 토큰:", skipped)
        per_user: dict[str, int] = {}
        for r in rows:
            key = users.get(str(r["user_id"]), str(r["user_id"]))
            per_user[key] = per_user.get(key, 0) + 1
        for key, n in sorted(per_user.items(), key=lambda kv: -kv[1]):
            print(f"  {key}: {n}")
        if apply:
            db.add_all(UserLoginLog(**r) for r in rows)
            db.commit()
            print("저장했어요.")
        else:
            db.rollback()
            print("(저장 안 함, --apply 로 저장)")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main("--apply" in sys.argv[1:]))
