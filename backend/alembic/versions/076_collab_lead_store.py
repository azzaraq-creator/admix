"""콜라보 영업 DB — 협업 확정(영업 기록 → 협업 확정 카페)

- collab_lead.store_id: 이 영업 기록으로 만든 매장(cafe_store.id). 차 있으면 협업 확정 — "협업 확정 전" 목록에서 빠진다.
  영업 기록(대화 내용 · 후속 메모 …)은 지우지 않고 그대로 둔다. 매장을 지우면 연결만 풀려 다시 "협업 확정 전"에 보인다.

Revision ID: 076_collab_lead_store
Revises: 075_cafe_store_photo_dates
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "076_collab_lead_store"
down_revision = "075_cafe_store_photo_dates"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "collab_lead",
        sa.Column(
            "store_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("cafe_store.id", ondelete="SET NULL", name="fk_collab_lead_store_id"),
            nullable=True,
        ),
    )
    op.create_index("ix_collab_lead_store_id", "collab_lead", ["store_id"])


def downgrade() -> None:
    op.drop_index("ix_collab_lead_store_id", table_name="collab_lead")
    op.drop_column("collab_lead", "store_id")
