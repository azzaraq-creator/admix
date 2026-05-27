"""Node ① — LLM 으로 발화에서 6축 슬롯 추출 + 멀티턴 누적."""
from __future__ import annotations

import json
import re
from typing import Optional

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from pydantic import BaseModel, Field, field_validator

from src.services.graph.catalogs import format_catalog_for_prompt
from src.services.graph.llm import get_chat
from src.services.graph.settings import KOREAN_REGION_KEYWORDS
from src.services.graph.state import GoalLabel, RecommendState, Slots, TargetStruct

# longest match 우선 — '홍대입구' 가 '홍대' 보다 먼저 매칭되도록 길이 내림차순 정렬.
_REGION_PATTERN = re.compile(
    "|".join(re.escape(kw) for kw in sorted(KOREAN_REGION_KEYWORDS, key=len, reverse=True))
)


def _extract_region_keywords(text: str) -> list[str]:
    """LLM 누락 보완용. 사용자 발화에서 알려진 한국 지역명을 정규식으로 찾아 dedupe 리턴."""
    if not text:
        return []
    seen: dict[str, None] = {}
    for m in _REGION_PATTERN.finditer(text):
        seen.setdefault(m.group(0), None)
    return list(seen.keys())


class ExtractedSlots(BaseModel):
    region: list[str] = Field(default_factory=list)
    budget: Optional[int] = Field(None, description="원 단위. 5천만원=50000000.")
    target: TargetStruct = Field(default_factory=TargetStruct)
    product: list[str] = Field(default_factory=list)
    goal: list[str] = Field(default_factory=list)
    goal_label: Optional[GoalLabel] = Field(None)
    media_type: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    # 멀티턴에서 사용자가 region 교체를 명시했는지 플래그.
    # True 면 이전 region 을 덮어쓴다 (누적 X). 기본 False = 누적 (기존 동작).
    # budget 은 scalar 라 별도 플래그 불필요 — 새 값 있으면 교체, 없으면 옛 값 보존.
    replace_region: bool = Field(
        False,
        description=(
            "True 면 region 을 이전 값과 누적하지 않고 LLM 추출로 교체. "
            "'말고/대신/바꿔/변경/수정/취소하고' 등 명시적 교체 의도일 때 True."
        ),
    )

    @field_validator(
        "region", "product", "goal", "media_type", "assumptions", mode="before",
    )
    @classmethod
    def _none_to_empty(cls, v):
        return [] if v is None else v

    @field_validator("replace_region", mode="before")
    @classmethod
    def _none_to_false(cls, v):
        # LLM 이 null/생략 시 ValidationError 방지.
        return False if v is None else v


