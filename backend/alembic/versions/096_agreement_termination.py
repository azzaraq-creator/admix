"""제휴사 기본협약 해지(갱신 거절) — users.partner_termination_requested_at · partner_termination_effective_on

어드민 제휴사 회원 상세에서 "협약 해지"를 누르면 그때의 다음 자동 갱신일까지 협약이 유효하고, 그날부터 끝난다
(2026-11-18 사용자: "다음 자동 갱신 날짜가 10월 1일인데 9월 1일에 해제한다고 하면 … 그 이후부턴 알아서 해지").
협약 기간은 서명일부터 1년, 만료일까지 갱신 거절이 없으면 1년씩 자동 갱신(협약서 협약 기간 조항).
requested_at — 해지를 누른 시각. effective_on — 협약이 끝나는 날(KST, 그날부터 효력 없음 = 그때의 다음 갱신일).
종료일 전에는 해지를 취소할 수 있고(둘 다 지운다), 지난 뒤엔 그대로 남는다.

Revision ID: 096_agreement_termination
Revises: 095_biz_rejected_at
"""
import sqlalchemy as sa
from alembic import op

revision = "096_agreement_termination"
down_revision = "095_biz_rejected_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("partner_termination_requested_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("partner_termination_effective_on", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "partner_termination_effective_on")
    op.drop_column("users", "partner_termination_requested_at")
