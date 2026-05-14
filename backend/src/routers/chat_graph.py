"""광고 매체 추천 LangGraph 라우터.

- POST /chat/graph/stream                       세션 없이 단발 stream (테스트용)
- POST /chat/graph/sessions                     세션 생성
- GET  /chat/graph/sessions                     세션 목록
- GET  /chat/graph/sessions/{id}                세션 상세 (메시지 포함)
- PATCH /chat/graph/sessions/{id}               title 변경
- DELETE /chat/graph/sessions/{id}              삭제
- POST /chat/graph/sessions/{id}/stream         세션에 메시지 추가 + SSE stream + 결과 저장

SSE 이벤트:
- event: thread   {thread_id, session_id?}
- event: node     {name, update}
- event: done     {}
- event: error    {message}
"""
from __future__ import annotations

import json
import traceback
import uuid
from typing import Any, AsyncIterator, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from src.database import SessionLocal, get_db
from src.models.ad_session import MessageRole
from src.schemas.ad_session import (
    AdSessionCreate,
    AdSessionDetail,
    AdSessionSummary,
    AdSessionUpdate,
    StreamMessageRequest,
)
from src.services import ad_session_service as svc
from src.services.graph.builder import build_graph

router = APIRouter(prefix="/chat/graph", tags=["chat-graph"])

# Lazy-init: 첫 요청 때만 그래프 컴파일 (DB 연결도 그때).
_graph_cache = None


def _get_graph():
    global _graph_cache
    if _graph_cache is None:
        _graph_cache = build_graph(rerank="sangwon", explain=True)
    return _graph_cache


# ===== 세션 없는 단발 stream (기존 호환용) =====


class GraphMessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    thread_id: Optional[str] = Field(None, description="멀티턴 이어가기. 없으면 서버가 생성.")


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


def _jsonable(obj: Any) -> Any:
    if isinstance(obj, BaseMessage):
        return {"role": obj.type, "content": obj.content}
    if hasattr(obj, "model_dump") and not isinstance(obj, type):
        return obj.model_dump()
    if isinstance(obj, dict):
        return {k: _jsonable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_jsonable(v) for v in obj]
    return obj


_SLIM_RULES = {
    "db_filter_final": {"drop_keys": {"matched_media", "candidate_pool_ids"}},
}


def _serialize_update(node_name: str, update: Optional[dict]) -> tuple[dict, Optional[str]]:
    """노드 update → (SSE 직렬화 dict, assistant_message 텍스트)."""
    update = update or {}
    rules = _SLIM_RULES.get(node_name, {})
    drop_keys = rules.get("drop_keys") or set()

    out: dict = {}
    assistant_message: Optional[str] = None
    for k, v in update.items():
        if k == "messages":
            for m in v or []:
                if isinstance(m, AIMessage):
                    assistant_message = m.content
            continue
        if k in drop_keys:
            if isinstance(v, list):
                out[f"{k}_size"] = len(v)
            continue
        out[k] = _jsonable(v)
    if assistant_message is not None:
        out["assistant_message"] = assistant_message
    return out, assistant_message


async def _event_stream(message: str, thread_id: str) -> AsyncIterator[str]:
    yield _sse("thread", {"thread_id": thread_id})
    config = {"configurable": {"thread_id": thread_id}}
    try:
        graph = _get_graph()
        async for chunk in graph.astream(
            {"messages": [HumanMessage(content=message)], "status": "starting"},
            config=config,
            stream_mode="updates",
        ):
            for node_name, update in chunk.items():
                serialized, _ = _serialize_update(node_name, update)
                yield _sse("node", {"name": node_name, "update": serialized})
        yield _sse("done", {})
    except Exception as exc:
        print(
            f"[chat_graph] stream error in thread={thread_id}:\n{traceback.format_exc()}",
            flush=True,
        )
        yield _sse("error", {"message": f"{type(exc).__name__}: {exc}"})


