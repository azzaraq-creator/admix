# recommend_react (ReAct 추천 챗봇) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** recommend_v2(슬롯 머신)와 완전 독립인 신규 ReAct 추천 챗봇 `recommend_react`를 만든다 — LLM이 도구(검색/설명/제안서)를 자율 호출·연쇄하고, NOT_FOUND 가드레일로 할루시네이션을 차단한다.

**Architecture:** 정식 LangGraph StateGraph(`chatbot ⇄ tools` 순환 + `route_after_tools` NOT_FOUND fallback). SSE 없이 `graph.invoke()`로 루프를 끝까지 돌려 `{"events":[...], "error":...}` 하나를 반환. 기존 비동기 잡(enqueue→폴링) 경로에 `version="react"` 분기로 연결. 메모리는 langgraph checkpointer 없이 DB 대화이력을 매 턴 로드해 그래프 초기 messages로 주입.

**Tech Stack:** Python, FastAPI, SQLAlchemy, LangGraph(`StateGraph`/`ToolNode`/`tools_condition`), LangChain(`bind_tools`), OpenAI(ChatOpenAI). 프런트: Next.js/React 훅.

**Spec:** [docs/superpowers/specs/2026-07-22-recommend-react-design.md](../specs/2026-07-22-recommend-react-design.md)

---

## 파일 구조

**생성:**
- `backend/src/services/recommend_react/__init__.py` — `collect_events` export
- `backend/src/services/recommend_react/domain.py` — recommend_v2에서 포팅한 순수 도메인 헬퍼(스키마/키워드추출/필터/정렬/포맷/제안서 실행기). **v2에서 import 안 함 — 복사**
- `backend/src/services/recommend_react/tools.py` — 도구 스키마 + 실행기(구조화 이벤트를 ctx.events에 append)
- `backend/src/services/recommend_react/graph.py` — `ReactState`, 노드, 라우팅, `build_graph`, `collect_events`, 이력/컨텍스트 로더
- `backend/src/routers/recommend_react.py` — `/recommend/react/jobs` + 폴링
- `backend/tests/test_recommend_react.py` — 테스트
- `frontend/hooks/adRecommendReact/useReactChat.ts` — 프런트 훅(useV2Chat 복제·슬롯 제거)
- `frontend/hooks/adRecommendReact/index.ts` — export

**수정:**
- `backend/src/services/ai_job_service.py` — `version` 파라미터 + 분기 (공유 인프라, v2 로직 무변경)
- `backend/src/routers/recommend_react.py` 등록: `backend/src/main.py`
- `backend/requirements-lambda.txt` — `langgraph` 추가

**무변경:** `backend/src/services/recommend_v2.py`, `backend/src/routers/recommend_v2.py`, `backend/tests/test_recommend_v2.py`.

---

## Task 0: 의존성 준비

**Files:**
- Modify: `backend/requirements-lambda.txt`

- [ ] **Step 1: langgraph를 Lambda 의존성에 추가**

`backend/requirements-lambda.txt`의 LLM 블록(현재 line 16-19 `langchain-core`/`langchain-openai`/`openai`) 바로 아래에 추가:

```
# LangGraph (recommend_react ReAct 그래프 — Lambda consumer가 graph.invoke 실행)
langgraph>=0.2,<0.3
```

- [ ] **Step 2: 로컬 설치 확인**

Run: `cd backend && python -c "import langgraph; from langgraph.graph import StateGraph, START, END; from langgraph.prebuilt import ToolNode, tools_condition; print('ok')"`
Expected: `ok` (메인 requirements.txt에 이미 langgraph>=0.2,<0.3 있음 → 로컬 환경엔 설치됨)

- [ ] **Step 3: Commit**

```bash
cd /Users/lala/Documents/GitHub/ooh-recommend
git add backend/requirements-lambda.txt
git commit -m "chore: recommend_react용 langgraph Lambda 의존성 추가"
```

---

## Task 1: 도메인 헬퍼 포팅 (domain.py)

recommend_v2.py의 검증된 순수 헬퍼를 **복사**해 독립 모듈을 만든다(런타임 import 의존 없음). 슬롯/스트림 관련 함수는 가져오지 않는다.

**Files:**
- Create: `backend/src/services/recommend_react/__init__.py`
- Create: `backend/src/services/recommend_react/domain.py`

- [ ] **Step 1: 패키지 `__init__.py` 생성**

```python
from src.services.recommend_react.graph import collect_events

__all__ = ["collect_events"]
```

- [ ] **Step 2: `domain.py` 생성 — 상수·import·스키마**

파일 상단:

```python
"""recommend_react 도메인 헬퍼 — recommend_v2에서 포팅한 순수 로직(독립).

키워드 추출 / DB 필터 / 광고비 정렬 / 응답 포맷 / 제안서 실행기.
슬롯·스트림·충돌 로직은 가져오지 않는다.
"""
from __future__ import annotations

import re
from typing import Optional

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import BigInteger, cast
from sqlalchemy.dialects.postgresql import array
from sqlalchemy.orm import Session

from src.models.media import KeywordCategory, MediaItem, MediaKeyword
from src.models.media_image import MediaImage
from src.models.media_master import Media
from src.services import media_service, proposal_service
from src.services.graph.llm import get_chat

DEFAULT_TOP_K = 20
MAX_CANDIDATE_FETCH = 2000
SLOT_KEYS: tuple[str, ...] = ("ind", "prd", "obj", "tgt", "loc", "cat")
```

- [ ] **Step 3: recommend_v2.py에서 아래 함수/클래스를 domain.py로 verbatim 복사**

`backend/src/services/recommend_v2.py`에서 다음을 **본문 그대로** 복사(정의 순서 유지). 각 항목 옆은 현재 소스 라인:

- `class ExtractedCodes` (47-62)
- `def _format_budget` (65-80)
- `class MediaItemResponse` (83-95)
- `def load_keyword_catalog` (111-117)
- `def load_keyword_descriptions` (120-123)
- `_CATEGORY_LABEL_FULL` 딕셔너리 (136-143)
- `def _format_catalog_for_prompt` (146-157)
- `def _build_extract_prompt` (160-205)
- `_llm_cache = {}` + `def _get_extract_llm` (208-217)
- `def extract_keywords` (220-231)
- `def filter_media_items` (237-274)
- `_PRICE_DIGITS_RE` + `def _ad_fee_int` (280-292)
- `def sort_by_price_desc` (295-297)
- `def _split_image_urls` (303-306)
- `def _media_meta_by_media_id` (309-333)
- `def _images_by_media_id` (336-354)
- `def _to_response_item` (357-376)
- `def _has_any_filter` (379-380)
- `def _explain_with_llm` (761-810)
- `class ProposalIntent` (846-852)
- `def _proposal_owner_for_session` (855-872)
- `def _media_ids_from_indices` (875-883)
- `def _proposal_limit_message` (886-895)
- `def _create_proposal_sync` (915-918)
- `def _get_active_or_latest` (921-932)
- `def _add_items_sync` (935-941)

