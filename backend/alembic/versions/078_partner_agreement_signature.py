"""제휴사(콜라보) 기본협약 전자 서명 — 휴대폰 명의 본인확인(예시) 대신 손으로 그린 서명을 받는다(2026-11-10 사용자).

- users.partner_signer_name: 서명자 이름(협약서 "대표자 또는 수임자" 칸).
- users.partner_signer_role: 서명자 구분 — representative 대표자 · delegate 위임받은 담당자.
- users.partner_signature_url: 서명 그림(PNG, /uploads/partner-signature/{회원 id}/…).
- users.partner_signed_ip: 동의할 때의 IP — 승인 기록(협약 제13조 "서명자 · 시각 · 승인 기록 보존").
서명 시각은 동의 시각(partner_agreed_at)과 같다. 이 칸이 생기기 전에 동의한 회원은 비어 있다.

Revision ID: 078_partner_agreement_signature
Revises: 077_cafe_store_grade_scores
"""
import sqlalchemy as sa
from alembic import op

revision = "078_partner_agreement_signature"
down_revision = "077_cafe_store_grade_scores"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("partner_signer_name", sa.String(100), nullable=True))
    op.add_column("users", sa.Column("partner_signer_role", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("partner_signature_url", sa.String(500), nullable=True))
    op.add_column("users", sa.Column("partner_signed_ip", sa.String(64), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "partner_signed_ip")
    op.drop_column("users", "partner_signature_url")
    op.drop_column("users", "partner_signer_role")
    op.drop_column("users", "partner_signer_name")
