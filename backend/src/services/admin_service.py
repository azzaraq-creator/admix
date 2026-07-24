"""관리자 계정 CRUD + 권한(admin_permission) + 로그인 비즈니스 로직."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.models.admin import Admin, MASTER_ACCOUNT_TYPE
from src.models.admin_permission import AdminPermission
from src.schemas.admin import AdminAccountCreate, AdminAccountUpdate
from src.utils.listing import in_date_range, paginate, parse_date
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


def _map_account(a) -> dict:
    return dict(
        no=str(a.id),
        name=a.name or "-",
        email=a.email,
        type=a.account_type or "-",
        role=a.department or "-",
        status=a.status,
        createdAt=_fmt_date(a.created_at),
    )


def list_accounts_all(db: Session) -> list[dict]:
    """엑셀 등 전건이 필요한 경우용(필터/페이지네이션 없음)."""
    admins = db.query(Admin).order_by(Admin.created_at.desc()).all()
    return [_map_account(a) for a in admins]


def list_accounts(
    db: Session,
    *,
    date_from: str | None = None,
    date_to: str | None = None,
    keyword: str | None = None,
    account_type: str | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 10,
) -> tuple[int, list[dict]]:
    """생성일(createdAt) 기간·유형·상태·키워드 필터 + 페이지네이션. (total, items) 반환."""
    rows = list_accounts_all(db)

    df = parse_date(date_from)
    dt = parse_date(date_to)
    kw = (keyword or "").strip().lower()

    def keep(r: dict) -> bool:
        if account_type and r["type"] != account_type:
            return False
        if status:
            kr = "활성" if r["status"] == "active" else "비활성"
            if kr != status:
                return False
        if kw and kw not in r["name"].lower() and kw not in r["email"].lower():
            return False
        if not in_date_range(r["createdAt"], df, dt):
            return False
        return True

    return paginate([r for r in rows if keep(r)], page, page_size)


_ACCOUNT_EXPORT_COLUMNS = [
    ("name", "이름"),
    ("email", "이메일(ID)"),
    ("type", "계정 유형"),
    ("role", "부서/역할"),
    ("status", "상태"),
    ("createdAt", "생성일"),
]


def export_accounts_xlsx(db: Session) -> bytes:
    """관리자 계정 목록을 xlsx 로 export — 헤더=계정 관리 목록 컬럼."""
    from io import BytesIO

    from openpyxl import Workbook

    rows = list_accounts_all(db)
    wb = Workbook()
    ws = wb.active
    ws.title = "accounts"
    ws.append([label for _, label in _ACCOUNT_EXPORT_COLUMNS])
    for r in rows:
        values = []
        for key, _ in _ACCOUNT_EXPORT_COLUMNS:
            v = r.get(key, "")
            if key == "status":
                v = "활성" if v == "active" else "비활성"
            values.append(v)
        ws.append(values)
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


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