복사 시 주의: 이 함수들이 참조하는 이름(`get_chat`, `KeywordCategory`, `MediaItem`, `MediaImage`, `Media`, `proposal_service`, `media_service`, `SLOT_KEYS`, `DEFAULT_TOP_K`, `MAX_CANDIDATE_FETCH`, `array`, `cast`, `BigInteger`, `re`)은 Step 2 import/상수로 이미 커버됨. `_CATEGORY_LABEL`(축약형)·`_enrich_*`·`recommend_v2` 함수는 복사하지 않는다.

- [ ] **Step 4: import 정합성 확인**

Run: `cd backend && python -c "from src.services.recommend_react import domain; print(domain.extract_keywords.__name__, domain.filter_media_items.__name__, domain.ProposalIntent.__name__)"`
Expected: `extract_keywords filter_media_items ProposalIntent` (ImportError/NameError 없음)

- [ ] **Step 5: Commit**

```bash
cd /Users/lala/Documents/GitHub/ooh-recommend
git add backend/src/services/recommend_react/__init__.py backend/src/services/recommend_react/domain.py
git commit -m "feat: recommend_react 도메인 헬퍼 포팅(독립 모듈)"
```

---

## Task 2: 요청 컨텍스트 + 이력 로더 (graph.py 1부)

**Files:**
- Create: `backend/src/services/recommend_react/graph.py`
- Test: `backend/tests/test_recommend_react.py`

- [ ] **Step 1: 실패 테스트 작성 — 이력을 LangChain 메시지로 변환**

`backend/tests/test_recommend_react.py`:

```python
from langchain_core.messages import AIMessage, HumanMessage

from src.services.recommend_react.graph import ReactContext, _history_to_messages


def test_history_to_messages_maps_roles():
    rows = [
        {"role": "user", "content": "홍대 화장품"},
        {"role": "assistant", "content": "매체 5개 찾았어요"},
        {"role": "user", "content": "강남도"},
    ]
    msgs = _history_to_messages(rows)
    assert [type(m) for m in msgs] == [HumanMessage, AIMessage, HumanMessage]
    assert msgs[0].content == "홍대 화장품"
    assert msgs[-1].content == "강남도"


def test_history_skips_empty_content():
    rows = [{"role": "assistant", "content": ""}, {"role": "user", "content": "성수"}]
    msgs = _history_to_messages(rows)
    assert len(msgs) == 1
    assert msgs[0].content == "성수"
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && pytest tests/test_recommend_react.py -v`
Expected: FAIL — `ImportError: cannot import name 'ReactContext'`

- [ ] **Step 3: graph.py 상단 — import·컨텍스트·이력 로더 구현**

`backend/src/services/recommend_react/graph.py`:

```python
"""recommend_react ReAct 그래프 — 추론(chatbot) ⇄ 도구(tools) 순환 + NOT_FOUND fallback.

SSE 없이 graph.invoke() 로 루프를 끝까지 돌린 뒤 events 리스트를 반환한다.
메모리는 checkpointer 없이 DB 대화이력을 매 턴 초기 messages 로 주입한다.
"""
from __future__ import annotations

import operator
import uuid as uuid_lib
from dataclasses import dataclass, field
from typing import Annotated, Any, Optional, Sequence, TypedDict

from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition
from sqlalchemy.orm import Session

from src.services.graph.llm import get_chat
from src.services.recommend_react import domain

NOT_FOUND_MARKER = "[NOT_FOUND]"
HISTORY_LIMIT = 20  # 최근 대화 N개만 주입(토큰 절약)

FALLBACK_MESSAGE = (
    "조건에 맞는 매체를 찾지 못했어요. "
    "지역·제품·카테고리·타깃 등을 조금 다르게 알려주시면 다시 찾아드릴게요 😊"
)


@dataclass
class ReactContext:
    """요청 1건 동안 도구가 공유하는 가변 상태."""

    db: Session
    session_id: Optional[str]
    top_k: int
    last_items: list[dict] = field(default_factory=list)
    active_proposal_id: Optional[str] = None
    events: list[dict] = field(default_factory=list)


def _history_to_messages(rows: list[dict]) -> list[BaseMessage]:
    """저장된 대화 이력 dict 목록 → LangChain 메시지. 빈 content는 스킵."""
    out: list[BaseMessage] = []
    for r in rows:
        content = (r.get("content") or "").strip()
        if not content:
            continue
        if r.get("role") == "assistant":
            out.append(AIMessage(content=content))
        else:
            out.append(HumanMessage(content=content))
    return out


def _load_history(session_id: Optional[str]) -> list[BaseMessage]:
    """AdSession.messages 최근 HISTORY_LIMIT개를 LangChain 메시지로 로드."""
    if not session_id:
        return []
    from src.database import SessionLocal
    from src.models.ad_session import AdSession

    try:
        sid = uuid_lib.UUID(str(session_id))
    except (ValueError, AttributeError):
        return []
    with SessionLocal() as db:
        session = db.query(AdSession).filter(AdSession.id == sid).first()
        if session is None:
            return []
        rows = [
            {"role": m.role.value if hasattr(m.role, "value") else str(m.role), "content": m.content}
            for m in session.messages
        ]
    return _history_to_messages(rows[-HISTORY_LIMIT:])
```

- [ ] **Step 4: 통과 확인**

Run: `cd backend && pytest tests/test_recommend_react.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
cd /Users/lala/Documents/GitHub/ooh-recommend
git add backend/src/services/recommend_react/graph.py backend/tests/test_recommend_react.py
git commit -m "feat: recommend_react 요청 컨텍스트 + 대화이력 로더"
```

---

## Task 3: 도구 스키마 + 파서 (tools.py 1부 — SearchMedia)

도구는 (a) LLM에 돌려줄 요약 문자열과 (b) 프런트 이벤트 dict(→ctx.events)를 만든다. 먼저 이벤트 생성 순수 함수를 TDD로.

