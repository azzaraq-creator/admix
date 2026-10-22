"""유동인구 격자 지도 — 서울 250m 격자의 월별 생활인구·체류인구·지하철·버스·보행 값(pop_grid_month, pop_grid_value)

- 격자 8,617칸의 목록·모양은 src/assets/geo/pop-grid-cells.json(고정). 값은 그 순서대로 칸마다 2바이트.
- pop_grid_value: (달·자료·시간대·성연령) 한 줄에 서울 격자 전체 값을 담는다 — 인계 월 파일(period/YYYYMM.js)과 같은
  부호화(uint16 little-endian, 값 = 정수 × scale, 65535 = 그 달 자료 없음). 한 달에 약 200줄.
  metric: live(생활인구 내국인) · live_fs/live_fl(단기·장기 외국인) · stay/stay60/stay240(체류 전체·60분+·240분+)
          · subway · bus(교통카드 승하차) · walk(상권 길단위인구, 분기 값)
  band: all(24시간) · am(출근 7-9) · day(낮 10-16) · pm(퇴근 17-19) · night(야간 20-23)
  seg: ALL 또는 성×10세 M00~M70·F00~F70 (생활·체류만)
- pop_grid_month: 들어 있는 달과 일수·출처. 어드민 "유동인구 데이터"에서 올리고 지운다.

Revision ID: 058_pop_grid
Revises: 057_media_facing_direction
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "058_pop_grid"
down_revision = "057_media_facing_direction"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pop_grid_month",
        sa.Column("ym", sa.String(6), primary_key=True),  # "202505"
        sa.Column("days", sa.Integer(), nullable=False),
        # 자료별 출처 {"live": {"source": "handover"|"seoul-raw", "files": [...], "uploaded_at": ..., "by": ...}, ...}
        sa.Column("sources", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "pop_grid_value",
        sa.Column("ym", sa.String(6), sa.ForeignKey("pop_grid_month.ym", ondelete="CASCADE"), primary_key=True),
        sa.Column("metric", sa.String(16), primary_key=True),
        sa.Column("band", sa.String(8), primary_key=True),
        sa.Column("seg", sa.String(4), primary_key=True),
        sa.Column("scale", sa.Float(), nullable=False),
        sa.Column("data", sa.LargeBinary(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("pop_grid_value")
    op.drop_table("pop_grid_month")
