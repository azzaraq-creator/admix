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
from src.models.partners_store import PartnersStoreType
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
    # 협업 확정으로 만든 매장(076) — 없으면 "". 차 있으면 "협업 확정 전" 목록에 보이지 않는다.
    out["storeId"] = str(lead.store_id) if lead.store_id else ""
    out["storeCode"] = (lead.store.store_code or "") if lead.store else ""
    return out


def to_source(lead: CollabLead) -> dict:
    """원본 영업 앱의 data 모양으로 되돌린다 — 가져온 뒤 원본과 칸 하나하나 맞는지 확인할 때 쓴다."""
    out = serialize(lead)
    out.pop("hasSource")
    out.pop("sourceId")
    out.pop("partnerCode")  # 원본 앱에 없는 칸(072)
    out.pop("storeId")  # 원본 앱에 없는 칸(076)
    out.pop("storeCode")
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
            .filter(col.isnot(None), CollabLead.store_id.is_(None))
            .group_by(col)
            .order_by(func.count().desc(), col)
            .all()
        )
        facets[key] = [v for v, _ in rows]
    return {
        "columns": list(setting.columns) if setting else [],
        "customFields": list(setting.custom_fields) if setting else [],
        "facets": facets,
        "total": db.query(func.count(CollabLead.id)).filter(CollabLead.store_id.is_(None)).scalar() or 0,
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
    # 협업 확정한 기록(매장으로 옮긴 것)은 "협업 확정 전" 목록에서 뺀다(076).
    q = db.query(CollabLead).filter(CollabLead.store_id.is_(None))
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
    lead = CollabLead(id=uuid.uuid4())
    _apply(lead, data)
    _apply_partner(db, lead, data)
    lead.sort_order = (db.query(func.max(CollabLead.sort_order)).scalar() or 0) + 1
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return serialize(lead)


def update_lead(db: Session, lead_id: str, data: dict) -> dict:
    lead = _get(db, lead_id)
    try:
        _apply(lead, data)
        _apply_partner(db, lead, data)
    except HTTPException:
        db.rollback()  # 반쯤 바뀐 값이 세션에 남지 않게
        raise
    lead.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(lead)
    return serialize(lead)


# ── 협업 확정(영업 기록 → 협업 확정 카페) ─────────────────────────────

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


def confirm_lead(db: Session, lead_id: str) -> dict:
    """협업 확정 — 영업 기록 칸으로 협업 확정 카페(매장 S-0001 …)를 만들고 기록과 잇는다.

    매장은 비공개로 만든다(사진 · 금액을 채우고 어드민이 공개로 바꾼다). 옮기는 칸: 업체명 · 주소 · 업체 유형(매장 유형) ·
    매장 담당자 연락처(전화번호) · 대표/사장이면 그 이름(사장 이름) · 연결한 제휴사 회원. 영업 기록은 지우지 않는다.
    """
    lead = _get(db, lead_id)
    if lead.store_id:
        code = lead.store.store_code if lead.store else ""
        raise HTTPException(status_code=409, detail=f"이미 협업 확정 카페로 옮긴 기록이에요{f'({code})' if code else ''}.")
    if not (lead.address or "").strip():
        raise HTTPException(status_code=400, detail="주소가 없어 확정할 수 없어요. 영업 기록에 주소를 먼저 적어 주세요.")
    phone = (lead.contact_phone or "").strip()
    title = lead.contact_title or ""
    data: dict = {
        "name": lead.name,
        "address": lead.address,
        "store_type_id": _store_type_for(db, lead.biz_type),
        "status": "hidden",
        "phone": phone if len(phone) <= 30 else None,
        "owner_name": lead.contact_name if any(t in title for t in OWNER_TITLES) else None,
    }
    if lead.partner and lead.partner.partner_code:
        data["owner_code"] = lead.partner.partner_code
    try:
        store = partners_service.create_store(db, data)
        lead.store_id = store.id
        lead.store = store
        lead.updated_at = datetime.now(timezone.utc)
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(store)
    return {"lead": serialize(lead), "store": partners_service.serialize(store, admin=True)}


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