**Files:**
- Create: `backend/src/services/recommend_react/tools.py`
- Test: `backend/tests/test_recommend_react.py`

- [ ] **Step 1: 실패 테스트 — list 이벤트 빌더**

`backend/tests/test_recommend_react.py`에 추가:

```python
from src.services.recommend_react.tools import build_list_event, list_summary_for_llm


def test_build_list_event_shape():
    items = [{"id": "1", "media_id": "m1", "name": "강남빌보드"}]
    ev = build_list_event(items, total=7, shown=1)
    assert ev["type"] == "list"
    assert ev["items"] == items
    assert ev["match_count"] == 7
    assert "7개" in ev["message"]


def test_list_summary_for_llm_lists_names():
    items = [
        {"id": "1", "media_id": "m1", "name": "강남빌보드", "price": "5000000"},
        {"id": "2", "media_id": "m2", "name": "홍대전광판", "price": "3000000"},
    ]
    s = list_summary_for_llm(items, total=2)
    assert "1. 강남빌보드" in s
    assert "2. 홍대전광판" in s
    assert NOT_FOUND_MARKER not in s


def test_list_summary_empty_is_not_found():
    from src.services.recommend_react.graph import NOT_FOUND_MARKER
    assert NOT_FOUND_MARKER in list_summary_for_llm([], total=0)
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && pytest tests/test_recommend_react.py -v`
Expected: FAIL — `ModuleNotFoundError: ... recommend_react.tools`

- [ ] **Step 3: tools.py 상단 + list 빌더/요약 구현**

`backend/src/services/recommend_react/tools.py`:

```python
"""recommend_react 도구 — 스키마 + 실행기.

각 도구는 요청별 ReactContext 를 클로저로 캡처한다. 실행 결과로 (a) LLM 에
돌려줄 요약 문자열을 반환하고, (b) 프런트로 나갈 구조화 이벤트를 ctx.events 에 append 한다.
"""
from __future__ import annotations

from typing import Optional

from langchain_core.tools import tool
from pydantic import BaseModel, Field

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
```

- [ ] **Step 4: 통과 확인**

Run: `cd backend && pytest tests/test_recommend_react.py -v`
Expected: PASS (5 passed)

- [ ] **Step 5: Commit**

```bash
cd /Users/lala/Documents/GitHub/ooh-recommend
git add backend/src/services/recommend_react/tools.py backend/tests/test_recommend_react.py
git commit -m "feat: recommend_react list 이벤트/요약 빌더"
```

---

## Task 4: 도구 팩토리 (tools.py 2부 — 5개 도구 클로저)

**Files:**
- Modify: `backend/src/services/recommend_react/tools.py`
- Test: `backend/tests/test_recommend_react.py`

- [ ] **Step 1: 실패 테스트 — build_tools가 5개 도구를 만들고 SearchMedia가 list 이벤트를 push**

`backend/tests/test_recommend_react.py`에 추가:

```python
from unittest.mock import patch

from src.services.recommend_react.graph import ReactContext
from src.services.recommend_react.tools import build_tools


def _ctx():
    return ReactContext(db=None, session_id=None, top_k=20)


def test_build_tools_returns_five():
    tools = build_tools(_ctx())
    names = {t.name for t in tools}
    assert names == {"SearchMedia", "ExplainMedia", "CreateProposal", "AddMedia", "RenameProposal"}


def test_search_media_pushes_list_event_and_returns_summary():
    ctx = _ctx()
    fake_items = [{"id": "1", "media_id": "m1", "name": "강남빌보드", "price": "5000000"}]
    tools = {t.name: t for t in build_tools(ctx)}
    with patch("src.services.recommend_react.tools._run_search", return_value=(fake_items, 1)):
        summary = tools["SearchMedia"].invoke({"region": "강남", "media_type": "전광판"})
    assert "강남빌보드" in summary
    assert ctx.last_items == fake_items
    assert ctx.events[-1]["type"] == "list"
    assert ctx.events[-1]["items"] == fake_items


def test_search_media_zero_results_not_found_no_event():
    ctx = _ctx()
    tools = {t.name: t for t in build_tools(ctx)}
    with patch("src.services.recommend_react.tools._run_search", return_value=([], 0)):
        summary = tools["SearchMedia"].invoke({"region": "없는동네"})
    from src.services.recommend_react.graph import NOT_FOUND_MARKER
    assert NOT_FOUND_MARKER in summary
    assert ctx.events == []  # 0건이면 이벤트 없음 → fallback이 안내 담당
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && pytest tests/test_recommend_react.py -v`
Expected: FAIL — `ImportError: cannot import name 'build_tools'`

- [ ] **Step 3: `_run_search` + `build_tools` 구현 (tools.py에 추가)**

```python
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
    """직전 추천 매체를 현재 제안서에 담기."""

    media_indices: list[int] = Field(default_factory=list, description="담을 1-based 번호")


class RenameProposalArgs(BaseModel):
    """현재 제안서 이름 변경."""

    new_name: str = Field(description="새 이름")


def _run_search(ctx: ReactContext, text: str) -> tuple[list[dict], int]:
    """자연어 조건 텍스트 → 키워드추출 + 필터+정렬+포맷 → (item dict 목록, total).

    키워드 추출을 이 함수 안에 포함해, 테스트에서 이 함수 하나만 patch 하면
    LLM/DB 호출을 전부 우회할 수 있게 한다.
    """
    codes = domain.extract_keywords(text, ctx.db)
    candidates, total = domain.filter_media_items(ctx.db, codes, domain.MAX_CANDIDATE_FETCH)
    if total == 0:
        return [], 0
    selected = domain.sort_by_price_desc(candidates, top_k=ctx.top_k)
    meta = domain._media_meta_by_media_id(ctx.db, selected)
    images = domain._images_by_media_id(ctx.db, [it.media_id for it in selected])
    items = [domain._to_response_item(it, meta, images).model_dump() for it in selected]
    return items, total


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
                "id": item.get("id"), "media_id": mid, "name": item.get("name"),
                "thumbnail_url": (detail or {}).get("thumbnailUrl"),
            },
        })
        return explanation

    @tool(args_schema=CreateProposalArgs)
    def CreateProposal(name=None, media_indices=None):  # noqa: N802
        """새 제안서 생성."""
        return _do_create_proposal(ctx, name, media_indices or [])

    @tool(args_schema=AddMediaArgs)
    def AddMedia(media_indices=None):  # noqa: N802
        """직전 매체를 현재 제안서에 담기."""
        return _do_add_media(ctx, media_indices or [])

    @tool(args_schema=RenameProposalArgs)
    def RenameProposal(new_name):  # noqa: N802
        """현재 제안서 이름 변경."""
        return _do_rename(ctx, new_name)

    return [SearchMedia, ExplainMedia, CreateProposal, AddMedia, RenameProposal]
```

