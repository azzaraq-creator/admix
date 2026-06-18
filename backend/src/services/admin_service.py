"""관리자 계정 CRUD + 권한(admin_permission) 비즈니스 로직."""
from __future__ import annotations

import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.models.admin import Admin
from src.models.admin_permission import AdminPermission
from src.schemas.admin import AdminAccountCreate, AdminAccountUpdate
from src.utils.security import hash_password

VALID_MENU_KEYS = {"dashboard", "media", "member", "business", "faq", "account"}


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
    db.delete(admin)
    db.commit()
