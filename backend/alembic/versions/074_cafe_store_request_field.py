"""매장 수정 요청을 항목별로 — 제휴사가 내 매장 정보에서 바꿀 줄을 골라 새 값을 보내고, 어드민이 반영하거나 처리 불가(사유)로 답한다.

- cafe_store_request.field: 바꿀 항목(name · address · hours · phone · owner_name · tags · notes). 예전 자유 입력 요청은 비어 있다.
- before_text / after_text: 화면에 보이는 "무엇에서 → 무엇으로" 글(서버가 만든다). before_text 는 반영할 때 그때 값으로 다시 맞춘다.
- after_value: 반영할 값 그대로(주소는 {address, address_detail, city, district, latitude, longitude}, 운영 시간은 hours 입력값).
- content 는 담당자에게 남기는 메모(선택)가 되어 비울 수 있다.
- updated_at: 마지막으로 바뀐 때(보냄 · 다시 보냄 · 처리) — 내 매장 "수정 기록"에 보인다.
- status 에 rejected(처리 불가)가 더해진다 — 사유는 admin_reply.

Revision ID: 074_cafe_store_request_field
Revises: 073_cafe_store_photo_hours
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "074_cafe_store_request_field"
down_revision = "073_cafe_store_photo_hours"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("cafe_store_request", sa.Column("field", sa.String(20), nullable=True))
    op.add_column("cafe_store_request", sa.Column("before_text", sa.Text(), nullable=True))
    op.add_column("cafe_store_request", sa.Column("after_text", sa.Text(), nullable=True))
    op.add_column("cafe_store_request", sa.Column("after_value", postgresql.JSONB(), nullable=True))
    op.add_column(
        "cafe_store_request",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.execute("UPDATE cafe_store_request SET updated_at = COALESCE(handled_at, created_at)")
    op.alter_column("cafe_store_request", "content", existing_type=sa.Text(), nullable=True)


def downgrade() -> None:
    op.execute("UPDATE cafe_store_request SET content = COALESCE(content, after_text, '') WHERE content IS NULL")
    op.alter_column("cafe_store_request", "content", existing_type=sa.Text(), nullable=False)
    op.execute("UPDATE cafe_store_request SET status = 'done' WHERE status = 'rejected'")
    op.drop_column("cafe_store_request", "updated_at")
    op.drop_column("cafe_store_request", "after_value")
    op.drop_column("cafe_store_request", "after_text")
    op.drop_column("cafe_store_request", "before_text")
    op.drop_column("cafe_store_request", "field")