`media_service` import를 tools.py 상단에 추가: `from src.services import media_service`.

- [ ] **Step 4: 통과 확인 (SearchMedia 테스트만)**

Run: `cd backend && pytest tests/test_recommend_react.py -k "build_tools or search_media" -v`
Expected: `test_search_media_zero_results...` FAIL 가능 — 아직 `_resolve_item`/`_do_*` 미정의로 build_tools import 시 NameError. 다음 스텝에서 정의.

- [ ] **Step 5: 헬퍼 `_resolve_item` + 제안서 실행기 구현 (tools.py에 추가)**

```python
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


def _do_add_media(ctx: ReactContext, indices: list[int]) -> str:
    member_id, owner_sid, _ = domain._proposal_owner_for_session(ctx.db, ctx.session_id)
    proposal = domain._get_active_or_latest(ctx.db, ctx.active_proposal_id, member_id, owner_sid)
    if proposal is None:
        return f"{NOT_FOUND_MARKER} 담을 제안서가 없습니다. 먼저 제안서를 만들어 주세요."
    media_ids = domain._media_ids_from_indices(ctx.last_items, indices)
    if not media_ids:
        return f"{NOT_FOUND_MARKER} 담을 매체 번호가 명확하지 않습니다."
    updated = domain._add_items_sync(ctx.db, proposal.id, member_id, owner_sid, media_ids) or proposal
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
```

`proposal_service` import를 tools.py 상단에 추가: `from src.services import proposal_service`.

> 주: `proposal_service.rename` 의 실제 시그니처는 구현 시 `backend/src/services/proposal_service.py`에서 확인해 맞춘다(없으면 `update_title`류 사용). 이름변경은 부가 기능이므로 시그니처 불일치 시 해당 도구만 조정.

- [ ] **Step 6: 통과 확인**

Run: `cd backend && pytest tests/test_recommend_react.py -v`
Expected: PASS (9 passed)

- [ ] **Step 7: Commit**

```bash
cd /Users/lala/Documents/GitHub/ooh-recommend
git add backend/src/services/recommend_react/tools.py backend/tests/test_recommend_react.py
git commit -m "feat: recommend_react 도구 5종(검색/설명/제안서) 클로저 팩토리"
```

---

## Task 5: 그래프 조립 + 라우팅 (graph.py 2부)

**Files:**
- Modify: `backend/src/services/recommend_react/graph.py`
- Test: `backend/tests/test_recommend_react.py`

- [ ] **Step 1: 실패 테스트 — route_after_tools 가드레일**

`backend/tests/test_recommend_react.py`에 추가:

```python
from langchain_core.messages import AIMessage, ToolMessage
from src.services.recommend_react.graph import route_after_tools, NOT_FOUND_MARKER


def _ai_with_tool_call():
    return AIMessage(content="", tool_calls=[{"name": "SearchMedia", "args": {}, "id": "c1"}])


def test_route_all_not_found_goes_fallback():
    state = {"messages": [
        _ai_with_tool_call(),
        ToolMessage(content=f"{NOT_FOUND_MARKER} 없음", tool_call_id="c1"),
    ]}
    assert route_after_tools(state) == "fallback"


def test_route_some_found_goes_chatbot():
    state = {"messages": [
        _ai_with_tool_call(),
        ToolMessage(content="1. 강남빌보드", tool_call_id="c1"),
    ]}
    assert route_after_tools(state) == "chatbot"
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && pytest tests/test_recommend_react.py -k route -v`
Expected: FAIL — `ImportError: cannot import name 'route_after_tools'`

- [ ] **Step 3: 그래프 State·노드·라우팅·build_graph 구현 (graph.py에 추가)**

```python
class ReactState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]


SYSTEM_PROMPT = (
    "당신은 한국 OOH(옥외광고) 매체 추천 상담 챗봇입니다.\n"
    "- 광고 조건(지역/업종/제품/목적/타깃/매체유형/예산)으로 매체를 찾을 때 SearchMedia 를 호출하세요. "
    "이전 대화에서 이미 조건이 있으면, 사용자가 '~도/추가로'처럼 더하는 뉘앙스면 이전 조건도 함께, "
    "'~만/대신/바꿔'처럼 교체 뉘앙스거나 조사 없이 새 값만 말하면 새 값으로 SearchMedia 를 호출합니다.\n"
    "- 여러 지역 비교나 '가장 싼 것' 같은 질문은 필요한 만큼 SearchMedia 를 호출한 뒤, 그 결과를 근거로 "
    "직접 비교·판단해 답하세요.\n"
    "- 직전 목록의 특정 매체를 물으면 ExplainMedia, 제안서(장바구니) 작업은 "
    "CreateProposal/AddMedia/RenameProposal 을 호출하세요.\n"
    "- 도구가 반환한 정보만 근거로 답하고, 없는 내용을 지어내지 마세요.\n"
    "- 최종 답변은 한국어로 친절하고 간결하게."
)


def _make_chatbot(llm_with_tools):
    def chatbot(state: ReactState):
        msgs = [SystemMessage(content=SYSTEM_PROMPT), *state["messages"]]
        return {"messages": [llm_with_tools.invoke(msgs)]}
    return chatbot


def _fallback(state: ReactState):
    return {"messages": [AIMessage(content=FALLBACK_MESSAGE)]}


def route_after_tools(state: ReactState) -> str:
    """마지막 도구 라운드 ToolMessage가 전부 NOT_FOUND면 fallback."""
    messages = state["messages"]
    last_ai = None
    for i in range(len(messages) - 1, -1, -1):
        if isinstance(messages[i], AIMessage) and getattr(messages[i], "tool_calls", None):
            last_ai = i
            break
    if last_ai is None:
        return "chatbot"
    tool_msgs = [m for m in messages[last_ai + 1:] if isinstance(m, ToolMessage)]
    if tool_msgs and all(NOT_FOUND_MARKER in str(m.content) for m in tool_msgs):
        return "fallback"
    return "chatbot"


def build_graph(ctx: "ReactContext"):
    from src.services.recommend_react.tools import build_tools

    tools = build_tools(ctx)
    llm_with_tools = get_chat(temperature=0.0).bind_tools(tools)

    workflow = StateGraph(ReactState)
    workflow.add_node("chatbot", _make_chatbot(llm_with_tools))
    workflow.add_node("tools", ToolNode(tools))
    workflow.add_node("fallback", _fallback)
    workflow.add_edge(START, "chatbot")
    workflow.add_conditional_edges("chatbot", tools_condition)
    workflow.add_conditional_edges(
        "tools", route_after_tools, {"chatbot": "chatbot", "fallback": "fallback"}
    )
    workflow.add_edge("fallback", END)
    return workflow.compile()
```

