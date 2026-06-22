"""제안 관리 라우터 — admin/proposals 페이지 연동."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.admin import Admin
from src.schemas.proposal import ProposalListResponse
from src.services import proposal_service
from src.utils.deps import get_current_admin

router = APIRouter(prefix="/admin/proposals", tags=["proposals"])


@router.get("", response_model=ProposalListResponse)
def list_proposals(
    db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)
) -> ProposalListResponse:
    items = proposal_service.list_proposals(db)
    return ProposalListResponse(total=len(items), items=items)
