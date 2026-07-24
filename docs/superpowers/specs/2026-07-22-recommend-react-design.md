# recommend_react — ReAct 추천 챗봇 (신규 버전) 설계

- 상태: 설계 확정 대기 (사용자 리뷰 전)
- 작성일: 2026-07-22
- 참고 레퍼런스: `/Users/lala/Documents/GitHub/ai_agent_re_Act_Pattern/app` (LangGraph ReAct 패턴)
- 대체 대상: `backend/src/services/recommend_v2.py` (검증 후 삭제 예정, 그전까지 폴백 유지)

---

## 1. 배경 / 목표

현재 `recommend_v2`는 **절차형 슬롯 머신**이다: LLM 키워드 추출(IND/PRD/OBJ/TGT/LOC/CAT) → DB AND 필터 → 광고비 내림차순 → 멀티턴 슬롯 충돌 판정(ADD/REPLACE) + 확인 프롬프트(need_more, confirmation_required). 1736줄 대부분이 슬롯/충돌/멀티턴 스테이지 로직이다.

**목표**: 레퍼런스의 LangGraph ReAct 패턴(추론→도구호출→재추론 순환, NOT_FOUND 가드레일 fallback)을 따르는 **완전 독립 신규 모듈 `recommend_react`**를 만든다. 슬롯 방식은 처음부터 없이 간다. LLM이 대화 맥락으로 조건 누적·교체를 판단하고, 제안서(장바구니) 로직을 도구로 편입해 자율 호출·연쇄한다.

**비목표**: recommend_v2 코드 수정/삭제(이번 범위 아님, v3 검증 후 별도), 신규 UI 컴포넌트(기존 매체카드/제안서카드 재사용).

---

## 2. 핵심 결정 (사용자 확정)

| # | 결정 | 확정 내용 |
|---|---|---|
| D1 | 접근 방식 | 새 버전을 그린필드로 신설, v2는 무변경 폴백 |
| D2 | 아키텍처 | 정식 LangGraph StateGraph + ToolNode + tools_condition + NOT_FOUND fallback |
| D3 | 전달 방식 | SSE 스트리밍 **제거**. 기존처럼 잡 enqueue → 폴링(로딩 스피너 후 렌더) |
| D4 | UI 계약 | 매체카드(이미지)·제안서카드 **유지**. 슬롯 확인 UI(need_more/confirmation)·조건칩 **폐기** |
| D5 | 멀티턴 조건 누적 | 슬롯 상태 없이 LLM이 대화 이력(맥락)으로 ADD/REPLACE 자율 판단 |
| D6 | 재사용 전략 | **완전 독립** 구현 (v2에서 import 안 함). v2 삭제 예정이므로 공유 추출 안 함 |
| D7 | 네이밍 | 모듈/라우터/훅 이름 `recommend_react` 계열 (v3 아님) |
| D8 | 도구 스코프 | v1 = 기본 5도구만. 비교·최저가·예산 플랜은 전용 도구 없이 LLM 추론으로 커버. 도구는 언제든 무구조변경 추가 가능 (§5.1) |

---

## 3. 제약 (조사로 확인된 사실)

1. **Lambda 슬림 의존성**: 비동기 잡 consumer(`process_recommend_job` → collector)는 `requirements-lambda.txt`로 배포되며 **langgraph를 의도적으로 제외**(현재 langchain-core + langchain-openai + openai만). → 접근법 2(정식 LangGraph)를 택했으므로 **`langgraph`를 Lambda 의존성에 추가**해야 함(트레이드오프). langgraph-checkpoint류는 불필요(메모리를 DB 이력으로 처리하므로 제외).
2. **프런트는 이미 잡 폴링 사용**: `hooks/adRecommendV2/useV2Chat.ts`가 `POST /recommend/v2/jobs` → `GET /recommend/v2/jobs/{id}` 폴링. SSE `/v2/stream`은 사실상 레거시. → "지금처럼 로딩 보여주는 식" = 잡 폴링 UX 유지.
3. **잡 결과 계약**: `job.result = {"events": [dict, ...], "error": str|None}`. 프런트는 `events`를 순회하며 `applyEventData(ev)`로 타입별 렌더. → ReAct 그래프도 **동일한 events 리스트**를 산출해야 프런트 무변경.
4. **프런트 이벤트 타입**(`applyEventData` 처리): `chat`(message), `list`(items+match_count), `media_detail`(media), `proposal`(proposal+cta+action), `confirmation_required`(폐기 대상), `need_more`(폐기 대상). 조건칩 필드 `enriched_extracted`/`previous_context_detail`도 폐기 대상.
5. **잡 통합 지점**: `ai_job_service.process_recommend_job`(Lambda consumer + 로컬 인라인 폴백 공용)이 유일한 파이프라인 진입점. 여기가 v2 vs react 분기 지점.

