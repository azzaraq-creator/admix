# SNS 로그인 이메일 인증 + 아이디/이메일 분리 (2026-07-09)

> 카카오/네이버 소셜 로그인 시 **수신 가능한 이메일 인증**을 거치게 하고, 계정 식별자(**아이디 = login_id**)와 **연락받을 이메일(email)**을 개념적으로 분리한 작업. 관련: [social-login-deploy-ops](2026-07-04-social-login-deploy-ops.md), [password-reset-email-smtp](2026-07-08-password-reset-email-smtp.md), 화면은 Figma 기반.
>
> ⚠️ **[2026-07-27] 갱신**: 이 문서 §2·§9 의 "소셜을 제공자 이메일=login_id 로 **기존 계정에 매칭/병합**" 정책은 **폐기**됨. 소셜은 `SocialAccount(provider, provider_id)` 로만 식별하고, 이메일/네이버/카카오를 **별개 계정**으로 관리한다(신규부터). → [social-account-separation](2026-07-27-social-account-separation.md).

커밋: `3fba341`(SNS 이메일 인증+가입완료 화면) · `01a2164`(아이디/이메일 분리+프로필 SNS) · `aa0de97`(연락받을 이메일 변경 모달) · `00cf370`(admin 목록/상세 구분). 브랜치 `feat/aws-migration-sqs-lambda`.

---

## 1. 배경 / 문제

- 기존 SNS 로그인은 제공자 이메일이 없으면 **가짜 이메일**(`{provider}_{id}@social.local`)로 유저를 만들고 `verified=True`로 통과 → **수신 가능한 이메일이 없음**.
- `users.email` 하나가 **로그인 식별자 + 연락 이메일**을 겸해 개념이 섞임.

## 2. 데이터 모델 — 아이디 ↔ 이메일 분리

- **`users.login_id`** (마이그레이션 `030`): 로그인 아이디. `UNIQUE NOT NULL`.
  - 이메일 가입: `login_id = email` (동일)
  - SNS 가입: `login_id = 제공자(카카오/네이버) 이메일` (미제공 시 `{provider}_{provider_id}` 폴백)
  - 기존 유저 백필: `login_id = email`
- **`users.email`** = 연락받을(인증) 이메일. **UNIQUE 제약 제거**(마이그레이션 `031`, `uq_users_email` drop) — 수신 가능 여부만 검증하므로 중복 허용. 식별 유니크는 `login_id`가 담당.
- `register`/`authenticate`의 계정 조회를 `email` → **`login_id` 기준**으로 변경.
- `me`/`UserResponse`에 `login_id`, `sns_provider`(social_accounts 기반 프로퍼티, 이메일 가입은 `null`) 추가.

## 3. 이메일 인증코드 (신규)

- 테이블 **`email_verifications`**(마이그레이션 `029`): `email·code·expires_at·verified`, 코드 6자리, TTL **5분**.
- `auth_service`: `create_email_verification` / `send_email_verification_code`(SMTP) / `confirm_email_verification` / `is_email_verified`.
- 라우터: `POST /auth/email/verify/request`(코드 발송) · `POST /auth/email/verify/confirm`(코드 확인).
- **이미 가입된 이메일이어도 인증 통과** — 연락 이메일은 수신 가능 여부만 검증(중복 무관).

## 4. SNS 로그인 플로우

- **신규 SNS 유저는 `verified=False`**로 생성 → 콜백에서 `me.verified` 확인해 미인증이면 **`/signup/sns`(이메일 인증 화면)**으로.
- `/signup/sns`: 제공자 이메일 pre-fill(수정 가능) → 이메일 인증(코드) + 약관 동의 → `POST /auth/sns/complete`(인증된 이메일 확정 + verified=True + 마케팅 동의).
- **탈퇴 계정 재로그인 = 재가입**: `_reactivate_if_withdrawn`으로 `status=active` + `verified=False` 되살림(제재 계정은 계속 403). 이메일/비밀번호 로그인 경로는 미변경(탈퇴 차단 유지).
- **계정 선택 강제**: 카카오 `prompt=select_account`(로그아웃 없이 계정 선택 — 저장된 계정 여러 개면 선택 화면), 네이버 `auth_type=reprompt`. (초기 시도했던 **로그아웃-후-재로그인 방식은 UX 어색 + 콘솔 로그아웃리다이렉트 URI 필요로 폐기**.)
- **회원가입 완료 화면 `/signup/complete`**: 이메일/SNS 가입 완료 후 경유, `{이름}님 ... 추천해드릴게요` + 시작하기→홈. 웹/모바일 반응형.
- **proxy.ts**: 로그인 상태로 진입해야 하는 `/signup/sns`·`/signup/complete`를 `AUTH_ROUTES` 리다이렉트 **예외**에 추가(토큰 있어도 홈으로 안 튕김). ⚠️ 미들웨어라 변경 시 **프론트 dev 서버 재시작** 필요.

