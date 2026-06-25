"""add selected_plan_no to proposal_item

Revision ID: 019_proposal_item_selected_plan
Revises: 018_proposal_item_position
"""
from alembic import op
import sqlalchemy as sa

revision = "019_proposal_item_selected_plan"
down_revision = "018_proposal_item_position"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "proposal_item",
        sa.Column("selected_plan_no", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("proposal_item", "selected_plan_no")
