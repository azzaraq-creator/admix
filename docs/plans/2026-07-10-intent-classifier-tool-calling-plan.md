# 챗봇 의도 분류기 + Tool Calling 라우터 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** V2 챗봇 `_event_stream`의 발화 분기를 통일된 앞단 의도 분류기(Stage 1) + `.bind_tools()` 라우터(Stage 2)로 교체하되 기존 실행 핸들러는 전부 재사용한다.

**Architecture:** `_event_stream`의 pending 상태 처리(제안서 pending·충돌 yes/no)는 그대로 두고, 그 뒤의 3-프로브 캐스케이드(`_has_proposal_hint`+`_resolve_proposal_intent` → `_resolve_media_question` → `extract_keywords`)를 `classify_intent()`(1콜) → 라벨별 라우팅으로 교체. PROPOSAL/EXPLAIN은 새 `bind_tools` 리졸버로 판정하고 기존 핸들러 본문(제안서 CRUD·매체설명)을 그대로 호출한다. RECOMMEND는 기존 `extract_keywords` 유지, GENERAL은 하이브리드 웰컴.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy, LangChain(`langchain_openai.ChatOpenAI`), pytest(실 postgres + LLM monkeypatch).

**설계 근거:** [스펙 문서](2026-07-10-intent-classifier-tool-calling.md).

> **RECOMMEND의 tool 방식에 대한 결정(플랜 리뷰용 메모):** `extract_keywords`는 이미 `.with_structured_output()`을 쓰는데, LangChain의 structured_output은 **내부적으로 OpenAI function/tool calling**으로 동작한다. 따라서 RECOMMEND는 `extract_keywords`를 그대로 두어 복잡한 카탈로그 프롬프트의 회귀를 피한다(YAGNI·surgical). 명시적 `bind_tools`의 실질 가치(다중 tool 선택)는 PROPOSAL(create/add/rename 3택)과 EXPLAIN에 집중 적용한다. RECOMMEND도 명시적 bind_tools를 원하면 얇은 래퍼 한 겹으로 추가 가능 — 필요 시 Task 2에 옵션 추가.

---

## 파일 구조

| 파일 | 책임 | 신규/수정 |
|---|---|---|
| `backend/src/services/graph/tools.py` | bind_tools 툴 스키마(ExplainMedia/CreateProposal/AddMedia/RenameProposal) + 순수 파서 + LLM 리졸버 | 신규 |
| `backend/src/services/graph/intent_classifier.py` | `Intent` 모델 + `classify_intent()` (Stage 1, 실패 시 RECOMMEND 폴백) | 신규 |
| `backend/src/services/graph/welcome.py` | GENERAL 하이브리드 웰컴 생성 + 캔드 폴백 | 신규 |
| `backend/src/services/recommend_v2.py` | `_event_stream` 앞단 분기를 분류기+라우터로 교체, import 추가, 구 함수 제거 | 수정 |
| `backend/tests/test_recommend_v2_tools.py` | tools 순수 파서/리졸버 단위 테스트 | 신규 |
| `backend/tests/test_recommend_v2_classifier.py` | classify_intent 폴백/EXPLAIN 억제 테스트 | 신규 |
| `backend/tests/test_recommend_v2_intent.py` | 의도별 `_event_stream` 통합 테스트(GENERAL/PROPOSAL/EXPLAIN/RECOMMEND) | 신규 |
| `backend/tests/test_recommend_v2_proposal_flow.py` | monkeypatch 시임을 신규 함수로 갱신 | 수정 |

---

## Task 1: 툴 스키마 + 순수 파서 (`tools.py`)

**Files:**
- Create: `backend/src/services/graph/tools.py`
- Test: `backend/tests/test_recommend_v2_tools.py`

- [ ] **Step 1: 실패 테스트 작성**

`backend/tests/test_recommend_v2_tools.py`:

