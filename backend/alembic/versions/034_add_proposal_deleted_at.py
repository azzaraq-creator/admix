"""add deleted_at to proposal (soft delete)

Revision ID: 034_proposal_deleted_at
Revises: 033_sanction_detail
"""
from alembic import op
import sqlalchemy as sa

revision = "034_proposal_deleted_at"
down_revision = "033_sanction_detail"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "proposal",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("proposal", "deleted_at")
