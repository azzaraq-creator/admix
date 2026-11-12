"""제휴사(콜라보) 매장 — /partners 대시보드(제휴사 보기 · 광고주 찾아보기)와 어드민 "콜라보" 매장 · 회원 · 수정 요청.

- 매장 등록 · 수정은 admix 담당자가 어드민에서만 한다(069). 제휴사 회원은 고유번호(P-0001)로 매장(S-0001)과 이어지고,
  한 회원이 매장 여러 곳을 가질 수 있다. 제휴사는 내 매장에서 보기만 하고, 고칠 곳은 "수정 요청"으로 보낸다.
- 기본협약 동의 전에 사업자등록증을 올려야 한다(검토 대기도 됨). 등록증이 없으면 담당자가 어드민에서 "임시 승인"해
  그 자리에서 다음 단계로 넘어가게 한다(status=provisional).
- 주소를 저장하면 카카오 주소 검색으로 위도·경도·시도·구군을 채운다(좌표를 직접 넘기면 그 값).
- 공개(active)이고 좌표가 있는 매장은 media 표에 "콜라보" 줄을 함께 두어 매체 찾기 지도·목록에 보인다.
  숨기거나 지우면 그 줄도 지운다. 이 줄은 AI 추천(검색 표)·어드민 매체 관리에서 빠진다.
"""
from __future__ import annotations

import base64
import binascii
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

from fastapi import HTTPException, UploadFile
from sqlalchemy import Integer, String, case, cast, func, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from src.config import get_settings
from src.models.partners_store import (
    PARTNERS_MEDIA_CATEGORY,
    PartnersStore,
    PartnersStoreRequest,
    PartnersStoreType,
)
from src.models.media_image import MediaImage
from src.models.media_master import Media
from src.models.member_profile import BusinessRegistration
from src.models.user import User
from src.services import kakao_address
from src.services import media_service as ms

log = logging.getLogger(__name__)

# 매장 사진 — 장수 제한 없음(2026-11-12 사용자, 예전 30장), 긴 변 2000px로 줄여 둔다(어드민에서만 올린다, 069).
IMAGE_MAX_SIDE = 2000
# 사진 분류 — 화면(frontend/lib/partners.ts PHOTO_KINDS)과 같은 순서 · 값. 분류마다 대표 사진이 하나씩 있고,
# 대표 사진은 매체 찾기 · 광고주 매장 카드에, 나머지는 매장 상세에서 보인다(2026-11-10 사용자).
# DP 가능 공간 · 프로모션 공간은 2026-11-12 사용자 추가.
PHOTO_KINDS = ("exterior", "interior", "counter", "dp_space", "promo_space", "menu", "etc")
DEFAULT_PHOTO_KIND = "etc"
# 어드민에서만 보는 분류 — 광고주 · 제휴사 화면과 매체 찾기에는 내보내지 않는다(메뉴, 2026-11-12 사용자).
ADMIN_ONLY_PHOTO_KINDS = frozenset({"menu"})
# 예전 분류(좌석 · 화장실, ~11-10)는 내관으로 본다 — 073 이 저장된 값도 바꿨다.
_LEGACY_PHOTO_KIND = {"seat": "interior", "restroom": "interior"}
PHOTO_MEMO_MAX_LEN = 50
# 운영 시간(073) — 요일 구분 · 휴무일. 화면 frontend/lib/partners.ts HOURS_DAYS · CLOSED_DAYS 와 같다.
HOURS_DAYS = {"daily": "매일", "weekday": "평일", "weekend": "주말(공휴일)"}
CLOSED_DAYS = {
    "mon": "월요일",
    "tue": "화요일",
    "wed": "수요일",
    "thu": "목요일",
    "fri": "금요일",
    "sat": "토요일",
    "sun": "일요일",
    "holiday": "공휴일",
}
MAX_HOURS_SLOTS = 2
# 매장 어필 — 개수 제한 없음(2026-11-09 사용자). 카드에서는 3개까지 보이고 나머지는 "+N"(화면 쪽).
# 조건 메모 — 개수 제한은 없고, 한 줄 길이만 막는다(잘못 붙여 넣은 긴 글).
NOTE_MAX_LEN = 60
PARTNERS_MEDIA_SMALL = "매장"
# 기본협약에 동의할 수 있는 사업자 등록 상태 — 올리기만 해도(검토 대기) 되고, 어드민 임시 승인도 된다.
AGREEABLE_BIZ_STATUS = {"reviewing", "verified", "provisional"}
# 회원 · 매장 고유번호 머리 — P-0001(제휴사 회원), S-0001(매장). 매장은 한 글자 — 매체 ID 머리(정류장 ST 등)는
# 모두 두 글자라 겹쳐 보이지 않게(2026-11-10 사용자, 예전 ST-0001).
PARTNER_CODE_PREFIX = "P"
STORE_CODE_PREFIX = "S"
# 콜라보 메뉴·매장 상세를 볼 수 있는 회원 유형.
PARTNERS_VIEWER_CATEGORIES = {"advertiser", "partner"}
# 콜라보 등급 — S · A · B · C(기준은 아직 정하지 않았다, 화면 frontend/lib/partners.ts 와 같다).
COLLAB_GRADES = ("S", "A", "B", "C")
# 매장별 금액 상한(1건, 원) — 잘못 친 값(0 하나 더)을 막는 정도.
MAX_COLLAB_FEE = 100_000_000
# 등급 점수 항목과 만점(비중, 합쳐 100점, 2026-11-10 사용자) — sales 매출(작년 1년 또는 최근 3개월 영수증 수량) ·
# seats 규모(좌석 수) · collab 공간 활용(협업 방식). 항목마다 점수와 이유 · 값 메모. 화면 frontend/lib/partners.ts 와 같다(077).
GRADE_CRITERIA = {"sales": 50, "seats": 20, "collab": 30}
GRADE_MEMO_MAX_LEN = 300

# 매장 어필 한 개 길이(인스타그램 해시태그처럼 짧게). 선택지는 매장 유형마다 어드민 "매장 유형 관리"에서 정한다(070).
TAG_MAX_LEN = 20
# 매장 유형 — 이름 길이, 유형 하나에 둘 수 있는 칩 · 조건 값 개수(잘못 붙여 넣은 긴 목록을 막는 정도).
STORE_TYPE_NAME_MAX = 20
STORE_TYPE_VALUES_MAX = 100

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


def _next_code(db: Session, column, prefix: str) -> str:
    """머리별 다음 일련번호(P-0001 · S-0001) — 같은 머리의 가장 큰 번호 + 1."""
    pattern = f"^{prefix}-[0-9]{{4,}}$"
    last = (
        db.query(func.max(cast(func.substring(column, len(prefix) + 2), Integer)))
        .filter(column.op("~")(pattern))
        .scalar()
    )
    return f"{prefix}-{(last or 0) + 1:04d}"


def normalize_store_code(raw: str | None) -> str:
    """매장 ID 입력 다듬기 — s1 · 0001 · S0001 → S-0001(화면 lib/adminCollab normalizeCode 와 같은 규칙)."""
    code = (raw or "").strip().upper().replace(" ", "")
    digits = code.removeprefix(f"{STORE_CODE_PREFIX}-").removeprefix(STORE_CODE_PREFIX)
    return f"{STORE_CODE_PREFIX}-{int(digits):04d}" if digits.isdigit() else code


