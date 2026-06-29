# Checkpoint Pruning + State Message Trimming Implementation Plan

> **For Hermes:** Use local interactive Claude Code tmux handoff to implement this plan. Hermes must independently review the diff and run verification before reporting success.
>
> **For Claude Code:** Implement only this plan. Keep changes surgical. Do not touch unrelated dirty working-tree files: `deploy/ec2-setup.sh`, `frontend/tsconfig.tsbuildinfo`, `amplify.yml`, `deploy/redeploy.sh`.

**Goal:** Prevent PostgresSaver checkpoint tables and LangGraph `state.messages` from growing without bound while preserving normal multi-turn recommendation behavior.

**Architecture:**
- Add explicit checkpoint garbage-collection helpers that delete checkpoint rows for selected `thread_id`s from LangGraph checkpoint tables.
- Call per-thread checkpoint cleanup when an `AdSession` is deleted.
- Add an operational dry-run-first pruning CLI for stale sessions based on `ad_sessions.updated_at`.
- Add a terminal graph node that trims old message objects using LangGraph `RemoveMessage`, while preserving compact structured state (`slots`, `summary`, `top_picks`, etc.).

**Tech Stack:** FastAPI, SQLAlchemy 2.x sync ORM, PostgreSQL, LangGraph 0.2.x, `langchain_core.messages.RemoveMessage`, pytest.

---

## Scope

### Implement now

1. Delete checkpoint rows when a chat session is deleted.
2. Add focused tests for SQL deletion order/targets.
3. Keep `ad_sessions` and `ad_messages` as user-visible history; session deletion already removes those through existing behavior, and this task only adds matching checkpoint cleanup.

### Record for later planning — do not implement now

These need product/ops agreement on retention limits before coding:

1. Add a dry-run-capable pruning command for checkpoint rows tied to stale `AdSession.updated_at`.
2. Limit persisted LangGraph `messages` length per thread.

### Out of scope for the current implementation

- Do not implement the pruning CLI in this task.
- Do not implement `state.messages` trimming in this task.
- Do not add `CHECKPOINT_TTL_DAYS` or `GRAPH_MAX_MESSAGES` settings yet.
- Do not change recommendation ranking, routing, prompt wording, or media matching behavior.
- Do not add Alembic in this PR.
- Do not add an admin API unless explicitly requested later.
- Do not change deployment scripts in this task.

---

## Current facts verified on 2026-05-26

- PostgresSaver commit: `d2163b8 feat: persist LangGraph state in Postgres`.
- Checkpoint tables created by `langgraph-checkpoint-postgres`:
  - `checkpoints`
  - `checkpoint_writes`
  - `checkpoint_blobs`
  - `checkpoint_migrations`
- `checkpoint_migrations` is global migration bookkeeping and must not be pruned by thread.
- Thread-indexed tables all have `thread_id` indexes:
  - `checkpoints.thread_id`
  - `checkpoint_writes.thread_id`
  - `checkpoint_blobs.thread_id`
- Current `RecommendState.messages` uses:
  ```py
  messages: Annotated[list[BaseMessage], add_messages]
  ```
- LangGraph 0.2.x in the Docker backend supports:
  ```py
  from langchain_core.messages import RemoveMessage
  ```
- `add_messages` deletes a message when a returned `RemoveMessage(id=<existing_id>, content="")` matches an existing message id.
- `extract_slots` already sends only `messages[-8:]` plus `known_slots` to the slot LLM, so keeping a bounded message tail is consistent with current prompt usage.

---

## Design decisions

### Checkpoint TTL policy

Use `ad_sessions.updated_at` as the source of truth for staleness.

Default proposal:

```text
CHECKPOINT_TTL_DAYS=30
```

Meaning:

- If a session has not been updated for 30 days, its LangGraph checkpoint rows may be deleted.
- The visible chat history remains in `ad_messages`.
- If the user opens a very old session after checkpoint pruning, the UI can still show history, but the graph state may restart unless a future restore-from-message-payload feature is added.

