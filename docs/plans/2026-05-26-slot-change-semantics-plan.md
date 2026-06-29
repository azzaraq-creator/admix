# Slot Change Semantics Implementation Plan

> **For Hermes:** Use Claude Code plan review before implementation. Do not commit or push without explicit user approval.

**Goal:** Make multi-turn slot updates distinguish between “replace existing condition” and “add another condition,” especially for `region` and `budget`.

**Architecture:** Keep the fix surgical inside slot extraction/merge. Preserve existing cumulative behavior for normal first-turn extraction and explicit “also/add” requests, but replace old `region`/`budget` when the user clearly says “말고/대신/바꿔/변경/수정”. Use deterministic heuristics as a safety net around the LLM so common Korean change phrases do not depend entirely on model judgment.

**Tech Stack:** FastAPI backend, LangGraph state, LangChain messages, Pydantic structured output, pytest.

---

## Current State

### Relevant files

- `backend/src/services/graph/nodes/extract_slots.py`
  - Builds `ExtractedSlots` structured output schema.
  - Sends recent chat history and previous slots to the slot LLM.
  - Uses `_extract_region_keywords()` as a region fallback regex.
  - Merges previous slots with extracted slots.
- `backend/src/services/graph/state.py`
  - Defines persisted `Slots` shape.
- `backend/tests/test_extract_slots_merge.py`
  - Currently exists in the working tree from an experimental implementation attempt.

### Current root cause

The original merge behavior used `_merge_list(prev, new)` for `region`:

```py
def _merge_list(prev: Optional[list[str]], new: Optional[list[str]]) -> list[str]:
    seen: dict[str, None] = {}
    for v in (prev or []) + (new or []):
        if v and str(v).strip():
            seen[str(v).strip()] = None
    return list(seen.keys())
```

That is correct for explicit add/multi-region cases, but wrong for replace requests:

- Previous: `region=["홍대"]`
- User: `홍대 말고 강남으로 바꿔줘`
- Expected: `region=["강남"]`
- Original risk: `region=["홍대", "강남"]`

A second issue is fallback region extraction:

```py
fallback_regions = _extract_region_keywords(last_user_text)
```

For `홍대 말고 강남`, fallback can find both `홍대` and `강남`, so old values can re-enter even if the LLM extracted only the new region.

### Experimental working-tree change already present

The working tree currently includes an experimental change that adds:

```py
replace_region: bool
replace_budget: bool
```

and a `_merge_slots()` helper. Keep this diff for reference, but do not treat it as final until reviewed.

Observed strengths:

- Separates merge logic into a testable helper.
- Lets `replace_region=True` avoid fallback region resurrection.
- Adds regression tests for replace vs accumulate behavior.

Observed risks:

- It relies mostly on LLM-generated `replace_region` / `replace_budget` flags.
- It does not yet include deterministic intent detection from the last user utterance.
- `replace_budget=True` with `budget=None` currently clears budget, which is too aggressive for vague input like “예산 바꿔줘” without a new amount.
- Existing test `test_budget_replace_with_none_clears` reflects the experimental clear behavior and must be intentionally replaced with a preserve test if this plan is implemented.
- Test execution was done in a local backend `.venv`; Docker/runtime verification is still required before final acceptance.

---

## Desired Behavior

### Region

1. First mention sets region.
   - User: `홍대에서 광고하고 싶어`
   - Result: `region=["홍대"]`

2. Explicit add accumulates.
   - Previous: `region=["홍대"]`
   - User: `강남도 추가해줘`
   - Result: `region=["홍대", "강남"]`

3. Explicit replace replaces.
   - Previous: `region=["홍대"]`
   - User: `홍대 말고 강남으로 바꿔줘`
   - Result: `region=["강남"]`

4. Multiple new regions can be used when user clearly asks for multiple regions.
   - Previous: `region=["홍대"]`
   - User: `지역을 여의도랑 마포로 바꿔줘`
   - Result: `region=["여의도", "마포"]`

5. Replace mode must not re-add old region via regex fallback.
   - Previous: `region=["홍대"]`
   - User: `홍대 말고 강남`
   - Fallback may see `홍대`, `강남`; final should still be `region=["강남"]`.

### Budget

1. First mention sets budget.
   - User: `예산은 5천만원`
   - Result: `budget=50000000`

2. New explicit amount replaces previous budget.
   - Previous: `budget=50000000`
   - User: `1억으로 바꿔줘`
   - Result: `budget=100000000`

