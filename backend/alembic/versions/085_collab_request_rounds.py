"""콜라보 의뢰 기획안 차수 — admix가 의뢰를 항목별로 고쳐 보내고, 광고주가 다시 고치거나 확정한다(2026-11-12 사용자).

- advertiser_collab_request_rounds: 차수마다 고친 내용 전부(content) · 항목별 수정 이유(notes) · 앞 차수와 달라진 항목(changed).
  1차부터 쌓인다(0차는 광고주가 처음 보낸 의뢰서 — 의뢰 표 줄 그대로).
- advertiser_collab_requests.confirmed_at: 광고주가 기획안을 확인(확정)한 때.
  상태는 글자 칸이라 표를 바꾸지 않고 값만 늘어난다 — submitted · proposed(admix 기획안 보냄) · revised(광고주가 고쳐 보냄) ·
  confirmed · cancelled.

Revision ID: 085_collab_request_rounds
Revises: 084_collab_request_cancel
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "085_collab_request_rounds"
down_revision = "084_collab_request_cancel"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "advertiser_collab_requests",
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "advertiser_collab_request_rounds",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "request_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("advertiser_collab_requests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("round_no", sa.Integer(), nullable=False),
        # admix(어드민이 보냄) · advertiser(광고주가 고쳐 보냄)
        sa.Column("author", sa.String(20), nullable=False),
        # 비교 기준 차수 — 이 차수를 만들 때 펼쳐 둔 앞 차수(0 = 처음 의뢰서).
        sa.Column("base_round_no", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("content", postgresql.JSONB(), nullable=False),
        sa.Column("notes", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("changed", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column(
            "admin_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("admin.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("request_id", "round_no", name="uq_collab_request_round_no"),
    )
    op.create_index(
        "ix_advertiser_collab_request_rounds_request_id",
        "advertiser_collab_request_rounds",
        ["request_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_advertiser_collab_request_rounds_request_id",
        table_name="advertiser_collab_request_rounds",
    )
    op.drop_table("advertiser_collab_request_rounds")
    op.drop_column("advertiser_collab_requests", "confirmed_at")
