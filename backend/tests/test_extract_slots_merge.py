"""_merge_slots 회귀 테스트.

핵심 회귀 시나리오:
- 사용자가 "홍대 말고 강남으로 바꿔줘" 요청 시 region 이 누적되지 않고 ["강남"] 으로 교체.
- "강남도 추가해줘" 요청 시 region 이 ["홍대","강남"] 으로 누적.
- 예산을 명시적으로 교체할 때 옛 값이 살아남지 않음.
"""
from __future__ import annotations

from src.services.graph.nodes.extract_slots import ExtractedSlots, _merge_slots
from src.services.graph.state import TargetStruct


def _make(**kw) -> ExtractedSlots:
    """기본 빈 ExtractedSlots 위에 kw 덮어쓰기."""
    base = dict(
        region=[],
        budget=None,
        target=TargetStruct(),
        product=[],
        goal=[],
        goal_label=None,
        media_type=[],
        assumptions=[],
        replace_region=False,
    )
    base.update(kw)
    return ExtractedSlots(**base)


# ---------- region: 기본(누적) 동작 ----------

def test_region_first_turn_uses_extracted():
    extracted = _make(region=["홍대"])
    merged, _ = _merge_slots({}, extracted, fallback_regions=[])
    assert merged["region"] == ["홍대"]


def test_region_default_accumulates_across_turns():
    known = {"region": ["홍대"]}
    extracted = _make(region=["강남"])  # replace_region 기본 False
    merged, _ = _merge_slots(known, extracted, fallback_regions=[])
    assert merged["region"] == ["홍대", "강남"]


def test_region_default_dedupes_when_same():
    known = {"region": ["홍대"]}
    extracted = _make(region=["홍대"])
    merged, _ = _merge_slots(known, extracted, fallback_regions=[])
    assert merged["region"] == ["홍대"]


def test_region_fallback_only_applied_in_accumulate_mode():
    known = {"region": []}
    extracted = _make(region=[])  # LLM 누락
    merged, assumptions = _merge_slots(known, extracted, fallback_regions=["판교"])
    assert merged["region"] == ["판교"]
    assert any("fallback" in a for a in assumptions)


# ---------- region: replace 모드 ----------

def test_region_replace_replaces_previous():
    """핵심 회귀: '홍대 말고 강남으로 바꿔줘' 시나리오."""
    known = {"region": ["홍대"]}
    extracted = _make(region=["강남"], replace_region=True)
    merged, _ = _merge_slots(known, extracted, fallback_regions=[])
    assert merged["region"] == ["강남"]


def test_region_replace_ignores_fallback_for_old_value():
    """'홍대 말고 강남으로 바꿔줘' — fallback regex 가 홍대를 다시 끌어와도 무시."""
    known = {"region": ["홍대"]}
    extracted = _make(region=["강남"], replace_region=True)
    # 사용자 발화에 '홍대' 와 '강남' 둘 다 등장 → fallback 이 두 단어 모두 반환.
    merged, assumptions = _merge_slots(
        known, extracted, fallback_regions=["홍대", "강남"],
    )
    assert merged["region"] == ["강남"]
    # replace 모드에서는 fallback assumption 도 추가되면 안 됨.
    assert not any("fallback" in a for a in assumptions)


def test_region_replace_with_empty_clears():
    """replace_region=true 인데 LLM 이 새 region 을 못 뽑은 경우 (예: '지역 바꿔줘')."""
    known = {"region": ["홍대"]}
    extracted = _make(region=[], replace_region=True)
    merged, _ = _merge_slots(known, extracted, fallback_regions=[])
    assert merged["region"] == []


def test_region_replace_supports_multiple_new_regions():
    known = {"region": ["홍대"]}
    extracted = _make(region=["강남", "성수"], replace_region=True)
    merged, _ = _merge_slots(known, extracted, fallback_regions=[])
    assert merged["region"] == ["강남", "성수"]


# ---------- region: 결정적 마커 안전망 (LLM flag 누락 보완) ----------

def test_region_replace_marker_replaces_even_when_llm_flag_false():
    """LLM 이 replace_region=False 로 잘못 추출해도 발화 마커로 결정적 교체."""
    known = {"region": ["홍대"]}
    extracted = _make(region=["강남"], replace_region=False)
    merged, assumptions = _merge_slots(
        known, extracted,
        fallback_regions=["홍대", "강남"],
        last_user_text="홍대 말고 강남으로 바꿔줘",
    )
    assert merged["region"] == ["강남"]
    # replace 모드에서는 fallback assumption 도 추가되면 안 됨.
    assert not any("fallback" in a for a in assumptions)


