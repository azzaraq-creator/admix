"""Cleanup helpers for LangGraph PostgresSaver checkpoint tables."""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

_CHECKPOINT_TABLES_BY_THREAD = (
    "checkpoint_writes",
    "checkpoint_blobs",
    "checkpoints",
)


def delete_checkpoints_for_thread(db: Session, thread_id: str) -> dict[str, int]:
    """Delete LangGraph checkpoint rows for one thread_id.

    Does not commit. Caller owns the transaction.
    Does not touch checkpoint_migrations.
    """
    if not thread_id:
        return {table: 0 for table in _CHECKPOINT_TABLES_BY_THREAD}

    counts: dict[str, int] = {}
    for table in _CHECKPOINT_TABLES_BY_THREAD:
        result = db.execute(
            text(f"DELETE FROM {table} WHERE thread_id = :thread_id"),
            {"thread_id": thread_id},
        )
        counts[table] = int(result.rowcount or 0)
    return counts
