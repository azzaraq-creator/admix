# 소셜 계정 ↔ 이메일 계정 완전 분리 (2026-07-27)

> 소셜 로그인(카카오/네이버)이 **같은 이메일의 이메일가입 계정에 병합되던 동작을 폐기**하고, 소셜 계정을 항상 별개 계정으로 관리하도록 전환. 관련: [sns-email-verification-login-id](2026-07-09-sns-email-verification-login-id.md)(이 문서 §9의 login_id 매칭 정책을 뒤집음), [social-login-deploy-ops](2026-07-04-social-login-deploy-ops.md), 정책 [login](../policies/login.md) §3.4·§7.

---

## 1. 배경 / 문제

- 기존 `login_with_provider`는 연결된 `SocialAccount`가 없을 때 **제공자 이메일로 `User.login_id`를 조회**해 기존 계정에 소셜을 연동(병합)했다 ([2026-07-09](2026-07-09-sns-email-verification-login-id.md) §9에서 email→login_id 기준으로 바로잡은 그 로직).
- 결과: `wishmin82@naver.com`으로 **이메일 가입**한 계정이 있으면, 네이버 로그인 시 그 계정에 네이버가 붙어 **비밀번호 없이 기존 이메일 계정으로 로그인**됨.
- 요구: 이메일 가입 계정과 소셜 계정을 **진짜 별개 계정**으로 분리하고 싶다.

## 2. 결정 사항

- **분리 방식**: 소셜은 `SocialAccount(provider, provider_id)`로만 식별. 없으면 **무조건 신규 계정 생성**(이메일 매칭 폐기).
- **범위**: 이메일 / 네이버 / 카카오 **모두 분리** (이메일 매칭 블록을 통째로 제거하므로 세 경로 모두 별개).
- **기존 계정**: 이미 병합된 계정(이메일 계정 + 소셜 `SocialAccount`)은 **그대로 유지** — provider_id 조회에서 계속 잡히므로 분리는 **신규 로그인부터** 적용. 기존 병합 계정 소급 분리는 안 함(데이터 마이그레이션 위험·불필요).

## 3. 코드 변경 — `oauth_service.login_with_provider`

- **이메일 매칭 블록 제거**: `if profile.get("email"): user = db.query(User).filter(User.login_id == profile["email"]).first()` + 뒤따르던 `_ensure_not_sanctioned(user)` 호출 삭제(변수 고아화). `_ensure_not_sanctioned` 함수 자체는 재로그인 경로(`account is not None`)에서 계속 사용하므로 유지.
- **신규 계정 `login_id` 고정**: `login_id=profile.get("email") or f"{provider}_{provider_id}"` → **`login_id=f"{provider}_{provider_id}"`** (항상 provider 네임스페이스).
  - ⚠️ 이 변경은 **필수**다. 이메일 매칭만 지우고 `login_id`를 제공자 이메일로 저장하면, 이미 `login_id=<그 이메일>`인 이메일가입 계정과 **`login_id` UNIQUE 충돌(IntegrityError)로 콜백이 500**난다. `login_id` 유일성은 앞단 provider_id 조회가 동일 소셜계정을 먼저 걸러 보장.
- `email` 컬럼(연락받을, 비유니크)은 기존대로 `profile.get("email") or f"{provider}_{provider_id}@social.local"` placeholder 유지. 신규 소셜 유저 `verified=False`도 유지([2026-07-09](2026-07-09-sns-email-verification-login-id.md) §4 플로우 그대로 — 콜백 후 `/signup/sns` 이메일 인증).

## 4. UX 대가 (의도된 결과)

- 같은 사람이 **"네이버로 로그인"과 "이메일+비번 로그인"이 서로 다른 계정**에 들어감 → 한쪽에서 만든 제안서·문의가 다른 쪽엔 안 보인다.
- 기존에 이메일가입한 사람이 네이버로 **처음** 로그인하면, 전에는 "기존 계정 바로 로그인"이었으나 이제 "새 네이버 계정 생성 + `verified=False`라 이메일 인증 화면"으로 간다.

## 5. 운영 조치 / 배포

- **운영 DB에서 `wishmin82@naver.com` 삭제**: 해당 계정은 이미 네이버가 병합된 상태(이메일가입 login_id + naver SocialAccount, proposals 0)라 그대로 두면 배포 후에도 병합으로 보인다. 분리 동작을 깨끗하게 테스트하려고 cascade 삭제(유저+소셜계정+토큰). 잔여 0건 확인.
- **백엔드 재배포**(`deploy/redeploy.sh`, EC2 rebuild): oauth 분리 로직 자체는 마이그레이션 없음. `/health` ok, 운영 컨테이너에서 `login_id=f"{provider}_{provider_id}"` 반영 + 이메일 매칭 코드 0건 확인.

## 5-1. 후속 버그 — 회원가입 500 (email UNIQUE 인덱스 잔존) + 마이그 039

- **증상**: 네이버로 먼저 가입 → **같은 이메일로 이메일 가입** 시 `POST /auth/register` **500**. 로그: `IntegrityError (UniqueViolation) duplicate key value violates unique constraint "ix_users_email"`.
- **원인**: `users.email` 이 과거 `unique=True, index=True` 였던 시절 SQLAlchemy 가 만든 **UNIQUE 인덱스 `ix_users_email`** 가 운영 DB 에 잔존. 마이그 `031` 은 `pg_constraint`(제약)만 드롭해서 이 unique **인덱스**는 못 지웠다. 병합 시절엔 같은 email 계정이 2개 생길 일이 없어 안 터지다가, **분리로 email 중복 계정이 생기며** 충돌 → 500.
- **수정**: 마이그레이션 **`039`** — `users(email)` single-column unique 인덱스를 이름 비의존으로 찾아 드롭하고 non-unique 인덱스로 재생성(idempotent). `031` 의 미비점 보완. `email` 은 연락받을 이메일이라 중복 허용이 정책([2026-07-09](2026-07-09-sns-email-verification-login-id.md) §2)이므로 unique 이면 안 됨.
- **검증**: 로컬 postgres 에서 탐색 로직(unique single-col 인덱스를 컬럼명으로 정확히 탐지 — `login_id`→`ix_users_login_id`, `email`→없음)과 non-unique 재생성 확인. 운영 배포 후 `alembic current=039`, `ix_users_email` `indisunique=false` 확인. register 500 근본원인 해소.

## 6. 검증

- `py_compile` 통과, `_ensure_not_sanctioned`는 `:105` 정의 / 재로그인 경로에서만 사용(고아 아님).
- 운영 컨테이너 grep: `login_id=` → provider 네임스페이스 1건, `User.login_id == profile` → 0건.
- 소셜 로그인 자동화 테스트는 레포에 없음(외부 OAuth 의존).

## 7. 후속 / 남은 것

- `login.md` §8 open question "같은 이메일의 일반계정 ↔ 소셜계정 연동/충돌"이 이 결정으로 **완전 분리**로 닫힘.
- 기존 병합 계정을 소급 분리할지는 미결(현재 정책은 신규만 분리).
