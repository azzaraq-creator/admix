"""콜라보 어드민 영업 DB(/admin/collab/leads, 071) — 가입 전 제휴사(매장) 영업 기록. 권한 "collab".

칸 이름은 원본 영업 앱과 같다(services/collab_lead_service). 원본 파일은 scripts/import_collab_leads.py 로 가져온다.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.admin import Admin
from src.services import collab_lead_service
from src.utils.deps import require_permission

router = APIRouter(prefix="/admin/collab/leads", tags=["admin-collab"])
Perm = Depends(require_permission("collab"))


@router.get("/meta")
def lead_meta(_: Admin = Perm, db: Session = Depends(get_db)) -> dict:
    """칸 설정(이름 · 순서 · 보이기)과 목록 조건에 고를 값."""
    return collab_lead_service.meta(db)


@router.get("")
def list_leads(
    keyword: str | None = Query(default=None),
    status_: str | None = Query(default=None, alias="status"),
    potential: str | None = Query(default=None),
    grade: str | None = Query(default=None),
    region: str | None = Query(default=None),
    type_: str | None = Query(default=None, alias="type"),
    owner: str | None = Query(default=None),
    sort: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    _: Admin = Perm,
    db: Session = Depends(get_db),
) -> dict:
    total, items = collab_lead_service.list_leads(
        db,
        keyword=keyword,
        filters={
            "status": status_,
            "potential": potential,
            "grade": grade,
            "region": region,
            "type": type_,
            "owner": owner,
        },
        sort=sort,
        page=page,
        page_size=page_size,
    )
    return {"total": total, "items": items}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_lead(body: dict, _: Admin = Perm, db: Session = Depends(get_db)) -> dict:
    """새 영업 기록 — 칸 이름은 목록과 같다(name 필수)."""
    return collab_lead_service.create_lead(db, body)


@router.get("/{lead_id}")
def get_lead(lead_id: str, _: Admin = Perm, db: Session = Depends(get_db)) -> dict:
    return collab_lead_service.get_lead(db, lead_id)


@router.patch("/{lead_id}")
def update_lead(lead_id: str, body: dict, _: Admin = Perm, db: Session = Depends(get_db)) -> dict:
    """보낸 칸만 바꾼다."""
    return collab_lead_service.update_lead(db, lead_id, body)


@router.post("/{lead_id}/confirm")
def confirm_lead(lead_id: str, _: Admin = Perm, db: Session = Depends(get_db)) -> dict:
    """협업 확정 — 이 영업 기록으로 협업 확정 카페(비공개 매장)를 만들고, "협업 확정 전" 목록에서 뺀다(076)."""
    return collab_lead_service.confirm_lead(db, lead_id)


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lead(lead_id: str, _: Admin = Perm, db: Session = Depends(get_db)) -> Response:
    collab_lead_service.delete_lead(db, lead_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
