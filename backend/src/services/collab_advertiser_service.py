"""콜라보 어드민 · 광고주 회원(11-10) — 콜라보 권한만 있는 관리자도 광고주를 보게 한다.

읽기 전용: 담당자 정보 · 명함 · 브랜드 · 사업자 인증 상태. 계정 수정 · 사업자 인증 처리는 admix 회원 관리(/admin/members)에서 한다.
단, 사업자 상호 · 사업자번호는 여기서도 적어 저장한다(11-11 사용자, admin_update_biz).
목록엔 콜라보 수(collabCount — 보낸 의뢰 중 취소만 뺀 수, 확정 · 진행도 센다)를 붙인다(11-12 사용자).
"""
from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from src.config import get_settings
from src.models.advertiser_brand import AdvertiserBrand
from src.models.advertiser_collab_request import AdvertiserCollabRequest
from src.models.member_profile import BusinessRegistration
from src.models.user import User
from src.services import advertiser_brand_service

ADVERTISER = "advertiser"


def _iso(value) -> str | None:
    return value.isoformat() if value else None


def _summary(u: User, brands: list[AdvertiserBrand]) -> dict:
    reg = u.business_registration
    return dict(
        id=str(u.id),
        loginId=u.login_id,
        email=u.email,
        name=u.name,
        phone=u.phone,
        companyName=u.company_name,
        industry=u.industry,
        contactName=u.contact_name,
        position=u.position,
        department=u.department,
        businessCardUrl=u.business_card_url,
        businessCardName=u.business_card_name,
        snsProvider=u.sns_provider,
        status=u.status,
        createdAt=_iso(u.created_at),
        bizStatus=reg.status if reg else "unregistered",
        bizName=reg.business_name if reg else None,
        bizNo=reg.business_registration_no if reg else None,
        bizFileName=reg.license_file_name if reg and reg.license_file_url else None,
        bizUploadedAt=_iso(reg.license_uploaded_at) if reg else None,
        bizVerifiedAt=_iso(reg.verified_at) if reg else None,
        bizRejectReason=reg.reject_reason if reg else None,
        brands=[advertiser_brand_service.serialize(b) for b in brands],
    )


def _brands_by_user(db: Session, user_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[AdvertiserBrand]]:
    out: dict[uuid.UUID, list[AdvertiserBrand]] = {}
    if not user_ids:
        return out
    for b in (
        db.query(AdvertiserBrand)
        .filter(AdvertiserBrand.user_id.in_(user_ids))
        .order_by(AdvertiserBrand.created_at)
    ):
        out.setdefault(b.user_id, []).append(b)
    return out


