"""recommend_react 도구 — 스키마 + 실행기.

각 도구는 요청별 ReactContext 를 클로저로 캡처한다. 실행 결과로 (a) LLM 에
돌려줄 요약 문자열을 반환하고, (b) 프런트로 나갈 구조화 이벤트를 ctx.events 에 append 한다.
"""
from __future__ import annotations

from typing import Optional

from langchain_core.tools import tool
from pydantic import BaseModel, Field

from src.services import media_service, proposal_service
from src.services.recommend_react import domain
from src.services.recommend_react.graph import NOT_FOUND_MARKER, ReactContext


def build_list_event(items: list[dict], total: int, shown: int) -> dict:
    if total > shown:
        message = f"조건에 맞는 매체를 {total}개 찾았어요. {shown}개만 먼저 보여드릴게요 😊"
    else:
        message = f"조건에 맞는 매체를 {total}개 찾았어요."
    return {"type": "list", "message": message, "items": items, "match_count": total}


def list_summary_for_llm(items: list[dict], total: int) -> str:
    """LLM 이 후속 추론(비교·최저가 등)에 쓸 텍스트 요약."""
    if not items:
        return f"{NOT_FOUND_MARKER} 조건에 맞는 매체가 없습니다."
    lines = [f"총 {total}건 중 상위 {len(items)}건(광고비 내림차순):"]
    for i, it in enumerate(items, 1):
        price = it.get("price") or "가격미정"
        lines.append(f"{i}. {it.get('name')} — {price}")
    return "\n".join(lines)


# ===== 도구 스키마 (bind_tools 로 LLM 에 노출) =====


class SearchMediaArgs(BaseModel):
    """광고 조건으로 매체를 검색한다. 지역/업종/제품/목적/타깃/매체유형/예산을
    발화 맥락에서 종합해 채운다. 이전 조건에 더하는 발화면 이전 값도 함께 넣는다."""

    region: str = Field("", description="지역/상권 (예: 강남, 성수, 홍대). 여러 곳이면 콤마로.")
    industry: str = Field("", description="업종")
    product: str = Field("", description="제품군")
    objective: str = Field("", description="캠페인 목적")
    target: str = Field("", description="타깃 오디언스")
    media_type: str = Field("", description="매체 카테고리 (예: 전광판, 버스, 지하철)")
    budget: str = Field("", description="예산 표현 그대로 (예: '5천만원', '1억'). 없으면 빈 문자열.")


class ExplainMediaArgs(BaseModel):
    """직전 추천 리스트의 특정 매체 상세 설명."""

    index: Optional[int] = Field(None, description="1-based 리스트 번호")
    name: Optional[str] = Field(None, description="번호 대신 매체명 지목")
    aspect: Optional[str] = Field(None, description="물은 세부 항목(주소/규격/유동인구 등). 전반 설명이면 null")


class CreateProposalArgs(BaseModel):
    """새 제안서(장바구니) 생성. 이름 없으면 null."""

    name: Optional[str] = Field(None, description="제안서 이름만(조사·'제안서'·'만들어줘' 제외)")
    media_indices: list[int] = Field(default_factory=list, description="함께 담을 1-based 번호")


class AddMediaArgs(BaseModel):
    """직전 추천 매체를 제안서에 담기."""

    media_indices: list[int] = Field(default_factory=list, description="담을 1-based 번호")
    proposal_name: Optional[str] = Field(
        None,
        description=(
            "담을 대상 제안서 이름. 사용자가 특정 제안서를 지목했을 때만 채운다"
            "(예: '여름캠페인에 담아줘'→'여름캠페인'). 지목 안 했으면 null."
        ),
    )


class RenameProposalArgs(BaseModel):
    """현재 제안서 이름 변경."""

    new_name: str = Field(description="새 이름")


# ===== 실행기 헬퍼 =====


def _run_search(ctx: ReactContext, text: str) -> tuple[list[dict], int]:
    """자연어 조건 텍스트 → 키워드추출 + 필터+정렬+포맷 → (item dict 목록, total).

    키워드 추출을 이 함수 안에 포함해, 테스트에서 이 함수 하나만 patch 하면
    LLM/DB 호출을 전부 우회할 수 있게 한다.
    """
    codes = domain.extract_keywords(text, ctx.db)
    # 유효 필터가 하나도 없으면(예: 사전에 없는 지역) 전 매체 덤프 대신 NOT_FOUND 처리.
    if not domain._has_any_filter(codes):
        return [], 0
    candidates, total = domain.filter_media_items(ctx.db, codes, domain.MAX_CANDIDATE_FETCH)
    if total == 0:
        return [], 0
    selected = domain.sort_by_price_desc(candidates, top_k=ctx.top_k)
    meta = domain._media_meta_by_media_id(ctx.db, selected)
    images = domain._images_by_media_id(ctx.db, [it.media_id for it in selected])
    items = [domain._to_response_item(it, meta, images).model_dump() for it in selected]
    return items, total


