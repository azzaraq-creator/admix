"""신규 매체 자동 판단 — is_newly_built_yn "아니오"(false)를 비움(자동)으로

신규 뱃지 규칙이 바뀌었다(media_service.is_new_media):
- 비어 있음(NULL) = 자동: 등록 후 14일 동안 신규(등록일 = source_created_at, 없으면 created_at)
- 예(true) / 아니오(false) = 관리자가 고른 값으로 고정

지금까지 false 는 "신규 아님"이라는 기본값이었을 뿐이라 자동으로 돌린다. 기존 매체는 모두 등록된 지 14일이
지나 결과(뱃지 없음)는 그대로다. true 는 관리자·원천이 직접 고른 값으로 보고 그대로 둔다.

Revision ID: 051_media_new_badge_auto
Revises: 050_media_items_fk_cascade
"""
from alembic import op

revision = "051_media_new_badge_auto"
down_revision = "050_media_items_fk_cascade"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE media SET is_newly_built_yn = NULL WHERE is_newly_built_yn = false")


def downgrade() -> None:
    # 자동(NULL)을 예전 기본값(아니오)으로 되돌린다 — 이 마이그레이션 뒤에 관리자가 고른 값과는 구분하지 못한다.
    op.execute("UPDATE media SET is_newly_built_yn = false WHERE is_newly_built_yn IS NULL")
