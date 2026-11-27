"""회원(member) 관리 비즈니스 로직 — admin/members.

users(회원) + business_registration(1:1) + member_sanction(1:N).
canonical 값은 목록 응답에서만 한글로 변환(상세는 canonical 유지, 프론트가 표시 변환).
"""
from __future__ import annotations

import re
import tempfile
import uuid
import zipfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import IO

from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from src.config import get_settings
from src.utils.listing import in_date_range, paginate, parse_date
from src.models.member_profile import BusinessRegistration, BusinessRegistrationRejection, MemberSanction
from src.models.user import User
from src.schemas.member import (
    BusinessRegistrationUpdate,
    MemberUpdate,
    SanctionCreate,
)
from src.services.auth_service import set_marketing

_CATEGORY = {
    "advertiser": "광고주",
    "agency": "대행사",
    "media_owner": "매체사",
    "general": "일반",
    "partner": "제휴사(콜라보)",
}
_PROPOSAL_STATUS = {
    "cancelled": "취소",
    "new": "신규",
    "custom": "맞춤제안",
    "execution_requested": "집행요청",
    "contracted": "계약 완료",
}
_INQUIRY_STATUS = {"pending": "답변 대기", "answered": "답변 완료"}
_BIZ = {
    "unregistered": "미등록",
    "reviewing": "검토 대기",
    "verified": "검토 완료",
    "rejected": "인증 반려",
    "provisional": "임시 승인",  # 콜라보 어드민 현장 임시 승인(069)
}
_STATUS = {"active": "정상", "withdrawn": "탈퇴", "sanctioned": "제재", "dormant": "휴면"}


def _fmt_date(dt) -> str:
    return dt.date().isoformat() if dt is not None else "-"


_KST = timezone(timedelta(hours=9))


def _fmt_kst_datetime(dt) -> str:
    """엑셀용 한국 시각 'YYYY-MM-DD HH:MM' — 없으면 '-'."""
    return dt.astimezone(_KST).strftime("%Y-%m-%d %H:%M") if dt is not None else "-"


def _map_member(u) -> dict:
    biz = u.business_registration
    return dict(
        no=str(u.id),
        category=_CATEGORY.get(u.member_category, u.member_category or "-"),
        loginId=u.login_id,
        company=u.company_name or "-",
        name=u.name or "-",
        email=u.email,
        phone=u.phone or "-",
        bizStatus=_BIZ.get(biz.status, biz.status) if biz else "미등록",
        marketing="동의" if u.marketing_consent else "비동의",
        status=_STATUS.get(u.status, u.status),
        joinedAt=_fmt_date(u.created_at),
        # 마지막 로그인(091) — ISO, 화면이 브라우저 시각으로 바꿔 보인다. 기록이 없으면 None.
        lastLoginAt=u.last_login_at.isoformat() if u.last_login_at else None,
    )


def list_members(
    db: Session,
    *,
    date_from: str | None = None,
    date_to: str | None = None,
    keyword: str | None = None,
    biz_status: str | None = None,
    status: str | None = None,
    category: str | None = None,
    page: int = 1,
    page_size: int = 10,
) -> tuple[int, list[dict]]:
    """가입일(joinedAt) 기간·상태·유형·키워드 필터 + 페이지네이션. (total, items) 반환."""
    users = (
        db.query(User)
        .options(joinedload(User.business_registration))
        .order_by(User.created_at.desc())
        .all()
    )
    rows = [_map_member(u) for u in users]

    df = parse_date(date_from)
    dt = parse_date(date_to)
    kw = (keyword or "").strip().lower()

    def keep(r: dict) -> bool:
        if biz_status and r["bizStatus"] != biz_status:
            return False
        if category and r["category"] != category:
            return False
        if status and r["status"] != status:
            return False
        if kw and kw not in r["email"].lower() and kw not in r["name"].lower():
            return False
        if not in_date_range(r["joinedAt"], df, dt):
            return False
        return True

    filtered = [r for r in rows if keep(r)]
    return paginate(filtered, page, page_size)


def list_members_all(db: Session) -> list[dict]:
    """엑셀 등 전건이 필요한 경우용(필터/페이지네이션 없음)."""
    users = (
        db.query(User)
        .options(joinedload(User.business_registration))
        .order_by(User.created_at.desc())
        .all()
    )
    return [_map_member(u) for u in users]


_EXPORT_COLUMNS = [
    ("category", "회원 유형"),
    ("loginId", "가입 아이디"),
    ("name", "이름"),
    ("email", "연락받을 이메일"),
    ("phone", "전화번호"),
    ("company", "회사명"),
    ("bizStatus", "사업자 인증 상태"),
    ("marketing", "마케팅 수신"),
    ("status", "상태"),
    ("joinedAt", "가입일"),
    ("lastLoginAt", "마지막 로그인"),
]


