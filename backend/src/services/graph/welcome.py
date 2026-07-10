"""GENERAL(인사·정체성·잡담) 하이브리드 웰컴 응답.

가드레일 프롬프트가 3요소(인사·페르소나 소개·첫 입력 유도)를 강제하고
LLM 이 톤을 생성. 실패 시 캔드 문구 폴백.
"""
from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from src.services.graph.llm import get_chat

_WELCOME_SYS = (
    "당신은 옥외광고(전광판·지하철·버스 등) 매체를 추천하는 챗봇이다. "
    "사용자의 인사/서비스 문의/잡담에 대해 한국어 1~3문장으로 답하되 반드시: "
    "①따뜻하게 인사하고 ②'옥외광고 매체를 추천하는 챗봇'이라고 정체성을 밝히고 "
    "③광고할 지역이나 업종 등 첫 조건을 알려달라고 유도하라. "
    "구체적 수치·통계·외부 링크는 지어내지 마라."
)

_CANNED = (
    "안녕하세요! 저는 옥외광고(전광판·지하철·버스 등) 매체를 추천해 드리는 챗봇이에요. "
    "어떤 지역이나 업종의 광고를 찾으시는지 알려주시면 매체를 추천해 드릴게요 😊"
)


def generate_welcome(message: str) -> str:
    """하이브리드 웰컴 문구. LLM 실패 시 캔드 폴백."""
    try:
        res = get_chat(temperature=0.3).invoke(
            [
                SystemMessage(content=_WELCOME_SYS),
                HumanMessage(content=(message or "").strip() or "안녕하세요"),
            ]
        )
        text = res.content if isinstance(res.content, str) else str(res.content)
        return text.strip() or _CANNED
    except Exception:
        return _CANNED
