# Slot Change Semantics — Final Plan (2026-05-27)

> Claude Code + Codex 합의안. 2026-05-26 플랜의 후속이며 이 문서가 SoT.
> 커밋/푸시 금지 — 사용자 지시 시에만.

## Goal

멀티턴에서 `region`/`budget` 교체 요청 (`홍대 말고 강남으로 바꿔줘`)이 누적 모드 (`강남도 추가해줘`)와 구분되도록 한다. 변경 범위는 **region/budget에만** 한정한다.

## 핵심 결정 (Codex 리뷰 반영)

2026-05-26 플랜 대비 단순화한 부분:

| 항목 | 2026-05-26 플랜 | 최종 (2026-05-27) | 이유 |
|---|---|---|---|
| `replace_budget` LLM 필드 | 유지 + preserve 의미로 변경 | **제거** | budget은 scalar. 새 값 있음/없음으로 충분 |
| 결정적 마커 helper | `_should_replace_region` + add/replace 우선순위 | **region 전용 1줄 보정**, `말고/대신`만 | 범용 helper는 과한 일반화 |
| add marker 목록 | `추가/또/그리고/도/같이/랑/하고` | **사용 안 함** | `랑/하고`는 다중 새 값 연결어 — 오탐 |
| product/target/media_type 교체 | 언급 안 함 | **명시적 non-goal** | 범위 외 |
| budget=None + replace_budget | preserve | **`replace_budget` 자체 삭제 → 항상 preserve** | 더 단순 |

## Desired Behavior

### Region
| Previous | User | Result |
|---|---|---|
| `[]` | `홍대에서 광고` | `["홍대"]` |
| `["홍대"]` | `강남도 추가` | `["홍대", "강남"]` |
| `["홍대"]` | `홍대 말고 강남으로 바꿔줘` | `["강남"]` |
| `["홍대"]` | `지역을 여의도랑 마포로 바꿔줘` | `["여의도", "마포"]` |
| `["홍대"]` | `홍대 말고 강남이랑 성수로` | `["강남", "성수"]` |
| `["홍대"]` | `홍대 말고 강남` (regex fallback 발견 `["홍대","강남"]`) | `["강남"]` |

### Budget
| Previous | User | Result |
|---|---|---|
| `None` | `예산 5천만원` | `50000000` |
| `50000000` | `1억으로 바꿔줘` | `100000000` |
| `50000000` | `예산 바꿀래` (새 값 없음) | `50000000` (preserve) |

---

## Design

### 스키마 변경

```python
class ExtractedSlots(BaseModel):
    # ... 기존 필드 ...
    replace_region: bool = False  # 유지
    # replace_budget: 제거
```

`replace_budget`은 제거. budget 머지 로직은:
- `extracted.budget is not None` → 새 값 사용 (교체)
- `else` → `known_slots.get("budget")` 보존

### 결정적 안전망 (region 전용)

```python
_REGION_REPLACE_MARKERS = ("말고", "대신")

def _merge_slots(
    known_slots: dict,
    extracted: ExtractedSlots,
    fallback_regions: list[str],
    last_user_text: str = "",
) -> tuple[Slots, list[str]]:
    # region replace 결정: LLM flag OR 결정적 마커
    has_new_region = bool(extracted.region)
    text_marker_replace = has_new_region and any(
        m in last_user_text for m in _REGION_REPLACE_MARKERS
    )
    region_replace = extracted.replace_region or text_marker_replace
    ...
```

**왜 `말고/대신`만:**
- `바꿔/변경/수정`은 LLM이 잘 잡고, 결정적으로 매칭하면 `예산 바꿔줘`처럼 region 새 값이 없는 경우에도 오탐 위험.
- `말고/대신`은 한국어에서 거의 항상 “이전 값 부정 + 새 값 제시” 의미이며, `has_new_region` 가드로 안전.
- `랑/하고`는 add marker로 보면 `강남이랑 성수로 바꿔` 같은 다중 새 값 케이스에서 오탐 → **add marker 미사용**.

### 시그니처 변경
`_merge_slots()`에 `last_user_text: str = ""` 추가 (기존 호출부 호환).

### Non-goals (명시)
- `product` 교체 (`화장품 말고 식음료`)
- `target` 교체 (`20대 말고 직장인`)
- `media_type` 교체 (`빌보드 말고 지하철`)
- `goal` 교체
- 위는 현재 모두 누적 동작. 같은 마커 기반 솔루션이 필요하지만 이번 PR 범위 밖. 필요 시 후속 작업.

---

## Implementation Tasks

### Task 1: `replace_budget` 필드 제거
**File:** `backend/src/services/graph/nodes/extract_slots.py`
- `ExtractedSlots.replace_budget` 필드 삭제
- `_none_to_false` validator에서 `"replace_budget"` 제거
- 시스템 프롬프트의 `replace_budget` 관련 예시/룰 제거 (region 교체만 남김)
- `_merge_slots()`의 budget 로직 단순화:
  ```python
  if extracted.budget is not None:
      budget = int(extracted.budget)
  else:
      budget = known_slots.get("budget")
  ```

### Task 2: 결정적 region replace 마커 추가
**File:** `backend/src/services/graph/nodes/extract_slots.py`
- 모듈 상수 `_REGION_REPLACE_MARKERS = ("말고", "대신")`
- `_merge_slots()` 시그니처에 `last_user_text: str = ""` 추가
- `region_replace` 결정 로직: `extracted.replace_region or (has_new_region AND marker in text)`
- `extract_slots()` 호출부에서 `last_user_text` 전달

