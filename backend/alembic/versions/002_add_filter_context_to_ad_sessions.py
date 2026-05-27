"""add filter_context to ad_sessions"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "002_add_filter_context"
down_revision = "001_create_media_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ad_sessions",
        sa.Column("filter_context", JSONB(none_as_null=True), nullable=True, default=dict),
    )


def downgrade() -> None:
    op.drop_column("ad_sessions", "filter_context")
