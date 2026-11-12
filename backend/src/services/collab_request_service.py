"""광고주 콜라보 의뢰(081) — 광고주가 보내고(확인 창 체크 후), 어드민이 서류처럼 읽는다(2026-11-11 사용자).

광고주: create(보내기) · update(고친 의뢰 다시 보내기, 같은 줄) · save_plan_file(추가 기획 첨부).
어드민: admin_list · admin_get(처음 열면 admin_viewed_at) · plan_file · new_count(사이드 메뉴 숫자).

기획안 첨부(2026-11-12 사용자: "어드민도 파일을 첨부할 수 있게"): 차수 내용의 files — 추가 기획에 붙은 파일 목록
[{id, name, size, by}]. 광고주가 의뢰서에 붙인 파일은 id "request"(0차부터 들어 있다), admix가 기획안에 붙인 파일은
admin_upload_round_file 로 먼저 올려 두고(uploads/collab-request-plan/<의뢰 id>/<id>) 보낼 때 목록에 넣는다.
광고주는 차수에 들어간 파일만 받을 수 있다(round_file). files 가 없는 옛 차수는 바로 앞 차수 목록을 이어받는다.

기획안 차수(085, 2026-11-12 사용자): admix가 의뢰를 항목별로 고쳐 보내면(admin_send_round → proposed) 광고주가
수정 전 · 후를 보고 다시 고쳐 보내거나(send_round → revised) 확정한다(confirm → confirmed). 몇 차례든 오간다.
의뢰 표 줄은 광고주가 처음 보낸 의뢰서(0차) 그대로 두고, 고친 내용은 차수 표에 통째로 쌓는다.
진행 단계(모집 · 확정 · 입금)는 아직 광고주 화면 예시 데이터라 여기선 다루지 않는다.
"""
from __future__ import annotations

import os
import re
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from fastapi import HTTPException, UploadFile
from sqlalchemy import String, cast, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.config import get_settings
from src.models.advertiser_brand import AdvertiserBrand
from src.models.admin import Admin
from src.models.advertiser_collab_request import AdvertiserCollabRequest, AdvertiserCollabRequestRound
from src.models.partners_store import PartnersStore
from src.models.user import User
from src.services.advertiser_brand_service import serialize as serialize_brand

KST = timezone(timedelta(hours=9))

ITEM_KEYS = ("promo", "consumable", "goods", "display", "menu", "space")
PREP_KEYS = ("ready", "made", "admix")
COURSES = ("standard", "rush")
MIN_PERIOD_DAYS = 3
MAX_PREFERRED = 50
MAX_TARGET_STORES = 500

# 추가 기획 첨부 — 의뢰서 화면과 같은 규칙(기획서 1개, 20MB).
PLAN_FILE_MAX = 20 * 1024 * 1024
PLAN_FILE_EXTS = {
    ".pdf", ".ppt", ".pptx", ".key", ".doc", ".docx", ".hwp", ".hwpx", ".xls", ".xlsx", ".zip",
    ".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic",
}
# 기획안 첨부 — 차수 하나에 모두 합쳐 10개까지(광고주 의뢰서 첨부 포함), 파일마다 20MB.
ROUND_FILE_MAX_COUNT = 10
REQUEST_FILE_ID = "request"
ROUND_FILE_DIR = "collab-request-plan"
ROUND_FILE_ID = re.compile(r"^[0-9a-f]{32}\.[a-z0-9]{1,5}$")


def _today_kst() -> date:
    return datetime.now(KST).date()


def _iso(value) -> str | None:
    return value.isoformat() if value else None


def _bad(detail: str) -> HTTPException:
    return HTTPException(status_code=400, detail=detail)


def ensure_advertiser(user: User) -> User:
    if user.member_category != "advertiser":
        raise HTTPException(status_code=403, detail="광고주 회원만 콜라보를 의뢰할 수 있어요.")
    return user


# ── 받은 값 정리 ─────────────────────────────────────────────────────────


def _text(value, *, max_len: int, label: str, required: bool = False) -> str | None:
    v = (value or "").strip() if isinstance(value, str) or value is None else None
    if v is None:
        raise _bad(f"{label} 값이 올바르지 않아요.")
    if not v:
        if required:
            raise _bad(f"{label}을(를) 적어 주세요.")
        return None
    if len(v) > max_len:
        raise _bad(f"{label}은(는) {max_len}자까지 적을 수 있어요.")
    return v


def _date(value, label: str) -> date:
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError):
        raise _bad(f"{label}이(가) 올바르지 않아요.") from None


def _brand(db: Session, user: User, brand_id) -> AdvertiserBrand:
    try:
        brand = db.get(AdvertiserBrand, uuid.UUID(str(brand_id)))
    except (TypeError, ValueError):
        brand = None
    if brand is None or brand.user_id != user.id:
        raise _bad("브랜드를 다시 골라 주세요.")
    return brand