- [ ] **Step 4: 통과 확인**

Run: `cd backend && pytest tests/test_recommend_react.py -v`
Expected: PASS (11 passed)

- [ ] **Step 5: Commit**

```bash
cd /Users/lala/Documents/GitHub/ooh-recommend
git add backend/src/services/recommend_react/graph.py backend/tests/test_recommend_react.py
git commit -m "feat: recommend_react 그래프 조립 + NOT_FOUND 가드레일 라우팅"
```

---

## Task 6: collect_events 조립 + 저장 (graph.py 3부)

**Files:**
- Modify: `backend/src/services/recommend_react/graph.py`
- Test: `backend/tests/test_recommend_react.py`

- [ ] **Step 1: 실패 테스트 — collect_events가 events 리스트를 반환하고 마지막 chat을 붙인다**

`backend/tests/test_recommend_react.py`에 추가:

```python
from unittest.mock import MagicMock, patch
from langchain_core.messages import AIMessage
from src.services.recommend_react import graph as react_graph


def test_collect_events_appends_final_chat(monkeypatch):
    # 그래프가 list 이벤트를 push하고 최종 텍스트를 냈다고 가정
    def fake_build_graph(ctx):
        ctx.events.append({"type": "list", "message": "5개 찾음", "items": [], "match_count": 5})
        g = MagicMock()
        g.invoke.return_value = {"messages": [AIMessage(content="가장 싼 건 A입니다")]}
        return g

    monkeypatch.setattr(react_graph, "build_graph", fake_build_graph)
    monkeypatch.setattr(react_graph, "_load_history", lambda sid: [])
    monkeypatch.setattr(react_graph, "_persist_turn", lambda *a, **k: None)
    monkeypatch.setattr(react_graph, "_save_context", lambda *a, **k: None)
    monkeypatch.setattr(react_graph, "_load_context", lambda sid: (None, []))

    out = react_graph.collect_events("성수 제일 싼거", db=MagicMock(), top_k=20, session_id=None)
    assert out["error"] is None
    types = [e["type"] for e in out["events"]]
    assert types == ["list", "chat"]
    assert out["events"][-1]["message"] == "가장 싼 건 A입니다"


def test_collect_events_no_dup_chat_when_last_is_chat(monkeypatch):
    def fake_build_graph(ctx):
        ctx.events.append({"type": "chat", "message": "안녕하세요"})
        g = MagicMock()
        g.invoke.return_value = {"messages": [AIMessage(content="안녕하세요")]}
        return g

    monkeypatch.setattr(react_graph, "build_graph", fake_build_graph)
    monkeypatch.setattr(react_graph, "_load_history", lambda sid: [])
    monkeypatch.setattr(react_graph, "_persist_turn", lambda *a, **k: None)
    monkeypatch.setattr(react_graph, "_save_context", lambda *a, **k: None)
    monkeypatch.setattr(react_graph, "_load_context", lambda sid: (None, []))

    out = react_graph.collect_events("안녕", db=MagicMock(), top_k=20, session_id=None)
    assert [e["type"] for e in out["events"]] == ["chat"]  # 중복 chat 없음
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && pytest tests/test_recommend_react.py -k collect_events -v`
Expected: FAIL — `AttributeError: module ... has no attribute 'collect_events'`

- [ ] **Step 3: 컨텍스트 저장/로드 + persist + collect_events 구현 (graph.py에 추가)**

```python
def _load_context(session_id: Optional[str]) -> tuple[Optional[str], list[dict]]:
    """filter_context에서 (active_proposal_id, last_items) 로드."""
    if not session_id:
        return None, []
    from src.database import SessionLocal
    from src.models.ad_session import AdSession

    try:
        sid = uuid_lib.UUID(str(session_id))
    except (ValueError, AttributeError):
        return None, []
    with SessionLocal() as db:
        session = db.query(AdSession).filter(AdSession.id == sid).first()
        ctx = (session.filter_context if session else None) or {}
    return ctx.get("active_proposal_id"), (ctx.get("last_items") or [])


def _save_context(session_id: Optional[str], active_proposal_id: Optional[str], last_items: list[dict]) -> None:
    if not session_id:
        return
    from src.database import SessionLocal
    from src.models.ad_session import AdSession

    try:
        sid = uuid_lib.UUID(str(session_id))
    except (ValueError, AttributeError):
        return
    slim = [{"id": it.get("id"), "media_id": it.get("media_id"), "name": it.get("name")} for it in last_items]
    with SessionLocal() as db:
        session = db.query(AdSession).filter(AdSession.id == sid).first()
        if session is None:
            session = AdSession(id=sid, thread_id=str(sid))
            db.add(session)
        session.filter_context = {"active_proposal_id": active_proposal_id, "last_items": slim}
        db.commit()


def _persist_turn(session_id: Optional[str], user_text: str, assistant_text: str, payload: Optional[dict]) -> None:
    """user + assistant 메시지 DB 저장(이력 메모리용). 실패해도 응답 계속."""
    if not session_id:
        return
    from src.models.ad_session import MessageRole
    from src.services.recommend_react.persist import persist_message  # Task 6 Step 4

    persist_message(session_id, MessageRole.user, user_text, None)
    persist_message(session_id, MessageRole.assistant, assistant_text, payload)


def collect_events(message: str, db: Session, top_k: int = domain.DEFAULT_TOP_K, session_id: Optional[str] = None) -> dict:
    """ReAct 그래프를 1회 invoke 하고 프런트 events 리스트를 반환한다."""
    active_pid, last_items = _load_context(session_id)
    ctx = ReactContext(
        db=db, session_id=session_id, top_k=top_k,
        last_items=last_items, active_proposal_id=active_pid,
    )
    try:
        graph_app = build_graph(ctx)
        history = _load_history(session_id)
        result = graph_app.invoke({"messages": [*history, HumanMessage(content=message)]})
        final = result["messages"][-1]
        final_text = final.content if isinstance(final.content, str) else str(final.content)
    except Exception as exc:
        return {"events": [], "error": str(exc)}

    events = ctx.events
    if final_text and (not events or events[-1].get("message") != final_text):
        events.append({"type": "chat", "message": final_text})

    _persist_turn(session_id, message, final_text, events[-1] if events else None)
    _save_context(session_id, ctx.active_proposal_id, ctx.last_items)
    return {"events": events, "error": None}
```