3. Vague budget-change request should not clear budget unless there is a clear product decision to support clearing.
   - Previous: `budget=50000000`
   - User: `예산 바꿀래`
   - Recommended result: keep `budget=50000000` and ask for new budget, rather than silently clearing.

---

## Recommended Design

### Principle

Use two signals:

1. LLM structured output fields:
   - `replace_region`
   - `replace_budget`
2. Deterministic heuristic from the latest user utterance:
   - Korean replace markers: `말고`, `대신`, `바꿔`, `바꿔줘`, `변경`, `수정`, `취소하고`, `지우고`, `빼고`
   - Korean add markers for region only: `추가`, `또`, `그리고`, `도`, `같이`, `랑`, `하고`

The deterministic signal should only force replace when:

- a replace marker is present, and
- a new value for that slot was extracted or detected.

Slot-specific notes:

- `region` has both replace and add/multi-value semantics. Handle marker conflicts carefully: a phrase like `홍대 말고 강남이랑 성수로` contains both replace (`말고`) and add-ish (`랑`) markers, but should still replace the old region with the new multi-region list.
- `budget` is scalar and has no meaningful “add another budget” behavior. If a new budget is extracted, use it. If no new budget is extracted, preserve the old budget and ask/continue rather than silently clearing it.
- One-character add markers such as `도` can produce substring false positives. For now, false positives should bias toward preserve/accumulate rather than destructive replace; only strengthen with regex boundaries if tests show a real issue.

### Suggested helper shape

```py
_REPLACE_MARKERS = ("말고", "대신", "바꿔", "변경", "수정", "취소하고", "지우고", "빼고")
_ADD_MARKERS = ("추가", "또", "그리고", "도", "같이", "랑", "하고")


def _has_any(text: str, markers: tuple[str, ...]) -> bool:
    return any(marker in text for marker in markers)


def _should_replace_region(
    text: str,
    llm_replace: bool,
    has_new_value: bool,
) -> bool:
    if not has_new_value:
        return False
    if llm_replace:
        return True
    if not _has_any(text, _REPLACE_MARKERS):
        return False
    # Replace markers win over add-ish connectors when the sentence explicitly
    # contrasts old vs new values, e.g. "홍대 말고 강남이랑 성수로".
    if "말고" in text or "대신" in text:
        return True
    return not _has_any(text, _ADD_MARKERS)


def _should_replace_budget(
    text: str,
    llm_replace: bool,
    has_new_value: bool,
) -> bool:
    if not has_new_value:
        return False
    return llm_replace or _has_any(text, _REPLACE_MARKERS)
```

Note: Korean `도` is ambiguous. Keep the heuristic conservative and cover the important phrases with tests before broadening it.

### Merge helper responsibilities

Extract a pure helper to test without invoking the LLM:

```py
def _merge_slots(
    known_slots: dict,
    extracted: ExtractedSlots,
    fallback_regions: list[str],
    last_user_text: str = "",
) -> tuple[Slots, list[str]]:
    ...
```

Use a default `last_user_text=""` so existing tests and any internal helper calls can be migrated incrementally.

Rules:

- `region_replace = _should_replace_region(last_user_text, extracted.replace_region, bool(extracted.region))`
- If `region_replace`:
  - final region = deduped `extracted.region`
  - ignore fallback regions to prevent old region resurrection
- Else:
  - final region = previous region + extracted region + fallback regions
- Budget:
  - if `extracted.budget is not None`: use new budget
  - else keep known budget
  - do not clear budget only because `replace_budget=True` if there is no new amount, unless product explicitly wants budget removal semantics later
- Other list slots stay cumulative for now: `product`, `goal`, `media_type`
- Preserve target and goal label behavior unless tests show a regression.

---

## Implementation Tasks

### Task 1: Keep the merge helper but add deterministic intent input

**Objective:** Make merge behavior testable and not entirely dependent on LLM flags.

**Files:**

- Modify: `backend/src/services/graph/nodes/extract_slots.py`
- Test: `backend/tests/test_extract_slots_merge.py`

**Steps:**

1. Update `_merge_slots()` signature to accept `last_user_text`.
2. Add small marker helpers near `_merge_list()`.
3. Derive `region_replace` using LLM flag plus deterministic heuristic.
4. Pass `last_user_text` from `extract_slots()` into `_merge_slots()`.
5. Keep the new `last_user_text` parameter defaulted to `""` so existing tests can be updated gradually.

**Verification:**

Run targeted tests after Task 2 is complete.