```python
"""tools.py 순수 파서 단위 테스트 (LLM 없음)."""
from __future__ import annotations

from src.services.graph.tools import (
    media_item_from_tool_calls,
    proposal_intent_from_tool_calls,
)


def test_proposal_parser_create_with_indices():
    calls = [{"name": "CreateProposal", "args": {"name": "여름캠페인", "media_indices": [1, 3]}}]
    intent = proposal_intent_from_tool_calls(calls)
    assert intent.action == "create"
    assert intent.name == "여름캠페인"
    assert intent.media_indices == [1, 3]


def test_proposal_parser_add_media():
    calls = [{"name": "AddMedia", "args": {"media_indices": [2]}}]
    intent = proposal_intent_from_tool_calls(calls)
    assert intent.action == "add_media"
    assert intent.media_indices == [2]


def test_proposal_parser_rename():
    calls = [{"name": "RenameProposal", "args": {"new_name": "새이름"}}]
    intent = proposal_intent_from_tool_calls(calls)
    assert intent.action == "rename"
    assert intent.new_name == "새이름"


def test_proposal_parser_no_tool_call_is_none():
    assert proposal_intent_from_tool_calls([]).action == "none"


def test_media_parser_by_index():
    items = [{"id": "0", "name": "A"}, {"id": "1", "name": "B"}]
    assert media_item_from_tool_calls([{"name": "ExplainMedia", "args": {"index": 2}}], items)["name"] == "B"


def test_media_parser_by_name_substring():
    items = [{"id": "0", "name": "신사 BK빌딩"}]
    assert media_item_from_tool_calls([{"name": "ExplainMedia", "args": {"name": "BK빌딩"}}], items)["id"] == "0"


def test_media_parser_out_of_range_is_none():
    items = [{"id": "0", "name": "A"}]
    assert media_item_from_tool_calls([{"name": "ExplainMedia", "args": {"index": 9}}], items) is None


def test_media_parser_empty_items_is_none():
    assert media_item_from_tool_calls([{"name": "ExplainMedia", "args": {"index": 1}}], []) is None
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && python -m pytest tests/test_recommend_v2_tools.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'src.services.graph.tools'`

- [ ] **Step 3: `tools.py` 스키마 + 파서 구현**

`backend/src/services/graph/tools.py`:

```python
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


class CreateProposal(BaseModel):
    """새 제안서(장바구니) 생성."""

    name: Optional[str] = Field(None, description="제안서 이름(없으면 null)")
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
) -> Optional[dict]:
    """tool_calls → 직전 리스트의 해당 item (없으면 None)."""
    if not tool_calls or not last_items:
        return None
    args = tool_calls[0].get("args") or {}
    idx = args.get("index")
    if isinstance(idx, int) and 1 <= idx <= len(last_items):
        return last_items[idx - 1]
    name = (args.get("name") or "").strip()
    if name:
        for it in last_items:
            if name in (it.get("name") or ""):
                return it
    return None
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_recommend_v2_tools.py -v`
Expected: PASS (8 passed)

- [ ] **Step 5: 커밋**

```bash
git add backend/src/services/graph/tools.py backend/tests/test_recommend_v2_tools.py
git commit -m "feat: 챗봇 tool calling 스키마 + 순수 파서 추가"
```

---

## Task 2: LLM 리졸버 (`tools.py`에 추가)

**Files:**
- Modify: `backend/src/services/graph/tools.py` (파서 아래에 append)
- Test: `backend/tests/test_recommend_v2_tools.py` (append)

- [ ] **Step 1: 실패 테스트 작성 (fake LLM)**

`backend/tests/test_recommend_v2_tools.py` 하단에 추가:

