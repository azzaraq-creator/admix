# PostgresSaver 도입 구현 계획

> **For Claude Code:** 이 문서는 PostgresSaver 도입 범위만 다룬다. 실제 구현 시 route_after_db_filter/has_presented_initial, state trimming, UI, 추천 알고리즘, deploy script, SQLAlchemy async 전환은 건드리지 않는다.

**Goal:** FastAPI 백엔드가 재시작/재배포되어도 같은 `AdSession.thread_id`로 LangGraph 멀티턴 state가 복원되게 한다.

**Architecture:** `ad_sessions.thread_id`를 LangGraph `thread_id`로 계속 사용한다. UI 히스토리는 기존 `ad_messages`에 저장하고, LangGraph 내부 state는 같은 Postgres DB의 checkpoint tables에 저장한다. FastAPI lifespan에서 Postgres checkpointer/pool을 열고 graph를 compile한 뒤 `app.state.graph`로 라우터에 주입한다.

**Tech Stack:** FastAPI, LangGraph, `langgraph-checkpoint-postgres`, psycopg3 async pool, 기존 SQLAlchemy/psycopg2 ORM.

---

## 현재 확인 사항

- 현재 Hermes 실행 Python은 `/Users/lala/.hermes/hermes-agent/venv/bin/python`이고, 이 환경에는 `langgraph`가 설치되어 있지 않다.
- 이 repo의 backend dependency에는 이미 LangGraph가 명시되어 있다.
  - `backend/requirements.txt`
  - `langgraph>=0.2,<0.3`
  - `langchain-core>=0.3,<0.4`
  - `langchain-openai>=0.2,<0.3`
- 따라서 “LangGraph 미설치”는 **Hermes/Claude가 실행한 host Python 환경 기준**이고, backend Docker image나 backend 전용 install 환경에는 설치될 수 있다.
- 실제 API import 검증은 backend requirements 설치 후 또는 backend Docker container 안에서 해야 한다.

검증 명령 후보:

```bash
cd backend
python -c "from langgraph.checkpoint.memory import MemorySaver; print('memory ok')"
python -c "from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver; from psycopg_pool import AsyncConnectionPool; print('postgres ok')"
```

Docker 기준:

```bash
docker compose run --rm backend python -c "from langgraph.checkpoint.memory import MemorySaver; print('memory ok')"
docker compose run --rm backend python -c "from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver; from psycopg_pool import AsyncConnectionPool; print('postgres ok')"
```

---

## 범위

### 포함

1. `backend/requirements.txt` dependency 추가
2. Postgres checkpointer factory 추가
3. FastAPI lifespan에서 checkpointer/pool lifecycle 관리
4. router가 global `_graph_cache` 대신 `request.app.state.graph` 사용
5. `AsyncPostgresSaver.setup()` 기반 checkpoint table 생성
6. backend 재시작 후 same session/thread state 복원 검증

### 제외

- `route_after_db_filter` / `has_presented_initial` 라우팅 개선
- state trimming
- Alembic 전환 전체
- auth
- UI 변경
- 추천 알고리즘 변경
- SQLAlchemy 전체 async 전환
- deploy script 수정

---

## 설계 결정

### 1. `ad_sessions` / `ad_messages`와 checkpoint tables 역할 분리

- `ad_sessions`: 앱 레벨 세션 목록과 `thread_id` 보관
- `ad_messages`: UI에 보여줄 user/assistant 메시지와 payload 저장
- LangGraph checkpoint tables: graph 내부 state 복원용

이 역할 분리는 유지한다. checkpoint payload를 UI 히스토리 대체 용도로 쓰지 않는다.

### 2. 같은 Postgres DB 사용

기존 `DATABASE_URL`이 가리키는 같은 DB에 checkpoint tables를 만든다.

예상 tables:

- `checkpoints`
- `checkpoint_blobs`
- `checkpoint_writes`
- `checkpoint_migrations` 또는 버전에 따른 migration metadata table

정확한 table set은 설치된 `langgraph-checkpoint-postgres` 버전에 따른다.

### 3. psycopg2와 psycopg3 공존

현재 ORM/DB 코드는 `psycopg2-binary==2.9.9`를 쓴다. 이번 변경에서 ORM을 건드리지 않는다.

PostgresSaver 전용으로 psycopg3를 추가한다.

```txt
langgraph-checkpoint-postgres>=2,<3
psycopg[binary,pool]>=3.2
```

