"""콜라보 모집 · 참여 · 진행(069) — 제휴사 /partners 화면과 어드민 "콜라보 → 콜라보 관리".

매장 화면이 보는 한 줄(serialize_for_store)은 예전 예시 데이터(frontend lib/partnersPreview.ts PreviewCollab)와 같은 모양이다.
매장의 입장(standing)은 참여 기록에서 계산한다.
  none 신청 전 · blocked 기간이 겹쳐 신청 불가 · candidate 선정 후보 n번 · reserve 예비 n번
  · requested 확정 요청 받음 · confirmed 최종 확정 · declined 미참여 · cancelled 취소
후보 · 예비 순번은 신청 시각 순서(확정 요청 · 확정한 매장도 자리를 차지한다)로 목표 매장 수 안이면 후보, 넘으면 예비.
날짜는 한국 시간(KST) 기준.
"""
from __future__ import annotations

import os
import uuid
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

from fastapi import HTTPException, UploadFile
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from src.config import get_settings
from src.models.collab import Collab, CollabNotice, CollabParticipant, CollabPhoto, CollabReportFile
from src.models.member_profile import BusinessRegistration
from src.models.partners_store import PartnersStore, PartnersStoreRequest
from src.models.user import User
from src.services import collab_request_service
from src.services import partners_service as ps

KST = timezone(timedelta(hours=9))
PHOTO_STEPS = ("install", "check1", "check2", "check3")
CHECK_STEPS = ("check1", "check2", "check3")
CHECK_PCTS = (0.25, 0.6, 0.9)
# 자리를 차지하는 참여(후보 · 예비 순번을 셀 때 같이 센다).
ACTIVE = ("applied", "requested", "confirmed")
# 기간이 겹치면 다른 콜라보에 신청할 수 없게 하는 참여.
HOLDING = ("requested", "confirmed")
# passed — 매장이 모집 기간에 "미참여"로 답함(2026-11-12 사용자). declined 는 신청한 뒤 확정 요청 전에 빠진 것(어드민 처리).
PARTICIPANT_STATUSES = ("applied", "requested", "confirmed", "declined", "cancelled", "passed")
COLLAB_STATUSES = ("draft", "published", "cancelled")
COLLAB_TYPES = ("ready", "made")
COLLAB_PHOTO_MAX_SIDE = 1600
# 진행 항목의 준비 주체(2026-11-12 사용자 "콜라보 진행" — admix가 제작할 것을 모아 본다).
# 광고주 의뢰서 items.prep 과 같은 값: ready 브랜드가 가진 것 · made 브랜드가 만든다 · admix admix가 만든다.
ITEM_PREPS = ("ready", "made", "admix")
# 콜라보 진행(끝나지 않은 콜라보) · 콜라보 결과(끝난 콜라보) 단계.
PROGRESS_PHASES = ("draft", "scheduled", "recruiting", "selecting", "running")
# 결과 보고서 파일(086) — 콜라보 결과에서 올려 모아 둔다. 사진이 든 PDF 를 생각해 50MB(nginx 100m 안).
REPORT_FILE_MAX = 50 * 1024 * 1024
REPORT_FILE_EXTS = {
    ".pdf", ".ppt", ".pptx", ".key", ".doc", ".docx", ".hwp", ".hwpx", ".xls", ".xlsx", ".zip",
    ".jpg", ".jpeg", ".png", ".webp",
}
ADMIX_CONFIRMER = "admix 대리 확정"


def today_kst() -> date:
    return datetime.now(KST).date()


def _d(v: date | None) -> str | None:
    return v.isoformat() if v else None


def _iso(v: datetime | None) -> str | None:
    return v.isoformat() if v else None


def make_checks(start: date, end: date) -> list[dict]:
    """점검일 — 진행 기간의 25 · 60 · 90% 날(몇 일차인지와 함께). 예시 데이터와 같은 규칙."""
    days = (end - start).days + 1
    out = []
    for step, pct in zip(CHECK_STEPS, CHECK_PCTS):
        day = max(1, round(days * pct))
        out.append({"step": step, "date": (start + timedelta(days=day - 1)).isoformat(), "day": day})
    return out


def _default_confirm_due(c: Collab) -> datetime:
    """최종 확정 기한이 비어 있으면 — 모집 마감 4일 뒤(설치 전날을 넘지 않게) 18시."""
    due = min(c.recruit_end + timedelta(days=4), c.install_date - timedelta(days=1))
    due = max(due, c.recruit_end)
    return datetime.combine(due, time(18, 0), tzinfo=KST)


def _overlaps(a: Collab, b: Collab) -> bool:
    return a.install_date <= b.removal_date and b.install_date <= a.removal_date


def _get_collab(db: Session, collab_id: str) -> Collab:
    try:
        c = db.get(Collab, uuid.UUID(str(collab_id)))
    except ValueError:
        c = None
    if c is None:
        raise HTTPException(status_code=404, detail="콜라보를 찾을 수 없어요.")
    return c


def _ranks(db: Session, collab_ids: list) -> tuple[dict, dict]:
    """콜라보별 자리 차지 순번(참여 id → 순번)과 신청 매장 수."""
    rank: dict = {}
    count: dict = {}
    if not collab_ids:
        return rank, count
    rows = (
        db.query(CollabParticipant.id, CollabParticipant.collab_id)
        .filter(CollabParticipant.collab_id.in_(collab_ids), CollabParticipant.status.in_(ACTIVE))
        .order_by(CollabParticipant.applied_at, CollabParticipant.id)
        .all()
    )
    for pid, cid in rows:
        count[cid] = count.get(cid, 0) + 1
        rank[pid] = count[cid]
    return rank, count


# ── 매장 화면 ───────────────────────────────────────────────────────────


def _standing(c: Collab, p: CollabParticipant | None, rank: int | None, blocked: bool) -> tuple[str, int | None]:
    if p is None:
        return ("blocked" if blocked else "none"), None
    if c.status == "cancelled" and p.status in ACTIVE:
        return "cancelled", None
    if p.status == "applied":
        r = rank or 0
        if r <= c.target_stores:
            return "candidate", r
        return "reserve", r - c.target_stores
    return p.status, None


