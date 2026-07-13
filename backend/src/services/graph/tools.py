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
    aspect: Optional[str] = Field(
        None,
        description=(
            "사용자가 물은 세부 항목. 예: '주소', '최소 집행금액', '규격', '유동인구', "
            "'리드타임', '카테고리'. 특정 항목 없이 전반적 설명이면 null."
        ),
    )


class CreateProposal(BaseModel):
    """새 제안서(장바구니) 생성."""

    name: Optional[str] = Field(
        None,
        description=(
            "사용자가 지정한 제안서 이름만. 조사(으로/로/라고/이라고)와 '제안서'·'만들어줘' 같은 "
            "단어는 제외한다. 예: '테스트로 제안서 만들어줘'→'테스트', '여름캠페인 제안서'→'여름캠페인'. "
            "이름을 지정하지 않았으면 null."
        ),
    )
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
) -> tuple[Optional[dict], Optional[str]]:
    """tool_calls → (직전 리스트의 해당 item, aspect). 매칭 없으면 (None, None)."""
    if not tool_calls or not last_items:
        return None, None
    args = tool_calls[0].get("args") or {}
    aspect = (args.get("aspect") or "").strip() or None
    idx = args.get("index")
    if isinstance(idx, int) and 1 <= idx <= len(last_items):
        return last_items[idx - 1], aspect
    name = (args.get("name") or "").strip()
    if name:
        for it in last_items:
            if name in (it.get("name") or ""):
                return it, aspect
    return None, None


# ===== LLM 리졸버 (bind_tools 호출 → 파서) =====


def resolve_proposal_via_tools(message: str, last_items: list[dict], has_active: bool):
    """발화를 제안서 도구(create/add/rename)로 매핑 → ProposalIntent."""
    from src.services.recommend_v2 import ProposalIntent

    listing = "\n".join(
        f"{i + 1}. {it.get('name', '')}" for i, it in enumerate(last_items or [])
    )
    sys_prompt = (
        "사용자 발화를 아래 제안서 도구 중 하나로 매핑하라.\n"
        "- CreateProposal: 새 제안서 생성 (예: '제안서 만들어줘', 'XX로 제안서 만들어줘'). "
        "name 에는 사용자가 준 이름만 넣고 조사·'제안서'·'만들어줘'는 뺀다 "
        "('테스트로 제안서 만들어줘'→name='테스트').\n"
        "- AddMedia: 추천 매체를 제안서에 담기. '담기'와 '넣기'는 같은 의미다 "
        "(예: '1번 3번 담아줘', '2번 넣어줘', '제안서에 넣어줘', '제안서담기').\n"
        "- RenameProposal: 기존 제안서 이름 변경 (예: '이름 XX로 바꿔줘').\n"
        "- '제안서' 를 언급한 발화는 반드시 위 세 도구 중 하나를 호출하라. "
        "무엇을 담을지 번호가 없어도 담기/넣기 의도면 AddMedia 를 media_indices 빈 배열로 호출한다.\n"
        "- 제안서와 무관한 발화(새 검색조건·매체 설명요청 등)만 어떤 도구도 호출하지 마라.\n"
        "- '1번 3번으로 제안서 만들어줘'는 CreateProposal + media_indices.\n"
        "- 발화에 명시되지 않은 번호를 media_indices 에 절대 지어내지 마라. "
        "번호가 안 나오면 빈 배열로 둔다.\n\n"
        f"현재 작업중 제안서: {'있음' if has_active else '없음'}\n"
        f"[직전 추천 매체]\n{listing or '(없음)'}"
    )
    try:
        llm = get_chat(temperature=0.0).bind_tools([CreateProposal, AddMedia, RenameProposal])
        resp = llm.invoke([SystemMessage(content=sys_prompt), HumanMessage(content=message.strip())])
    except Exception:
        return ProposalIntent()
    return proposal_intent_from_tool_calls(getattr(resp, "tool_calls", []) or [])


def resolve_media_via_tools(
    message: str, last_items: list[dict]
) -> tuple[Optional[dict], Optional[str]]:
    """발화가 직전 리스트의 특정 매체 질문이면 (item, aspect), 아니면 (None, None)."""
    if not last_items:
        return None, None
    listing = "\n".join(
        f"{i + 1}. {it.get('name', '')}" for i, it in enumerate(last_items)
    )
    sys_prompt = (
        "사용자가 아래 '직전 추천 매체' 중 특정 매체의 상세 설명을 요청하면 "
        "ExplainMedia 도구를 index(1-based) 또는 name 으로 호출하라. "
        "특정 세부 항목(주소·집행금액·규격·유동인구 등)을 물으면 그 항목을 aspect 에 담고, "
        "전반적 설명이면 aspect 를 비워라. "
        "새 검색조건이거나 목록과 무관하면 도구를 호출하지 마라.\n\n"
        f"[직전 추천 매체]\n{listing}"
    )
    try:
        llm = get_chat(temperature=0.0).bind_tools([ExplainMedia])
        resp = llm.invoke([SystemMessage(content=sys_prompt), HumanMessage(content=message.strip())])
    except Exception:
        return None, None
    return media_item_from_tool_calls(getattr(resp, "tool_calls", []) or [], last_items)