def _items(raw) -> list[dict]:
    if not isinstance(raw, list) or not raw:
        raise _bad("콜라보 기본안을 하나 이상 골라 주세요.")
    out: list[dict] = []
    seen: set[str] = set()
    for x in raw:
        if not isinstance(x, dict):
            raise _bad("콜라보 기본안 값이 올바르지 않아요.")
        key = x.get("key")
        prep = x.get("prep")
        if key not in ITEM_KEYS or key in seen:
            raise _bad("콜라보 기본안 값이 올바르지 않아요.")
        if prep not in PREP_KEYS:
            raise _bad("기본안마다 준비 상태를 골라 주세요.")
        note = _text(x.get("note"), max_len=100, label="기본안 조건", required=True)
        seen.add(key)
        out.append({"key": key, "prep": prep, "note": note})
    # 화면 순서대로.
    return sorted(out, key=lambda x: ITEM_KEYS.index(x["key"]))


def _preferred(db: Session, ids) -> list[dict]:
    """지정 희망 매장 — 매장 표에서 찾아 의뢰 당시 이름 · 지역 · 등급 · 금액을 적어 둔다. 없는 매장은 뺀다."""
    if not ids:
        return []
    if not isinstance(ids, list) or len(ids) > MAX_PREFERRED:
        raise _bad(f"지정 희망 매장은 {MAX_PREFERRED}곳까지 고를 수 있어요.")
    uids: list[uuid.UUID] = []
    for i in ids:
        try:
            u = uuid.UUID(str(i))
        except ValueError:
            continue
        if u not in uids:
            uids.append(u)
    stores = {s.id: s for s in db.query(PartnersStore).filter(PartnersStore.id.in_(uids)).all()} if uids else {}
    out = []
    for u in uids:
        s = stores.get(u)
        if s is None:
            continue
        out.append(
            {
                "id": str(s.id),
                "code": s.store_code,
                "name": s.name,
                "area": " ".join(x for x in (s.city, s.district) if x) or (s.address or ""),
                "grade": s.collab_grade,
                "fee": s.collab_fee,
            }
        )
    return out


def _int(value, label: str, *, lo: int = 0, hi: int = 10**10) -> int:
    try:
        n = int(value)
    except (TypeError, ValueError):
        raise _bad(f"{label} 값이 올바르지 않아요.") from None
    if n < lo or n > hi:
        raise _bad(f"{label} 값이 올바르지 않아요.")
    return n


def _estimate(raw) -> dict | None:
    """화면이 보여 준 예상 비용(참고용) — 숫자만 받는다."""
    if not isinstance(raw, dict):
        return None
    keys = ("total", "preferred", "rest", "avg", "negotiable")
    return {k: _int(raw.get(k, 0), "예상 비용") for k in keys}


SCHEDULE_DATE_KEYS = (
    "requestDate", "reviewEnd", "noticeDate", "recruitEnd", "confirmDue",
    "installStart", "startDate", "endDate", "removalDate",
)


def _schedule(raw) -> dict | None:
    """화면이 보여 준 예상 일정(참고용) — 날짜와 일수만 받는다."""
    if not isinstance(raw, dict):
        return None
    out: dict = {}
    for k in SCHEDULE_DATE_KEYS:
        if raw.get(k):
            out[k] = _date(raw[k], "예상 일정").isoformat()
    for k in ("installDays", "prepBusinessDays"):
        if raw.get(k) is not None:
            out[k] = _int(raw[k], "예상 일정", hi=1000)
    if "makeItems" in raw:
        out["makeItems"] = bool(raw["makeItems"])
    # 준비 기간이 빠듯한데도 권한 날짜(recommendedStart)보다 일찍 진행하는 데 동의(11-12 사용자) — 광고주 확인 창에서
    # 체크해야 보낼 수 있다. 동의한 기록으로 남겨 어드민 의뢰서에 보인다.
    if raw.get("earlyStartAgreed"):
        out["earlyStartAgreed"] = True
        if raw.get("recommendedStart"):
            out["recommendedStart"] = _date(raw["recommendedStart"], "예상 일정").isoformat()
    return out


def _apply(db: Session, user: User, req: AdvertiserCollabRequest, data: dict) -> None:
    brand = _brand(db, user, data.get("brand_id"))
    req.brand_id = brand.id
    req.brand_name = brand.name
    req.brand_image_url = brand.image_url
    req.title = _text(data.get("title"), max_len=30, label="캠페인명", required=True)
    req.summary = _text(data.get("summary"), max_len=100, label="한 줄 소개")

    start = _date(data.get("start_date"), "시작일")
    end = _date(data.get("end_date"), "종료일")
    if start <= _today_kst():
        raise _bad("시작일은 내일부터 고를 수 있어요.")
    if (end - start).days + 1 < MIN_PERIOD_DAYS:
        raise _bad(f"진행 기간은 최소 {MIN_PERIOD_DAYS}일이에요.")
    req.start_date, req.end_date = start, end

    contact = data.get("contact") or {}
    req.contact_name = _text(contact.get("name"), max_len=10, label="담당자 이름", required=True)
    phone = "".join(ch for ch in str(contact.get("phone") or "") if ch.isdigit())
    if not 9 <= len(phone) <= 11:
        raise _bad("전화번호를 9~11자리 숫자로 적어 주세요.")
    req.contact_phone = phone
    req.contact_role = _text(contact.get("role"), max_len=20, label="직책 또는 소속팀", required=True)

    req.items = _items(data.get("items"))
    req.extra_plan = _text(data.get("extra_plan"), max_len=1000, label="추가 기획")

    course = data.get("course")
    if course not in COURSES:
        raise _bad("모집 코스를 골라 주세요.")
    req.course = course
    req.min_stores = _int(data.get("min_stores"), "최소 매장 수", lo=1, hi=MAX_TARGET_STORES)
    req.target_stores = _int(data.get("target_stores"), "목표 매장 수", lo=1, hi=MAX_TARGET_STORES)
    if req.target_stores < req.min_stores:
        raise _bad("목표 매장 수는 최소 매장 수보다 적을 수 없어요.")

    req.preferred = _preferred(db, data.get("preferred_store_ids"))
    req.memo = _text(data.get("memo"), max_len=1000, label="admix에 남길 말")
    req.estimate = _estimate(data.get("estimate"))
    req.schedule = _schedule(data.get("schedule"))