def serialize_for_store(
    c: Collab,
    p: CollabParticipant | None,
    *,
    rank: int | None = None,
    applied: int = 0,
    blocked: bool = False,
) -> dict:
    standing, slot = _standing(c, p, rank, blocked)
    show_notices = p is not None and p.status in ("requested", "confirmed")
    out = dict(
        id=str(c.id),
        brand=c.brand_name,
        brandImage=c.brand_image_url,
        title=c.title,
        summary=c.summary or "",
        type=c.collab_type,
        recruitStart=_d(c.recruit_start),
        recruitEnd=_d(c.recruit_end),
        confirmDue=_iso(c.confirm_due or _default_confirm_due(c)),
        installDate=_d(c.install_date),
        startDate=_d(c.start_date),
        endDate=_d(c.end_date),
        removalDate=_d(c.removal_date),
        checks=list(c.checks or make_checks(c.start_date, c.end_date)),
        task=c.task or "",
        # 준비 주체(prep)는 어드민 콜라보 진행용이라 매장 화면엔 빼고 보낸다.
        items=[dict(label=it.get("label", ""), note=it.get("note", "")) for it in (c.items or [])],
        space=c.space or "",
        quantity=c.quantity or 0,
        benefit=c.benefit or "",
        staffScript=c.staff_script or "",
        targetStores=c.target_stores,
        appliedStores=applied,
        standing=standing,
        notices=[
            dict(id=str(n.id), title=n.title, body=n.body, author=n.author, at=_iso(n.created_at))
            for n in c.notices
        ]
        if show_notices
        else [],
        photos=[
            dict(step=ph.step, at=_iso(ph.created_at), by=ph.uploaded_by, thumb=ph.image_url)
            for ph in (p.photos if p is not None else [])
        ],
        restockRequested=bool(p is not None and p.restock_requested_at),
        readNoticeIds=list(p.read_notice_ids or []) if p is not None else [],
    )
    if slot is not None:
        out["slotNo"] = slot
    if p is not None and p.confirm_no:
        out.update(
            confirmNo=p.confirm_no,
            confirmedAt=_iso(p.confirmed_at),
            confirmer=p.confirmer,
            checkedItems=p.checked_items,
        )
    return out


def _ensure_agreed(user: User) -> None:
    if user.partner_agreed_at is None:
        raise HTTPException(status_code=403, detail="기본협약에 동의하면 콜라보에 참여할 수 있어요.")


def list_for_store(db: Session, user: User, store_id: str) -> dict:
    """이 매장이 보는 콜라보 — 지금 모집 중인 공고 + 이 매장이 참여한(했던) 콜라보."""
    store = ps.own_store(db, user, store_id)
    today = today_kst()
    mine = (
        db.query(CollabParticipant)
        .options(selectinload(CollabParticipant.photos))
        .filter(CollabParticipant.store_id == store.id)
        .all()
    )
    by_collab = {p.collab_id: p for p in mine}
    q = (
        db.query(Collab)
        .options(selectinload(Collab.notices))
        .filter(
            Collab.status != "draft",
            or_(
                (Collab.status == "published")
                & (Collab.recruit_start <= today)
                & (Collab.recruit_end >= today),
                Collab.id.in_(list(by_collab.keys()) or [uuid.uuid4()]),
            ),
        )
    )
    collabs = q.all()
    rank, count = _ranks(db, [c.id for c in collabs])
    holding = [
        c for c in collabs if (p := by_collab.get(c.id)) and p.status in HOLDING and c.status != "cancelled"
    ]
    items = []
    for c in collabs:
        p = by_collab.get(c.id)
        if p is None and c.status == "cancelled":
            continue
        blocked = p is None and any(_overlaps(c, h) for h in holding)
        items.append(
            serialize_for_store(c, p, rank=rank.get(p.id) if p else None, applied=count.get(c.id, 0), blocked=blocked)
        )
    return {"today": today.isoformat(), "items": items}


def list_recruiting(db: Session, user: User) -> dict:
    """모집 중인 콜라보 — 협약 전이거나 아직 매장이 연결되지 않은 제휴사에게 보여 주는 목록(신청 정보 없음)."""
    ps.ensure_partner(user)
    today = today_kst()
    collabs = (
        db.query(Collab)
        .filter(Collab.status == "published", Collab.recruit_start <= today, Collab.recruit_end >= today)
        .order_by(Collab.recruit_end)
        .all()
    )
    _, count = _ranks(db, [c.id for c in collabs])
    return {
        "today": today.isoformat(),
        "items": [serialize_for_store(c, None, applied=count.get(c.id, 0)) for c in collabs],
    }


def _participant(db: Session, collab: Collab, store: PartnersStore) -> CollabParticipant | None:
    return (
        db.query(CollabParticipant)
        .filter(CollabParticipant.collab_id == collab.id, CollabParticipant.store_id == store.id)
        .first()
    )


def _store_view(db: Session, user: User, store: PartnersStore, collab: Collab) -> dict:
    """한 콜라보를 이 매장 입장으로 다시 그린다(동작 뒤 응답)."""
    for it in list_for_store(db, user, str(store.id))["items"]:
        if it["id"] == str(collab.id):
            return it
    return {"id": str(collab.id)}


def apply(db: Session, user: User, collab_id: str, store_id: str) -> dict:
    """선착순 신청 — 목표 매장 안이면 선정 후보, 넘으면 예비(대기 신청)."""
    _ensure_agreed(user)
    store = ps.own_store(db, user, store_id)
    collab = _get_collab(db, collab_id)
    today = today_kst()
    if collab.status != "published" or not (collab.recruit_start <= today <= collab.recruit_end):
        raise HTTPException(status_code=400, detail="지금은 신청할 수 없는 콜라보예요.")
    if store.status != "active":
        raise HTTPException(status_code=400, detail="숨김 상태인 매장은 신청할 수 없어요. 담당자에게 문의해 주세요.")
    existing = _participant(db, collab, store)
    # "미참여"로 답했어도 모집 기간 안이면 "참여"로 바꿀 수 있다 — 선착순 순서는 다시 누른 때로.
    if existing is not None and existing.status != "passed":
        raise HTTPException(status_code=409, detail="이미 신청한 콜라보예요.")
    holding = (
        db.query(Collab)
        .join(CollabParticipant, CollabParticipant.collab_id == Collab.id)
        .filter(
            CollabParticipant.store_id == store.id,
            CollabParticipant.status.in_(HOLDING),
            Collab.status != "cancelled",
        )
        .all()
    )
    if any(_overlaps(collab, h) for h in holding):
        raise HTTPException(status_code=400, detail="진행 중인 콜라보와 기간이 겹쳐 신청할 수 없어요.")
    if existing is not None:
        existing.status = "applied"
        existing.user_id = user.id
        existing.applied_at = datetime.now(timezone.utc)
        existing.closed_at = None
    else:
        db.add(CollabParticipant(collab_id=collab.id, store_id=store.id, user_id=user.id, status="applied"))
    db.commit()
    return _store_view(db, user, store, collab)


