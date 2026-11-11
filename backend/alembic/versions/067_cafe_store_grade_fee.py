"""콜라보 매장 등급·금액 — cafe_store.collab_grade · collab_fee

광고주가 콜라보할 매장을 담을 때 보는 매장별 금액(1건 기준, 원)과 그 기준 등급(S 초대형 · A 대형 · B 소형 · C 테이크아웃).
admix가 어드민 "콜라보 매장 관리"에서 정한다. 확정 매장 금액 합계가 광고주 비용이 된다.
매장(제휴사) 화면에는 보이지 않고, 광고주와 어드민만 본다.

Revision ID: 067_cafe_store_grade_fee
Revises: 066_user_brand_image
"""
import sqlalchemy as sa
from alembic import op

revision = "067_cafe_store_grade_fee"
down_revision = "066_user_brand_image"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("cafe_store", sa.Column("collab_grade", sa.String(1), nullable=True))
    op.add_column("cafe_store", sa.Column("collab_fee", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("cafe_store", "collab_fee")
    op.drop_column("cafe_store", "collab_grade")