### 4. graph compile은 FastAPI lifespan에서 수행

현재 `backend/src/routers/chat_graph.py`는 module global `_graph_cache`로 lazy compile한다. PostgresSaver는 pool lifecycle이 있으므로 이 패턴을 제거한다.

변경 후:

```text
startup
  Base.metadata.create_all(bind=engine)
  open async psycopg pool
  create AsyncPostgresSaver
  await saver.setup()
  app.state.graph = build_graph(..., checkpointer=saver)

request
  graph = request.app.state.graph

shutdown
  close async pool
```

---

## 구현 작업

### Task 1. dependency 추가

**Objective:** PostgresSaver와 psycopg3 pool 사용에 필요한 package를 backend image에 설치한다.

**Files:**

- Modify: `backend/requirements.txt`

**Change:**

```txt
# LangGraph checkpoint persistence
langgraph-checkpoint-postgres>=2,<3
psycopg[binary,pool]>=3.2
```

기존 `psycopg2-binary==2.9.9`는 제거하지 않는다.

**Verify:**

```bash
cd backend
python -m pip install -r requirements.txt
python -c "from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver; from psycopg_pool import AsyncConnectionPool; print('ok')"
```

만약 host Python에 backend deps를 설치하지 않는 workflow라면 Docker로 확인한다.

```bash
docker compose build backend
docker compose run --rm backend python -c "from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver; from psycopg_pool import AsyncConnectionPool; print('ok')"
```

---

### Task 2. checkpointer factory 추가

**Objective:** PostgresSaver lifecycle을 한 파일에 캡슐화한다.

**Files:**

- Create: `backend/src/services/graph/checkpointer.py`

**Implementation:**

```python
"""LangGraph checkpoint persistence."""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from src.config import get_settings


@asynccontextmanager
async def open_checkpointer() -> AsyncIterator[AsyncPostgresSaver]:
    """Open a Postgres-backed LangGraph checkpointer for the app lifespan."""
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
```

**Notes:**

- `autocommit=True`와 `row_factory=dict_row`는 LangGraph Postgres saver에서 흔히 필요한 설정이다.
- `prepare_threshold=0`는 psycopg prepared statement 관련 운영 이슈를 줄이는 보수적 설정이다.
- 설치 버전에 따라 `setup()`이 sync일 수 있으면 import 검증 후 맞춰 수정한다.

**Verify:**

```bash
cd backend
python -c "from src.services.graph.checkpointer import open_checkpointer; print(open_checkpointer)"
```

---

### Task 3. FastAPI lifespan에서 graph compile

**Objective:** graph를 app lifecycle에 맞춰 compile하고 PostgresSaver를 주입한다.

**Files:**

- Modify: `backend/src/main.py`

**Change concept:**

```python
from src.services.graph.builder import build_graph
from src.services.graph.checkpointer import open_checkpointer
```

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    import src.models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    async with open_checkpointer() as checkpointer:
        app.state.graph = build_graph(
            rerank="sangwon",
            explain=True,
            checkpointer=checkpointer,
        )
        yield
```

**Do not change:**

- CORS setup
- router registration
- health endpoint
- SQLAlchemy engine/session setup

**Verify:**

```bash
cd backend
python -m compileall -q src
```

---

### Task 4. router에서 global graph cache 제거

**Objective:** request handler가 lifespan에서 생성한 graph를 사용하게 한다.

**Files:**

- Modify: `backend/src/routers/chat_graph.py`

**Changes:**

1. Import `Request`.

```python
from fastapi import APIRouter, Depends, HTTPException, Request, status
```

2. Remove this import if unused after deletion:

```python
from src.services.graph.builder import build_graph
```

3. Delete global lazy cache:

```python
_graph_cache = None

def _get_graph():
    ...
```

4. Pass graph into stream helpers.

```python
async def _event_stream(graph: Any, message: str, thread_id: str) -> AsyncIterator[str]:
    ...
```

Inside it, remove `graph = _get_graph()`.

5. Update `/stream` endpoint.

```python
@router.post("/stream")
async def stream_graph(payload: GraphMessageRequest, request: Request):
    thread_id = payload.thread_id or f"thread-{uuid.uuid4().hex[:12]}"
    return StreamingResponse(
        _event_stream(request.app.state.graph, payload.message, thread_id),
        ...
    )
