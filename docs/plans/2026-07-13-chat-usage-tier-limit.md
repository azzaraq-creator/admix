# 챗봇 대화 횟수 티어별 제한 (PRD)

작성일 2026-07-13 · 브랜치 `feat/aws-migration-sqs-lambda`

## 1. 목적

AI 매체 추천 챗봇(믹시)의 무제한 사용을 티어별로 제한해 회원 가입·사업자 등록 전환을 유도한다. 현재는 비회원 포함 누구나 무제한 대화 가능.

## 2. 정책

| 티어 | 판별 | 제한 | 초과 시 유도 |
|---|---|---|---|
| **비회원(guest)** | `AdSession.user_id IS NULL` | **10회** | 로그인 |
| **일반회원(member)** | 로그인 O + 사업자 미승인 (`business_registration.status != "verified"`) | **30회** | 사업자 등록 |
| **사업자(verified)** | `business_registration.status == "verified"` | **무제한** | — |

- **카운트 단위**: 사용자 발화 1건 = 1회 (`AdMessage.role == user` 수). "와리가리 횟수"와 동일.
- **리셋**: 없음(총 누적, 평생). 결정 근거: 프로토타입 단계, 구현 최소화.
  - 비회원: `session_id` 기준 누적. 새 세션(session_id 재발급) 시작 시 리셋됨 — 쿠키/스토리지 삭제로 우회 가능하나 프로토타입 허용.
  - 회원: `user_id` 기준 전 세션 누적(기존 `count_user_chats` 재사용).
- **사업자 기준**: 승인 완료(`verified`)만 무제한. 심사중(`reviewing`)은 아직 member(30회) — 기존 제안서 제한 로직(`proposal_tier`)과 일관.

## 3. 티어 판별 방식 (중요)

챗 진입점 `POST /recommend/v2/jobs`는 **인증 헤더를 받지 않는다**(프론트가 raw `fetch`로 토큰 미전송). 따라서 로그인 유저 판별은 요청의 `session_id`로 한다:

```
session_id → AdSession 조회 → user_id → User + business_registration → tier
```

- 세션은 프론트 `api` 인스턴스(토큰 자동 첨부)로 `POST /chat/graph/sessions` 생성 시 `get_current_user_optional`로 `user_id`가 연결됨(`chat_graph.py:create_session`). 로그인 상태로 만든 세션은 소유자가 박혀 있음.
- `session_id`가 없거나 세션에 `user_id`가 없으면 guest로 처리.

## 4. 카운트 시점

user 발화는 파이프라인 내부(`recommend_v2.py:920 _persist_message(..., MessageRole.user, ...)`)에서 저장된다. 즉 **enqueue 시점의 카운트는 이번 발화 저장 전 = 과거 발화 수**.

→ `count >= limit`이면 차단. 예: guest limit 10 → 과거 10건 저장된 상태의 11번째 요청부터 차단(총 10회 성공).

## 5. 백엔드 변경

### 5.1 `services/chat_limit.py` (신규, 또는 recommend_v2 인접)
```
CHAT_GUEST_LIMIT = 10
CHAT_MEMBER_LIMIT = 30
def chat_limit(user) -> int | None   # guest=10, member=30, verified=None(무제한)
```
- 티어 판별은 기존 `proposal_service.proposal_tier(user)` 재사용(guest/member/verified).

### 5.2 `services/ad_session_service.py`
```
def count_session_chats(db, session_id) -> int   # 세션의 user role 메시지 수 (guest용)
```

### 5.3 `services/ai_job_service.py::enqueue_recommend_job`
job 생성 전에:
1. `session_id → AdSession.user_id → User(+business_registration)` 로드
2. `limit = chat_limit(user)`
3. `limit`이 있고 `count >= limit` (guest=`count_session_chats`, member=`count_user_chats`)이면:
   - job을 즉시 `status=done`, `result={"events":[<limit_reached>]}`로 기록하고 파이프라인 스킵·반환(SQS 미전송).

**limit_reached 이벤트 스키마**
```json
{
  "type": "limit_reached",
  "tier": "guest" | "member",
  "limit": 10,
  "action": "login" | "business",
  "message": "안내 문구",
  "cta": "버튼 텍스트"
}
```

**안내 문구**
- guest: `더 정확한 AI 매체 추천을 위해 로그인이 필요해요. 믹시와 계속 대화를 이어가보세요.` / CTA `로그인하고 계속` / action `login`
- member: `무제한으로 대화하려면 사업자 등록이 필요해요. 사업자 정보를 등록하고 믹시와 계속 대화를 이어가보세요.` / CTA `사업자 등록하기` / action `business` *(게스트 문구만 확정 받음, member 문구는 제안값 — 조정 가능)*

## 6. 프론트 변경

### 6.1 `hooks/adRecommendV2/useV2Chat.ts`
- `applyEventData`(:283)에 `limit_reached` 케이스 추가 → 해당 assistant 버블에 `message` + `cta`/`action` 세팅, 로딩 해제.
- hook state에 `limitReached`(+ `limitAction`) 추가해 반환.

### 6.2 `AiChatPanel.tsx`
- textarea `disabled`(:296)와 전송 버튼 `disabled`(:301) 조건에 `chat.limitReached` 추가.
- limit_reached 버블 하단에 CTA 버튼 렌더: `login` → 로그인 페이지/모달, `business` → 사업자 등록 화면.

## 7. 엣지 케이스

- **session_id 없음**: guest 취급(카운트 0). 첫 요청은 프론트가 세션 생성 후 보냄.
- **세션 소유자 탈퇴**: `user_id`가 SET NULL → guest로 강등(10회). 허용.
- **회원이 게스트 세션 이어받기**: 범위 밖(현 구조상 세션 소유 승계 없음).
- **동시 요청 레이스**: 프로토타입, 무시(카운트 약간 초과 가능).

## 8. 검증

- 백엔드: guest 세션으로 11회째 요청 시 `limit_reached` job 반환 확인. member/verified 경계.
- 프론트: `tsc --noEmit` 통과, limit_reached 시 입력창 비활성 + CTA 표시.

## 관련 문서
- [SQS/Lambda 비동기 AI 추천](2026-07-07-sqs-lambda-async-ai-recommend.md) — 챗 job 큐 구조
- [인텐트 분류·툴 콜링](2026-07-10-intent-classifier-tool-calling.md) — 파이프라인 이벤트
