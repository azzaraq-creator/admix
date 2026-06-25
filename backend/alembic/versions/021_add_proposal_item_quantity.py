"""add quantity to proposal_item

Revision ID: 021_proposal_item_quantity
Revises: 020_proposal_item_dates
"""
from alembic import op
import sqlalchemy as sa

revision = "021_proposal_item_quantity"
down_revision = "020_proposal_item_dates"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("proposal_item", sa.Column("quantity", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("proposal_item", "quantity")
