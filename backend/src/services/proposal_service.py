"""제안 관리 비즈니스 로직 — admin 목록 + 클라이언트 장바구니(플래닝) CRUD.

제안서는 회원(member_id) 또는 비회원 세션(session_id)이 소유한다. 챗·REST 양쪽에서 호출.
"""
from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy.orm import Session, joinedload

from src.models.media_master import Media
from src.models.proposal import Proposal
from src.models.proposal_item import ProposalItem
from src.models.user import User

_STATUS = {
    "cancelled": "취소",
    "new": "신규",
    "custom": "맞춤제안",
    "execution_requested": "집행 요청",
    "contracted": "계약 완료",
}

# 티어별 제안서(플래닝) 개수 제한. None = 무제한.
GUEST_LIMIT = 1
MEMBER_LIMIT = 5


class ProposalLimitError(Exception):
    """티어 제안서 개수 한도 초과."""

    def __init__(self, tier: str, limit: int):
        self.tier = tier
        self.limit = limit
        super().__init__(f"proposal limit reached: tier={tier} limit={limit}")


def _is_verified_member(user: Optional[User]) -> bool:
    if user is None:
        return False
    reg = user.business_registration
    return bool(reg and reg.status == "verified")


def proposal_tier(user: Optional[User]) -> str:
    if user is None:
        return "guest"
    return "verified" if _is_verified_member(user) else "member"


def proposal_limit(user: Optional[User]) -> Optional[int]:
    """현재 사용자 티어의 제안서 개수 제한. None = 무제한."""
    tier = proposal_tier(user)
    if tier == "guest":
        return GUEST_LIMIT
    if tier == "verified":
        return None
    return MEMBER_LIMIT


def _owner_count(
    db: Session, *, member_id: Optional[uuid.UUID], session_id: Optional[uuid.UUID]
) -> int:
    q = db.query(Proposal)
    if member_id is not None:
        q = q.filter(Proposal.member_id == member_id)
    else:
        q = q.filter(Proposal.session_id == session_id)
    return q.count()


def can_create_proposal(
    db: Session,
    *,
    member_id: Optional[uuid.UUID],
    session_id: Optional[uuid.UUID],
    user: Optional[User],
) -> bool:
    limit = proposal_limit(user)
    if limit is None:
        return True
    return _owner_count(db, member_id=member_id, session_id=session_id) < limit


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


# ===== 클라이언트 장바구니(플래닝) CRUD =====


def create_proposal(
    db: Session,
    title: str,
    *,
    member_id: Optional[uuid.UUID] = None,
    session_id: Optional[uuid.UUID] = None,
    user: Optional[User] = None,
    enforce_limit: bool = True,
) -> Proposal:
    """제안서 생성. enforce_limit 시 티어 한도 초과면 ProposalLimitError."""
    if enforce_limit and not can_create_proposal(
        db, member_id=member_id, session_id=session_id, user=user
    ):
        tier = proposal_tier(user)
        raise ProposalLimitError(tier, proposal_limit(user) or 0)
    p = Proposal(
        title=title.strip()[:300] or "새 제안서",
        member_id=member_id,
        session_id=session_id,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def list_for_owner(
    db: Session,
    *,
    member_id: Optional[uuid.UUID] = None,
    session_id: Optional[uuid.UUID] = None,
) -> list[Proposal]:
    q = db.query(Proposal).options(joinedload(Proposal.items))
    if member_id is not None:
        q = q.filter(Proposal.member_id == member_id)
    elif session_id is not None:
        q = q.filter(Proposal.session_id == session_id)
    else:
        return []
    return q.order_by(Proposal.updated_at.desc()).all()


def get_owned(
    db: Session,
    proposal_id: str,
    *,
    member_id: Optional[uuid.UUID] = None,
    session_id: Optional[uuid.UUID] = None,
) -> Optional[Proposal]:
    """소유권 확인 후 제안서 반환. 권한 없으면 None."""
    try:
        pid = uuid.UUID(str(proposal_id))
    except (ValueError, AttributeError):
        return None
    p = (
        db.query(Proposal)
        .options(joinedload(Proposal.items))
        .filter(Proposal.id == pid)
        .first()
    )
    if p is None:
        return None
    if member_id is not None and p.member_id == member_id:
        return p
    if session_id is not None and p.session_id == session_id:
        return p
    return None


def rename(db: Session, proposal: Proposal, title: str) -> Proposal:
    proposal.title = title.strip()[:300] or proposal.title
    db.commit()
    db.refresh(proposal)
    return proposal


def delete(db: Session, proposal: Proposal) -> None:
    db.delete(proposal)
    db.commit()


def _recount(proposal: Proposal) -> None:
    proposal.media_count = len(proposal.items)
    proposal.total_amount = sum(it.price or 0 for it in proposal.items)


def add_items(db: Session, proposal: Proposal, media_ids: list[str]) -> Proposal:
    """media_ids 를 매체 마스터에서 조회해 스냅샷으로 담는다. 중복은 무시."""
    existing = {it.media_id for it in proposal.items}
    wanted = [m for m in dict.fromkeys(media_ids) if m and m not in existing]
    if wanted:
        rows = {
            m.media_id: m
            for m in db.query(Media).filter(Media.media_id.in_(wanted)).all()
        }
        for mid in wanted:
            media = rows.get(mid)
            if media is None:
                continue
            proposal.items.append(
                ProposalItem(
                    media_id=mid,
                    name=media.name,
                    price=media.min_advertisement_fee_krw,
                    thumbnail_url=media.thumbnail_url,
                )
            )
        _recount(proposal)
        db.commit()
        db.refresh(proposal)
    return proposal


def remove_item(db: Session, proposal: Proposal, media_id: str) -> Proposal:
    proposal.items[:] = [it for it in proposal.items if it.media_id != media_id]
    _recount(proposal)
    db.commit()
    db.refresh(proposal)
    return proposal


def reorder_items(
    db: Session, proposal: Proposal, media_ids: list[str]
) -> Proposal:
    order = {media_id: index for index, media_id in enumerate(media_ids)}
    fallback = len(order)
    for item in proposal.items:
        item.position = order.get(item.media_id, fallback)
    db.commit()
    db.refresh(proposal)
    return proposal


def to_summary(p: Proposal) -> dict:
    return dict(
        id=str(p.id),
        title=p.title,
        status=p.status,
        media_count=p.media_count,
        total_amount=p.total_amount,
        updated_at=p.updated_at.isoformat() if p.updated_at else None,
        media_ids=[it.media_id for it in p.items],
    )


def to_detail(db: Session, p: Proposal) -> dict:
    media_ids = [it.media_id for it in p.items]
    media_map: dict = {}
    if media_ids:
        rows = (
            db.query(Media)
            .options(joinedload(Media.plans))
            .filter(Media.media_id.in_(media_ids))
            .all()
        )
        media_map = {m.media_id: m for m in rows}

    def _item(it) -> dict:
        m = media_map.get(it.media_id)
        # plan1 = plans[0] (plan_no 오름차순 정렬). 옵션 선택 기능은 추후.
        plan = m.plans[0] if m and m.plans else None
        return dict(
            media_id=it.media_id,
            name=plan.product_name if plan and plan.product_name else it.name,
            price=(
                plan.advertisement_fee
                if plan and plan.advertisement_fee is not None
                else it.price
            ),
            thumbnail_url=it.thumbnail_url,
            division=m.category_small if m else None,
            region=m.loc_label if m else None,
            product=plan.product_display_name if plan else None,
        )

    return dict(**to_summary(p), items=[_item(it) for it in p.items])
