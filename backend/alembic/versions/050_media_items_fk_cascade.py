"""media_items → media 외래키를 ON DELETE CASCADE 로 — 매체를 지우면 믹시 검색 표 줄도 함께 지운다

이제 모든 매체가 검색 표에 한 줄씩 있다(ai_index). 검색 표는 매체에서 만들어지는 값이라 매체와 함께 지운다.

Revision ID: 050_media_items_fk_cascade
Revises: 049_add_media_target_codes
"""
from alembic import op

revision = "050_media_items_fk_cascade"
down_revision = "049_add_media_target_codes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("fk_media_items_media_id", "media_items", type_="foreignkey")
    op.create_foreign_key(
        "fk_media_items_media_id", "media_items", "media",
        ["media_id"], ["media_id"], ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("fk_media_items_media_id", "media_items", type_="foreignkey")
    op.create_foreign_key(
        "fk_media_items_media_id", "media_items", "media", ["media_id"], ["media_id"],
    )
