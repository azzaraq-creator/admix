"""recommend_react ReAct 그래프 — 추론(chatbot) ⇄ 도구(tools) 순환 + NOT_FOUND fallback.

SSE 없이 graph.invoke() 로 루프를 끝까지 돌린 뒤 events 리스트를 반환한다.
메모리는 checkpointer 없이 DB 대화이력을 매 턴 초기 messages 로 주입한다.
"""
from __future__ import annotations

import operator
import uuid as uuid_lib
from dataclasses import dataclass, field
from typing import Annotated, Optional, Sequence, TypedDict

from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition
from sqlalchemy.orm import Session

from src.services.graph.llm import get_chat
from src.services.recommend_react import domain

NOT_FOUND_MARKER = "[NOT_FOUND]"
HISTORY_LIMIT = 20  # 최근 대화 N개만 주입(토큰 절약)

FALLBACK_MESSAGE = (
    "조건에 맞는 매체를 찾지 못했어요. "
    "지역·제품·카테고리·타깃 등을 조금 다르게 알려주시면 다시 찾아드릴게요 😊"
)


@dataclass
class ReactContext:
    """요청 1건 동안 도구가 공유하는 가변 상태."""

    db: Optional[Session]
    session_id: Optional[str]
    top_k: int
    last_items: list[dict] = field(default_factory=list)
    active_proposal_id: Optional[str] = None
    events: list[dict] = field(default_factory=list)


def _history_to_messages(rows: list[dict]) -> list[BaseMessage]:
    """저장된 대화 이력 dict 목록 → LangChain 메시지. 빈 content는 스킵."""
    out: list[BaseMessage] = []
    for r in rows:
        content = (r.get("content") or "").strip()
        if not content:
            continue
        if r.get("role") == "assistant":
            out.append(AIMessage(content=content))
        else:
            out.append(HumanMessage(content=content))
    return out


def _load_history(session_id: Optional[str]) -> list[BaseMessage]:
    """AdSession.messages 최근 HISTORY_LIMIT개를 LangChain 메시지로 로드."""
    if not session_id:
        return []
    from src.database import SessionLocal
    from src.models.ad_session import AdSession

    try:
        sid = uuid_lib.UUID(str(session_id))
    except (ValueError, AttributeError):
        return []
    with SessionLocal() as db:
        session = db.query(AdSession).filter(AdSession.id == sid).first()
        if session is None:
            return []
        rows = [
            {
                "role": m.role.value if hasattr(m.role, "value") else str(m.role),
                "content": m.content,
            }
            for m in session.messages
        ]
    return _history_to_messages(rows[-HISTORY_LIMIT:])


# ===== 그래프 =====


class ReactState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]


SYSTEM_PROMPT = (
    "당신은 한국 OOH(옥외광고) 매체 추천 상담 챗봇입니다.\n"
    "- 광고 조건(지역/업종/제품/목적/타깃/매체유형/예산)으로 매체를 찾을 때 SearchMedia 를 호출하세요. "
    "이전 대화에서 이미 조건이 있으면, 사용자가 '~도/추가로'처럼 더하는 뉘앙스면 이전 조건도 함께, "
    "'~만/대신/바꿔'처럼 교체 뉘앙스거나 조사 없이 새 값만 말하면 새 값으로 SearchMedia 를 호출합니다.\n"
    "- 여러 지역 비교나 '가장 싼 것' 같은 질문은 필요한 만큼 SearchMedia 를 호출한 뒤, 그 결과를 근거로 "
    "직접 비교·판단해 답하세요.\n"
    "- 직전 목록의 특정 매체를 물으면 ExplainMedia, 제안서(장바구니) 작업은 "
    "CreateProposal/AddMedia/RenameProposal 을 호출하세요.\n"
    "- 도구가 반환한 정보만 근거로 답하고, 없는 내용을 지어내지 마세요.\n"
    "- SearchMedia 결과는 사용자 화면에 매체 카드로 함께 표시됩니다. 그러니 검색 결과를 답할 때는 "
    "매체를 번호로 일일이 나열하지 말고, 1~3문장으로 간결하게 대화하듯 안내하세요 "
    "(예: '강남 전광판 매체를 광고비 높은 순으로 정리했어요. 카드에서 확인해보세요 😊'). "
    "비교·최저가 등 특정 판단을 물었을 때만 핵심 매체명을 짚어 답하세요.\n"
    "- 최종 답변은 한국어로 친절하고 간결하게."
)


def _make_chatbot(llm_with_tools):
    def chatbot(state: ReactState):
        msgs = [SystemMessage(content=SYSTEM_PROMPT), *state["messages"]]
        return {"messages": [llm_with_tools.invoke(msgs)]}

    return chatbot


def _fallback(state: ReactState):
    return {"messages": [AIMessage(content=FALLBACK_MESSAGE)]}


