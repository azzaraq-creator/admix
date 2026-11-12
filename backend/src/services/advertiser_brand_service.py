"""광고주 브랜드(068) — 콜라보 화면 "내 브랜드". 광고주 한 명이 여러 브랜드(이름 · 사진 · 담당자 정보 079)를 둔다.

사진은 매장 사진과 같은 규칙으로 먼저 올리고(partners_service.upload_image, folder="brand") 받은 주소를 저장한다.
콜라보 의뢰서에서 브랜드를 고르면 그 이름 · 사진이 의뢰에 붙는다.
"""
from __future__ import annotations

import re
import uuid

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from src.models.advertiser_brand import AdvertiserBrand
from src.models.user import User

MAX_BRANDS = 30
NAME_MAX = 40  # 화면 입력칸 · 의뢰서 브랜드 칸과 같다(DB 칸은 100)

# 브랜드 담당자 정보(079, 모두 선택) — 요청 키(= DB 칸) → (최대 글자 수, 화면 이름).
CONTACT_TEXT_FIELDS = {
    "contact_name": (50, "담당자명"),
    "contact_title": (50, "직함"),
    "contact_dept": (50, "직책 또는 부서"),
}
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def ensure_advertiser(user: User) -> User:
    if user.member_category != "advertiser":
        raise HTTPException(status_code=403, detail="광고주 회원만 브랜드를 등록할 수 있어요.")
    return user


def serialize(brand: AdvertiserBrand) -> dict:
    return {
        "id": str(brand.id),
        "name": brand.name,
        "imageUrl": brand.image_url,
        "contactName": brand.contact_name,
        "contactTitle": brand.contact_title,
        "contactDept": brand.contact_dept,
        "contactPhone": brand.contact_phone,
        "contactEmail": brand.contact_email,
        "createdAt": brand.created_at.isoformat() if brand.created_at else None,
    }


def _clean_name(name) -> str:
    name = str(name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="브랜드 이름을 적어 주세요.")
    if len(name) > NAME_MAX:
        raise HTTPException(status_code=400, detail=f"브랜드 이름은 {NAME_MAX}자까지 쓸 수 있어요.")
    return name


def _clean_image(url) -> str | None:
    url = str(url or "").strip()
    if len(url) > 500:
        raise HTTPException(status_code=400, detail="사진 주소가 너무 길어요.")
    return url or None


def _clean_text(value, *, max_len: int, label: str) -> str | None:
    text = " ".join(str(value or "").split())
    if len(text) > max_len:
        raise HTTPException(status_code=400, detail=f"{label} 칸은 {max_len}자까지 쓸 수 있어요.")
    return text or None


def _clean_phone(value) -> str | None:
    """숫자만 저장한다(화면에서 '-'를 넣어 보인다). 비우면 지운다."""
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    if not digits:
        return None
    if not 9 <= len(digits) <= 11:
        raise HTTPException(status_code=400, detail="전화번호를 9~11자리 숫자로 적어 주세요.")
    return digits


def _clean_email(value) -> str | None:
    email = str(value or "").strip()
    if not email:
        return None
    if len(email) > 255 or not _EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="이메일 주소를 다시 확인해 주세요.")
    return email


def _apply_contact(brand: AdvertiserBrand, data: dict) -> None:
    """보낸 담당자 칸만 바꾼다 — 빈 값은 지운다."""
    for key, (max_len, label) in CONTACT_TEXT_FIELDS.items():
        if key in data:
            setattr(brand, key, _clean_text(data[key], max_len=max_len, label=label))
    if "contact_phone" in data:
        brand.contact_phone = _clean_phone(data["contact_phone"])
    if "contact_email" in data:
        brand.contact_email = _clean_email(data["contact_email"])


def _ensure_unique(db: Session, user: User, name: str, exclude: uuid.UUID | None = None) -> None:
    q = db.query(AdvertiserBrand).filter(
        AdvertiserBrand.user_id == user.id, func.lower(AdvertiserBrand.name) == name.lower()
    )
    if exclude is not None:
        q = q.filter(AdvertiserBrand.id != exclude)
    if q.first():
        raise HTTPException(status_code=409, detail="같은 이름의 브랜드가 이미 있어요.")


def _get_mine(db: Session, user: User, brand_id: str) -> AdvertiserBrand:
    try:
        key = uuid.UUID(brand_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="브랜드를 찾을 수 없어요.")
    brand = db.get(AdvertiserBrand, key)
    if brand is None or brand.user_id != user.id:
        raise HTTPException(status_code=404, detail="브랜드를 찾을 수 없어요.")
    return brand


def list_mine(db: Session, user: User) -> list[dict]:
    """먼저 등록한 브랜드가 앞(의뢰서 기본 브랜드)."""
    ensure_advertiser(user)
    rows = (
        db.query(AdvertiserBrand)
        .filter(AdvertiserBrand.user_id == user.id)
        .order_by(AdvertiserBrand.created_at, AdvertiserBrand.id)
        .all()
    )
    return [serialize(b) for b in rows]


def create(db: Session, user: User, data: dict) -> dict:
    ensure_advertiser(user)
    count = db.query(AdvertiserBrand).filter(AdvertiserBrand.user_id == user.id).count()
    if count >= MAX_BRANDS:
        raise HTTPException(status_code=400, detail=f"브랜드는 {MAX_BRANDS}개까지 등록할 수 있어요.")
    name = _clean_name(data.get("name"))
    _ensure_unique(db, user, name)
    brand = AdvertiserBrand(user_id=user.id, name=name, image_url=_clean_image(data.get("image_url")))
    _apply_contact(brand, data)
    db.add(brand)
    db.commit()
    db.refresh(brand)
    return serialize(brand)


def update(db: Session, user: User, brand_id: str, data: dict) -> dict:
    """보낸 칸만 바꾼다 — image_url 을 null 로 보내면 사진을 지운다(기본 "C")."""
    ensure_advertiser(user)
    brand = _get_mine(db, user, brand_id)
    if "name" in data:
        name = _clean_name(data["name"])
        _ensure_unique(db, user, name, exclude=brand.id)
        brand.name = name
    if "image_url" in data:
        brand.image_url = _clean_image(data["image_url"])
    _apply_contact(brand, data)
    db.commit()
    db.refresh(brand)
    return serialize(brand)


def delete(db: Session, user: User, brand_id: str) -> None:
    ensure_advertiser(user)
    brand = _get_mine(db, user, brand_id)
    db.delete(brand)
    db.commit()
