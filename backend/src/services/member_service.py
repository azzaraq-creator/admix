"""회원(member) 관리 비즈니스 로직 — admin/members.

users(회원) + business_registration(1:1) + member_sanction(1:N).
canonical 값은 목록 응답에서만 한글로 변환(상세는 canonical 유지, 프론트가 표시 변환).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from src.models.member_profile import BusinessRegistration
from src.models.user import User
from src.schemas.member import BusinessRegistrationUpdate, MemberUpdate

_TYPE = {"corporate": "기업", "individual": "일반"}
_BIZ = {
    "unregistered": "미등록",
    "reviewing": "검토 대기",
    "verified": "검토 완료",
    "rejected": "인증 반려",
}
_STATUS = {"active": "정상", "withdrawn": "탈퇴", "sanctioned": "제재", "dormant": "휴면"}


def _fmt_date(dt) -> str:
    return dt.date().isoformat() if dt is not None else "-"


def list_members(db: Session) -> list[dict]:
    users = (
        db.query(User)
        .options(joinedload(User.business_registration))
        .order_by(User.created_at.desc())
        .all()
    )
    rows = []
    for u in users:
        biz = u.business_registration
        rows.append(
            dict(
                no=str(u.id),
                type=_TYPE.get(u.membership_type, u.membership_type),
                company=u.company_name or "-",
                name=u.name or "-",
                email=u.email,
                phone=u.phone or "-",
                bizStatus=_BIZ.get(biz.status, biz.status) if biz else "미등록",
                marketing="동의" if u.marketing_consent else "비동의",
                status=_STATUS.get(u.status, u.status),
                joinedAt=_fmt_date(u.created_at),
            )
        )
    return rows


def _get_user(db: Session, user_id: uuid.UUID) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")
    return user


def get_member(db: Session, user_id: uuid.UUID) -> dict:
    user = _get_user(db, user_id)
    biz = user.business_registration
    return dict(
        id=user.id,
        email=user.email,
        name=user.name,
        phone=user.phone,
        membership_type=user.membership_type,
        company_name=user.company_name,
        position=user.position,
        industry=user.industry,
        marketing_consent=user.marketing_consent,
        status=user.status,
        admin_memo=user.admin_memo,
        created_at=user.created_at,
        business_registration=biz,
        sanctions=sorted(user.sanctions, key=lambda s: s.start_date, reverse=True),
    )


def update_member(db: Session, user_id: uuid.UUID, data: MemberUpdate) -> dict:
    user = _get_user(db, user_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    return get_member(db, user_id)


def update_business_registration(
    db: Session, user_id: uuid.UUID, data: BusinessRegistrationUpdate
) -> dict:
    user = _get_user(db, user_id)
    biz = user.business_registration
    if biz is None:
        biz = BusinessRegistration(user_id=user.id, status="unregistered")
        db.add(biz)
    fields = data.model_dump(exclude_unset=True)
    for field, value in fields.items():
        setattr(biz, field, value)
    if fields.get("status") == "verified" and biz.verified_at is None:
        biz.verified_at = datetime.now(timezone.utc)
    db.commit()
    return get_member(db, user_id)