- [ ] **Step 4: persist 헬퍼 모듈 생성** `backend/src/services/recommend_react/persist.py`

```python
"""ad_messages 저장 헬퍼(독립) — recommend_v2._persist_message 포팅."""
from __future__ import annotations

import uuid as uuid_lib
from typing import Optional


def persist_message(session_id: Optional[str], role, content: str, payload: Optional[dict]) -> None:
    if not session_id:
        return
    try:
        from src.database import SessionLocal
        from src.models.ad_session import AdSession
        from src.services import ad_session_service as svc

        try:
            sid = uuid_lib.UUID(session_id)
        except (ValueError, AttributeError):
            return
        with SessionLocal() as db:
            session = db.query(AdSession).filter(AdSession.id == sid).first()
            if session is None:
                session = AdSession(id=sid, thread_id=str(sid))
                db.add(session)
                db.flush()
            svc.add_message(db, str(sid), role, content, payload)
    except Exception as exc:
        print(f"[recommend_react] message save failed: {exc}", flush=True)
```

- [ ] **Step 5: 통과 확인**

Run: `cd backend && pytest tests/test_recommend_react.py -v`
Expected: PASS (13 passed)

- [ ] **Step 6: Commit**

```bash
cd /Users/lala/Documents/GitHub/ooh-recommend
git add backend/src/services/recommend_react/graph.py backend/src/services/recommend_react/persist.py backend/tests/test_recommend_react.py
git commit -m "feat: recommend_react collect_events 조립 + 이력/컨텍스트 저장"
```

---

## Task 7: 잡 디스패치 (ai_job_service version 분기)

**Files:**
- Modify: `backend/src/services/ai_job_service.py:76-131` (enqueue), `:222-252` (process)
- Test: `backend/tests/test_recommend_react.py`

- [ ] **Step 1: 실패 테스트 — process가 version="react"면 react collector 호출**

`backend/tests/test_recommend_react.py`에 추가:

```python
from unittest.mock import MagicMock, patch


def test_process_dispatches_react_collector():
    from src.services import ai_job_service
    job = MagicMock()
    job.request = {"message": "성수", "top_k": 20, "version": "react"}
    with patch("src.services.recommend_react.collect_events", return_value={"events": [{"type": "chat", "message": "ok"}], "error": None}) as m, \
         patch.object(ai_job_service, "mark_processing"), \
         patch.object(ai_job_service, "load_filter_context", return_value=None), \
         patch.object(ai_job_service, "finish_job") as fin:
        ai_job_service.process_recommend_job(MagicMock(), job, message="성수", top_k=20, session_id="s1", version="react")
    m.assert_called_once()
    args, kwargs = fin.call_args
    assert args[2]["events"] == [{"type": "chat", "message": "ok"}]
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && pytest tests/test_recommend_react.py -k dispatches -v`
Expected: FAIL — `TypeError: process_recommend_job() got an unexpected keyword argument 'version'`

- [ ] **Step 3: enqueue_recommend_job에 version 추가**

`backend/src/services/ai_job_service.py`의 `enqueue_recommend_job` 시그니처(현재 line 76-78)를 수정:

```python
def enqueue_recommend_job(
    db: Session, *, message: str, top_k: int, session_id: str | None, version: str = "v2"
) -> AiRecommendJob:
```

`request` dict 2곳(limit 분기 line 90, 정상 line 100)에 `"version": version` 추가. 예:

```python
        request={"message": message, "top_k": top_k, "version": version},
```

로컬 인라인 폴백 호출(line 112)과 SQS 메시지 body(line 120-127)에도 version 전달:

```python
        process_recommend_job(
            db, job, message=message, top_k=top_k, session_id=session_id, version=version
        )
```
```python
        MessageBody=json.dumps(
            {
                "job_id": str(job.id),
                "session_id": session_id,
                "message": message,
                "top_k": top_k,
                "version": version,
            }
        ),
```

- [ ] **Step 4: process_recommend_job에 version 분기**

`process_recommend_job` 시그니처(line 222-229)에 `version: str = "v2"` 추가하고, 본문(line 235-252)을 분기:

```python
def process_recommend_job(
    db: Session,
    job: AiRecommendJob,
    *,
    message: str,
    top_k: int,
    session_id: str | None,
    version: str = "v2",
) -> None:
    import asyncio

    mark_processing(db, job)
    if version == "react":
        from src.services.recommend_react import collect_events

        result = collect_events(message, db, top_k=top_k, session_id=session_id)
        finish_job(db, job, {"events": result["events"]}, result.get("error"))
        return

    from src.services.recommend_v2 import collect_recommend_events

    filter_context = load_filter_context(db, session_id)
    save_fn = make_save_filter_context_fn(session_id)
    result = asyncio.run(
        collect_recommend_events(
            message, db, top_k=top_k, filter_context=filter_context,
            session_id=session_id, save_filter_context_fn=save_fn,
        )
    )
    finish_job(db, job, {"events": result["events"]}, result.get("error"))
```

> Lambda consumer(`lambda_handler`)가 SQS body에서 version을 읽어 `process_recommend_job(..., version=body.get("version", "v2"))`로 넘기도록 함께 수정한다. handler 위치는 구현 시 `grep -rn "process_recommend_job" backend/`로 확인.

- [ ] **Step 5: 통과 확인 + v2 회귀 확인**

Run: `cd backend && pytest tests/test_recommend_react.py -k dispatches -v && pytest tests/test_recommend_v2.py -v`
Expected: react 테스트 PASS, v2 테스트 전부 PASS(회귀 없음)

- [ ] **Step 6: Commit**

```bash
cd /Users/lala/Documents/GitHub/ooh-recommend
git add backend/src/services/ai_job_service.py backend/tests/test_recommend_react.py
git commit -m "feat: 잡 디스패치에 version 분기(react collector)"
```

