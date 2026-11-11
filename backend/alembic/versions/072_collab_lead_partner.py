"""콜라보 영업 DB — 영업 기록에 제휴사 회원 연결

- collab_lead.partner_user_id: 이 매장(영업 기록)을 가입한 제휴사 회원(users.id). 비어 있으면 아직 가입 · 연결 전.
  어드민 영업 기록 상세 맨 위 "회원 검색"에서 고른다(고유번호 P-0001 로 보낸다). 회원을 지우면 연결만 풀린다.

Revision ID: 072_collab_lead_partner
Revises: 071_collab_lead
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "072_collab_lead_partner"
down_revision = "071_collab_lead"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "collab_lead",
        sa.Column(
            "partner_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL", name="fk_collab_lead_partner_user_id"),
            nullable=True,
        ),
    )
    op.create_index("ix_collab_lead_partner_user_id", "collab_lead", ["partner_user_id"])


def downgrade() -> None:
    op.drop_index("ix_collab_lead_partner_user_id", table_name="collab_lead")
    op.drop_column("collab_lead", "partner_user_id")
