"""서울시 교통량 — 측정 지점(traffic_spot)과 지점별 하루 시간대 통행량(traffic_volume_day), 받은 날(traffic_volume_fetch)

- 서울 열린데이터광장 「서울시 교통량 지점 정보」(OA-13314, SpotInfo)·「서울시 교통량 이력 정보」(OA-13316, VolInfo).
- VolInfo 는 지점 1곳 × 1시간씩만 물을 수 있어 서버가 날마다 받아 쌓는다(services/traffic_volume.py).
- 매체 찾기 인구 분포 "차량" — 지점이 있는 도로를 고른 달 하루 평균 통행량 굵기의 선으로 그린다.

Revision ID: 061_traffic_volume
Revises: 060_pop_target
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "061_traffic_volume"
down_revision = "060_pop_target"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "traffic_spot",
        sa.Column("spot_num", sa.String(10), primary_key=True),  # "A-01"
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "traffic_volume_day",
        sa.Column("spot_num", sa.String(10), primary_key=True),
        sa.Column("ymd", sa.String(8), primary_key=True),  # "20261029"
        # 0~23시 통행량(유입 + 유출, 모든 차로 합). 값이 없던 시간은 NULL.
        sa.Column("hours", postgresql.ARRAY(sa.Integer()), nullable=False),
        sa.Column("vol_in", sa.Integer(), nullable=False),
        sa.Column("vol_out", sa.Integer(), nullable=False),
    )
    op.create_index("ix_traffic_volume_day_ymd", "traffic_volume_day", ["ymd"])
    # 다 받은 날 — 값이 없는 지점이 있어도 그날은 다시 받지 않는다.
    op.create_table(
        "traffic_volume_fetch",
        sa.Column("ymd", sa.String(8), primary_key=True),
        sa.Column("spots", sa.Integer(), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("traffic_volume_fetch")
    op.drop_index("ix_traffic_volume_day_ymd", table_name="traffic_volume_day")
    op.drop_table("traffic_volume_day")
    op.drop_table("traffic_spot")
