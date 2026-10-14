"""서울 지하철역·버스정류장 위치(transit_station) + 일별 승하차 인원(transit_ridership)

- transit_station: 지하철역(subwayStationMaster, 역 이름 하나로 노선을 묶는다)·버스정류장(tbisMasterStation)의 좌표.
  station_id 는 "subway:서울역", "bus:100000003"(정류장 ID).
- transit_ridership: 역·정류장의 하루 승차·하차 합계 — 지하철 CardSubwayStatsNew, 버스 CardBusStatisticsServiceNew
  (노선별 값을 정류장으로 더한다). transit_sync 가 6시간마다 새 날을 확인해 채우고 한 달 넘은 날은 지운다. 매체 찾기 지도에서 실시간 인구 장소를 누르면 그 범위 안 값을 보여 준다.

운영 DB에 alembic 밖에서 만든 같은 이름의 표가 있을 수 있어(sangwon_area 때 실패) 없을 때만 만든다.

Revision ID: 053_transit_ridership
Revises: 052_sangwon_area_media_link
"""
import sqlalchemy as sa
from alembic import op

revision = "053_transit_ridership"
down_revision = "052_sangwon_area_media_link"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("transit_station"):
        op.create_table(
            "transit_station",
            sa.Column("station_id", sa.String(40), primary_key=True),
            sa.Column("kind", sa.String(10), nullable=False),  # subway | bus
            sa.Column("name", sa.Text(), nullable=False),
            sa.Column("lines", sa.Text(), nullable=True),  # 지하철 노선 "1호선,4호선" / 버스 정류장 번호(ARS)
            sa.Column("latitude", sa.Float(), nullable=False),
            sa.Column("longitude", sa.Float(), nullable=False),
        )
        op.create_index("ix_transit_station_lat_lng", "transit_station", ["latitude", "longitude"])
    if not inspector.has_table("transit_ridership"):
        op.create_table(
            "transit_ridership",
            sa.Column("station_id", sa.String(40), primary_key=True),
            sa.Column("use_date", sa.String(8), primary_key=True),  # "20261011"
            sa.Column("kind", sa.String(10), nullable=False),
            sa.Column("ride_count", sa.BigInteger(), nullable=False),
            sa.Column("alight_count", sa.BigInteger(), nullable=False),
            sa.Column("lines", sa.Text(), nullable=True),  # 지하철 — 이 합계에 들어간 노선(서울시 통계에 없는 노선은 빠진다)
        )


def downgrade() -> None:
    op.drop_table("transit_ridership")
    op.drop_index("ix_transit_station_lat_lng", table_name="transit_station")
    op.drop_table("transit_station")
