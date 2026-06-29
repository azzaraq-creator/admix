# FastAPI 인증/로그인 구현 정리

| | |
|---|---|
| **날짜** | 2026-06-16 |
| **스택** | FastAPI + SQLAlchemy + Alembic (PostgreSQL) |
| **범위** | 이메일 로그인 · 카카오/네이버 소셜 로그인 · 비밀번호 재설정 |
| **관련 정책** | [`docs/policies/login.md`](../policies/login.md) |
| **상태** | 구현 완료 · 로컬 검증 통과 (소셜 실연동·이메일 발송은 미검증) |

---

## 1. 배경 / 결정사항

- 초기에 `docs/policies/database-design.md` §3.1/§3.2 기반으로 `members`/`business_registrations`(개인/기업 등급 모델)를 만들었으나, **`members`를 버리고 `generate-projects` 스킬의 `users` 계열 스키마로 통일**하기로 결정.
- 기존 동작 라우터(`recommend_v2`, `chat_graph`)와 **병행** — auth 테이블을 추가만 하고 기존 기능은 건드리지 않음.
- 기존 코드베이스 컨벤션 유지: `src.` import, 네이티브 `UUID(as_uuid=True)` PK, timezone-aware datetime.
- 범위에서 제외: Google 로그인, SMS 인증(설계서엔 있으나 이번 요청 아님).

---

## 2. 데이터 모델 (`src/models/user.py`)

마이그레이션: `alembic/versions/004_create_auth_tables.py` (down_revision = `003_add_cat_category`)

| 테이블 | 핵심 컬럼 | 설명 |
|---|---|---|
| `users` | `email`(UK), `password`(nullable·소셜시 null), `name`, `phone`(UK), `role`, `verified`, `verify_token`, `created_at`, `updated_at` | 사용자 마스터 |
| `refresh_tokens` | `token`(UK), `user_id`(FK CASCADE), `expires_at`, `revoked` | DB 저장 리프레시 토큰 (로그아웃·회전 시 폐기) |
| `social_accounts` | `provider`, `provider_id`, `user_id`(FK CASCADE), `access_token`, `refresh_token`, `expires_at` · UNIQUE(`provider`,`provider_id`) | 카카오/네이버 계정 매핑 |
| `password_resets` | `token`(UK), `user_id`(FK CASCADE), `expires_at`, `used` | 비밀번호 재설정 1회용 토큰 (TTL 1시간) |

관계: `User` 1—N `refresh_tokens` / `social_accounts` / `password_resets` (all CASCADE).

---

## 3. API 엔드포인트

### 이메일 인증 (`src/routers/auth.py`, prefix `/auth`)

| Method | Path | 설명 | 응답 |
|---|---|---|---|
| POST | `/auth/register` | 회원가입(가입 후 자동 로그인) | 201 · `TokenResponse` |
| POST | `/auth/login` | 이메일/비번 로그인 | `TokenResponse` |
| POST | `/auth/logout` | 리프레시 토큰 폐기 | 204 |
| POST | `/auth/refresh` | 토큰 갱신(회전: 구 토큰 폐기) | `TokenResponse` |
| GET | `/auth/me` | 내 정보 | `UserResponse` |
| POST | `/auth/change-password` | 비밀번호 변경(현재 비번 확인) | 204 |
| POST | `/auth/password-reset/request` | 재설정 토큰 발급 | `{ reset_token }` |
| POST | `/auth/password-reset/confirm` | 토큰+새 비번으로 재설정(전 토큰·세션 폐기) | 204 |

### 소셜 로그인 (`src/routers/oauth.py`, prefix `/auth/sns`)

| Method | Path | 설명 |
|---|---|---|
| GET | `/auth/sns/{provider}` | authorize URL 발급 (`provider` ∈ kakao, naver) |
| GET | `/auth/sns/{provider}/callback?code=&state=` | 코드 교환 → 프로필 조회 → 유저 연동/생성 → `TokenResponse` |

