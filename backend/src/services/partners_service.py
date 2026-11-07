"""제휴사(콜라보) 매장 — /partners 대시보드(제휴사 등록·광고주 찾아보기)와 어드민 "콜라보 매장 관리".

- 제휴사(partner) 회원은 사업자등록증을 올린 뒤(검토 중·인증 완료) 매장을 등록할 수 있다.
- 주소를 저장하면 카카오 주소 검색으로 위도·경도·시도·구군을 채운다(좌표를 직접 넘기면 그 값).
- 공개(active)이고 좌표가 있는 매장은 media 표에 "콜라보" 줄을 함께 두어 매체 찾기 지도·목록에 보인다.
  숨기거나 지우면 그 줄도 지운다. 이 줄은 AI 추천(검색 표)·어드민 매체 관리에서 빠진다.
"""
from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

from fastapi import HTTPException, UploadFile
from sqlalchemy import String, or_
from sqlalchemy.orm import Session

from src.config import get_settings
from src.models.partners_store import PARTNERS_MEDIA_CATEGORY, PartnersStore
from src.models.media_image import MediaImage
from src.models.media_master import Media
from src.models.user import User
from src.services import kakao_address
from src.services import media_service as ms

log = logging.getLogger(__name__)

MAX_IMAGES = 9
MAX_TAGS = 3
PARTNERS_MEDIA_SMALL = "매장"
# 매장을 등록할 수 있는 사업자 등록 상태 — 올리기만 해도(검토 중) 등록할 수 있다.
REGISTRABLE_BIZ_STATUS = {"reviewing", "verified"}
# 콜라보 메뉴·매장 상세를 볼 수 있는 회원 유형.
PARTNERS_VIEWER_CATEGORIES = {"advertiser", "partner"}

# 매장 어필 선택지 — 인스타그램 해시태그처럼 짧게. 화면(frontend/lib/partners.ts)과 같은 값.
TAG_OPTIONS = [
    "뷰맛집",
    "디저트맛집",
    "커피맛집",
    "브런치",
    "넓은공간",
    "작업하기좋은",
    "포토존",
    "감성인테리어",
    "루프탑",
    "테라스",
    "주차가능",
    "반려동물동반",
    "대형매장",
    "로스터리",
    "역세권",
    "24시간",
]

_FIELDS = (
    "name",
    "address",
    "address_detail",
    "city",
    "district",
    "phone",
    "owner_name",
    "business_hours",
)


# ── 권한 ────────────────────────────────────────────────────────────────


def ensure_viewer(user: User | None) -> User:
    """광고주·제휴사(콜라보)만 콜라보 매장 목록·상세를 볼 수 있다."""
    if user is None:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    if user.member_category not in PARTNERS_VIEWER_CATEGORIES:
        raise HTTPException(
            status_code=403, detail="광고주 또는 제휴사(콜라보) 회원만 이용할 수 있어요."
        )
    return user


def ensure_partner(user: User) -> User:
    if user.member_category != "partner":
        raise HTTPException(status_code=403, detail="제휴사(콜라보) 회원만 매장을 등록할 수 있어요.")
    return user


def agree(db: Session, user: User, version: str) -> dict:
    """기본협약 최종 동의 기록 — 처음 동의한 시각을 남기고, 다시 눌러도 바꾸지 않는다."""
    ensure_partner(user)
    if user.partner_agreed_at is None:
        user.partner_agreed_at = datetime.now(timezone.utc)
        user.partner_agreement_version = version
        # 진행 상태(서명자 구분 등)는 남겨 둔다 — 동의 뒤 협약 화면을 다시 열 때 그대로 보여 준다.
        db.commit()
        db.refresh(user)
    return {"agreedAt": user.partner_agreed_at.isoformat(), "version": user.partner_agreement_version}


def save_agreement_progress(db: Session, user: User, progress: object) -> dict:
    """기본협약 진행 상태 저장 — 동의 전에만. 화면이 정한 작은 JSON(dict)만 받는다."""
    ensure_partner(user)
    if user.partner_agreed_at is not None:
        return {"ok": True}
    if progress is not None and (not isinstance(progress, dict) or len(json.dumps(progress)) > 10_000):
        raise HTTPException(status_code=400, detail="진행 상태를 저장하지 못했어요.")
    user.partner_agreement_progress = progress
    db.commit()
    return {"ok": True}


def ensure_can_register(user: User) -> None:
    ensure_partner(user)
    reg = user.business_registration
    if not reg or reg.status not in REGISTRABLE_BIZ_STATUS:
        raise HTTPException(
            status_code=403, detail="사업자등록증을 먼저 올려 주세요. 올리면 바로 매장을 등록할 수 있어요."
        )


# ── 직렬화 ──────────────────────────────────────────────────────────────