def _resolve_item(last_items: list[dict], index: Optional[int], name: Optional[str]) -> Optional[dict]:
    if index is not None and 1 <= index <= len(last_items or []):
        return last_items[index - 1]
    if name:
        for it in last_items or []:
            if name in (it.get("name") or ""):
                return it
    return None


def _proposal_event(proposal, message: str) -> dict:
    return {
        "type": "proposal",
        "message": message,
        "proposal": {
            "id": str(proposal.id),
            "name": proposal.title,
            "media_count": proposal.media_count,
        },
    }


def _emit_proposal_choices(ctx: ReactContext, proposals, media_ids: list[str], message: str) -> str:
    """담을 제안서가 애매할 때 선택 목록(카드)을 프런트로 방출한다(담지는 않음).

    프런트가 카드 클릭 시 media_ids 를 그 제안서에 직접 담는다.
    """
    ctx.events.append({
        "type": "proposal_choices",
        "message": message,
        "proposals": [
            {"id": str(p.id), "name": p.title, "media_count": p.media_count}
            for p in proposals
        ],
        "media_ids": media_ids,
    })
    return "사용자에게 제안서 선택 목록을 보여줬습니다."


def _do_create_proposal(ctx: ReactContext, name: Optional[str], indices: list[int]) -> str:
    member_id, owner_sid, owner_user = domain._proposal_owner_for_session(ctx.db, ctx.session_id)
    title = (name or "").strip()[:300] or "새 제안서"
    try:
        proposal = domain._create_proposal_sync(ctx.db, title, member_id, owner_sid, owner_user)
    except proposal_service.ProposalLimitError as exc:
        msg = domain._proposal_limit_message(exc.tier, exc.limit)
        ctx.events.append({"type": "chat", "message": msg})
        return msg
    ctx.active_proposal_id = str(proposal.id)
    media_ids = domain._media_ids_from_indices(ctx.last_items, indices)
    if media_ids:
        proposal = domain._add_items_sync(ctx.db, proposal.id, member_id, owner_sid, media_ids) or proposal
        msg = f"'{title}' 제안서를 만들고 매체 {len(media_ids)}개를 담았어요."
    else:
        msg = f"'{title}' 제안서를 만들었어요."
    ctx.events.append(_proposal_event(proposal, msg))
    return msg


def _do_add_media(ctx: ReactContext, indices: list[int], proposal_name: Optional[str] = None) -> str:
    member_id, owner_sid, _ = domain._proposal_owner_for_session(ctx.db, ctx.session_id)
    media_ids = domain._media_ids_from_indices(ctx.last_items, indices)
    if not media_ids:
        # NOT_FOUND 마커를 쓰지 않는다(가드레일 fallback 오발동 방지) — LLM 이 되묻게 한다.
        return "어떤 매체를 담을까요? 추천 목록에서 번호를 알려주세요 😊"

    proposals = proposal_service.list_for_owner(ctx.db, member_id=member_id, session_id=owner_sid)

    # 대상 제안서 결정: ① 없으면 생성 안내(담지 않음) → ② 지정 이름 → ③ 세션 active →
    #                    ④ 유일 → ⑤ 여러 개인데 지정 없으면 되묻기(담지 않음)
    if not proposals:
        # 자동 생성하지 않고 사용자에게 제안서 생성을 안내한다(v2 동작). 마커 없음 → LLM 이 relay.
        return (
            "보유중인 제안서가 없어요. 먼저 제안서를 만들어야 담을 수 있어요. "
            "어떤 이름으로 만들까요? (예: '여름캠페인으로 제안서 만들어줘')"
        )
    if proposal_name and proposal_name.strip():
        name = proposal_name.strip()
        matches = [p for p in proposals if name in (p.title or "") or (p.title or "") in name]
        if len(matches) == 1:
            target = matches[0]
        elif not matches:
            return _emit_proposal_choices(
                ctx, proposals, media_ids,
                f"'{name}' 제안서를 찾지 못했어요. 아래에서 담을 제안서를 선택해주세요 😊",
            )
        else:
            return _emit_proposal_choices(
                ctx, matches, media_ids,
                f"'{name}'와 비슷한 제안서가 여러 개예요. 아래에서 선택해주세요 😊",
            )
    elif ctx.active_proposal_id and any(str(p.id) == str(ctx.active_proposal_id) for p in proposals):
        target = next(p for p in proposals if str(p.id) == str(ctx.active_proposal_id))
    elif len(proposals) == 1:
        target = proposals[0]
    else:
        return _emit_proposal_choices(
            ctx, proposals, media_ids,
            "어느 제안서에 담을까요? 아래에서 선택해주세요 😊",
        )

    updated = domain._add_items_sync(ctx.db, target.id, member_id, owner_sid, media_ids) or target
    ctx.active_proposal_id = str(updated.id)
    msg = f"매체 {len(media_ids)}개를 '{updated.title}' 제안서에 담았어요."
    ctx.events.append(_proposal_event(updated, msg))
    return msg


