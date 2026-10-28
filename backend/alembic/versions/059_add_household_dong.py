"""행정동 세대수 — 행정안전부 「지역별(행정동) 세대원수별 주민등록 세대수」 월별 값(household_dong)

- 어드민 "유동인구 데이터"에서 공공데이터포털 CSV(전국 약 3,600줄)를 올린다. 서울 행정동만 담는다.
- 매체 찾기 지도 "유동인구" 층의 "거주인구" 자료 — 250m 격자 칸을 그 칸의 동(pop-grid-cells.json)의 값으로 칠한다.
- counts: 1인·2인·…·9인·10인 이상 세대수 10칸.

Revision ID: 059_household_dong
Revises: 058_pop_grid
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "059_household_dong"
down_revision = "058_pop_grid"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "household_dong",
        sa.Column("ym", sa.String(6), primary_key=True),  # 기준연월 "202609"
        sa.Column("adm_code", sa.String(10), primary_key=True),  # 행정기관코드 10자리
        sa.Column("gu", sa.String(20), nullable=False),
        sa.Column("dong", sa.String(40), nullable=False),
        sa.Column("total", sa.Integer(), nullable=False),
        sa.Column("counts", postgresql.ARRAY(sa.Integer()), nullable=False),
        sa.Column("file", sa.String(200), nullable=True),
        sa.Column("uploaded_by", sa.String(64), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("household_dong")