def _num(v) -> float | None:
    return float(v) if v is not None else None


def serialize(store: PartnersStore, *, admin: bool = False) -> dict:
    out = dict(
        id=str(store.id),
        mediaId=store.media_id,
        name=store.name,
        address=store.address,
        addressDetail=store.address_detail,
        city=store.city,
        district=store.district,
        latitude=_num(store.latitude),
        longitude=_num(store.longitude),
        imageUrls=list(store.image_urls or []),
        phone=store.phone,
        ownerName=store.owner_name,
        tags=list(store.tags or []),
        businessHours=store.business_hours,
        status=store.status,
        createdAt=store.created_at.isoformat() if store.created_at else None,
        updatedAt=store.updated_at.isoformat() if store.updated_at else None,
    )
    if admin:
        owner = store.owner
        out.update(
            adminMemo=store.admin_memo,
            ownerUserId=str(store.owner_user_id) if store.owner_user_id else None,
            ownerLoginId=owner.login_id if owner else None,
            ownerMemberName=owner.name if owner else None,
            ownerCompanyName=owner.company_name if owner else None,
            ownerBizStatus=(
                owner.business_registration.status
                if owner and owner.business_registration
                else "unregistered"
            )
            if owner
            else None,
        )
    return out


# ── 값 정리 ─────────────────────────────────────────────────────────────


def _clean_tags(tags) -> list[str]:
    if tags is None:
        return []
    out: list[str] = []
    for t in tags:
        t = str(t).strip().lstrip("#").strip()
        if t and t not in out:
            out.append(t[:20])
    if len(out) > MAX_TAGS:
        raise HTTPException(status_code=400, detail=f"매장 어필은 최대 {MAX_TAGS}개까지 고를 수 있어요.")
    return out


def _clean_images(urls) -> list[str]:
    out = [str(u).strip() for u in (urls or []) if str(u).strip()]
    out = list(dict.fromkeys(out))
    if len(out) > MAX_IMAGES:
        raise HTTPException(status_code=400, detail=f"매장 사진은 최대 {MAX_IMAGES}장까지 올릴 수 있어요.")
    return out


def _apply(store: PartnersStore, data: dict, *, admin: bool) -> None:
    """요청 값을 매장에 옮긴다. 주소가 바뀌면 좌표를 다시 찾는다."""
    prev_address = store.address
    for key in _FIELDS:
        if key in data:
            v = data[key]
            v = v.strip() if isinstance(v, str) else v
            setattr(store, key, v or None)
    if "tags" in data:
        store.tags = _clean_tags(data["tags"])
    if "image_urls" in data:
        store.image_urls = _clean_images(data["image_urls"])
    if admin:
        if "status" in data and data["status"] in ("active", "hidden"):
            store.status = data["status"]
        if "admin_memo" in data:
            store.admin_memo = (data["admin_memo"] or "").strip() or None

    if not (store.name or "").strip():
        raise HTTPException(status_code=400, detail="매장명을 입력해 주세요.")
    if not (store.address or "").strip():
        raise HTTPException(status_code=400, detail="매장 주소를 입력해 주세요.")
    # 매장 사진은 선택 — 없으면 매체 찾기 카드도 사진 없이 보인다.

    lat, lng = data.get("latitude"), data.get("longitude")
    if lat is not None and lng is not None:
        store.latitude, store.longitude = Decimal(str(lat)), Decimal(str(lng))
        if store.address != prev_address or not store.city:
            _fill_region(store, with_coords=False)
    elif store.address != prev_address or store.latitude is None:
        _fill_region(store, with_coords=True)


def _fill_region(store: PartnersStore, *, with_coords: bool) -> None:
    """카카오 주소 검색으로 시도·구군(+좌표)을 채운다. 못 찾아도 저장은 막지 않는다(좌표 없으면 지도에 안 보임)."""
    try:
        found = kakao_address.lookup(store.address)
    except kakao_address.AddressLookupError as exc:
        log.warning("콜라보 매장 주소 좌표 찾기 실패(%s): %s", store.address, exc)
        if with_coords:
            store.latitude = store.longitude = None
        return
    store.city = found.get("city") or store.city
    store.district = found.get("district") or store.district
    if with_coords:
        lat, lng = found.get("latitude"), found.get("longitude")
        store.latitude = Decimal(str(lat)) if lat is not None else None
        store.longitude = Decimal(str(lng)) if lng is not None else None


def geocode(address: str) -> dict:
    """어드민 폼 "좌표 자동 입력" — 주소 → 위도·경도·시도·구군."""
    try:
        found = kakao_address.lookup(address)
    except kakao_address.AddressLookupError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None
    return dict(
        latitude=found.get("latitude"),
        longitude=found.get("longitude"),
        city=found.get("city"),
        district=found.get("district"),
    )