## 5. 프로필 화면 (`ProfileView`)

- 이름 밑: 로그인에 쓴 **SNS 배지**(카카오 노랑 / 네이버 초록 pill + 브랜드 아이콘, `me.sns_provider` 기준) + **`login_id`(가져온 이메일 = 아이디)** 표시.
- 계정 정보 "아이디" 행 → **"연락받을 이메일"**(`email`) 로 변경.
- **연락받을 이메일 변경 모달**(`ContactEmailChangeModal`): 전송(코드)→인증번호→변경하기 = `PATCH /auth/me/email`(코드 확인 후 email 갱신, **login_id 불변**, 중복 허용). 기존 `ProfileModalShell` 재사용.
- 모든 변경/등록 버튼 + 회원탈퇴 버튼에 `cursor-pointer`.
- 브랜드 아이콘 신설: `components/icons/KakaoBrandIcon`·`NaverBrandIcon`.

## 6. Admin 회원 (목록/상세)

- 목록 컬럼 순서: **No · 회원유형 · 가입 아이디 · 이름 · 연락받을 이메일 · 전화번호 · 회사명 · 사업자 인증 상태 · 마케팅 수신 · 가입일**. (이메일→연락받을 이메일 라벨, 회사명 위치 이동, `login_id` 컬럼 신규)
- 상세 기본 정보: "이메일" 행 → **가입 아이디 / 연락받을 이메일** 두 행으로 분리.
- `MemberRow`·`MemberDetail` 스키마 + `member_service`에 `login_id` 추가.

## 7. 운영 노트

- **백엔드는 Docker 컨테이너(`ooh-backend`)로 실행, 소스 볼륨 마운트/`--reload` 없음** → 코드 변경 반영은 `docker compose up -d --build backend` 필수. (로컬 uvicorn 34246은 8001 미점유 유령 프로세스.)
- 마이그레이션은 컨테이너와 **같은 postgres**(`ooh-postgres`, `ooh_recommend` DB, host 5433)에 적용. head `031`.
- **카카오/네이버 이메일 필수 수신**: `login_id`를 항상 제공자 이메일로 채우려면 각 콘솔에서 **이메일을 "필수 동의" 항목**으로 설정해야 함(미동의 시 `{provider}_{id}` 폴백). authorize scope는 등록 안 된 scope 요청 시 로그인 실패 위험이 있어 미변경.
- SMTP는 Gmail(`smtp.gmail.com`) 설정됨 → 인증코드 메일 실제 발송. 미설정 시 코드는 DB 생성되나 메일 미발송(비밀번호 재설정과 동일).

## 8. 검증

- 프론트 `tsc`·`eslint` 통과. 백엔드 임포트/라우트 등록 확인, 재빌드 후 실서버 openapi/응답 확인.
- E2E(throwaway 유저): 이메일 인증(오답 400/정답 통과), 이미 가입된 이메일 허용 + `login_id` 불변, 탈퇴 계정 재활성화, 연락 이메일 변경.

## 9. 후속 정교화 (같은 날 추가)

- **소셜 최초 로그인 매칭 버그 수정**: 연결된 SocialAccount가 없을 때 기존 유저 조회를 `email` → **`login_id` 기준**으로 변경. email(연락받을)은 비유니크라, 다른 계정의 연락 이메일과 제공자 이메일이 같으면 **엉뚱한 계정에 소셜 연결**되던 버그(예: 카카오 login_id=yuleemin·email=wishmin82 계정에 네이버 wishmin82 로그인이 붙음). 코드 수정 + 이미 생긴 잘못된 링크 1건 수동 삭제.
- **비밀번호 재설정 정책**: 이메일 가입자 전용 → `create_password_reset` 조회를 **`login_id`(가입한 이메일, 유니크) + `password IS NOT NULL`**로 한정. SNS 전용(비번 없음)·연락 이메일 중복 계정 제외. find-account 안내문 "가입한 이메일".
- **프로필 조건부 표시**: SNS 계정은 비밀번호가 없어(통제 불가) **비밀번호 행 미표시**, **연락받을 이메일 "변경"은 SNS 계정만**(이메일 가입은 login_id=email=식별자라 변경 불가).
- **이메일 회원가입에 이메일 인증 추가**(SNS와 동일 UI): 이메일+전송 / 인증번호+인증완료. **전송 시 login_id 중복 체크**(`GET /auth/register/email-available`) — SNS의 연락 이메일(중복 허용)과 달리 이메일 가입은 이메일=login_id라 중복 불가. `register`에 이메일 인증 완료 강제(미인증 400).