```python
from src.services.graph import tools as t


class _FakeResp:
    def __init__(self, tool_calls):
        self.tool_calls = tool_calls


class _FakeBound:
    def __init__(self, resp):
        self._resp = resp

    def invoke(self, _msgs):
        return self._resp


class _FakeChat:
    def __init__(self, resp):
        self._resp = resp

    def bind_tools(self, _tools):
        return _FakeBound(self._resp)


def test_resolve_proposal_via_tools_maps_tool_call(monkeypatch):
    monkeypatch.setattr(
        t, "get_chat",
        lambda *_a, **_k: _FakeChat(_FakeResp([{"name": "AddMedia", "args": {"media_indices": [1]}}])),
    )
    intent = t.resolve_proposal_via_tools("1번 담아줘", [{"id": "0", "name": "A"}], has_active=True)
    assert intent.action == "add_media" and intent.media_indices == [1]


def test_resolve_proposal_via_tools_error_returns_none_action(monkeypatch):
    def _boom(*_a, **_k):
        raise RuntimeError("no llm")

    monkeypatch.setattr(t, "get_chat", _boom)
    assert t.resolve_proposal_via_tools("x", [], has_active=False).action == "none"


def test_resolve_media_via_tools_maps_tool_call(monkeypatch):
    monkeypatch.setattr(
        t, "get_chat",
        lambda *_a, **_k: _FakeChat(_FakeResp([{"name": "ExplainMedia", "args": {"index": 1}}])),
    )
    item = t.resolve_media_via_tools("1번 자세히", [{"id": "0", "name": "A"}])
    assert item["id"] == "0"


def test_resolve_media_via_tools_error_returns_none(monkeypatch):
    def _boom(*_a, **_k):
        raise RuntimeError("no llm")

    monkeypatch.setattr(t, "get_chat", _boom)
    assert t.resolve_media_via_tools("x", [{"id": "0", "name": "A"}]) is None
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && python -m pytest tests/test_recommend_v2_tools.py -k resolve -v`
Expected: FAIL — `AttributeError: module ... has no attribute 'resolve_proposal_via_tools'`

- [ ] **Step 3: 리졸버 구현 (`tools.py` 하단에 추가)**

```python
# ===== LLM 리졸버 (bind_tools 호출 → 파서) =====


def resolve_proposal_via_tools(message: str, last_items: list[dict], has_active: bool):
    """발화를 제안서 도구(create/add/rename)로 매핑 → ProposalIntent."""
    from src.services.recommend_v2 import ProposalIntent

    listing = "\n".join(
        f"{i + 1}. {it.get('name', '')}" for i, it in enumerate(last_items or [])
    )
    sys_prompt = (
        "사용자 발화를 아래 제안서 도구 중 하나로 매핑하라.\n"
        "- CreateProposal: 새 제안서 생성 (예: '제안서 만들어줘', 'XX로 제안서 만들어줘').\n"
        "- AddMedia: 직전 추천 목록의 특정 매체를 담기 (예: '1번 3번 담아줘').\n"
        "- RenameProposal: 기존 제안서 이름 변경 (예: '이름 XX로 바꿔줘').\n"
        "- 제안서 작업이 아니면 어떤 도구도 호출하지 마라.\n"
        "- '1번 3번으로 제안서 만들어줘'는 CreateProposal + media_indices.\n\n"
        f"현재 작업중 제안서: {'있음' if has_active else '없음'}\n"
        f"[직전 추천 매체]\n{listing or '(없음)'}"
    )
    try:
        llm = get_chat(temperature=0.0).bind_tools([CreateProposal, AddMedia, RenameProposal])
        resp = llm.invoke([SystemMessage(content=sys_prompt), HumanMessage(content=message.strip())])
    except Exception:
        return ProposalIntent()
    return proposal_intent_from_tool_calls(getattr(resp, "tool_calls", []) or [])


def resolve_media_via_tools(message: str, last_items: list[dict]) -> Optional[dict]:
    """발화가 직전 리스트의 특정 매체 질문이면 해당 item, 아니면 None."""
    if not last_items:
        return None
    listing = "\n".join(
        f"{i + 1}. {it.get('name', '')}" for i, it in enumerate(last_items)
    )
    sys_prompt = (
        "사용자가 아래 '직전 추천 매체' 중 특정 매체의 상세 설명을 요청하면 "
        "ExplainMedia 도구를 index(1-based) 또는 name 으로 호출하라. "
        "새 검색조건이거나 목록과 무관하면 도구를 호출하지 마라.\n\n"
        f"[직전 추천 매체]\n{listing}"
    )
    try:
        llm = get_chat(temperature=0.0).bind_tools([ExplainMedia])
        resp = llm.invoke([SystemMessage(content=sys_prompt), HumanMessage(content=message.strip())])
    except Exception:
        return None
    return media_item_from_tool_calls(getattr(resp, "tool_calls", []) or [], last_items)
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_recommend_v2_tools.py -v`
Expected: PASS (12 passed)

