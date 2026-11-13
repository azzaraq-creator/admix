"""영업 기록도 광고주 지도에 — 협업 확정 전 매장(영업 기록)도 매체 찾기 콜라보 탭 · 매장 찾기(/partners/find)에 뜬다(2026-11-13 사용자).

latitude · longitude · city · district — 영업 기록 주소(없으면 지번주소)를 화면이 카카오 지도로 찾아 보낸 위치.
store_type_id — 업체 유형(biz_type)을 매장 유형(카페 · 식당 …)에 맞춘 값(매장 찾기 유형 탭).
media_id — 지도용 media 줄(CF-0001). 협업 확정 매장이 지도에 뜨면(공개 + 위치) 그 매장이 이 줄을 이어받고 여기는 비운다.

Revision ID: 090_collab_lead_map
Revises: 089_partner_signup_store_info
"""
import sqlalchemy as sa
from alembic import op

revision = "090_collab_lead_map"
down_revision = "089_partner_signup_store_info"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("collab_lead", sa.Column("latitude", sa.Numeric(10, 7), nullable=True))
    op.add_column("collab_lead", sa.Column("longitude", sa.Numeric(10, 7), nullable=True))
    op.add_column("collab_lead", sa.Column("city", sa.String(100), nullable=True))
    op.add_column("collab_lead", sa.Column("district", sa.String(100), nullable=True))
    op.add_column(
        "collab_lead",
        sa.Column(
            "store_type_id",
            sa.Integer(),
            sa.ForeignKey("cafe_store_type.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "collab_lead",
        sa.Column(
            "media_id",
            sa.String(20),
            sa.ForeignKey("media.media_id", ondelete="SET NULL"),
            nullable=True,
            unique=True,
        ),
    )


def downgrade() -> None:
    # 영업 기록 지도 줄(media)은 남기지 않는다 — 칸을 지우기 전에 그 줄부터.
    op.execute(
        "DELETE FROM media WHERE media_id IN (SELECT media_id FROM collab_lead WHERE media_id IS NOT NULL)"
    )
    op.drop_column("collab_lead", "media_id")
    op.drop_column("collab_lead", "store_type_id")
    op.drop_column("collab_lead", "district")
    op.drop_column("collab_lead", "city")
    op.drop_column("collab_lead", "longitude")
    op.drop_column("collab_lead", "latitude")
