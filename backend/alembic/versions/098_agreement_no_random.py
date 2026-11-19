"""협약서 문서번호 무작위 + 요청 · 작성일시 — users.partner_agreement_no 길이 · partner_agreement_requested_at · partner_agreement_started_at

문서번호를 "ADMIX-COLLAB-{서명 날짜 KST}-{무작위 6자리}"로 바꾼다(2026-11-19 사용자: "ADMIX-어쩌고-날짜-랜덤번호") — 20자로는
모자라 40자로 늘리고, 097 때 매긴 번호("20261118-00001")도 같은 날짜로 새 형식에 맞춰 다시 매긴다(사용자: "새로 맞춘 걸로 바꿔줘").
협약서 표지의 세 시각(2026-11-19 사용자):
- partner_agreement_requested_at — 요청일시. 회원가입을 마치고 협약서 작성으로 넘어간 때(처음 협약 = 가입 시각).
- partner_agreement_started_at — 작성일시. 협약서를 작성하기 시작한 때(진행 상태 첫 저장).
- 체결일시는 서명을 마친 partner_agreed_at.
이미 동의한 회원은 요청일시 = 가입 시각, 작성일시 = 기록이 없어 체결 시각으로 채운다.

Revision ID: 098_agreement_no_random
Revises: 097_partner_agreement_no
"""
import re
import secrets

import sqlalchemy as sa
from alembic import op

revision = "098_agreement_no_random"
down_revision = "097_partner_agreement_no"
branch_labels = None
depends_on = None

_OLD_NO = re.compile(r"^(\d{8})-\d{5}$")


def upgrade() -> None:
    op.alter_column("users", "partner_agreement_no", type_=sa.String(40), existing_type=sa.String(20), existing_nullable=True)
    op.add_column("users", sa.Column("partner_agreement_requested_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("partner_agreement_started_at", sa.DateTime(timezone=True), nullable=True))

    conn = op.get_bind()
    # 097 형식 번호 → 같은 날짜의 새 형식(무작위 6자리, 겹치지 않게).
    used = {r[0] for r in conn.execute(sa.text("SELECT partner_agreement_no FROM users WHERE partner_agreement_no IS NOT NULL"))}
    rows = conn.execute(sa.text("SELECT id, partner_agreement_no FROM users WHERE partner_agreement_no IS NOT NULL")).fetchall()
    for user_id, no in rows:
        m = _OLD_NO.match(no)
        if not m:
            continue
        while True:
            new = f"ADMIX-COLLAB-{m.group(1)}-{secrets.randbelow(900_000) + 100_000}"
            if new not in used:
                break
        used.add(new)
        conn.execute(sa.text("UPDATE users SET partner_agreement_no = :no WHERE id = :id"), {"no": new, "id": user_id})

    # 이미 동의한 회원 — 요청일시는 가입 시각, 작성일시는 기록이 없어 체결 시각.
    conn.execute(
        sa.text(
            "UPDATE users SET partner_agreement_requested_at = created_at "
            "WHERE partner_agreed_at IS NOT NULL AND partner_agreement_requested_at IS NULL"
        )
    )
    conn.execute(
        sa.text(
            "UPDATE users SET partner_agreement_started_at = partner_agreed_at "
            "WHERE partner_agreed_at IS NOT NULL AND partner_agreement_started_at IS NULL"
        )
    )


def downgrade() -> None:
    op.drop_column("users", "partner_agreement_started_at")
    op.drop_column("users", "partner_agreement_requested_at")
    # 새 형식 번호(40자)는 20자 칸에 안 들어가 지운다.
    op.execute("UPDATE users SET partner_agreement_no = NULL WHERE length(partner_agreement_no) > 20")
    op.alter_column("users", "partner_agreement_no", type_=sa.String(20), existing_type=sa.String(40), existing_nullable=True)