def test_region_marker_with_connector_still_replaces():
    """'홍대 말고 강남이랑 성수로' — 말고가 우선이라 다중 새 값으로 교체."""
    known = {"region": ["홍대"]}
    extracted = _make(region=["강남", "성수"], replace_region=False)
    merged, _ = _merge_slots(
        known, extracted,
        fallback_regions=["홍대", "강남", "성수"],
        last_user_text="홍대 말고 강남이랑 성수로 바꿔줘",
    )
    assert merged["region"] == ["강남", "성수"]


def test_region_no_new_value_marker_does_not_force_replace():
    """'예산 바꿔줘' 처럼 region 새 값 없으면 마커 있어도 region 영향 없음."""
    known = {"region": ["홍대"]}
    extracted = _make(region=[], replace_region=False)
    merged, _ = _merge_slots(
        known, extracted,
        fallback_regions=[],
        last_user_text="예산 바꿔줘",
    )
    assert merged["region"] == ["홍대"]


def test_region_add_marker_accumulates():
    """'강남도 추가해줘' — 마커 없으니 누적."""
    known = {"region": ["홍대"]}
    extracted = _make(region=["강남"], replace_region=False)
    merged, _ = _merge_slots(
        known, extracted,
        fallback_regions=["강남"],
        last_user_text="강남도 추가해줘",
    )
    assert merged["region"] == ["홍대", "강남"]


# ---------- budget ----------

def test_budget_first_turn_sets_value():
    extracted = _make(budget=50000000)
    merged, _ = _merge_slots({}, extracted, fallback_regions=[])
    assert merged["budget"] == 50000000


def test_budget_extracted_value_replaces_prev_by_default():
    """budget 은 단일값이라 새 값이 추출되면 기본도 교체 동작 (기존 로직 보존)."""
    known = {"budget": 50000000}
    extracted = _make(budget=100000000)
    merged, _ = _merge_slots(known, extracted, fallback_regions=[])
    assert merged["budget"] == 100000000


def test_budget_keeps_prev_when_not_extracted_and_no_replace_flag():
    known = {"budget": 50000000}
    extracted = _make(budget=None)
    merged, _ = _merge_slots(known, extracted, fallback_regions=[])
    assert merged["budget"] == 50000000


def test_budget_new_value_replaces_prev():
    """'예산 1억으로 변경' 시나리오 — 새 값 있으면 교체."""
    known = {"budget": 50000000}
    extracted = _make(budget=100000000)
    merged, _ = _merge_slots(known, extracted, fallback_regions=[])
    assert merged["budget"] == 100000000


def test_budget_vague_change_preserves_value():
    """'예산 바꿔줘' (새 값 없음) → 옛값 유지 (silently clear 금지)."""
    known = {"budget": 50000000}
    extracted = _make(budget=None)
    merged, _ = _merge_slots(
        known, extracted,
        fallback_regions=[],
        last_user_text="예산 바꿔줘",
    )
    assert merged["budget"] == 50000000


# ---------- 다른 슬롯들은 영향 없음 ----------

def test_other_slots_still_accumulate():
    """replace_region 만 region 에 영향. product/goal/media_type 은 기존처럼 누적."""
    known = {
        "region": ["홍대"],
        "product": ["화장품"],
        "goal": ["브랜딩"],
        "media_type": ["빌보드"],
    }
    extracted = _make(
        region=["강남"],
        replace_region=True,  # region 만 교체
        product=["스마트폰"],
        goal=["방문 유도"],
        media_type=["지하철"],
    )
    merged, _ = _merge_slots(known, extracted, fallback_regions=[])
    assert merged["region"] == ["강남"]
    assert merged["product"] == ["화장품", "스마트폰"]
    assert merged["goal"] == ["브랜딩", "방문 유도"]
    assert merged["media_type"] == ["빌보드", "지하철"]


def test_target_preserved_when_new_empty():
    """target raw/age/keywords/gender 없으면 이전 target 유지 (기존 로직 보존)."""
    known_target = {
        "raw": "20대 직장인",
        "ageGroups": ["20s"],
        "gender": "unknown",
        "keywords": ["직장인"],
    }
    known = {"target": known_target}
    extracted = _make()  # 빈 target
    merged, _ = _merge_slots(known, extracted, fallback_regions=[])
    assert merged["target"] == known_target


def test_goal_label_replaced_only_when_new_provided():
    known = {"goal_label": "branding"}
    # 새 goal_label 없음 → 이전 유지
    merged, _ = _merge_slots(known, _make(), fallback_regions=[])
    assert merged["goal_label"] == "branding"
    # 새 goal_label 있음 → 교체
    merged2, _ = _merge_slots(known, _make(goal_label="visit"), fallback_regions=[])
    assert merged2["goal_label"] == "visit"