- [ ] **Step 5: 커밋**

```bash
git add backend/src/services/graph/tools.py backend/tests/test_recommend_v2_tools.py
git commit -m "feat: 제안서/매체설명 bind_tools 리졸버 추가"
```

---

## Task 3: 의도 분류기 (`intent_classifier.py`)

**Files:**
- Create: `backend/src/services/graph/intent_classifier.py`
- Test: `backend/tests/test_recommend_v2_classifier.py`

- [ ] **Step 1: 실패 테스트 작성**

`backend/tests/test_recommend_v2_classifier.py`:

```python
"""classify_intent 폴백/억제 로직 테스트 (fake LLM)."""
from __future__ import annotations

from src.services.graph import intent_classifier as ic
from src.services.graph.intent_classifier import Intent, classify_intent


class _FakeStruct:
    def __init__(self, res):
        self._res = res

    def invoke(self, _msgs):
        return self._res


class _FakeChat:
    def __init__(self, res):
        self._res = res

    def with_structured_output(self, _model):
        return _FakeStruct(self._res)


def test_empty_message_defaults_recommend():
    assert classify_intent("", False, False) == "RECOMMEND"


def test_error_falls_back_to_recommend(monkeypatch):
    def _boom(*_a, **_k):
        raise RuntimeError("no llm")

    monkeypatch.setattr(ic, "get_chat", _boom)
    assert classify_intent("안녕", False, False) == "RECOMMEND"


def test_explain_suppressed_without_last_list(monkeypatch):
    monkeypatch.setattr(ic, "get_chat", lambda *_a, **_k: _FakeChat(Intent(intent="EXPLAIN")))
    # 직전 리스트가 없으면 EXPLAIN → RECOMMEND 로 강등
    assert classify_intent("3번 자세히", has_last_list=False, has_active_proposal=False) == "RECOMMEND"


def test_explain_kept_with_last_list(monkeypatch):
    monkeypatch.setattr(ic, "get_chat", lambda *_a, **_k: _FakeChat(Intent(intent="EXPLAIN")))
    assert classify_intent("3번 자세히", has_last_list=True, has_active_proposal=False) == "EXPLAIN"


def test_general_passthrough(monkeypatch):
    monkeypatch.setattr(ic, "get_chat", lambda *_a, **_k: _FakeChat(Intent(intent="GENERAL")))
    assert classify_intent("여기 뭐하는 곳이야?", False, False) == "GENERAL"
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && python -m pytest tests/test_recommend_v2_classifier.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'src.services.graph.intent_classifier'`

- [ ] **Step 3: 분류기 구현**

`backend/src/services/graph/intent_classifier.py`:

```python
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_recommend_v2_classifier.py -v`
Expected: PASS (5 passed)

- [ ] **Step 5: 커밋**

```bash
git add backend/src/services/graph/intent_classifier.py backend/tests/test_recommend_v2_classifier.py
git commit -m "feat: Stage1 의도 분류기 추가 (RECOMMEND/EXPLAIN/PROPOSAL/GENERAL)"
```

---

## Task 4: GENERAL 하이브리드 웰컴 (`welcome.py`)

