"""제안 관리 비즈니스 로직 — admin 목록 + 클라이언트 장바구니(플래닝) CRUD.

제안서는 회원(member_id) 또는 비회원 세션(session_id)이 소유한다. 챗·REST 양쪽에서 호출.
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from src.config import get_settings
from src.utils.listing import in_date_range, paginate, parse_date
from src.models.media_master import Media
from src.models.proposal import Proposal
from src.models.proposal_counter_file import ProposalCounterFile
from src.models.proposal_item import ProposalItem
from src.models.user import User

# 백엔드 원본 status → admin 표시 라벨.
# 유저 노출 라벨(작성중/제출완료/…)은 프런트 StatusChip 이 별도 관리.
# new(작성중)는 admin 목록에서 제외되므로 라벨은 폴백용.
_STATUS = {
    "cancelled": "취소",
    "new": "작성중",
    "custom": "맞춤제안",
    "execution_requested": "신규",
    "contracted": "계약완료",
}

# 티어별 제안서(플래닝) 개수 제한. None = 무제한.
GUEST_LIMIT = 1
MEMBER_LIMIT = 5


class ProposalLimitError(Exception):
    """티어 제안서 개수 한도 초과."""

    def __init__(self, tier: str, limit: int):
        self.tier = tier
        self.limit = limit
        super().__init__(f"proposal limit reached: tier={tier} limit={limit}")


def _is_verified_member(user: Optional[User]) -> bool:
    if user is None:
        return False
    reg = user.business_registration
    return bool(reg and reg.status == "verified")


def proposal_tier(user: Optional[User]) -> str:
    if user is None:
        return "guest"
    return "verified" if _is_verified_member(user) else "member"


def proposal_limit(user: Optional[User]) -> Optional[int]:
    """현재 사용자 티어의 제안서 개수 제한. None = 무제한."""
    tier = proposal_tier(user)
    if tier == "guest":
        return GUEST_LIMIT
    if tier == "verified":
        return None
    return MEMBER_LIMIT


def snapshot_submitter(proposal: Proposal, user: User) -> None:
    proposal.submitter_membership_type = user.membership_type
    proposal.submitter_company_name = user.company_name
    proposal.submitter_name = user.name
    proposal.submitter_email = user.email
    proposal.submitter_phone = user.phone


def _owner_count(
    db: Session, *, member_id: Optional[uuid.UUID], session_id: Optional[uuid.UUID]
) -> int:
    q = db.query(Proposal)
    if member_id is not None:
        q = q.filter(Proposal.member_id == member_id)
    else:
        q = q.filter(Proposal.session_id == session_id)
    # 삭제(논리삭제)한 제안서는 생성 한도에 포함하지 않는다.
    q = q.filter(Proposal.deleted_at.is_(None))
    return q.count()


def can_create_proposal(
    db: Session,
    *,
    member_id: Optional[uuid.UUID],
    session_id: Optional[uuid.UUID],
    user: Optional[User],
) -> bool:
    limit = proposal_limit(user)
    if limit is None:
        return True
    return _owner_count(db, member_id=member_id, session_id=session_id) < limit


def title_exists(
    db: Session,
    *,
    member_id: Optional[uuid.UUID],
    session_id: Optional[uuid.UUID],
    title: str,
    exclude_id: Optional[uuid.UUID] = None,
) -> bool:
    """같은 소유자(회원/세션)가 동일 제목의 (삭제 안 된) 제안서를 이미 가졌는지.

    비교는 앞뒤 공백 제거 + 대소문자 무시. exclude_id 는 rename 시 자기 자신 제외용.
    """
    norm = title.strip()
    if not norm:
        return False
    q = db.query(Proposal.id)
    if member_id is not None:
        q = q.filter(Proposal.member_id == member_id)
    else:
        q = q.filter(Proposal.session_id == session_id)
    q = q.filter(Proposal.deleted_at.is_(None))
    q = q.filter(func.lower(func.trim(Proposal.title)) == norm.lower())
    if exclude_id is not None:
        q = q.filter(Proposal.id != exclude_id)
    return db.query(q.exists()).scalar() is True


def claim_guest_proposals(
    db: Session, *, session_id: uuid.UUID, member_id: uuid.UUID
) -> int:
    """게스트 세션 소유 제안서를 회원으로 이관하고 챗 세션도 회원에 연결.

    로그인/회원가입 시 호출. 대상 없으면 0(멱등). 회원 제안서 개수 한도는 승계 시
    적용하지 않는다(게스트 자산 보존).
    """
    from src.models.ad_session import AdSession

    proposals = (
        db.query(Proposal)
        .filter(Proposal.session_id == session_id, Proposal.member_id.is_(None))
        .all()
    )
    for p in proposals:
        p.member_id = member_id
        p.session_id = None

    # 게스트 챗 세션도 회원 소유로 연결 (챗 히스토리 승계)
    db.query(AdSession).filter(
        AdSession.id == session_id, AdSession.user_id.is_(None)
    ).update({AdSession.user_id: member_id}, synchronize_session=False)

    db.commit()
    return len(proposals)


def _fmt_date(dt) -> str:
    return dt.date().isoformat() if dt is not None else "-"


def _map_proposal(p) -> dict:
    return dict(
        id=str(p.id),
        name=p.title,
        member=(
            p.submitter_name
            or (p.member.name if p.member and p.member.name else "-")
        ),
        mediaCount=str(p.media_count),
        totalAmount=f"{p.total_amount:,}원",
        status=_STATUS.get(p.status, p.status),
        # "삭제됨" 배지는 계약완료 삭제 건 전용. 제출완료/맞춤제안 삭제는
        # status=cancelled(취소)로만 표기(deleted_at 은 목록 숨김·한도 제외용이라 유지).
        deleted=p.deleted_at is not None and p.status != "cancelled",
        registeredAt=_fmt_date(p.created_at),
    )


def list_proposals_all(
    db: Session, *, member_id: uuid.UUID | None = None
) -> list[dict]:
    """엑셀 등 전건이 필요한 경우용(필터/페이지네이션 없음). member_id 지정 시 해당 회원 소유만."""
    # 작성중(new)은 admin 목록에서 제외 — 유저가 제출(execution_requested)해야 노출.
    q = (
        db.query(Proposal)
        .options(joinedload(Proposal.member))
        .filter(Proposal.status != "new")
    )
    if member_id is not None:
        q = q.filter(Proposal.member_id == member_id)
    rows = q.order_by(Proposal.created_at.desc()).all()
    return [_map_proposal(p) for p in rows]


def list_proposals(
    db: Session,
    *,
    date_from: str | None = None,
    date_to: str | None = None,
    keyword: str | None = None,
    status: str | None = None,
    member_id: uuid.UUID | None = None,
    page: int = 1,
    page_size: int = 10,
) -> tuple[int, list[dict]]:
    """등록일(registeredAt) 기간·상태·키워드 필터 + 페이지네이션. (total, items) 반환."""
    rows = list_proposals_all(db, member_id=member_id)

    df = parse_date(date_from)
    dt = parse_date(date_to)
    kw = (keyword or "").strip().lower()

    def keep(r: dict) -> bool:
        if status and r["status"] != status:
            return False
        if kw and kw not in r["name"].lower() and kw not in r["member"].lower():
            return False
        if not in_date_range(r["registeredAt"], df, dt):
            return False
        return True

    filtered = [r for r in rows if keep(r)]
    return paginate(filtered, page, page_size)


_EXPORT_COLUMNS = [
    ("name", "제안서 명"),
    ("member", "이름"),
    ("mediaCount", "매체 수"),
    ("totalAmount", "전체 금액 합계"),
    ("status", "상태"),
    ("registeredAt", "등록일"),
]


def export_proposals_xlsx(db: Session) -> bytes:
    """제안 목록을 xlsx 로 export — 헤더=admin 목록 컬럼."""
    from io import BytesIO

    from openpyxl import Workbook

    rows = list_proposals_all(db)
    wb = Workbook()
    ws = wb.active
    ws.title = "proposals"
    ws.append([label for _, label in _EXPORT_COLUMNS])
    for r in rows:
        ws.append([r.get(key, "") for key, _ in _EXPORT_COLUMNS])
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def get_admin_detail(db: Session, proposal_id: str) -> Optional[dict]:
    """admin 제안 상세 — 회원 정보 + 슬라이드(매체) 항목. 없으면 None."""
    try:
        pid = uuid.UUID(str(proposal_id))
    except (ValueError, AttributeError):
        return None
    p = (
        db.query(Proposal)
        .options(
            joinedload(Proposal.items),
            joinedload(Proposal.member),
            joinedload(Proposal.counter_files),
        )
        .filter(Proposal.id == pid)
        .first()
    )
    if p is None:
        return None
    m = p.member
    if p.submitter_name or p.submitter_email or p.submitter_phone:
        member = dict(
            membership_type=p.submitter_membership_type,
            company_name=p.submitter_company_name,
            name=p.submitter_name,
            email=p.submitter_email,
            phone=p.submitter_phone,
        )
    elif m is not None:
        member = dict(
            membership_type=m.membership_type,
            company_name=m.company_name,
            name=m.name,
            email=m.email,
            phone=m.phone,
        )
    else:
        member = None
    return dict(
        id=str(p.id),
        title=p.title,
        status=_STATUS.get(p.status, p.status),
        deleted=p.deleted_at is not None and p.status != "cancelled",
        total_amount=p.total_amount,
        updated_at=p.updated_at.isoformat() if p.updated_at else None,
        counter_proposal_file_url=p.counter_proposal_file_url,
        counter_proposal_file_name=p.counter_proposal_file_name,
        counter_files=[
            dict(
                id=str(cf.id),
                file_url=cf.file_url,
                file_name=cf.file_name,
                title=cf.title,
                author_name=cf.author_name,
                slides_url=cf.slides_url,
                slides=_slides_from_url(cf.slides_url),
                created_at=cf.created_at.isoformat() if cf.created_at else None,
            )
            for cf in p.counter_files
        ],
        member=member,
        items=to_detail(db, p)["items"],
    )


def update_status(db: Session, proposal_id: str, status: str) -> Optional[Proposal]:
    """제안서 상태 변경. 제안서 없으면 None."""
    try:
        pid = uuid.UUID(str(proposal_id))
    except (ValueError, AttributeError):
        return None
    p = db.query(Proposal).filter(Proposal.id == pid).first()
    if p is None:
        return None
    p.status = status
    db.commit()
    db.refresh(p)
    return p


def save_counter_proposal_file(
    db: Session,
    proposal_id: str,
    *,
    file_url: str,
    file_name: str,
    title: Optional[str] = None,
    slides_url: Optional[str] = None,
    author_name: Optional[str] = None,
) -> Optional[Proposal]:
    """맞춤제안 PPT 파일 정보를 제안서에 저장. 제안서 없으면 None."""
    try:
        pid = uuid.UUID(str(proposal_id))
    except (ValueError, AttributeError):
        return None
    p = db.query(Proposal).filter(Proposal.id == pid).first()
    if p is None:
        return None
    p.counter_files.append(
        ProposalCounterFile(
            file_url=file_url,
            file_name=file_name,
            title=title,
            author_name=author_name,
            slides_url=slides_url,
        )
    )
    p.counter_proposal_file_url = file_url  # 최신 버전 포인터
    p.counter_proposal_file_name = file_name
    p.counter_proposal_slides_url = slides_url  # 변환 슬라이드 폴더 (최신)
    p.status = "custom"  # 맞춤제안 전송 → 상태 갱신
    db.commit()
    db.refresh(p)
    return p


def send_custom_proposal_email(
    email: str, proposal_id: str, proposal_title: str
) -> None:
    """맞춤제안 전송 시 회원의 연락받을 이메일로 알림 발송 (BackgroundTask 로 호출)."""
    from html import escape

    from src.utils.mailer import send_email

    base = get_settings().email_link_base
    my_url = f"{base}/proposals/{proposal_id}" if base else ""
    logo_html = (
        f'<img src="{base}/service/admix-logo-email.png" alt="ADMIX" '
        'width="120" height="30" style="display:block;border:0;width:120px;height:30px">'
        if base
        else 'ADMIX<span style="color:#00AAA4">●</span>'
    )
    title = proposal_title or "제안서"

    subject = "[ADMIX] 새로운 맞춤제안이 도착했습니다."
    text_lines = [
        "안녕하세요.",
        "회원님이 제출한 제안서를 검토한 후 광고 매체 및 집행 조건을 반영하여 "
        "새로운 맞춤제안이 도착했습니다.",
        "",
        f"- 제안서명 : {title}",
        "",
        "제안서는 서비스 내 [내 제안서]에서 확인할 수 있습니다.",
    ]
    if my_url:
        text_lines.append(my_url)
    text_lines += ["", "감사합니다.", "", "ADMIX 드림"]
    text = "\n".join(text_lines)

    safe_title = escape(title)
    my_proposal = (
        f'<a href="{my_url}" style="color:#00AAA4;text-decoration:none">[내 제안서]</a>'
        if my_url
        else "[내 제안서]"
    )
    button_html = (
        f"""
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0">
                <tr>
                  <td bgcolor="#00AAA4" style="border-radius:8px">
                    <a href="{my_url}" style="display:inline-block;padding:12px 24px;font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:15px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;border-radius:8px">내 제안서 확인하기</a>
                  </td>
                </tr>
              </table>"""
        if my_url
        else ""
    )
    html = f"""\
