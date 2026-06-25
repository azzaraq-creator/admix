"""add start_date/end_date to proposal_item

Revision ID: 020_proposal_item_dates
Revises: 019_proposal_item_selected_plan
"""
from alembic import op
import sqlalchemy as sa

revision = "020_proposal_item_dates"
down_revision = "019_proposal_item_selected_plan"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("proposal_item", sa.Column("start_date", sa.String(length=20), nullable=True))
    op.add_column("proposal_item", sa.Column("end_date", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("proposal_item", "end_date")
    op.drop_column("proposal_item", "start_date")