def _export_value(row: dict, key: str):
    if key == "lastLoginAt":
        raw = row.get(key)
        return _fmt_kst_datetime(datetime.fromisoformat(raw)) if raw else "-"
    return row.get(key, "")


def export_members_xlsx(db: Session) -> bytes:
    """회원 목록을 xlsx 로 export — 헤더=관리자 목록 컬럼."""
    from io import BytesIO

    from openpyxl import Workbook

    rows = list_members_all(db)
    wb = Workbook()
    ws = wb.active
    ws.title = "members"
    ws.append([label for _, label in _EXPORT_COLUMNS])
    for r in rows:
        ws.append([_export_value(r, key) for key, _ in _EXPORT_COLUMNS])
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _get_user(db: Session, user_id: uuid.UUID) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")
    return user


def get_member(db: Session, user_id: uuid.UUID) -> dict:
    user = _get_user(db, user_id)
    biz = user.business_registration
    name = user.name or "-"
    proposals = sorted(user.proposals, key=lambda p: p.created_at, reverse=True)
    inquiries = sorted(user.inquiries, key=lambda i: i.created_at, reverse=True)
    return dict(
        id=user.id,
        login_id=user.login_id,
        email=user.email,
        name=user.name,
        phone=user.phone,
        membership_type=user.membership_type,
        member_category=user.member_category,
        company_name=user.company_name,
        position=user.position,
        industry=user.industry,
        contact_name=user.contact_name,
        department=user.department,
        business_card_url=user.business_card_url,
        business_card_name=user.business_card_name,
        marketing_consent=user.marketing_consent,
        marketing_sms=user.marketing_sms,
        marketing_email=user.marketing_email,
        status=user.status,
        admin_memo=user.admin_memo,
        created_at=user.created_at,
        withdrawn_at=user.withdrawn_at,
        proposal_count=len(proposals),
        inquiry_count=len(inquiries),
        business_registration=biz,
        sanctions=sorted(user.sanctions, key=lambda s: s.start_date, reverse=True),
        proposals=[
            dict(
                id=p.id,
                proposalName=p.title,
                name=name,
                totalAmount=f"{p.total_amount:,}원",
                status=_PROPOSAL_STATUS.get(p.status, p.status),
                registeredAt=_fmt_date(p.created_at),
            )
            for p in proposals
        ],
        inquiries=[
            dict(
                id=i.id,
                name=i.name or name,
                title=i.subject,
                content=i.content,
                status=_INQUIRY_STATUS.get(i.status, i.status),
                submittedAt=_fmt_date(i.created_at),
            )
            for i in inquiries
        ],
    )


def update_member(db: Session, user_id: uuid.UUID, data: MemberUpdate) -> dict:
    user = _get_user(db, user_id)
    fields = data.model_dump(exclude_unset=True)
    for field, value in fields.items():
        # 마케팅 동의는 받을 방법(083)과 함께 맞춘다 — 방법 없이 켜면 문자 · 이메일 둘 다.
        if field == "marketing_consent":
            set_marketing(user, value)
            continue
        # 담당자 이름 · 소속팀은 빈 값이면 지운다(회원 내 정보와 같다).
        if field in ("contact_name", "department") and isinstance(value, str):
            value = value.strip() or None
        setattr(user, field, value)
    if "status" in fields:
        if fields["status"] == "withdrawn" and user.withdrawn_at is None:
            user.withdrawn_at = datetime.now(timezone.utc)
        elif fields["status"] != "withdrawn":
            user.withdrawn_at = None
    db.commit()
    return get_member(db, user_id)


def _get_sanction(
    db: Session, user_id: uuid.UUID, sanction_id: uuid.UUID
) -> MemberSanction:
    sanction = (
        db.query(MemberSanction)
        .filter(
            MemberSanction.id == sanction_id,
            MemberSanction.user_id == user_id,
        )
        .first()
    )
    if sanction is None:
        raise HTTPException(status_code=404, detail="제재 이력을 찾을 수 없습니다.")
    return sanction


def _recompute_sanction_status(db: Session, user: User) -> None:
    """활성 제재(오늘이 start_date~end_date 사이) 유무로 status 갱신.

    active↔sanctioned 만 전환(withdrawn/dormant 등은 건드리지 않음). 로그인 차단은
    auth_service 가 날짜로 직접 판정하므로 이 status 는 관리자 목록 표시용.
    """
    today = date.today()
    active = (
        db.query(MemberSanction)
        .filter(
            MemberSanction.user_id == user.id,
            MemberSanction.start_date <= today,
            or_(
                MemberSanction.end_date.is_(None),
                MemberSanction.end_date >= today,
            ),
        )
        .count()
    )
    if active > 0:
        user.status = "sanctioned"
    elif user.status == "sanctioned":
        user.status = "active"