def _build_sys_prompt() -> str:
    catalog_str = format_catalog_for_prompt()
    return f"""당신은 한국 OOH(옥외광고) 추천 시스템의 슬롯 추출기입니다.
사용자 발화에서 6축 슬롯을 추출하세요.

[6축]
- region: 지역 키워드 list. 발화에 한국 지역명이 등장하면 **반드시** 그 단어 그대로 추가하세요.
    포함되는 것:
      · 행정구역: 서울 25개 구(강남구/마포구/...), 광역시(부산/대구/인천/대전/광주/울산/세종), 시·군(수원/성남/판교/일산/...)
      · 상권명: 강남, 성수, 홍대, 합정, 망원, 연남, 신촌, 이대, 잠실, 건대, 종로, 명동, 을지로, 시청, 광화문, 이태원, 한남, 여의도, 영등포, 목동, 압구정, 청담, 신사, 논현, 역삼, 사당, 신림, 가산 등
      · 역명: 강남역, 홍대입구역, 잠실역, 건대입구역, 신촌역, 사당역 등
    조사(에서/에/근처/일대/쪽/근방/주변/내) 무관, 지역명 토큰만 추출. 추측 금지지만 발화에 명시되면 누락 금지.
    예:
      · "홍대에서 광고하고싶어"       → region=["홍대"]
      · "강남구 매체 추천해줘"         → region=["강남구"]
      · "성수동 근처 빌보드"           → region=["성수동"], media_type=["빌보드"]
      · "여의도/마포 둘 다 보고싶어"   → region=["여의도", "마포"]
      · "판교 광고"                    → region=["판교"]
- budget: 원 단위 정수. **한국 단위 변환 표 (반드시 이대로)**:
    · '백만원' / '1백만원' = 1000000
    · '오백만원' / '500만원' = 5000000
    · '천만원' / '1천만원' = 10000000
    · '천오백만원' / '1500만원' / '1천5백만원' = 15000000
    · '삼천오백만원' / '3500만원' = 35000000
    · '오천만원' / '5천만원' = 50000000
    · '1억' / '1억원' = 100000000
    · '1억 5천만원' / '1억5천만' = 150000000
    · '5억' = 500000000
    주의: '천X백만원' 패턴은 1,X00만 (단위: 만원). 1,500,000 이 아니라 15,000,000. '천' = 1,000 곱하기.
- target: {{raw, ageGroups, gender, keywords}}
    · raw: 발화 원본
    · ageGroups: ['under_10s','20s','30s','40s','50s','60s_plus'] 중 해당하는 것
    · gender: 'male' / 'female' / 'mixed' / 'unknown'
    · keywords: 직장인, 대학생, 가족 같은 직업·라이프스타일 키워드
- product: 광고할 제품/브랜드/업종 (화장품, 스마트폰, 식음료 등)
- goal: 사용자 표현 그대로 (브랜딩, 방문 유도 등)
- goal_label: 'visit'(방문) / 'branding'(브랜딩) / 'reach'(도달) / 'conversion'(전환) 중 또는 null
- media_type: DB controlled vocabulary (아래 카탈로그)

[매체 타입 카탈로그 — controlled vocabulary]
{catalog_str}

[중요 — 매체 타입 추출 강제 룰]
- 발화에 위 카탈로그의 어떤 단어 (parent_category 또는 category) 라도 등장하면
  반드시 media_type 에 그 단어를 그대로 추가하세요. 추측이 아니라 명시적 인식입니다.
- 예: "빌보드 광고 알아봐줘" → media_type=["빌보드"] (필수)
- 예: "지하철에 광고하고 싶어" → media_type=["지하철"] (필수)
- 예: "강남역 근처 매체" → region=["강남역"], media_type=[] (역 자체는 지역)
- 정확한 단어가 아닌 동의어 표현은 가장 가까운 카탈로그 단어로 매핑 후 assumptions 에 기록.

[region 교체 vs 누적 의도 감지 — 멀티턴 핵심]
- 사용자가 **기존 region 을 명시적으로 바꾸려** 하면 replace_region=true.
- 교체 의도 표현 예: "말고", "대신", "그 대신", "...로 바꿔/변경/수정", "취소하고", "지우고", "...말고 ...로 해줘"
- 추가 의도 표현(기본 false): "추가", "또", "그리고", "도", "...도 같이"
- 모호하면 false 로 두기(보수적 누적). 단순 첫 입력이면 false.
- replace 모드일 때 region 은 **이전 턴 값을 의도적으로 버리는** 신호이므로 "옛 값"은 출력 리스트에 다시 넣지 말 것.

예:
- "홍대 말고 강남으로 해줘"         → region=["강남"], replace_region=true
- "강남도 추가해줘"                  → region=["강남"], replace_region=false
- "여의도/마포 둘 다 보고싶어"       → region=["여의도","마포"], replace_region=false
- "지역을 강남구로 바꿔줘"           → region=["강남구"], replace_region=true
- "홍대 말고 강남이랑 성수로 바꿔줘" → region=["강남","성수"], replace_region=true
- "예산 1억으로 변경"                → budget=100000000  (별도 플래그 불필요)

[기타 규칙]
- 위 카탈로그 단어 외에는 발화에 명시되지 않은 축은 빈 list / null. 추측 금지.
- target.raw 는 발화 원본 타겟 표현 그대로 (예: '20대 여성 직장인').
- assumptions: 정규화 / 추론 / 기본값 적용 시 한국어 한 줄씩 기록.
- JSON 외 텍스트 금지.
"""


_slot_llm = None
_sys_prompt: Optional[str] = None


def _get_slot_llm():
    global _slot_llm, _sys_prompt
    if _slot_llm is None:
        _slot_llm = get_chat(temperature=0.0).with_structured_output(ExtractedSlots)
        _sys_prompt = _build_sys_prompt()
    return _slot_llm, _sys_prompt


# LLM 이 replace_region=False 로 잘못 추출해도, 발화에 명시적 부정 마커가 있고
# 새 region 값이 있으면 결정적으로 교체로 본다. '말고/대신' 만 — '바꿔/변경' 은
# region 없는 경우 (예: "예산 바꿔줘") 에서 오탐 위험이라 제외.
_REGION_REPLACE_MARKERS: tuple[str, ...] = ("말고", "대신")


def _merge_list(prev: Optional[list[str]], new: Optional[list[str]]) -> list[str]:
    seen: dict[str, None] = {}
    for v in (prev or []) + (new or []):
        if v and str(v).strip():
            seen[str(v).strip()] = None
    return list(seen.keys())