소셜 연동 로직: `provider_id`로 기존 `social_accounts` 조회 → 있으면 그 유저, 없으면 이메일 매칭, 그래도 없으면 신규 `users` 생성(이메일 없으면 `{provider}_{id}@social.local` placeholder, `verified=True`).

---

## 4. 토큰 / 보안 (`src/utils/security.py`, `src/utils/deps.py`)

- **JWT**: HS256. access/refresh 분리(`type` 클레임), `sub`=user.id, 충돌 방지용 `jti`(랜덤) 포함.
- **만료**: access 3600s, refresh 604800s(7일) — `config.py` 설정값.
- **비밀번호**: passlib + bcrypt 해시.
- **의존성**: `get_current_user`(access 토큰 검증·`type==access`·유저 조회), `get_current_user_optional`.

---

## 5. 설정 (`src/config.py` / `.env`)

`.env`에 채워야 동작하는 값 (현재 코드 기본값은 placeholder):

```bash
JWT_ACCESS_SECRET=...        # 운영 필수 변경
JWT_REFRESH_SECRET=...       # 운영 필수 변경
JWT_ACCESS_EXPIRES=3600
JWT_REFRESH_EXPIRES=604800

KAKAO_CLIENT_ID=...
KAKAO_CLIENT_SECRET=...
KAKAO_REDIRECT_URI=http://localhost:8000/auth/sns/kakao/callback

NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...
NAVER_REDIRECT_URI=http://localhost:8000/auth/sns/naver/callback
```

---

## 6. 의존성 (`requirements.txt` 추가)

```
email-validator==2.2.0
python-jose[cryptography]==3.3.0
passlib==1.7.4
bcrypt==4.0.1        # passlib 1.7.4 ↔ bcrypt 5.x 비호환으로 4.0.1 핀
python-multipart==0.0.12
httpx>=0.27,<0.28
```

---

## 7. 검증

로컬 docker PostgreSQL(`docker compose up -d postgres`, 포트 5433)에서:

- `alembic upgrade head` 적용 + downgrade/upgrade 라운드트립 클린.
- auth 라우터만 마운트한 격리 테스트앱으로 end-to-end 통과:
  - register / 중복가입 409 / 잘못된 로그인 401 / login / me / 무토큰 차단
  - refresh 회전 + 구 토큰 폐기 / change-password 후 신규 비번 로그인
  - password-reset 발급·확인·재사용 토큰 400 / 미존재 이메일 → null
  - OAuth authorize URL 생성(kakao·naver) / 미지원 provider 404
- 수정한 버그: ① bcrypt 5.x 비호환 → 4.0.1 핀 ② 동일 초 발급 시 refresh 토큰 중복 → `jti` 추가.

---

## 8. 미해결 / 운영 전 보완

- [ ] **비밀번호 재설정 토큰을 응답 body로 반환 중** — 이메일 발송 인프라가 없어 dev 스텁. 운영에선 토큰을 응답하지 말고 이메일 발송으로 전환 필요(현재 계정 열거 + 토큰 노출 위험).
- [ ] **카카오/네이버 실제 토큰 교환 미검증** — client 자격증명 필요. authorize URL·라우팅까지만 확인.
- [ ] **OAuth state CSRF 검증 생략** — 세션 저장소 필요. 프런트 연동 시 추가.
- [ ] 콜백 응답을 JSON `TokenResponse`로 반환 중 — 프런트 연동 방식(리다이렉트+쿼리 vs JSON) 확정 필요.
- [ ] 로그인 정책서 미결정 항목(시도 제한/잠금, 동일 이메일 소셜↔일반 충돌, 비회원 토큰 이관 등) — `docs/policies/login.md` §8 참조.
- [ ] 설계서의 등급(개인/기업)·기업 사업자 정보·채팅 토큰 한도 모델은 `members` 철거와 함께 빠짐 — 추후 필요 시 `users` 확장 또는 별도 테이블로 재도입.
