"""Stage 1 의도 분류기 — 발화를 4개 의도 라벨로 분류.

실패/애매 시 RECOMMEND 로 폴백(기존 fallthrough 동작 = 회귀 안전).
"""
from __future__ import annotations

from typing import Literal

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from src.services.graph.llm import get_chat


class Intent(BaseModel):
    """사용자 발화의 최상위 의도."""

    intent: Literal["RECOMMEND", "EXPLAIN", "PROPOSAL", "GENERAL"] = "RECOMMEND"


_CLASSIFY_SYS = (
    "사용자 발화를 다음 4개 의도 중 하나로 분류하라.\n"
    "- RECOMMEND: 광고 조건(지역/업종/제품/목적/타깃/매체유형/예산)을 말하거나 매체 추천을 원함.\n"
    "- EXPLAIN: 직전에 추천된 리스트의 특정 매체를 더 알고 싶어함 (예: '3번 자세히', 'BK빌딩 어때?').\n"
    "- PROPOSAL: 제안서(장바구니) 생성/담기/이름변경 작업 (예: '제안서 만들어줘', '1번 담아줘').\n"
    "- GENERAL: 인사/서비스 문의/잡담 등 위에 해당하지 않는 일반 발화 (예: '안녕', '여기 뭐하는 곳이야?').\n"
    "경계가 애매하면 RECOMMEND 로 분류하라.\n"
    "[컨텍스트] 직전 추천 리스트 존재: {has_list} / 작업중 제안서 존재: {has_active}"
)


def classify_intent(
    message: str, has_last_list: bool, has_active_proposal: bool
) -> str:
    """발화 → 의도 라벨 문자열. 실패/애매 → 'RECOMMEND'."""
    if not message or not message.strip():
        return "RECOMMEND"
    sys_prompt = _CLASSIFY_SYS.format(
        has_list="있음" if has_last_list else "없음",
        has_active="있음" if has_active_proposal else "없음",
    )
    try:
        llm = get_chat(temperature=0.0).with_structured_output(Intent)
        res: Intent = llm.invoke(
            [SystemMessage(content=sys_prompt), HumanMessage(content=message.strip())]
        )
    except Exception:
        return "RECOMMEND"
    label = res.intent
    # 직전 리스트 없으면 EXPLAIN 대상이 없음 → RECOMMEND
    if label == "EXPLAIN" and not has_last_list:
        return "RECOMMEND"
    return label
