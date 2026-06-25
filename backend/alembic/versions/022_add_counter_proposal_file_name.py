"""add counter_proposal_file_name to proposal

Revision ID: 022_counter_proposal_file_name
Revises: 021_proposal_item_quantity
"""
from alembic import op
import sqlalchemy as sa

revision = "022_counter_proposal_file_name"
down_revision = "021_proposal_item_quantity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "proposal",
        sa.Column("counter_proposal_file_name", sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("proposal", "counter_proposal_file_name")
