"""Stage 1 — db_filter_final 통과 후 첫 추천 + 인터뷰 안내.

매체 list 는 가격순 Top-N 으로 슬라이스. assistant_message 는 빠진 슬롯 우선순위에 따라:
- STRONG (budget/region/media_type) 빠짐 → 명확한 질문 (필터를 더 좁힐 수 있음)
- WEAK (target/product) 빠짐 → 끝에 "있으시면 더 정확하게" 보조 안내

여기서 END. Stage 2 (rerank+explain) 는 다음 turn 에 사용자 답변 받은 후 진입.
"""
from __future__ import annotations

from langchain_core.messages import AIMessage

from src.services.graph.settings import (
    INITIAL_LIST_LIMIT,
    INTERVIEW_STRONG_SLOTS,
    INTERVIEW_WEAK_SLOTS,
)
from src.services.graph.state import RecommendState


STRONG_QUESTIONS = {
    "budget":     "예산은 얼마 정도 생각하고 계세요?",
    "region":     "어느 지역에서 광고하시려고 하나요? (예: 강남, 성수, 홍대)",
    "media_type": "선호하는 매체 타입이 있으세요? (예: 빌보드, 지하철, 쇼핑몰)",
}
WEAK_LABELS = {
    "target":  "타겟 (예: 20대 여성 직장인)",
    "product": "상품/업종 (예: 화장품, 식음료)",
}


def _target_has_content(target) -> bool:
    """target.raw 만 채워진 케이스는 부족하다고 판단. ageGroups/gender/keywords 중 하나 이상이어야 의미 있는 타겟."""
    if not isinstance(target, dict):
        return False
    if target.get("ageGroups"):
        return True
    if target.get("gender") and target.get("gender") != "unknown":
        return True
    if target.get("keywords"):
        return True
    return False


def _slot_filled(slots: dict, key: str) -> bool:
    v = slots.get(key)
    if key == "target":
        return _target_has_content(v)
    if isinstance(v, list):
        return len(v) > 0
    if isinstance(v, int):
        return v > 0
    return bool(v)


def has_refinement_slots(state: RecommendState) -> bool:
    """Stage 2 (rerank+explain) 진입 조건: target struct + product 둘 다 의미 있어야 함."""
    slots = state.get("slots") or {}
    return _target_has_content(slots.get("target")) and bool(slots.get("product"))


def present_initial_list(state: RecommendState) -> dict:
    matched = state.get("matched_media") or []
    top = matched[:INITIAL_LIST_LIMIT]
    slots = state.get("slots") or {}

    missing_strong = [s for s in INTERVIEW_STRONG_SLOTS if not _slot_filled(slots, s)]
    missing_weak = [s for s in INTERVIEW_WEAK_SLOTS if not _slot_filled(slots, s)]

    parts: list[str] = []
    parts.append(f"우선 가격대로 정렬한 매체 {len(top)}건을 보여드릴게요.")

    if missing_strong:
        # 빠진 STRONG 슬롯마다 개별 질문 단락으로.
        for s in missing_strong:
            if s in STRONG_QUESTIONS:
                parts.append(STRONG_QUESTIONS[s])

    if missing_weak:
        labels = [WEAK_LABELS[s] for s in missing_weak if s in WEAK_LABELS]
        if labels:
            parts.append(
                f"{' / '.join(labels)} 도 알려주시면 더 정확하게 추천드릴 수 있어요."
            )

    if not missing_strong and not missing_weak:
        # 모든 슬롯 차 있는데 이 노드 들어왔다면 stage 분기 버그. fallback 안내.
        parts.append("이어서 정밀 추천을 진행할까요?")

    # 각 단락을 빈 줄로 분리 → 프런트의 whitespace-pre-line 으로 줄바꿈 렌더.
    ask = "\n\n".join(parts)
    return {
        "matched_media": top,
        "matched_count": len(top),
        "messages": [AIMessage(content=ask)],
        "status": "stage1_done",
    }
