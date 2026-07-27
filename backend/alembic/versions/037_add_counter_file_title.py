"""add title to proposal_counter_file

Revision ID: 037_counter_file_title
Revises: 036_proposal_submitter_snapshot
"""
from alembic import op
import sqlalchemy as sa

revision = "037_counter_file_title"
down_revision = "036_proposal_submitter_snapshot"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "proposal_counter_file",
        sa.Column("title", sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("proposal_counter_file", "title")