def _next_code(db: Session) -> str:
    prefix = f"CR-{_today_kst():%y%m%d}-"
    last = (
        db.query(AdvertiserCollabRequest.code)
        .filter(AdvertiserCollabRequest.code.like(f"{prefix}%"))
        .order_by(AdvertiserCollabRequest.code.desc())
        .first()
    )
    n = int(last[0].removeprefix(prefix)) + 1 if last else 1
    return f"{prefix}{n:02d}"


# ── 광고주 ───────────────────────────────────────────────────────────────


def serialize_mine(req: AdvertiserCollabRequest) -> dict:
    return {
        "id": str(req.id),
        "code": req.code,
        "status": req.status,
        "createdAt": _iso(req.created_at),
        "updatedAt": _iso(req.updated_at),
        "cancelledAt": _iso(req.cancelled_at),
        "planFileName": req.plan_file_name,
    }


def serialize_mine_full(req: AdvertiserCollabRequest) -> dict:
    """내가 보낸 의뢰 한 건 전부 — 내 콜라보 · 상세 · 고쳐 다시 보내기가 이걸로 그린다(11-12, 다른 탭 · 다시 로그인해도 보이게)."""
    return {
        **serialize_mine(req),
        "brandId": str(req.brand_id) if req.brand_id else None,
        "brandName": req.brand_name,
        "brandImageUrl": req.brand_image_url,
        "title": req.title,
        "summary": req.summary,
        "startDate": _iso(req.start_date),
        "endDate": _iso(req.end_date),
        "contact": {"name": req.contact_name, "phone": req.contact_phone, "role": req.contact_role},
        "items": req.items or [],
        "extraPlan": req.extra_plan,
        "planFile": (
            {"name": req.plan_file_name, "size": req.plan_file_size} if req.plan_file_url else None
        ),
        "course": req.course,
        "minStores": req.min_stores,
        "targetStores": req.target_stores,
        "preferred": req.preferred or [],
        "memo": req.memo,
        "estimate": req.estimate,
        **_plan_block(req),
    }


def list_mine(db: Session, user: User) -> list[dict]:
    """내가 보낸 의뢰 — 최근 보낸 순."""
    ensure_advertiser(user)
    rows = (
        db.query(AdvertiserCollabRequest)
        .filter(AdvertiserCollabRequest.user_id == user.id)
        .order_by(AdvertiserCollabRequest.created_at.desc())
        .all()
    )
    return [serialize_mine_full(r) for r in rows]


def create(db: Session, user: User, data: dict) -> dict:
    ensure_advertiser(user)
    req = AdvertiserCollabRequest(user_id=user.id, status="submitted")
    _apply(db, user, req, data)
    req.code = _next_code(db)
    db.add(req)
    db.commit()
    db.refresh(req)
    return serialize_mine_full(req)


def _mine_or_404(db: Session, user: User, request_id: str) -> AdvertiserCollabRequest:
    try:
        req = db.get(AdvertiserCollabRequest, uuid.UUID(request_id))
    except ValueError:
        req = None
    if req is None or req.user_id != user.id:
        raise HTTPException(status_code=404, detail="의뢰를 찾을 수 없어요.")
    return req


def _not_cancelled(req: AdvertiserCollabRequest) -> None:
    if req.status == "cancelled":
        raise HTTPException(status_code=409, detail="취소한 의뢰는 고칠 수 없어요. 새로 의뢰해 주세요.")


def cancel(db: Session, user: User, request_id: str) -> dict:
    """의뢰 취소(084) — 지우지 않고 cancelled 로 남긴다(2026-11-12 사용자: "취소해도 내역엔 남게, 어드민에도").
    updated_at 은 "고쳐 다시 보낸 때"라 그대로 둔다(onupdate 막기). 이미 취소했으면 그대로 돌려준다."""
    ensure_advertiser(user)
    req = _mine_or_404(db, user, request_id)
    if req.status == "confirmed":
        # 확정한 기획안(085)은 콜라보 준비가 시작돼 여기서 거둘 수 없다.
        raise HTTPException(status_code=409, detail="확정한 기획안은 여기서 취소할 수 없어요. admix에 문의해 주세요.")
    if req.status != "cancelled":
        M = AdvertiserCollabRequest
        db.query(M).filter(M.id == req.id).update(
            {M.status: "cancelled", M.cancelled_at: datetime.now(timezone.utc), M.updated_at: M.updated_at},
            synchronize_session=False,
        )
        db.commit()
        db.refresh(req)
    return serialize_mine_full(req)