def ensure_partner_code(db: Session, user: User) -> str | None:
    """제휴사 회원 고유번호 — 없으면 새로 매긴다(가입 직후 /auth/me 에서). 제휴사가 아니면 None."""
    if user.member_category != "partner":
        return None
    if not user.partner_code:
        user.partner_code = _next_code(db, User.partner_code, PARTNER_CODE_PREFIX)
        db.commit()
        db.refresh(user)
    return user.partner_code


# 기본협약 서명자 구분 — 화면의 대표자 · 위임받은 담당자(agreementShared ROLE_LABEL).
SIGNER_ROLES = ("representative", "delegate")
SIGNER_NAME_MAX_LEN = 50
# 서명 그림 — 화면이 보내는 PNG(data URL). 손 서명 한 장이면 수십 KB라 넉넉히 1MB까지.
SIGNATURE_MAX_BYTES = 1024 * 1024
_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def _save_signature(user: User, data_url: str) -> str:
    """서명 그림 저장 — "data:image/png;base64,…" 를 풀어 PNG 인지 보고 upload_dir/partner-signature/{회원 id}/ 에 둔다."""
    prefix = "data:image/png;base64,"
    if not isinstance(data_url, str) or not data_url.startswith(prefix):
        raise HTTPException(status_code=400, detail="서명을 다시 해 주세요.")
    try:
        content = base64.b64decode(data_url[len(prefix):], validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="서명을 다시 해 주세요.")
    if not content.startswith(_PNG_MAGIC) or len(content) > SIGNATURE_MAX_BYTES:
        raise HTTPException(status_code=400, detail="서명을 다시 해 주세요.")
    dest_dir = Path(get_settings().upload_dir) / "partner-signature" / str(user.id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}.png"
    (dest_dir / stored_name).write_bytes(content)
    return f"/uploads/partner-signature/{user.id}/{stored_name}"


def agreement_record(user: User) -> dict:
    return {
        "agreedAt": user.partner_agreed_at.isoformat() if user.partner_agreed_at else None,
        "version": user.partner_agreement_version,
        "signerName": user.partner_signer_name,
        "signerRole": user.partner_signer_role,
        "signatureUrl": user.partner_signature_url,
    }


def agree(
    db: Session,
    user: User,
    version: str,
    signer_name: str,
    signer_role: str,
    signature: str,
    ip: str | None = None,
) -> dict:
    """기본협약 최종 동의 기록 — 처음 동의한 시각 · 서명(이름 · 구분 · 손 서명 그림 · IP)을 남기고, 다시 눌러도 바꾸지 않는다(078).
    사업자등록증을 올렸거나(검토 대기 · 인증) 담당자가 임시 승인했어야 한다."""
    ensure_partner(user)
    if user.partner_agreed_at is None:
        reg = user.business_registration
        if not reg or reg.status not in AGREEABLE_BIZ_STATUS:
            raise HTTPException(
                status_code=400,
                detail="사업자등록증을 먼저 올려 주세요. 담당자가 함께 있다면 임시 승인을 요청해 주세요.",
            )
        name = (signer_name or "").strip()
        if not name or len(name) > SIGNER_NAME_MAX_LEN:
            raise HTTPException(status_code=400, detail="서명자 이름을 적어 주세요.")
        if signer_role not in SIGNER_ROLES:
            raise HTTPException(status_code=400, detail="서명자 구분을 골라 주세요.")
        user.partner_signature_url = _save_signature(user, signature)
        user.partner_signer_name = name
        user.partner_signer_role = signer_role
        user.partner_signed_ip = (ip or "")[:64] or None
        user.partner_agreed_at = datetime.now(timezone.utc)
        user.partner_agreement_version = version
        # 진행 상태(서명자 구분 등)는 남겨 둔다 — 동의 뒤 협약 화면을 다시 열 때 그대로 보여 준다.
        db.commit()
        db.refresh(user)
    return agreement_record(user)


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


# ── 직렬화 ──────────────────────────────────────────────────────────────


def _num(v) -> float | None:
    return float(v) if v is not None else None


def _photo_kind(kind: str | None) -> str:
    k = _LEGACY_PHOTO_KIND.get(kind or "", kind or "")
    return k if k in PHOTO_KINDS else DEFAULT_PHOTO_KIND


def images_of(store: PartnersStore, *, admin: bool = False) -> list[dict]:
    """사진 — [{url, kind, cover, memo, uploadedAt}] (image_urls 순서). cover 는 분류마다 먼저 나오는 한 장(대표).
    memo 는 광고주 매장 상세에서 사진 설명으로 보인다(2026-11-10 사용자). uploadedAt 은 올린 때(어드민 폼 메모 아래, 075).
    admin 이 아니면 어드민 전용 분류(메뉴)는 뺀다."""
    kinds = store.image_kinds or {}
    memos = store.image_memos or {}
    dates = store.image_dates or {}
    seen: set[str] = set()
    out: list[dict] = []
    for u in store.image_urls or []:
        kind = _photo_kind(kinds.get(u))
        if not admin and kind in ADMIN_ONLY_PHOTO_KINDS:
            continue
        out.append(
            {
                "url": u,
                "kind": kind,
                "cover": kind not in seen,
                "memo": memos.get(u) or "",
                "uploadedAt": dates.get(u),
            }
        )
        seen.add(kind)
    return out


def cover_urls(store: PartnersStore) -> list[str]:
    """분류별 대표 사진(분류 순) — 매체 찾기 · 광고주 매장 카드에 보인다. 어드민 전용 분류(메뉴)는 빠진다."""
    covers = {p["kind"]: p["url"] for p in images_of(store) if p["cover"]}
    return [covers[k] for k in PHOTO_KINDS if k in covers]


def photo_kind_map(image_urls: list[str] | None, image_kinds: dict | None) -> dict[str, str]:
    """사진 주소 → 분류(어드민 전용 분류는 뺀다) — 매체 찾기 · 광고주 매장 카드가 사진마다 분류를 적는다(11-12 사용자)."""
    kinds = image_kinds or {}
    out: dict[str, str] = {}
    for u in image_urls or []:
        kind = _photo_kind(kinds.get(u))
        if kind not in ADMIN_ONLY_PHOTO_KINDS:
            out[u] = kind
    return out