def _merge_slots(
    known_slots: dict,
    extracted: ExtractedSlots,
    fallback_regions: list[str],
    last_user_text: str = "",
) -> tuple[Slots, list[str]]:
    """순수 merge — extract_slots 노드에서 분리해서 테스트 가능하게 한 헬퍼.

    region 만 replace_region (LLM) 또는 발화 마커 (말고/대신 + 새 값) 로 교체.
    budget 은 새 값 있으면 교체, 없으면 옛 값 보존. 나머지 슬롯은 기존처럼 누적.
    """
    assumptions: list[str] = []

    # region: LLM flag 또는 결정적 마커 (둘 다 새 region 값이 있을 때만 의미).
    has_new_region = bool(extracted.region)
    text_marker_replace = has_new_region and any(
        marker in last_user_text for marker in _REGION_REPLACE_MARKERS
    )
    region_replace = extracted.replace_region or text_marker_replace

    if region_replace:
        # 교체 모드: LLM 추출만 신뢰. fallback regex 는 옛 region 단어를 다시 끌어와
        # "말고 ..." 같은 표현에서 옛 값이 부활하는 회귀를 만들기 때문에 사용 안 함.
        region = _merge_list(None, list(extracted.region))
    else:
        extra_regions = [r for r in (fallback_regions or []) if r not in extracted.region]
        if extra_regions:
            assumptions.append(f"region keyword fallback: {extra_regions}")
        region = _merge_list(
            known_slots.get("region"),
            list(extracted.region) + extra_regions,
        )

    # budget: scalar — 새 값 있으면 교체, 없으면 보존.
    # vague "예산 바꿔줘" (새 값 없음) 에서 옛 값을 silently clear 하지 않도록.
    if extracted.budget is not None:
        budget: Optional[int] = int(extracted.budget)
    else:
        budget = known_slots.get("budget")

    merged: Slots = {
        "region":     region,
        "product":    _merge_list(known_slots.get("product"), extracted.product),
        "goal":       _merge_list(known_slots.get("goal"), extracted.goal),
        "media_type": _merge_list(known_slots.get("media_type"), extracted.media_type),
    }
    if budget is not None:
        merged["budget"] = budget

    new_target_dump = extracted.target.model_dump()
    has_new_target = (
        new_target_dump.get("raw")
        or new_target_dump.get("ageGroups")
        or new_target_dump.get("gender") not in ("unknown", None)
        or new_target_dump.get("keywords")
    )
    merged["target"] = new_target_dump if has_new_target else (known_slots.get("target") or new_target_dump)
    merged["goal_label"] = extracted.goal_label or known_slots.get("goal_label")

    return merged, assumptions


def extract_slots(state: RecommendState) -> dict:
    messages = state.get("messages") or []
    known_slots = dict(state.get("slots") or {})

    if not any(isinstance(m, HumanMessage) for m in messages):
        return {
            "status": "awaiting_slots",
            "assumptions": (state.get("assumptions") or []) + ["extract_slots: 사용자 메시지 없음"],
        }

    recent = messages[-8:]
    history = "\n".join(
        f'{"USER" if isinstance(m, HumanMessage) else "BOT"}: {m.content}'
        for m in recent if isinstance(m, (HumanMessage, AIMessage))
    )
    user_prompt = (
        f"[대화 이력]\n{history}\n\n"
        f"[이전 슬롯]\n{json.dumps(known_slots, ensure_ascii=False, default=str)}\n\n"
        "ExtractedSlots 스키마로 JSON 출력."
    )

    llm, sys_prompt = _get_slot_llm()
    try:
        extracted: ExtractedSlots = llm.invoke([
            SystemMessage(content=sys_prompt),
            HumanMessage(content=user_prompt),
        ])
    except Exception as exc:
        return {
            "status": "error",
            "assumptions": (state.get("assumptions") or []) + [f"extract_slots LLM 실패: {exc}"],
        }

    # LLM 이 region 을 놓치는 케이스가 잦아 발화에서 직접 화이트리스트 매칭 (안전망).
    # 마지막 사용자 메시지 기준. replace_region 모드면 _merge_slots 내부에서 fallback 미사용.
    last_user_text = next(
        (m.content for m in reversed(messages) if isinstance(m, HumanMessage)),
        "",
    )
    fallback_regions = _extract_region_keywords(last_user_text)

    merged, merge_assumptions = _merge_slots(
        known_slots, extracted, fallback_regions, last_user_text=last_user_text,
    )

    return {
        "slots": merged,
        "status": "awaiting_slots",
        "assumptions": (
            (state.get("assumptions") or [])
            + list(extracted.assumptions or [])
            + merge_assumptions
        ),
    }
