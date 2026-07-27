"""제안 관리 라우터 — admin/proposals 페이지 연동."""
from __future__ import annotations

import os
import shutil
import tempfile
import uuid as uuidlib
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session
from starlette.background import BackgroundTask

from src.config import get_settings
from src.database import get_db
from src.models.admin import Admin
from src.models.proposal_counter_file import ProposalCounterFile
from src.schemas.proposal import AdminProposalDetail, ProposalListResponse
from src.services import deck_converter, ppt_builder, proposal_service
from src.utils.deps import require_permission

PPTX_MEDIA_TYPE = (
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
)
XLSX_MEDIA_TYPE = (
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)

router = APIRouter(prefix="/admin/proposals", tags=["proposals"])

ALLOWED_EXTENSIONS = {".ppt", ".pptx"}
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB


@router.get("", response_model=ProposalListResponse)
def list_proposals(
    page: int = 1,
    page_size: int = 10,
    date_from: str | None = None,
    date_to: str | None = None,
    keyword: str | None = None,
    status: str | None = None,
    member_id: uuidlib.UUID | None = None,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("business")),
) -> ProposalListResponse:
    total, items = proposal_service.list_proposals(
        db,
        date_from=date_from,
        date_to=date_to,
        keyword=keyword,
        status=status,
        member_id=member_id,
        page=page,
        page_size=page_size,
    )
    return ProposalListResponse(total=total, items=items)


@router.get("/export")
def export_proposals(
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("business")),
) -> Response:
    """제안 목록 xlsx 다운로드."""
    content = proposal_service.export_proposals_xlsx(db)
    return Response(
        content=content,
        media_type=XLSX_MEDIA_TYPE,
        headers={
            "Content-Disposition": 'attachment; filename="proposals.xlsx"'
        },
    )


@router.get("/{proposal_id}", response_model=AdminProposalDetail)
def get_proposal(
    proposal_id: str,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("business")),
) -> AdminProposalDetail:
    detail = proposal_service.get_admin_detail(db, proposal_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="제안서를 찾을 수 없습니다.")
    return AdminProposalDetail(**detail)


@router.post("/{proposal_id}/counter-proposal", response_model=AdminProposalDetail)
async def upload_counter_proposal(
    proposal_id: str,
    background: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_permission("business")),
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
    pptx_path = dest_dir / stored_name
    pptx_path.write_bytes(content)
    file_url = f"/uploads/proposals/{proposal_id}/{stored_name}"

    # PPT → 슬라이드 이미지 변환 (고객 화면에서 미리보기로 표시)
    deck_id = uuidlib.uuid4().hex
    slides_dir = dest_dir / deck_id
    title = os.path.splitext(file.filename or stored_name)[0]
    try:
        deck_converter.convert_ppt_to_slides(str(pptx_path), str(slides_dir), title)
    except Exception as exc:  # noqa: BLE001 — 변환 실패 사용자에게 전달
        pptx_path.unlink(missing_ok=True)
        shutil.rmtree(slides_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"PPT 변환 실패: {exc}") from exc
    slides_url = f"/uploads/proposals/{proposal_id}/{deck_id}"

    p = proposal_service.save_counter_proposal_file(
        db,
        proposal_id,
        file_url=file_url,
        file_name=file.filename or stored_name,
        slides_url=slides_url,
        author_name=admin.name,
    )
    if p is None:
        pptx_path.unlink(missing_ok=True)
        shutil.rmtree(slides_dir, ignore_errors=True)
        raise HTTPException(status_code=404, detail="제안서를 찾을 수 없습니다.")

    detail = proposal_service.get_admin_detail(db, proposal_id)
    # 제안서 소유 회원의 연락받을 이메일로 맞춤제안 도착 알림 발송
    recipient = (detail.get("member") or {}).get("email")
    if recipient:
        background.add_task(
            proposal_service.send_custom_proposal_email,
            recipient,
            proposal_id,
            detail.get("title") or "",
        )
    return AdminProposalDetail(**detail)


@router.post("/{proposal_id}/accept", response_model=AdminProposalDetail)
def accept_proposal(
    proposal_id: str,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("business")),
) -> AdminProposalDetail:
    """집행 수락 — 상태를 계약 완료(contracted)로 변경."""
    p = proposal_service.update_status(db, proposal_id, "contracted")
    if p is None:
        raise HTTPException(status_code=404, detail="제안서를 찾을 수 없습니다.")
    return AdminProposalDetail(**proposal_service.get_admin_detail(db, proposal_id))


@router.get("/{proposal_id}/counter-proposal/{counter_id}/download")
def download_counter_proposal(
    proposal_id: str,
    counter_id: str,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("business")),
) -> FileResponse:
    """맞춤제안 원본 PPT 다운로드 — 업로드 당시 파일명 유지."""
    try:
        cid = uuidlib.UUID(counter_id)
        pid = uuidlib.UUID(proposal_id)
    except (ValueError, AttributeError) as exc:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.") from exc
    cf = (
        db.query(ProposalCounterFile)
        .filter(
            ProposalCounterFile.id == cid,
            ProposalCounterFile.proposal_id == pid,
        )
        .first()
    )
    if cf is None:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    rel = (
        cf.file_url[len("/uploads"):]
        if cf.file_url.startswith("/uploads")
        else cf.file_url
    )
    path = Path(get_settings().upload_dir) / rel.lstrip("/")
    if not path.exists():
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    return FileResponse(
        path, filename=cf.file_name, media_type="application/octet-stream"
    )


@router.get("/{proposal_id}/export-ppt")
def export_proposal_ppt(
    proposal_id: str,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_permission("business")),
) -> FileResponse:
    """고객 제안서를 python-pptx 로 생성해 다운로드."""
    detail = proposal_service.get_admin_detail(db, proposal_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="제안서를 찾을 수 없습니다.")
    tmp_dir = tempfile.mkdtemp()
    out_path = os.path.join(tmp_dir, "proposal.pptx")
    try:
        ppt_builder.generate_proposal_ppt(detail, out_path)
    except Exception as exc:  # noqa: BLE001 — 생성 실패 사용자에게 전달
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"PPT 생성 실패: {exc}") from exc
    title = detail.get("title") or "제안서"
    return FileResponse(
        out_path,
        filename=f"{title}.pptx",
        media_type=PPTX_MEDIA_TYPE,
        background=BackgroundTask(shutil.rmtree, tmp_dir, ignore_errors=True),
    )