def _do_rename(ctx: ReactContext, new_name: str) -> str:
    member_id, owner_sid, _ = domain._proposal_owner_for_session(ctx.db, ctx.session_id)
    proposal = domain._get_active_or_latest(ctx.db, ctx.active_proposal_id, member_id, owner_sid)
    if proposal is None:
        return f"{NOT_FOUND_MARKER} 이름을 바꿀 제안서가 없습니다."
    updated = proposal_service.rename(ctx.db, proposal, new_name.strip()) if hasattr(proposal_service, "rename") else proposal
    ctx.active_proposal_id = str(updated.id)
    msg = f"제안서 이름을 '{updated.title}'(으)로 바꿨어요."
    ctx.events.append(_proposal_event(updated, msg))
    return msg


# ===== 도구 팩토리 =====


def build_tools(ctx: ReactContext) -> list:
    """요청별 ctx를 클로저로 캡처한 도구 5개 리스트. (스키마 클래스와 도구 함수는 이름을 분리)"""

    @tool(args_schema=SearchMediaArgs)
    def SearchMedia(region="", industry="", product="", objective="", target="", media_type="", budget=""):  # noqa: N802
        """광고 조건으로 매체를 검색한다."""
        text = " ".join(
            p for p in (region, industry, product, objective, target, media_type, budget) if p
        ).strip()
        items, total = _run_search(ctx, text)
        if total == 0:
            return f"{NOT_FOUND_MARKER} 조건에 맞는 매체가 없습니다."
        ctx.last_items = items
        ctx.events.append(build_list_event(items, total, len(items)))
        return list_summary_for_llm(items, total)

    @tool(args_schema=ExplainMediaArgs)
    def ExplainMedia(index=None, name=None, aspect=None):  # noqa: N802
        """직전 리스트의 특정 매체 상세 설명."""
        item = _resolve_item(ctx.last_items, index, name)
        if item is None:
            return f"{NOT_FOUND_MARKER} 지목한 매체를 직전 목록에서 찾지 못했습니다."
        detail = None
        mid = item.get("media_id")
        if mid:
            detail = media_service.get_media_detail(ctx.db, str(mid))
        explanation = domain._explain_with_llm(item, detail, aspect)
        ctx.events.append({
            "type": "media_detail",
            "message": explanation,
            "media": {
                "id": item.get("id"),
                "media_id": mid,
                "name": item.get("name"),
                "thumbnail_url": (detail or {}).get("thumbnailUrl"),
            },
        })
        return explanation

    @tool(args_schema=CreateProposalArgs)
    def CreateProposal(name=None, media_indices=None):  # noqa: N802
        """새 제안서 생성."""
        return _do_create_proposal(ctx, name, media_indices or [])

    @tool(args_schema=AddMediaArgs)
    def AddMedia(media_indices=None, proposal_name=None):  # noqa: N802
        """직전 매체를 제안서에 담기."""
        return _do_add_media(ctx, media_indices or [], proposal_name)

    @tool(args_schema=RenameProposalArgs)
    def RenameProposal(new_name):  # noqa: N802
        """현재 제안서 이름 변경."""
        return _do_rename(ctx, new_name)

    return [SearchMedia, ExplainMedia, CreateProposal, AddMedia, RenameProposal]
