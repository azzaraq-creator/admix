"""콜라보 — /partners 대시보드 API(/api/v1/partners/...).

- 제휴사(콜라보) 회원: 내 매장 등록·수정·삭제, 매장 사진 올리기.
- 광고주·제휴사(콜라보) 회원: 공개 매장 목록·상세(매체 찾기에서 콜라보 매장을 누르면 새 탭으로 여는 화면).
어드민 "콜라보 매장 관리"는 admin_router(/admin/partners/stores).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.admin import Admin
from src.models.user import User
from src.services import partners_service
from src.utils.deps import get_current_user, require_permission

router = APIRouter(prefix="/partners", tags=["partners"])
admin_router = APIRouter(prefix="/admin/partners/stores", tags=["admin-partners"])


class PartnersStoreIn(BaseModel):
    name: str | None = Field(default=None, max_length=100)  # 매장명 100자(화면 입력칸과 같다, DB 칸은 200)
    address: str | None = Field(default=None, max_length=500)
    address_detail: str | None = Field(default=None, max_length=200)
    # 주소 검색(다음 우편번호)이 준 시·도, 시·군·구 — 없으면 서버가 카카오 주소 검색으로 채운다.
    city: str | None = Field(default=None, max_length=100)
    district: str | None = Field(default=None, max_length=100)
    latitude: float | None = None
    longitude: float | None = None
    image_urls: list[str] | None = None
    phone: str | None = Field(default=None, max_length=30)
    owner_name: str | None = Field(default=None, max_length=100)
    tags: list[str] | None = None
    business_hours: str | None = Field(default=None, max_length=300)


class AdminPartnersStoreIn(PartnersStoreIn):
    status: str | None = None
    admin_memo: str | None = None
    owner_login_id: str | None = None


def _data(body: BaseModel) -> dict:
    return body.model_dump(exclude_unset=True)


# ── 회원 ───────────────────────────────────────────────────────────────


@router.get("/tag-options")
def tag_options() -> dict:
    return {"tags": partners_service.TAG_OPTIONS, "maxTags": partners_service.MAX_TAGS, "maxImages": partners_service.MAX_IMAGES}


@router.post("/images")
def upload_image(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
) -> dict:
    partners_service.ensure_partner(user)
    return {"url": partners_service.upload_image(file)}


class PartnerAgreementIn(BaseModel):
    version: str = Field(min_length=1, max_length=20)


@router.get("/me/agreement/progress")
def agreement_progress(user: User = Depends(get_current_user)) -> dict:
    """기본협약 진행 상태 — 동의 전에 저장해 둔 곳(없으면 null)."""
    partners_service.ensure_partner(user)
    return {"progress": user.partner_agreement_progress}


@router.put("/me/agreement/progress")
def save_agreement_progress(
    body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    """기본협약 진행 상태 저장 — 화면이 바뀔 때마다 보낸다(작은 JSON, 동의 후에는 무시)."""
    return partners_service.save_agreement_progress(db, user, body.get("progress"))


@router.post("/me/agreement")
def agree(
    body: PartnerAgreementIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    """기본협약 최종 동의 — 동의 시각 · 버전을 남긴다(이미 동의했으면 처음 시각을 유지)."""
    return partners_service.agree(db, user, body.version)


@router.get("/me/stores")
def my_stores(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return {"items": partners_service.list_mine(db, user)}


@router.post("/me/stores", status_code=status.HTTP_201_CREATED)
def create_my_store(
    body: PartnersStoreIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    return partners_service.create_mine(db, user, _data(body))


@router.patch("/me/stores/{store_id}")
def update_my_store(
    store_id: str,
    body: PartnersStoreIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return partners_service.update_mine(db, user, store_id, _data(body))


@router.delete("/me/stores/{store_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_store(
    store_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Response:
    partners_service.delete_mine(db, user, store_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/stores")
def list_stores(
    keyword: str | None = Query(default=None),
    city: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    partners_service.ensure_viewer(user)
    return {"items": partners_service.list_public(db, keyword=keyword, city=city)}


@router.get("/stores/{key}")
def get_store(key: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """key — 매장 id 또는 매체 찾기 media_id(CF-0001)."""
    partners_service.ensure_viewer(user)
    return partners_service.get_public(db, key, user)


# ── 어드민 ─────────────────────────────────────────────────────────────


@admin_router.get("")
def admin_list(
    keyword: str | None = Query(default=None),
    status_: str | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _: Admin = Depends(require_permission("media")),
    db: Session = Depends(get_db),
) -> dict:
    total, items = partners_service.admin_list(
        db, keyword=keyword, status=status_, page=page, page_size=page_size
    )
    return {"total": total, "items": items}


@admin_router.get("/geocode")
def admin_geocode(
    address: str = Query(..., min_length=2),
    _: Admin = Depends(require_permission("media")),
) -> dict:
    return partners_service.geocode(address)


@admin_router.post("/images")
def admin_upload_image(
    file: UploadFile = File(...),
    _: Admin = Depends(require_permission("media")),
) -> dict:
    return {"url": partners_service.upload_image(file)}


@admin_router.get("/{store_id}")
def admin_get(
    store_id: str, _: Admin = Depends(require_permission("media")), db: Session = Depends(get_db)
) -> dict:
    return partners_service.admin_get(db, store_id)


@admin_router.post("", status_code=status.HTTP_201_CREATED)
def admin_create(
    body: AdminPartnersStoreIn,
    _: Admin = Depends(require_permission("media")),
    db: Session = Depends(get_db),
) -> dict:
    return partners_service.admin_create(db, _data(body))


@admin_router.patch("/{store_id}")
def admin_update(
    store_id: str,
    body: AdminPartnersStoreIn,
    _: Admin = Depends(require_permission("media")),
    db: Session = Depends(get_db),
) -> dict:
    return partners_service.admin_update(db, store_id, _data(body))


@admin_router.delete("/{store_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete(
    store_id: str, _: Admin = Depends(require_permission("media")), db: Session = Depends(get_db)
) -> Response:
    partners_service.admin_delete(db, store_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