# ── 매체 찾기 연동(media 줄) ───────────────────────────────────────────


def sync_media(db: Session, store: PartnersStore) -> None:
    """매장 값을 매체 찾기용 media 줄에 맞춘다. 커밋은 부르는 쪽에서."""
    visible = store.status == "active" and store.latitude is not None and store.longitude is not None
    m = db.get(Media, store.media_id) if store.media_id else None
    if not visible:
        if m is not None:
            store.media_id = None
            db.flush()
            db.delete(m)
        return
    if m is None:
        m = Media(media_id=ms._next_media_id(db, PARTNERS_MEDIA_CATEGORY))
        db.add(m)
        db.flush()
        store.media_id = m.media_id
    m.name = store.name
    m.second_name = None
    m.category_large = PARTNERS_MEDIA_CATEGORY
    m.category_small = PARTNERS_MEDIA_SMALL
    m.media_source = "FIXED"
    m.address = store.address
    m.accurate_address = store.address
    m.address_detail = store.address_detail
    m.city = store.city
    m.district = store.district
    m.latitude = store.latitude
    m.longitude = store.longitude
    m.description = " ".join(f"#{t}" for t in (store.tags or [])) or None
    urls = list(store.image_urls or [])
    m.thumbnail_url = urls[0] if urls else None
    m.image_count = len(urls)
    db.query(MediaImage).filter(MediaImage.media_id == m.media_id).delete(synchronize_session=False)
    for i, url in enumerate(urls):
        db.add(MediaImage(media_id=m.media_id, image_url=url, sort_order=i, is_thumbnail=i == 0))
    db.flush()
    db.expire(m, ["images"])


def _delete_store(db: Session, store: PartnersStore) -> None:
    m = db.get(Media, store.media_id) if store.media_id else None
    store.media_id = None
    db.flush()
    if m is not None:
        db.delete(m)
    db.delete(store)


# ── 사진 올리기 ────────────────────────────────────────────────────────