def serialize(store: PartnersStore, *, admin: bool = False, pricing: bool = False) -> dict:
    """pricing — 콜라보 등급·금액을 넣는다(광고주 · 어드민만, 매장 쪽에는 보이지 않는다).
    admin 이 아니면 어드민 전용 분류(메뉴) 사진은 imageUrls · images 둘 다에서 뺀다."""
    images = images_of(store, admin=admin)
    out = dict(
        id=str(store.id),
        storeCode=store.store_code,
        mediaId=store.media_id,
        name=store.name,
        storeTypeId=store.store_type_id,
        storeType=store.store_type.name if store.store_type else None,
        address=store.address,
        addressDetail=store.address_detail,
        city=store.city,
        district=store.district,
        latitude=_num(store.latitude),
        longitude=_num(store.longitude),
        imageUrls=[p["url"] for p in images],
        images=images,
        phone=store.phone,
        ownerName=store.owner_name,
        tags=list(store.tags or []),
        notes=list(store.notes or []),
        businessHours=store.business_hours,
        hours=store.hours,
        status=store.status,
        createdAt=store.created_at.isoformat() if store.created_at else None,
        updatedAt=store.updated_at.isoformat() if store.updated_at else None,
    )
    if admin or pricing:
        out.update(collabGrade=store.collab_grade, collabFee=store.collab_fee)
    if admin:
        owner = store.owner
        out.update(
            adminMemo=store.admin_memo,
            gradeScores=dict(store.grade_scores or {}),
            ownerUserId=str(store.owner_user_id) if store.owner_user_id else None,
            ownerLoginId=owner.login_id if owner else None,
            ownerPartnerCode=owner.partner_code if owner else None,
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
            out.append(t[:TAG_MAX_LEN])
    return out


def _clean_images(urls) -> list[str]:
    out = [str(u).strip() for u in (urls or []) if str(u).strip()]
    return list(dict.fromkeys(out))


def _clean_photo_set(images) -> tuple[list[str], dict[str, str], dict[str, str]]:
    """[{url, kind, cover, memo}] → (사진 주소 순서, 주소 → 분류, 주소 → 메모). 모르는 분류는 기타.
    순서는 분류 순(외관 → 기타)이고, 분류 안에서는 대표(cover)가 맨 앞 — 분류마다 첫 장이 대표다."""
    items: list[tuple[str, str, bool, str, int]] = []
    seen: set[str] = set()
    for i, it in enumerate(images or []):
        it = it or {}
        url = str(it.get("url") or "").strip()
        if not url or url in seen:
            continue
        seen.add(url)
        memo = " ".join(str(it.get("memo") or "").split())
        if len(memo) > PHOTO_MEMO_MAX_LEN:
            raise HTTPException(status_code=400, detail=f"사진 메모는 {PHOTO_MEMO_MAX_LEN}자까지 쓸 수 있어요.")
        items.append((url, _photo_kind(str(it.get("kind") or "").strip()), bool(it.get("cover")), memo, i))
    items.sort(key=lambda x: (PHOTO_KINDS.index(x[1]), not x[2], x[4]))
    urls = _clean_images([x[0] for x in items])
    return urls, {x[0]: x[1] for x in items}, {x[0]: x[3] for x in items if x[3]}


def _clean_grade_scores(value) -> dict:
    """등급 점수 {항목: {score, memo}} — 모르는 항목은 버리고, 점수는 0 ~ 만점(소수 첫째 자리까지), 둘 다 비면 그 항목은 뺀다."""
    out: dict = {}
    for key, item in (value or {}).items():
        if key not in GRADE_CRITERIA or not isinstance(item, dict):
            continue
        score = item.get("score")
        if score is not None:
            try:
                score = round(float(score), 1)
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="등급 점수는 숫자로 적어 주세요.") from None
            if not 0 <= score <= GRADE_CRITERIA[key]:
                raise HTTPException(
                    status_code=400, detail=f"등급 점수는 0 ~ {GRADE_CRITERIA[key]}점으로 적어 주세요."
                )
            score = int(score) if score.is_integer() else score
        memo = str(item.get("memo") or "").strip()
        if len(memo) > GRADE_MEMO_MAX_LEN:
            raise HTTPException(status_code=400, detail=f"등급 점수 메모는 {GRADE_MEMO_MAX_LEN}자까지 쓸 수 있어요.")
        if score is not None or memo:
            out[key] = {"score": score, "memo": memo}
    return out


def _hhmm(value) -> str:
    t = str(value or "").strip()
    parts = t.split(":")
    if len(parts) == 2 and all(p.isdigit() for p in parts):
        h, m = int(parts[0]), int(parts[1])
        if 0 <= h <= 23 and 0 <= m <= 59:
            return f"{h:02d}:{m:02d}"
    raise HTTPException(status_code=400, detail="운영 시간을 다시 확인해 주세요.")


def _clean_hours(raw) -> dict | None:
    """운영 시간 입력값 정리 — 요일 구분(매일 · 평일 · 주말)별 여는 · 닫는 시간 2개까지, 휴무일. 비었으면 None."""
    if not raw:
        return None
    slots: list[dict] = []
    for s in raw.get("slots") or []:
        days = (s or {}).get("days")
        if days not in HOURS_DAYS:
            raise HTTPException(status_code=400, detail="운영 시간의 요일 구분을 다시 골라 주세요.")
        if any(x["days"] == days for x in slots):
            raise HTTPException(status_code=400, detail=f"운영 시간에 '{HOURS_DAYS[days]}'이 두 번 있어요.")
        slots.append({"days": days, "open": _hhmm(s.get("open")), "close": _hhmm(s.get("close"))})
    if len(slots) > MAX_HOURS_SLOTS:
        raise HTTPException(status_code=400, detail=f"운영 시간은 {MAX_HOURS_SLOTS}개까지 넣을 수 있어요.")
    if len(slots) > 1 and any(x["days"] == "daily" for x in slots):
        raise HTTPException(status_code=400, detail="'매일'은 다른 운영 시간과 함께 쓸 수 없어요.")
    picked = set(raw.get("closed") or [])
    if picked - set(CLOSED_DAYS):
        raise HTTPException(status_code=400, detail="휴무일을 다시 골라 주세요.")
    closed = [d for d in CLOSED_DAYS if d in picked]
    if not slots and not closed:
        return None
    return {"slots": slots, "closed": closed}


def hours_text(hours: dict | None) -> str | None:
    """운영 시간 글 — "평일 10:00 ~ 22:00 · 주말(공휴일) 11:00 ~ 21:00 (월요일 휴무)"."""
    if not hours:
        return None
    text = " · ".join(f"{HOURS_DAYS[s['days']]} {s['open']} ~ {s['close']}" for s in hours.get("slots") or [])
    closed = ", ".join(CLOSED_DAYS[d] for d in hours.get("closed") or [] if d in CLOSED_DAYS)
    if closed:
        text = f"{text} ({closed} 휴무)" if text else f"{closed} 휴무"
    return text or None


