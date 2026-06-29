"""add slides_url to proposal_counter_file

Revision ID: 026_counter_file_slides_url
Revises: 025_counter_file_author_name
"""
from alembic import op
import sqlalchemy as sa

revision = "026_counter_file_slides_url"
down_revision = "025_counter_file_author_name"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "proposal_counter_file",
        sa.Column("slides_url", sa.String(length=1000), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("proposal_counter_file", "slides_url")
