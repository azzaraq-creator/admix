"""add author name snapshot to faq and inquiry

Revision ID: 027_faq_inquiry_author_name
Revises: 026_counter_file_slides_url
"""
from alembic import op
import sqlalchemy as sa

revision = "027_faq_inquiry_author_name"
down_revision = "026_counter_file_slides_url"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "faq",
        sa.Column("created_by_name", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "inquiry",
        sa.Column("answered_by_name", sa.String(length=100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("inquiry", "answered_by_name")
    op.drop_column("faq", "created_by_name")