**Files:**
- Create: `backend/src/services/graph/welcome.py`
- Test: `backend/tests/test_recommend_v2_classifier.py` (append — 웰컴 폴백만)

- [ ] **Step 1: 실패 테스트 작성**

`backend/tests/test_recommend_v2_classifier.py` 하단에 추가:

```python
from src.services.graph import welcome as w
from src.services.graph.welcome import generate_welcome


def test_generate_welcome_canned_fallback_on_error(monkeypatch):
    def _boom(*_a, **_k):
        raise RuntimeError("no llm")

    monkeypatch.setattr(w, "get_chat", _boom)
    msg = generate_welcome("안녕")
    assert "옥외광고" in msg and "추천" in msg
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && python -m pytest tests/test_recommend_v2_classifier.py -k welcome -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'src.services.graph.welcome'`

- [ ] **Step 3: 웰컴 구현**

`backend/src/services/graph/welcome.py`:

```python
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_recommend_v2_classifier.py -v`
Expected: PASS (6 passed)

- [ ] **Step 5: 커밋**

```bash
git add backend/src/services/graph/welcome.py backend/tests/test_recommend_v2_classifier.py
git commit -m "feat: GENERAL 하이브리드 웰컴 생성기 추가"
```

---

## Task 5: `_event_stream` 배선 (분류기 + 라우터)

**Files:**
- Modify: `backend/src/services/recommend_v2.py` (import 상단 + `_event_stream` 분기부)
- Test: `backend/tests/test_recommend_v2_intent.py`

- [ ] **Step 1: 통합 실패 테스트 작성**

`backend/tests/test_recommend_v2_intent.py`:

```python
"""의도 분류기 라우팅 통합 테스트 — classify_intent/리졸버 monkeypatch, DB 는 실 postgres."""
from __future__ import annotations

import asyncio
import json
import uuid

import pytest
from sqlalchemy.orm import Session

from src.database import SessionLocal
from src.models.ad_session import AdSession
from src.services import proposal_service as ps
from src.services import recommend_v2 as v2
from src.services.recommend_v2 import ExtractedCodes


@pytest.fixture
def db() -> Session:
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture
def session(db: Session):
    s = AdSession(thread_id=f"test-thread-{uuid.uuid4().hex[:12]}")
    db.add(s)
    db.commit()
    db.refresh(s)
    yield s
    for p in ps.list_for_owner(db, session_id=s.id):
        db.delete(p)
    db.delete(s)
    db.commit()


def _drive(message: str, session_id: str, filter_context: dict):
    saved: dict = {}

    def save_fn(ctx: dict) -> None:
        saved.clear()
        saved.update(ctx)

    async def run():
        events = []
        d = SessionLocal()
        try:
            gen = v2._event_stream(message, d, v2.DEFAULT_TOP_K, filter_context, session_id, save_fn)
            async for block in gen:
                for line in block.split("\n"):
                    if line.startswith("data:"):
                        payload = line[5:].strip()
                        if payload and payload != "{}":
                            try:
                                events.append(json.loads(payload))
                            except json.JSONDecodeError:
                                pass
        finally:
            d.close()
        return events

    return asyncio.run(run()), dict(saved)


def test_general_returns_welcome(session, monkeypatch):
    monkeypatch.setattr(v2, "classify_intent", lambda *_a, **_k: "GENERAL")
    monkeypatch.setattr(
        v2, "generate_welcome",
        lambda _m: "안녕하세요! 옥외광고 매체를 추천하는 챗봇이에요. 어떤 지역을 찾으세요?",
    )
    events, _ = _drive("안녕", str(session.id), {})
    chat = next((e for e in events if e.get("type") == "chat"), None)
    assert chat is not None and "옥외광고" in chat["message"]


def test_recommend_routes_to_extract(session, monkeypatch):
    monkeypatch.setattr(v2, "classify_intent", lambda *_a, **_k: "RECOMMEND")
    monkeypatch.setattr(v2, "extract_keywords", lambda _t, _d: ExtractedCodes(loc=["LOC-01"]))
    events, _ = _drive("강남 광고", str(session.id), {})
    # 슬롯 1개 → need_more
    assert any(e.get("type") == "need_more" for e in events)


def test_explain_routes_to_media(session, monkeypatch):
    last_items = [{"id": "0", "media_id": None, "name": "테스트매체"}]
    monkeypatch.setattr(v2, "classify_intent", lambda *_a, **_k: "EXPLAIN")
    monkeypatch.setattr(v2, "resolve_media_via_tools", lambda _m, items: items[0])
    monkeypatch.setattr(v2, "_explain_with_llm", lambda _item, _detail: "설명입니다")
    events, _ = _drive("1번 자세히", str(session.id), {"last_items": last_items})
    assert any(e.get("type") == "media_detail" for e in events)


def test_proposal_routes_to_resolver(db, session, monkeypatch):
    from src.models.media_master import Media

    medias = db.query(Media).filter(Media.media_id.isnot(None)).limit(2).all()
    if len(medias) < 1:
        pytest.skip("media 데이터 부족")
    last_items = [{"id": str(i), "media_id": m.media_id, "name": m.name or m.media_id} for i, m in enumerate(medias)]
    monkeypatch.setattr(v2, "classify_intent", lambda *_a, **_k: "PROPOSAL")
    monkeypatch.setattr(
        v2, "resolve_proposal_via_tools",
        lambda *_a, **_k: v2.ProposalIntent(action="create", name="테스트제안서"),
    )
    events, ctx = _drive("제안서 만들어줘", str(session.id), {"last_items": last_items})
    proposal_evt = next((e for e in events if e.get("type") == "proposal"), None)
    assert proposal_evt is not None
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && python -m pytest tests/test_recommend_v2_intent.py -v`
Expected: FAIL — `AttributeError: module 'src.services.recommend_v2' has no attribute 'classify_intent'`

