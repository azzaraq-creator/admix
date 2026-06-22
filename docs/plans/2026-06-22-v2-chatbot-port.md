# V2 챗봇 — 현재 구조로 포팅 + 3개 기능 확장

> 2026-06-22 / 승인된 계획

## Context

백엔드에 키워드 사전 기반 OOH 추천 챗봇(V2)이 완성·등록돼 있으나(`/recommend/v2/*`), 프론트는 **구버전 디렉토리 구조** `app/(main)/ad-recommend-v2/`에만 존재한다. 현재 운영 구조인 `app/(client)/(main)/`에는 빈 `ad-recommend/`(.gitkeep) 폴더만 있다.

목표: 구버전을 정리하고 V2 챗봇을 현재 구조로 가져오면서 3가지를 추가한다.
1. 세션별 챗로그 전체 저장 + admin에서 모든 챗 로그 조회
2. 리스트의 특정 매체에 대한 질문 시 상세 설명
3. 리스트 생성 후 "제안서 담기"를 자연어 프롬프트로 실행 (별도 툴)

**사용자 결정 (확정):**
- 순서: **포팅 먼저, 기능 점진 추가** (Phase 0 → 1 → 2 → 3, 각 단계 검증 후 진행)
- **챗봇 위치: 별도 페이지 아님 → `fixed`의 `ChatPanel.tsx` "ai 모드"(믹시)에 연결**
- **챗봇 추천 리스트: 기존 지도 + `MediaDetailDrawer`에 연동**
- req2 제안서: **DB 영속화 전체 구축**
- 챗봇 의도 분기: **LLM 툴 호출** (extract_filter / explain_media / add_to_proposal)
- 레거시(구 v1 `app/(main)/`): **지금은 그대로 둠** (나중에 일괄 정리)

## ★ 핵심 데이터 발견 (DB 검증)

`media_items`(V2 키워드 필터용)와 `media`(media_master; 지도/Drawer/상세용)는 **동일한 913개 매체**다.
- **`thumbnail_url`이 913/913 완벽 1:1 대응** (distinct 913=913, NULL 0, 중복 0).
- 따라서 챗봇 결과(`media_items`) → `thumbnail_url`로 `media.media_id`(예: "AT-0001") 매핑 → 기존 지도/Drawer/`useMediaDetail`/`/media/{id}` 그대로 재사용 가능.
- **req2 단순화**: `detail.description` 재임포트 불필요. 조인된 `media.description`/주소/유동인구를 설명에 사용.

---

## 현재 상태 (탐색 결과)

| 영역 | 사실 | 파일 |
|---|---|---|
| V2 백엔드 | 완성·등록됨. 슬롯머신 + SSE. 메시지는 세션별 `ad_messages`에 이미 저장 | `backend/src/services/recommend_v2.py`, `routers/recommend_v2.py` (main.py 등록) |
| V2 프론트(구) | 828줄 패널 완성, **다크 cosmos 테마** (`--accent-cosmos`/`.orb`, 현재 앱에 없음) | `frontend/app/(main)/ad-recommend-v2/_components/AdRecommendV2Panel.tsx` |
| 현재 테마 | 라이트 민트 (`--color-primary-*` teal), `@theme` Tailwind v4 | `frontend/app/globals.css` |
| 세션 인프라 | 생성/조회/메시지/타이틀자동 — 재사용 가능 | `backend/src/services/ad_session_service.py`, `frontend/hooks/adSessions/` |
| admin 챗 페이지 | **목업 UI 셸**, 백엔드 호출 0 | `frontend/app/admin/(main)/chat/**` |
| 매체 상세 데이터 | V2 `media_items`는 빈약(name/fee/thumb/labels). 풍부한 `media`(media_master)는 **연결키 없음**. `detail.description`은 import 미반영 | `backend/src/models/media.py`, `scripts/import_media.py` |
| 제안서 | admin 집계 조회만(`GET /admin/proposals`). 매체-제안서 연결 테이블 없음. 프론트 `ProposalsView` 완전 목업 | `backend/src/models/proposal.py`, `frontend/app/(client)/(main)/proposals/_components/ProposalsView.tsx` |
| LLM | `get_chat()` ChatOpenAI 팩토리. `.with_structured_output()` 사용 중, `.bind_tools()` 가능 | `backend/src/services/graph/llm.py` |

---

## Phase 0 — V2 챗봇을 `fixed/ChatPanel` ai 모드에 연결

별도 페이지를 만들지 않는다. `ChatPanel.tsx`의 "ai 모드"(믹시) — 현재 인사말+FAQ+입력창은 있으나 **전송이 동작 안 하는 껍데기** — 를 V2 백엔드에 실제 연결한다.

