"""add author_name to proposal_counter_file

Revision ID: 025_counter_file_author_name
Revises: 024_counter_proposal_slides_url
"""
from alembic import op
import sqlalchemy as sa

revision = "025_counter_file_author_name"
down_revision = "024_counter_proposal_slides_url"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "proposal_counter_file",
        sa.Column("author_name", sa.String(length=100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("proposal_counter_file", "author_name")