def _clean_notes(notes) -> list[str]:
    out: list[str] = []
    for n in notes or []:
        n = " ".join(str(n).split())
        if not n or n in out:
            continue
        if len(n) > NOTE_MAX_LEN:
            raise HTTPException(status_code=400, detail=f"조건 메모는 한 줄에 {NOTE_MAX_LEN}자까지 쓸 수 있어요.")
        out.append(n)
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
    if "images" in data:
        store.image_urls, store.image_kinds, store.image_memos = _clean_photo_set(data["images"])
    elif "image_urls" in data:
        store.image_urls = _clean_images(data["image_urls"])
        kinds, memos = store.image_kinds or {}, store.image_memos or {}
        store.image_kinds = {u: kinds.get(u, DEFAULT_PHOTO_KIND) for u in store.image_urls}
        store.image_memos = {u: memos[u] for u in store.image_urls if memos.get(u)}
    if "images" in data or "image_urls" in data:
        # 올린 때 — 이미 있던 사진은 그대로, 처음 보는 주소만 지금 시각(분류 · 메모를 바꿔도 날짜는 그대로).
        dates, now = store.image_dates or {}, datetime.now(timezone.utc).isoformat()
        store.image_dates = {u: dates.get(u) or now for u in store.image_urls}
    if admin:
        if "hours" in data:
            store.hours = _clean_hours(data["hours"])
            store.business_hours = hours_text(store.hours)
        if "notes" in data:
            store.notes = _clean_notes(data["notes"])
        if "status" in data and data["status"] in ("active", "hidden"):
            store.status = data["status"]
        if "admin_memo" in data:
            store.admin_memo = (data["admin_memo"] or "").strip() or None
        if "collab_grade" in data:
            grade = (data["collab_grade"] or "").strip().upper() or None
            if grade is not None and grade not in COLLAB_GRADES:
                raise HTTPException(status_code=400, detail="콜라보 등급은 S · A · B · C 중에서 골라 주세요.")
            store.collab_grade = grade
        if "collab_fee" in data:
            fee = data["collab_fee"]
            if fee is not None and not (0 < int(fee) <= MAX_COLLAB_FEE):
                raise HTTPException(status_code=400, detail="매장 금액을 다시 확인해 주세요.")
            store.collab_fee = int(fee) if fee is not None else None
        if "grade_scores" in data:
            store.grade_scores = _clean_grade_scores(data["grade_scores"])

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
    # 매체 찾기 카드에는 분류별 대표 사진만(분류 순) — 나머지는 매장 상세에서 본다(2026-11-10 사용자).
    urls = cover_urls(store)
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