def withdraw(db: Session, user: User, collab_id: str, store_id: str) -> dict:
    """참여(신청) 취소 — 확정 요청 전, 모집 기간 안에만. 11-12부터 줄을 지우지 않고 "미참여"(passed)로 남긴다."""
    store = ps.own_store(db, user, store_id)
    collab = _get_collab(db, collab_id)
    p = _participant(db, collab, store)
    if p is None or p.status != "applied":
        raise HTTPException(status_code=400, detail="취소할 신청이 없어요.")
    if today_kst() > collab.recruit_end:
        raise HTTPException(status_code=400, detail="모집이 끝나 신청을 취소할 수 없어요. 담당자에게 알려 주세요.")
    p.status = "passed"
    p.closed_at = datetime.now(timezone.utc)
    db.commit()
    return _store_view(db, user, store, collab)


def pass_collab(db: Session, user: User, collab_id: str, store_id: str) -> dict:
    """미참여로 답하기(2026-11-12 사용자) — 새로 열린 콜라보마다 매장이 참여 / 미참여를 고른다.
    모집 기간 안에만, 참여(신청)해 둔 것도 확정 요청 전이면 미참여로 바꾼다. 모집이 끝날 때까지 답이 없으면 무응답."""
    _ensure_agreed(user)
    store = ps.own_store(db, user, store_id)
    collab = _get_collab(db, collab_id)
    today = today_kst()
    if collab.status != "published" or not (collab.recruit_start <= today <= collab.recruit_end):
        raise HTTPException(status_code=400, detail="지금은 답할 수 없는 콜라보예요.")
    p = _participant(db, collab, store)
    now = datetime.now(timezone.utc)
    if p is None:
        db.add(
            CollabParticipant(
                collab_id=collab.id, store_id=store.id, user_id=user.id, status="passed", closed_at=now
            )
        )
    elif p.status == "applied":
        p.status, p.closed_at = "passed", now
    elif p.status != "passed":
        raise HTTPException(status_code=400, detail="확정 요청을 받은 콜라보는 담당자에게 알려 주세요.")
    db.commit()
    return _store_view(db, user, store, collab)


def _next_confirm_no(db: Session) -> str:
    prefix = f"CF-{today_kst():%Y%m%d}-"
    n = (
        db.query(func.count(CollabParticipant.id))
        .filter(CollabParticipant.confirm_no.like(f"{prefix}%"))
        .scalar()
    )
    return f"{prefix}{n + 1:04d}"


def _mark_confirmed(db: Session, p: CollabParticipant, confirmer: str, checked: int | None) -> None:
    p.status = "confirmed"
    p.confirmed_at = datetime.now(timezone.utc)
    p.confirmer = confirmer[:100]
    p.checked_items = checked
    if not p.confirm_no:
        p.confirm_no = _next_confirm_no(db)


def confirm(
    db: Session, user: User, collab_id: str, store_id: str, confirmer: str | None, checked: int | None
) -> dict:
    """최종 확정 — 확정 요청을 받은 매장이 진행 항목을 모두 확인하고 확정한다(확정서 번호가 생긴다)."""
    store = ps.own_store(db, user, store_id)
    collab = _get_collab(db, collab_id)
    p = _participant(db, collab, store)
    if p is None or p.status != "requested" or collab.status == "cancelled":
        raise HTTPException(status_code=400, detail="확정할 수 있는 상태가 아니에요.")
    due = collab.confirm_due or _default_confirm_due(collab)
    if datetime.now(timezone.utc) > due:
        raise HTTPException(status_code=400, detail="확정 기한이 지났어요. 담당자에게 문의해 주세요.")
    name = (confirmer or "").strip() or (user.name or "").strip() or "매장 담당자"
    _mark_confirmed(db, p, name, checked)
    db.commit()
    return _store_view(db, user, store, collab)


def _confirmed_participant(db: Session, user: User, collab_id: str, store_id: str):
    store = ps.own_store(db, user, store_id)
    collab = _get_collab(db, collab_id)
    p = _participant(db, collab, store)
    if p is None or p.status != "confirmed" or collab.status == "cancelled":
        raise HTTPException(status_code=400, detail="확정한 콜라보에서만 할 수 있어요.")
    return store, collab, p


def _save_photo(db: Session, p: CollabParticipant, step: str, url: str, by: str) -> None:
    ph = db.query(CollabPhoto).filter(CollabPhoto.participant_id == p.id, CollabPhoto.step == step).first()
    if ph is None:
        db.add(CollabPhoto(participant_id=p.id, step=step, image_url=url, uploaded_by=by))
    else:
        ph.image_url, ph.uploaded_by, ph.created_at = url, by, datetime.now(timezone.utc)


def upload_photo(db: Session, user: User, collab_id: str, store_id: str, step: str, file: UploadFile) -> dict:
    """점검 사진(1~3차) — 그날이 되면 매장이 올린다. 다시 올리면 바뀐다."""
    store, collab, p = _confirmed_participant(db, user, collab_id, store_id)
    check = next((k for k in (collab.checks or []) if k.get("step") == step), None)
    if check is None:
        raise HTTPException(status_code=400, detail="올릴 수 있는 사진 단계가 아니에요.")
    if check["date"] > today_kst().isoformat():
        raise HTTPException(status_code=400, detail="점검일이 되면 올릴 수 있어요.")
    url = ps.upload_image(file, folder="collab", max_side=COLLAB_PHOTO_MAX_SIDE)
    _save_photo(db, p, step, url, "cafe")
    db.commit()
    return _store_view(db, user, store, collab)


def restock(db: Session, user: User, collab_id: str, store_id: str) -> dict:
    store, collab, p = _confirmed_participant(db, user, collab_id, store_id)
    if p.restock_requested_at is None:
        p.restock_requested_at = datetime.now(timezone.utc)
        db.commit()
    return _store_view(db, user, store, collab)


def read_notice(db: Session, user: User, collab_id: str, store_id: str, notice_id: str) -> dict:
    store = ps.own_store(db, user, store_id)
    collab = _get_collab(db, collab_id)
    p = _participant(db, collab, store)
    if p is not None and notice_id not in (p.read_notice_ids or []):
        p.read_notice_ids = [*(p.read_notice_ids or []), notice_id]
        db.commit()
    return {"ok": True}


# ── 어드민 ─────────────────────────────────────────────────────────────


