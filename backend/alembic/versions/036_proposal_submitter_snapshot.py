"""proposal 제출자 스냅샷 5필드 + member_id FK CASCADE→SET NULL + 백필

Revision ID: 036_proposal_submitter_snapshot
Revises: 035_media_items_media_id_fk
"""
from alembic import op
import sqlalchemy as sa

revision = "036_proposal_submitter_snapshot"
down_revision = "035_media_items_media_id_fk"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("proposal", sa.Column("submitter_membership_type", sa.String(length=20), nullable=True))
    op.add_column("proposal", sa.Column("submitter_company_name", sa.String(length=200), nullable=True))
    op.add_column("proposal", sa.Column("submitter_name", sa.String(length=100), nullable=True))
    op.add_column("proposal", sa.Column("submitter_email", sa.String(length=255), nullable=True))
    op.add_column("proposal", sa.Column("submitter_phone", sa.String(length=30), nullable=True))

    op.drop_constraint("proposal_member_id_fkey", "proposal", type_="foreignkey")
    op.create_foreign_key(
        "fk_proposal_member_id", "proposal", "users",
        ["member_id"], ["id"], ondelete="SET NULL",
    )

    # 백필: 제출된(new 아님) 회원 제안서에 현재 member 정보를 스냅샷으로 채움
    op.execute(
        """
        UPDATE proposal p
        SET submitter_membership_type = u.membership_type,
            submitter_company_name = u.company_name,
            submitter_name = u.name,
            submitter_email = u.email,
            submitter_phone = u.phone
        FROM users u
        WHERE p.member_id = u.id
          AND p.status <> 'new'
        """
    )


def downgrade() -> None:
    op.drop_constraint("fk_proposal_member_id", "proposal", type_="foreignkey")
    op.create_foreign_key(
        "proposal_member_id_fkey", "proposal", "users",
        ["member_id"], ["id"], ondelete="CASCADE",
    )
    op.drop_column("proposal", "submitter_phone")
    op.drop_column("proposal", "submitter_email")
    op.drop_column("proposal", "submitter_name")
    op.drop_column("proposal", "submitter_company_name")
    op.drop_column("proposal", "submitter_membership_type")