def _collab_counts(db: Session, user_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    """회원별 콜라보 수 — 보낸 의뢰 중 취소(cancelled)만 뺀다(접수 · 기획안 · 확정 모두 센다)."""
    if not user_ids:
        return {}
    rows = (
        db.query(AdvertiserCollabRequest.user_id, func.count(AdvertiserCollabRequest.id))
        .filter(
            AdvertiserCollabRequest.user_id.in_(user_ids),
            AdvertiserCollabRequest.status != "cancelled",
        )
        .group_by(AdvertiserCollabRequest.user_id)
        .all()
    )
    return {uid: n for uid, n in rows}


def _advertiser_or_404(db: Session, member_id: str) -> User:
    try:
        user = db.get(User, uuid.UUID(member_id))
    except ValueError:
        user = None
    if user is None or user.member_category != ADVERTISER or user.status == "withdrawn":
        raise HTTPException(status_code=404, detail="광고주 회원을 찾을 수 없어요.")
    return user


def admin_list(
    db: Session,
    *,
    keyword: str | None = None,
    biz: str | None = None,
    brand: str | None = None,
    card: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[int, list[dict]]:
    """광고주 회원 — 최근 가입 순. biz: 사업자 상태 · brand/card: yes/no(브랜드 · 명함 등록 여부)."""
    q = (
        db.query(User)
        .options(joinedload(User.business_registration), selectinload(User.social_accounts))
        .filter(User.member_category == ADVERTISER, User.status != "withdrawn")
    )
    kw = (keyword or "").strip()
    if kw:
        like = f"%{kw}%"
        has_brand_named = (
            db.query(AdvertiserBrand.id)
            .filter(AdvertiserBrand.user_id == User.id, AdvertiserBrand.name.ilike(like))
            .exists()
        )
        conds = [
            User.login_id.ilike(like),
            User.email.ilike(like),
            User.name.ilike(like),
            User.phone.ilike(like),
            User.company_name.ilike(like),
            User.contact_name.ilike(like),
            has_brand_named,
        ]
        # 연락처는 숫자만 저장돼 있고 화면엔 '-'를 넣어 보이므로 "010-1234" 처럼 찾아도 맞게(제휴사 회원과 같다).
        digits = "".join(ch for ch in kw if ch.isdigit())
        if len(digits) >= 3 and all(ch.isdigit() or ch in "- " for ch in kw):
            conds.append(func.regexp_replace(User.phone, "[^0-9]", "", "g").like(f"%{digits}%"))
        q = q.filter(or_(*conds))
    if biz:
        q = q.outerjoin(BusinessRegistration, BusinessRegistration.user_id == User.id)
        if biz == "unregistered":
            q = q.filter(or_(BusinessRegistration.id.is_(None), BusinessRegistration.status == "unregistered"))
        else:
            q = q.filter(BusinessRegistration.status == biz)
    if brand in ("yes", "no"):
        has = db.query(AdvertiserBrand.id).filter(AdvertiserBrand.user_id == User.id).exists()
        q = q.filter(has if brand == "yes" else ~has)
    if card == "yes":
        q = q.filter(User.business_card_url.isnot(None))
    elif card == "no":
        q = q.filter(User.business_card_url.is_(None))
    total = q.count()
    rows = (
        q.order_by(User.created_at.desc())
        .offset((max(page, 1) - 1) * page_size)
        .limit(page_size)
        .all()
    )
    ids = [u.id for u in rows]
    by_user = _brands_by_user(db, ids)
    counts = _collab_counts(db, ids)
    return total, [
        {**_summary(u, by_user.get(u.id, [])), "collabCount": counts.get(u.id, 0)} for u in rows
    ]


def admin_get(db: Session, member_id: str) -> dict:
    user = _advertiser_or_404(db, member_id)
    return _summary(user, _brands_by_user(db, [user.id]).get(user.id, []))


def admin_update_biz(db: Session, member_id: str, data: dict) -> dict:
    """상호 · 사업자번호 — 콜라보 관리자가 직접 적어 저장한다(11-11 사용자). 인증 상태 · 등록증 파일은 그대로.

    빈 값은 지운다. 아직 사업자 정보 줄이 없으면 미등록 상태로 새로 만든다(admix 회원 관리와 같다).
    """
    user = _advertiser_or_404(db, member_id)
    reg = user.business_registration
    if reg is None:
        reg = BusinessRegistration(user_id=user.id, status="unregistered")
        db.add(reg)
    for key in ("business_name", "business_registration_no"):
        if key in data:
            setattr(reg, key, (data[key] or "").strip() or None)
    db.commit()
    db.refresh(user)
    return admin_get(db, member_id)


def _upload_path(url: str | None, missing: str) -> Path:
    if not url:
        raise HTTPException(status_code=404, detail=missing)
    path = Path(get_settings().upload_dir) / url.removeprefix("/uploads/")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없어요.")
    return path


def business_card_file(db: Session, member_id: str) -> tuple[Path, str]:
    user = _advertiser_or_404(db, member_id)
    path = _upload_path(user.business_card_url, "등록된 명함이 없어요.")
    return path, (user.business_card_name or path.name)


def license_file(db: Session, member_id: str) -> tuple[Path, str]:
    user = _advertiser_or_404(db, member_id)
    reg = user.business_registration
    path = _upload_path(reg.license_file_url if reg else None, "올린 사업자등록증이 없어요.")
    return path, (reg.license_file_name or path.name)
