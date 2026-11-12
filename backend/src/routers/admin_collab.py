"""콜라보 어드민(/admin/collab/...) — 제휴사 회원 · 사업자 인증(임시 승인) · 광고주 회원(읽기) · 광고주 콜라보 의뢰(읽기, 081) · 수정 요청 · 콜라보 모집~진행.

매장 등록 · 수정은 routers/partners.admin_router(/admin/partners/stores). 권한은 모두 "collab"(마스터는 전체).
"""
from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.admin import Admin
from src.services import (
    collab_advertiser_service,
    collab_request_service,
    collab_service,
    member_service,
    partners_service,
)
from src.utils.deps import require_permission

router = APIRouter(prefix="/admin/collab", tags=["admin-collab"])
Perm = Depends(require_permission("collab"))


def _data(body: BaseModel) -> dict:
    return body.model_dump(exclude_unset=True)


@router.get("/summary")
def summary(_: Admin = Perm, db: Session = Depends(get_db)) -> dict:
    return collab_service.admin_summary(db)


@router.post("/images")
def upload_image(file: UploadFile = File(...), _: Admin = Perm) -> dict:
    """브랜드 사진 등 — 받은 주소를 콜라보 저장에 담는다."""
    return {"url": partners_service.upload_image(file, folder="brand", max_side=1200)}


# ── 매장 유형 관리(매장 유형별 매장 어필 · 조건 메모 값) ───────────────────────


class StoreTypeIn(BaseModel):
    name: str | None = Field(default=None, max_length=40)
    tags: list[str] | None = None
    notes: list[str] | None = None
    sort_order: int | None = None


@router.get("/store-types")
def list_store_types(_: Admin = Perm, db: Session = Depends(get_db)) -> list[dict]:
    return partners_service.list_store_types(db)


@router.post("/store-types", status_code=status.HTTP_201_CREATED)
def create_store_type(body: StoreTypeIn, _: Admin = Perm, db: Session = Depends(get_db)) -> dict:
    return partners_service.create_store_type(db, _data(body))


@router.patch("/store-types/{type_id}")
def update_store_type(type_id: int, body: StoreTypeIn, _: Admin = Perm, db: Session = Depends(get_db)) -> dict:
    return partners_service.update_store_type(db, type_id, _data(body))