---

## 4. 아키텍처

### 4.1 그래프 구조 (레퍼런스와 동형)

```
START → chatbot ─(tool_calls 있음)──→ tools ─(NOT_FOUND 전부)──→ fallback → END
          │  ▲                          │
          │  └───(도구 결과 재추론)──────┘  (결과 있음)
          └──(tool_calls 없음)──→ END
```

- **chatbot 노드**: `llm.bind_tools([...])`가 대화 이력을 보고 도구 호출 여부·종류 판단(추론). 시스템 프롬프트로 도구 사용 규칙 주입.
- **tools 노드**: `ToolNode` — LLM이 결정한 tool_calls를 실제 실행하고 결과를 ToolMessage로 저장. **동시에 구조화 이벤트 dict를 state.emitted_events에 append**(아래 4.3).
- **fallback 노드**: 방금 도구 라운드 결과가 전부 NOT_FOUND면 LLM 재작문 없이 고정 안내 `chat` 이벤트 방출(할루시네이션 구조적 차단).
- 라우팅: `chatbot`→`tools_condition`(tool_calls 유무), `tools`→`route_after_tools`(NOT_FOUND 전부→fallback / 아니면→chatbot).

### 4.2 그래프 State

```python
class ReactState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]  # 대화 이력 + 도구 메시지
    emitted_events: Annotated[list[dict], operator.add]        # 프런트로 나갈 구조화 이벤트
    # 도구 실행 컨텍스트 (읽기 전용, invoke 시 주입)
    session_id: str | None
    last_items: list[dict]          # 직전 추천 리스트 (explain/add 인덱스 해소용)
    active_proposal_id: str | None  # 진행 중 제안서
```

### 4.3 도구가 이벤트를 만드는 방식

ToolNode가 도구를 실행하면 각 도구는 (a) LLM에게 돌려줄 **요약 문자열**(ToolMessage content)과 (b) 프런트로 나갈 **구조화 이벤트 dict**를 만든다. (b)는 state.emitted_events에 누적된다. 그래프 종료 후 `emitted_events` + 최종 chatbot 텍스트(`chat` 이벤트)를 합쳐 `{"events":[...]}`로 반환한다.

> 구현 노트: LangChain 도구는 순수 함수가 이상적이나, 여기서는 db 세션·session_id·last_items 컨텍스트가 필요하다. 매 요청마다 컨텍스트를 클로저/`functools.partial`로 바인딩해 도구를 생성하거나, LangGraph의 `InjectedState`/config 주입을 쓴다. (플랜 단계에서 택1 — 클로저 방식이 단순.)

---

## 5. 도구 세트

| 도구 | 파라미터 | 역할 | 방출 이벤트 |
|---|---|---|---|
| `SearchMedia` | region, industry, product, objective, target, media_type, budget (전부 optional) | 조건으로 매체 검색·필터·광고비 내림차순 상위 N | `list` (items, match_count). 0건이면 NOT_FOUND |
| `ExplainMedia` | index / name, aspect | 직전 리스트 특정 매체 상세 설명 | `media_detail` (media) |
| `CreateProposal` | name, media_indices | 새 제안서 생성 (+지정 매체 담기) | `proposal` (proposal, cta) |
| `AddMedia` | media_indices | 직전 매체를 현재 제안서에 담기 | `proposal` |
| `RenameProposal` | new_name | 제안서 이름 변경 | `proposal` |

- 슬롯 없음: SearchMedia는 매 호출이 그 시점 LLM이 대화 맥락에서 종합한 조건 전체로 검색. "강남도" → LLM이 홍대+강남으로 재호출(누적), "강남만" → 강남으로 호출(교체). 충돌 판정 코드 없음.
- 제안서 멀티턴 스테이지(await_name/await_add_confirm) 제거: 이름 없이 "제안서 만들어줘"면 LLM이 되묻는 `chat` 후, 다음 턴 이름을 받아 CreateProposal 호출(대화 맥락으로 처리). 제안서 한도(tier/limit) 초과는 도구가 limit 이벤트/안내로 반환.
- **완전 독립**: 도구 실행에 필요한 도메인 로직(키워드 추출, DB 필터, 정렬, 응답 아이템 포맷, 제안서 생성/담기, 매체 상세 설명)은 `recommend_react` 안에 자체 구현. v2/graph에서 import하지 않음.