<div style="margin:0;padding:0;background-color:#000000">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#000000">
    <tr>
      <td align="center" style="padding:24px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#000000">
          <tr>
            <td style="padding:24px 0;font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:22px;font-weight:700;letter-spacing:0.5px;color:#ffffff">
              {logo_html}
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:17px;font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:20px;font-weight:600;line-height:28px;letter-spacing:-0.08px;color:#ffffff">
              [ADMIX] 새로운 맞춤제안이 도착했습니다.
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:17px;font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:16px;font-weight:500;line-height:24px;color:#ffffff">
              안녕하세요.<br>
              회원님이 제출한 제안서를 검토한 후 광고 매체 및 집행 조건을 반영하여 새로운 맞춤제안이 도착했습니다.
              <ul style="margin:24px 0 0;padding-left:24px">
                <li style="line-height:24px">제안서명 : {safe_title}</li>
              </ul>
            </td>
          </tr>
          <tr>
            <td style="font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:16px;font-weight:500;line-height:24px;color:#ffffff">
              제안서는 서비스 내 {my_proposal}에서 확인할 수 있습니다.<br><br>
              감사합니다.<br><br>
              ADMIX 드림{button_html}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>"""

    send_email(email, subject, text, html)


def send_contract_completed_email(
    email: str, proposal_id: str, proposal_title: str
) -> None:
    """집행 수락(계약 완료) 시 회원의 연락받을 이메일로 알림 발송 (BackgroundTask 로 호출)."""
    from html import escape

    from src.utils.mailer import send_email

    base = get_settings().email_link_base
    my_url = f"{base}/proposals/{proposal_id}" if base else ""
    logo_html = (
        f'<img src="{base}/service/admix-logo-email.png" alt="ADMIX" '
        'width="120" height="30" style="display:block;border:0;width:120px;height:30px">'
        if base
        else 'ADMIX<span style="color:#00AAA4">●</span>'
    )
    title = proposal_title or "제안서"

    subject = "[ADMIX] 광고 계약이 완료되었습니다"
    text_lines = [
        "안녕하세요.",
        "회원님이 요청하신 광고 계약이 완료되었습니다.",
        "",
        f"- 제안서명 : {title}",
        "",
        "아래 버튼을 통해 최종 제안서를 확인해 보세요.",
        "제안서는 서비스 내 [내 제안서]에서 확인할 수 있습니다.",
    ]
    if my_url:
        text_lines.append(my_url)
    text_lines += ["", "감사합니다.", "", "ADMIX 드림"]
    text = "\n".join(text_lines)

    safe_title = escape(title)
    my_proposal = (
        f'<a href="{my_url}" style="color:#00AAA4;text-decoration:none">[내 제안서]</a>'
        if my_url
        else "[내 제안서]"
    )
    button_html = (
        f"""
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0">
                <tr>
                  <td bgcolor="#00AAA4" style="border-radius:8px">
                    <a href="{my_url}" style="display:inline-block;padding:12px 24px;font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:15px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;border-radius:8px">내 제안서 확인하기</a>
                  </td>
                </tr>
              </table>"""
        if my_url
        else ""
    )
    html = f"""\
