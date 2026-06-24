"""add position to proposal_item

Revision ID: 018_proposal_item_position
Revises: 017_proposal_cart
"""
from alembic import op
import sqlalchemy as sa

revision = "018_proposal_item_position"
down_revision = "017_proposal_cart"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "proposal_item",
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("proposal_item", "position")
