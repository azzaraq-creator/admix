"""media_items.media_id FK + thumbnail_url 백필

Revision ID: 035_media_items_media_id_fk
Revises: 034_proposal_deleted_at
"""
from alembic import op
import sqlalchemy as sa

revision = "035_media_items_media_id_fk"
down_revision = "034_proposal_deleted_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("media_items", sa.Column("media_id", sa.String(length=20), nullable=True))
    op.create_index("ix_media_items_media_id", "media_items", ["media_id"])
    op.create_foreign_key(
        "fk_media_items_media_id", "media_items", "media",
        ["media_id"], ["media_id"],
    )
    # 백필: URL 이 아직 일치하는 시점에 media_id 채움
    op.execute(
        """
        UPDATE media_items mi
        SET media_id = m.media_id
        FROM media m
        WHERE mi.thumbnail_url = m.thumbnail_url
          AND mi.thumbnail_url IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_constraint("fk_media_items_media_id", "media_items", type_="foreignkey")
    op.drop_index("ix_media_items_media_id", table_name="media_items")
    op.drop_column("media_items", "media_id")
