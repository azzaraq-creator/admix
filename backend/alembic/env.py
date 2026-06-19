from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import get_settings
from src.database import Base
from src.models.ad_session import AdSession, AdMessage
from src.models.admin import Admin
from src.models.admin_permission import AdminPermission
from src.models.faq import Faq
from src.models.media import MediaKeyword, MediaItem
from src.models.media_master import Media
from src.models.media_image import MediaImage
from src.models.media_plan import MediaPlan
from src.models.inquiry import Inquiry
from src.models.member_profile import BusinessRegistration, MemberSanction
from src.models.proposal import Proposal
from src.models.user import User, RefreshToken, SocialAccount, PasswordReset

config = context.config
config.set_main_option("sqlalchemy.url", get_settings().database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