### 5.1 도구 vs 추론 — 무엇에 도구가 필요한가 (사용자 확정)

ReAct 루프(chatbot⇄tools 왕복)에서 **모든 기능이 전용 도구를 요구하지 않는다.** 도구가 반환한 데이터 위에서의 고르기·비교·요약·정렬 판단은 LLM이 누적 messages를 재추론해 처리한다. 도구가 꼭 필요한 경우는 세 가지뿐: (1) 부수효과/액션(DB 쓰기 — 제안서 도구), (2) 데이터 접근(DB 질의 — SearchMedia), (3) 정확성 필수 계산.

| 질문 유형 | 처리 | 새 도구 |
|---|---|---|
| "성수 광고 다 찾고 제일 싼 거" | SearchMedia 1회 + 추론(정렬 결과에서 지목) | 불필요 |
| "성수와 강남 비교해줘" | SearchMedia×2 연쇄 + 추론(비교문) | 불필요 |
| "섞어서 5억짜리 플랜 짜줘" | SearchMedia + 추론으로 조합 | **불필요(v1 결정)** |

- **v1 스코프 확정**: 기본 5도구만. 비교·최저가·예산 플랜은 전용 도구 없이 **LLM 추론으로 커버**. 별도 CompareMedia/BuildPlan 도구는 만들지 않는다.
- **알려진 한계**: "5억 플랜"처럼 여러 매체 금액 **합산이 정확해야 하는** 요청은 LLM 산술이 근사·오차를 낼 수 있다. 정확한 금액이 요구되는 상황이 실제로 문제가 되면 phase 2에서 결정론적 `BuildPlan` 도구를 추가한다(그래프 구조 변경 없이 도구만 추가).
- **확장성**: 새 도구 추가 = 스키마 + 실행기 정의 후 bind_tools 목록에 등재. 그래프 노드/엣지는 불변. (CompareMedia·BuildPlan 등 언제든 무구조변경으로 편입 가능.)

---

## 6. 메모리 (멀티턴)

- langgraph checkpointer(MemorySaver/PostgresSaver) **미사용**. Lambda 잡은 매 폴링이 무상태이고 실제 처리는 consumer에서 1회 일어나므로 in-process 체크포인터가 세션을 넘겨 유지하지 못한다.
- 대신 **DB 대화 이력을 매 턴 로드**해 그래프 초기 `messages`로 주입. 메시지는 각 턴 종료 시 DB에 저장(user + assistant). → LLM이 이전 조건을 맥락으로 기억 → 조건 누적/교체 자율 판단(D5).
- `last_items`(직전 추천 리스트), `active_proposal_id`는 `AdSession.filter_context`에 얇게 저장(explain/add 인덱스 해소·제안서 연결용). 슬롯 코드(ind/prd/... pending_change)는 저장 안 함.

---

## 7. 엔드포인트 / 잡 통합

- **새 라우터** `backend/src/routers/recommend_react.py`, prefix `/recommend/react`:
  - `POST /recommend/react/jobs` — enqueue(version="react") → 즉시 job_id(202)
  - `GET /recommend/react/jobs/{id}` — 상태/결과 폴링
- **잡 디스패치**(공유 인프라 `ai_job_service` — v2 로직 아님):
  - `enqueue_recommend_job(..., version: str = "v2")` 인자 추가, SQS 메시지에 version 포함.
  - `process_recommend_job`에서 `version == "react"`면 `recommend_react.collect_events(...)` 호출, 아니면 기존 v2 collector. (분기 최소)
  - `collect_events(message, db, top_k, session_id) -> {"events":[...], "error":...}` — 그래프 invoke 후 결과 조립.
- **Lambda**: `requirements-lambda.txt`에 `langgraph>=0.2,<0.3` 추가.
- **프런트**: 새 훅 `hooks/adRecommendReact/`(기존 useV2Chat 구조 복제, 엔드포인트만 `/recommend/react/jobs`). 매체카드(`ChatMediaList`)·제안서카드 등 렌더 컴포넌트 재사용. 슬롯칩(`ConditionChips`)·`ConfirmationView`·`removeSlot`은 react 훅에서 제외.