def route_after_tools(state: ReactState) -> str:
    """마지막 도구 라운드 ToolMessage가 전부 NOT_FOUND면 fallback."""
    messages = state["messages"]
    last_ai = None
    for i in range(len(messages) - 1, -1, -1):
        if isinstance(messages[i], AIMessage) and getattr(messages[i], "tool_calls", None):
            last_ai = i
            break
    if last_ai is None:
        return "chatbot"
    tool_msgs = [m for m in messages[last_ai + 1:] if isinstance(m, ToolMessage)]
    if tool_msgs and all(NOT_FOUND_MARKER in str(m.content) for m in tool_msgs):
        return "fallback"
    return "chatbot"


def build_graph(ctx: ReactContext):
    from src.services.recommend_react.tools import build_tools

    tools = build_tools(ctx)
    llm_with_tools = get_chat(temperature=0.0).bind_tools(tools)

    workflow = StateGraph(ReactState)
    workflow.add_node("chatbot", _make_chatbot(llm_with_tools))
    workflow.add_node("tools", ToolNode(tools))
    workflow.add_node("fallback", _fallback)
    workflow.add_edge(START, "chatbot")
    workflow.add_conditional_edges("chatbot", tools_condition)
    workflow.add_conditional_edges(
        "tools", route_after_tools, {"chatbot": "chatbot", "fallback": "fallback"}
    )
    workflow.add_edge("fallback", END)
    return workflow.compile()


# ===== 컨텍스트 저장/로드 + 진입점 =====


def _load_context(session_id: Optional[str]) -> tuple[Optional[str], list[dict]]:
    """filter_context에서 (active_proposal_id, last_items) 로드."""
    if not session_id:
        return None, []
    from src.database import SessionLocal
    from src.models.ad_session import AdSession

    try:
        sid = uuid_lib.UUID(str(session_id))
    except (ValueError, AttributeError):
        return None, []
    with SessionLocal() as db:
        session = db.query(AdSession).filter(AdSession.id == sid).first()
        ctx = (session.filter_context if session else None) or {}
    return ctx.get("active_proposal_id"), (ctx.get("last_items") or [])


def _save_context(
    session_id: Optional[str], active_proposal_id: Optional[str], last_items: list[dict]
) -> None:
    if not session_id:
        return
    from src.database import SessionLocal
    from src.models.ad_session import AdSession

    try:
        sid = uuid_lib.UUID(str(session_id))
    except (ValueError, AttributeError):
        return
    slim = [
        {"id": it.get("id"), "media_id": it.get("media_id"), "name": it.get("name")}
        for it in last_items
    ]
    with SessionLocal() as db:
        session = db.query(AdSession).filter(AdSession.id == sid).first()
        if session is None:
            session = AdSession(id=sid, thread_id=str(sid))
            db.add(session)
        session.filter_context = {"active_proposal_id": active_proposal_id, "last_items": slim}
        db.commit()


def _persist_turn(
    session_id: Optional[str], user_text: str, assistant_text: str, payload: Optional[dict]
) -> None:
    """user + assistant 메시지 DB 저장(이력 메모리용). 실패해도 응답 계속."""
    if not session_id:
        return
    from src.models.ad_session import MessageRole
    from src.services.recommend_react.persist import persist_message

    persist_message(session_id, MessageRole.user, user_text, None)
    persist_message(session_id, MessageRole.assistant, assistant_text, payload)


def collect_events(
    message: str,
    db: Session,
    top_k: int = domain.DEFAULT_TOP_K,
    session_id: Optional[str] = None,
) -> dict:
    """ReAct 그래프를 1회 invoke 하고 프런트 events 리스트를 반환한다."""
    active_pid, last_items = _load_context(session_id)
    ctx = ReactContext(
        db=db,
        session_id=session_id,
        top_k=top_k,
        last_items=last_items,
        active_proposal_id=active_pid,
    )
    try:
        graph_app = build_graph(ctx)
        history = _load_history(session_id)
        result = graph_app.invoke({"messages": [*history, HumanMessage(content=message)]})
        final = result["messages"][-1]
        final_text = final.content if isinstance(final.content, str) else str(final.content)
    except Exception as exc:  # noqa: BLE001
        return {"events": [], "error": str(exc)}

    # 프런트는 assistant 버블 1개에 이벤트를 순차 덮어써 마지막만 렌더한다(턴당 이벤트 1개 전제).
    # 구조화 이벤트(list/proposal/media_detail)가 있으면 그중 마지막을 단일 이벤트로 반환해
    # 매체카드/제안서카드/지도마커가 chat 텍스트에 덮이지 않게 한다. 없으면 chat/fallback.
    structured = [
        e
        for e in ctx.events
        if e.get("type") in ("list", "proposal", "media_detail", "proposal_choices")
    ]
    if structured:
        # 카드(list)와 함께 LLM 의 대화형 최종 답변도 보여주기 위해 message 에 실어 보낸다.
        ev = dict(structured[-1])
        if ev.get("type") == "list" and final_text:
            ev["message"] = final_text
        out_events = [ev]
    elif ctx.events:
        out_events = [ctx.events[-1]]
    elif final_text:
        out_events = [{"type": "chat", "message": final_text}]
    else:
        out_events = []

    last = out_events[-1] if out_events else None
    _persist_turn(
        session_id, message, (last or {}).get("message") or final_text, last
    )
    _save_context(session_id, ctx.active_proposal_id, ctx.last_items)
    return {"events": out_events, "error": None}