def upload_image(file: UploadFile, folder: str = "cafe") -> str:
    """사진 한 장을 S3(로컬은 upload_dir)에 올리고 주소를 돌려준다 — 매체 사진과 같은 규칙(10MB·줄이기).
    folder — 매장 사진은 cafe, 광고주 브랜드 사진은 brand."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ms._MEDIA_IMAGE_EXTS:
        raise HTTPException(status_code=400, detail="JPG·PNG·WEBP·GIF 이미지만 올릴 수 있어요.")
    content = file.file.read(ms._MEDIA_IMAGE_MAX_BYTES + 1)
    if len(content) > ms._MEDIA_IMAGE_MAX_BYTES:
        raise HTTPException(status_code=400, detail="사진은 한 장에 10MB 이하만 올릴 수 있어요.")
    content = ms.shrink_media_image(content, ext)
    settings = get_settings()
    key = f"{folder}/{uuid.uuid4().hex}{ext}"
    if settings.media_image_storage == "local":
        dest = Path(settings.upload_dir) / key
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(content)
        return f"/uploads/{key}"
    ms._s3_client().put_object(
        Bucket=settings.s3_bucket,
        Key=key,
        Body=content,
        ContentType=ms._MEDIA_IMAGE_CONTENT_TYPES.get(ext, "application/octet-stream"),
    )
    return ms._s3_public_url(settings.s3_bucket, settings.aws_region, key)


# ── 조회 ────────────────────────────────────────────────────────────────


def _get_or_404(db: Session, key: str) -> PartnersStore:
    """매장 id(UUID) 또는 매체 찾기 media_id(CF-0001)로 찾는다."""
    store = None
    try:
        store = db.get(PartnersStore, uuid.UUID(key))
    except ValueError:
        store = db.query(PartnersStore).filter(PartnersStore.media_id == key).first()
    if store is None:
        raise HTTPException(status_code=404, detail="매장을 찾을 수 없어요.")
    return store


def _keyword_filter(q, keyword: str | None):
    kw = (keyword or "").strip()
    if not kw:
        return q
    like = f"%{kw}%"
    return q.filter(
        or_(
            PartnersStore.name.ilike(like),
            PartnersStore.address.ilike(like),
            PartnersStore.district.ilike(like),
            PartnersStore.tags.cast(String).ilike(like),
        )
    )


def list_public(db: Session, *, keyword: str | None = None, city: str | None = None) -> list[dict]:
    """광고주 콜라보 대시보드 — 공개 매장(최근 등록 순)."""
    q = db.query(PartnersStore).filter(PartnersStore.status == "active")
    q = _keyword_filter(q, keyword)
    if city:
        q = q.filter(PartnersStore.city == city)
    return [serialize(s) for s in q.order_by(PartnersStore.created_at.desc()).all()]


def get_public(db: Session, key: str, user: User) -> dict:
    store = _get_or_404(db, key)
    # 숨긴 매장은 주인만 본다.
    if store.status != "active" and store.owner_user_id != user.id:
        raise HTTPException(status_code=404, detail="매장을 찾을 수 없어요.")
    out = serialize(store)
    out["isMine"] = store.owner_user_id == user.id
    return out


# ── 제휴사 본인 매장 ───────────────────────────────────────────────────


def list_mine(db: Session, user: User) -> list[dict]:
    ensure_partner(user)
    rows = (
        db.query(PartnersStore)
        .filter(PartnersStore.owner_user_id == user.id)
        .order_by(PartnersStore.created_at)
        .all()
    )
    return [serialize(s) for s in rows]


ONE_STORE_DETAIL = "매장은 한 회원당 한 곳만 등록할 수 있어요."


def _ensure_no_other_store(db: Session, owner_id: uuid.UUID | None, *, except_id=None) -> None:
    """매장은 1인 1개 — 이 회원이 (except_id 말고) 이미 가진 매장이 있으면 막는다."""
    if owner_id is None:
        return
    q = db.query(PartnersStore.id).filter(PartnersStore.owner_user_id == owner_id)
    if except_id is not None:
        q = q.filter(PartnersStore.id != except_id)
    if q.first() is not None:
        raise HTTPException(status_code=409, detail=ONE_STORE_DETAIL)


def create_mine(db: Session, user: User, data: dict) -> dict:
    ensure_can_register(user)
    _ensure_no_other_store(db, user.id)
    store = PartnersStore(owner_user_id=user.id, status="active", image_urls=[], tags=[])
    _apply(store, data, admin=False)
    db.add(store)
    db.flush()
    sync_media(db, store)
    db.commit()
    db.refresh(store)
    return serialize(store)


def _own_or_404(db: Session, user: User, store_id: str) -> PartnersStore:
    ensure_partner(user)
    store = _get_or_404(db, store_id)
    if store.owner_user_id != user.id:
        raise HTTPException(status_code=404, detail="매장을 찾을 수 없어요.")
    return store


def update_mine(db: Session, user: User, store_id: str, data: dict) -> dict:
    store = _own_or_404(db, user, store_id)
    _apply(store, data, admin=False)
    sync_media(db, store)
    db.commit()
    db.refresh(store)
    return serialize(store)


def delete_mine(db: Session, user: User, store_id: str) -> None:
    store = _own_or_404(db, user, store_id)
    _delete_store(db, store)
    db.commit()


# ── 어드민 ─────────────────────────────────────────────────────────────


def admin_list(
    db: Session,
    *,
    keyword: str | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[int, list[dict]]:
    q = db.query(PartnersStore)
    q = _keyword_filter(q, keyword)
    if status in ("active", "hidden"):
        q = q.filter(PartnersStore.status == status)
    total = q.count()
    rows = (
        q.order_by(PartnersStore.created_at.desc())
        .offset((max(page, 1) - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return total, [serialize(s, admin=True) for s in rows]


def admin_get(db: Session, store_id: str) -> dict:
    return serialize(_get_or_404(db, store_id), admin=True)


def _owner_by_login(db: Session, login_id: str | None) -> uuid.UUID | None:
    login_id = (login_id or "").strip()
    if not login_id:
        return None
    user = db.query(User).filter(User.login_id == login_id).first()
    if user is None:
        raise HTTPException(status_code=400, detail=f"회원을 찾지 못했어요: {login_id}")
    if user.member_category != "partner":
        raise HTTPException(status_code=400, detail="제휴사(콜라보) 회원만 매장 주인으로 연결할 수 있어요.")
    return user.id


def admin_create(db: Session, data: dict) -> dict:
    store = PartnersStore(status="active", image_urls=[], tags=[])
    store.owner_user_id = _owner_by_login(db, data.get("owner_login_id"))
    _ensure_no_other_store(db, store.owner_user_id)
    _apply(store, data, admin=True)
    db.add(store)
    db.flush()
    sync_media(db, store)
    db.commit()
    db.refresh(store)
    return serialize(store, admin=True)


def admin_update(db: Session, store_id: str, data: dict) -> dict:
    store = _get_or_404(db, store_id)
    if "owner_login_id" in data:
        store.owner_user_id = _owner_by_login(db, data.get("owner_login_id"))
        _ensure_no_other_store(db, store.owner_user_id, except_id=store.id)
    _apply(store, data, admin=True)
    sync_media(db, store)
    db.commit()
    db.refresh(store)
    return serialize(store, admin=True)


def admin_delete(db: Session, store_id: str) -> None:
    _delete_store(db, _get_or_404(db, store_id))
    db.commit()
