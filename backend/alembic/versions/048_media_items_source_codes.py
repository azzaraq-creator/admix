"""믹시 검색 표(media_items)에 엑셀 원본 코드 보관 칸(source_codes) 추가

매체를 저장할 때마다 자동 태그(지역·카테고리·업종·타깃)를 계산해 코드 칸에 더한다(ai_index).
다시 계산해도 엑셀에서 온 코드가 사라지지 않게, 지금 코드 칸 값을 source_codes 에 한 번 옮겨 둔다.

Revision ID: 048_media_items_source_codes
Revises: 047_recount_proposal_total
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "048_media_items_source_codes"
down_revision = "047_recount_proposal_total"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("media_items", sa.Column("source_codes", JSONB, nullable=True))
    op.execute(
        """
        UPDATE media_items
        SET source_codes = jsonb_build_object(
            'ind', ind_codes, 'prd', prd_codes, 'obj', obj_codes,
            'tgt', tgt_codes, 'loc', loc_codes, 'cat', cat_codes
        )
        """
    )


def downgrade() -> None:
    op.drop_column("media_items", "source_codes")