This is acceptable because checkpoint rows are execution state, not canonical business history.

### Message trimming policy

Default proposal:

```text
GRAPH_MAX_MESSAGES=8
```

Meaning:

- Keep only the latest 8 `HumanMessage`/`AIMessage` objects in LangGraph state.
- Preserve compact state fields such as `slots`, `summary`, `matched_media`, `top_picks`, and `pivots`.
- `extract_slots` already uses last 8 messages, so this does not reduce the context it currently consumes.

### Why two mechanisms are needed

- Checkpoint pruning controls database table growth across old sessions.
- Message trimming controls per-thread checkpoint blob size while a session remains active.

---

## Implementation tasks

### Task 1: Add settings for retention limits

**Objective:** Make retention limits explicit and configurable.

**Files:**
- Modify: `backend/src/config.py`

**Implementation:**

Add two settings to the existing `Settings` class:

```py
checkpoint_ttl_days: int = 30
graph_max_messages: int = 8
```

If this project uses uppercase env names through pydantic-settings default behavior, these map to:

```text
CHECKPOINT_TTL_DAYS
GRAPH_MAX_MESSAGES
```

**Verification:**

Run inside backend container or host backend environment:

```bash
cd backend
python - <<'PY'
from src.config import get_settings
s = get_settings()
assert s.checkpoint_ttl_days == 30
assert s.graph_max_messages == 8
print('settings_ok')
PY
```

Expected:

```text
settings_ok
```

---

### Task 2: Add checkpoint cleanup service

**Objective:** Provide one small, testable place for checkpoint deletion SQL.

**Files:**
- Create: `backend/src/services/graph/checkpoint_cleanup.py`

**Implementation:**

Create helpers like:

```py
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Iterable

from sqlalchemy import bindparam, select, text
from sqlalchemy.orm import Session

from src.models.ad_session import AdSession

_CHECKPOINT_TABLES_BY_THREAD = (
    'checkpoint_writes',
    'checkpoint_blobs',
    'checkpoints',
)


def delete_checkpoints_for_thread(db: Session, thread_id: str) -> dict[str, int]:
    """Delete LangGraph checkpoint rows for one thread_id.

    Does not commit. Caller owns transaction.
    Does not touch checkpoint_migrations.
    """
    if not thread_id:
        return {table: 0 for table in _CHECKPOINT_TABLES_BY_THREAD}

    counts: dict[str, int] = {}
    for table in _CHECKPOINT_TABLES_BY_THREAD:
        result = db.execute(
            text(f'DELETE FROM {table} WHERE thread_id = :thread_id'),
            {'thread_id': thread_id},
        )
        counts[table] = int(result.rowcount or 0)
    return counts


def find_stale_checkpoint_thread_ids(db: Session, older_than_days: int) -> list[str]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)
    rows = db.execute(
        select(AdSession.thread_id).where(AdSession.updated_at < cutoff)
    ).all()
    return [row[0] for row in rows if row[0]]


def delete_checkpoints_for_threads(db: Session, thread_ids: Iterable[str]) -> dict[str, int]:
    ids = [tid for tid in dict.fromkeys(thread_ids) if tid]
    if not ids:
        return {table: 0 for table in _CHECKPOINT_TABLES_BY_THREAD}

    counts: dict[str, int] = {}
    for table in _CHECKPOINT_TABLES_BY_THREAD:
        stmt = (
            text(f'DELETE FROM {table} WHERE thread_id IN :thread_ids')
            .bindparams(bindparam('thread_ids', expanding=True))
        )
        result = db.execute(stmt, {'thread_ids': ids})
        counts[table] = int(result.rowcount or 0)
    return counts
```

**Notes:**

