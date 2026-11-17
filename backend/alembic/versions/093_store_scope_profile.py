"""매장 가능 범위 · 주요 고객층 · 소개 · 규모(2026-11-17 사용자).

- scope: 조건 메모 대신 정해진 항목마다 가능 · 불가능. 항목은 partners_service.SCOPE_ITEMS(브랜딩 제작물 · 브랜드 굿즈 ·
  브랜딩 소모품 · DP 및 체험 · 협업 메뉴 · 공간 활용). {"print": "ok", "goods": "no", …} — 고르지 않은 항목은 넣지 않는다.
  예전 조건 메모(notes)는 칸만 남기고 읽고 쓰지 않는다.
- main_customers 주요 고객층 · intro 소개(2~3줄) · seats 규모(좌석 수) — 어드민 매장 정보 탭 · 영업 기록 매장 정보에서 적는다.

Revision ID: 093_store_scope_profile
Revises: 092_collab_lead_store_info
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "093_store_scope_profile"
down_revision = "092_collab_lead_store_info"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("cafe_store", sa.Column("scope", postgresql.JSONB(), nullable=False, server_default="{}"))
    op.add_column("cafe_store", sa.Column("main_customers", sa.String(100), nullable=True))
    op.add_column("cafe_store", sa.Column("intro", sa.String(300), nullable=True))
    op.add_column("cafe_store", sa.Column("seats", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("cafe_store", "seats")
    op.drop_column("cafe_store", "intro")
    op.drop_column("cafe_store", "main_customers")
    op.drop_column("cafe_store", "scope")