---

## Task 8: 라우터 + 등록

**Files:**
- Create: `backend/src/routers/recommend_react.py`
- Modify: `backend/src/main.py`

- [ ] **Step 1: 라우터 생성**

`backend/src/routers/recommend_react.py`:

```python
"""/recommend/react — ReAct 추천(비동기 잡 enqueue + 폴링). v2와 독립."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from src.database import get_db
from src.services.recommend_react.domain import DEFAULT_TOP_K

router = APIRouter(prefix="/recommend/react", tags=["recommend-react"])


class ReactJobCreate(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    session_id: str | None = None
    top_k: int = Field(DEFAULT_TOP_K, ge=1, le=100)


class ReactJobStatus(BaseModel):
    job_id: str
    status: str
    result: dict | None = None
    error: str | None = None


@router.post("/jobs", response_model=ReactJobStatus, status_code=status.HTTP_202_ACCEPTED)
def create_react_job(body: ReactJobCreate, db: Session = Depends(get_db)):
    from src.services.ai_job_service import enqueue_recommend_job

    job = enqueue_recommend_job(
        db, message=body.message, top_k=body.top_k, session_id=body.session_id, version="react"
    )
    return ReactJobStatus(job_id=str(job.id), status=job.status)


@router.get("/jobs/{job_id}", response_model=ReactJobStatus)
def get_react_job(job_id: str, db: Session = Depends(get_db)):
    from src.services.ai_job_service import get_job

    job = get_job(db, job_id)
    if not job:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "job not found")
    return ReactJobStatus(job_id=str(job.id), status=job.status, result=job.result, error=job.error)
```

- [ ] **Step 2: main.py에 라우터 등록**

`backend/src/main.py`에서 기존 recommend_v2 라우터 등록부를 찾아(Run: `grep -n "recommend_v2\|include_router" backend/src/main.py`) 바로 아래에 추가:

```python
from src.routers import recommend_react
app.include_router(recommend_react.router)
```
(기존 import/등록 스타일에 맞춰 배치 — 파일 상단 import 그룹 + 등록 그룹)

- [ ] **Step 3: 앱 기동 스모크 확인**

Run: `cd backend && python -c "from src.main import app; print([r.path for r in app.routes if 'recommend/react' in r.path])"`
Expected: `['/recommend/react/jobs', '/recommend/react/jobs/{job_id}']`

- [ ] **Step 4: Commit**

```bash
cd /Users/lala/Documents/GitHub/ooh-recommend
git add backend/src/routers/recommend_react.py backend/src/main.py
git commit -m "feat: /recommend/react 라우터 추가 + 등록"
```

---

## Task 9: 로컬 통합 검증 (인라인 잡)

SQS 미설정 로컬에서 enqueue가 인라인 처리(`process_recommend_job`)되므로, 잡 1건이 실제 그래프를 돌려 events를 만드는지 확인한다.

**Files:**
- Test: `backend/tests/test_recommend_react.py`

- [ ] **Step 1: 통합 테스트(모킹된 LLM+DB)로 그래프 왕복 검증**

`backend/tests/test_recommend_react.py`에 추가. LLM 도구호출을 스텁해 chatbot→tools→chatbot→END 왕복을 검증:

```python
from langchain_core.messages import AIMessage
from src.services.recommend_react import graph as react_graph
from src.services.recommend_react.graph import ReactContext


def test_graph_search_then_answer(monkeypatch):
    """1턴: LLM이 SearchMedia 호출 → 결과 → 최종 답변(tool_calls 없음)."""
    fake_items = [{"id": "1", "media_id": "m1", "name": "성수빌보드", "price": "5000000"}]
    monkeypatch.setattr("src.services.recommend_react.tools._run_search", lambda ctx, text: (fake_items, 1))

    # bind_tools().invoke 를 2단계로 스텁: 1차=SearchMedia 호출, 2차=최종 텍스트
    calls = {"n": 0}

    class FakeLLM:
        def bind_tools(self, tools):
            return self
        def invoke(self, msgs):
            calls["n"] += 1
            if calls["n"] == 1:
                return AIMessage(content="", tool_calls=[{"name": "SearchMedia", "args": {"region": "성수"}, "id": "c1"}])
            return AIMessage(content="성수 매체 중 가장 비싼 건 성수빌보드입니다")

    monkeypatch.setattr(react_graph, "get_chat", lambda temperature=0.0: FakeLLM())
    monkeypatch.setattr(react_graph, "_load_history", lambda sid: [])
    monkeypatch.setattr(react_graph, "_persist_turn", lambda *a, **k: None)
    monkeypatch.setattr(react_graph, "_save_context", lambda *a, **k: None)
    monkeypatch.setattr(react_graph, "_load_context", lambda sid: (None, []))

    from unittest.mock import MagicMock
    out = react_graph.collect_events("성수 광고 찾아줘", db=MagicMock(), top_k=20, session_id=None)
    assert out["error"] is None
    types = [e["type"] for e in out["events"]]
    assert "list" in types and types[-1] == "chat"
    assert out["events"][-1]["message"].startswith("성수 매체")
```

- [ ] **Step 2: 통과 확인**

Run: `cd backend && pytest tests/test_recommend_react.py -v`
Expected: PASS (전체)

- [ ] **Step 3: 전체 백엔드 테스트 회귀 확인**

Run: `cd backend && pytest -q`
Expected: 신규 테스트 PASS + 기존 테스트 회귀 없음

- [ ] **Step 4: Commit**

```bash
cd /Users/lala/Documents/GitHub/ooh-recommend
git add backend/tests/test_recommend_react.py
git commit -m "test: recommend_react 그래프 왕복 통합 테스트"
```

---

## Task 10: 프런트 훅 (adRecommendReact)

기존 `hooks/adRecommendV2/useV2Chat.ts`를 복제해 엔드포인트만 react로 바꾸고 슬롯(removeSlot/조건칩) 로직을 제거한다. 렌더 컴포넌트(매체카드/제안서카드)는 기존 것을 그대로 사용.

**Files:**
- Create: `frontend/hooks/adRecommendReact/useReactChat.ts`
- Create: `frontend/hooks/adRecommendReact/index.ts`

- [ ] **Step 1: useV2Chat.ts를 복사해 useReactChat.ts 생성**