@router.post("/stream")
async def stream_graph(payload: GraphMessageRequest):
    thread_id = payload.thread_id or f"thread-{uuid.uuid4().hex[:12]}"
    return StreamingResponse(
        _event_stream(payload.message, thread_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ===== 세션 CRUD =====


@router.post(
    "/sessions",
    response_model=AdSessionSummary,
    status_code=status.HTTP_201_CREATED,
)
def create_session(payload: AdSessionCreate, db: Session = Depends(get_db)):
    return svc.create_session(db, title=payload.title)


@router.get("/sessions", response_model=List[AdSessionSummary])
def list_sessions(db: Session = Depends(get_db)):
    return svc.list_sessions(db, limit=50)


@router.get("/sessions/{session_id}", response_model=AdSessionDetail)
def get_session(session_id: str, db: Session = Depends(get_db)):
    s = svc.get_session(db, session_id)
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    return s


@router.patch("/sessions/{session_id}", response_model=AdSessionSummary)
def patch_session(session_id: str, payload: AdSessionUpdate, db: Session = Depends(get_db)):
    s = svc.update_title(db, session_id, payload.title)
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    return s


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: str, db: Session = Depends(get_db)):
    if not svc.delete_session(db, session_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")


# ===== 세션 stream — 메시지 저장 + 그래프 실행 =====


async def _session_event_stream(
    session_id: str,
    thread_id: str,
    message: str,
) -> AsyncIterator[str]:
    """세션에 user 메시지 저장 → 그래프 stream → assistant 메시지 저장.

    DB 작업은 stream 안에서 새 SessionLocal 로 처리 (endpoint 의 db 세션은 라우터 함수 종료 시 닫힘).
    """
    # 1) user 메시지 저장
    try:
        with SessionLocal() as db:
            svc.add_message(db, session_id, MessageRole.user, message)
    except Exception as exc:
        yield _sse("error", {"message": f"DB error (user save): {exc}"})
        return

    yield _sse("thread", {"thread_id": thread_id, "session_id": session_id})

    final_payload: dict[str, Any] = {}
    final_assistant_text: str = ""

    try:
        graph = _get_graph()
        config = {"configurable": {"thread_id": thread_id}}
        async for chunk in graph.astream(
            {"messages": [HumanMessage(content=message)], "status": "starting"},
            config=config,
            stream_mode="updates",
        ):
            for node_name, update in chunk.items():
                serialized, ai_text = _serialize_update(node_name, update)
                yield _sse("node", {"name": node_name, "update": serialized})

                # 마지막 저장용 payload 누적 (raw update 기준).
                update = update or {}
                for key in ("slots", "summary"):
                    if key in update and update[key] is not None:
                        final_payload[key] = _jsonable(update[key])
                for key in ("top_picks", "pivots"):
                    if update.get(key):
                        final_payload[key] = _jsonable(update[key])
                # matched_media: present_initial_list 또는 rerank 후 Top-N 만 저장 (db_filter 93건 제외).
                if node_name in ("present_initial_list", "rerank") and update.get("matched_media"):
                    final_payload["matched_media"] = _jsonable(update["matched_media"])
                if ai_text:
                    final_assistant_text = ai_text

        # 2) assistant 메시지 저장 — 성공 후에만 done 을 emit 한다.
        # done 을 먼저 보내면 클라이언트는 성공으로 인지하는데 DB 저장이 실패하면 히스토리 누락.
        content = final_assistant_text or final_payload.get("summary") or ""
        with SessionLocal() as db:
            svc.add_message(
                db,
                session_id,
                MessageRole.assistant,
                content=content,
                payload=final_payload or None,
            )

        yield _sse("done", {})
    except Exception as exc:
        print(
            f"[chat_graph] session={session_id} stream error:\n{traceback.format_exc()}",
            flush=True,
        )
        yield _sse("error", {"message": f"{type(exc).__name__}: {exc}"})


@router.post("/sessions/{session_id}/stream")
def session_stream(
    session_id: str,
    payload: StreamMessageRequest,
    db: Session = Depends(get_db),
):
    s = svc.get_session(db, session_id)
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    return StreamingResponse(
        _session_event_stream(str(s.id), s.thread_id, payload.message),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