---

## 8. 폐기 (react 버전에는 아예 없음)

슬롯 머신 전체: 카테고리 슬롯 상태, `_detect_conflicts`/충돌 요약, `classify_merge_intent`(ADD/REPLACE), `pending_change`, `pending_proposal` 멀티턴 스테이지, `need_more`, `confirmation_required`, `_remove_event_stream`/slot remove 엔드포인트, 조건칩(`enriched_extracted`/`previous_context_detail`).

---

## 9. 테스트 (신규 `test_recommend_react.py`)

- **도구 파서 단위테스트**: tool_calls dict → 도메인 객체 (LLM 없이).
- **그래프 라우팅**: tool_calls 있음→tools, 없음→END, 도구 결과 전부 NOT_FOUND→fallback.
- **가드레일**: SearchMedia 0건 → fallback 고정 안내(할루시네이션 없음).
- **다중 도구 연쇄**: "강남 전광판 찾아서 1번 제안서에 담아줘" → SearchMedia + AddMedia 한 턴 처리.
- **조건 누적**: "홍대" → "강남도" → 홍대+강남 검색 (대화 이력 주입 검증).
- v2 테스트(`test_recommend_v2.py`)는 무변경 유지.

---

## 10. 열린 항목 (플랜 단계에서 확정)

1. 도구 컨텍스트 주입 방식: 요청별 클로저 바인딩 vs LangGraph InjectedState — 클로저 권장.
2. 그래프 종료 후 `chat` 이벤트 생성 규칙: 도구가 이미 list/proposal을 방출한 턴에서 최종 chatbot 텍스트를 별도 `chat`으로 낼지, 마지막 구조화 이벤트에 message로 합칠지.
3. 제안서 "이름 없이 만들어줘"의 되묻기 UX(1턴 왕복) 문구.
4. LLM 모델: `get_chat`(기본) vs `get_chat_strong`(뉘앙스) — 도구 라우팅 정확도 보고 결정.

---

## 11. 구현 반영 — 제안서 도구 UX (2026-07-24)

member 토큰 E2E 검증(DB 영속 확인) 후 확정된 동작. 로그: [log.md](../../log.md) 2026-07-24.

### 11.1 제안서 선택 인라인 카드 (`proposal_choices` 이벤트)
담을/바꿀 대상 제안서가 애매(여러 개·이름 불일치)하면 텍스트로 되묻지 않고 **클릭 가능한 제안서 목록**을 방출한다.
- 이벤트: `{type:"proposal_choices", action:"add"|"rename", proposals:[{id,name,media_count}], media_ids?, new_name?}`
- 프런트: 각 제안서를 Figma [1058:31220] 폴더행 스타일 카드로 렌더(아이콘색 `platinum-300`). 클릭 시 action별로 `useAddProposalItems`(add) / `useRenameProposal`(rename, PATCH `/proposals/{id}`) 직접 호출. **성공 시에만** 완료(✓) 표시(실패는 toast + 재선택).

### 11.2 도구별 대상 결정 우선순위 (공통 패턴)
`AddMedia`·`RenameProposal` 모두: **① 지목 이름(proposal_name/target_name) → ② 세션 active → ③ 유일 → ④ 여러 개면 선택 카드**. 무단으로 "최근 제안서"에 적용하지 않는다.
- `AddMedia`: 매체는 `media_indices`(번호) + `media_names`(이름, 목록에 없으면 추측 금지). 제안서 없으면 **자동 생성 안 하고** 생성 안내.
- `RenameProposal`: 새 이름 없이도(여러 개면) 선택 목록 먼저 노출 → 카드 클릭 시 새 이름 입력(현재 `window.prompt`).

### 11.3 미구현 / 안티패턴 방지
- **DeleteProposal 도구 없음**(의도적). LLM은 "삭제 기능 없음"을 정직 안내.
- **LLM staleness/fabrication 방지**: 담기/이름변경 요청은 프롬프트로 **매번 도구 호출 강제** — "제안서 없어요"/"목록 보여줄게요"를 도구 없이 지어내거나 이전 턴 답을 재사용하지 않는다.
- **소유자 판정**: 잡 경로엔 토큰이 없어 `_proposal_owner_for_session`이 `AdSession.user_id`로 판정. 로그인 유저는 세션 생성 시 user_id 연결됨 → 회원 제안서 인식. (프런트 add/rename mutation은 토큰 기반 — 로그인 필수.)
