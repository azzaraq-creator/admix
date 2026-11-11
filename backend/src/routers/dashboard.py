"""관리자 대시보드 라우터 — 로그인한 관리자 누구나 조회(권한 무관), 단 콜라보 전용 관리자는 막는다(11-10)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.admin import Admin
from src.schemas.dashboard import DashboardResponse
from src.services import dashboard_service
from src.utils.deps import get_admix_admin

router = APIRouter(prefix="/admin/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardResponse)
def get_dashboard(
    db: Session = Depends(get_db),
    _: Admin = Depends(get_admix_admin),
) -> DashboardResponse:
    return dashboard_service.get_dashboard(db)
