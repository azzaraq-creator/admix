"""LangGraph checkpoint persistence — Postgres backed."""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from src.config import get_settings


@asynccontextmanager
async def open_checkpointer() -> AsyncIterator[AsyncPostgresSaver]:
    """Open a Postgres-backed LangGraph checkpointer for the app lifespan.

    - `autocommit=True` + `prepare_threshold=0` 는 LangGraph Postgres saver 권장.
    - pool lifecycle 은 lifespan context 종료 시 close.
    """
    pool = AsyncConnectionPool(
        conninfo=get_settings().database_url,
        max_size=10,
        kwargs={
            "autocommit": True,
            "row_factory": dict_row,
            "prepare_threshold": 0,
        },
        open=False,
    )
    await pool.open()
    try:
        checkpointer = AsyncPostgresSaver(pool)
        await checkpointer.setup()
        yield checkpointer
    finally:
        await pool.close()