@router.delete("/store-types/{type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_store_type(type_id: int, _: Admin = Perm, db: Session = Depends(get_db)) -> Response:
    partners_service.delete_store_type(db, type_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── 제휴사 회원 ────────────────────────────────────────────────────────


@router.get("/members")
def list_members(
    keyword: str | None = Query(default=None),
    agreement: str | None = Query(default=None),
    biz: str | None = Query(default=None),
    store: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _: Admin = Perm,
    db: Session = Depends(get_db),
) -> dict:
    total, items = partners_service.admin_list_members(
        db, keyword=keyword, agreement=agreement, biz=biz, store=store, page=page, page_size=page_size
    )
    return {"total": total, "items": items}


@router.get("/members/lookup")
def lookup_member(code: str = Query(..., min_length=1), _: Admin = Perm, db: Session = Depends(get_db)) -> dict:
    """고유번호(P-0001)로 회원 미리 보기 — 매장에 연결하기 전 확인."""
    return partners_service.admin_lookup_member(db, code)


@router.get("/members/{member_id}")
def get_member(member_id: str, _: Admin = Perm, db: Session = Depends(get_db)) -> dict:
    return partners_service.admin_get_member(db, member_id)


class MemberUpdateIn(BaseModel):
    # 연락처 — 숫자 9 ~ 11자리('-'는 빼고 저장), 비우면 지운다. 비밀번호는 어드민에서 바꾸지 않는다(문의).
    phone: str | None = Field(default=None, max_length=20)


@router.patch("/members/{member_id}")
def update_member(member_id: str, body: MemberUpdateIn, _: Admin = Perm, db: Session = Depends(get_db)) -> dict:
    """제휴사 회원 정보 바꾸기 — 지금은 연락처만."""
    return partners_service.admin_update_member(db, member_id, _data(body))


class BizActionIn(BaseModel):
    action: str = Field(pattern="^(provisional|verify|reject|reset)$")
    reason: str | None = Field(default=None, max_length=500)


@router.post("/members/{member_id}/biz")
def biz_action(member_id: str, body: BizActionIn, _: Admin = Perm, db: Session = Depends(get_db)) -> dict:
    """사업자 인증 — 임시 승인(현장) · 인증 완료 · 반려 · 되돌리기."""
    return partners_service.admin_biz_action(db, member_id, body.action, body.reason)


@router.get("/members/{member_id}/biz-file")
def biz_file(member_id: str, _: Admin = Perm, db: Session = Depends(get_db)) -> FileResponse:
    member = partners_service.admin_get_member(db, member_id)
    path, filename = member_service.get_license_file(db, uuid.UUID(member["id"]))
    return FileResponse(path, filename=filename)


class LinkStoreIn(BaseModel):
    store_code: str = Field(min_length=1, max_length=20)


@router.post("/members/{member_id}/stores")
def link_store(member_id: str, body: LinkStoreIn, _: Admin = Perm, db: Session = Depends(get_db)) -> dict:
    """매장 ID(S-0001)로 이 회원에게 매장을 잇는다."""
    return partners_service.admin_link_store(db, member_id, body.store_code)


@router.delete("/members/{member_id}/stores/{store_id}")
def unlink_store(member_id: str, store_id: str, _: Admin = Perm, db: Session = Depends(get_db)) -> dict:
    return partners_service.admin_unlink_store(db, member_id, store_id)


# ── 광고주 회원(읽기 전용, 11-10) ───────────────────────────────────────


@router.get("/advertisers")
def list_advertisers(
    keyword: str | None = Query(default=None),
    biz: str | None = Query(default=None),
    brand: str | None = Query(default=None),
    card: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _: Admin = Perm,
    db: Session = Depends(get_db),
) -> dict:
    total, items = collab_advertiser_service.admin_list(
        db, keyword=keyword, biz=biz, brand=brand, card=card, page=page, page_size=page_size
    )
    return {"total": total, "items": items}


@router.get("/advertisers/{member_id}")
def get_advertiser(member_id: str, _: Admin = Perm, db: Session = Depends(get_db)) -> dict:
    return collab_advertiser_service.admin_get(db, member_id)


class AdvertiserBizIn(BaseModel):
    # 비우면 지운다. 형식은 정하지 않는다(admix 회원 관리와 같다) — 길이만 표 칸에 맞춘다.
    business_name: str | None = Field(default=None, max_length=200)
    business_registration_no: str | None = Field(default=None, max_length=30)


@router.patch("/advertisers/{member_id}/biz")
def update_advertiser_biz(
    member_id: str, body: AdvertiserBizIn, _: Admin = Perm, db: Session = Depends(get_db)
) -> dict:
    """광고주 사업자 상호 · 사업자번호 저장(인증 상태는 그대로)."""
    return collab_advertiser_service.admin_update_biz(db, member_id, _data(body))


@router.get("/advertisers/{member_id}/business-card")
def advertiser_business_card(member_id: str, _: Admin = Perm, db: Session = Depends(get_db)) -> FileResponse:
    path, filename = collab_advertiser_service.business_card_file(db, member_id)
    return FileResponse(path, filename=filename)


@router.get("/advertisers/{member_id}/biz-file")
def advertiser_biz_file(member_id: str, _: Admin = Perm, db: Session = Depends(get_db)) -> FileResponse:
    path, filename = collab_advertiser_service.license_file(db, member_id)
    return FileResponse(path, filename=filename)


# ── 광고주 콜라보 의뢰(읽기, 081) ───────────────────────────────────────


@router.get("/collab-requests")
def list_collab_requests(
    keyword: str | None = Query(default=None),
    status_: str | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _: Admin = Perm,
    db: Session = Depends(get_db),
) -> dict:
    """최근 보낸 순. status=new(아직 안 연 것) · viewed(연 것) · cancelled · 기획안 상태(submitted · proposed · revised · confirmed)."""
    total, items = collab_request_service.admin_list(
        db, keyword=keyword, status=status_, page=page, page_size=page_size
    )
    return {"total": total, "items": items}


@router.get("/collab-requests/{request_id}")
def get_collab_request(request_id: str, _: Admin = Perm, db: Session = Depends(get_db)) -> dict:
    """의뢰서 한 장 — 처음 열면 사이드 메뉴 숫자에서 빠진다."""
    return collab_request_service.admin_get(db, request_id)


@router.get("/collab-requests/{request_id}/plan-file")
def collab_request_plan_file(request_id: str, _: Admin = Perm, db: Session = Depends(get_db)) -> FileResponse:
    path, filename = collab_request_service.plan_file(db, request_id)
    return FileResponse(path, filename=filename)


class PlanRoundIn(BaseModel):
    """기획안 한 차수 — 고친 내용 전부 · 항목별 수정 이유 · 펼쳐 둔 차수(그사이 바뀌었으면 409)."""

    content: dict
    notes: dict[str, str] = Field(default_factory=dict)
    baseRound: int


@router.post("/collab-requests/{request_id}/plan-files", status_code=status.HTTP_201_CREATED)
def upload_collab_request_round_file(
    request_id: str, file: UploadFile = File(...), _: Admin = Perm, db: Session = Depends(get_db)
) -> dict:
    """admix 기획안 첨부 올리기 — {id, name, size, by} 를 돌려준다. 기획안 보낼 때 content.files 에 넣어야 광고주에게 간다."""
    return collab_request_service.admin_upload_round_file(db, request_id, file)


@router.get("/collab-requests/{request_id}/plan-files/{file_id}")
def collab_request_round_file(
    request_id: str, file_id: str, _: Admin = Perm, db: Session = Depends(get_db)
) -> FileResponse:
    """기획안 첨부 받기 — "request" 는 광고주 의뢰서 첨부."""
    path, filename = collab_request_service.admin_round_file(db, request_id, file_id)
    return FileResponse(path, filename=filename)


@router.post("/collab-requests/{request_id}/rounds")
def send_collab_request_round(
    request_id: str, body: PlanRoundIn, admin: Admin = Perm, db: Session = Depends(get_db)
) -> dict:
    """admix 기획안 보내기(085) — 의뢰를 항목별로 고쳐 광고주에게. 광고주는 수정 전 · 후를 보고 확정하거나 다시 고친다."""
    return collab_request_service.admin_send_round(db, admin, request_id, body.model_dump())


# ── 매장 수정 요청 ─────────────────────────────────────────────────────


@router.get("/requests")
def list_requests(
    status_: str | None = Query(default=None, alias="status"),
    store_id: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _: Admin = Perm,
    db: Session = Depends(get_db),
) -> dict:
    total, items = partners_service.admin_list_requests(
        db, status=status_, store_id=store_id, page=page, page_size=page_size
    )
    return {"total": total, "items": items}


class RequestUpdateIn(BaseModel):
    # done 처리 완료(요청 값을 매장에 반영) · rejected 처리 불가(사유 admin_reply 필수) · pending 처리 전으로.
    status: str | None = Field(default=None, pattern="^(pending|done|rejected)$")
    admin_reply: str | None = Field(default=None, max_length=2000)


@router.patch("/requests/{request_id}")
def update_request(
    request_id: str, body: RequestUpdateIn, _: Admin = Perm, db: Session = Depends(get_db)
) -> dict:
    return partners_service.admin_update_request(db, request_id, _data(body))


# ── 콜라보 ─────────────────────────────────────────────────────────────


class CollabItemIn(BaseModel):
    label: str = Field(max_length=40)
    note: str | None = Field(default=None, max_length=200)
    # 누가 준비하나 — ready 브랜드 보유 · made 브랜드 제작 · admix admix 제작(콜라보 진행 화면용).
    prep: str | None = None


class CollabIn(BaseModel):
    brand_name: str | None = Field(default=None, max_length=100)
    brand_image_url: str | None = Field(default=None, max_length=500)
    title: str | None = Field(default=None, max_length=200)
    summary: str | None = None
    collab_type: str | None = None
    recruit_start: str | None = None
    recruit_end: str | None = None
    confirm_due: str | None = None
    install_date: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    removal_date: str | None = None
    task: str | None = None
    items: list[CollabItemIn] | None = None
    space: str | None = Field(default=None, max_length=200)
    quantity: int | None = None
    benefit: str | None = Field(default=None, max_length=200)
    staff_script: str | None = None
    target_stores: int | None = None
    status: str | None = None
    admin_memo: str | None = None


@router.get("/collabs")
def list_collabs(
    phase: str | None = Query(default=None),
    keyword: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _: Admin = Perm,
    db: Session = Depends(get_db),
) -> dict:
    total, items = collab_service.admin_list(db, phase=phase, keyword=keyword, page=page, page_size=page_size)
    return {"total": total, "items": items}


@router.get("/calendar")
def collab_calendar(
    start: date = Query(...),
    end: date = Query(...),
    _: Admin = Perm,
    db: Session = Depends(get_db),
) -> dict:
    """대시보드 콜라보 일정 달력 — 기간과 겹치는 콜라보(취소 제외)의 단계별 날짜."""
    return {"items": collab_service.admin_calendar(db, start, end)}


@router.get("/progress")
def collab_progress(_: Admin = Perm, db: Session = Depends(get_db)) -> dict:
    """콜라보 진행 — 끝나지 않은 콜라보(비공개 ~ 진행 중)의 다음 일정 · 설치 · 점검 사진 · 재입고 수."""
    return {"items": collab_service.admin_progress(db)}


@router.post("/collabs", status_code=status.HTTP_201_CREATED)
def create_collab(body: CollabIn, _: Admin = Perm, db: Session = Depends(get_db)) -> dict:
    return collab_service.admin_create(db, _data(body))


@router.get("/collabs/{collab_id}")
def get_collab(collab_id: str, _: Admin = Perm, db: Session = Depends(get_db)) -> dict:
    return collab_service.admin_get(db, collab_id)


@router.patch("/collabs/{collab_id}")
def update_collab(collab_id: str, body: CollabIn, _: Admin = Perm, db: Session = Depends(get_db)) -> dict:
    return collab_service.admin_update(db, collab_id, _data(body))


@router.delete("/collabs/{collab_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_collab(collab_id: str, _: Admin = Perm, db: Session = Depends(get_db)) -> Response:
    collab_service.admin_delete(db, collab_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


class AddParticipantIn(BaseModel):
    store_code: str = Field(min_length=1, max_length=20)


@router.post("/collabs/{collab_id}/participants")
def add_participant(
    collab_id: str, body: AddParticipantIn, _: Admin = Perm, db: Session = Depends(get_db)
) -> dict:
    return collab_service.admin_add_participant(db, collab_id, body.store_code)


class BulkStatusIn(BaseModel):
    participant_ids: list[str]
    status: str


@router.post("/collabs/{collab_id}/participants/status")
def bulk_status(collab_id: str, body: BulkStatusIn, _: Admin = Perm, db: Session = Depends(get_db)) -> dict:
    return collab_service.admin_bulk_status(db, collab_id, body.participant_ids, body.status)


class ParticipantIn(BaseModel):
    status: str | None = None
    confirmer: str | None = Field(default=None, max_length=100)
    restock_done: bool | None = None
    admin_memo: str | None = None


@router.patch("/participants/{participant_id}")
def update_participant(
    participant_id: str, body: ParticipantIn, _: Admin = Perm, db: Session = Depends(get_db)
) -> dict:
    return collab_service.admin_update_participant(db, participant_id, _data(body))


@router.post("/participants/{participant_id}/photos")
def upload_participant_photo(
    participant_id: str,
    step: str = Form(...),
    file: UploadFile = File(...),
    _: Admin = Perm,
    db: Session = Depends(get_db),
) -> dict:
    return collab_service.admin_upload_photo(db, participant_id, step, file)


@router.delete("/photos/{photo_id}")
def delete_photo(photo_id: str, _: Admin = Perm, db: Session = Depends(get_db)) -> dict:
    return collab_service.admin_delete_photo(db, photo_id)


class NoticeIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1)
    author: str | None = Field(default=None, max_length=100)


@router.post("/collabs/{collab_id}/notices")
def add_notice(collab_id: str, body: NoticeIn, _: Admin = Perm, db: Session = Depends(get_db)) -> dict:
    return collab_service.admin_add_notice(db, collab_id, _data(body))


@router.delete("/notices/{notice_id}")
def delete_notice(notice_id: str, _: Admin = Perm, db: Session = Depends(get_db)) -> dict:
    return collab_service.admin_delete_notice(db, notice_id)


# ── 결과 보고서 파일(086) — 콜라보 결과에서 콜라보마다 올려 모아 둔다 ──


@router.post("/collabs/{collab_id}/reports")
def upload_report(
    collab_id: str,
    file: UploadFile = File(...),
    admin: Admin = Perm,
    db: Session = Depends(get_db),
) -> dict:
    return collab_service.admin_upload_report(db, collab_id, file, admin.name or admin.email)


@router.get("/reports/{file_id}/file")
def report_file(file_id: str, _: Admin = Perm, db: Session = Depends(get_db)) -> FileResponse:
    path, filename = collab_service.admin_report_file(db, file_id)
    return FileResponse(path, filename=filename)


@router.delete("/reports/{file_id}")
def delete_report(file_id: str, _: Admin = Perm, db: Session = Depends(get_db)) -> dict:
    return collab_service.admin_delete_report(db, file_id)