- [ ] **Step 3: import 추가 (recommend_v2.py 상단 import 블록)**

`backend/src/services/recommend_v2.py`의 기존 `from src.services import ...` 근처(파일 상단 import 영역)에 추가:

```python
from src.services.graph.intent_classifier import classify_intent
from src.services.graph.tools import resolve_media_via_tools, resolve_proposal_via_tools
from src.services.graph.welcome import generate_welcome
```

- [ ] **Step 4: 분기부 교체 — 제안서 게이트를 분류기로**

`recommend_v2.py`에서 아래 블록(현재 `# 1.3) 제안서 의도 분기` 직후, 약 1183~1187행):

```python
        intent = ProposalIntent()
        if _has_proposal_hint(message):
            intent = await _run_sync_in_thread(
                _resolve_proposal_intent, message, last_items or [], bool(active_proposal_id)
            )
```

를 다음으로 교체 (앞에 분류기 호출 + GENERAL 분기 삽입):

```python
        # ─────────────────────────────────────────────────────────
        # 1.2) Stage 1 — 의도 분류기
        # ─────────────────────────────────────────────────────────
        intent_label = await _run_sync_in_thread(
            classify_intent, message, bool(last_items), bool(active_proposal_id)
        )

        # GENERAL — 인사/정체성/잡담 → 하이브리드 웰컴
        if intent_label == "GENERAL":
            welcome = await _run_sync_in_thread(generate_welcome, message)
            save_filter_context_fn({**prev_slots, "pending_change": None})
            yield emit({
                "type": "chat",
                "message": welcome,
                "previous_context": prev_slots,
                "previous_context_detail": _enrich_context(prev_slots, desc_map),
            })
            finalize()
            yield "event: done\ndata: {}\n\n"
            return

        # ─────────────────────────────────────────────────────────
        # 1.3) PROPOSAL — bind_tools 리졸버로 제안서 작업 판정
        # ─────────────────────────────────────────────────────────
        intent = ProposalIntent()
        if intent_label == "PROPOSAL":
            intent = await _run_sync_in_thread(
                resolve_proposal_via_tools, message, last_items or [], bool(active_proposal_id)
            )
```

