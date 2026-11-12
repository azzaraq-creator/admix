"""콜라보 — /partners 대시보드 API(/api/v1/partners/...).

- 제휴사(콜라보) 회원: 내 매장 보기(등록 · 수정은 어드민만, 069) · 수정 요청, 콜라보 신청 · 확정 · 사진 · 재입고 요청.
- 광고주·제휴사(콜라보) 회원: 공개 매장 목록·상세(매체 찾기에서 콜라보 매장을 누르면 새 탭으로 여는 화면).
- 광고주 회원: 내 브랜드(여러 개, 이름 · 사진 — 068) 등록·수정·삭제, 브랜드 사진 올리기.
- 광고주 회원: 콜라보 의뢰 보내기 · 고쳐 다시 보내기 · 추가 기획 첨부(081, 어드민 "콜라보 의뢰"에서 읽는다).
어드민 "콜라보 → 매장 관리"는 admin_router(/admin/partners/stores), 나머지 콜라보 어드민은 routers/admin_collab.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, File, Form, Query, Request, Response, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.admin import Admin
from src.models.user import User
from src.services import advertiser_brand_service, collab_request_service, collab_service, partners_service
from src.utils.deps import get_current_user, require_permission

router = APIRouter(prefix="/partners", tags=["partners"])
admin_router = APIRouter(prefix="/admin/partners/stores", tags=["admin-partners"])


class PartnersStoreIn(BaseModel):
    name: str | None = Field(default=None, max_length=100)  # 매장명 100자(화면 입력칸과 같다, DB 칸은 200)
    address: str | None = Field(default=None, max_length=500)
    address_detail: str | None = Field(default=None, max_length=200)
    # 주소 검색(다음 우편번호)이 준 시·도, 시·군·구 — 없으면 서버가 카카오 주소 검색으로 채운다.
    city: str | None = Field(default=None, max_length=100)
    district: str | None = Field(default=None, max_length=100)
    latitude: float | None = None
    longitude: float | None = None
    image_urls: list[str] | None = None
    phone: str | None = Field(default=None, max_length=30)
    owner_name: str | None = Field(default=None, max_length=100)
    tags: list[str] | None = None
    business_hours: str | None = Field(default=None, max_length=300)


class StorePhotoIn(BaseModel):
    url: str = Field(max_length=500)
    kind: str | None = Field(default=None, max_length=20)
    # 분류별 대표 사진(분류마다 하나) — 매체 찾기 · 광고주 매장 카드에 보인다(073).
    cover: bool | None = None
    # 사진 메모 — 광고주 매장 상세에서 사진 설명으로 보인다(073).
    memo: str | None = Field(default=None, max_length=200)


class GradeScoreIn(BaseModel):
    # 등급 점수 한 항목 — 점수(0 ~ 만점)와 이유 · 값 메모(077).
    score: float | None = None
    memo: str | None = Field(default=None, max_length=300)


class HoursSlotIn(BaseModel):
    days: str = Field(max_length=10)  # daily 매일 · weekday 평일 · weekend 주말(공휴일)
    open: str = Field(max_length=5)  # "10:00"
    close: str = Field(max_length=5)


class StoreHoursIn(BaseModel):
    """운영 시간(073) — 요일 구분별 여는 · 닫는 시간 2개까지와 휴무일."""

    slots: list[HoursSlotIn] = Field(default_factory=list, max_length=2)
    closed: list[str] = Field(default_factory=list, max_length=10)


class AdminPartnersStoreIn(PartnersStoreIn):
    # 매장 유형(카페 · 식당 …, 어드민 "매장 유형 관리") — null 이면 미지정(070).
    store_type_id: int | None = None
    status: str | None = None
    admin_memo: str | None = None
    owner_login_id: str | None = None
    # 제휴사 회원 고유번호(P-0001) — 비우면(null · "") 연결을 끊는다(069).
    owner_code: str | None = None
    # 사진과 분류(외관 · 내관 · …) · 분류별 대표 · 메모 — 보내면 image_urls 대신 이것으로 정한다(장수 제한 없음, 069 · 073).
    images: list[StorePhotoIn] | None = None
    # 운영 시간 입력값 — 보내면 business_hours 글도 이것으로 다시 만든다. null 이면 둘 다 지운다(073).
    hours: StoreHoursIn | None = None
    # 조건 메모 — "포스터 부착 불가", "신규 메뉴 가능" …(개수 제한 없음, 069).
    notes: list[str] | None = None
    # 콜라보 등급(S·A·B·C, 기준은 아직 정하지 않음)·매장별 금액(1건, 원) — 광고주 매장 찾기 · 예상 비용에 쓴다(067).
    collab_grade: str | None = Field(default=None, max_length=1)
    collab_fee: int | None = None
    # 등급 점수 — sales 매출 50 · seats 규모 20 · collab 공간 활용 30 점 만점, 항목마다 이유 · 값 메모(077). 어드민만.
    grade_scores: dict[str, GradeScoreIn] | None = None


def _data(body: BaseModel) -> dict:
    return body.model_dump(exclude_unset=True)


@router.get("/tag-options")
def tag_options(db: Session = Depends(get_db)) -> dict:
    """매장 어필 선택지 — 매장 유형(어드민 "매장 유형 관리")마다 다르다. tags 는 모든 유형의 값을 합친 것."""
    types = partners_service.list_store_types(db)
    return {
        "tags": list(dict.fromkeys(t for st in types for t in st["tags"])),
        "storeTypes": [{"id": st["id"], "name": st["name"], "tags": st["tags"]} for st in types],
        "photoKinds": list(partners_service.PHOTO_KINDS),
    }


# ── 회원 ───────────────────────────────────────────────────────────────


class PartnerAgreementIn(BaseModel):
    version: str = Field(min_length=1, max_length=20)
    # 전자 서명(078) — 서명자 이름 · 구분 · 손 서명 그림(PNG data URL).
    signer_name: str = Field(min_length=1, max_length=50)
    signer_role: str = Field(pattern="^(representative|delegate)$")
    signature: str = Field(min_length=1, max_length=1_500_000)


@router.get("/me/agreement/progress")
def agreement_progress(user: User = Depends(get_current_user)) -> dict:
    """기본협약 진행 상태 — 동의 전에 저장해 둔 곳(없으면 null)."""
    partners_service.ensure_partner(user)
    return {"progress": user.partner_agreement_progress}


@router.put("/me/agreement/progress")
def save_agreement_progress(
    body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    """기본협약 진행 상태 저장 — 화면이 바뀔 때마다 보낸다(작은 JSON, 동의 후에는 무시)."""
    return partners_service.save_agreement_progress(db, user, body.get("progress"))


def _client_ip(request: Request) -> str | None:
    """요청한 곳 IP — 운영은 nginx 뒤라 X-Forwarded-For 첫 값, 없으면 바로 붙은 곳."""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip() or None
    return request.client.host if request.client else None


@router.post("/me/agreement")
def agree(
    body: PartnerAgreementIn,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """기본협약 최종 동의 — 동의 시각 · 버전 · 전자 서명을 남긴다(이미 동의했으면 처음 기록을 유지)."""
    return partners_service.agree(
        db,
        user,
        body.version,
        body.signer_name,
        body.signer_role,
        body.signature,
        ip=_client_ip(request),
    )


@router.get("/me/stores")
def my_stores(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return {"items": partners_service.list_mine(db, user)}


class StoreRequestIn(BaseModel):
    # 바꿀 항목(name · address · hours · phone · owner_name · tags · notes)과 새 값 — 값 모양은 항목마다 다르다.
    # 추가 요청 · 문의는 field "inquiry" + value 글(partners_service.INQUIRY_FIELD).
    field: str = Field(min_length=1, max_length=20)
    value: Any = None
    # 담당자에게 남기는 메모(선택).
    memo: str | None = Field(default=None, max_length=500)


@router.get("/me/stores/{store_id}/requests")
def my_store_requests(
    store_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    """내 매장 수정 요청 — 보낸 요청과 처리 상태."""
    return {"items": partners_service.list_my_requests(db, user, store_id)}


@router.post("/me/stores/{store_id}/requests", status_code=status.HTTP_201_CREATED)
def create_store_request(
    store_id: str,
    body: StoreRequestIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """내 매장 수정 요청 보내기 — 고를 항목의 새 값을 보내면 담당자가 확인하고 반영한다."""
    return partners_service.create_request(db, user, store_id, body.field, body.value, body.memo)


# ── 콜라보(제휴사) ─────────────────────────────────────────────────────


class CollabStoreIn(BaseModel):
    store_id: str


class CollabConfirmIn(CollabStoreIn):
    confirmer: str | None = Field(default=None, max_length=100)
    checked_items: int | None = None


@router.get("/collabs/recruiting")
def recruiting_collabs(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """모집 중인 콜라보 — 협약 전 · 매장 연결 전 제휴사 대시보드에 보여 준다."""
    return collab_service.list_recruiting(db, user)


@router.get("/me/collabs")
def my_collabs(
    store_id: str = Query(...), user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    """이 매장이 보는 콜라보 — 모집 중 + 참여한(했던) 콜라보, 매장 입장(standing)과 함께."""
    return collab_service.list_for_store(db, user, store_id)


@router.post("/me/collabs/{collab_id}/apply")
def apply_collab(
    collab_id: str, body: CollabStoreIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    return collab_service.apply(db, user, collab_id, body.store_id)


@router.post("/me/collabs/{collab_id}/withdraw")
def withdraw_collab(
    collab_id: str, body: CollabStoreIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    return collab_service.withdraw(db, user, collab_id, body.store_id)


@router.post("/me/collabs/{collab_id}/pass")
def pass_collab(
    collab_id: str, body: CollabStoreIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    """미참여로 답하기 — 모집 기간 안에만(11-12). 답하지 않고 모집이 끝나면 어드민에 무응답으로 센다."""
    return collab_service.pass_collab(db, user, collab_id, body.store_id)


@router.post("/me/collabs/{collab_id}/confirm")
def confirm_collab(
    collab_id: str, body: CollabConfirmIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    return collab_service.confirm(db, user, collab_id, body.store_id, body.confirmer, body.checked_items)


@router.post("/me/collabs/{collab_id}/photos")
def upload_collab_photo(
    collab_id: str,
    store_id: str = Form(...),
    step: str = Form(...),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return collab_service.upload_photo(db, user, collab_id, store_id, step, file)


@router.post("/me/collabs/{collab_id}/restock")
def restock_collab(
    collab_id: str, body: CollabStoreIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    return collab_service.restock(db, user, collab_id, body.store_id)


@router.post("/me/collabs/{collab_id}/notices/{notice_id}/read")
def read_collab_notice(
    collab_id: str,
    notice_id: str,
    body: CollabStoreIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return collab_service.read_notice(db, user, collab_id, body.store_id, notice_id)


class AdvertiserBrandIn(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    image_url: str | None = Field(default=None, max_length=500)
    # 브랜드 담당자 정보(079, 모두 선택) — 보낸 칸만 바꾸고, 빈 값은 지운다.
    contact_name: str | None = Field(default=None, max_length=100)
    contact_title: str | None = Field(default=None, max_length=100)
    contact_dept: str | None = Field(default=None, max_length=100)
    contact_phone: str | None = Field(default=None, max_length=30)
    contact_email: str | None = Field(default=None, max_length=255)


@router.post("/brand-images")
def upload_brand_image(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
) -> dict:
    """브랜드 사진 올리기 — 받은 주소를 브랜드 등록 · 수정에 담아 보낸다."""
    advertiser_brand_service.ensure_advertiser(user)
    return {"url": partners_service.upload_image(file, folder="brand")}


@router.get("/me/brands")
def my_brands(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return {"items": advertiser_brand_service.list_mine(db, user)}


@router.post("/me/brands", status_code=status.HTTP_201_CREATED)
def create_my_brand(
    body: AdvertiserBrandIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    return advertiser_brand_service.create(db, user, _data(body))


@router.patch("/me/brands/{brand_id}")
def update_my_brand(
    brand_id: str,
    body: AdvertiserBrandIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return advertiser_brand_service.update(db, user, brand_id, _data(body))


@router.delete("/me/brands/{brand_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_brand(
    brand_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Response:
    advertiser_brand_service.delete(db, user, brand_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── 광고주 콜라보 의뢰(081) ────────────────────────────────────────────


class CollabRequestContactIn(BaseModel):
    name: str = Field(default="", max_length=50)
    phone: str = Field(default="", max_length=30)
    role: str = Field(default="", max_length=50)


class CollabRequestItemIn(BaseModel):
    key: str = Field(max_length=20)
    prep: str = Field(max_length=10)
    note: str = Field(default="", max_length=300)


class CollabRequestIn(BaseModel):
    # 글자 수 · 형식은 서비스에서 화면과 같은 규칙으로 다시 본다(캠페인명 30 · 한 줄 소개 100 · 조건 100 · 추가 기획 · 남길 말 1000).
    brand_id: str = Field(max_length=40)
    title: str = Field(max_length=100)
    summary: str | None = Field(default=None, max_length=300)
    start_date: str = Field(max_length=10)
    end_date: str = Field(max_length=10)
    contact: CollabRequestContactIn
    items: list[CollabRequestItemIn] = Field(max_length=6)
    extra_plan: str | None = Field(default=None, max_length=3000)
    course: str = Field(max_length=20)
    min_stores: int
    target_stores: int
    preferred_store_ids: list[str] = Field(default_factory=list, max_length=50)
    memo: str | None = Field(default=None, max_length=3000)
    # 화면이 보여 준 예상 비용 · 일정(참고용).
    estimate: dict[str, int] | None = None
    schedule: dict[str, Any] | None = None
    # 고쳐 다시 보낼 때 — 거짓이면 올려 둔 첨부를 지운다.
    keep_plan_file: bool = True


@router.get("/me/collab-requests")
def list_collab_requests(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    """내가 보낸 콜라보 의뢰(최근 보낸 순) — 내 콜라보 · 대시보드 · 상세가 이걸로 그린다."""
    return collab_request_service.list_mine(db, user)


@router.post("/me/collab-requests", status_code=status.HTTP_201_CREATED)
def create_collab_request(
    body: CollabRequestIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    """콜라보 의뢰 보내기 — 확인 창에서 "확실해요"를 체크한 뒤. 문서 번호(CR-YYMMDD-NN)를 돌려준다."""
    return collab_request_service.create(db, user, body.model_dump())


@router.put("/me/collab-requests/{request_id}")
def update_collab_request(
    request_id: str,
    body: CollabRequestIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """고친 의뢰 다시 보내기 — 같은 의뢰를 통째로 바꾼다."""
    return collab_request_service.update(db, user, request_id, body.model_dump())


@router.post("/me/collab-requests/{request_id}/cancel")
def cancel_collab_request(
    request_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """의뢰 취소 — 지우지 않고 "취소"로 남긴다(내 콜라보 · 어드민 콜라보 의뢰에 보인다)."""
    return collab_request_service.cancel(db, user, request_id)


class CollabPlanRoundIn(BaseModel):
    """기획안을 항목별로 다시 고쳐 보내기(085) — 고친 내용 전부 · 항목별 수정 이유 · 펼쳐 둔 차수."""

    content: dict[str, Any]
    notes: dict[str, str] = Field(default_factory=dict)
    baseRound: int


class CollabPlanConfirmIn(BaseModel):
    """확정할 admix 기획안 차수 — 그사이 admix가 다시 보냈으면 409."""

    round: int


@router.post("/me/collab-requests/{request_id}/rounds")
def send_collab_request_round(
    request_id: str,
    body: CollabPlanRoundIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """admix 기획안을 항목별로 고쳐 다시 보내기 — admix가 다시 검토한다."""
    return collab_request_service.send_round(db, user, request_id, body.model_dump())


@router.post("/me/collab-requests/{request_id}/confirm")
def confirm_collab_request(
    request_id: str,
    body: CollabPlanConfirmIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """admix 기획안 확정 — 의뢰가 '확정'으로 바뀐다."""
    return collab_request_service.confirm(db, user, request_id, body.model_dump())


@router.post("/me/collab-requests/{request_id}/plan-file")
def upload_collab_request_file(
    request_id: str,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """추가 기획 첨부(기획서 1개, 20MB) — 의뢰를 보낸 다음 올린다."""
    return collab_request_service.save_plan_file(db, user, request_id, file)


@router.get("/me/collab-requests/{request_id}/plan-files/{file_id}")
def collab_request_round_file(
    request_id: str,
    file_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    """기획안 첨부 받기 — 차수에 들어간 파일(admix가 붙인 파일 · 내 의뢰서 첨부 "request")만."""
    path, filename = collab_request_service.round_file(db, user, request_id, file_id)
    return FileResponse(path, filename=filename)


@router.get("/stores")
def list_stores(
    keyword: str | None = Query(default=None),
    city: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    partners_service.ensure_viewer(user)
    return {"items": partners_service.list_public(db, keyword=keyword, city=city, user=user)}


@router.get("/stores/{key}")
def get_store(key: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """key — 매장 id 또는 매체 찾기 media_id(CF-0001)."""
    partners_service.ensure_viewer(user)
    return partners_service.get_public(db, key, user)


# ── 어드민 ─────────────────────────────────────────────────────────────


@admin_router.get("")
def admin_list(
    keyword: str | None = Query(default=None),
    status_: str | None = Query(default=None, alias="status"),
    linked: str | None = Query(default=None),
    # 매장 유형(cafe_store_type.id) — 회원 상세 "매장 검색" 창의 유형 탭(카페 · 식당 …).
    store_type: int | None = Query(default=None),
    # 콜라보 등급 S · A · B · C, none 이면 아직 미정 — 매장 관리 목록 "등급" 거르기.
    grade: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _: Admin = Depends(require_permission("collab")),
    db: Session = Depends(get_db),
) -> dict:
    total, items = partners_service.admin_list(
        db,
        keyword=keyword,
        status=status_,
        linked=linked,
        store_type=store_type,
        grade=grade,
        page=page,
        page_size=page_size,
    )
    # 콜라보 응답 수(참여 · 미참여 · 무응답) — 매장 목록 칸(11-12 사용자).
    collab_service.attach_store_responses(db, items)
    return {"total": total, "items": items}


@admin_router.get("/geocode")
def admin_geocode(
    address: str = Query(..., min_length=2),
    _: Admin = Depends(require_permission("collab")),
) -> dict:
    return partners_service.geocode(address)


@admin_router.post("/images")
def admin_upload_image(
    file: UploadFile = File(...),
    _: Admin = Depends(require_permission("collab")),
) -> dict:
    return {"url": partners_service.upload_image(file)}


@admin_router.get("/{store_id}/collabs")
def admin_store_collabs(
    store_id: str, _: Admin = Depends(require_permission("collab")), db: Session = Depends(get_db)
) -> dict:
    """매장 상세 "콜라보 참여" — 참여 · 미참여 · 무응답 수와 콜라보별 기록(11-12 사용자)."""
    return collab_service.admin_store_collabs(db, store_id)


@admin_router.get("/{store_id}")
def admin_get(
    store_id: str, _: Admin = Depends(require_permission("collab")), db: Session = Depends(get_db)
) -> dict:
    return partners_service.admin_get(db, store_id)


@admin_router.post("", status_code=status.HTTP_201_CREATED)
def admin_create(
    body: AdminPartnersStoreIn,
    _: Admin = Depends(require_permission("collab")),
    db: Session = Depends(get_db),
) -> dict:
    return partners_service.admin_create(db, _data(body))


@admin_router.patch("/{store_id}")
def admin_update(
    store_id: str,
    body: AdminPartnersStoreIn,
    _: Admin = Depends(require_permission("collab")),
    db: Session = Depends(get_db),
) -> dict:
    return partners_service.admin_update(db, store_id, _data(body))


@admin_router.delete("/{store_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete(
    store_id: str, _: Admin = Depends(require_permission("collab")), db: Session = Depends(get_db)
) -> Response:
    partners_service.admin_delete(db, store_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
