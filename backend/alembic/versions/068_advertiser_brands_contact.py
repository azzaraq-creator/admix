"""광고주 브랜드 여러 개 · 담당자 정보 — advertiser_brands 표, users 담당자 칸

- advertiser_brands: 광고주 한 명이 브랜드를 여러 개 둔다(이름 · 사진). 콜라보 화면 "내 브랜드"에서 등록하고,
  콜라보 의뢰서에서 그중 하나를 고른다. 예전 회원 한 명당 브랜드 사진(users.brand_image_url, 066)은
  여기로 옮긴다 — 사진이 있던 광고주에게 회사명(없으면 이름)으로 브랜드 하나를 만들어 준다. 옛 칸은 지우지 않고 남긴다.
- users 담당자 정보(광고주, 모두 선택): contact_name 이름 · department 소속팀 · business_card_url/name 명함 파일.
  직함은 이미 있는 users.position(어드민 회원 상세의 "직책")을 같이 쓴다.

Revision ID: 068_advertiser_brands_contact
Revises: 067_cafe_store_grade_fee
"""
import uuid
from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "068_advertiser_brands_contact"
down_revision = "067_cafe_store_grade_fee"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "advertiser_brands",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("image_url", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_advertiser_brands_user_id", "advertiser_brands", ["user_id"])

    op.add_column("users", sa.Column("contact_name", sa.String(100), nullable=True))
    op.add_column("users", sa.Column("department", sa.String(100), nullable=True))
    op.add_column("users", sa.Column("business_card_url", sa.String(500), nullable=True))
    op.add_column("users", sa.Column("business_card_name", sa.String(255), nullable=True))

    # 브랜드 사진이 있던 광고주 → 브랜드 하나(회사명 · 없으면 이름 · 그래도 없으면 "우리 브랜드").
    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            "select id, company_name, name, brand_image_url from users "
            "where member_category = 'advertiser' and brand_image_url is not null "
            "and brand_image_url <> ''"
        )
    ).fetchall()
    brands = sa.table(
        "advertiser_brands",
        sa.column("id", UUID(as_uuid=True)),
        sa.column("user_id", UUID(as_uuid=True)),
        sa.column("name", sa.String),
        sa.column("image_url", sa.String),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    now = datetime.now(timezone.utc)
    if rows:
        op.bulk_insert(
            brands,
            [
                {
                    "id": uuid.uuid4(),
                    "user_id": r.id,
                    "name": ((r.company_name or "").strip() or (r.name or "").strip() or "우리 브랜드")[:100],
                    "image_url": r.brand_image_url,
                    "created_at": now,
                    "updated_at": now,
                }
                for r in rows
            ],
        )


def downgrade() -> None:
    op.drop_column("users", "business_card_name")
    op.drop_column("users", "business_card_url")
    op.drop_column("users", "department")
    op.drop_column("users", "contact_name")
    op.drop_index("ix_advertiser_brands_user_id", table_name="advertiser_brands")
    op.drop_table("advertiser_brands")