def phase_of(c: Collab, today: date | None = None) -> str:
    """어드민 목록 단계 — draft 비공개 · scheduled 모집 전 · recruiting 모집 중 · selecting 마감~설치 전
    · running 설치~철수 · done 완료 · cancelled 취소."""
    today = today or today_kst()
    if c.status == "draft":
        return "draft"
    if c.status == "cancelled":
        return "cancelled"
    if today < c.recruit_start:
        return "scheduled"
    if today <= c.recruit_end:
        return "recruiting"
    if today < c.install_date:
        return "selecting"
    if today <= c.removal_date:
        return "running"
    return "done"


def _counts(db: Session, collab_ids: list) -> dict:
    out: dict = {}
    if not collab_ids:
        return out
    for cid, status, n in (
        db.query(CollabParticipant.collab_id, CollabParticipant.status, func.count(CollabParticipant.id))
        .filter(CollabParticipant.collab_id.in_(collab_ids))
        .group_by(CollabParticipant.collab_id, CollabParticipant.status)
    ):
        out.setdefault(cid, {s: 0 for s in PARTICIPANT_STATUSES})[status] = n
    return out


def admin_serialize(c: Collab, counts: dict | None = None) -> dict:
    counts = counts or {s: 0 for s in PARTICIPANT_STATUSES}
    return dict(
        id=str(c.id),
        brandName=c.brand_name,
        brandImageUrl=c.brand_image_url,
        title=c.title,
        summary=c.summary,
        type=c.collab_type,
        recruitStart=_d(c.recruit_start),
        recruitEnd=_d(c.recruit_end),
        confirmDue=_iso(c.confirm_due),
        installDate=_d(c.install_date),
        startDate=_d(c.start_date),
        endDate=_d(c.end_date),
        removalDate=_d(c.removal_date),
        checks=list(c.checks or []),
        task=c.task,
        items=list(c.items or []),
        space=c.space,
        quantity=c.quantity,
        benefit=c.benefit,
        staffScript=c.staff_script,
        targetStores=c.target_stores,
        status=c.status,
        phase=phase_of(c),
        adminMemo=c.admin_memo,
        counts=counts,
        createdAt=_iso(c.created_at),
        updatedAt=_iso(c.updated_at),
    )


def admin_list(
    db: Session, *, phase: str | None = None, keyword: str | None = None, page: int = 1, page_size: int = 20
) -> tuple[int, list[dict]]:
    q = db.query(Collab)
    kw = (keyword or "").strip()
    if kw:
        like = f"%{kw}%"
        q = q.filter(or_(Collab.brand_name.ilike(like), Collab.title.ilike(like)))
    rows = q.order_by(Collab.recruit_start.desc(), Collab.created_at.desc()).all()
    if phase:
        today = today_kst()
        # ended — 콜라보 결과(완료 · 취소)를 한 번에.
        wanted = ("done", "cancelled") if phase == "ended" else (phase,)
        rows = [c for c in rows if phase_of(c, today) in wanted]
    total = len(rows)
    rows = rows[(max(page, 1) - 1) * page_size : max(page, 1) * page_size]
    ids = [c.id for c in rows]
    counts = _counts(db, ids)
    # 결과 보고서 파일 수(086) — 콜라보 결과 목록 칸.
    files = dict(
        db.query(CollabReportFile.collab_id, func.count(CollabReportFile.id))
        .filter(CollabReportFile.collab_id.in_(ids))
        .group_by(CollabReportFile.collab_id)
        .all()
    ) if ids else {}
    out = []
    for c in rows:
        row = admin_serialize(c, counts.get(c.id))
        row["reportFileCount"] = files.get(c.id, 0)
        out.append(row)
    return total, out


# 대시보드 콜라보 일정 달력 — 한 번에 볼 수 있는 기간(달력 한 장은 6주, 앞뒤 여유).
CALENDAR_MAX_DAYS = 100


def admin_calendar(db: Session, start: date, end: date) -> list[dict]:
    """콜라보 일정 달력(어드민 대시보드, 2026-11-12 사용자) — 모집 시작 ~ 철수일이 [start, end] 와 겹치는 콜라보.
    취소는 뺀다. 확정 마감(confirm_due, 시각)은 한국 날짜로 바꿔 준다 — 비었으면 다른 화면과 같은 기본값(_default_confirm_due).
    모집 시작 순."""
    if end < start:
        raise HTTPException(status_code=400, detail="기간을 확인해 주세요.")
    if (end - start).days > CALENDAR_MAX_DAYS:
        raise HTTPException(status_code=400, detail=f"한 번에 {CALENDAR_MAX_DAYS}일까지 볼 수 있어요.")
    rows = (
        db.query(Collab)
        .filter(Collab.status != "cancelled", Collab.recruit_start <= end, Collab.removal_date >= start)
        .order_by(Collab.recruit_start, Collab.created_at)
        .all()
    )
    today = today_kst()
    return [
        dict(
            id=str(c.id),
            brandName=c.brand_name,
            title=c.title,
            status=c.status,
            phase=phase_of(c, today),
            recruitStart=_d(c.recruit_start),
            recruitEnd=_d(c.recruit_end),
            confirmDue=_d((c.confirm_due or _default_confirm_due(c)).astimezone(KST).date()),
            installDate=_d(c.install_date),
            startDate=_d(c.start_date),
            endDate=_d(c.end_date),
            removalDate=_d(c.removal_date),
        )
        for c in rows
    ]


_CHECK_NO = {"check1": 1, "check2": 2, "check3": 3}


def _milestones(c: Collab) -> list[tuple[date, str]]:
    """콜라보 일정 — (날짜, 이름) 날짜순. 확정 기한이 비었으면 다른 화면과 같은 기본값."""
    due = (c.confirm_due or _default_confirm_due(c)).astimezone(KST).date()
    out = [
        (c.recruit_start, "모집 시작"),
        (c.recruit_end, "모집 마감"),
        (due, "최종 확정 기한"),
        (c.install_date, "설치"),
        (c.start_date, "콜라보 시작"),
    ]
    for k in c.checks or make_checks(c.start_date, c.end_date):
        out.append((date.fromisoformat(k["date"]), f"{_CHECK_NO.get(k['step'], '')}차 점검 사진"))
    out += [(c.end_date, "콜라보 끝"), (c.removal_date, "철수")]
    return sorted(out, key=lambda x: x[0])


