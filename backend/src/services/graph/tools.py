"""챗봇 Stage 2 Tool Calling — 툴 스키마 + 파서 + LLM 리졸버.

의도 라우터가 라벨별로 bind_tools 리졸버를 호출한다. 순수 파서는 tool_calls
(dict 목록)를 도메인 객체로 변환 — LLM 없이 단위 테스트 가능.
"""
from __future__ import annotations

from typing import Optional

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from src.services.graph.llm import get_chat


# ===== Tool 스키마 (bind_tools 로 LLM 에 노출) =====


class ExplainMedia(BaseModel):
    """직전 추천 리스트의 특정 매체 상세 설명 요청."""

    index: Optional[int] = Field(None, description="1-based 리스트 번호")
    name: Optional[str] = Field(None, description="번호 대신 매체명으로 지목 시")


class CreateProposal(BaseModel):
    """새 제안서(장바구니) 생성."""

    name: Optional[str] = Field(None, description="제안서 이름(없으면 null)")
    media_indices: list[int] = Field(default_factory=list, description="함께 담을 1-based 번호")


class AddMedia(BaseModel):
    """직전 추천 매체를 현재 제안서에 담기."""

    media_indices: list[int] = Field(default_factory=list, description="담을 1-based 번호")


class RenameProposal(BaseModel):
    """기존 제안서 이름 변경."""

    new_name: str = Field(description="새 제안서 이름")


# ===== 순수 파서 (tool_calls → 도메인 객체) =====


def proposal_intent_from_tool_calls(tool_calls: list[dict]):
    """tool_calls → ProposalIntent (없으면 action='none')."""
    from src.services.recommend_v2 import ProposalIntent

    if not tool_calls:
        return ProposalIntent()
    call = tool_calls[0]
    name = call.get("name")
    args = call.get("args") or {}
    if name == "CreateProposal":
        return ProposalIntent(
            action="create",
            name=args.get("name"),
            media_indices=list(args.get("media_indices") or []),
        )
    if name == "AddMedia":
        return ProposalIntent(
            action="add_media",
            media_indices=list(args.get("media_indices") or []),
        )
    if name == "RenameProposal":
        return ProposalIntent(action="rename", new_name=args.get("new_name"))
    return ProposalIntent()


def media_item_from_tool_calls(
    tool_calls: list[dict], last_items: list[dict]
) -> Optional[dict]:
    """tool_calls → 직전 리스트의 해당 item (없으면 None)."""
    if not tool_calls or not last_items:
        return None
    args = tool_calls[0].get("args") or {}
    idx = args.get("index")
    if isinstance(idx, int) and 1 <= idx <= len(last_items):
        return last_items[idx - 1]
    name = (args.get("name") or "").strip()
    if name:
        for it in last_items:
            if name in (it.get("name") or ""):
                return it
    return None


# ===== LLM 리졸버 (bind_tools 호출 → 파서) =====


def resolve_proposal_via_tools(message: str, last_items: list[dict], has_active: bool):
    """발화를 제안서 도구(create/add/rename)로 매핑 → ProposalIntent."""
    from src.services.recommend_v2 import ProposalIntent

    listing = "\n".join(
        f"{i + 1}. {it.get('name', '')}" for i, it in enumerate(last_items or [])
    )
    sys_prompt = (
        "사용자 발화를 아래 제안서 도구 중 하나로 매핑하라.\n"
        "- CreateProposal: 새 제안서 생성 (예: '제안서 만들어줘', 'XX로 제안서 만들어줘').\n"
        "- AddMedia: 직전 추천 목록의 특정 매체를 담기 (예: '1번 3번 담아줘').\n"
        "- RenameProposal: 기존 제안서 이름 변경 (예: '이름 XX로 바꿔줘').\n"
        "- 제안서 작업이 아니면 어떤 도구도 호출하지 마라.\n"
        "- '1번 3번으로 제안서 만들어줘'는 CreateProposal + media_indices.\n\n"
        f"현재 작업중 제안서: {'있음' if has_active else '없음'}\n"
        f"[직전 추천 매체]\n{listing or '(없음)'}"
    )
    try:
        llm = get_chat(temperature=0.0).bind_tools([CreateProposal, AddMedia, RenameProposal])
        resp = llm.invoke([SystemMessage(content=sys_prompt), HumanMessage(content=message.strip())])
    except Exception:
        return ProposalIntent()
    return proposal_intent_from_tool_calls(getattr(resp, "tool_calls", []) or [])


def resolve_media_via_tools(message: str, last_items: list[dict]) -> Optional[dict]:
    """발화가 직전 리스트의 특정 매체 질문이면 해당 item, 아니면 None."""
    if not last_items:
        return None
    listing = "\n".join(
        f"{i + 1}. {it.get('name', '')}" for i, it in enumerate(last_items)
    )
    sys_prompt = (
        "사용자가 아래 '직전 추천 매체' 중 특정 매체의 상세 설명을 요청하면 "
        "ExplainMedia 도구를 index(1-based) 또는 name 으로 호출하라. "
        "새 검색조건이거나 목록과 무관하면 도구를 호출하지 마라.\n\n"
        f"[직전 추천 매체]\n{listing}"
    )
    try:
        llm = get_chat(temperature=0.0).bind_tools([ExplainMedia])
        resp = llm.invoke([SystemMessage(content=sys_prompt), HumanMessage(content=message.strip())])
    except Exception:
        return None
    return media_item_from_tool_calls(getattr(resp, "tool_calls", []) or [], last_items)
