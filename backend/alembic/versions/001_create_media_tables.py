"""create media tables

Revision ID: 001_create_media_tables
Revises:
Create Date: 2026-05-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_create_media_tables'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- media_keywords ---
    op.create_table(
        'media_keywords',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('category', sa.Enum('IND', 'PRD', 'OBJ', 'TGT', 'LOC', name='media_keyword_category'), nullable=False),
        sa.Column('code', sa.String(length=20), nullable=False),
        sa.Column('keywords', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_media_keywords_category', 'media_keywords', ['category'], unique=False)
    op.create_index('ix_media_keywords_code', 'media_keywords', ['code'], unique=False)
    op.create_index('ix_media_keywords_category_code', 'media_keywords', ['category', 'code'], unique=True)

    # --- media_items ---
    op.create_table(
        'media_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('media_source', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('advertisement_fee', sa.String(length=50), nullable=True),
        sa.Column('thumbnail_url', sa.String(length=500), nullable=True),
        sa.Column('all_image_urls', sa.Text(), nullable=True),
        sa.Column('ind_codes', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('prd_codes', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('obj_codes', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('tgt_codes', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('loc_codes', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('raw_ind', sa.Text(), nullable=True),
        sa.Column('raw_prd', sa.Text(), nullable=True),
        sa.Column('raw_obj', sa.Text(), nullable=True),
        sa.Column('raw_tgt', sa.Text(), nullable=True),
        sa.Column('raw_loc', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_media_items_media_source', 'media_items', ['media_source'], unique=False)
    op.create_index('ix_media_items_ind_codes', 'media_items', ['ind_codes'], unique=False, postgresql_using='gin')
    op.create_index('ix_media_items_prd_codes', 'media_items', ['prd_codes'], unique=False, postgresql_using='gin')
    op.create_index('ix_media_items_obj_codes', 'media_items', ['obj_codes'], unique=False, postgresql_using='gin')
    op.create_index('ix_media_items_tgt_codes', 'media_items', ['tgt_codes'], unique=False, postgresql_using='gin')
    op.create_index('ix_media_items_loc_codes', 'media_items', ['loc_codes'], unique=False, postgresql_using='gin')


def downgrade() -> None:
    op.drop_table('media_items')
    op.drop_table('media_keywords')