def create_sanction(
    db: Session, user_id: uuid.UUID, data: SanctionCreate, admin_id: uuid.UUID
) -> dict:
    user = _get_user(db, user_id)
    db.add(
        MemberSanction(
            user_id=user.id,
            reason=data.reason,
            detail=data.detail,
            start_date=data.start_date,
            end_date=data.end_date,
            created_by=admin_id,
        )
    )
    db.flush()
    _recompute_sanction_status(db, user)
    db.commit()
    return get_member(db, user_id)


def update_sanction(
    db: Session, user_id: uuid.UUID, sanction_id: uuid.UUID, data: SanctionCreate
) -> dict:
    user = _get_user(db, user_id)
    sanction = _get_sanction(db, user_id, sanction_id)
    sanction.reason = data.reason
    sanction.detail = data.detail
    sanction.start_date = data.start_date
    sanction.end_date = data.end_date
    db.flush()
    _recompute_sanction_status(db, user)
    db.commit()
    return get_member(db, user_id)


def delete_sanction(
    db: Session, user_id: uuid.UUID, sanction_id: uuid.UUID
) -> dict:
    user = _get_user(db, user_id)
    sanction = _get_sanction(db, user_id, sanction_id)
    db.delete(sanction)
    db.flush()
    _recompute_sanction_status(db, user)
    db.commit()
    return get_member(db, user_id)


def log_biz_rejection(db: Session, reg: BusinessRegistration, admin_id: uuid.UUID | None = None) -> None:
    """반려 기록 한 줄(095) — 그때의 사유 · 올린 파일을 그대로 적는다. 커밋은 부르는 쪽이."""
    db.add(
        BusinessRegistrationRejection(
            user_id=reg.user_id,
            reason=reg.reject_reason,
            file_name=reg.license_file_name if reg.license_file_url else None,
            file_url=reg.license_file_url,
            rejected_by=admin_id,
            rejected_at=reg.rejected_at or datetime.now(timezone.utc),
        )
    )


def update_business_registration(
    db: Session, user_id: uuid.UUID, data: BusinessRegistrationUpdate, admin_id: uuid.UUID | None = None
) -> dict:
    user = _get_user(db, user_id)
    biz = user.business_registration
    if biz is None:
        biz = BusinessRegistration(user_id=user.id, status="unregistered")
        db.add(biz)
    fields = data.model_dump(exclude_unset=True)
    prev_status = biz.status
    for field, value in fields.items():
        setattr(biz, field, value)
    if fields.get("status") == "verified" and biz.verified_at is None:
        biz.verified_at = datetime.now(timezone.utc)
    if fields.get("status") and fields["status"] != prev_status:
        # 반려 시각(095) — admix 회원 관리에서 반려로 바꿔도 콜라보 어드민에 같이 보인다. 상태가 바뀔 때만 적는다.
        biz.rejected_at = datetime.now(timezone.utc) if fields["status"] == "rejected" else None
        if fields["status"] == "rejected":
            log_biz_rejection(db, biz, admin_id)
    db.commit()
    return get_member(db, user_id)


# 사업자등록증 파일 — PDF · 이미지 10MB. 회원 본인(auth /me/business-registration) · 어드민(콜라보 회원 상세)이 같이 쓴다.
LICENSE_ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}
LICENSE_MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB


