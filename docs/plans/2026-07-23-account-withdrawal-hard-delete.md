# 회원 탈퇴 hard delete + 제안서 제출자 스냅샷 보존 (2026-07-23)

관련: [CONTEXT.md](../../CONTEXT.md) · [qa-fixes #9](../reviews/2026-07-22-qa-fixes.md) · [database-design](../policies/database-design.md)

## 배경 / 버그

- 개인정보처리방침이 **"탈퇴 즉시 파기"**. 그런데 코드는 탈퇴를 **soft delete**(`users.status="withdrawn"` + `withdrawn_at`)로 처리했다(`auth_service.withdraw`).
- 로그인 검사(`auth_service.authenticate`)는 탈퇴(403 "탈퇴한 계정입니다")와 제재(403 "서비스 이용이 제한되었습니다", MemberSanction 기간 판정)에 **다른 detail**을 주지만, 프런트 `LoginModal.tsx:116`이 **403이면 detail 무관하게 제재 모달**(`setRestrictedOpen`)을 띄운다 → 탈퇴 회원 로그인 시 "제재당한 것과 같은 모달"이 뜨는 버그.

## 사용자 결정

1. 탈퇴 = **hard delete**(실제 삭제). 로그인 시 일반 인증 실패(401 "이메일 또는 비밀번호가 올바르지 않습니다").
2. 기존 `status="withdrawn"` 계정도 삭제(스냅샷/백업 후).
3. 제안서는 CASCADE 삭제 대신 **제출 당시 신청자 스냅샷 5필드**(회원유형·회사명·이름·이메일·전화)를 보존.
4. 스냅샷 5필드 **모두 영구 보존**.
5. 소셜 재로그인 계정 복구(`_reactivate_if_withdrawn`) 제거 → 재로그인은 신규 가입.
6. 작성중(new, 미제출) 제안서는 장바구니로 보고 탈퇴 시 함께 삭제.

## 변경 요약

### A. 제안서 제출자 스냅샷 (선행 — 없으면 hard delete가 제안서를 파괴)

- `models/proposal.py`: 스냅샷 5컬럼 추가(`submitter_membership_type/company_name/name/email/phone`, nullable). `member_id` FK **CASCADE → SET NULL**.
- `models/user.py`: `User.proposals` relationship에서 `cascade="all, delete-orphan"` 제거 + **`passive_deletes=True`**. FK만 SET NULL로 바꿔도 ORM `delete-orphan`이 `db.delete(user)` 시 제안서를 지우므로 relationship도 함께 고쳐야 보존된다(핵심 함정).
- `services/proposal_service.py`: `snapshot_submitter(proposal, user)` 헬퍼 신설. admin 조회(`list_proposals`·`get_admin_detail`)를 **스냅샷 우선, member 조인 fallback**으로.
- `routers/proposals_client.py`: 제출(`submit_proposal`, new→execution_requested) 시점에 `snapshot_submitter` 호출로 박제.
- Alembic `036_proposal_submitter_snapshot`: 컬럼 추가 + FK 재생성(SET NULL, 이름 `fk_proposal_member_id`) + **백필**(제출된 회원 제안서 `status<>'new'`에 현재 member 정보 복사).

### B. Hard delete + 로그인

- `services/auth_service.py`: `withdraw()` soft → **hard delete**. 작성중(new) 제안서 선삭제 후 `db.delete(user)`. RefreshToken/SocialAccount/BusinessRegistration/MemberSanction은 FK/relationship CASCADE로 함께 삭제, 제출 제안서는 SET NULL + 스냅샷 보존.
- `services/oauth_service.py`: `_reactivate_if_withdrawn` 정의·호출 2곳 제거(재로그인=신규가입). `_ensure_not_sanctioned`는 유지.
- **로그인 가드는 유지**(`auth_service.py:109-110`, `deps.py:37-38`의 withdrawn 체크). hard delete 후엔 withdrawn 상태가 안 생겨 도달 불가한 무해한 잔존이며, 기존 withdrawn 삭제 완료 전 안전망(가드 먼저 제거하면 잔존 withdrawn이 로그인 가능해지는 보안 회귀).
- `scripts/delete_withdrawn_accounts.py`: 기존 withdrawn 일회성 삭제(dry-run 기본, `--apply`). 036 backfill 후·백업 후 실행.

### 프런트

**수정 없음.** hard delete 후 탈퇴 계정은 401로 떨어지고 제재만 403 → 제재 모달이 올바르게 동작.

## 배포 순서 (게이트 — 반드시 이 순서)

1. **DB 스냅샷/백업**.
2. `alembic upgrade head`(036) — 컬럼 추가 + 제출 제안서 스냅샷 백필.
3. `python -m scripts.delete_withdrawn_accounts` (dry-run으로 대상 확인) → `--apply`.
4. 코드 배포(hard delete withdraw + oauth 변경).
- 2·3이 완료되기 전에 로그인 가드를 제거하면 잔존 withdrawn 계정이 로그인 가능해진다(가드는 이번 변경에서 제거하지 않음).

## 컴플라이언스 게이트 (코드 밖 — 사용자/법무)

- 스냅샷 개인정보(이름·이메일·전화) **영구 보존**은 "탈퇴 즉시 파기"와 충돌한다. 전자상거래법 등 거래기록 보존 예외는 통상 **분리 보관 + 유한 기간**이라 "영구 + 라이브 테이블 보존"과 결이 다르다.
- 개인정보처리방침에 **제안서(거래기록) 보존 항목·근거·기간**을 명문화해야 한다. 이는 배포 전 법무 확인 사항.

## 검증

`backend/tests/test_account_withdrawal.py` (실제 postgres) 5 케이스:
- `snapshot_submitter` 필드 복사, hard delete 시 제출 제안서 보존(member_id NULL + 스냅샷)·작성중 삭제, MemberSanction CASCADE, 삭제 계정 로그인 401, admin 상세 스냅샷 우선.
- 전체 백엔드 97 passed(회귀 없음).

## 스코프 밖

- custom(맞춤제안) 생성 경로는 현재 코드에 status="custom" 세팅부가 없어 미대응(기존 데이터는 backfill이 커버).
- `_ensure_not_sanctioned`가 `status=="sanctioned"`를 쓰는 반면 이메일 로그인은 MemberSanction 기간으로 판정하는 기존 불일치는 미변경.
- `handleWithdraw`(프런트 profile) 등 UI 흐름은 백엔드 `/auth/withdraw` 호출만 하므로 무변경.