def upload_image(file: UploadFile, folder: str = "cafe", max_side: int = IMAGE_MAX_SIDE) -> str:
    """사진 한 장을 S3(로컬은 upload_dir)에 올리고 주소를 돌려준다 — 매체 사진과 같은 규칙(10MB), 긴 변 max_side 로 줄인다.
    folder — 매장 사진은 cafe, 광고주 브랜드 사진은 brand, 콜라보 설치 · 점검 사진은 collab."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ms._MEDIA_IMAGE_EXTS:
        raise HTTPException(status_code=400, detail="JPG·PNG·WEBP·GIF 이미지만 올릴 수 있어요.")
    content = file.file.read(ms._MEDIA_IMAGE_MAX_BYTES + 1)
    if len(content) > ms._MEDIA_IMAGE_MAX_BYTES:
        raise HTTPException(status_code=400, detail="사진은 한 장에 10MB 이하만 올릴 수 있어요.")
    content = ms.shrink_media_image(content, ext, max_side=max_side)
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


def _pricing(user: User | None) -> bool:
    """콜라보 등급·금액을 볼 수 있는 회원 — 광고주만(매장끼리는 서로의 금액을 보지 않는다)."""
    return user is not None and user.member_category == "advertiser"


def list_public(
    db: Session, *, keyword: str | None = None, city: str | None = None, user: User | None = None
) -> list[dict]:
    """광고주 콜라보 매장 찾기 — 공개 매장(최근 등록 순). 광고주에게는 등급·금액을 함께 준다.
    제휴사 회원에 연결되지 않은 매장은 뺀다 — 콜라보를 받을 사람이 없다(2026-11-11 사용자)."""
    q = db.query(PartnersStore).filter(
        PartnersStore.status == "active", PartnersStore.owner_user_id.isnot(None)
    )
    q = _keyword_filter(q, keyword)
    if city:
        q = q.filter(PartnersStore.city == city)
    pricing = _pricing(user)
    return [serialize(s, pricing=pricing) for s in q.order_by(PartnersStore.created_at.desc()).all()]


def get_public(db: Session, key: str, user: User) -> dict:
    store = _get_or_404(db, key)
    # 숨긴 매장은 주인만 본다.
    if store.status != "active" and store.owner_user_id != user.id:
        raise HTTPException(status_code=404, detail="매장을 찾을 수 없어요.")
    out = serialize(store, pricing=_pricing(user))
    out["isMine"] = store.owner_user_id == user.id
    return out


# ── 제휴사 본인 매장(보기 · 수정 요청) ──────────────────────────────────


def list_mine(db: Session, user: User) -> list[dict]:
    """내 매장 — 담당자가 연결해 준 매장(먼저 연결한 것이 앞). 숨긴 매장도 주인에게는 보인다."""
    ensure_partner(user)
    rows = (
        db.query(PartnersStore)
        .filter(PartnersStore.owner_user_id == user.id)
        .order_by(PartnersStore.created_at)
        .all()
    )
    return [serialize(s) for s in rows]


def own_store(db: Session, user: User, store_id: str) -> PartnersStore:
    """이 제휴사 회원에게 연결된 매장 — 아니면 404."""
    ensure_partner(user)
    store = _get_or_404(db, store_id)
    if store.owner_user_id != user.id:
        raise HTTPException(status_code=404, detail="매장을 찾을 수 없어요.")
    return store


# 수정 요청 — 제휴사가 내 매장 정보에서 바꿀 항목을 골라 새 값을 보낸다(074). 화면 이름은 프런트 lib/partners 와 같다.
REQUEST_FIELDS = {
    "name": "매장명",
    "address": "주소",
    "hours": "운영 시간",
    "phone": "매장 번호",
    "owner_name": "사장님",
    "tags": "매장 특징",
    "notes": "조건",
}
REQUEST_STATUSES = ("pending", "done", "rejected")
REQUEST_MEMO_MAX_LEN = 500
# 추가 요청 · 문의(11-12) — 위 항목 말고 사진 · 매장 유형 · 콜라보 같은 것도 글로 보낸다. 글은 content 에 두고,
# 반영할 값이 없어 어드민 "처리 완료"는 매장을 바꾸지 않는다(답은 admin_reply). 확인 중이어도 보낼 때마다 따로 쌓인다.
INQUIRY_FIELD = "inquiry"
INQUIRY_LABEL = "추가 요청 · 문의"
INQUIRY_MAX_LEN = 1000


def _short_text(v, *, max_len: int) -> str | None:
    t = " ".join(str(v or "").split())
    if len(t) > max_len:
        raise HTTPException(status_code=400, detail=f"{max_len}자까지 쓸 수 있어요.")
    return t or None


def _coord(v) -> float | None:
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def _clean_request_value(field: str, raw):
    """요청한 새 값 정리 — 매장명 · 주소는 비울 수 없고, 나머지는 비우기(지우기) 요청도 된다."""
    if field == "name":
        v = _short_text(raw, max_len=200)
        if not v:
            raise HTTPException(status_code=400, detail="매장명을 적어 주세요.")
        return v
    if field == "address":
        raw = raw if isinstance(raw, dict) else {}
        address = _short_text(raw.get("address"), max_len=500)
        if not address:
            raise HTTPException(status_code=400, detail="주소를 검색해 주세요.")
        lat, lng = _coord(raw.get("latitude")), _coord(raw.get("longitude"))
        if lat is None or lng is None or not (-90 <= lat <= 90 and -180 <= lng <= 180):
            lat = lng = None  # 반영할 때 서버가 주소로 다시 찾는다
        return dict(
            address=address,
            address_detail=_short_text(raw.get("address_detail"), max_len=200),
            city=_short_text(raw.get("city"), max_len=100),
            district=_short_text(raw.get("district"), max_len=100),
            latitude=lat,
            longitude=lng,
        )
    if field == "hours":
        return _clean_hours(raw if isinstance(raw, dict) else None)
    if field == "phone":
        return _short_text(raw, max_len=30)
    if field == "owner_name":
        return _short_text(raw, max_len=100)
    if field == "tags":
        return _clean_tags(raw if isinstance(raw, list) else [])
    if field == "notes":
        return _clean_notes(raw if isinstance(raw, list) else [])
    raise HTTPException(status_code=400, detail="바꿀 항목을 골라 주세요.")


def _value_text(field: str, value) -> str | None:
    """요청 값 → 화면 글. 비었으면 None(화면엔 "비움")."""
    if value in (None, "", [], {}):
        return None
    if field == "address":
        return " ".join(x for x in (value.get("address"), value.get("address_detail")) if x) or None
    if field == "hours":
        return hours_text(value)
    if field in ("tags", "notes"):
        return ", ".join(value) or None
    return str(value)


def _store_text(store: PartnersStore, field: str) -> str | None:
    """지금 매장 값 → 화면 글(내 매장 정보에 보이는 그대로)."""
    if field == "name":
        return store.name
    if field == "address":
        return _value_text("address", {"address": store.address, "address_detail": store.address_detail})
    if field == "hours":
        return store.business_hours or None  # 예전에 글로만 적은 운영 시간도 그대로
    if field == "phone":
        return store.phone or None
    if field == "owner_name":
        return store.owner_name or None
    if field in ("tags", "notes"):
        return _value_text(field, list(getattr(store, field) or []))
    return None


def _apply_data(field: str, value) -> dict:
    """요청 값 → 어드민 매장 수정(_apply) 값."""
    if field == "address":
        # 상세 주소는 비우기도 반영하고, 시도 · 구군 · 좌표는 비었으면 그대로 두었다가 서버가 주소로 찾는다.
        return {k: v for k, v in (value or {}).items() if v is not None or k == "address_detail"}
    return {field: value}


def serialize_request(r: PartnersStoreRequest, *, admin: bool = False) -> dict:
    # 글로 보낸 요청 — 추가 요청 · 문의와 예전 자유 입력(field 없음). 글이 곧 요청이라 after 로 보낸다.
    free = r.field is None or r.field == INQUIRY_FIELD
    out = dict(
        id=str(r.id),
        storeId=str(r.store_id),
        field=r.field,
        fieldLabel=INQUIRY_LABEL if r.field == INQUIRY_FIELD else REQUEST_FIELDS.get(r.field or "", "기타"),
        before=r.before_text,
        after=r.content if free else r.after_text,
        value=r.after_value,
        memo=None if free else r.content,
        status=r.status,
        adminReply=r.admin_reply,
        createdAt=r.created_at.isoformat() if r.created_at else None,
        updatedAt=(r.updated_at or r.created_at).isoformat() if (r.updated_at or r.created_at) else None,
        handledAt=r.handled_at.isoformat() if r.handled_at else None,
    )
    if admin:
        store, user = r.store, r.user
        out.update(
            storeName=store.name if store else None,
            storeCode=store.store_code if store else None,
            userId=str(r.user_id) if r.user_id else None,
            userName=user.name if user else None,
            userLoginId=user.login_id if user else None,
            partnerCode=user.partner_code if user else None,
        )
    return out


def create_request(
    db: Session, user: User, store_id: str, field: str, value, memo: str | None = None
) -> dict:
    """내 매장 수정 요청 — 바꿀 항목과 새 값. 같은 항목에 확인 중인 요청이 있으면 그 요청을 새 값으로 바꾼다.
    추가 요청 · 문의(INQUIRY_FIELD)는 value 가 글이고, 보낼 때마다 새 요청이 된다."""
    store = own_store(db, user, store_id)
    if field == INQUIRY_FIELD:
        text = (value if isinstance(value, str) else "").strip()
        if not text:
            raise HTTPException(status_code=400, detail="요청하거나 문의할 내용을 적어 주세요.")
        if len(text) > INQUIRY_MAX_LEN:
            raise HTTPException(status_code=400, detail=f"{INQUIRY_MAX_LEN}자까지 적을 수 있어요.")
        r = PartnersStoreRequest(
            store_id=store.id, user_id=user.id, field=INQUIRY_FIELD, content=text, status="pending"
        )
        db.add(r)
        db.commit()
        db.refresh(r)
        return serialize_request(r)
    if field not in REQUEST_FIELDS:
        raise HTTPException(status_code=400, detail="바꿀 항목을 골라 주세요.")
    value = _clean_request_value(field, value)
    after_text = _value_text(field, value)
    before_text = _store_text(store, field)
    if after_text == before_text:
        raise HTTPException(status_code=400, detail="지금과 같은 값이에요. 바꿀 값을 넣어 주세요.")
    memo = (memo or "").strip() or None
    if memo and len(memo) > REQUEST_MEMO_MAX_LEN:
        raise HTTPException(status_code=400, detail=f"메모는 {REQUEST_MEMO_MAX_LEN}자까지 적을 수 있어요.")
    r = (
        db.query(PartnersStoreRequest)
        .filter(
            PartnersStoreRequest.store_id == store.id,
            PartnersStoreRequest.field == field,
            PartnersStoreRequest.status == "pending",
        )
        .order_by(PartnersStoreRequest.created_at.desc())
        .first()
    )
    if r is None:
        r = PartnersStoreRequest(store_id=store.id, field=field, status="pending")
        db.add(r)
    r.user_id = user.id
    r.before_text, r.after_text, r.after_value, r.content = before_text, after_text, value, memo
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(r)
    return serialize_request(r)


def list_my_requests(db: Session, user: User, store_id: str) -> list[dict]:
    """내 매장 수정 기록 — 마지막으로 바뀐 순."""
    store = own_store(db, user, store_id)
    rows = (
        db.query(PartnersStoreRequest)
        .filter(PartnersStoreRequest.store_id == store.id)
        .order_by(PartnersStoreRequest.updated_at.desc(), PartnersStoreRequest.created_at.desc())
        .limit(50)
        .all()
    )
    return [serialize_request(r) for r in rows]


# ── 어드민 · 매장 ──────────────────────────────────────────────────────


def admin_list(
    db: Session,
    *,
    keyword: str | None = None,
    status: str | None = None,
    linked: str | None = None,
    store_type: int | None = None,
    grade: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[int, list[dict]]:
    """linked — yes(제휴사와 연결됨) · no(아직 연결 전), 비우면 전체. store_type — 매장 유형 id(비우면 전체).
    grade — 콜라보 등급(S · A · B · C), none 이면 등급 미정, 비우면 전체."""
    q = db.query(PartnersStore).options(joinedload(PartnersStore.owner), joinedload(PartnersStore.store_type))
    kw = (keyword or "").strip()
    if kw:
        like = f"%{kw}%"
        q = q.outerjoin(User, User.id == PartnersStore.owner_user_id).filter(
            or_(
                PartnersStore.name.ilike(like),
                PartnersStore.address.ilike(like),
                PartnersStore.district.ilike(like),
                PartnersStore.store_code.ilike(like),
                PartnersStore.tags.cast(String).ilike(like),
                User.partner_code.ilike(like),
                User.login_id.ilike(like),
                User.name.ilike(like),
            )
        )
    if status in ("active", "hidden"):
        q = q.filter(PartnersStore.status == status)
    if linked == "yes":
        q = q.filter(PartnersStore.owner_user_id.isnot(None))
    elif linked == "no":
        q = q.filter(PartnersStore.owner_user_id.is_(None))
    if store_type is not None:
        q = q.filter(PartnersStore.store_type_id == store_type)
    if grade == "none":
        q = q.filter(PartnersStore.collab_grade.is_(None))
    elif grade in COLLAB_GRADES:
        q = q.filter(PartnersStore.collab_grade == grade)
    total = q.count()
    rows = (
        q.order_by(PartnersStore.created_at.desc())
        .offset((max(page, 1) - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return total, [serialize(s, admin=True) for s in rows]


def admin_get(db: Session, store_id: str) -> dict:
    store = _get_or_404(db, store_id)
    out = serialize(store, admin=True)
    out["requestsPending"] = (
        db.query(func.count(PartnersStoreRequest.id))
        .filter(PartnersStoreRequest.store_id == store.id, PartnersStoreRequest.status == "pending")
        .scalar()
    )
    return out


def partner_by_code(db: Session, code: str | None) -> User | None:
    """제휴사 회원 고유번호(P-0001, 대소문자 · "P0001" · 숫자만도 받는다)로 찾는다."""
    raw = (code or "").strip().upper().replace(" ", "")
    if not raw:
        return None
    digits = raw.removeprefix(f"{PARTNER_CODE_PREFIX}-").removeprefix(PARTNER_CODE_PREFIX)
    if digits.isdigit():
        raw = f"{PARTNER_CODE_PREFIX}-{int(digits):04d}"
    user = db.query(User).filter(User.partner_code == raw).first()
    if user is None or user.member_category != "partner":
        raise HTTPException(status_code=400, detail=f"제휴사 회원을 찾지 못했어요: {code}")
    return user


def _owner_from(db: Session, data: dict) -> tuple[bool, uuid.UUID | None]:
    """연결할 제휴사 — owner_code(고유번호)나 owner_login_id(로그인 아이디). 둘 다 없으면 바꾸지 않는다."""
    if "owner_code" in data:
        user = partner_by_code(db, data.get("owner_code"))
        return True, user.id if user else None
    if "owner_login_id" in data:
        login_id = (data.get("owner_login_id") or "").strip()
        if not login_id:
            return True, None
        user = db.query(User).filter(User.login_id == login_id).first()
        if user is None:
            raise HTTPException(status_code=400, detail=f"회원을 찾지 못했어요: {login_id}")
        if user.member_category != "partner":
            raise HTTPException(status_code=400, detail="제휴사(콜라보) 회원만 매장과 연결할 수 있어요.")
        return True, user.id
    return False, None


def _apply_store_type(db: Session, store: PartnersStore, data: dict) -> None:
    """매장 유형(카페 · 식당 …) — 보낸 때만 바꾼다. null 이면 미지정."""
    if "store_type_id" not in data:
        return
    type_id = data["store_type_id"]
    if type_id is not None and db.get(PartnersStoreType, type_id) is None:
        raise HTTPException(status_code=400, detail="매장 유형을 다시 골라 주세요.")
    store.store_type_id = type_id


def create_store(db: Session, data: dict) -> PartnersStore:
    """새 매장(S-0001 …) — 커밋은 부르는 쪽에서(영업 기록 협업 확정도 같은 묶음으로 저장한다)."""
    store = PartnersStore(status="active", image_urls=[], image_kinds={}, image_memos={}, image_dates={}, tags=[], notes=[])
    store.store_code = _next_code(db, PartnersStore.store_code, STORE_CODE_PREFIX)
    changed, owner_id = _owner_from(db, data)
    if changed:
        store.owner_user_id = owner_id
    _apply_store_type(db, store, data)
    _apply(store, data, admin=True)
    db.add(store)
    db.flush()
    sync_media(db, store)
    return store


def admin_create(db: Session, data: dict) -> dict:
    store = create_store(db, data)
    db.commit()
    db.refresh(store)
    return serialize(store, admin=True)


def admin_update(db: Session, store_id: str, data: dict) -> dict:
    store = _get_or_404(db, store_id)
    changed, owner_id = _owner_from(db, data)
    if changed:
        store.owner_user_id = owner_id
    _apply_store_type(db, store, data)
    _apply(store, data, admin=True)
    sync_media(db, store)
    db.commit()
    db.refresh(store)
    return serialize(store, admin=True)


def admin_delete(db: Session, store_id: str) -> None:
    _delete_store(db, _get_or_404(db, store_id))
    db.commit()


# ── 어드민 · 매장 유형(매장 유형 관리) ───────────────────────────────────────


def _clean_values(values, *, max_len: int, label: str) -> list[str]:
    """칩 · 조건 값 목록 — 앞뒤 공백 · 겹친 값 · 빈 값을 빼고 순서는 그대로."""
    out: list[str] = []
    for v in values or []:
        v = " ".join(str(v).split()).lstrip("#").strip()
        if not v or v in out:
            continue
        if len(v) > max_len:
            raise HTTPException(status_code=400, detail=f"{label}은(는) 한 개에 {max_len}자까지 쓸 수 있어요.")
        out.append(v)
    if len(out) > STORE_TYPE_VALUES_MAX:
        raise HTTPException(status_code=400, detail=f"{label}은(는) {STORE_TYPE_VALUES_MAX}개까지 둘 수 있어요.")
    return out


def serialize_store_type(t: PartnersStoreType, store_count: int = 0) -> dict:
    return dict(
        id=t.id,
        name=t.name,
        sortOrder=t.sort_order,
        tags=list(t.tags or []),
        notes=list(t.notes or []),
        storeCount=store_count,
    )


def list_store_types(db: Session) -> list[dict]:
    """매장 유형 — 순서대로, 유형마다 그 유형인 매장 수(지울 때 안내)."""
    counts = dict(
        db.query(PartnersStore.store_type_id, func.count(PartnersStore.id))
        .filter(PartnersStore.store_type_id.isnot(None))
        .group_by(PartnersStore.store_type_id)
        .all()
    )
    rows = db.query(PartnersStoreType).order_by(PartnersStoreType.sort_order, PartnersStoreType.id).all()
    return [serialize_store_type(t, counts.get(t.id, 0)) for t in rows]


def _store_type_or_404(db: Session, type_id: int) -> PartnersStoreType:
    t = db.get(PartnersStoreType, type_id)
    if t is None:
        raise HTTPException(status_code=404, detail="매장 유형을 찾을 수 없어요.")
    return t


def _apply_type_values(db: Session, t: PartnersStoreType, data: dict) -> None:
    if "name" in data:
        name = " ".join(str(data["name"] or "").split())
        if not name:
            raise HTTPException(status_code=400, detail="유형 이름을 적어 주세요.")
        if len(name) > STORE_TYPE_NAME_MAX:
            raise HTTPException(status_code=400, detail=f"유형 이름은 {STORE_TYPE_NAME_MAX}자까지 쓸 수 있어요.")
        same = db.query(PartnersStoreType).filter(PartnersStoreType.name == name).first()
        if same is not None and same.id != t.id:
            raise HTTPException(status_code=400, detail=f"'{name}' 유형이 이미 있어요.")
        t.name = name
    if "tags" in data:
        t.tags = _clean_values(data["tags"], max_len=TAG_MAX_LEN, label="매장 어필")
    if "notes" in data:
        t.notes = _clean_values(data["notes"], max_len=NOTE_MAX_LEN, label="조건 메모")
    if "sort_order" in data and data["sort_order"] is not None:
        t.sort_order = int(data["sort_order"])


def create_store_type(db: Session, data: dict) -> dict:
    last = db.query(func.max(PartnersStoreType.sort_order)).scalar() or 0
    t = PartnersStoreType(name="", sort_order=last + 1, tags=[], notes=[])
    _apply_type_values(db, t, {"name": data.get("name"), **data})
    db.add(t)
    db.commit()
    db.refresh(t)
    return serialize_store_type(t)


def update_store_type(db: Session, type_id: int, data: dict) -> dict:
    t = _store_type_or_404(db, type_id)
    _apply_type_values(db, t, data)
    db.commit()
    db.refresh(t)
    count = db.query(func.count(PartnersStore.id)).filter(PartnersStore.store_type_id == t.id).scalar() or 0
    return serialize_store_type(t, count)


def delete_store_type(db: Session, type_id: int) -> None:
    """유형을 지우면 그 유형이던 매장은 "미지정"이 된다(매장의 칩 · 조건 값은 그대로)."""
    t = _store_type_or_404(db, type_id)
    db.query(PartnersStore).filter(PartnersStore.store_type_id == t.id).update(
        {PartnersStore.store_type_id: None}, synchronize_session=False
    )
    db.delete(t)
    db.commit()


# ── 어드민 · 수정 요청 ─────────────────────────────────────────────────


def admin_list_requests(
    db: Session, *, status: str | None = None, store_id: str | None = None, page: int = 1, page_size: int = 20
) -> tuple[int, list[dict]]:
    q = db.query(PartnersStoreRequest).options(
        joinedload(PartnersStoreRequest.store), joinedload(PartnersStoreRequest.user)
    )
    if status in REQUEST_STATUSES:
        q = q.filter(PartnersStoreRequest.status == status)
    if store_id:
        q = q.filter(PartnersStoreRequest.store_id == _get_or_404(db, store_id).id)
    total = q.count()
    rows = (
        q.order_by(
            case((PartnersStoreRequest.status == "pending", 0), else_=1),
            PartnersStoreRequest.updated_at.desc(),
        )
        .offset((max(page, 1) - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return total, [serialize_request(r, admin=True) for r in rows]


def admin_update_request(db: Session, request_id: str, data: dict) -> dict:
    """답 저장 · 처리. done 은 요청 값을 매장에 반영한다(반영 전 값을 그때 매장 값으로 다시 적는다).
    rejected 는 사유(admin_reply)가 있어야 한다. 반영한 요청은 되돌리지 않는다(매장 화면에서 고친다)."""
    try:
        r = db.get(PartnersStoreRequest, uuid.UUID(request_id))
    except ValueError:
        r = None
    if r is None:
        raise HTTPException(status_code=404, detail="요청을 찾을 수 없어요.")
    now = datetime.now(timezone.utc)
    if "admin_reply" in data:
        r.admin_reply = (data["admin_reply"] or "").strip() or None
    status = data.get("status")
    if status is not None and status != r.status:
        if status not in REQUEST_STATUSES:
            raise HTTPException(status_code=400, detail="처리 상태를 다시 골라 주세요.")
        if r.status == "done":
            raise HTTPException(status_code=400, detail="이미 반영한 요청이에요. 바꿀 곳은 매장 화면에서 고쳐 주세요.")
        if status == "rejected" and not r.admin_reply:
            raise HTTPException(status_code=400, detail="처리 불가 사유를 적어 주세요.")
        if status == "done" and r.field in REQUEST_FIELDS:
            store = r.store
            if store is None:
                raise HTTPException(status_code=404, detail="매장을 찾을 수 없어요.")
            r.before_text = _store_text(store, r.field)
            _apply(store, _apply_data(r.field, r.after_value), admin=True)
            sync_media(db, store)
        r.status = status
        r.handled_at = now if status in ("done", "rejected") else None
    elif r.status == "rejected" and not r.admin_reply:
        raise HTTPException(status_code=400, detail="처리 불가 사유를 적어 주세요.")
    r.updated_at = now
    db.commit()
    db.refresh(r)
    return serialize_request(r, admin=True)


# ── 어드민 · 제휴사 회원 ───────────────────────────────────────────────

BIZ_ACTIONS = ("provisional", "verify", "reject", "reset")


def _latest_iso(*times: datetime | None) -> str | None:
    """가장 늦은 시각(ISO) — 모두 비었으면 None."""
    found = [t for t in times if t]
    return max(found).isoformat() if found else None


def _member_summary(u: User, stores: list[PartnersStore]) -> dict:
    reg = u.business_registration
    return dict(
        id=str(u.id),
        partnerCode=u.partner_code,
        loginId=u.login_id,
        email=u.email,
        name=u.name,
        phone=u.phone,
        companyName=u.company_name,
        snsProvider=u.sns_provider,
        createdAt=u.created_at.isoformat() if u.created_at else None,
        # 마지막 업데이트 — 회원 정보 · 사업자 등록(올림 · 임시 승인 · 인증) 중 늦은 쪽(어드민 회원 목록, 2026-11-10 사용자).
        updatedAt=_latest_iso(u.updated_at, reg.updated_at if reg else None),
        agreedAt=u.partner_agreed_at.isoformat() if u.partner_agreed_at else None,
        agreementVersion=u.partner_agreement_version,
        # 기본협약 전자 서명(078) — 어드민 회원 상세에 보인다.
        signerName=u.partner_signer_name,
        signerRole=u.partner_signer_role,
        signatureUrl=u.partner_signature_url,
        signedIp=u.partner_signed_ip,
        bizStatus=reg.status if reg else "unregistered",
        bizFileName=reg.license_file_name if reg else None,
        bizUploadedAt=reg.license_uploaded_at.isoformat() if reg and reg.license_uploaded_at else None,
        bizProvisionalAt=reg.provisional_at.isoformat() if reg and reg.provisional_at else None,
        bizVerifiedAt=reg.verified_at.isoformat() if reg and reg.verified_at else None,
        bizRejectReason=reg.reject_reason if reg else None,
        stores=[
            dict(id=str(s.id), storeCode=s.store_code, name=s.name, status=s.status) for s in stores
        ],
    )


def _partner_or_404(db: Session, member_id: str) -> User:
    try:
        user = db.get(User, uuid.UUID(member_id))
    except ValueError:
        user = None
    if user is None or user.member_category != "partner":
        raise HTTPException(status_code=404, detail="제휴사 회원을 찾을 수 없어요.")
    return user


def _stores_by_owner(db: Session, owner_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[PartnersStore]]:
    out: dict[uuid.UUID, list[PartnersStore]] = {}
    if not owner_ids:
        return out
    for s in (
        db.query(PartnersStore)
        .filter(PartnersStore.owner_user_id.in_(owner_ids))
        .order_by(PartnersStore.created_at)
    ):
        out.setdefault(s.owner_user_id, []).append(s)
    return out


def admin_list_members(
    db: Session,
    *,
    keyword: str | None = None,
    agreement: str | None = None,
    biz: str | None = None,
    store: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[int, list[dict]]:
    """제휴사 회원 — 최근 가입 순(현장에서 방금 가입한 회원을 바로 찾게).
    agreement: done/none · biz: unregistered/reviewing/verified/rejected/provisional · store: yes/no."""
    q = (
        db.query(User)
        .options(joinedload(User.business_registration), selectinload(User.social_accounts))
        .filter(User.member_category == "partner", User.status != "withdrawn")
    )
    kw = (keyword or "").strip()
    if kw:
        like = f"%{kw}%"
        conds = [
            User.partner_code.ilike(like),
            User.login_id.ilike(like),
            User.email.ilike(like),
            User.name.ilike(like),
            User.phone.ilike(like),
            User.company_name.ilike(like),
        ]
        # 연락처는 숫자만 저장돼 있어 "010-1234" 처럼 '-'를 넣어 찾아도 맞게.
        digits = "".join(ch for ch in kw if ch.isdigit())
        if len(digits) >= 3 and all(ch.isdigit() or ch in "- " for ch in kw):
            conds.append(func.regexp_replace(User.phone, "[^0-9]", "", "g").like(f"%{digits}%"))
        q = q.filter(or_(*conds))
    if agreement == "done":
        q = q.filter(User.partner_agreed_at.isnot(None))
    elif agreement == "none":
        q = q.filter(User.partner_agreed_at.is_(None))
    if biz:
        q = q.outerjoin(BusinessRegistration, BusinessRegistration.user_id == User.id)
        if biz == "unregistered":
            q = q.filter(or_(BusinessRegistration.id.is_(None), BusinessRegistration.status == "unregistered"))
        else:
            q = q.filter(BusinessRegistration.status == biz)
    if store in ("yes", "no"):
        has = db.query(PartnersStore.id).filter(PartnersStore.owner_user_id == User.id).exists()
        q = q.filter(has if store == "yes" else ~has)
    total = q.count()
    rows = (
        q.order_by(User.created_at.desc())
        .offset((max(page, 1) - 1) * page_size)
        .limit(page_size)
        .all()
    )
    by_owner = _stores_by_owner(db, [u.id for u in rows])
    return total, [_member_summary(u, by_owner.get(u.id, [])) for u in rows]


def admin_get_member(db: Session, member_id: str) -> dict:
    user = _partner_or_404(db, member_id)
    ensure_partner_code(db, user)
    stores = _stores_by_owner(db, [user.id]).get(user.id, [])
    return _member_summary(user, stores)


def admin_update_member(db: Session, member_id: str, data: dict) -> dict:
    """제휴사 회원 정보 — 지금은 연락처만(2026-11-10 사용자: 회원 상세에서 바꾸고, 비밀번호는 따로 문의).
    연락처는 숫자만 저장한다(9 ~ 11자리, '-'는 화면이 넣는다). 비우면 지운다. 다른 회원과 겹치면 막는다."""
    user = _partner_or_404(db, member_id)
    if "phone" in data:
        digits = "".join(ch for ch in str(data["phone"] or "") if ch.isdigit())
        if digits and not 9 <= len(digits) <= 11:
            raise HTTPException(status_code=400, detail="연락처는 9 ~ 11자리 숫자로 적어 주세요.")
        if digits and db.query(User.id).filter(User.phone == digits, User.id != user.id).first():
            raise HTTPException(status_code=409, detail="이미 다른 회원이 쓰는 연락처예요.")
        user.phone = digits or None
    db.commit()
    db.refresh(user)
    return admin_get_member(db, member_id)


def admin_lookup_member(db: Session, code: str) -> dict:
    """고유번호로 회원 미리 보기 — 매장 화면에서 연결하기 전에 누구인지 확인."""
    user = partner_by_code(db, code)
    stores = _stores_by_owner(db, [user.id]).get(user.id, [])
    return _member_summary(user, stores)


def admin_biz_action(db: Session, member_id: str, action: str, reason: str | None = None) -> dict:
    """사업자 인증 — provisional 임시 승인(현장, 등록증 없이 협약 진행) · verify 인증 완료 · reject 반려 · reset 미등록으로."""
    if action not in BIZ_ACTIONS:
        raise HTTPException(status_code=400, detail="알 수 없는 처리예요.")
    user = _partner_or_404(db, member_id)
    reg = user.business_registration
    if reg is None:
        reg = BusinessRegistration(user_id=user.id, status="unregistered")
        db.add(reg)
        user.business_registration = reg
    now = datetime.now(timezone.utc)
    if action == "provisional":
        if reg.status == "verified":
            raise HTTPException(status_code=400, detail="이미 인증을 마친 회원이에요.")
        reg.status = "provisional"
        reg.provisional_at = now
        reg.reject_reason = None
    elif action == "verify":
        reg.status = "verified"
        reg.verified_at = now
        reg.reject_reason = None
    elif action == "reject":
        reg.status = "rejected"
        reg.reject_reason = (reason or "").strip() or None
        reg.verified_at = None
    else:
        reg.status = "reviewing" if reg.license_file_url else "unregistered"
        reg.reject_reason = None
        reg.verified_at = None
        reg.provisional_at = None
    db.commit()
    return admin_get_member(db, member_id)


def admin_link_store(db: Session, member_id: str, store_code: str) -> dict:
    """회원 화면에서 매장 ID(S-0001)로 매장을 잇는다 — 다른 회원에게 연결돼 있던 매장이면 옮겨 온다."""
    user = _partner_or_404(db, member_id)
    raw = normalize_store_code(store_code)
    store = db.query(PartnersStore).filter(PartnersStore.store_code == raw).first()
    if store is None:
        raise HTTPException(status_code=400, detail=f"매장을 찾지 못했어요: {store_code}")
    store.owner_user_id = user.id
    db.commit()
    return admin_get_member(db, member_id)


def admin_unlink_store(db: Session, member_id: str, store_id: str) -> dict:
    user = _partner_or_404(db, member_id)
    store = _get_or_404(db, store_id)
    if store.owner_user_id == user.id:
        store.owner_user_id = None
        db.commit()
    return admin_get_member(db, member_id)
