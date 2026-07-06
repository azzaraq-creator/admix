"""관리자 계정 CRUD + 권한(admin_permission) + 로그인 비즈니스 로직."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.models.admin import Admin, MASTER_ACCOUNT_TYPE
from src.models.admin_permission import AdminPermission
from src.schemas.admin import AdminAccountCreate, AdminAccountUpdate
from src.utils.security import hash_password, verify_password

VALID_MENU_KEYS = {"dashboard", "media", "member", "business", "faq", "account", "chat"}


def _other_active_masters(db: Session, exclude_id: uuid.UUID) -> int:
    """자신을 제외한 활성 마스터 계정 수."""
    return (
        db.query(Admin)
        .filter(
            Admin.account_type == MASTER_ACCOUNT_TYPE,
            Admin.status == "active",
            Admin.id != exclude_id,
        )
        .count()
    )


def _validate_perms(perms: list[str]) -> list[str]:
    invalid = [p for p in perms if p not in VALID_MENU_KEYS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"알 수 없는 권한 키: {invalid}")
    return list(dict.fromkeys(perms))


def _fmt_date(dt) -> str:
    return dt.date().isoformat() if dt is not None else "-"


def list_accounts(db: Session) -> list[dict]:
    admins = db.query(Admin).order_by(Admin.created_at.desc()).all()
    return [
        dict(
            no=str(a.id),
            name=a.name or "-",
            email=a.email,
            type=a.account_type or "-",
            role=a.department or "-",
            status=a.status,
            createdAt=_fmt_date(a.created_at),
        )
        for a in admins
    ]


def authenticate_admin(db: Session, email: str, password: str) -> Admin:
    admin = db.query(Admin).filter(Admin.email == email).first()
    if (
        admin is None
        or admin.password_hash is None
        or not verify_password(password, admin.password_hash)
    ):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
    if admin.status != "active":
        raise HTTPException(status_code=403, detail="비활성화된 계정입니다.")
    admin.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(admin)
    return admin


def _detail(admin: Admin) -> dict:
    return dict(
        id=admin.id,
        email=admin.email,
        name=admin.name,
        account_type=admin.account_type,
        department=admin.department,
        phone=admin.phone,
        status=admin.status,
        permissions=[p.menu_key for p in admin.permissions],
        created_at=admin.created_at,
        updated_at=admin.updated_at,
    )


def get_account(db: Session, admin_id: uuid.UUID) -> dict:
    admin = db.query(Admin).filter(Admin.id == admin_id).first()
    if admin is None:
        raise HTTPException(status_code=404, detail="계정을 찾을 수 없습니다.")
    return _detail(admin)


def create_account(db: Session, data: AdminAccountCreate) -> dict:
    if db.query(Admin).filter(Admin.email == data.email).first():
        raise HTTPException(status_code=409, detail="이미 등록된 이메일입니다.")
    perms = _validate_perms(data.permissions)
    admin = Admin(
        email=data.email,
        password_hash=hash_password(data.password),
        name=data.name,
        account_type=data.account_type,
        department=data.department,
        phone=data.phone,
        status=data.status,
    )
    admin.permissions = [AdminPermission(menu_key=k) for k in perms]
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return _detail(admin)


def update_account(db: Session, admin_id: uuid.UUID, data: AdminAccountUpdate) -> dict:
    admin = db.query(Admin).filter(Admin.id == admin_id).first()
    if admin is None:
        raise HTTPException(status_code=404, detail="계정을 찾을 수 없습니다.")
    fields = data.model_dump(exclude_unset=True)
    if admin.account_type == MASTER_ACCOUNT_TYPE:
        demoted = fields.get("account_type", MASTER_ACCOUNT_TYPE) != MASTER_ACCOUNT_TYPE
        disabled = fields.get("status", "active") != "active"
        if (demoted or disabled) and _other_active_masters(db, admin.id) == 0:
            raise HTTPException(
                status_code=400,
                detail="마지막 마스터 계정은 강등하거나 비활성화할 수 없습니다.",
            )
    if "password" in fields:
        pw = fields.pop("password")
        if pw:
            admin.password_hash = hash_password(pw)
    if "permissions" in fields:
        perms = _validate_perms(fields.pop("permissions") or [])
        admin.permissions = [AdminPermission(menu_key=k) for k in perms]
    for field, value in fields.items():
        setattr(admin, field, value)
    db.commit()
    db.refresh(admin)
    return _detail(admin)


def delete_account(db: Session, admin_id: uuid.UUID) -> None:
    admin = db.query(Admin).filter(Admin.id == admin_id).first()
    if admin is None:
        raise HTTPException(status_code=404, detail="계정을 찾을 수 없습니다.")
    if admin.account_type == MASTER_ACCOUNT_TYPE and _other_active_masters(db, admin.id) == 0:
        raise HTTPException(
            status_code=400, detail="마지막 마스터 계정은 삭제할 수 없습니다."
        )
    db.delete(admin)
    db.commit()