### Task 2: Adjust budget replace semantics to avoid silent clearing

**Objective:** Avoid removing a known budget when the user says a vague budget-change phrase without a new amount.

**Files:**

- Modify: `backend/src/services/graph/nodes/extract_slots.py`
- Test: `backend/tests/test_extract_slots_merge.py`

**Steps:**

1. If `extracted.budget is not None`, set budget to the extracted value.
2. If `extracted.budget is None`, preserve existing budget.
3. Do not clear budget based solely on `replace_budget=True`.
4. Replace the experimental test `test_budget_replace_with_none_clears` with a preserve test.
5. Add a future TODO comment only if needed; do not implement a budget-clear UX now.

**Verification:**

- `test_budget_replace_with_value_overrides_prev` passes.
- Add/adjust a test: vague budget change preserves previous value.

### Task 3: Add regression tests for deterministic region replacement

**Objective:** Prove common Korean replace phrases work even if the LLM flag is false.

**Files:**

- Modify: `backend/tests/test_extract_slots_merge.py`

**Tests to include:**

```py
def test_region_replace_marker_replaces_even_when_llm_flag_false():
    known = {"region": ["홍대"]}
    extracted = _make(region=["강남"], replace_region=False)
    merged, assumptions = _merge_slots(
        known,
        extracted,
        fallback_regions=["홍대", "강남"],
        last_user_text="홍대 말고 강남으로 바꿔줘",
    )
    assert merged["region"] == ["강남"]
    assert not any("fallback" in a for a in assumptions)
```

Also keep/add:

- `강남도 추가해줘` accumulates.
- `여의도/마포 둘 다 보고싶어` keeps both new regions.
- `홍대 말고 강남이랑 성수로 바꿔줘` replaces old `홍대` with `강남, 성수` even though the phrase contains both replace and connector markers.
- Same-region dedupe still works.

### Task 4: Run tests in the correct runtime

**Objective:** Verify the implementation in the app runtime, not an unrelated Hermes Python environment.

**Commands:**

Prefer Docker if the running backend container has the repo mounted:

```bash
docker exec -w /app ooh-backend python -m pytest tests/test_extract_slots_merge.py -q
```

If Docker image does not include the new local test file because the app was copied at image build time, rebuild backend first:

```bash
docker compose build backend
docker compose up -d backend
docker exec -w /app ooh-backend python -m pytest tests/test_extract_slots_merge.py -q
```

Then run existing checkpoint cleanup test too:

```bash
docker exec -w /app ooh-backend python -m pytest tests/test_checkpoint_cleanup.py tests/test_extract_slots_merge.py -q
```

**Expected:** all targeted tests pass.

### Task 5: Optional manual smoke

**Objective:** Confirm behavior through the real chat endpoint if the local backend is healthy and test data/API keys are available.

**Scenario:**

1. Start a session.
2. Send: `홍대에서 빌보드 광고 5천만원 예산으로 추천해줘`
3. Send: `홍대 말고 강남으로 바꿔줘`
4. Confirm streamed payload/current chips show only `강남`, not `홍대, 강남`.
5. Send: `성수도 추가해줘`
6. Confirm region becomes `강남, 성수`.

**Do not block the implementation on this if API keys or local data are unavailable. The merge tests are the minimal required verification.**

---

## Non-goals

- Do not refactor graph routing.
- Do not change DB filter SQL.
- Do not change frontend chip rendering unless backend payload is correct but UI still displays stale payload.
- Do not touch checkpoint cleanup files.
- Do not alter deployment files.
- Do not commit or push.

---

## Open Questions for Claude Plan Review

1. Is `replace_region` / `replace_budget` in `ExtractedSlots` a good schema-level approach, or should replacement intent be computed entirely outside the LLM?
2. Should `_should_replace_slot()` treat `도` as an add marker always, or only when attached to a new slot value?
3. Should vague `replace_budget=True, budget=None` preserve or clear old budget? This plan recommends preserve.
4. Are there hidden downstream assumptions that `region` is always cumulative?
5. Is there a better minimal test seam than exposing `_merge_slots()` as a private helper?

---

## Acceptance Criteria

- `홍대 말고 강남으로 바꿔줘` results in `region=["강남"]`.
- `강남도 추가해줘` from `region=["홍대"]` results in `region=["홍대", "강남"]`.
- Fallback regex does not re-add old region in replace mode.
- New budget value replaces previous budget.
- Vague budget change without a new amount does not silently clear the budget.
- Targeted pytest tests pass in the backend runtime.
