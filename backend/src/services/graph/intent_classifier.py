"""Stage 1 의도 분류기 — 발화를 4개 의도 라벨로 분류.

실패/애매 시 RECOMMEND 로 폴백(기존 fallthrough 동작 = 회귀 안전).
"""
from __future__ import annotations

from typing import Literal

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from src.services.graph.llm import get_chat, get_chat_strong


class Intent(BaseModel):
    """사용자 발화의 최상위 의도."""

    intent: Literal["RECOMMEND", "EXPLAIN", "PROPOSAL", "GENERAL"] = "RECOMMEND"


class MergeIntent(BaseModel):
    """충돌하는 새 조건을 기존에 어떻게 반영할지."""

    action: Literal["ADD", "REPLACE", "AMBIGUOUS"] = "AMBIGUOUS"


_MERGE_SYS = (
    "사용자가 광고 매체 추천 조건을 대화로 좁혀가는 중이다. 방금 발화가 기존에 설정된 조건과 "
    "충돌하는(같은 항목의 다른) 값을 담고 있다. 사용자의 의도를 판단하라.\n"
    "- ADD: 기존 조건을 유지한 채 새 값도 함께 보고 싶음. 신호: '~도', '~랑/~하고', '추가로', "
    "'그리고', '같이', '둘 다' 등 병렬·추가 뉘앙스.\n"
    "- REPLACE: 새 값으로 검색. 명시적 대체 신호('말고', '대신', '~(으)로 바꿔/변경', '아니라', '~만')뿐 "
    "아니라, 조사·수식어 없이 새 값만 말하는 경우(예: 그냥 '강남', '강남 알려줘')도 새 검색으로 보아 "
    "REPLACE 로 판단하라.\n"
    "- AMBIGUOUS: 위 둘 중 어느 쪽인지 정말 판단이 안 될 때만(예: '홍대랑 강남 중 뭐가 나아?'처럼 "
    "추가·교체가 아니라 비교·질문인 경우).\n"
    "기본은 ADD 신호가 뚜렷하면 ADD, 그 외에는 REPLACE. 정말 모호할 때만 AMBIGUOUS.\n"
    "[충돌 내역]\n{conflict}"
)


def classify_merge_intent(message: str, conflict_text: str) -> str:
    """충돌 발화 → 'ADD' | 'REPLACE' | 'AMBIGUOUS'. 실패/애매 → 'AMBIGUOUS'."""
    if not message or not message.strip():
        return "AMBIGUOUS"
    sys_prompt = _MERGE_SYS.format(conflict=conflict_text)
    try:
        llm = get_chat_strong(temperature=0.0).with_structured_output(MergeIntent)
        res: MergeIntent = llm.invoke(
            [SystemMessage(content=sys_prompt), HumanMessage(content=message.strip())]
        )
    except Exception:
        return "AMBIGUOUS"
    return res.action


_CLASSIFY_SYS = (
    "사용자 발화를 다음 4개 의도 중 하나로 분류하라.\n"
    "- RECOMMEND: 구체적 광고 조건(지역/업종/제품/목적/타깃/매체유형/예산)을 실제로 제시하거나 매체 추천을 "
    "직접 요청함 (예: '강남역 화장품 광고', '5천만원으로 전광판 추천해줘').\n"
    "- EXPLAIN: 직전에 추천된 리스트의 특정 매체를 더 알고 싶어함 — 번호나 매체명으로 지목하며 "
    "상세 설명이나 세부 항목(주소·위치, 집행금액/광고비, 규격, 유동인구, 리드타임, 카테고리 등)을 물음 "
    "(예: '3번 자세히', 'BK빌딩 어때?', 'Glory 주소 알려줘', '스칼렛빌딩 집행금액 알려줘', '1번 규격'). "
    "리스트가 존재하면(직전 추천 리스트 존재=있음) 특정 매체를 지목해 정보를 묻는 발화는, 그 매체명을 "
    "몰라도 EXPLAIN 으로 분류하라(리스트에 실제 있는지는 이후 단계에서 판정한다). "
    "서비스 자체에 대한 설명 요청은 여기에 해당하지 않는다.\n"
    "- PROPOSAL: 제안서(장바구니) 생성/담기/이름변경 작업 (예: '제안서 만들어줘', '1번 담아줘').\n"
    "- GENERAL: 인사/잡담, 서비스 정체성·이용안내·요금 문의, 시작 방법 질문 등. 다음은 모두 GENERAL 이다 — "
    "'안녕', 'ㅎㅇ', '여기 뭐하는 곳이야?', 'ADMIX/에드믹스가 뭐야', '무슨 서비스인지 설명해줘', "
    "'광고대행사랑 뭐가 달라?', '무료야?', '뭐부터 입력해야 해?', '어디서 시작하면 돼?', "
    "'어떤 정보를 주면 추천받아?', '예시 보여줄래?'.\n"
    "핵심 구분: 아직 구체적 광고 조건을 제시하지 않고 서비스/사용법/시작점만 묻는 발화는 "
    "RECOMMEND 가 아니라 GENERAL 이다.\n"
    "단, 이미 진행 중인 광고 조건이 있는 상태(아래 [현재 조건]이 '(없음)'이 아님)에서 사용자가 새 "
    "지역/업종/제품/목적/타깃/매체유형/예산 값을 말하면 — 예: 기존 '홍대'가 있는데 '강남', '강남도', "
    "'강남으로 바꿔줘' — 잡담(GENERAL)이나 제안서(PROPOSAL)가 아니라 RECOMMEND 다.\n"
    "경계가 정말 애매하면 RECOMMEND 로 분류하라.\n"
    "[현재 조건] {context}\n"
    "[컨텍스트] 직전 추천 리스트 존재: {has_list} / 작업중 제안서 존재: {has_active}"
)


def classify_intent(
    message: str,
    has_last_list: bool,
    has_active_proposal: bool,
    context_summary: str = "",
) -> str:
    """발화 → 의도 라벨 문자열. 실패/애매 → 'RECOMMEND'.

    context_summary: 현재까지 파악된 조건 요약(예: "지역: 홍대"). 진행 중 대화에서
    새 조건값 발화를 GENERAL 로 오분류하지 않도록 문맥으로 주입한다.
    """
    if not message or not message.strip():
        return "RECOMMEND"
    sys_prompt = _CLASSIFY_SYS.format(
        has_list="있음" if has_last_list else "없음",
        has_active="있음" if has_active_proposal else "없음",
        context=context_summary or "(없음)",
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
