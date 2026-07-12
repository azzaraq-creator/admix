# 챗봇 앞단 의도 분류기 + Tool Calling 라우터 (2026-07-10)

> V2 추천 챗봇의 발화 분기를 **통일된 앞단 의도 분류기(Stage 1) + Tool Calling 라우터(Stage 2)** 구조로 재설계한다. 배경 파이프라인은 [recommend-v2](2026-05-27-recommend-v2-plan.md)·[v2-chatbot-port](2026-06-22-v2-chatbot-port.md), 비동기 실행 구조는 [sqs-lambda-async](2026-07-07-sqs-lambda-async-ai-recommend.md), 화면 정책은 [ai-media-recommend](../policies/ai-media-recommend.md) 참조.

> ⚠️ 이 문서는 **설계 스펙**이다. 구현 시작하면 각 단계 체크.

---

## 1. 배경 / 문제

현재 `_event_stream`([recommend_v2.py](../../backend/src/services/recommend_v2.py))은 **통일된 의도 분류기가 없다.** 대신 의도별 프로브를 우선순위 캐스케이드로 순차 호출한다:

1. `_has_proposal_hint(message)` 정규식(`:803`) 통과 시 → `_resolve_proposal_intent`(`:816`, LLM) — 제안서 의도면 처리 후 return.
2. 직전 리스트 존재 시 → `_resolve_media_question`(`:703`, LLM) — 특정 매체 질문이면 설명 후 return.
3. 기본값 → `extract_keywords`(`:216`, LLM) — 키워드 추출 → 추천.

문제점:
- **정규식 게이트**(`_has_proposal_hint`)가 제안서 의도를 놓칠 수 있다(사전에 없는 표현).
- 한 발화에 프로브가 최대 2콜 순차 실행 — 각 프로브가 "이게 내 의도야?"를 개별 판정.
- 전부 `.with_structured_output()`, `.bind_tools()` 미사용 → 툴 스키마·서브액션 선택이 enum(`ProposalIntent.action`)으로 하드코딩.
- 인사/서비스 소개 같은 **일반 발화 처리 부재** — "안녕"도 추천 경로(extract_keywords)로 흘러 어색한 응답.

## 2. 목표 / 결정 사항 (확정)

| 항목 | 결정 |
|---|---|
| 구조 | **2단계** — 분류기(Stage 1) → 라우터(Stage 2) |
| 의도 | **RECOMMEND · EXPLAIN · PROPOSAL · GENERAL** |
| 실행 위치 | **전부 Lambda** (`_event_stream` 내부 — `collect_recommend_events`가 재사용하므로 자동으로 Lambda에서 실행. EC2 LLM 콜 0 유지) |
| 스코프 | **기존 동작 보존, 앞단 캐스케이드만 교체** (pending 플로우·충돌감지·enrich·removeSlot·제안서 CRUD·매체설명 로직 전부 재사용) |
| Tool 방식 | **진짜 `.bind_tools()` 함수호출** |
| GENERAL 응답 | **하이브리드** — 고정 가드레일 프롬프트 + LLM 톤 생성 |
| 응답 스키마 | **불변** (프론트/tsc 무관) |

## 3. 목표 아키텍처

```
_event_stream(message, session, ...)   # Lambda에서 실행
 │
 ├─ [보존] pending 상태 처리 (그대로)
 │    · 슬롯 충돌 yes/no 확인
 │    · 제안서 pending (await_name / await_add_confirm)
 │    → 해당되면 기존 핸들러 실행 후 return  ← 분류기 안 탐
 │
 ├─ Stage 1 — 의도 분류기 (LLM 1콜, structured output)
 │    입력: message + has_last_list(bool) + has_active_proposal(bool)
 │    출력: intent ∈ {RECOMMEND, EXPLAIN, PROPOSAL, GENERAL}
 │    실패/애매 → RECOMMEND 기본값 (현 fallthrough와 동일 = 회귀 안전)
 │
 └─ Stage 2 — 라우터 (label별 bind_tools)
      RECOMMEND → bind_tools([extract_filter])
                    → 기존 filter_media_items → 충돌감지 → list/need_more/chat
      EXPLAIN   → bind_tools([explain_media])
                    → 기존 _iter_explain_event_data
      PROPOSAL  → bind_tools([create_proposal, add_media, rename_proposal])
                    → 기존 제안서 핸들러(create/add/rename)
      GENERAL   → 하이브리드 웰컴 응답 (툴 없음, type:"chat")
```

**콜 수**: 발화당 classify 1 + tool/welcome 1 = 최대 2콜 (현재도 최대 2콜 → 중립). 정확한 라우팅으로 오분류·정규식 누락 개선.

## 4. Tool 정의 (신규 모듈 `services/graph/tools.py`)

`.bind_tools()`에 넘길 Pydantic 툴 스키마. 라벨별로 필요한 subset만 bind → LLM이 tool_call 방출 → 파싱해 매핑된 기존 함수 실행.

| Tool | 인자 스키마 | 매핑되는 기존 로직 |
|---|---|---|
| `extract_filter` | `ind/prd/obj/tgt/loc/cat: list[str]`, `budget: int?` | `extract_keywords`(`:216`) 대체(동일 산출 `ExtractedCodes`) → `filter_media_items`(`:233`) |
| `explain_media` | `index: int?`(1-based) / `name: str?` | `_resolve_media_question`(`:703`) 대체 → `_iter_explain_event_data`(`:768`) |
| `create_proposal` | `name: str?`, `media_indices: list[int]?` | `ProposalIntent(action=create)` 경로(`:1254`~) |
| `add_media` | `media_indices: list[int]` | `ProposalIntent(action=add_media)` 경로(`:1222`~) |
| `rename_proposal` | `new_name: str` | `ProposalIntent(action=rename)` 경로(`:1194`~) |