def admin_progress(db: Session) -> list[dict]:
    """콜라보 진행(어드민 "콜라보 관리 → 콜라보 진행", 2026-11-12 사용자) — 끝나지 않은 콜라보(비공개 ~ 진행 중)마다
    다음 일정과 확정 매장의 설치 사진 · 늦은 점검 사진 · 재입고 요청 수. 준비할 것(진행 항목 prep)은 items 에 있다.
    다음 일정이 가까운 순, 비공개는 맨 뒤."""
    today = today_kst()
    rows = [
        c
        for c in db.query(Collab).filter(Collab.status != "cancelled").all()
        if phase_of(c, today) in PROGRESS_PHASES
    ]
    if not rows:
        return []
    ids = [c.id for c in rows]
    counts = _counts(db, ids)
    confirmed: dict = {}
    for p in (
        db.query(CollabParticipant)
        .options(selectinload(CollabParticipant.photos))
        .filter(CollabParticipant.collab_id.in_(ids), CollabParticipant.status == "confirmed")
    ):
        confirmed.setdefault(p.collab_id, []).append(p)
    # 매장 응답(참여 · 미참여 · 아직) — 답할 수 있는 매장 전부 기준(11-12 사용자).
    stores = db.query(PartnersStore).options(joinedload(PartnersStore.owner)).all()
    tally: dict = {}
    for store_rows in _store_responses(db, stores).values():
        for rc, kind, _ in store_rows:
            if rc.id in ids:
                tally.setdefault(rc.id, {k: 0 for k in RESPONSE_KINDS})[kind] += 1
    out = []
    for c in rows:
        due_steps = [
            k["step"] for k in (c.checks or make_checks(c.start_date, c.end_date)) if k["date"] <= today.isoformat()
        ]
        installed = photo_due = restock = 0
        for p in confirmed.get(c.id, []):
            done = {ph.step for ph in p.photos}
            installed += "install" in done
            photo_due += any(step not in done for step in due_steps)
            restock += p.restock_requested_at is not None
        nxt = next(((d, label) for d, label in _milestones(c) if d >= today), None)
        row = admin_serialize(c, counts.get(c.id))
        row["progress"] = dict(
            nextDate=_d(nxt[0]) if nxt else None,
            nextLabel=nxt[1] if nxt else None,
            installed=installed,
            photoDue=photo_due,
            restock=restock,
            responses=tally.get(c.id, {k: 0 for k in RESPONSE_KINDS}),
        )
        out.append((c.status == "draft", nxt[0] if nxt else date.max, row))
    out.sort(key=lambda x: (x[0], x[1]))
    return [row for _, _, row in out]


# ── 매장별 콜라보 응답(2026-11-12 사용자) ────────────────────────────────
# 새로 열린 콜라보마다 매장이 참여 / 미참여로 답한다. 모집 기간이 끝날 때까지 답이 없으면 무응답.
#   joined 참여(신청한 적 있음 — 그 뒤 확정 · 미선정 · 취소여도) · passed 미참여 · silent 무응답 · waiting 아직 모집 중이라 답 기다림
# 묻지 않은 콜라보는 세지 않는다: 비공개 · 취소, 매장이 답할 수 있게 되기 전(매장 등록 · 회원 협약 중 늦은 날)에 모집이 끝남,
# 기간이 겹치는 다른 콜라보를 확정 요청 · 확정해 둬서 신청할 수 없었음(blocked).
RESPONSE_KINDS = ("joined", "passed", "silent", "waiting")


def _answerable_since(store: PartnersStore) -> date | None:
    """이 매장이 콜라보 참여 여부를 답할 수 있게 된 날(KST). 연결 회원이 없거나 협약 전이면 None.
    매장을 회원에 연결한 때는 따로 남지 않아 매장 등록일 · 협약일 중 늦은 날로 본다."""
    owner = store.owner
    if owner is None or owner.partner_agreed_at is None:
        return None
    return max(owner.partner_agreed_at, store.created_at).astimezone(KST).date()


def _store_responses(db: Session, stores: list[PartnersStore]) -> dict:
    """매장마다 [(콜라보, 응답, 참여 줄)] — 응답은 RESPONSE_KINDS. 모집 시작이 늦은 콜라보부터."""
    out: dict = {s.id: [] for s in stores}
    if not stores:
        return out
    today = today_kst()
    collabs = (
        db.query(Collab)
        .filter(Collab.status != "draft")
        .order_by(Collab.recruit_start.desc(), Collab.created_at.desc())
        .all()
    )
    by_id = {c.id: c for c in collabs}
    parts = db.query(CollabParticipant).filter(CollabParticipant.store_id.in_([s.id for s in stores])).all()
    mine = {(p.store_id, p.collab_id): p for p in parts}
    holding: dict = {}
    for p in parts:
        c = by_id.get(p.collab_id)
        if c is not None and p.status in HOLDING and c.status != "cancelled":
            holding.setdefault(p.store_id, []).append(c)
    for s in stores:
        since = _answerable_since(s)
        for c in collabs:
            p = mine.get((s.id, c.id))
            if p is not None:
                out[s.id].append((c, "passed" if p.status == "passed" else "joined", p))
                continue
            if c.status != "published" or since is None or since > c.recruit_end or today < c.recruit_start:
                continue
            if any(h.id != c.id and _overlaps(c, h) for h in holding.get(s.id, [])):
                continue
            out[s.id].append((c, "waiting" if today <= c.recruit_end else "silent", None))
    return out


def _response_counts(rows: list) -> dict:
    counts = {k: 0 for k in RESPONSE_KINDS}
    for _, kind, _ in rows:
        counts[kind] += 1
    return counts


def attach_store_responses(db: Session, items: list[dict]) -> None:
    """어드민 매장 목록 줄마다 collabResponses{joined, passed, silent, waiting}를 붙인다."""
    ids = []
    for it in items:
        try:
            ids.append(uuid.UUID(str(it["id"])))
        except (KeyError, ValueError):
            pass
    stores = (
        db.query(PartnersStore).options(joinedload(PartnersStore.owner)).filter(PartnersStore.id.in_(ids)).all()
        if ids
        else []
    )
    responses = _store_responses(db, stores)
    for it in items:
        try:
            sid = uuid.UUID(str(it["id"]))
        except (KeyError, ValueError):
            continue
        it["collabResponses"] = _response_counts(responses.get(sid, []))


