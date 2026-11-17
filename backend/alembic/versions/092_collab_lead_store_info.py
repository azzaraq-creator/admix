"""영업 기록에 협업 확정 매장 정보 — 업체 정보 탭에서 미리 적는다(2026-11-17 사용자).

매장 유형 · 전화번호 · 사장 이름 · 주요 고객층 · 소개 · 규모(좌석 수) · 운영 시간(+휴무일) · 가능 범위를 한 칸(JSONB)에 둔다
(매장 어필은 빼기로 함, 11-17 사용자):
{"storeTypeId": 1, "phone": "02-123-4567", "ownerName": "…", "mainCustomers": "…", "intro": "…", "seats": 24,
 "hours": {"slots": […], "closed": […]},
 "scope": {"print": "ok", …}} — 비운 값은 넣지 않는다(가능 범위는 093 cafe_store.scope 와 같은 모양). 협업 확정하면 이 값으로 매장을 만든다(그 뒤로는 매장에서 고친다).
원본 영업 앱에 없는 칸이라 원본을 다시 가져와도 그대로 남는다.

Revision ID: 092_collab_lead_store_info
Revises: 091_user_last_login
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "092_collab_lead_store_info"
down_revision = "091_user_last_login"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "collab_lead",
        sa.Column("store_info", postgresql.JSONB(), nullable=False, server_default="{}"),
    )


def downgrade() -> None:
    op.drop_column("collab_lead", "store_info")