def store_license_upload(
    db: Session, user_id: uuid.UUID, file_name: str | None, content: bytes
) -> BusinessRegistration:
    """사업자등록증 파일을 저장하고 검토 대기로(save_license_file) — 관리자가 대신 올릴 때(2026-11-19 사용자).
    예전 파일은 지우지 않는다 — 반려 기록(095)이 그 파일을 가리킬 수 있다."""
    ext = Path(file_name or "").suffix.lower()
    if ext not in LICENSE_ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="PDF · JPG · PNG 파일만 올릴 수 있어요.")
    if not content:
        raise HTTPException(status_code=400, detail="빈 파일이에요.")
    if len(content) > LICENSE_MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="파일 크기는 10MB 이하만 올릴 수 있어요.")
    dest_dir = Path(get_settings().upload_dir) / "business" / str(user_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{ext}"
    (dest_dir / stored_name).write_bytes(content)
    return save_license_file(db, user_id, f"/uploads/business/{user_id}/{stored_name}", file_name=file_name)


def save_license_file(
    db: Session, user_id: uuid.UUID, file_url: str, file_name: str | None = None
) -> BusinessRegistration:
    """회원 본인이 사업자등록증 파일 업로드 → 검토 대기 상태로 전환."""
    user = _get_user(db, user_id)
    biz = user.business_registration
    if biz is None:
        biz = BusinessRegistration(user_id=user.id, status="unregistered")
        db.add(biz)
    biz.license_file_url = file_url
    biz.license_file_name = file_name
    biz.license_uploaded_at = datetime.now(timezone.utc)
    biz.status = "reviewing"
    biz.reject_reason = None
    biz.rejected_at = None
    biz.verified_at = None
    db.commit()
    db.refresh(biz)
    return biz


def cancel_license(db: Session, user_id: uuid.UUID) -> None:
    """검토 중 사업자등록증 신청 취소 → 미등록으로 복귀(업로드 파일 제거)."""
    user = _get_user(db, user_id)
    biz = user.business_registration
    if biz is None:
        return
    if biz.license_file_url:
        rel = biz.license_file_url.removeprefix("/uploads/")
        (Path(get_settings().upload_dir) / rel).unlink(missing_ok=True)
    biz.license_file_url = None
    biz.license_file_name = None
    biz.license_uploaded_at = None
    biz.status = "unregistered"
    biz.reject_reason = None
    biz.verified_at = None
    db.commit()


def get_business_card_file(db: Session, user_id: uuid.UUID) -> tuple[Path, str]:
    """광고주 담당자 명함 파일 디스크 경로 + 원본 파일명(없으면 404)."""
    user = _get_user(db, user_id)
    if not user.business_card_url:
        raise HTTPException(status_code=404, detail="등록된 명함 파일이 없습니다.")
    path = Path(get_settings().upload_dir) / user.business_card_url.removeprefix("/uploads/")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    return path, (user.business_card_name or path.name)


# 내려받을 때 파일 이름 앞 회원 유형(11-26 사용자: "회원유형_상호명 또는 회원명_사업자등록증.확장자") — 괄호 설명 없이 짧게.
_LICENSE_FILE_CATEGORY = {
    "advertiser": "광고주",
    "agency": "대행사",
    "media_owner": "매체사",
    "general": "일반",
    "partner": "제휴사",
}
# 윈도우 · 맥에서 파일 이름에 못 쓰는 글자
_BAD_FILENAME_CHARS = re.compile(r'[\\/:*?"<>|\x00-\x1f]')


def license_download_name(user: User, biz: BusinessRegistration) -> str:
    """등록증 내려받기 이름 — "제휴사_참커피_사업자등록증.jpg". 상호가 없으면 회원 이름, 확장자는 올린 파일 그대로."""
    kind = _LICENSE_FILE_CATEGORY.get(user.member_category or "", "회원")
    who = (biz.business_name or "").strip() or (user.name or "").strip() or user.login_id
    who = _BAD_FILENAME_CHARS.sub("", who).strip(" .") or "회원"
    ext = Path(biz.license_file_url or "").suffix or Path(biz.license_file_name or "").suffix
    return f"{kind}_{who}_사업자등록증{ext.lower()}"


def _license_query(
    db: Session,
    *,
    categories: set[str] | None,
    category: str | None,
    status: str | None,
    keyword: str | None,
):
    """사업자등록증 모아 보기 조건 — 목록 · 한꺼번에 내려받기가 같이 쓴다. 최근 올린 것부터."""
    q = (
        db.query(BusinessRegistration, User)
        .join(User, User.id == BusinessRegistration.user_id)
        .filter(BusinessRegistration.license_file_url.isnot(None), User.status != "withdrawn")
    )
    if categories:
        q = q.filter(User.member_category.in_(categories))
    if category:
        q = q.filter(User.member_category == category)
    if status:
        q = q.filter(BusinessRegistration.status == status)
    kw = (keyword or "").strip()
    if kw:
        like = f"%{kw}%"
        conds = [
            User.name.ilike(like),
            User.login_id.ilike(like),
            User.company_name.ilike(like),
            User.partner_code.ilike(like),
            BusinessRegistration.business_name.ilike(like),
        ]
        digits = "".join(ch for ch in kw if ch.isdigit())
        if digits:
            conds.append(func.replace(BusinessRegistration.business_registration_no, "-", "").like(f"%{digits}%"))
        q = q.filter(or_(*conds))
    return q.order_by(
        BusinessRegistration.license_uploaded_at.desc().nullslast(),
        BusinessRegistration.updated_at.desc(),
    )


def list_business_licenses(
    db: Session,
    *,
    categories: set[str] | None = None,
    category: str | None = None,
    status: str | None = None,
    keyword: str | None = None,
    page: int = 1,
    page_size: int = 12,
) -> tuple[int, list[dict]]:
    """사업자등록증 모아 보기(2026-11-26 사용자: "사업자등록증을 따로 모아서 볼 수 있는 메뉴") — 파일을 올린 회원만, 최근 올린 것부터.

    categories 는 어드민마다 보이는 회원(콜라보 = 제휴사 · 광고주, admix = 전체), category · status 는 화면 조건.
    keyword 는 이름 · 아이디 · 회사명 · 고유번호 · 상호, 숫자가 있으면 사업자 번호('-' 빼고)도 찾는다. 탈퇴한 회원은 뺀다.
    """
    q = _license_query(db, categories=categories, category=category, status=status, keyword=keyword)
    total = q.count()
    page = max(page, 1)
    rows = q.offset((page - 1) * page_size).limit(page_size).all()
    iso = lambda dt: dt.isoformat() if dt else None  # noqa: E731
    items = [
        {
            "memberId": str(u.id),
            "name": u.name or u.login_id,
            "loginId": u.login_id,
            "category": u.member_category,
            "categoryLabel": _CATEGORY.get(u.member_category, u.member_category or "-"),
            "partnerCode": u.partner_code,
            "companyName": u.company_name,
            "bizStatus": biz.status,
            "businessName": biz.business_name,
            "businessNo": biz.business_registration_no,
            "representativeName": biz.representative_name,
            "fileName": biz.license_file_name,
            "fileUrl": biz.license_file_url,
            "downloadName": license_download_name(u, biz),
            "uploadedAt": iso(biz.license_uploaded_at),
            "verifiedAt": iso(biz.verified_at),
        }
        for biz, u in rows
    ]
    return total, items


def license_zip_names() -> tuple[str, str]:
    """한꺼번에 받은 zip 이름(한국 날짜) — ("사업자등록증_20261126.zip", 옛 브라우저용 영문 이름)."""
    day = datetime.now(timezone(timedelta(hours=9))).strftime("%Y%m%d")
    return f"사업자등록증_{day}.zip", f"business-registrations-{day}.zip"


def business_licenses_zip(
    db: Session,
    *,
    categories: set[str] | None = None,
    category: str | None = None,
    status: str | None = None,
    keyword: str | None = None,
) -> tuple[IO[bytes], int]:
    """화면 조건에 맞는 등록증을 zip 하나로(11-26 사용자: "전체 다운로드 시엔 zip으로") — (파일, 담은 수).

    파일 이름은 하나씩 받을 때와 같다(license_download_name). 같은 이름이 또 나오면 " (2)"를 붙인다.
    디스크에 파일이 없는 회원은 건너뛴다. 하나도 못 담으면 404.
    사진 · PDF 는 이미 눌려 있어 다시 누르지 않고(ZIP_STORED) 담기만 한다. 크면 디스크 임시 파일로 넘어간다.
    """
    root = Path(get_settings().upload_dir)
    rows = _license_query(db, categories=categories, category=category, status=status, keyword=keyword).all()
    out = tempfile.SpooledTemporaryFile(max_size=32 * 1024 * 1024)
    used: dict[str, int] = {}
    count = 0
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_STORED) as zf:
        for biz, u in rows:
            path = root / biz.license_file_url.removeprefix("/uploads/")
            if not path.is_file():
                continue
            name = license_download_name(u, biz)
            n = used.get(name, 0) + 1
            used[name] = n
            if n > 1:
                stem, dot, ext = name.rpartition(".")
                name = f"{stem} ({n}).{ext}" if dot else f"{name} ({n})"
            zf.write(path, arcname=name)
            count += 1
    if count == 0:
        out.close()
        raise HTTPException(status_code=404, detail="내려받을 사업자등록증 파일이 없습니다.")
    out.seek(0)
    return out, count


def get_license_file(db: Session, user_id: uuid.UUID) -> tuple[Path, str]:
    """등록증 파일 디스크 경로 + 다운로드용 원본 파일명 반환(없으면 404)."""
    user = _get_user(db, user_id)
    biz = user.business_registration
    if biz is None or not biz.license_file_url:
        raise HTTPException(status_code=404, detail="등록된 사업자등록증 파일이 없습니다.")
    rel = biz.license_file_url.removeprefix("/uploads/")
    path = Path(get_settings().upload_dir) / rel
    if not path.is_file():
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    return path, (biz.license_file_name or path.name)