def admin_store_collabs(db: Session, store_id: str) -> dict:
    """어드민 매장 상세 "콜라보 참여" — 참여 · 미참여 · 무응답 수와 콜라보별 기록(참여한 것은 결과까지)."""
    try:
        store = (
            db.query(PartnersStore)
            .options(joinedload(PartnersStore.owner))
            .filter(PartnersStore.id == uuid.UUID(str(store_id)))
            .first()
        )
    except ValueError:
        store = None
    if store is None:
        raise HTTPException(status_code=404, detail="매장을 찾을 수 없어요.")
    rows = _store_responses(db, [store])[store.id]
    today = today_kst()
    items = []
    for c, kind, p in rows:
        items.append(
            dict(
                collabId=str(c.id),
                brandName=c.brand_name,
                title=c.title,
                phase=phase_of(c, today),
                recruitStart=_d(c.recruit_start),
                recruitEnd=_d(c.recruit_end),
                startDate=_d(c.start_date),
                endDate=_d(c.end_date),
                response=kind,
                status=p.status if p else None,
                appliedAt=_iso(p.applied_at) if p and kind == "joined" else None,
                answeredAt=_iso(p.closed_at) if p and kind == "passed" else None,
                confirmNo=p.confirm_no if p else None,
            )
        )
    since = _answerable_since(store)
    return dict(counts=_response_counts(rows), since=_d(since) if since else None, items=items)


def _parse_date(v, label: str) -> date:
    if isinstance(v, date):
        return v
    try:
        return date.fromisoformat(str(v)[:10])
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail=f"{label} 날짜를 확인해 주세요.") from None


def _clean_items(items) -> list[dict]:
    out = []
    for it in items or []:
        label = str((it or {}).get("label") or "").strip()[:40]
        note = str((it or {}).get("note") or "").strip()[:200]
        prep = (it or {}).get("prep")
        if label:
            row = {"label": label, "note": note}
            # 누가 준비하나(광고주 의뢰서와 같은 값) — admix 면 콜라보 진행 화면 "admix 제작"에 모인다.
            if prep in ITEM_PREPS:
                row["prep"] = prep
            out.append(row)
    return out


def _txt(v, n: int | None = None) -> str | None:
    v = str(v or "").strip()
    return (v[:n] if n else v) or None


def _apply_collab(c: Collab, data: dict) -> None:
    for key, label, n in (("brand_name", "브랜드", 100), ("title", "콜라보 이름", 200)):
        if key in data:
            v = _txt(data[key], n)
            if not v:
                raise HTTPException(status_code=400, detail=f"{label}을(를) 적어 주세요.")
            setattr(c, key, v)
    for key, n in (("brand_image_url", 500), ("space", 200), ("benefit", 200)):
        if key in data:
            setattr(c, key, _txt(data[key], n))
    for key in ("summary", "task", "staff_script", "admin_memo"):
        if key in data:
            setattr(c, key, _txt(data[key]))
    if "collab_type" in data:
        if data["collab_type"] not in COLLAB_TYPES:
            raise HTTPException(status_code=400, detail="준비형 · 제작형 중에서 골라 주세요.")
        c.collab_type = data["collab_type"]
    if "status" in data:
        if data["status"] not in COLLAB_STATUSES:
            raise HTTPException(status_code=400, detail="상태를 다시 골라 주세요.")
        c.status = data["status"]
    if "items" in data:
        c.items = _clean_items(data["items"])
    if "quantity" in data:
        q = data["quantity"]
        c.quantity = int(q) if q not in (None, "") else None
    if "target_stores" in data:
        n = int(data["target_stores"] or 0)
        if n < 1:
            raise HTTPException(status_code=400, detail="목표 매장 수는 1곳 이상이어야 해요.")
        c.target_stores = n
    labels = {
        "recruit_start": "모집 시작",
        "recruit_end": "모집 마감",
        "start_date": "콜라보 시작",
        "end_date": "콜라보 종료",
        "install_date": "설치",
        "removal_date": "철수",
    }
    for key, label in labels.items():
        if key in data and data[key] not in (None, ""):
            setattr(c, key, _parse_date(data[key], label))
    for key in ("recruit_start", "recruit_end", "start_date", "end_date"):
        if getattr(c, key) is None:
            raise HTTPException(status_code=400, detail=f"{labels[key]} 날짜를 적어 주세요.")
    # 설치는 시작 전날, 철수는 종료 다음 날이 기본.
    if c.install_date is None or ("start_date" in data and not data.get("install_date")):
        c.install_date = c.start_date - timedelta(days=1)
    if c.removal_date is None or ("end_date" in data and not data.get("removal_date")):
        c.removal_date = c.end_date + timedelta(days=1)
    if c.recruit_start > c.recruit_end:
        raise HTTPException(status_code=400, detail="모집 마감이 모집 시작보다 빨라요.")
    if c.start_date > c.end_date:
        raise HTTPException(status_code=400, detail="콜라보 종료가 시작보다 빨라요.")
    if c.install_date > c.start_date or c.removal_date < c.end_date:
        raise HTTPException(status_code=400, detail="설치는 시작일까지, 철수는 종료일 뒤로 잡아 주세요.")
    if c.recruit_end >= c.install_date:
        raise HTTPException(status_code=400, detail="모집 마감은 설치일보다 앞이어야 해요.")
    if "confirm_due" in data:
        v = data["confirm_due"]
        if v in (None, ""):
            c.confirm_due = None
        else:
            try:
                dt = v if isinstance(v, datetime) else datetime.fromisoformat(str(v))
            except ValueError:
                raise HTTPException(status_code=400, detail="최종 확정 기한을 확인해 주세요.") from None
            c.confirm_due = dt if dt.tzinfo else dt.replace(tzinfo=KST)
    c.checks = make_checks(c.start_date, c.end_date)


def _detail(db: Session, c: Collab) -> dict:
    out = admin_serialize(c, _counts(db, [c.id]).get(c.id))
    rank, _ = _ranks(db, [c.id])
    parts = (
        db.query(CollabParticipant)
        .options(
            joinedload(CollabParticipant.store).joinedload(PartnersStore.owner),
            selectinload(CollabParticipant.photos),
        )
        .filter(CollabParticipant.collab_id == c.id)
        .order_by(CollabParticipant.applied_at, CollabParticipant.id)
        .all()
    )
    out["participants"] = [_admin_participant(c, p, rank.get(p.id)) for p in parts]
    out["notices"] = [
        dict(id=str(n.id), title=n.title, body=n.body, author=n.author, createdAt=_iso(n.created_at))
        for n in c.notices
    ]
    out["reportFiles"] = [_report_file(f) for f in c.report_files]
    return out


