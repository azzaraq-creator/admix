# Session Delete Checkpoint Cleanup Implementation Plan

> **For Hermes:** Hand this focused plan to local interactive Claude Code. Hermes must independently review the diff and run verification.
>
> **For Claude Code:** Implement only this plan. Do not implement checkpoint TTL pruning CLI. Do not implement `state.messages` trimming. Do not touch unrelated dirty working-tree files: `deploy/ec2-setup.sh`, `frontend/tsconfig.tsbuildinfo`, `amplify.yml`, `deploy/redeploy.sh`.

**Goal:** When a user deletes an `AdSession`, delete the matching LangGraph PostgresSaver checkpoint rows for that session's `thread_id` so explicit session deletion does not leave orphan checkpoint state.

**Architecture:** Add one small checkpoint cleanup service with per-thread deletion SQL, call it from the existing `delete_session()` transaction before deleting the session, and add focused tests for deletion targets/order and no internal commit.

**Tech Stack:** FastAPI, SQLAlchemy sync ORM, PostgreSQL, LangGraph PostgresSaver checkpoint tables, pytest.

---

## Scope

### Implement now

1. Create `backend/src/services/graph/checkpoint_cleanup.py`.
2. Add `delete_checkpoints_for_thread(db, thread_id)` only.
3. Call it from `backend/src/services/ad_session_service.py::delete_session`.
4. Add focused pytest coverage.
5. Run compile/tests and a small DB/API smoke check if local Docker is available.

### Record only — do not implement now

These require product/ops planning before coding:

1. Checkpoint TTL / pruning CLI for stale sessions.
2. `state.messages` trimming / max retained messages.
3. New retention settings such as `CHECKPOINT_TTL_DAYS` or `GRAPH_MAX_MESSAGES`.

---

## Current facts

LangGraph PostgresSaver currently creates these tables:

```text
checkpoints
checkpoint_writes
checkpoint_blobs
checkpoint_migrations
```

Only the thread-scoped checkpoint tables should be cleaned per session:

```text
checkpoint_writes
checkpoint_blobs
checkpoints
```

Do **not** delete from `checkpoint_migrations`; it is global migration bookkeeping.

---

## Task 1: Add per-thread checkpoint cleanup helper

**Objective:** Provide one isolated helper for deleting checkpoint rows by `thread_id`.

**Files:**

- Create: `backend/src/services/graph/checkpoint_cleanup.py`

**Implementation:**

```py
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
```

**Notes:**

- Table names are hard-coded constants, not user input.
- Delete writes/blobs before checkpoints for clarity.
- Do not call `commit()` here.

---

## Task 2: Call cleanup when deleting an AdSession

**Objective:** Keep explicit session deletion atomic with checkpoint cleanup.

**Files:**

- Modify: `backend/src/services/ad_session_service.py`

**Implementation:**

Add import:

```py
from src.services.graph.checkpoint_cleanup import delete_checkpoints_for_thread
```

Update `delete_session`:

```py
def delete_session(db: Session, session_id: str) -> bool:
    s = get_session(db, session_id)
    if not s:
        return False
    delete_checkpoints_for_thread(db, s.thread_id)
    db.delete(s)
    db.commit()
    return True
```

**Why this order:**

- If checkpoint cleanup fails, the session delete should fail too.
- Existing ORM cascade still deletes `ad_messages`.

---

## Task 3: Add focused tests

**Objective:** Confirm the cleanup helper targets only the intended tables and does not commit.

**Files:**

- Create: `backend/tests/test_checkpoint_cleanup.py`

**Suggested tests:**

```py
from src.services.graph.checkpoint_cleanup import delete_checkpoints_for_thread


class FakeResult:
    rowcount = 3


class FakeSession:
    def __init__(self):
        self.sql = []
        self.params = []
        self.committed = False

    def execute(self, stmt, params=None):
        self.sql.append(str(stmt))
        self.params.append(params)
        return FakeResult()

    def commit(self):
        self.committed = True


def test_delete_checkpoints_for_thread_targets_only_thread_tables():
    db = FakeSession()
    counts = delete_checkpoints_for_thread(db, "thread-123")

    assert counts == {
        "checkpoint_writes": 3,
        "checkpoint_blobs": 3,
        "checkpoints": 3,
    }
    joined = "\n".join(db.sql)
    assert "checkpoint_writes" in joined
    assert "checkpoint_blobs" in joined
    assert "checkpoints" in joined
    assert "checkpoint_migrations" not in joined
    assert all(p == {"thread_id": "thread-123"} for p in db.params)
    assert db.committed is False


def test_delete_checkpoints_for_thread_noops_empty_thread_id():
    db = FakeSession()
    counts = delete_checkpoints_for_thread(db, "")

    assert counts == {
        "checkpoint_writes": 0,
        "checkpoint_blobs": 0,
        "checkpoints": 0,
    }
    assert db.sql == []
    assert db.committed is False
```

---

## Verification

Run:

```bash
cd backend
python -m compileall -q src tests
pytest tests/test_checkpoint_cleanup.py -q
```

Expected:

```text
2 passed
```

Optional Docker/API smoke:

```bash
cd /Users/lala/Documents/GitHub/ooh-recommend
docker compose up -d backend
curl -fsS http://localhost:8001/health
```

Then create a session, send one stream message to create checkpoint rows, delete the session, and verify all three thread-scoped checkpoint tables return zero rows for that thread.

---

## Expected changed files

```text
backend/src/services/graph/checkpoint_cleanup.py
backend/src/services/ad_session_service.py
backend/tests/test_checkpoint_cleanup.py
docs/plans/2026-05-26-session-delete-checkpoint-cleanup.md
```

Do not modify:

```text
backend/src/config.py
backend/src/scripts/*
backend/src/services/graph/state.py
backend/src/services/graph/builder.py
backend/src/services/graph/nodes/*
deploy/*
frontend/*
amplify.yml
```
