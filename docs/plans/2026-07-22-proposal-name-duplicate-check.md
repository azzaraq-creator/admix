# 제안서 이름 중복검사 (생성·이름변경)

> 2026-07-22. 같은 소유자가 동일 이름의 제안서를 만들거나 그 이름으로 변경하지 못하도록 차단.
> 관련: [proposals](../policies/proposals.md) · [chat-usage-tier-limit](2026-07-13-chat-usage-tier-limit.md)(동일 티어 구조)

## 범위

- **이번 구현**: 제안서 **생성 + 이름변경(rename)** 시 이름 중복검사.
- **한도 도달 다이얼로그 통일**: 생성 개수 한도 초과(409 `limit_reached`) 안내를 `useProposalLimitDialog` 훅으로 추출해 **`ProposalsView`와 `AddToProposalModal`(담기 모달) 공용**. 이전엔 `ProposalsView`에만 있었고 담기 모달은 미처리였음.
- **보류(별도 작업)**: 한도/중복 다이얼로그의 Figma 디자인 2종 반영. 링크된 Figma 노드가 딤 배경(scrim)만 있어 카드/문구 추출 불가 → 디자인 재공유 필요. 현재 문구는 기존 `ProposalsView` 카피 유지.

## 규칙

- **소유자 단위**: 회원=`member_id`, 비회원=`session_id` 기준. 다른 소유자 간에는 같은 이름 허용.
- **삭제 제외**: `deleted_at IS NULL` 인 제안서만 비교(논리삭제된 이름은 재사용 가능).
- **정규화**: 앞뒤 공백 제거 + **대소문자 무시**(`lower(trim(title))`).
- **rename 자기 제외**: 자기 자신은 `exclude_id`로 제외 → 동일 이름 유지 rename 은 허용.
- **미적용 경로(의도적)**:
  - **챗봇**(`recommend_v2`의 생성·이름변경)은 서비스를 직접 호출 → 중복검사 미적용. 챗봇 스트림 오류/자동 생성 이름 충돌 방지 목적. 라우터 레벨 검사라 자동으로 우회됨.
  - **게스트→회원 승계**(`claim_guest_proposals`)도 미적용(자산 보존 우선).

## 구현

### 백엔드
- `proposal_service.title_exists(db, *, member_id, session_id, title, exclude_id=None) -> bool` 신설. 소유자/`deleted_at`/`lower(trim)` 비교/`exclude_id`. (`proposal_service.py`)
- 라우터(`proposals_client.py`)에서 호출 → 중복이면 **409** `{"detail": {"reason": "duplicate_name"}}`:
  - `POST /proposals` (create) — 생성 전 검사.
  - `PATCH /proposals/{id}` (rename) — `exclude_id=본인`으로 검사.
- **한도 초과 409는 `{reason:"limit_reached", tier, limit}`** 로 별개. 프런트는 `detail.reason`으로 분기.

### 프런트
- `hooks/proposals/apis.ts` — `proposalErrorReason(err)` 헬퍼(409의 `detail.reason` 추출).
- `AddToProposalModal.tsx`(생성) — 인라인 에러 문구 + 빨간 테두리(`nameError` 상태). 입력 변경/취소 시 초기화.
- `NewProposalModal.tsx`(/proposals 새 제안서) — `onCreate`를 `Promise<string | null>` 계약으로 변경(성공 null / 실패 문구). 실패 시 모달을 닫지 않고 **인라인 헬프텍스트** + 빨간 테두리, 성공 시에만 닫음.
- `ProposalsView.tsx` — `handleCreate`가 위 계약 구현. 중복이면 문구 반환(모달 인라인), 한도 초과는 문구 없이 모달 닫고 별도 안내 다이얼로그(`showLimitDialog`, `void`).
- `ProposalDetailView.tsx`(rename, blur 커밋) — 실패 시 **토스트**(`useSonner.error`).
- 중복 문구: "이미 사용 중인 제안서 이름입니다. 다른 이름을 입력해 주세요." — 문구·테두리 색은 `red-500`(`#ff2c20`, `globals.css`에 토큰 신설). 인라인 에러(AddToProposalModal/NewProposalModal) 적용.
- `hooks/proposals/useProposalLimitDialog.tsx` — 한도 도달 안내 다이얼로그 공유 훅(자체 `useConfirm`+`useRouter`). `proposalLimitTier(err)` 헬퍼로 tier 추출 → `ProposalsView`·`AddToProposalModal` 둘 다 `showLimitDialog(tier)` + `{limitDialog}` 사용. 한도 문구는 기존 카피(비회원 1건→회원가입 / 회원 5건→사업자 인증).

## 테스트 (재발방지)
`tests/test_proposal_service.py` (실 postgres):
- `title_exists` 단위 5종: 같은 소유자 존재 / trim·대소문자 / 다른 소유자 false / 논리삭제 제외 / `exclude_id` 자기 제외.
- 라우터 API(TestClient) 2종: 생성 중복 → 409 `duplicate_name`, rename 중복 → 409 + 동일 이름 유지 rename 200.
- 전체 22개 통과. 프런트 `tsc`/`eslint` 통과.

## 알려진 한계
- 애플리케이션 레벨 검사(선검사→생성)라 이론상 동시 생성 경합(TOCTOU) 가능. DB 유니크 인덱스(부분·표현식)까지는 미적용 — 기존 중복 데이터 존재 가능성 + 마이그레이션 리스크로 보류. 필요 시 후속 하드닝.