def update(db: Session, user: User, request_id: str, data: dict) -> dict:
    """고친 의뢰 다시 보내기 — 같은 줄을 통째로 바꾸고 다시 '새 의뢰'로(어드민 숫자에 다시 센다).
    keep_plan_file 이 거짓이면 올려 둔 첨부를 지운다(새 파일은 save_plan_file 로 따로)."""
    ensure_advertiser(user)
    req = _mine_or_404(db, user, request_id)
    _not_cancelled(req)
    if req.rounds or req.status != "submitted":
        # admix 기획안이 한 번이라도 오갔으면 의뢰서를 통째로 바꾸지 않고 기획안에서 항목별로 고친다(085).
        raise HTTPException(status_code=409, detail="admix 기획안이 오간 의뢰는 기획안에서 항목별로 고쳐 주세요.")
    _apply(db, user, req, data)
    if not data.get("keep_plan_file", True):
        _remove_plan_file(req)
    req.status = "submitted"
    req.admin_viewed_at = None
    db.commit()
    db.refresh(req)
    return serialize_mine_full(req)


def _plan_path(url: str | None) -> Path | None:
    if not url:
        return None
    return Path(get_settings().upload_dir) / url.removeprefix("/uploads/")


def _remove_plan_file(req: AdvertiserCollabRequest) -> None:
    path = _plan_path(req.plan_file_url)
    if path is not None:
        path.unlink(missing_ok=True)
    req.plan_file_url = None
    req.plan_file_name = None
    req.plan_file_size = None


def save_plan_file(db: Session, user: User, request_id: str, file: UploadFile) -> dict:
    """추가 기획 첨부 — 기획서 1개, 20MB. 이미 있으면 바꾼다."""
    ensure_advertiser(user)
    req = _mine_or_404(db, user, request_id)
    _not_cancelled(req)
    ext, content = _read_upload(file)
    _remove_plan_file(req)
    rel = f"collab-request/{user.id}/{uuid.uuid4().hex}{ext}"
    dest = Path(get_settings().upload_dir) / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(content)
    req.plan_file_url = f"/uploads/{rel}"
    req.plan_file_name = (file.filename or dest.name)[:255]
    req.plan_file_size = len(content)
    db.commit()
    db.refresh(req)
    return serialize_mine_full(req)


