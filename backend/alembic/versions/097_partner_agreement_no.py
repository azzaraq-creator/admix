"""제휴사 협약서 문서번호 — users.partner_agreement_no

협약서 PDF 의 "문서번호" — 서명 날짜(KST) + 그날 순번 5자리(예: 20261118-00001), 동의할 때 서버가 매긴다
(2026-11-18 사용자: "문서 번호는 자동 부여로 오늘날짜+00001~99999"). 다시 서명하면(판이 바뀜 · 해지 끝남) 새 번호.
같은 날 판도 v1.0 으로 바뀌어(PARTNER_AGREEMENT_VERSION) 이미 동의한 회원은 모두 다시 동의하므로 지난 동의에는 번호를 채우지 않는다.

Revision ID: 097_partner_agreement_no
Revises: 096_agreement_termination
"""
import sqlalchemy as sa
from alembic import op

revision = "097_partner_agreement_no"
down_revision = "096_agreement_termination"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("partner_agreement_no", sa.String(20), nullable=True))
    op.create_unique_constraint("uq_users_partner_agreement_no", "users", ["partner_agreement_no"])


def downgrade() -> None:
    op.drop_constraint("uq_users_partner_agreement_no", "users", type_="unique")
    op.drop_column("users", "partner_agreement_no")
