"""매체 인기 점수 — 매체 찾기 "인기순" 정렬, 카드 "인기" 뱃지, 어드민 매체 상세 표시가 같은 점수를 쓴다.

최근 WINDOW_DAYS(90일) 동안의 고객 행동을 사람 수로 센다(같은 사람이 여러 번 해도 1번).
사람 = 회원 ID, 비회원은 세션 ID.

    점수 = 제출한 기획안에 포함 × 5 + 기획안에 담기 × 3 + 관심 매체(하트) × 2 + 관리자 "인기 매체" 표시 5

- 제출: 기획안 상태가 제출 이후(집행 요청·맞춤제안·계약 완료)이고 그 기획안이 최근 90일 안에 바뀐 것.
- 담기: 최근 90일 안에 기획안에 담긴 것(지운 기획안은 빼고).
- 하트: 최근 90일 안에 관심 매체로 담은 것.
- 뱃지: 점수가 있는 매체 중 상위 BADGE_TOP_RATIO(10%, 전체 매체 수 기준) — 같은 점수는 함께 포함.
"""
from __future__ import annotations

import math
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import Text, case, cast, distinct, func, select
from sqlalchemy.orm import Session

from src.models.media_favorite import MediaFavorite
from src.models.media_master import Media
from src.models.proposal import Proposal
from src.models.proposal_item import ProposalItem

WINDOW_DAYS = 90
W_SUBMIT = 5
W_ADD = 3
W_FAVORITE = 2
ADMIN_BONUS = 5
BADGE_TOP_RATIO = 0.10
CACHE_SECONDS = 300

SUBMITTED_STATUSES = ("execution_requested", "custom", "contracted")


def _since() -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=WINDOW_DAYS)


def _owner():
    return func.coalesce(cast(Proposal.member_id, Text), cast(Proposal.session_id, Text))


def counts_subquery():
    """media_id 별 (제출 사람 수, 담기 사람 수, 하트 사람 수) — 정렬·계산 공용."""
    since = _since()
    submit = (
        select(ProposalItem.media_id.label("media_id"), func.count(distinct(_owner())).label("n"))
        .join(Proposal, Proposal.id == ProposalItem.proposal_id)
        .where(Proposal.status.in_(SUBMITTED_STATUSES), Proposal.updated_at >= since)
        .group_by(ProposalItem.media_id)
        .subquery()
    )
    add = (
        select(ProposalItem.media_id.label("media_id"), func.count(distinct(_owner())).label("n"))
        .join(Proposal, Proposal.id == ProposalItem.proposal_id)
        .where(Proposal.deleted_at.is_(None), ProposalItem.created_at >= since)
        .group_by(ProposalItem.media_id)
        .subquery()
    )
    fav = (
        select(MediaFavorite.media_id.label("media_id"), func.count(distinct(MediaFavorite.member_id)).label("n"))
        .where(MediaFavorite.created_at >= since)
        .group_by(MediaFavorite.media_id)
        .subquery()
    )
    return submit, add, fav


def score_expr(submit, add, fav):
    return (
        func.coalesce(submit.c.n, 0) * W_SUBMIT
        + func.coalesce(add.c.n, 0) * W_ADD
        + func.coalesce(fav.c.n, 0) * W_FAVORITE
        + case((Media.is_popular_yn.is_(True), ADMIN_BONUS), else_=0)
    )


def order_by_popularity(base, latest_col):
    """매체 쿼리를 인기 점수 높은 순 → 최신순으로."""
    submit, add, fav = counts_subquery()
    score = score_expr(submit, add, fav)
    return (
        base.outerjoin(submit, submit.c.media_id == Media.media_id)
        .outerjoin(add, add.c.media_id == Media.media_id)
        .outerjoin(fav, fav.c.media_id == Media.media_id)
        .order_by(score.desc(), latest_col.desc(), Media.media_id)
    )


@dataclass
class Snapshot:
    """전체 매체의 점수·내역·뱃지 — 잠깐(CACHE_SECONDS) 재사용한다."""

    detail: dict[str, dict]  # media_id → {submit, add, favorite, admin, score}
    badge_ids: frozenset[str]
    total_media: int
    at: float


_cache: Snapshot | None = None
_lock = threading.Lock()


def _compute(db: Session) -> Snapshot:
    submit, add, fav = counts_subquery()
    rows = db.execute(
        select(
            Media.media_id,
            func.coalesce(submit.c.n, 0),
            func.coalesce(add.c.n, 0),
            func.coalesce(fav.c.n, 0),
            Media.is_popular_yn,
        )
        .select_from(Media)
        .outerjoin(submit, submit.c.media_id == Media.media_id)
        .outerjoin(add, add.c.media_id == Media.media_id)
        .outerjoin(fav, fav.c.media_id == Media.media_id)
    ).all()
    detail: dict[str, dict] = {}
    for mid, n_submit, n_add, n_fav, flagged in rows:
        admin = ADMIN_BONUS if flagged else 0
        score = n_submit * W_SUBMIT + n_add * W_ADD + n_fav * W_FAVORITE + admin
        detail[mid] = dict(submit=n_submit, add=n_add, favorite=n_fav, admin=admin, score=score)
    scored = sorted((d["score"] for d in detail.values() if d["score"] > 0), reverse=True)
    top_n = math.ceil(len(detail) * BADGE_TOP_RATIO)
    badge_ids: frozenset[str] = frozenset()
    if scored and top_n > 0:
        cutoff = scored[min(top_n, len(scored)) - 1]
        badge_ids = frozenset(mid for mid, d in detail.items() if d["score"] > 0 and d["score"] >= cutoff)
    return Snapshot(detail=detail, badge_ids=badge_ids, total_media=len(detail), at=time.monotonic())


def snapshot(db: Session, *, fresh: bool = False) -> Snapshot:
    global _cache
    with _lock:
        if fresh or _cache is None or time.monotonic() - _cache.at > CACHE_SECONDS:
            _cache = _compute(db)
        return _cache


def is_badge(db: Session | None, media_id: str) -> bool:
    if db is None:
        return False
    return media_id in snapshot(db).badge_ids


def admin_summary(db: Session, media_id: str) -> dict:
    """어드민 매체 상세의 "인기 점수" 칸 — 총점·항목별 점수·순위·뱃지 여부(방금 계산한 값)."""
    snap = snapshot(db, fresh=True)
    d = snap.detail.get(media_id) or dict(submit=0, add=0, favorite=0, admin=0, score=0)
    rank = sum(1 for x in snap.detail.values() if x["score"] > d["score"]) + 1
    top_pct = math.ceil(rank / snap.total_media * 100) if snap.total_media else 100
    breakdown = [
        dict(key="submit", label="제출", people=d["submit"], weight=W_SUBMIT, points=d["submit"] * W_SUBMIT),
        dict(key="add", label="기획안 담기", people=d["add"], weight=W_ADD, points=d["add"] * W_ADD),
        dict(key="favorite", label="관심 매체", people=d["favorite"], weight=W_FAVORITE, points=d["favorite"] * W_FAVORITE),
        dict(key="admin", label="인기 매체 표시", people=None, weight=ADMIN_BONUS, points=d["admin"]),
    ]
    return dict(
        score=d["score"],
        rank=rank if d["score"] > 0 else None,
        total=snap.total_media,
        top_pct=top_pct if d["score"] > 0 else None,
        badge=media_id in snap.badge_ids,
        breakdown=breakdown,
    )