> 이후 `if intent.action in ("create", "add_media", "rename"):` 블록(제안서 핸들러 본문, ~1188-1303행)은 **변경 없이 그대로 둔다.**

- [ ] **Step 5: 분기부 교체 — 매체설명 게이트를 분류기+리졸버로**

`recommend_v2.py`의 `# 1.5) 의도 분기 ...` 블록(약 1308~1311행):

```python
        if last_items:
            resolved = await _run_sync_in_thread(
                _resolve_media_question, message, last_items
            )
```

를 다음으로 교체:

```python
        if intent_label == "EXPLAIN" and last_items:
            resolved = await _run_sync_in_thread(
                resolve_media_via_tools, message, last_items
            )
```

> 이후 `if resolved is not None:` 블록(매체설명 핸들러, ~1312-1319행)과 그 아래 `# 2) 키워드 추출`(extract_keywords, RECOMMEND 경로)은 **변경 없이 그대로 둔다.**

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_recommend_v2_intent.py -v`
Expected: PASS (4 passed, media 부족 시 proposal 테스트 skip 가능)

- [ ] **Step 7: 커밋**

```bash
git add backend/src/services/recommend_v2.py backend/tests/test_recommend_v2_intent.py
git commit -m "feat: _event_stream 앞단을 의도 분류기 + tool 라우터로 교체"
```

---

## Task 6: 기존 제안서 플로우 테스트 시임 갱신

**Files:**
- Modify: `backend/tests/test_recommend_v2_proposal_flow.py:88-92`

- [ ] **Step 1: monkeypatch 시임 갱신**

`test_proposal_create_then_add_flow`의 턴1 monkeypatch(현재 88-92행):

```python
    monkeypatch.setattr(
        v2,
        "_resolve_proposal_intent",
        lambda *_a, **_k: v2.ProposalIntent(action="create", media_indices=[1, 2]),
    )
```

를 다음으로 교체 (분류기 + 신규 리졸버 시임):

```python
    monkeypatch.setattr(v2, "classify_intent", lambda *_a, **_k: "PROPOSAL")
    monkeypatch.setattr(
        v2,
        "resolve_proposal_via_tools",
        lambda *_a, **_k: v2.ProposalIntent(action="create", media_indices=[1, 2]),
    )
```

> 턴2("제안서1로 생성해줘")·턴3("응")은 `pending_proposal` 상태(await_name/await_add_confirm)에서 처리되어 **분류기를 타지 않으므로** 추가 monkeypatch 불필요. 단, 턴2/턴3에서 classify_intent 가 호출되지 않음을 보장하려면 위 `classify_intent` monkeypatch 가 세션 내내 유지되므로 안전(호출돼도 "PROPOSAL" 반환하지만 pending 처리가 먼저 return).

- [ ] **Step 2: 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_recommend_v2_proposal_flow.py -v`
Expected: PASS (1 passed, media 부족 시 skip)

- [ ] **Step 3: 커밋**

```bash
git add backend/tests/test_recommend_v2_proposal_flow.py
git commit -m "test: 제안서 플로우 테스트를 분류기+tool 시임으로 갱신"
```

---

## Task 7: 구 함수 제거 + 전체 회귀

**Files:**
- Modify: `backend/src/services/recommend_v2.py` (구 함수/상수 삭제)

- [ ] **Step 1: 남은 참조 확인**

Run:
```bash
cd backend && grep -rn "_has_proposal_hint\|_PROPOSAL_HINT_RE\|_resolve_proposal_intent\|_resolve_media_question\|MediaQuestion" src/ tests/
```
Expected: 정의부(삭제 대상) 외에 참조 없음. `tools.py`/`_event_stream`은 신규 함수만 사용. (참조가 남아있으면 Task 5/6 미완 → 먼저 해결)

