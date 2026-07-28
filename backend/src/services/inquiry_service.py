"""문의 관리 비즈니스 로직 — admin/inquiries 목록·상세·답변."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import BackgroundTasks, HTTPException
from sqlalchemy.orm import Session

from src.models.admin import Admin
from src.models.inquiry import Inquiry
from src.schemas.inquiry import InquiryAnswerUpdate
from src.utils.listing import in_date_range, paginate, parse_date

_STATUS = {"pending": "답변 대기", "answered": "답변 완료"}


def _fmt_date(dt) -> str:
    return dt.date().isoformat() if dt is not None else "-"


def _fmt_dt(dt) -> str | None:
    return dt.isoformat() if dt is not None else None


def _map_inquiry(q) -> dict:
    return dict(
        id=str(q.id),
        name=q.name or "-",
        title=q.subject,
        content=q.content,
        status=_STATUS.get(q.status, q.status),
        submittedAt=_fmt_date(q.created_at),
    )


def list_inquiries_all(
    db: Session, *, member_id: uuid.UUID | None = None
) -> list[dict]:
    """엑셀 등 전건이 필요한 경우용(필터/페이지네이션 없음). member_id 지정 시 해당 회원 소유만."""
    q = db.query(Inquiry)
    if member_id is not None:
        q = q.filter(Inquiry.member_id == member_id)
    rows = q.order_by(Inquiry.created_at.desc()).all()
    return [_map_inquiry(row) for row in rows]


def list_inquiries(
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
    """제출일(submittedAt) 기간·상태·키워드 필터 + 페이지네이션. (total, items) 반환."""
    rows = list_inquiries_all(db, member_id=member_id)

    df = parse_date(date_from)
    dt = parse_date(date_to)
    kw = (keyword or "").strip().lower()

    def keep(r: dict) -> bool:
        if status and r["status"] != status:
            return False
        if kw and kw not in r["title"].lower() and kw not in r["name"].lower():
            return False
        if not in_date_range(r["submittedAt"], df, dt):
            return False
        return True

    return paginate([r for r in rows if keep(r)], page, page_size)


_EXPORT_COLUMNS = [
    ("name", "이름"),
    ("title", "제목"),
    ("content", "문의 내용"),
    ("status", "상태"),
    ("submittedAt", "제출일"),
]


def export_inquiries_xlsx(db: Session) -> bytes:
    """문의 목록을 xlsx 로 export — 헤더=admin 목록 컬럼."""
    from io import BytesIO

    from openpyxl import Workbook

    rows = list_inquiries_all(db)
    wb = Workbook()
    ws = wb.active
    ws.title = "inquiries"
    ws.append([label for _, label in _EXPORT_COLUMNS])
    for r in rows:
        ws.append([r.get(key, "") for key, _ in _EXPORT_COLUMNS])
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _get_or_404(db: Session, inquiry_id: uuid.UUID) -> Inquiry:
    q = db.query(Inquiry).filter(Inquiry.id == inquiry_id).first()
    if q is None:
        raise HTTPException(status_code=404, detail="문의를 찾을 수 없습니다.")
    return q


def _detail(db: Session, q: Inquiry) -> dict:
    answerer = q.answered_by_name
    if answerer is None and q.answered_by is not None:
        admin = db.query(Admin).filter(Admin.id == q.answered_by).first()
        answerer = admin.name if admin else None
    return dict(
        id=q.id,
        name=q.name or "-",
        email=q.email,
        phone=q.phone,
        company=q.company,
        subject=q.subject,
        content=q.content,
        status=_STATUS.get(q.status, q.status),
        submittedAt=_fmt_date(q.created_at),
        answer=q.answer,
        answerer=answerer,
        answeredAt=_fmt_dt(q.answered_at),
    )


def get_inquiry(db: Session, inquiry_id: uuid.UUID) -> dict:
    return _detail(db, _get_or_404(db, inquiry_id))


def create_inquiry(db: Session, member_id: uuid.UUID, data) -> dict:
    """로그인 회원 문의 접수. status=pending 으로 생성."""
    q = Inquiry(
        member_id=member_id,
        name=data.name,
        email=data.email,
        phone=data.phone,
        company=data.company,
        subject=data.subject,
        content=data.content,
        status="pending",
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return get_my_inquiry(db, member_id, q.id)


def list_my_inquiries(db: Session, member_id: uuid.UUID) -> list[dict]:
    """로그인 회원 본인의 문의 목록(최신순)."""
    rows = (
        db.query(Inquiry)
        .filter(Inquiry.member_id == member_id)
        .order_by(Inquiry.created_at.desc())
        .all()
    )
    return [
        dict(
            id=str(q.id),
            subject=q.subject,
            status=q.status,
            createdAt=_fmt_dt(q.created_at),
        )
        for q in rows
    ]


def get_my_inquiry(
    db: Session, member_id: uuid.UUID, inquiry_id: uuid.UUID
) -> dict:
    """본인 소유 문의 상세. 타인/미존재는 404."""
    q = (
        db.query(Inquiry)
        .filter(Inquiry.id == inquiry_id, Inquiry.member_id == member_id)
        .first()
    )
    if q is None:
        raise HTTPException(status_code=404, detail="문의를 찾을 수 없습니다.")
    answerer = q.answered_by_name
    if answerer is None and q.answered_by is not None:
        admin = db.query(Admin).filter(Admin.id == q.answered_by).first()
        answerer = admin.name if admin else None
    return dict(
        id=str(q.id),
        name=q.name or "-",
        email=q.email,
        phone=q.phone,
        company=q.company,
        subject=q.subject,
        content=q.content,
        status=q.status,
        createdAt=_fmt_dt(q.created_at),
        answer=q.answer,
        answererName=answerer,
        answeredAt=_fmt_dt(q.answered_at),
    )


def answer_inquiry(
    db: Session,
    inquiry_id: uuid.UUID,
    data: InquiryAnswerUpdate,
    admin: Admin,
    background: BackgroundTasks,
) -> dict:
    q = _get_or_404(db, inquiry_id)
    q.answer = data.answer
    q.status = "answered"
    q.answered_by = admin.id
    q.answered_by_name = admin.name
    q.answered_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(q)
    # 문의 작성 회원의 연락받을 이메일로 답변 등록 알림 발송 (없으면 문의 시 입력 이메일)
    recipient = (q.member.email if q.member else None) or q.email
    if recipient:
        background.add_task(send_inquiry_answered_email, recipient, q.subject)
    return _detail(db, q)


def send_inquiry_answered_email(email: str, subject: str) -> None:
    """문의 답변 등록 시 알림 이메일 발송 (BackgroundTask 로 호출)."""
    from html import escape

    from src.config import get_settings
    from src.utils.mailer import send_email

    base = get_settings().email_link_base
    my_url = f"{base}/contact?tab=history" if base else ""
    logo_html = (
        f'<img src="{base}/service/admix-logo-email.png" alt="ADMIX" '
        'width="120" height="30" style="display:block;border:0;width:120px;height:30px">'
        if base
        else 'ADMIX<span style="color:#00AAA4">●</span>'
    )
    title = subject or "문의"

    mail_subject = "[ADMIX] 문의하신 내용에 대한 답변이 등록되었습니다."
    text_lines = [
        "안녕하세요.",
        "문의해 주신 내용에 대한 답변이 등록되어 안내드립니다.",
        "",
        f"- 문의 제목 : {title}",
        "",
        "답변 내용은 서비스 내 [문의하기 > 문의내역]에서 확인할 수 있습니다.",
    ]
    if my_url:
        text_lines.append(my_url)
    text_lines += ["", "감사합니다.", "", "ADMIX 드림"]
    text = "\n".join(text_lines)

    safe_title = escape(title)
    my_inquiry = (
        f'<a href="{my_url}" style="color:#00AAA4;text-decoration:none">[문의하기 &gt; 문의내역]</a>'
        if my_url
        else "[문의하기 &gt; 문의내역]"
    )
    button_html = (
        f"""
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0">
                <tr>
                  <td bgcolor="#00AAA4" style="border-radius:8px">
                    <a href="{my_url}" style="display:inline-block;padding:12px 24px;font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:15px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;border-radius:8px">문의내역 확인하기</a>
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
              [ADMIX] 문의하신 내용에 대한 답변이 등록되었습니다.
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:17px;font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:16px;font-weight:500;line-height:24px;color:#ffffff">
              안녕하세요.<br>
              문의해 주신 내용에 대한 답변이 등록되어 안내드립니다.
              <ul style="margin:24px 0 0;padding-left:24px">
                <li style="line-height:24px">문의 제목 : {safe_title}</li>
              </ul>
            </td>
          </tr>
          <tr>
            <td style="font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:16px;font-weight:500;line-height:24px;color:#ffffff">
              답변 내용은 서비스 내 {my_inquiry}에서 확인할 수 있습니다.<br><br>
              감사합니다.<br><br>
              ADMIX 드림{button_html}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>"""

    send_email(email, mail_subject, text, html)