- Table names are constants, not user input, so this is safe despite f-string SQL.
- Delete `checkpoint_writes` and `checkpoint_blobs` before `checkpoints` for clarity, even though current schema has no foreign keys.
- Do not commit inside these functions.

**Verification:**

```bash
cd backend
python -m compileall -q src/services/graph/checkpoint_cleanup.py
```

Expected: exit 0.

---

### Task 3: Delete checkpoints when deleting a session

**Objective:** Prevent orphan checkpoints after explicit session deletion.

**Files:**
- Modify: `backend/src/services/ad_session_service.py`

**Implementation:**

Update `delete_session`:

```py
from src.services.graph.checkpoint_cleanup import delete_checkpoints_for_thread
```

Then:

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

- If checkpoint deletion fails, the session delete should fail too; avoid losing the UI session while leaving inconsistent checkpoint cleanup uncertainty.
- `AdSession.messages` still cascade-delete via ORM as before.

**Verification:**

Manual smoke test after implementation:

```bash
# create a session and send a message so checkpoint rows exist
# then delete session through API
curl -X DELETE http://localhost:8001/chat/graph/sessions/$SID -i

# checkpoint rows for that thread should be zero
 docker exec ooh-postgres psql -U postgres -d ooh_recommend -Atc \
"select 
  (select count(*) from checkpoints where thread_id='$THREAD'),
  (select count(*) from checkpoint_writes where thread_id='$THREAD'),
  (select count(*) from checkpoint_blobs where thread_id='$THREAD');"
```

Expected:

```text
0|0|0
```

---

### Task 4: Add dry-run pruning CLI

**Objective:** Give ops a safe command to prune stale checkpoint rows without exposing an HTTP admin endpoint.

**Files:**
- Create: `backend/src/scripts/__init__.py`
- Create: `backend/src/scripts/prune_checkpoints.py`

**Implementation:**

CLI behavior:

```bash
python -m src.scripts.prune_checkpoints --days 30 --dry-run
python -m src.scripts.prune_checkpoints --days 30 --execute
```

Suggested implementation shape:

```py
from __future__ import annotations

import argparse

from src.config import get_settings
from src.database import SessionLocal
from src.services.graph.checkpoint_cleanup import (
    delete_checkpoints_for_threads,
    find_stale_checkpoint_thread_ids,
)


def main() -> int:
    settings = get_settings()
    parser = argparse.ArgumentParser(description='Prune LangGraph checkpoint rows for stale sessions.')
    parser.add_argument('--days', type=int, default=settings.checkpoint_ttl_days)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--dry-run', action='store_true')
    mode.add_argument('--execute', action='store_true')
    args = parser.parse_args()

    if args.days <= 0:
        raise SystemExit('--days must be positive')

    with SessionLocal() as db:
        thread_ids = find_stale_checkpoint_thread_ids(db, older_than_days=args.days)
        print(f'stale_threads={len(thread_ids)} days={args.days}')
        if args.dry_run:
            return 0
        counts = delete_checkpoints_for_threads(db, thread_ids)
        db.commit()
        print('deleted=' + ','.join(f'{k}:{v}' for k, v in counts.items()))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
```

**Verification:**

```bash
cd backend
python -m src.scripts.prune_checkpoints --days 30 --dry-run
```

Expected:

```text
stale_threads=<N> days=30
```

For execute mode, first use a non-production/dev database and a known stale test session.

---

### Task 5: Add message trimming node

**Objective:** Bound `state.messages` in each thread checkpoint.

**Files:**
- Create: `backend/src/services/graph/nodes/trim_state.py`
- Modify: `backend/src/services/graph/nodes/__init__.py`
- Modify: `backend/src/services/graph/builder.py`

**Implementation:**

Create a pure helper plus LangGraph node:

