"""제안 관리 비즈니스 로직 — admin/proposals 목록."""
from __future__ import annotations

from sqlalchemy.orm import Session, joinedload

from src.models.proposal import Proposal

_STATUS = {
    "cancelled": "취소",
    "new": "신규",
    "custom": "맞춤제안",
    "execution_requested": "집행 요청",
    "contracted": "계약 완료",
}


def _fmt_date(dt) -> str:
    return dt.date().isoformat() if dt is not None else "-"


def list_proposals(db: Session) -> list[dict]:
    rows = (
        db.query(Proposal)
        .options(joinedload(Proposal.member))
        .order_by(Proposal.created_at.desc())
        .all()
    )
    return [
        dict(
            id=str(p.id),
            name=p.title,
            member=(p.member.name if p.member and p.member.name else "-"),
            mediaCount=str(p.media_count),
            totalAmount=f"{p.total_amount:,}원",
            status=_STATUS.get(p.status, p.status),
            registeredAt=_fmt_date(p.created_at),
        )
        for p in rows
    ]