def _admin_participant(c: Collab, p: CollabParticipant, rank: int | None) -> dict:
    s, owner = p.store, (p.store.owner if p.store else None)
    standing, slot = _standing(c, p, rank, False)
    return dict(
        id=str(p.id),
        storeId=str(p.store_id),
        storeCode=s.store_code if s else None,
        storeName=s.name if s else None,
        storeAddress=s.address if s else None,
        ownerName=owner.name if owner else None,
        ownerLoginId=owner.login_id if owner else None,
        partnerCode=owner.partner_code if owner else None,
        ownerPhone=owner.phone if owner else None,
        status=p.status,
        standing=standing,
        slotNo=slot,
        rank=rank,
        appliedAt=_iso(p.applied_at),
        requestedAt=_iso(p.requested_at),
        confirmedAt=_iso(p.confirmed_at),
        confirmNo=p.confirm_no,
        confirmer=p.confirmer,
        checkedItems=p.checked_items,
        closedAt=_iso(p.closed_at),
        restockRequestedAt=_iso(p.restock_requested_at),
        adminMemo=p.admin_memo,
        photos=[
            dict(id=str(ph.id), step=ph.step, url=ph.image_url, by=ph.uploaded_by, at=_iso(ph.created_at))
            for ph in p.photos
        ],
    )


def admin_get(db: Session, collab_id: str) -> dict:
    return _detail(db, _get_collab(db, collab_id))


def admin_create(db: Session, data: dict) -> dict:
    c = Collab(status="draft", items=[], checks=[], target_stores=1)
    _apply_collab(c, data)
    db.add(c)
    db.commit()
    db.refresh(c)
    return _detail(db, c)


def admin_update(db: Session, collab_id: str, data: dict) -> dict:
    c = _get_collab(db, collab_id)
    _apply_collab(c, data)
    db.commit()
    db.refresh(c)
    return _detail(db, c)


def admin_delete(db: Session, collab_id: str) -> None:
    """지우기 — 확정한 매장이 있으면 막는다(취소로 바꿔 이력을 남긴다)."""
    c = _get_collab(db, collab_id)
    confirmed = (
        db.query(CollabParticipant.id)
        .filter(CollabParticipant.collab_id == c.id, CollabParticipant.status == "confirmed")
        .first()
    )
    if confirmed:
        raise HTTPException(
            status_code=400, detail="확정한 매장이 있는 콜라보는 지울 수 없어요. 상태를 '취소'로 바꿔 주세요."
        )
    paths = [_report_path(f.url) for f in c.report_files]
    db.delete(c)
    db.commit()
    for path in paths:
        path.unlink(missing_ok=True)


def _get_participant(db: Session, participant_id: str) -> CollabParticipant:
    try:
        p = db.get(CollabParticipant, uuid.UUID(str(participant_id)))
    except ValueError:
        p = None
    if p is None:
        raise HTTPException(status_code=404, detail="참여 기록을 찾을 수 없어요.")
    return p


def admin_add_participant(db: Session, collab_id: str, store_code: str) -> dict:
    """전화 등으로 받은 신청을 어드민이 대신 넣는다 — 매장 ID(S-0001)."""
    c = _get_collab(db, collab_id)
    raw = ps.normalize_store_code(store_code)
    store = db.query(PartnersStore).filter(PartnersStore.store_code == raw).first()
    if store is None:
        raise HTTPException(status_code=400, detail=f"매장을 찾지 못했어요: {store_code}")
    existing = _participant(db, c, store)
    # 미참여로 답했던 매장(11-12)도 전화로 참여하겠다면 참여로 바꿔 넣는다 — 순서는 지금부터.
    if existing is not None and existing.status != "passed":
        raise HTTPException(status_code=409, detail="이미 참여 중인 매장이에요.")
    if existing is not None:
        existing.status = "applied"
        existing.applied_at = datetime.now(timezone.utc)
        existing.closed_at = None
    else:
        db.add(
            CollabParticipant(collab_id=c.id, store_id=store.id, user_id=store.owner_user_id, status="applied")
        )
    db.commit()
    return _detail(db, c)


def _set_status(db: Session, p: CollabParticipant, status: str, confirmer: str | None = None) -> None:
    now = datetime.now(timezone.utc)
    if status not in PARTICIPANT_STATUSES:
        raise HTTPException(status_code=400, detail="알 수 없는 상태예요.")
    if status == p.status:
        return
    if status == "applied":
        p.requested_at = p.closed_at = None
    elif status == "requested":
        p.requested_at = now
        p.closed_at = None
    elif status == "confirmed":
        _mark_confirmed(db, p, (confirmer or "").strip() or ADMIX_CONFIRMER, p.checked_items)
        p.closed_at = None
        return
    else:  # declined · cancelled
        p.closed_at = now
    p.status = status


def admin_update_participant(db: Session, participant_id: str, data: dict) -> dict:
    """확정 요청 보내기 · 대리 확정 · 미참여 · 취소 · 되돌리기, 재입고 처리 완료, 메모."""
    p = _get_participant(db, participant_id)
    if "status" in data and data["status"]:
        _set_status(db, p, data["status"], data.get("confirmer"))
    if data.get("restock_done"):
        p.restock_requested_at = None
    if "admin_memo" in data:
        p.admin_memo = _txt(data["admin_memo"])
    db.commit()
    return _detail(db, p.collab)


def admin_bulk_status(db: Session, collab_id: str, participant_ids: list[str], status: str) -> dict:
    """여러 매장에 한 번에 — 주로 선정 후보 모두에게 확정 요청 보내기."""
    c = _get_collab(db, collab_id)
    for pid in participant_ids:
        p = _get_participant(db, pid)
        if p.collab_id == c.id:
            _set_status(db, p, status)
    db.commit()
    return _detail(db, c)


def admin_upload_photo(db: Session, participant_id: str, step: str, file: UploadFile) -> dict:
    """설치 사진(admix) · 점검 사진 대신 올리기."""
    if step not in PHOTO_STEPS:
        raise HTTPException(status_code=400, detail="사진 단계를 다시 골라 주세요.")
    p = _get_participant(db, participant_id)
    url = ps.upload_image(file, folder="collab", max_side=COLLAB_PHOTO_MAX_SIDE)
    _save_photo(db, p, step, url, "admix")
    db.commit()
    return _detail(db, p.collab)


def admin_delete_photo(db: Session, photo_id: str) -> dict:
    try:
        ph = db.get(CollabPhoto, uuid.UUID(str(photo_id)))
    except ValueError:
        ph = None
    if ph is None:
        raise HTTPException(status_code=404, detail="사진을 찾을 수 없어요.")
    collab = ph.participant.collab
    db.delete(ph)
    db.commit()
    return _detail(db, collab)


def _report_file(f: CollabReportFile) -> dict:
    return dict(id=str(f.id), name=f.name, size=f.size, uploadedBy=f.uploaded_by, createdAt=_iso(f.created_at))


def _report_path(url: str) -> Path:
    return Path(get_settings().upload_dir) / url.removeprefix("/uploads/")