```py
from __future__ import annotations

from langchain_core.messages import RemoveMessage

from src.config import get_settings
from src.services.graph.state import RecommendState


def trim_messages_update(state: RecommendState, max_messages: int) -> dict:
    messages = list(state.get('messages') or [])
    if max_messages <= 0 or len(messages) <= max_messages:
        return {}

    to_remove = [m for m in messages[:-max_messages] if getattr(m, 'id', None)]
    if not to_remove:
        return {}

    return {
        'messages': [RemoveMessage(id=m.id, content='') for m in to_remove],
    }


def trim_state_messages(state: RecommendState) -> dict:
    return trim_messages_update(state, max_messages=get_settings().graph_max_messages)
```

Then wire it as a terminal node in `builder.py`:

```py
builder.add_node('trim_state_messages', trim_state_messages)
```

Replace terminal edges:

```py
builder.add_edge('clarification_one_slot', 'trim_state_messages')
builder.add_edge('compatibility_llm_message', 'trim_state_messages')
builder.add_edge('present_initial_list', 'trim_state_messages')
builder.add_edge('explain_recommendations', 'trim_state_messages')
# explain=False path:
builder.add_edge(rerank_node_name, 'trim_state_messages')
builder.add_edge('trim_state_messages', END)
```

**Important:**

- Do not trim before response-producing nodes, or assistant messages may be unavailable to router streaming logic.
- The router's `_serialize_update` already ignores `messages`, so the trim node should not leak internal `RemoveMessage` objects to the client.
- Keep `slots` and recommendation payload fields untouched.

**Verification:**

Unit-level check inside Docker:

```bash
cd backend
python - <<'PY'
from langchain_core.messages import HumanMessage, AIMessage, RemoveMessage
from src.services.graph.nodes.trim_state import trim_messages_update
msgs = []
for i in range(10):
    m = HumanMessage(content=f'u{i}') if i % 2 == 0 else AIMessage(content=f'a{i}')
    m.id = str(i)
    msgs.append(m)
update = trim_messages_update({'messages': msgs}, max_messages=4)
assert len(update['messages']) == 6
assert all(isinstance(m, RemoveMessage) for m in update['messages'])
assert [m.id for m in update['messages']] == ['0', '1', '2', '3', '4', '5']
print('trim_update_ok')
PY
```

Expected:

```text
trim_update_ok
```

---

### Task 6: Add focused tests

**Objective:** Prevent regressions without broad test infrastructure changes.

**Files:**
- Create: `backend/tests/test_trim_state.py`
- Create: `backend/tests/test_checkpoint_cleanup.py`

**Test 1: message trimming**

```py
from langchain_core.messages import AIMessage, HumanMessage, RemoveMessage

from src.services.graph.nodes.trim_state import trim_messages_update


def _msg(i: int):
    m = HumanMessage(content=f'u{i}') if i % 2 == 0 else AIMessage(content=f'a{i}')
    m.id = str(i)
    return m


def test_trim_messages_update_removes_oldest_messages():
    update = trim_messages_update({'messages': [_msg(i) for i in range(10)]}, max_messages=4)

    removals = update['messages']
    assert len(removals) == 6
    assert all(isinstance(m, RemoveMessage) for m in removals)
    assert [m.id for m in removals] == ['0', '1', '2', '3', '4', '5']


def test_trim_messages_update_noops_under_limit():
    assert trim_messages_update({'messages': [_msg(i) for i in range(4)]}, max_messages=4) == {}
```

**Test 2: checkpoint cleanup SQL**

Use a fake session object if direct SQLAlchemy Session mocking is enough. The goal is to verify table targets and no commit inside helper. Prefer a small fake over adding DB fixture complexity.

Example direction:

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
    counts = delete_checkpoints_for_thread(db, 'thread-123')

    assert counts == {
        'checkpoint_writes': 3,
        'checkpoint_blobs': 3,
        'checkpoints': 3,
    }
    joined = '\n'.join(db.sql)
    assert 'checkpoint_writes' in joined
    assert 'checkpoint_blobs' in joined
    assert 'checkpoints' in joined
    assert 'checkpoint_migrations' not in joined
    assert all(p == {'thread_id': 'thread-123'} for p in db.params)
    assert db.committed is False