```

6. Update session stream helper.

```python
async def _session_event_stream(
    graph: Any,
    session_id: str,
    thread_id: str,
    message: str,
) -> AsyncIterator[str]:
    ...
```

Inside it, remove `graph = _get_graph()`.

7. Update session stream endpoint.

```python
def session_stream(
    session_id: str,
    payload: StreamMessageRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    ...
    return StreamingResponse(
        _session_event_stream(request.app.state.graph, str(s.id), s.thread_id, payload.message),
        ...
    )
```

**Verify:**

```bash
cd backend
python -m compileall -q src
```

---

### Task 5. startup/checkpoint table 검증

**Objective:** backend startup 시 PostgresSaver setup이 성공하고 checkpoint tables가 생성되는지 확인한다.

**Commands:**

```bash
docker compose up -d --build backend
curl -s http://localhost:8001/health
```

Expected:

```json
{"status":"ok"}
```

Check tables:

```bash
docker exec -it ooh-postgres psql -U postgres -d ooh_recommend -c "\dt"
```

Expected: LangGraph checkpoint 관련 table들이 보인다. 정확한 이름은 package version에 따라 다를 수 있다.

---

### Task 6. 재시작 후 state 복원 검증

**Objective:** MemorySaver가 아니라 PostgresSaver로 state가 복원되는지 확인한다.

**Commands:**

```bash
SESSION_JSON=$(curl -s -X POST http://localhost:8001/chat/graph/sessions \
  -H 'Content-Type: application/json' \
  -d '{"title":"checkpoint-test"}')

echo "$SESSION_JSON" | python -m json.tool
SID=$(echo "$SESSION_JSON" | python -c "import sys,json;print(json.load(sys.stdin)['id'])")

curl -N -X POST "http://localhost:8001/chat/graph/sessions/$SID/stream" \
  -H 'Content-Type: application/json' \
  -d '{"message":"강남에서 광고하고 싶어"}'

docker compose restart backend
sleep 5

curl -N -X POST "http://localhost:8001/chat/graph/sessions/$SID/stream" \
  -H 'Content-Type: application/json' \
  -d '{"message":"예산은 500만원이야"}'
```

**Pass criteria:**

- 두 번째 SSE stream의 node update에서 이전 턴의 `region=강남`이 유지된다.
- 새 budget 정보가 기존 state에 합쳐진다.
- backend restart 이후에도 처음부터 다시 묻지 않는다.
- checkpoint table에 해당 thread row가 존재한다.

Diagnostic query:

```bash
docker exec -it ooh-postgres psql -U postgres -d ooh_recommend \
  -c "select thread_id, checkpoint_ns, count(*) from checkpoints group by 1,2 order by count(*) desc;"
```

---

## 리스크와 대응

### Risk 1. import path/API mismatch

Known target:

```python
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
```

If this fails, inspect installed package:

```bash
python - <<'PY'
import pkgutil
import langgraph.checkpoint
print([m.name for m in pkgutil.iter_modules(langgraph.checkpoint.__path__)])
PY
```

Then adjust import path minimally.

### Risk 2. `setup()` async/sync mismatch

If `await checkpointer.setup()` fails because setup is sync, change only that line to:

```python
checkpointer.setup()
```

Do not redesign the lifecycle unless necessary.

### Risk 3. Docker service/container name mismatch

If `ooh-postgres` is not the actual container name, use:

```bash
docker compose ps
```

Then run `psql` against the actual postgres service container.

### Risk 4. local host Python missing backend deps

This is expected if using Hermes venv. Prefer Docker-based verification or install backend deps in a project venv.

---

## Non-goals for this change

Do not include these in this implementation:

- Graph routing behavior change
- `has_presented_initial`
- checkpoint state trimming
- checkpoint pruning/TTL
- Alembic migration framework
- DB schema cleanup
- frontend behavior change
- deploy script edits

---

## Final success criteria

- `backend/requirements.txt` includes PostgresSaver dependencies.
- `backend/src/services/graph/checkpointer.py` exists and encapsulates pool/saver lifecycle.
- `backend/src/main.py` compiles graph in lifespan with injected checkpointer.
- `backend/src/routers/chat_graph.py` no longer uses `_graph_cache` or `_get_graph()`.
- Backend starts and `/health` returns ok.
- Checkpoint tables are created in Postgres.
- Same `session_id` continues LangGraph state after `docker compose restart backend`.