def _get_report_file(db: Session, file_id: str) -> CollabReportFile:
    try:
        f = db.get(CollabReportFile, uuid.UUID(str(file_id)))
    except ValueError:
        f = None
    if f is None:
        raise HTTPException(status_code=404, detail="보고서 파일을 찾을 수 없어요.")
    return f


def admin_upload_report(db: Session, collab_id: str, file: UploadFile, uploaded_by: str | None) -> dict:
    """결과 보고서 파일 올리기(086) — 한 번에 하나, 여러 번 올려 모은다. 콜라보 상세 모양으로 돌려준다."""
    c = _get_collab(db, collab_id)
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in REPORT_FILE_EXTS:
        raise HTTPException(status_code=400, detail="PDF · PPT · 문서 · 엑셀 · 이미지 · ZIP 파일만 올릴 수 있어요.")
    content = file.file.read(REPORT_FILE_MAX + 1)
    if not content:
        raise HTTPException(status_code=400, detail="빈 파일이에요.")
    if len(content) > REPORT_FILE_MAX:
        raise HTTPException(status_code=400, detail="50MB 이하 파일만 올릴 수 있어요.")
    rel = f"collab-report/{c.id}/{uuid.uuid4().hex}{ext}"
    dest = Path(get_settings().upload_dir) / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(content)
    db.add(
        CollabReportFile(
            collab_id=c.id,
            name=(file.filename or dest.name)[:255],
            url=f"/uploads/{rel}",
            size=len(content),
            uploaded_by=(uploaded_by or "")[:255] or None,
        )
    )
    db.commit()
    db.refresh(c)
    return _detail(db, c)


def admin_report_file(db: Session, file_id: str) -> tuple[Path, str]:
    f = _get_report_file(db, file_id)
    path = _report_path(f.url)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없어요.")
    return path, f.name


def admin_delete_report(db: Session, file_id: str) -> dict:
    f = _get_report_file(db, file_id)
    c, path = f.collab, _report_path(f.url)
    db.delete(f)
    db.commit()
    path.unlink(missing_ok=True)
    db.refresh(c)
    return _detail(db, c)


def admin_add_notice(db: Session, collab_id: str, data: dict) -> dict:
    c = _get_collab(db, collab_id)
    title, body = _txt(data.get("title"), 200), _txt(data.get("body"))
    if not title or not body:
        raise HTTPException(status_code=400, detail="공지 제목과 내용을 적어 주세요.")
    db.add(CollabNotice(collab_id=c.id, title=title, body=body, author=_txt(data.get("author"), 100) or "admix 운영팀"))
    db.commit()
    db.refresh(c)
    return _detail(db, c)


def admin_delete_notice(db: Session, notice_id: str) -> dict:
    try:
        n = db.get(CollabNotice, uuid.UUID(str(notice_id)))
    except ValueError:
        n = None
    if n is None:
        raise HTTPException(status_code=404, detail="공지를 찾을 수 없어요.")
    c = n.collab
    db.delete(n)
    db.commit()
    db.refresh(c)
    return _detail(db, c)


def admin_summary(db: Session) -> dict:
    """콜라보 어드민 첫 화면 — 지금 처리할 일 숫자."""
    today = today_kst()
    partners = db.query(User).filter(User.member_category == "partner", User.status != "withdrawn")
    biz = (
        db.query(BusinessRegistration.status, func.count(BusinessRegistration.id))
        .join(User, User.id == BusinessRegistration.user_id)
        .filter(User.member_category == "partner", User.status != "withdrawn")
        .group_by(BusinessRegistration.status)
        .all()
    )
    biz_counts = dict(biz)
    # 광고주 사업자등록증 검토 대기 — 사이드 메뉴 "광고주 회원" 옆 숫자(11-11 사용자).
    advertiser_biz_reviewing = (
        db.query(func.count(BusinessRegistration.id))
        .join(User, User.id == BusinessRegistration.user_id)
        .filter(
            User.member_category == "advertiser",
            User.status != "withdrawn",
            BusinessRegistration.status == "reviewing",
        )
        .scalar()
    )
    has_store =db.query(PartnersStore.id).filter(PartnersStore.owner_user_id == User.id).exists()
    collabs = db.query(Collab).all()
    phases: dict[str, int] = {}
    for c in collabs:
        ph = phase_of(c, today)
        phases[ph] = phases.get(ph, 0) + 1
    running_ids = [c.id for c in collabs if phase_of(c, today) == "running"]
    photo_due = 0
    if running_ids:
        parts = (
            db.query(CollabParticipant)
            .options(selectinload(CollabParticipant.photos), joinedload(CollabParticipant.collab))
            .filter(CollabParticipant.collab_id.in_(running_ids), CollabParticipant.status == "confirmed")
            .all()
        )
        for p in parts:
            done = {ph.step for ph in p.photos}
            if any(k["date"] <= today.isoformat() and k["step"] not in done for k in (p.collab.checks or [])):
                photo_due += 1
    return dict(
        today=today.isoformat(),
        members=dict(
            total=partners.count(),
            notAgreed=partners.filter(User.partner_agreed_at.is_(None)).count(),
            noStore=partners.filter(User.partner_agreed_at.isnot(None), ~has_store).count(),
            bizReviewing=biz_counts.get("reviewing", 0),
            bizProvisional=biz_counts.get("provisional", 0),
        ),
        advertisers=dict(bizReviewing=advertiser_biz_reviewing),
        stores=dict(
            total=db.query(func.count(PartnersStore.id)).scalar(),
            unlinked=db.query(func.count(PartnersStore.id)).filter(PartnersStore.owner_user_id.is_(None)).scalar(),
            hidden=db.query(func.count(PartnersStore.id)).filter(PartnersStore.status == "hidden").scalar(),
        ),
        requestsPending=db.query(func.count(PartnersStoreRequest.id))
        .filter(PartnersStoreRequest.status == "pending")
        .scalar(),
        collabs=phases,
        confirmWaiting=db.query(func.count(CollabParticipant.id))
        .join(Collab, Collab.id == CollabParticipant.collab_id)
        .filter(CollabParticipant.status == "requested", Collab.status != "cancelled")
        .scalar(),
        restockOpen=db.query(func.count(CollabParticipant.id))
        .filter(CollabParticipant.restock_requested_at.isnot(None), CollabParticipant.status == "confirmed")
        .scalar(),
        photoDue=photo_due,
        # 광고주 콜라보 의뢰 — 접수된 수는 사이드 메뉴 "콜라보 의뢰" 옆 숫자, 안 연 수는 목록 다시 불러오기용(081).
        collabRequestsSubmitted=collab_request_service.submitted_count(db),
        collabRequestsNew=collab_request_service.new_count(db),
    )
