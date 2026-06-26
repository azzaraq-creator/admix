"""add counter_proposal_slides_url to proposal

Revision ID: 024_counter_proposal_slides_url
Revises: 023_proposal_counter_file
"""
from alembic import op
import sqlalchemy as sa

revision = "024_counter_proposal_slides_url"
down_revision = "023_proposal_counter_file"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "proposal",
        sa.Column("counter_proposal_slides_url", sa.String(length=1000), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("proposal", "counter_proposal_slides_url")