- [ ] **Step 2: 구 함수/상수 삭제**

`recommend_v2.py`에서 다음을 삭제:
- `class MediaQuestion(BaseModel)` (약 686-690행)
- `def _resolve_media_question(...)` 전체 (약 703-725행)
- `_PROPOSAL_HINT_RE = re.compile(...)` (약 798-800행) 및 주석
- `def _has_proposal_hint(text)` (약 803-804행)
- `class ProposalIntent(BaseModel)` — **삭제 금지** (핸들러·리졸버가 사용)
- `def _resolve_proposal_intent(...)` 전체 (약 816-842행)
- `def _explain_with_llm(...)` — **삭제 금지** (`_iter_explain_event_data`가 사용)
- `def _last_items_from_payload(...)` — **삭제 금지** (list 저장에 사용)

> `re` import 는 다른 곳(`_PRICE_DIGITS_RE` 등)에서 계속 쓰이므로 유지.

- [ ] **Step 3: import 정리 확인 (orphan)**

Run: `cd backend && python -c "import src.services.recommend_v2"`
Expected: 에러 없음 (SystemMessage/HumanMessage 등은 다른 곳에서 계속 사용 → 유지).

- [ ] **Step 4: 전체 회귀 테스트**

Run: `cd backend && python -m pytest tests/test_recommend_v2.py tests/test_recommend_v2_router.py tests/test_recommend_v2_tools.py tests/test_recommend_v2_classifier.py tests/test_recommend_v2_intent.py tests/test_recommend_v2_proposal_flow.py -v`
Expected: 전부 PASS (media/DB 데이터 부족분만 skip).

- [ ] **Step 5: 커밋**

```bash
git add backend/src/services/recommend_v2.py
git commit -m "refactor: 구 캐스케이드 분기 함수 제거 (분류기+tool로 대체)"
```

---

## Task 8: 수동 시나리오 검증 (선택 — 실 LLM 필요)

> 실제 OpenAI 키가 있는 환경에서만. 기존 백엔드 실행(포트 8001) 기준.

- [ ] **Step 1: 의도별 발화 확인**

`POST /recommend/v2/stream`(또는 배포 시 `/jobs` 폴링)로:
- RECOMMEND: "강남역 화장품 광고" → list/need_more
- EXPLAIN(리스트 후): "3번 자세히" → media_detail
- PROPOSAL: "제안서 만들어줘" → 이름 요청 → 이름 입력 → "응" → 담기 완료
- GENERAL: "안녕", "여기 뭐하는 곳이야?", "ㅎㅇ" → 웰컴+페르소나+가이드

- [ ] **Step 2: 로그로 분류 라벨 확인** (필요 시 `classify_intent` 결과 임시 로깅 후 제거)

---

## Self-Review 결과

- **스펙 커버리지**: Stage1 분류기(Task 3) · bind_tools 라우터(Task 1·2·5) · GENERAL 하이브리드(Task 4) · pending 보존(Task 5는 pending 블록 미변경) · 구 캐스케이드 제거(Task 7) · 응답 스키마 불변(신규 이벤트 타입 없음, `type:"chat"` 재사용) 모두 태스크로 커버.
- **플레이스홀더**: 없음(모든 스텝에 실제 코드/명령).
- **타입 일관성**: `ProposalIntent`(action/name/new_name/media_indices) 는 기존 정의 재사용, 파서/리졸버/핸들러 간 시그니처 일치. `classify_intent`는 문자열 라벨 반환으로 통일. `resolve_media_via_tools`/`media_item_from_tool_calls`는 `Optional[dict]` 반환으로 기존 `_resolve_media_question`과 동일 계약.
- **회귀 안전**: 비스트림 `recommend_v2()` 미변경(라우터 테스트 무영향), RECOMMEND 경로 `extract_keywords` 미변경, pending 플로우 미변경.
