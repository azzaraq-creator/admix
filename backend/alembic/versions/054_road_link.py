"""서울시 도로 링크(road_link) — 매체 찾기 지도 "도로 현황"에 그릴 도로 구간과 모양

서울시 교통정보시스템(TOPIS) OpenAPI로 받는다: 도로(RoadInfo) → 도로별 링크(LinkWithLoad) → 링크 정보(LinkInfo)·
꼭짓점(LinkVerInfo, TM 좌표를 위경도로 바꿔 path 에 [[위도, 경도], ...] JSON 으로). 약 5,300개.
실시간 속도(TrafficInfo, 링크 하나씩)는 저장하지 않고 지도를 볼 때 묻는다(services/road_traffic.py, 5분 캐시).

Revision ID: 054_road_link
Revises: 053_transit_ridership
"""
import sqlalchemy as sa
from alembic import op

revision = "054_road_link"
down_revision = "053_transit_ridership"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("road_link"):
        return
    op.create_table(
        "road_link",
        sa.Column("link_id", sa.String(20), primary_key=True),
        sa.Column("road_name", sa.Text(), nullable=True),
        sa.Column("road_div_cd", sa.String(4), nullable=True),  # 02 도시고속도로 · 03 주간선 · 04 보조간선 · 05 기타
        sa.Column("axis_dir", sa.String(10), nullable=True),  # 상행·하행 등
        sa.Column("st_node_nm", sa.Text(), nullable=True),
        sa.Column("ed_node_nm", sa.Text(), nullable=True),
        sa.Column("path", sa.Text(), nullable=False),
        sa.Column("min_lat", sa.Float(), nullable=False),
        sa.Column("max_lat", sa.Float(), nullable=False),
        sa.Column("min_lng", sa.Float(), nullable=False),
        sa.Column("max_lng", sa.Float(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("road_link")
