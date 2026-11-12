"""콜라보 영업 DB(071) — 가입 전 제휴사(매장) 영업 기록 목록 · 상세 · 저장, 원본 영업 앱 파일 가져오기.

API 는 원본 영업 앱(sales_records.data)과 같은 칸 이름(camelCase)으로 주고받는다 — 칸 설정(sales_settings)의 key 와 그대로 맞물린다.
빈 글 · 빈 날짜는 원본처럼 ""(DB 에는 NULL), 재방문은 참/거짓(원본 "yes"/"no").
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from fastapi import HTTPException
from sqlalchemy import String, cast, func, nulls_last, or_
from sqlalchemy.orm import Session

from src.models.collab_lead import CollabLead, CollabLeadSetting
from src.models.collab import CollabParticipant
from src.models.partners_store import PartnersStoreRequest, PartnersStoreType
from src.services import partners_service
from src.services.partners_service import partner_by_code

# 원본 칸 이름 → 모델 속성. 글자 칸은 (속성, 최대 길이 — None 이면 제한 없음).
TEXT_FIELDS: dict[str, tuple[str, int | None]] = {
    "name": ("name", 200),
    "region": ("region", 100),
    "address": ("address", 300),
    "type": ("biz_type", 100),
    "grade": ("grade", 20),
    "potential": ("potential", 50),
    "status": ("status", 100),
    "owner": ("owner", 100),
    "note": ("note", None),
    "contactName": ("contact_name", 100),
    "contactTitle": ("contact_title", 100),
    "contactPhone": ("contact_phone", 100),
    "contactEmail": ("contact_email", 200),
    "contactOther": ("contact_other", None),
    "conversation": ("conversation", None),
    "followupMemo": ("followup_memo", None),
}
DATE_FIELDS = {"date": "visit_date", "followupDate": "followup_date"}
LIST_FIELDS = {"purposes": "purposes", "contacts": "contacts", "reactions": "reactions", "photoIds": "photo_ids"}

# 목록에서 고르는 조건 — 칸 이름 → 모델 속성(값 목록은 meta 가 지금 값에서 만든다).
FACET_FIELDS = {"status": "status", "potential": "potential", "grade": "grade", "region": "region", "type": "biz_type", "owner": "owner"}
SORTS = ("visit", "updated", "name", "source")
LIST_ITEM_MAX = 50
CUSTOM_TEXT_MAX = 2000


def _iso(dt: datetime | None) -> str:
    return dt.isoformat() if dt else ""


def serialize(lead: CollabLead) -> dict:
    out: dict = {"id": str(lead.id), "sourceId": lead.source_id or ""}
    for key, (attr, _) in TEXT_FIELDS.items():
        out[key] = getattr(lead, attr) or ""
    for key, attr in DATE_FIELDS.items():
        value = getattr(lead, attr)
        out[key] = value.isoformat() if value else ""
    for key, attr in LIST_FIELDS.items():
        out[key] = list(getattr(lead, attr) or [])
    out["revisit"] = bool(lead.revisit)
    out["custom"] = dict(lead.custom or {})
    out["createdAt"] = _iso(lead.created_at)
    out["updatedAt"] = _iso(lead.updated_at)
    out["hasSource"] = lead.source_data is not None
    # 연결한 제휴사 회원 고유번호(072) — 없으면 "". 회원 이름 · 상태는 화면이 고유번호로 따로 불러온다.
    out["partnerCode"] = (lead.partner.partner_code or "") if lead.partner else ""
    # 협업 확정으로 만든 매장(076) — 없으면 "". 확정해도 영업 기록 목록엔 그대로 남는다(11-12).
    out["storeId"] = str(lead.store_id) if lead.store_id else ""
    out["storeCode"] = (lead.store.store_code or "") if lead.store else ""
    out["photos"] = photos_of(lead)
    return out


def photos_of(lead: CollabLead) -> list[dict]:
    """매장 사진(088) — [{url, kind, cover, memo, uploadedAt}] 저장 순서. cover 는 분류마다 먼저 나오는 한 장(대표)."""
    seen: set[str] = set()
    out: list[dict] = []
    for p in lead.photos or []:
        kind = partners_service._photo_kind(p.get("kind"))
        out.append(
            {
                "url": p.get("url") or "",
                "kind": kind,
                "cover": kind not in seen,
                "memo": p.get("memo") or "",
                "uploadedAt": p.get("uploadedAt"),
            }
        )
        seen.add(kind)
    return out


def to_source(lead: CollabLead) -> dict:
    """원본 영업 앱의 data 모양으로 되돌린다 — 가져온 뒤 원본과 칸 하나하나 맞는지 확인할 때 쓴다."""
    out = serialize(lead)
    out.pop("hasSource")
    out.pop("sourceId")
    out.pop("partnerCode")  # 원본 앱에 없는 칸(072)
    out.pop("storeId")  # 원본 앱에 없는 칸(076)
    out.pop("storeCode")
    out.pop("photos")  # 원본 앱에 없는 칸(088) — 원본 사진은 photoIds
    out["id"] = lead.source_id or ""
    out["revisit"] = "yes" if lead.revisit else "no"
    return out


# ── 값 정리 ─────────────────────────────────────────────────────────────


def _text(key: str, value, max_len: int | None, *, raw: bool) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise HTTPException(status_code=400, detail=f"{key} 값은 글자로 보내 주세요.")
    # 가져오기(raw)는 원본 그대로 — 앞뒤 공백도 고치지 않는다. 화면에서 저장할 때만 다듬는다.
    text = value if raw else value.strip()
    if not text:
        return None
    if max_len is not None and len(text) > max_len:
        raise HTTPException(status_code=400, detail=f"{key} 는 {max_len}자까지 쓸 수 있어요.")
    return text


def _date(key: str, value) -> date | None:
    if value in (None, ""):
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        raise HTTPException(status_code=400, detail=f"{key} 날짜를 다시 확인해 주세요(YYYY-MM-DD).") from None


def _list(key: str, value, *, raw: bool) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise HTTPException(status_code=400, detail=f"{key} 값은 목록으로 보내 주세요.")
    out: list[str] = []
    for item in value:
        text = str(item) if raw else str(item).strip()
        if text and (raw or text not in out):
            out.append(text)
    if len(out) > LIST_ITEM_MAX and key != "photoIds":
        raise HTTPException(status_code=400, detail=f"{key} 는 {LIST_ITEM_MAX}개까지 넣을 수 있어요.")
    return out


def _custom(value) -> dict:
    """사용자 정의 칸 — 글자 · 숫자 · 비움만(원본처럼 숫자 칸에 글이 있어도 그대로 둔다)."""
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise HTTPException(status_code=400, detail="추가 항목 값을 다시 확인해 주세요.")
    out: dict = {}
    for k, v in value.items():
        if v is None or isinstance(v, bool):
            v = ""
        if isinstance(v, str) and len(v) > CUSTOM_TEXT_MAX:
            raise HTTPException(status_code=400, detail=f"추가 항목은 한 칸에 {CUSTOM_TEXT_MAX}자까지 쓸 수 있어요.")
        if not isinstance(v, (str, int, float)):
            raise HTTPException(status_code=400, detail="추가 항목 값은 글자나 숫자로 보내 주세요.")
        out[str(k)] = v
    return out


def _parse_dt(value) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _clean_photos(lead: CollabLead, value) -> list[dict]:
    """[{url, kind, cover, memo}] → 저장 모양. 정리 규칙(분류 순 · 대표 맨 앞 · 메모 길이)은 협업 확정 매장 사진과 같다.
    올린 때는 이미 있던 사진은 그대로, 처음 보는 주소만 지금 시각."""
    urls, kinds, memos = partners_service._clean_photo_set(value if isinstance(value, list) else [])
    dates = {p.get("url"): p.get("uploadedAt") for p in lead.photos or []}
    now = datetime.now(timezone.utc).isoformat()
    return [{"url": u, "kind": kinds[u], "memo": memos.get(u, ""), "uploadedAt": dates.get(u) or now} for u in urls]


def _apply(lead: CollabLead, data: dict, *, raw: bool = False) -> None:
    """보낸 칸만 바꾼다. raw — 원본 파일 가져오기(글자를 다듬지 않는다)."""
    for key, (attr, max_len) in TEXT_FIELDS.items():
        if key in data:
            setattr(lead, attr, _text(key, data[key], max_len, raw=raw))
    for key, attr in DATE_FIELDS.items():
        if key in data:
            setattr(lead, attr, _date(key, data[key]))
    for key, attr in LIST_FIELDS.items():
        if key in data:
            setattr(lead, attr, _list(key, data[key], raw=raw))
    if "revisit" in data:
        v = data["revisit"]
        lead.revisit = v in (True, "yes", "Y", "y", "true", 1)
    if "custom" in data:
        lead.custom = _custom(data["custom"])
    if "photos" in data and not raw:
        lead.photos = _clean_photos(lead, data["photos"])
    if not lead.name:
        raise HTTPException(status_code=400, detail="업체명을 적어 주세요.")


def _apply_partner(db: Session, lead: CollabLead, data: dict) -> None:
    """연결할 제휴사 회원 — partnerCode(고유번호 P-0001). 보낸 때만 바꾸고, 비우면 연결을 끊는다."""
    if "partnerCode" not in data:
        return
    user = partner_by_code(db, data.get("partnerCode"))
    lead.partner_user_id = user.id if user else None
    lead.partner = user


# ── 목록 · 상세 · 저장 ──────────────────────────────────────────────────


def _setting(db: Session) -> CollabLeadSetting | None:
    return db.get(CollabLeadSetting, 1)


def meta(db: Session) -> dict:
    """칸 설정(이름 · 순서 · 보이기)과 고를 값(지금 들어 있는 값, 많은 순)."""
    setting = _setting(db)
    facets: dict[str, list[str]] = {}
    for key, attr in FACET_FIELDS.items():
        col = getattr(CollabLead, attr)
        rows = (
            db.query(col, func.count())
            .filter(col.isnot(None))
            .group_by(col)
            .order_by(func.count().desc(), col)
            .all()
        )
        facets[key] = [v for v, _ in rows]
    return {
        "columns": list(setting.columns) if setting else [],
        "customFields": list(setting.custom_fields) if setting else [],
        "facets": facets,
        "total": db.query(func.count(CollabLead.id)).scalar() or 0,
    }


def list_leads(
    db: Session,
    *,
    keyword: str | None = None,
    filters: dict[str, str | None] | None = None,
    sort: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[int, list[dict]]:
    # 협업 확정한 기록도 그대로 보인다(2026-11-12 사용자 — 영업 기록과 협업 확정 매장은 칸이 달라 따로 둔다). 확정 여부는 storeCode 로.
    q = db.query(CollabLead)
    kw = (keyword or "").strip()
    if kw:
        like = f"%{kw}%"
        q = q.filter(
            or_(
                CollabLead.name.ilike(like),
                CollabLead.address.ilike(like),
                CollabLead.region.ilike(like),
                CollabLead.contact_name.ilike(like),
                CollabLead.contact_phone.ilike(like),
                CollabLead.contact_email.ilike(like),
                CollabLead.owner.ilike(like),
                CollabLead.note.ilike(like),
                CollabLead.conversation.ilike(like),
                CollabLead.followup_memo.ilike(like),
                cast(CollabLead.custom, String).ilike(like),
            )
        )
    for key, value in (filters or {}).items():
        if value and key in FACET_FIELDS:
            q = q.filter(getattr(CollabLead, FACET_FIELDS[key]) == value)
    total = q.count()
    sort = sort if sort in SORTS else "visit"
    if sort == "visit":
        order = [nulls_last(CollabLead.visit_date.desc()), CollabLead.sort_order]
    elif sort == "updated":
        order = [CollabLead.updated_at.desc(), CollabLead.sort_order]
    elif sort == "name":
        order = [CollabLead.name, CollabLead.sort_order]
    else:
        order = [CollabLead.sort_order]
    rows = q.order_by(*order).offset((page - 1) * page_size).limit(page_size).all()
    return total, [serialize(r) for r in rows]


def _get(db: Session, lead_id: str) -> CollabLead:
    try:
        key = uuid.UUID(str(lead_id))
    except ValueError:
        raise HTTPException(status_code=404, detail="영업 기록을 찾을 수 없어요.") from None
    lead = db.get(CollabLead, key)
    if not lead:
        raise HTTPException(status_code=404, detail="영업 기록을 찾을 수 없어요.")
    return lead


def get_lead(db: Session, lead_id: str) -> dict:
    return serialize(_get(db, lead_id))


def create_lead(db: Session, data: dict) -> dict:
    """새 영업 기록. 제휴사 회원을 연결해 만들면 바로 협업 확정(_sync_partner_store)."""
    lead = CollabLead(id=uuid.uuid4())
    _apply(lead, data)
    _apply_partner(db, lead, data)
    lead.sort_order = (db.query(func.max(CollabLead.sort_order)).scalar() or 0) + 1
    try:
        db.add(lead)
        db.flush()
        _sync_partner_store(db, lead, None, data)
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(lead)
    return serialize(lead)


def update_lead(db: Session, lead_id: str, data: dict) -> dict:
    """보낸 칸만 바꾼다. 제휴사 회원 연결이 바뀌면 협업 확정 매장도 맞춘다(_sync_partner_store)."""
    lead = _get(db, lead_id)
    prev_partner = lead.partner_user_id
    try:
        _apply(lead, data)
        _apply_partner(db, lead, data)
        lead.updated_at = datetime.now(timezone.utc)
        _sync_partner_store(db, lead, prev_partner, data)
        db.commit()
    except Exception:
        db.rollback()  # 반쯤 바뀐 값이 세션에 남지 않게
        raise
    db.refresh(lead)
    return serialize(lead)


def _sync_partner_store(db: Session, lead: CollabLead, prev_partner: uuid.UUID | None, data: dict) -> None:
    """제휴사 회원 연결 = 협업 확정(2026-11-12 사용자: "회원을 연결하면 자동으로 협업 확정, 회원에게도 뜨게").

    회원 화면의 "연결 매장"은 매장의 연결 회원(owner)이라, 영업 기록에만 회원을 이어 두면 회원 쪽엔 매장이 없다.
    - 확정 전 기록에 회원이 연결돼 있으면(이번에 보낸 partnerCode 기준) 그 회원을 연결 회원으로 매장을 만든다 — 주소가 없으면 막는다.
    - 확정한 기록은 회원이 바뀔 때 매장 연결 회원도 같이 바꾼다. 끊으면, 매장이 그 회원과 이어져 있을 때만 매장 쪽도 끊는다.
    커밋은 부르는 쪽에서.
    """
    if "partnerCode" not in data:
        return
    store = lead.store
    if store is None:
        if lead.partner_user_id:
            if not _store_address_of(lead)[0]:
                raise HTTPException(
                    status_code=400,
                    detail="회원을 연결하면 협업 확정돼요. 주소나 지번주소를 먼저 적어 주세요.",
                )
            _make_store(db, lead, data.get("location"))
        return
    if lead.partner_user_id == prev_partner:
        return
    if lead.partner_user_id:
        store.owner_user_id = lead.partner_user_id
    elif store.owner_user_id == prev_partner:
        store.owner_user_id = None


# ── 협업 확정(영업 기록 → 협업 확정 매장) ─────────────────────────────

# 사장 이름 칸에 옮길 매장 담당자 직함 — 매니저 · 관리자 같은 직원 이름은 옮기지 않는다.
OWNER_TITLES = ("대표", "사장", "점주", "오너")


def _store_type_for(db: Session, biz_type: str | None) -> int | None:
    """업체 유형 → 매장 유형. 이름이 같거나 들어 있으면 그 유형(유형 순서대로), 아니면 첫 유형(카페)."""
    types = db.query(PartnersStoreType).order_by(PartnersStoreType.sort_order, PartnersStoreType.id).all()
    text = (biz_type or "").strip()
    for t in types:
        if t.name == text:
            return t.id
    for t in types:
        if t.name and t.name in text:
            return t.id
    return types[0].id if types else None


# 추가 항목 "지번주소"(원본 칸)와 상세 주소(11-12, 상세 화면에서 카카오 주소 검색 + 직접 적기).
LOT_ADDRESS_KEY = "cf_lot_address"
LOT_DETAIL_KEY = "cf_lot_address_detail"


def _store_address_of(lead: CollabLead) -> tuple[str, str | None]:
    """매장에 옮길 주소 — "주소" 칸이 있으면 그대로(층 · 호수가 섞여 있어 상세는 따로 두지 않는다), 비었으면 지번주소 + 상세 주소."""
    address = (lead.address or "").strip()
    if address:
        return address, None
    custom = lead.custom or {}
    lot = str(custom.get(LOT_ADDRESS_KEY) or "").strip()
    detail = str(custom.get(LOT_DETAIL_KEY) or "").strip()
    return lot, (detail or None) if lot else None


def _location_of(location: dict | None) -> dict:
    """화면이 카카오 지도로 찾아 보낸 위치(위도 · 경도 · 시도 · 구군) — 맞는 값만 매장 값으로 쓴다(11-12).

    서버 카카오 주소 검색은 키가 없거나 주소에 층 · 호수가 섞이면 못 찾아 지도가 안 뜨던 것(치르 · 베를린하우스).
    """
    out: dict = {}
    if not isinstance(location, dict):
        return out
    try:
        lat, lng = float(location.get("latitude")), float(location.get("longitude"))
    except (TypeError, ValueError):
        return out
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return out
    out.update(latitude=lat, longitude=lng)
    for key in ("city", "district"):
        value = location.get(key)
        if isinstance(value, str) and value.strip() and len(value) <= 50:
            out[key] = value.strip()
    return out


def confirm_lead(db: Session, lead_id: str, location: dict | None = None) -> dict:
    """협업 확정 — 영업 기록 칸으로 협업 확정 매장(S-0001 …)을 만들고 기록과 잇는다.

    매장은 비공개로 만든다(사진 · 금액을 채우고 어드민이 공개로 바꾼다). 옮기는 칸: 업체명 · 주소(없으면 지번주소 + 상세) · 업체 유형(매장 유형) ·
    매장 담당자 연락처(전화번호) · 대표/사장이면 그 이름(사장 이름) · 연결한 제휴사 회원 · 매장 사진(088). 영업 기록은 지우지 않고 목록에도 남는다.
    확정한 뒤로 매장 사진은 협업 확정 매장에서 고친다(영업 기록 사진을 고쳐도 매장엔 반영되지 않는다).
    location — 화면이 찾은 위치(없으면 서버가 주소로 찾는다).
    """
    lead = _get(db, lead_id)
    if lead.store_id:
        code = lead.store.store_code if lead.store else ""
        raise HTTPException(status_code=409, detail=f"이미 협업 확정한 매장이에요{f'({code})' if code else ''}.")
    try:
        store = _make_store(db, lead, location)
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(store)
    return {"lead": serialize(lead), "store": partners_service.serialize(store, admin=True)}


def _make_store(db: Session, lead: CollabLead, location: dict | None):
    """영업 기록 칸으로 비공개 매장을 만들고 기록과 잇는다(커밋은 부르는 쪽에서) — 확정 버튼 · 회원 연결이 같이 쓴다."""
    address, address_detail = _store_address_of(lead)
    if not address:
        raise HTTPException(status_code=400, detail="주소가 없어 확정할 수 없어요. 영업 기록에 주소나 지번주소를 먼저 적어 주세요.")
    phone = (lead.contact_phone or "").strip()
    title = lead.contact_title or ""
    data: dict = {
        "name": lead.name,
        "address": address,
        "address_detail": address_detail,
        "store_type_id": _store_type_for(db, lead.biz_type),
        "status": "hidden",
        "phone": phone if len(phone) <= 30 else None,
        "owner_name": lead.contact_name if any(t in title for t in OWNER_TITLES) else None,
    }
    data.update(_location_of(location))
    if lead.partner and lead.partner.partner_code:
        data["owner_code"] = lead.partner.partner_code
    # 영업 기록 매장 사진(088)은 매장 사진으로 — 분류 · 대표 · 메모 그대로, 올린 때도 영업 기록에 올린 때로.
    photos = lead.photos or []
    if photos:
        data["images"] = [{"url": p.get("url"), "kind": p.get("kind"), "memo": p.get("memo")} for p in photos]
    store = partners_service.create_store(db, data)
    if photos:
        dates = {p.get("url"): p.get("uploadedAt") for p in photos}
        store.image_dates = {u: dates.get(u) or d for u, d in (store.image_dates or {}).items()}
    lead.store_id = store.id
    lead.store = store
    lead.updated_at = datetime.now(timezone.utc)
    db.flush()
    return store


def cancel_lead(db: Session, lead_id: str) -> dict:
    """협업 취소(2026-11-12 사용자) — 확정의 반대. 확정으로 만든 협업 확정 매장을 지우고 영업 기록을 확정 전으로 되돌린다.

    매장에 콜라보 참여 · 수정 요청 기록이 있으면 막는다(매장을 지우면 그 기록도 함께 지워진다 — 그땐 매장을 비공개로).
    매체 찾기에 보이던 매장이면 그 media 줄도 지운다. 매장 사진 · 금액 · 등급처럼 매장에 넣은 값은 함께 사라진다.
    """
    lead = _get(db, lead_id)
    store = lead.store
    if not store:
        raise HTTPException(status_code=409, detail="협업 확정한 매장이 아니에요.")
    code = store.store_code or ""
    joined = db.query(func.count(CollabParticipant.id)).filter(CollabParticipant.store_id == store.id).scalar() or 0
    requests = db.query(func.count(PartnersStoreRequest.id)).filter(PartnersStoreRequest.store_id == store.id).scalar() or 0
    if joined or requests:
        what = " · ".join(t for t, n in (("콜라보 참여", joined), ("수정 요청", requests)) if n)
        raise HTTPException(
            status_code=409,
            detail=f"{code} 매장에 {what} 기록이 있어 협업을 취소할 수 없어요. 협업 확정 매장에서 비공개로 바꿔 주세요.",
        )
    try:
        lead.store_id = None
        lead.store = None
        # 회원 연결 = 협업 확정이라(11-12) 취소하면 연결한 회원도 끊는다 — 남겨 두면 다음 저장 때 다시 확정된다.
        lead.partner_user_id = None
        lead.partner = None
        lead.updated_at = datetime.now(timezone.utc)
        db.flush()
        partners_service._delete_store(db, store)  # 매장 수정의 "삭제"와 같은 지우기(매체 찾기 media 줄도)
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(lead)
    return {"lead": serialize(lead), "storeCode": code}


def delete_lead(db: Session, lead_id: str) -> None:
    db.delete(_get(db, lead_id))
    db.commit()


# ── 원본 영업 앱 파일 가져오기 ──────────────────────────────────────────


def import_source(db: Session, settings_file: dict, records_file: dict) -> dict:
    """sales_settings · sales_records 내보내기(JSON: {table, columns, rows}) → 칸 설정 + 영업 기록.

    같은 원본 id 는 덮어쓴다(다시 가져와도 두 번 생기지 않는다). 원본 행 전체는 source_data 에 그대로 남긴다.
    가져온 뒤 모든 줄을 원본 모양으로 되돌려(to_source) 원본과 칸 하나하나 같은지 확인한 결과를 돌려준다.
    """
    settings_rows = settings_file.get("rows") or []
    if settings_rows:
        data = settings_rows[0].get("data") or {}
        setting = _setting(db) or CollabLeadSetting(id=1)
        setting.columns = list(data.get("columns") or [])
        setting.custom_fields = list(data.get("customFields") or [])
        setting.updated_at = datetime.now(timezone.utc)
        db.add(setting)

    created = updated = 0
    rows = records_file.get("rows") or []
    for index, row in enumerate(rows):
        data = row.get("data") or {}
        source_id = str(data.get("id") or row.get("id") or "").strip()
        if not source_id:
            raise HTTPException(status_code=400, detail=f"{index + 1}번째 줄에 원본 id 가 없어요.")
        lead = db.query(CollabLead).filter(CollabLead.source_id == source_id).one_or_none()
        if lead:
            updated += 1
        else:
            lead = CollabLead(id=uuid.uuid4(), source_id=source_id)
            db.add(lead)
            created += 1
        _apply(lead, data, raw=True)
        lead.sort_order = index + 1
        lead.source_data = row
        lead.created_at = _parse_dt(data.get("createdAt")) or _parse_dt(row.get("created_at")) or datetime.now(timezone.utc)
        lead.updated_at = _parse_dt(data.get("updatedAt")) or _parse_dt(row.get("updated_at")) or lead.created_at
    db.commit()

    mismatches = verify_against_source(db, rows)
    return {"created": created, "updated": updated, "total": len(rows), "mismatches": mismatches}


def verify_against_source(db: Session, rows: list[dict]) -> list[str]:
    """가져온 줄을 원본 data 와 칸마다 비교 — 다른 칸을 "원본id.칸" 으로 돌려준다(비어 있으면 모두 같다)."""
    problems: list[str] = []
    for row in rows:
        data = row.get("data") or {}
        source_id = str(data.get("id") or row.get("id"))
        lead = db.query(CollabLead).filter(CollabLead.source_id == source_id).one_or_none()
        if not lead:
            problems.append(f"{source_id}: 없음")
            continue
        back = to_source(lead)
        for key in sorted(set(data) | set(back)):
            a, b = data.get(key), back.get(key)
            if key in ("createdAt", "updatedAt"):
                same = _parse_dt(a) == _parse_dt(b)
            else:
                same = a == b
            if not same:
                problems.append(f"{source_id}.{key}")
    return problems