<div style="margin:0;padding:0;background-color:#000000">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#000000">
    <tr>
      <td align="center" style="padding:24px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#000000">
          <tr>
            <td style="padding:24px 0;font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:22px;font-weight:700;letter-spacing:0.5px;color:#ffffff">
              {logo_html}
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:17px;font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:20px;font-weight:600;line-height:28px;letter-spacing:-0.08px;color:#ffffff">
              [ADMIX] 광고 계약이 완료되었습니다
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:17px;font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:16px;font-weight:500;line-height:24px;color:#ffffff">
              안녕하세요.<br>
              회원님이 요청하신 광고 계약이 완료되었습니다.
              <ul style="margin:24px 0 0;padding-left:24px">
                <li style="line-height:24px">제안서명 : {safe_title}</li>
              </ul>
            </td>
          </tr>
          <tr>
            <td style="font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:16px;font-weight:500;line-height:24px;color:#ffffff">
              아래 버튼을 통해 최종 제안서를 확인해 보세요.<br><br>
              제안서는 서비스 내 {my_proposal}에서 확인할 수 있습니다.<br><br>
              감사합니다.<br><br>
              ADMIX 드림{button_html}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>"""

    send_email(email, subject, text, html)


# ===== 클라이언트 장바구니(플래닝) CRUD =====


def create_proposal(
    db: Session,
    title: str,
    *,
    member_id: Optional[uuid.UUID] = None,
    session_id: Optional[uuid.UUID] = None,
    user: Optional[User] = None,
    enforce_limit: bool = True,
) -> Proposal:
    """제안서 생성. enforce_limit 시 티어 한도 초과면 ProposalLimitError."""
    if enforce_limit and not can_create_proposal(
        db, member_id=member_id, session_id=session_id, user=user
    ):
        tier = proposal_tier(user)
        raise ProposalLimitError(tier, proposal_limit(user) or 0)
    p = Proposal(
        title=title.strip()[:300] or "새 제안서",
        member_id=member_id,
        session_id=session_id,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def list_for_owner(
    db: Session,
    *,
    member_id: Optional[uuid.UUID] = None,
    session_id: Optional[uuid.UUID] = None,
) -> list[Proposal]:
    q = db.query(Proposal).options(joinedload(Proposal.items))
    if member_id is not None:
        q = q.filter(Proposal.member_id == member_id)
    elif session_id is not None:
        q = q.filter(Proposal.session_id == session_id)
    else:
        return []
    # 유저가 삭제(논리삭제)한 제안서는 목록에서 숨긴다.
    q = q.filter(Proposal.deleted_at.is_(None))
    return q.order_by(Proposal.updated_at.desc()).all()


def get_owned(
    db: Session,
    proposal_id: str,
    *,
    member_id: Optional[uuid.UUID] = None,
    session_id: Optional[uuid.UUID] = None,
) -> Optional[Proposal]:
    """소유권 확인 후 제안서 반환. 권한 없으면 None."""
    try:
        pid = uuid.UUID(str(proposal_id))
    except (ValueError, AttributeError):
        return None
    p = (
        db.query(Proposal)
        .options(joinedload(Proposal.items))
        .filter(Proposal.id == pid, Proposal.deleted_at.is_(None))
        .first()
    )
    if p is None:
        return None
    if member_id is not None and p.member_id == member_id:
        return p
    if session_id is not None and p.session_id == session_id:
        return p
    return None


def rename(db: Session, proposal: Proposal, title: str) -> Proposal:
    proposal.title = title.strip()[:300] or proposal.title
    db.commit()
    db.refresh(proposal)
    return proposal


def delete(db: Session, proposal: Proposal) -> None:
    """유저 삭제. 상태에 따라 처리가 갈린다.
    - new(작성중): 완전삭제(행 제거) — admin 에 노출된 적 없는 초안.
    - execution_requested/custom(제출완료·맞춤제안): status=cancelled(취소) 로 전환.
    - contracted(계약완료): status 유지 + deleted_at 기록 → admin 에 "계약완료 + 삭제됨".
    """
    if proposal.status == "new":
        db.delete(proposal)
        db.commit()
        return
    if proposal.status in ("execution_requested", "custom"):
        proposal.status = "cancelled"
    proposal.deleted_at = datetime.now(timezone.utc)
    db.commit()


def _recount(proposal: Proposal) -> None:
    proposal.media_count = len(proposal.items)
    # 수량 기본값 1 — 광고비 합계에 수량을 곱해 총액 산출(제작비는 기존 정의대로 제외)
    proposal.total_amount = sum(
        (it.price or 0) * (it.quantity or 1) for it in proposal.items
    )


def _rep_image_url(media: Media) -> str | None:
    """media_image 대표 이미지 URL (is_thumbnail 우선, 없으면 sort_order 최소)."""
    imgs = sorted(media.images, key=lambda i: (not i.is_thumbnail, i.sort_order))
    return imgs[0].image_url if imgs else None


def add_items(
    db: Session,
    proposal: Proposal,
    media_ids: list[str],
    plans: dict[str, int] | None = None,
) -> Proposal:
    """media_ids 를 매체 마스터에서 조회해 스냅샷으로 담는다. 중복은 무시.

    plans({media_id: plan_no}) 가 주어지면 담을 때 해당 플랜을 지정한다.
    """
    existing = {it.media_id for it in proposal.items}
    wanted = [m for m in dict.fromkeys(media_ids) if m and m not in existing]
    if wanted:
        rows = {
            m.media_id: m
            for m in db.query(Media).filter(Media.media_id.in_(wanted)).all()
        }
        for mid in wanted:
            media = rows.get(mid)
            if media is None:
                continue
            proposal.items.append(
                ProposalItem(
                    media_id=mid,
                    name=media.name,
                    price=media.min_advertisement_fee_krw,
                    thumbnail_url=_rep_image_url(media),
                    selected_plan_no=plans.get(mid) if plans else None,
                    quantity=1,
                )
            )
        _recount(proposal)
        db.commit()
        db.refresh(proposal)
    return proposal


def remove_item(db: Session, proposal: Proposal, media_id: str) -> Proposal:
    proposal.items[:] = [it for it in proposal.items if it.media_id != media_id]
    _recount(proposal)
    db.commit()
    db.refresh(proposal)
    return proposal


def reorder_items(
    db: Session,
    proposal: Proposal,
    media_ids: list[str],
    plans: dict[str, int] | None = None,
    dates: dict[str, dict[str, str | None]] | None = None,
    quantities: dict[str, int | None] | None = None,
) -> Proposal:
    order = {media_id: index for index, media_id in enumerate(media_ids)}
    fallback = len(order)
    for item in proposal.items:
        item.position = order.get(item.media_id, fallback)
        if plans and item.media_id in plans:
            item.selected_plan_no = plans[item.media_id]
        if dates and item.media_id in dates:
            item.start_date = dates[item.media_id].get("start_date")
            item.end_date = dates[item.media_id].get("end_date")
        if quantities and item.media_id in quantities:
            item.quantity = quantities[item.media_id]
    _recount(proposal)  # 수량 변경분을 total_amount 에 반영
    db.commit()
    db.refresh(proposal)
    return proposal


def claim_session_proposals(
    db: Session, *, member_id: uuid.UUID, session_id: Optional[str]
) -> int:
    """비회원 세션이 소유한 제안서를 회원 계정으로 이관(claim). 이관 개수 반환."""
    if session_id is None:
        return 0
    try:
        sid = uuid.UUID(str(session_id))
    except (ValueError, AttributeError):
        return 0
    rows = (
        db.query(Proposal)
        .filter(Proposal.session_id == sid, Proposal.member_id.is_(None))
        .all()
    )
    for p in rows:
        p.member_id = member_id
        p.session_id = None
    if rows:
        db.commit()
    return len(rows)


def to_summary(p: Proposal) -> dict:
    return dict(
        id=str(p.id),
        title=p.title,
        status=p.status,
        media_count=p.media_count,
        total_amount=p.total_amount,
        updated_at=p.updated_at.isoformat() if p.updated_at else None,
        media_ids=[it.media_id for it in p.items],
    )


def to_detail(db: Session, p: Proposal) -> dict:
    media_ids = [it.media_id for it in p.items]
    media_map: dict = {}
    if media_ids:
        rows = (
            db.query(Media)
            .options(joinedload(Media.plans))
            .filter(Media.media_id.in_(media_ids))
            .all()
        )
        media_map = {m.media_id: m for m in rows}

    def _spec(m) -> Optional[str]:
        # properties_extra_json 중 width 값이 있는 첫 property = 규격
        for prop in (m.properties_extra_json or []) if m else []:
            width = prop.get("propertyWidthValue")
            if width is None:
                continue
            height = prop.get("propertyHeightValue")
            unit = prop.get("propertyUnit") or ""
            base = f"{width} x {height}" if height is not None else f"{width}"
            return f"{base} {unit}".strip()
        return None

    def _item(it) -> dict:
        m = media_map.get(it.media_id)
        plans = list(m.plans) if m else []
        # 선택 plan: selected_plan_no 우선, 없으면 plan1(plans[0], plan_no 오름차순)
        plan = None
        if plans:
            plan = next(
                (pl for pl in plans if pl.plan_no == it.selected_plan_no),
                plans[0],
            )
        return dict(
            media_id=it.media_id,
            name=plan.product_name if plan and plan.product_name else it.name,
            price=(
                plan.advertisement_fee
                if plan and plan.advertisement_fee is not None
                else it.price
            ),
            production_fee=plan.production_fee if plan else None,
            thumbnail_url=it.thumbnail_url,
            category=m.category_small if m else None,
            region=m.market_area if m else None,
            product=plan.product_display_name if plan else None,
            address=m.address if m else None,
            ooh_type=m.ooh_type if m else None,
            description=m.description if m else None,
            device_quantity=m.device_quantity if m else None,
            surface_quantity=m.surface_quantity if m else None,
            latitude=float(m.latitude) if m and m.latitude is not None else None,
            longitude=float(m.longitude) if m and m.longitude is not None else None,
            spec=_spec(m),
            start_date=it.start_date,
            end_date=it.end_date,
            quantity=it.quantity,
            selected_plan_no=plan.plan_no if plan else None,
            plans=[
                dict(
                    plan_no=pl.plan_no,
                    product_name=pl.product_name,
                    product_display_name=pl.product_display_name,
                    advertisement_fee=pl.advertisement_fee,
                    production_fee=pl.production_fee,
                    operation_start_time=pl.operation_start_time,
                    operation_end_time=pl.operation_end_time,
                )
                for pl in plans
            ],
        )

    slides_url, slides = _counter_slides(p)
    return dict(
        **to_summary(p),
        items=[_item(it) for it in p.items],
        counter_proposal_slides_url=slides_url,
        counter_proposal_slides=slides,
        counter_proposal_file_name=p.counter_proposal_file_name,
    )


def _slides_from_url(url: Optional[str]) -> list[dict]:
    """슬라이드 폴더 URL 의 meta.json 을 읽어 슬라이드 목록 반환."""
    if not url:
        return []
    rel = url[len("/uploads"):] if url.startswith("/uploads") else url
    meta_path = os.path.join(get_settings().upload_dir, rel.lstrip("/"), "meta.json")
    try:
        with open(meta_path, encoding="utf-8") as f:
            return json.load(f).get("slides", [])
    except (OSError, json.JSONDecodeError):
        return []


def _counter_slides(p: Proposal) -> tuple[Optional[str], list[dict]]:
    """제안서 최신 맞춤제안 슬라이드 (URL, 목록)."""
    url = p.counter_proposal_slides_url
    return url, _slides_from_url(url)
