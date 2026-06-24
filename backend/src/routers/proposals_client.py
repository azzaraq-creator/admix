"""클라이언트 제안서(장바구니/플래닝) 라우터.

소유자: 회원(토큰) 또는 비회원 세션(session_id). 매체 담기는 양쪽 모두 가능하나
제출/다운로드는 회원 전용. admin 의 /admin/proposals 와는 별개.
"""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.user import User
from src.schemas.proposal import (
    AddItemsRequest,
    CreateProposalRequest,
    ProposalDetail,
    ProposalSummary,
    RenameProposalRequest,
    ReorderItemsRequest,
)
from src.services import proposal_service
from src.utils.deps import get_current_user, get_current_user_optional

router = APIRouter(prefix="/proposals", tags=["proposals-client"])


def _parse_uuid(value: Optional[str]) -> Optional[uuid.UUID]:
    if not value:
        return None
    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError):
        return None


def _owner(user: Optional[User], session_id: Optional[str]):
    """(member_id, session_id) 소유자 키. 회원이면 세션 무시."""
    if user is not None:
        return user.id, None
    return None, _parse_uuid(session_id)


@router.post("", response_model=ProposalSummary, status_code=status.HTTP_201_CREATED)
def create_proposal(
    body: CreateProposalRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    member_id, session_id = _owner(user, body.session_id)
    if member_id is None and session_id is None:
        raise HTTPException(status_code=400, detail="session_id 가 필요합니다.")
    try:
        p = proposal_service.create_proposal(
            db, body.title, member_id=member_id, session_id=session_id, user=user
        )
    except proposal_service.ProposalLimitError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"reason": "limit_reached", "tier": exc.tier, "limit": exc.limit},
        ) from exc
    return ProposalSummary(**proposal_service.to_summary(p))


@router.get("", response_model=list[ProposalSummary])
def list_proposals(
    session_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    member_id, sid = _owner(user, session_id)
    rows = proposal_service.list_for_owner(db, member_id=member_id, session_id=sid)
    return [ProposalSummary(**proposal_service.to_summary(p)) for p in rows]


def _get_owned_or_404(
    db: Session, proposal_id: str, user: Optional[User], session_id: Optional[str]
):
    member_id, sid = _owner(user, session_id)
    p = proposal_service.get_owned(
        db, proposal_id, member_id=member_id, session_id=sid
    )
    if p is None:
        raise HTTPException(status_code=404, detail="제안서를 찾을 수 없습니다.")
    return p


@router.get("/{proposal_id}", response_model=ProposalDetail)
def get_proposal(
    proposal_id: str,
    session_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    p = _get_owned_or_404(db, proposal_id, user, session_id)
    return ProposalDetail(**proposal_service.to_detail(p))


@router.patch("/{proposal_id}", response_model=ProposalSummary)
def rename_proposal(
    proposal_id: str,
    body: RenameProposalRequest,
    session_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    p = _get_owned_or_404(db, proposal_id, user, session_id)
    p = proposal_service.rename(db, p, body.title)
    return ProposalSummary(**proposal_service.to_summary(p))


@router.delete("/{proposal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_proposal(
    proposal_id: str,
    session_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    p = _get_owned_or_404(db, proposal_id, user, session_id)
    proposal_service.delete(db, p)


@router.post("/{proposal_id}/items", response_model=ProposalDetail)
def add_items(
    proposal_id: str,
    body: AddItemsRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    p = _get_owned_or_404(db, proposal_id, user, body.session_id)
    p = proposal_service.add_items(db, p, body.media_ids)
    return ProposalDetail(**proposal_service.to_detail(p))


@router.put("/{proposal_id}/order", response_model=ProposalDetail)
def reorder_items(
    proposal_id: str,
    body: ReorderItemsRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    p = _get_owned_or_404(db, proposal_id, user, body.session_id)
    p = proposal_service.reorder_items(db, p, body.media_ids)
    return ProposalDetail(**proposal_service.to_detail(p))


@router.delete("/{proposal_id}/items/{media_id}", response_model=ProposalDetail)
def remove_item(
    proposal_id: str,
    media_id: str,
    session_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    p = _get_owned_or_404(db, proposal_id, user, session_id)
    p = proposal_service.remove_item(db, p, media_id)
    return ProposalDetail(**proposal_service.to_detail(p))


@router.post("/{proposal_id}/submit", response_model=ProposalSummary)
def submit_proposal(
    proposal_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),  # 회원 전용
):
    p = proposal_service.get_owned(db, proposal_id, member_id=user.id, session_id=None)
    if p is None:
        raise HTTPException(status_code=404, detail="제안서를 찾을 수 없습니다.")
    p.status = "execution_requested"
    db.commit()
    db.refresh(p)
    return ProposalSummary(**proposal_service.to_summary(p))