def _read_upload(file: UploadFile) -> tuple[str, bytes]:
    """첨부 검사 — 의뢰서 첨부와 같은 확장자 · 20MB."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in PLAN_FILE_EXTS:
        raise _bad("PDF · PPT · 문서 · 이미지 파일만 올릴 수 있어요.")
    content = file.file.read(PLAN_FILE_MAX + 1)
    if len(content) > PLAN_FILE_MAX:
        raise _bad("20MB 이하 파일만 올릴 수 있어요.")
    return ext, content


def _round_file_path(req: AdvertiserCollabRequest, file_id: str) -> Path | None:
    if not isinstance(file_id, str) or not ROUND_FILE_ID.match(file_id):
        return None
    return Path(get_settings().upload_dir) / ROUND_FILE_DIR / str(req.id) / file_id


def _request_file_entry(req: AdvertiserCollabRequest) -> dict | None:
    if not req.plan_file_url:
        return None
    return {
        "id": REQUEST_FILE_ID,
        "name": req.plan_file_name or "첨부 파일",
        "size": req.plan_file_size,
        "by": "advertiser",
    }


# ── 어드민 ───────────────────────────────────────────────────────────────


def _advertiser(u: User | None) -> dict | None:
    if u is None:
        return None
    return {
        "id": str(u.id),
        "loginId": u.login_id,
        "name": u.name,
        "email": u.email,
        "phone": u.phone,
        "companyName": u.company_name,
        "contactName": u.contact_name,
        "position": u.position,
        "department": u.department,
    }


def _admin_row(req: AdvertiserCollabRequest, user: User | None) -> dict:
    # 캠페인 · 기간 · 매장 · 비용은 마지막 기획안 차수(085) 값으로 — 차수가 없으면 처음 의뢰서 그대로.
    c = _latest_content(req)
    estimate = c.get("estimate") or {}
    return {
        "id": str(req.id),
        "code": req.code,
        "status": req.status,
        # 취소한 의뢰는 처리할 일이 없어 "새 의뢰"로 세지 않는다.
        "isNew": req.admin_viewed_at is None and req.status != "cancelled",
        "cancelledAt": _iso(req.cancelled_at),
        "brandName": req.brand_name,
        "brandImageUrl": req.brand_image_url,
        "title": c.get("title"),
        "startDate": c.get("startDate"),
        "endDate": c.get("endDate"),
        "course": c.get("course"),
        "minStores": c.get("minStores"),
        "targetStores": c.get("targetStores"),
        "itemKeys": [x.get("key") for x in (c.get("items") or [])],
        "preferredCount": len(c.get("preferred") or []),
        "estimateTotal": estimate.get("total"),
        "estimateNegotiable": estimate.get("negotiable", 0),
        "contactName": req.contact_name,
        "advertiser": _advertiser(user),
        "createdAt": _iso(req.created_at),
        "updatedAt": _iso(req.updated_at),
        # 기획안 차수(085) — 몇 차까지 오갔는지 · 마지막에 누가 보냈는지 · 확정한 때.
        "roundCount": len(req.rounds or []),
        "lastRoundAuthor": req.rounds[-1].author if req.rounds else None,
        "confirmedAt": _iso(req.confirmed_at),
    }


def admin_list(
    db: Session, *, keyword: str | None = None, status: str | None = None, page: int = 1, page_size: int = 20
) -> tuple[int, list[dict]]:
    q = db.query(AdvertiserCollabRequest, User).outerjoin(User, User.id == AdvertiserCollabRequest.user_id)
    M = AdvertiserCollabRequest
    if status == "new":
        q = q.filter(M.admin_viewed_at.is_(None), M.status != "cancelled")
    elif status == "viewed":
        q = q.filter(M.admin_viewed_at.isnot(None), M.status != "cancelled")
    elif status == "cancelled":
        q = q.filter(M.status == "cancelled")
    elif status in PLAN_STATUSES:
        q = q.filter(M.status == status)
    kw = (keyword or "").strip()
    if kw:
        like = f"%{kw}%"
        q = q.filter(
            or_(
                AdvertiserCollabRequest.code.ilike(like),
                AdvertiserCollabRequest.title.ilike(like),
                AdvertiserCollabRequest.brand_name.ilike(like),
                AdvertiserCollabRequest.contact_name.ilike(like),
                AdvertiserCollabRequest.contact_phone.ilike(f"%{''.join(c for c in kw if c.isdigit()) or kw}%"),
                User.company_name.ilike(like),
                User.name.ilike(like),
                User.login_id.ilike(like),
                cast(AdvertiserCollabRequest.preferred, String).ilike(like),
            )
        )
    total = q.count()
    rows = (
        q.order_by(AdvertiserCollabRequest.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return total, [_admin_row(r, u) for r, u in rows]


def _admin_or_404(db: Session, request_id: str) -> AdvertiserCollabRequest:
    try:
        req = db.get(AdvertiserCollabRequest, uuid.UUID(request_id))
    except ValueError:
        req = None
    if req is None:
        raise HTTPException(status_code=404, detail="의뢰를 찾을 수 없어요.")
    return req


def admin_get(db: Session, request_id: str) -> dict:
    """의뢰서 한 장 — 처음 열면 '봄'으로 적어 사이드 메뉴 숫자에서 빠진다."""
    req = _admin_or_404(db, request_id)
    user = db.get(User, req.user_id)
    brand = db.get(AdvertiserBrand, req.brand_id) if req.brand_id else None
    out = _admin_row(req, user)
    if req.admin_viewed_at is None:
        # updated_at 은 광고주가 보낸(고쳐 다시 보낸) 때라, 어드민이 열었다고 바뀌지 않게 그대로 둔다(onupdate 막기).
        M = AdvertiserCollabRequest
        db.query(M).filter(M.id == req.id).update(
            {M.admin_viewed_at: datetime.now(timezone.utc), M.updated_at: M.updated_at},
            synchronize_session=False,
        )
        db.commit()
        db.refresh(req)
    # 상세는 서류(처음 의뢰서)가 기준 — 목록 줄의 마지막 차수 값을 처음 의뢰서 값으로 되돌린다. 차수는 아래 rounds 에.
    out.update(_original_content(req))
    out.update(
        contact={"name": req.contact_name, "phone": req.contact_phone, "role": req.contact_role},
        planFile=(
            {"name": req.plan_file_name, "size": req.plan_file_size} if req.plan_file_url else None
        ),
        memo=req.memo,
        brand=serialize_brand(brand) if brand else None,
        viewedAt=_iso(req.admin_viewed_at),
        **_plan_block(req),
    )
    return out


def plan_file(db: Session, request_id: str) -> tuple[Path, str]:
    req = _admin_or_404(db, request_id)
    path = _plan_path(req.plan_file_url)
    if path is None:
        raise HTTPException(status_code=404, detail="첨부 파일이 없어요.")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없어요.")
    return path, (req.plan_file_name or path.name)


def submitted_count(db: Session) -> int:
    """admix가 처리할 의뢰 수 — 사이드 메뉴 "콜라보 의뢰" 옆 숫자(2026-11-12 사용자: 몇 건 들어왔는지).
    기획안 차수(085) 뒤로는 admix 차례인 의뢰만 센다: 접수(submitted) · 광고주가 고쳐 보냄(revised)."""
    return (
        db.query(func.count(AdvertiserCollabRequest.id))
        .filter(AdvertiserCollabRequest.status.in_(ADMIX_TURN_STATUSES))
        .scalar()
        or 0
    )


def new_count(db: Session) -> int:
    """어드민이 아직 열어 보지 않은 의뢰 수 — 바뀌면 사이드 메뉴가 의뢰 목록을 다시 불러온다."""
    return (
        db.query(func.count(AdvertiserCollabRequest.id))
        .filter(
            AdvertiserCollabRequest.admin_viewed_at.is_(None),
            AdvertiserCollabRequest.status != "cancelled",
        )
        .scalar()
        or 0
    )


# ── 기획안 차수(085) ─────────────────────────────────────────────────────

Round = AdvertiserCollabRequestRound

# 항목 키 — 비교 · 수정 이유의 단위. 기본안은 6가지가 각각 한 항목.
FIELD_KEYS: tuple[str, ...] = (
    "title", "summary", "period", "course", "stores",
    *(f"item:{k}" for k in ITEM_KEYS),
    "extraPlan", "preferred",
)
NOTE_MAX = 300
# 목록에서 거를 수 있는 기획안 상태.
PLAN_STATUSES = ("submitted", "proposed", "revised", "confirmed")
# admix가 기획안을 보낼(다시 보낼) 차례 — 사이드 메뉴 숫자는 이 가운데 proposed 를 뺀다(광고주 차례).
ADMIX_TURN_STATUSES = ("submitted", "revised")


def _original_content(req: AdvertiserCollabRequest) -> dict:
    """0차 — 광고주가 처음 보낸 의뢰서의 고칠 수 있는 내용."""
    return {
        "title": req.title,
        "summary": req.summary,
        "startDate": _iso(req.start_date),
        "endDate": _iso(req.end_date),
        "course": req.course,
        "minStores": req.min_stores,
        "targetStores": req.target_stores,
        "items": req.items or [],
        "extraPlan": req.extra_plan,
        "files": [f for f in [_request_file_entry(req)] if f],
        "preferred": req.preferred or [],
        "estimate": req.estimate,
        "schedule": req.schedule,
    }


def _round_contents(req: AdvertiserCollabRequest) -> list[dict]:
    """차수마다 내용 — files 가 없는 옛 차수(첨부 전)는 바로 앞 차수의 목록을 이어받는다. 0차는 넣지 않는다."""
    files = _original_content(req)["files"]
    out: list[dict] = []
    for r in req.rounds or []:
        content = dict(r.content or {})
        if not isinstance(content.get("files"), list):
            content["files"] = files
        files = content["files"]
        out.append(content)
    return out


def _latest_content(req: AdvertiserCollabRequest) -> dict:
    contents = _round_contents(req)
    return contents[-1] if contents else _original_content(req)


def _field_value(content: dict, key: str):
    """항목 하나의 비교 값 — 빈 글자와 없음은 같게 본다."""
    if key == "period":
        return (content.get("startDate"), content.get("endDate"))
    if key == "stores":
        return (content.get("minStores"), content.get("targetStores"))
    if key.startswith("item:"):
        k = key.removeprefix("item:")
        row = next((x for x in content.get("items") or [] if x.get("key") == k), None)
        return (row.get("prep"), (row.get("note") or "").strip()) if row else None
    if key == "preferred":
        return [p.get("id") for p in content.get("preferred") or []]
    if key == "extraPlan":
        # 추가 기획 = 글 + 첨부 — 파일을 붙이거나 빼도 이 항목이 '수정'이다.
        v = content.get("extraPlan")
        text = v.strip() if isinstance(v, str) and v.strip() else None
        return (text, [f.get("id") for f in content.get("files") or [] if isinstance(f, dict)])
    v = content.get(key)
    return v.strip() if isinstance(v, str) and v.strip() else (v or None)


def changed_keys(before: dict, after: dict) -> list[str]:
    return [k for k in FIELD_KEYS if _field_value(before, k) != _field_value(after, k)]


def _clean_files(req: AdvertiserCollabRequest, raw, base: dict, *, author: str) -> list[dict]:
    """추가 기획 첨부 목록 — 광고주는 기획안에서 첨부를 바꾸지 않는다(앞 차수 그대로).
    admix 는 앞 차수에 있던 파일 · 광고주 의뢰서 첨부를 남기거나 빼고, 미리 올려 둔 파일(admin_upload_round_file)을 더한다."""
    known = {f.get("id"): f for f in base.get("files") or [] if isinstance(f, dict)}
    if author != "admix":
        return list(known.values())
    if raw is None:
        return list(known.values())
    if not isinstance(raw, list):
        raise _bad("첨부 파일 값이 올바르지 않아요.")
    request_file = _request_file_entry(req)
    out: list[dict] = []
    for f in raw:
        fid = f.get("id") if isinstance(f, dict) else None
        if not isinstance(fid, str) or any(x["id"] == fid for x in out):
            continue
        if fid in known:
            out.append(known[fid])
        elif fid == REQUEST_FILE_ID and request_file:
            out.append(request_file)
        else:
            path = _round_file_path(req, fid)
            if path is None or not path.is_file():
                raise _bad("올린 첨부 파일을 찾을 수 없어요. 파일을 다시 올려 주세요.")
            name = _text(f.get("name") if isinstance(f.get("name"), str) else None, max_len=255, label="파일 이름")
            out.append({"id": fid, "name": name or fid, "size": path.stat().st_size, "by": "admix"})
    if len(out) > ROUND_FILE_MAX_COUNT:
        raise _bad(f"첨부 파일은 {ROUND_FILE_MAX_COUNT}개까지예요.")
    return out


def _clean_content(db: Session, req: AdvertiserCollabRequest, raw, base: dict, *, author: str) -> dict:
    """차수 하나의 내용 — 의뢰서와 같은 규칙으로 검사한다. 지정 희망 매장은 앞 차수에 있던 매장은 그때 값 그대로,
    새로 넣은 매장만 매장 표에서 찾아 적는다(금액이 바뀌었다고 '수정'으로 보이지 않게)."""
    if not isinstance(raw, dict):
        raise _bad("기획안 값이 올바르지 않아요.")
    out: dict = {
        "title": _text(raw.get("title"), max_len=30, label="캠페인명", required=True),
        "summary": _text(raw.get("summary"), max_len=100, label="한 줄 소개"),
    }
    start = _date(raw.get("startDate"), "시작일")
    end = _date(raw.get("endDate"), "종료일")
    # 기간을 고칠 때만 '내일부터'를 본다 — 손대지 않은 기간까지 막으면 오래 걸린 의뢰는 보낼 수 없다.
    if (start.isoformat(), end.isoformat()) != _field_value(base, "period") and start <= _today_kst():
        raise _bad("시작일은 내일부터 고를 수 있어요.")
    if (end - start).days + 1 < MIN_PERIOD_DAYS:
        raise _bad(f"진행 기간은 최소 {MIN_PERIOD_DAYS}일이에요.")
    out["startDate"], out["endDate"] = start.isoformat(), end.isoformat()

    course = raw.get("course")
    if course not in COURSES:
        raise _bad("모집 코스를 골라 주세요.")
    out["course"] = course
    out["minStores"] = _int(raw.get("minStores"), "최소 매장 수", lo=1, hi=MAX_TARGET_STORES)
    out["targetStores"] = _int(raw.get("targetStores"), "목표 매장 수", lo=1, hi=MAX_TARGET_STORES)
    if out["targetStores"] < out["minStores"]:
        raise _bad("목표 매장 수는 최소 매장 수보다 적을 수 없어요.")

    out["items"] = _items(raw.get("items"))
    out["extraPlan"] = _text(raw.get("extraPlan"), max_len=1000, label="추가 기획")
    out["files"] = _clean_files(req, raw.get("files"), base, author=author)

    ids = raw.get("preferredIds")
    if ids is None:
        ids = [p.get("id") for p in raw.get("preferred") or [] if isinstance(p, dict)]
    if not isinstance(ids, list) or len(ids) > MAX_PREFERRED:
        raise _bad(f"지정 희망 매장은 {MAX_PREFERRED}곳까지 고를 수 있어요.")
    known = {p.get("id"): p for p in base.get("preferred") or []}
    found = {p["id"]: p for p in _preferred(db, [i for i in ids if str(i) not in known])}
    preferred: list[dict] = []
    for i in ids:
        p = known.get(str(i)) or found.get(str(i))
        if p and all(x["id"] != p["id"] for x in preferred):
            preferred.append(p)
    if len(preferred) > out["targetStores"]:
        raise _bad(f"지정 희망 매장({len(preferred)}곳)보다 목표 매장 수가 적어요.")
    out["preferred"] = preferred
    out["estimate"] = _estimate(raw.get("estimate"))
    out["schedule"] = _schedule(raw.get("schedule"))
    return out


def _clean_notes(raw) -> dict:
    """항목별 수정 이유 {항목 키: 글} — 모르는 키 · 빈 글은 뺀다."""
    if not isinstance(raw, dict):
        return {}
    out: dict = {}
    for k, v in raw.items():
        if k in FIELD_KEYS:
            t = _text(v if isinstance(v, str) else None, max_len=NOTE_MAX, label="수정 이유")
            if t:
                out[k] = t
    return out


def serialize_round(r: AdvertiserCollabRequestRound, content: dict | None = None) -> dict:
    return {
        "round": r.round_no,
        "author": r.author,
        "baseRound": r.base_round_no,
        "content": content if content is not None else r.content,
        "notes": r.notes or {},
        "changed": r.changed or [],
        "createdAt": _iso(r.created_at),
    }


def _plan_block(req: AdvertiserCollabRequest) -> dict:
    """의뢰 응답에 붙는 기획안 — 0차(처음 의뢰서) · 차수들 · 확정한 때."""
    return {
        "original": _original_content(req),
        "rounds": [serialize_round(r, c) for r, c in zip(req.rounds or [], _round_contents(req))],
        "confirmedAt": _iso(req.confirmed_at),
    }


def _check_base(req: AdvertiserCollabRequest, data: dict) -> None:
    """펼쳐 둔 차수가 지금 마지막 차수인지 — 그사이 상대가 보냈으면 덮어쓰지 않게 다시 보게 한다."""
    latest = req.rounds[-1].round_no if req.rounds else 0
    try:
        seen = int(data.get("baseRound"))
    except (TypeError, ValueError):
        raise _bad("기획안 차수 값이 올바르지 않아요.") from None
    if seen != latest:
        raise HTTPException(status_code=409, detail="그사이 기획안이 바뀌었어요. 새로 불러와서 다시 확인해 주세요.")


def _add_round(
    db: Session,
    req: AdvertiserCollabRequest,
    data: dict,
    *,
    author: str,
    admin_id=None,
    require_change: bool,
) -> AdvertiserCollabRequestRound:
    _check_base(req, data)
    base = _latest_content(req)
    content = _clean_content(db, req, data.get("content"), base, author=author)
    changed = changed_keys(base, content)
    if require_change and not changed:
        raise _bad("바꾼 항목이 없어요. 그대로 괜찮으면 확정해 주세요.")
    notes = _clean_notes(data.get("notes"))
    latest = req.rounds[-1].round_no if req.rounds else 0
    r = Round(
        request_id=req.id,
        round_no=latest + 1,
        author=author,
        base_round_no=latest,
        content=content,
        notes=notes,
        changed=changed,
        admin_id=admin_id,
    )
    req.rounds.append(r)
    return r


def _commit_round(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="그사이 기획안이 바뀌었어요. 새로 불러와서 다시 확인해 주세요."
        ) from None


def admin_send_round(db: Session, admin: Admin, request_id: str, data: dict) -> dict:
    """admix 기획안 보내기 — 지금 펼친 차수(처음 의뢰서 또는 광고주가 고친 차수)를 항목별로 고쳐 광고주에게 보낸다.
    바꾼 항목이 없어도 보낼 수 있다(이대로 진행해도 된다는 기획안). 광고주 확인을 기다리는 중에도 다시 고쳐 보낼 수 있다.
    updated_at 은 광고주가 보낸 때로 쓰므로 그대로 둔다."""
    req = _admin_or_404(db, request_id)
    if req.status == "cancelled":
        raise HTTPException(status_code=409, detail="광고주가 취소한 의뢰예요.")
    if req.status == "confirmed":
        raise HTTPException(status_code=409, detail="광고주가 이미 확정한 기획안이에요.")
    _add_round(db, req, data, author="admix", admin_id=admin.id, require_change=False)
    db.flush()
    M = AdvertiserCollabRequest
    db.query(M).filter(M.id == req.id).update(
        {M.status: "proposed", M.updated_at: M.updated_at}, synchronize_session=False
    )
    _commit_round(db)
    db.refresh(req)
    return admin_get(db, request_id)


def admin_upload_round_file(db: Session, request_id: str, file: UploadFile) -> dict:
    """admix 기획안 첨부 올리기 — 파일만 올려 두고 id 를 돌려준다. 기획안을 보낼 때 content.files 에 넣어야 광고주에게 간다."""
    req = _admin_or_404(db, request_id)
    if req.status == "cancelled":
        raise HTTPException(status_code=409, detail="광고주가 취소한 의뢰예요.")
    if req.status == "confirmed":
        raise HTTPException(status_code=409, detail="광고주가 이미 확정한 기획안이에요.")
    ext, content = _read_upload(file)
    file_id = f"{uuid.uuid4().hex}{ext}"
    dest = _round_file_path(req, file_id)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(content)
    name = (file.filename or file_id)[:255]
    return {"id": file_id, "name": name, "size": len(content), "by": "admix"}


def _file_of(req: AdvertiserCollabRequest, file_id: str, *, sent_only: bool) -> tuple[Path, str]:
    """첨부 한 개 — "request" 는 광고주 의뢰서 첨부. sent_only 면 차수에 넣어 보낸 파일만(광고주)."""
    if file_id == REQUEST_FILE_ID:
        path = _plan_path(req.plan_file_url)
        name = req.plan_file_name
    else:
        listed = next(
            (f for c in _round_contents(req) for f in c.get("files") or [] if f.get("id") == file_id),
            None,
        )
        if sent_only and listed is None:
            raise HTTPException(status_code=404, detail="첨부 파일이 없어요.")
        path = _round_file_path(req, file_id)
        name = listed.get("name") if listed else None
    if path is None or not path.is_file():
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없어요.")
    return path, (name or path.name)


def admin_round_file(db: Session, request_id: str, file_id: str) -> tuple[Path, str]:
    return _file_of(_admin_or_404(db, request_id), file_id, sent_only=False)


def round_file(db: Session, user: User, request_id: str, file_id: str) -> tuple[Path, str]:
    """광고주가 기획안 첨부 받기 — 내 의뢰의, 차수에 들어간 파일(또는 내 의뢰서 첨부)만."""
    ensure_advertiser(user)
    return _file_of(_mine_or_404(db, user, request_id), file_id, sent_only=True)


def send_round(db: Session, user: User, request_id: str, data: dict) -> dict:
    """광고주가 admix 기획안을 항목별로 다시 고쳐 보내기 — admix 차례로 돌아가고 어드민에 새 의뢰처럼 센다."""
    ensure_advertiser(user)
    req = _mine_or_404(db, user, request_id)
    _not_cancelled(req)
    if req.status == "confirmed":
        raise HTTPException(status_code=409, detail="이미 확정한 기획안이에요.")
    if req.status != "proposed":
        raise HTTPException(status_code=409, detail="admix가 검토하고 있어요. 기획안이 오면 고칠 수 있어요.")
    _add_round(db, req, data, author="advertiser", require_change=True)
    req.status = "revised"
    req.admin_viewed_at = None
    _commit_round(db)
    db.refresh(req)
    return serialize_mine_full(req)


def confirm(db: Session, user: User, request_id: str, data: dict) -> dict:
    """광고주가 admix 기획안을 확정 — 본 차수가 지금 마지막 차수일 때만. updated_at 은 그대로 둔다."""
    ensure_advertiser(user)
    req = _mine_or_404(db, user, request_id)
    _not_cancelled(req)
    if req.status == "confirmed":
        return serialize_mine_full(req)
    if req.status != "proposed" or not req.rounds:
        raise HTTPException(status_code=409, detail="확정할 admix 기획안이 없어요.")
    latest = req.rounds[-1].round_no
    try:
        seen = int((data or {}).get("round"))
    except (TypeError, ValueError):
        raise _bad("기획안 차수 값이 올바르지 않아요.") from None
    if seen != latest:
        raise HTTPException(status_code=409, detail="그사이 기획안이 바뀌었어요. 새로 불러와서 다시 확인해 주세요.")
    M = AdvertiserCollabRequest
    db.query(M).filter(M.id == req.id).update(
        {M.status: "confirmed", M.confirmed_at: datetime.now(timezone.utc), M.updated_at: M.updated_at},
        synchronize_session=False,
    )
    db.commit()
    db.refresh(req)
    return serialize_mine_full(req)