### Task 3: 시스템 프롬프트 정리
**File:** `backend/src/services/graph/nodes/extract_slots.py`
- `[교체 vs 누적 의도 감지]` 섹션에서 `replace_budget` 관련 4줄 제거
- region 예시는 유지

### Task 4: 테스트 갱신
**File:** `backend/tests/test_extract_slots_merge.py`

**제거:**
- `test_budget_replace_with_none_clears` — `replace_budget` 제거로 무의미

**수정 (`_make` helper):**
- `replace_budget=False` 인자 제거

**기존 유지:**
- region 누적/dedupe/replace 시나리오 7개
- budget first/replace/preserve 시나리오 3개
- target/goal_label 동작 2개

**추가:**
```python
def test_region_replace_marker_replaces_even_when_llm_flag_false():
    known = {"region": ["홍대"]}
    extracted = _make(region=["강남"], replace_region=False)
    merged, assumptions = _merge_slots(
        known, extracted,
        fallback_regions=["홍대", "강남"],
        last_user_text="홍대 말고 강남으로 바꿔줘",
    )
    assert merged["region"] == ["강남"]
    assert not any("fallback" in a for a in assumptions)


def test_region_marker_with_connector_still_replaces():
    """'홍대 말고 강남이랑 성수로' — 말고가 랑보다 우선."""
    known = {"region": ["홍대"]}
    extracted = _make(region=["강남", "성수"], replace_region=False)
    merged, _ = _merge_slots(
        known, extracted,
        fallback_regions=["홍대", "강남", "성수"],
        last_user_text="홍대 말고 강남이랑 성수로 바꿔줘",
    )
    assert merged["region"] == ["강남", "성수"]


def test_region_no_marker_no_new_value_does_not_force_replace():
    """'예산 바꿔줘' 같은 발화에서 region 영향 없음."""
    known = {"region": ["홍대"]}
    extracted = _make(region=[], replace_region=False)
    merged, _ = _merge_slots(
        known, extracted,
        fallback_regions=[],
        last_user_text="예산 바꿔줘",
    )
    assert merged["region"] == ["홍대"]


def test_budget_vague_change_preserves_value():
    """'예산 바꿔줘' (새 값 없음) → 옛값 유지."""
    known = {"budget": 50000000}
    extracted = _make(budget=None)
    merged, _ = _merge_slots({**known}, extracted, fallback_regions=[])
    assert merged["budget"] == 50000000
```

### Task 5: Docker 런타임에서 검증
```bash
docker compose build backend
docker compose up -d backend
docker exec -w /app ooh-backend python -m pytest tests/test_extract_slots_merge.py -q
```

**Pass 기준:** 모든 테스트 PASS. 기존 `test_checkpoint_cleanup.py`도 영향 없는지 같이 실행.

```bash
docker exec -w /app ooh-backend python -m pytest tests/test_extract_slots_merge.py tests/test_checkpoint_cleanup.py -q
```

### Task 6 (Optional): 수동 스모크
백엔드 정상 작동 + API 키 있을 때만:
1. `홍대에서 빌보드 광고 5천만원 예산으로 추천해줘`
2. `홍대 말고 강남으로 바꿔줘` → chips: `강남`만
3. `성수도 추가해줘` → chips: `강남, 성수`
4. `예산 바꿔줘` → budget chip `5천만원` 유지

키 없으면 스킵 (테스트가 minimal 검증).

---

## Acceptance Criteria

- `홍대 말고 강남으로 바꿔줘` → `region=["강남"]` ✓
- `강남도 추가해줘` from `["홍대"]` → `["홍대", "강남"]` ✓
- Replace 모드에서 fallback regex가 옛 region을 다시 끌어오지 않음 ✓
- LLM이 `replace_region=False`로 잘못 추출해도, `말고/대신` 마커가 있으면 결정적으로 교체 ✓
- 새 budget 추출 시 옛 값 교체 ✓
- vague budget change (`예산 바꿔줘`)는 옛 값 보존 ✓
- Docker 런타임 pytest 통과 ✓
- product/target/media_type/goal은 기존 누적 동작 유지 (회귀 없음) ✓

---

## Non-goals (명시)

- `product/target/media_type/goal` 교체 의미 — 후속 PR
- 그래프 라우팅, DB filter SQL, 프론트엔드 chip 렌더링 변경
- checkpoint cleanup, 배포 파일 변경
- 커밋/푸시 (사용자 지시 시에만)

---

## Karpathy 원칙 자가 점검

- **Simplicity First**: `replace_budget` 제거, `_should_replace_slot` 같은 범용 helper 안 만듦, add marker 목록 제거. region 결정 로직은 한 줄 표현식.
- **Surgical Changes**: 변경 파일 2개 (`extract_slots.py`, `test_extract_slots_merge.py`). 다른 노드/SQL/프론트 무관.
- **Goal-Driven**: 위 Acceptance Criteria 6개가 검증 기준. 모든 테스트 통과 = 작업 완료.
- **Think Before Coding**: budget을 `None` 했을 때 옛값을 silently clear 하면 추천 결과가 갑자기 늘어나는 사용자 경험 위험 → preserve가 안전. region replace는 fallback regex 구조적 문제 보정.
