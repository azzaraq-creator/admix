"""제안 관리 라우터 — admin/proposals 페이지 연동."""
from __future__ import annotations

import os
import uuid as uuidlib
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from src.config import get_settings
from src.database import get_db
from src.models.admin import Admin
from src.schemas.proposal import AdminProposalDetail, ProposalListResponse
from src.services import proposal_service
from src.utils.deps import get_current_admin

router = APIRouter(prefix="/admin/proposals", tags=["proposals"])

ALLOWED_EXTENSIONS = {".ppt", ".pptx"}
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB


@router.get("", response_model=ProposalListResponse)
def list_proposals(
    db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)
) -> ProposalListResponse:
    items = proposal_service.list_proposals(db)
    return ProposalListResponse(total=len(items), items=items)


@router.get("/{proposal_id}", response_model=AdminProposalDetail)
def get_proposal(
    proposal_id: str,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
) -> AdminProposalDetail:
    detail = proposal_service.get_admin_detail(db, proposal_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="제안서를 찾을 수 없습니다.")
    return AdminProposalDetail(**detail)


@router.post("/{proposal_id}/counter-proposal", response_model=AdminProposalDetail)
async def upload_counter_proposal(
    proposal_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
) -> AdminProposalDetail:
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, detail="PPT, PPTX 파일만 업로드할 수 있습니다."
        )
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=400, detail="파일 크기는 10MB 이하만 가능합니다."
        )

    settings = get_settings()
    dest_dir = Path(settings.upload_dir) / "proposals" / proposal_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuidlib.uuid4().hex}{ext}"
    (dest_dir / stored_name).write_bytes(content)
    file_url = f"/uploads/proposals/{proposal_id}/{stored_name}"

    p = proposal_service.save_counter_proposal_file(
        db, proposal_id, file_url=file_url, file_name=file.filename or stored_name
    )
    if p is None:
        (dest_dir / stored_name).unlink(missing_ok=True)
        raise HTTPException(status_code=404, detail="제안서를 찾을 수 없습니다.")
    return AdminProposalDetail(**proposal_service.get_admin_detail(db, proposal_id))


@router.post("/{proposal_id}/accept", response_model=AdminProposalDetail)
def accept_proposal(
    proposal_id: str,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
) -> AdminProposalDetail:
    """집행 수락 — 상태를 계약 완료(contracted)로 변경."""
    p = proposal_service.update_status(db, proposal_id, "contracted")
    if p is None:
        raise HTTPException(status_code=404, detail="제안서를 찾을 수 없습니다.")
    return AdminProposalDetail(**proposal_service.get_admin_detail(db, proposal_id))