```

**Verification:**

```bash
cd backend
pytest tests/test_trim_state.py tests/test_checkpoint_cleanup.py -q
```

Expected:

```text
4 passed
```

---

### Task 7: End-to-end smoke verification

**Objective:** Prove both cleanup and normal chat behavior still work.

**Commands:**

```bash
cd /Users/lala/Documents/GitHub/ooh-recommend

docker compose build backend
docker compose up -d backend
curl -fsS http://localhost:8001/health
```

Create a session and produce checkpoints:

```bash
SESSION_JSON=$(curl -s -X POST http://localhost:8001/chat/graph/sessions \
  -H 'Content-Type: application/json' \
  -d '{"title":"trim-prune-test"}')

SID=$(echo "$SESSION_JSON" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
THREAD=$(echo "$SESSION_JSON" | python3 -c "import sys,json;print(json.load(sys.stdin)['thread_id'])")

curl -N -X POST "http://localhost:8001/chat/graph/sessions/$SID/stream" \
  -H 'Content-Type: application/json' \
  -d '{"message":"강남에서 카페 광고 하고 싶어"}'

curl -N -X POST "http://localhost:8001/chat/graph/sessions/$SID/stream" \
  -H 'Content-Type: application/json' \
  -d '{"message":"예산은 500만원이야"}'
```

Confirm checkpoint rows exist:

```bash
docker exec ooh-postgres psql -U postgres -d ooh_recommend -Atc \
"select count(*) from checkpoints where thread_id='$THREAD';"
```

Delete session and verify checkpoint rows are gone:

```bash
curl -i -X DELETE "http://localhost:8001/chat/graph/sessions/$SID"

docker exec ooh-postgres psql -U postgres -d ooh_recommend -Atc \
"select
  (select count(*) from checkpoints where thread_id='$THREAD'),
  (select count(*) from checkpoint_writes where thread_id='$THREAD'),
  (select count(*) from checkpoint_blobs where thread_id='$THREAD');"
```

Expected:

```text
0|0|0
```

Run pruning dry run:

```bash
docker compose run --rm backend python -m src.scripts.prune_checkpoints --days 30 --dry-run
```

Expected:

```text
stale_threads=<N> days=30
```

---

## Risks and mitigations

### Risk 1: Pruning old checkpoints makes old sessions lose graph state

Mitigation:

- This is expected after TTL.
- UI history remains intact.
- Future improvement: rebuild compact graph state from the latest assistant `payload.slots` when checkpoint is missing.

### Risk 2: Direct SQL depends on LangGraph table names

Mitigation:

- Table names are created by `langgraph-checkpoint-postgres` and verified in current environment.
- Keep cleanup code isolated in one service file.
- Do not touch `checkpoint_migrations`.

### Risk 3: Message trimming could remove context needed by future turns

Mitigation:

- `extract_slots` already uses only last 8 messages plus structured `known_slots`.
- Keep default `GRAPH_MAX_MESSAGES=8` aligned with current behavior.
- Preserve all structured state fields.

### Risk 4: RemoveMessage API changes

Mitigation:

- Docker import check confirmed current package supports `RemoveMessage`.
- Add unit test for trim update shape.

---

## Suggested commit sequence

1. `feat: prune checkpoints for deleted sessions`
   - checkpoint cleanup service
   - session delete integration
   - tests

2. `feat: add checkpoint pruning command`
   - pruning CLI
   - dry-run/execute behavior
   - tests or smoke verification

3. `feat: trim LangGraph message state`
   - trim node
   - graph wiring
   - tests

If implementing as one small PR/commit is preferred, use:

```bash
git commit -m "feat: bound LangGraph checkpoint growth"
```