### 백엔드 (소규모)
- `recommend_v2.py`: `MediaItemResponse`에 `media_id: Optional[str]` 추가. list 응답 빌드 시 선택된 items의 `thumbnail_url` → `media.media_id` **배치 매핑**(`Media` 테이블 조회)으로 채운다. 그래야 프론트가 기존 Drawer/지도를 열 수 있다.

### 프론트
- 챗 로직(세션 생성/복원, SSE 파싱, 슬롯, confirmation, removeSlot)을 **재사용 훅 `hooks/adRecommendV2/`** 로 추출 (구 `AdRecommendV2Panel.tsx` 로직 기반, `app/(main)/ad-recommend-v2/`에 원본 보존).
- `fixed/_components/ChatPanel.tsx` ai 모드 연결:
  - 세션: ai 모드 진입/첫 발화 시 `useCreateAdSession`으로 생성, 컴포넌트 state로 보유(멀티턴 + 챗로그 저장용).
  - 빈 상태: 기존 믹시 인사말 + FAQ 유지. FAQ 클릭 → 전송.
  - 대화 렌더: user/assistant 버블, 슬롯바(+X 제거), confirmation 빠른답, need_more.
  - **list 결과: 기존 `MediaItem` 컴포넌트로 렌더, 클릭 시 `onSelectMedia({id: media_id, ...})` → 기존 지도/`MediaDetailDrawer` 연동.**
  - 전송 버튼/textarea → 제출. 스타일은 현재 ChatPanel 디자인 유지.
- 사이드바 변경 없음 (fixed 내부 기능).

### 검증
- `tsc --noEmit` / `eslint` 통과 (Playwright 금지).
- `/fixed` ai 모드 → 발화 → 추천 리스트 → 매체 클릭 시 Drawer/지도 연동 확인 (dev 3000/3001은 사용자 것).

---

## Phase 1 — admin 챗로그 조회

### 백엔드
- `get_current_admin` 보호 엔드포인트: `GET /admin/chat/sessions`(목록·페이지네이션), `GET /admin/chat/sessions/{id}`(메시지 포함 상세). `ad_session_service` 재사용.

### 프론트
- `frontend/hooks/adminChat/` 신설. `ChatListView`/`ChatDetailView` 하드코딩 제거 → 실 API. 목록은 CommonTable 패턴.

### 검증
- admin 로그인 → `/admin/chat`에 실제 세션·메시지 렌더 확인.

---

## Phase 2 — 특정 매체 상세 설명 (LLM 툴 도입)

### 데이터
- `MediaItem`에 `description` 컬럼 추가 + alembic 마이그레이션.
- `scripts/import_media.py`에 `detail.description` 매핑 추가. **원본 엑셀 재임포트 필요(데이터 의존성).**

### 백엔드
- `recommend_v2.py` `_event_stream` 진입부를 **LLM 툴 라우터**로: `extract_filter`(기존 슬롯 래핑)/`explain_media`/`add_to_proposal`. 기존 슬롯머신은 extract_filter 경로로 보존.
- `explain_media`: 직전 list 매체를 인덱스/이름으로 해소 → description + enriched 라벨 + 가격/이미지로 LLM 설명. 직전 리스트 id를 세션에 보존.

### 프론트
- `AdRecommendPanel.tsx`에 매체 상세 응답 렌더 추가.

### 검증
- "3번 자세히" / "신사 BK빌딩 어때?" → 설명 응답. 슬롯 정제 발화 회귀 없음.

---

## Phase 3 — 제안서 담기 (DB 영속화 전체)

### 백엔드
- `proposal_item` 테이블 신설(proposal_id FK, media_item_id FK, name/price 스냅샷) + 마이그레이션. `Proposal.items` relationship. `media_count`/`total_amount` items 집계 갱신.
- 회원용 엔드포인트: `POST /proposals`(생성), `POST /proposals/{id}/items`(담기), `GET /proposals`(내 목록), `GET /proposals/{id}`(상세). **인증 바인딩 필요**(member_id ← 로그인 회원). 챗 세션 무인증 → 사용자 식별 경로 착수 시 확정.
- `add_to_proposal` 툴: 직전 list 매체 → 대상 제안서 담기. 미지정 시 생성 유도/기본.

### 프론트
- `hooks/proposals/` mutations 추가. `ProposalsView`/`NewProposalModal`/`ProposalDetailView` 목업 → 실 API. `AdRecommendPanel`에 담김 확인 렌더.

### 검증
- 로그인 회원 → 챗 리스트 → "제안서에 담아줘" → proposal_item 영속 → `/proposals`에 반영.

---

## 리스크 / 확인 필요
- **데이터 재임포트(Phase 2):** `detail.description` 채우려면 원본 엑셀 재import 필요. 엑셀 위치/보유 확인.
- **인증 바인딩(Phase 3):** V2 챗 세션 무인증 → 로그인 사용자·세션·제안서 연결 방식 착수 시 확정.
- 각 Phase 완료 시 tsc/lint/build 검증 (Playwright MCP 미사용).