- PROPOSAL 라벨일 때 3개 tool을 함께 bind → LLM이 서브액션(생성/담기/이름변경)까지 선택. 현 `ProposalIntent` enum + `_has_proposal_hint` 정규식 대체.
- tool_call 부재/스키마 불일치 시: RECOMMEND는 빈 코드로 처리(need_more), 그 외는 안내 chat로 graceful fallback.

## 5. Stage 1 분류기 (신규 모듈 `services/graph/intent_classifier.py`)

```
class Intent(BaseModel):
    intent: Literal["RECOMMEND", "EXPLAIN", "PROPOSAL", "GENERAL"]

def classify_intent(message, has_last_list, has_active_proposal) -> Intent:
    # get_chat(0.0).with_structured_output(Intent) 1콜
    # 시스템 프롬프트에 각 의도 정의 + 컨텍스트 힌트(직전 리스트/활성 제안서 유무)
    # 예외/애매 → Intent(intent="RECOMMEND")  (회귀 안전 기본값)
```

- EXPLAIN은 `has_last_list=False`면 후보에서 제외(직전 리스트 없으면 설명할 대상 없음 → RECOMMEND로).
- PROPOSAL 인덱스/이름 등 세부 인자는 Stage 2 tool_call에서 추출(분류기는 라벨만).

## 6. GENERAL(인사·정체성·범위밖) 처리 — 하이브리드

- **응답 = `type:"chat"` 한 건.** 요소: ①따뜻한 인사 ②페르소나 소개("옥외광고(전광판·지하철·버스 등) 매체를 추천하는 챗봇") ③첫 입력 가이드("어떤 지역/업종 광고를 찾으시는지 알려주세요").
- **하이브리드 생성**: 고정 가드레일 시스템 프롬프트가 위 3요소·금지사항(팩트 수치 지어내기 금지, 링크/칩 없음)을 강제하고, LLM(temp ~0.3)이 톤·문구를 자연스럽게 생성.
- **응답 스키마·프론트 변경 없음.** 기존 chat 말풍선 재사용. 예시 칩은 이미 빈 화면(`AiChatPanel.tsx` `FAQS`)에 존재 → **건드리지 않음.**

## 7. 신규 / 제거 / 보존

- **신규 파일**: `services/graph/intent_classifier.py`(Stage 1), `services/graph/tools.py`(Stage 2 스키마+디스패치), GENERAL 웰컴 프롬프트 상수.
- **제거**: `_has_proposal_hint`(정규식 게이트), 3-프로브의 "이거 내 의도야?" 판정부(`_resolve_proposal_intent`/`_resolve_media_question`의 분류 역할). 내부 실행 로직은 tool 핸들러로 흡수.
- **보존(손 안 댐)**: pending 플로우, `_detect_conflicts`/충돌 확인, `_enrich_*`, `removeSlot`(LLM 없음·EC2 동기), 세션/`filter_context` 저장, 비스트림 `recommend_v2()`(`:402`, 순수 추천), SQS/Lambda 인프라·폴링 API.
- `recommend_v2.py`가 이미 1600줄+ → 분류기/tool을 별도 모듈로 분리해 파일 비대화 방지.

## 8. 검증

- **회귀**: 기존 백엔드 테스트 통과.
- **의도별 수동 시나리오**:
  - RECOMMEND: "강남역 화장품 광고" → list/need_more.
  - EXPLAIN: 리스트 후 "3번 자세히" / "신사 BK빌딩 어때?" → media_detail.
  - PROPOSAL: "제안서 만들어줘" / "1,3번 담아줘" / "이름 XX로 바꿔줘" → proposal.
  - GENERAL: "안녕" / "여기 뭐하는 곳이야?" / "ㅎㅇ" → 웰컴+페르소나+가이드.
- **응답 스키마 불변** → 프론트/tsc 무관.

## 9. 리스크 / 미결정

- **분류기 오분류**: 경계 발화(예: "제안서" 언급하며 새 검색조건) → 프롬프트에 우선순위 규칙 명시 필요. 애매 시 RECOMMEND 기본값으로 안전.
- **bind_tools + gpt-4o-mini**: function calling 지원 확인됨. LangChain `.bind_tools()` + `response.tool_calls` 파싱 — 구현 시 실제 방출 포맷 검증.
- **콜드 스타트/콜 수**: GENERAL이 2콜(classify+welcome) — 필요시 캔드로 다운그레이드 가능.
- **8요소 가이드 vs 6슬롯**: 웰컴 가이드가 "기간(period)" 등 실제 슬롯에 없는 요소를 언급하지 않도록 프롬프트에서 실제 슬롯(지역·업종·제품·목적·타깃·매체유형·예산)만 안내.

## 10. 관련 문서
- [recommend-v2](2026-05-27-recommend-v2-plan.md) — 추천 파이프라인 원안
- [v2-chatbot-port](2026-06-22-v2-chatbot-port.md) — 툴 호출 분기 초안(extract_filter/explain_media/add_to_proposal)
- [sqs-lambda-async](2026-07-07-sqs-lambda-async-ai-recommend.md) — Lambda 비동기 실행 구조
- [ai-media-recommend](../policies/ai-media-recommend.md) — AI 매체추천 화면 정책
