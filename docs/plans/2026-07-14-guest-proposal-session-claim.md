# 게스트 제안서 세션 안정화 + 회원 승계 (PRD)

작성일 2026-07-14 · 브랜치 `feat/aws-migration-sqs-lambda`

## 1. 배경 / 문제

비회원(게스트) 제안서 담기에서 **"이미 제안서가 있는데도 없다고 판단해 제안서 생성 플로우로 빠지는"** 버그가 간헐 발생.

### 근본 원인
게스트 제안서 소유가 **휘발성 챗봇 세션 ID에 묶여** 있음.
- 게스트 식별자 = `localStorage["adRecommendV2.sessionId"]` = 챗 세션 id (`lib/session.ts` `getSessionId()`).
- `proposal.session_id`는 **`ad_sessions.id` FK**(SET NULL) → 제안서가 챗 세션에 강결합.
- `useV2Chat.ts:242-245` — 마운트 시 세션 복원 API(`adSessionsApi.get`)가 실패하면 **만료뿐 아니라 네트워크/일시 5xx에도** `localStorage.removeItem`으로 세션을 영구 삭제 → 그 세션에 묶인 제안서가 고아가 됨.
- 챗 세션 없이(=`getSessionId()` null) 매체 상세에서 바로 담기 → 조회 빈 결과 / 생성 400.

"간헐적 + 비회원 특히" 증상이 세션 소실과 정확히 부합(앞선 간헐 503 이슈와 연결).

## 2. 제약 (반영 완료)

- 비회원은 **챗 세션 1개만** 사용, **재시도 불가**, 대화 **10회 제한**([chat-usage-tier-limit](2026-07-13-chat-usage-tier-limit.md)).
- ∴ "세션 분리"를 별도 localStorage 키로 하지 않는다(세션 2개가 되어 정책 위반·10회 카운트 혼란). 대신 **단일 게스트 세션을 복원 로직의 휘발성에서 분리해 안정화**하고, 챗·제안서·장바구니가 이 하나의 세션을 공유한다.
- 세션 안정화는 10회 카운트 정확도도 함께 개선(세션이 안 바뀌면 `count_session_chats` 유지).

## 3. 해결 (3파트)

### 3.1 핫픽스 — 세션 소실 방지
`useV2Chat.ts` 복원 실패 처리(242-245):
- **404 / 410**(명확한 만료·삭제)일 때만 `removeItem` + `sessionId=null`.
- **그 외(네트워크 오류, 5xx 등 일시 오류)**: 세션 **유지**(`removeItem` 안 함), `sessionId=stored` 유지. 메시지 복원만 실패 처리.
- 판별: axios `err.response?.status`.

### 3.2 게스트 세션 안정화 — 담기/조회 null 방지
- 유틸 `ensureGuestSession()`(신규): `getSessionId()`가 있으면 반환, 없으면 `adSessionsApi.create(null)`로 세션 1개 생성해 `localStorage[SESSION_KEY]`에 저장 후 반환. (회원=토큰이면 불필요, `isMember()` 시 skip)
- `AddToProposalModal`이 열릴 때 게스트면 `ensureGuestSession()` 먼저 실행 → session_id 확보 후 `useMyProposals` refetch. 제안서 생성/담기 전에도 세션 보장.
- 단일 세션 정책 유지: `SESSION_KEY` 하나만 관리(챗과 공유).

### 3.3 회원 승계 API — 로그인/가입 시 게스트 제안서 이관
- **서버**: `POST /proposals/claim` (인증 필수). body `{ session_id }`.
  - `proposal_service.claim_guest_proposals(db, session_id, member_id)`:
    - 해당 `session_id` 소유(게스트) 제안서를 `member_id`로 이관, `session_id=NULL`.
    - 해당 `ad_session.user_id`도 `member_id`로 연결(챗 히스토리 승계).
  - 회원 제안서 한도(`MEMBER_LIMIT=5`)는 **승계 시 예외**(게스트 자산 보존). 게스트는 최대 1건(`GUEST_LIMIT=1`)이라 실무상 초과 없음.
  - 멱등: 이미 이관됐거나 대상 없으면 no-op(0건).
- **프론트**: `claimGuestProposals()` 헬퍼 — `getSessionId()`가 있으면 `POST /proposals/claim` 호출, 완료 후 제안서 쿼리 invalidate. 실패해도 로그인 흐름은 진행(best-effort).
  - 호출 지점 3곳(로그인 성공 = `setTokens` 직후): `oauth/[provider]/callback/page.tsx`, `(main)/_components/LoginModal.tsx`, `(auth)/signup/_components/SignupForm.tsx`.

## 4. 승계 후 게스트 세션 처리

- 승계 후 게스트 `session_id`는 회원 소유로 전환됨. 챗 세션도 user_id 연결됐으므로 그대로 이어서 사용 가능(localStorage 유지).
- 회원 전환 후에는 제안서 API가 토큰(member) 기준으로 동작(`_owner`가 회원이면 session_id 무시).

## 5. 엣지 케이스

- **게스트 세션이 아직 없음(챗 미사용)**: `ensureGuestSession`이 담기 시점에 생성 → 제안서 소유 확보.
- **세션 복원 일시 실패**: 핫픽스로 세션 유지 → 제안서 접근 보존.
- **회원이 이미 로그인**: claim은 게스트 session_id 없으면 no-op.
- **승계 대상 0건**: no-op.
- **동시/중복 claim**: 멱등(게스트 제안서 이미 이관되면 대상 없음).
- **10회 카운트**: 승계로 ad_session.user_id 연결 시 그 세션 발화가 회원 누적(`count_user_chats`)에 합산됨 — 의도된 동작(30회 한도 내).

## 6. 변경 파일

**백엔드**
- `services/proposal_service.py` — `claim_guest_proposals(db, session_id, member_id)` 추가
- `routers/proposals_client.py` — `POST /proposals/claim` (get_current_user 필수)

**프론트**
- `hooks/adRecommendV2/useV2Chat.ts` — 복원 실패 상태코드 분기(핫픽스)
- `lib/session.ts` (또는 신규 util) — `ensureGuestSession()`
- `components/common/AddToProposalModal.tsx` — 게스트 세션 보장
- `hooks/proposals/apis.ts` + mutations — `claim` API + 헬퍼
- 로그인 3곳 — `claimGuestProposals()` 호출

## 7. 검증

- 프론트 `tsc --noEmit` 통과.
- 백엔드: 게스트 세션으로 제안서 생성 → 로그인 → `POST /proposals/claim` → 회원 목록에 제안서 노출, `session_id` NULL 확인.
- 핫픽스: 세션 get 5xx 모킹 시 `SESSION_KEY` 유지 확인.

## 관련 문서
- [챗 대화 횟수 티어별 제한](2026-07-13-chat-usage-tier-limit.md) — 비회원 세션 1개·10회 제약 근거
- [SQS/Lambda 비동기 AI 추천](2026-07-07-sqs-lambda-async-ai-recommend.md)