```bash
cd /Users/lala/Documents/GitHub/ooh-recommend/frontend
cp hooks/adRecommendV2/useV2Chat.ts hooks/adRecommendReact/useReactChat.ts
```

- [ ] **Step 2: 엔드포인트를 react로 교체**

`hooks/adRecommendReact/useReactChat.ts`에서:
- `` `${API_BASE_URL}/recommend/v2/jobs` `` → `` `${API_BASE_URL}/recommend/react/jobs` `` (enqueue, 현재 v2 line 446)
- `` `${API_BASE_URL}/recommend/v2/jobs/${jobId}` `` → `` `${API_BASE_URL}/recommend/react/jobs/${jobId}` `` (poll, line 479)

- [ ] **Step 3: 슬롯 로직 제거**

`useReactChat.ts`에서 `removeSlot` 콜백 전체(현재 v2 line 564-599 상당)와 그것이 쓰는 `consumeStream`/`/recommend/v2/slot/remove` 참조, 그리고 반환 객체에서 `removeSlot` export를 제거한다. `applyEventData`는 그대로 둔다(confirmation_required/need_more 분기는 이제 안 들어오지만 무해).

- [ ] **Step 4: index.ts 생성 (타입 재노출)**

`hooks/adRecommendReact/index.ts` — 기존 `hooks/adRecommendV2/index.ts`가 export하는 타입 목록을 동일하게 재노출하되 훅만 교체:

```bash
cd /Users/lala/Documents/GitHub/ooh-recommend/frontend
grep -n "export" hooks/adRecommendV2/index.ts
```
확인 후 동일 패턴으로 작성 (예):

```typescript
export { useReactChat } from "./useReactChat";
export type {
  V2Message,
  V2MediaItem,
  // ... adRecommendV2/index.ts와 동일한 타입들
} from "../adRecommendV2";
```

> 타입은 adRecommendV2에서 재노출(중복 정의 금지). 훅만 react용.

- [ ] **Step 5: 타입체크**

Run: `cd frontend && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 6: Commit**

```bash
cd /Users/lala/Documents/GitHub/ooh-recommend
git add frontend/hooks/adRecommendReact/
git commit -m "feat: adRecommendReact 프런트 훅(react 엔드포인트, 슬롯 제거)"
```

---

## Task 11: 화면 연결 (AiChatPanel 스위치)

기존 채팅 패널이 v2 훅 대신 react 훅을 쓰도록 전환. (검증 기간엔 둘 중 하나만 활성 — 여기서는 react로 전환하되 v2 파일은 남겨둠.)

**Files:**
- Modify: `frontend/app/(client)/(main)/fixed/_components/AiChatPanel.tsx`

- [ ] **Step 1: import·훅 호출 교체**

`AiChatPanel.tsx`에서 `useV2Chat`(adRecommendV2) 사용부를 찾아(Run: `grep -n "useV2Chat\|adRecommendV2\|removeSlot" frontend/app/\(client\)/\(main\)/fixed/_components/AiChatPanel.tsx`) `useReactChat`(adRecommendReact)로 교체한다. `removeSlot` 사용부(조건칩 X 버튼)가 있으면 함께 제거하거나 no-op 처리.

- [ ] **Step 2: 타입체크 + 조건칩/확인뷰 참조 정리**

Run: `cd frontend && npx tsc --noEmit`
Expected: 에러 없음. `ConditionChips`/`ConfirmationView` 참조가 removeSlot 부재로 깨지면, 해당 렌더 분기를 제거(react는 조건칩/확인 안 씀).

- [ ] **Step 3: 커밋**

```bash
cd /Users/lala/Documents/GitHub/ooh-recommend
git add "frontend/app/(client)/(main)/fixed/_components/AiChatPanel.tsx"
git commit -m "feat: 채팅 패널을 recommend_react 훅으로 전환"
```

---

## Task 12: 수동 E2E 검증 + 문서 로그

**Files:**
- Modify: `docs/log.md`, `docs/index.md`

- [ ] **Step 1: 로컬 백엔드+프런트 기동**

Run(별도 터미널): `cd backend && uvicorn src.main:app --reload --port 8001`
Run(별도 터미널): `cd frontend && npm run dev` (사용자 dev 서버 3000/3001 존중 — 이미 떠 있으면 재사용)

- [ ] **Step 2: 시나리오 수동 검증(채팅 UI 또는 curl)**

curl 예(세션 없이):
```bash
curl -s -X POST localhost:8001/recommend/react/jobs -H 'Content-Type: application/json' \
  -d '{"message":"성수 전광판 찾아줘"}' | tee /tmp/job.json
# job_id로 폴링
JID=$(python -c "import json;print(json.load(open('/tmp/job.json'))['job_id'])")
curl -s localhost:8001/recommend/react/jobs/$JID | python -m json.tool
```
Expected: `result.events`에 `type:"list"` + `items` 채워짐, 마지막 `type:"chat"`.

검증 시나리오:
1. "성수 전광판 찾아줘" → list 이벤트(매체카드)
2. "그중 제일 싼 거" → 추가 검색 없이 chat으로 최저가 지목(추론)
3. "성수랑 강남 비교해줘" → SearchMedia 2회 연쇄 후 비교 chat
4. "1번 3번으로 제안서 만들어줘" → proposal 이벤트(제안서카드)
5. "없는동네12345 광고" → fallback 고정 안내(지어내지 않음)

- [ ] **Step 3: docs/log.md·index.md 갱신**

`docs/log.md` 최상단에 한 줄(YYYY-MM-DD): recommend_react(ReAct) 신설 — v2 독립, 슬롯 제거, 잡 version 분기.
`docs/index.md`에 스펙/플랜 링크 추가.

- [ ] **Step 4: 커밋**

```bash
cd /Users/lala/Documents/GitHub/ooh-recommend
git add docs/log.md docs/index.md
git commit -m "docs: recommend_react 신설 로그/인덱스 갱신"
```

---

## 완료 기준 (검증 가능)

- [ ] `cd backend && pytest tests/test_recommend_react.py -v` 전부 PASS
- [ ] `cd backend && pytest tests/test_recommend_v2.py -v` 회귀 없음(v2 무변경)
- [ ] `cd frontend && npx tsc --noEmit` 에러 없음
- [ ] 수동 E2E 5개 시나리오 모두 기대대로(특히 #2·#3 추론 커버, #5 fallback)
- [ ] `git grep -n "from src.services.recommend_v2" backend/src/services/recommend_react` → **결과 없음**(독립성 확인)
