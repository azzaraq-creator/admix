# API 정의서 (인증 · FAQ)

프론트엔드 연동용. 현재 백엔드에 구현·검증된 엔드포인트 기준.

| | |
|---|---|
| **최종 수정** | 2026-06-17 |
| **Base URL (로컬)** | `http://localhost:8000` (docker 실행 시 `http://localhost:8001`) |
| **Swagger** | `/swagger` · **ReDoc** `/redoc` |
| **대상 라우터** | `auth`, `oauth`, `faq` |

---

## 1. 공통 규약

### 인증 헤더
보호된 엔드포인트는 액세스 토큰을 Bearer 로 전달한다.

```
Authorization: Bearer <access_token>
```

### 토큰
- 로그인/회원가입/토큰갱신/소셜로그인 성공 시 `TokenResponse` 반환.
- **access_token**: 만료 1시간(3600s). API 호출용.
- **refresh_token**: 만료 7일(604800s). 갱신용. DB 저장되며 `refresh`/`logout` 시 회전·폐기.

```jsonc
// TokenResponse
{ "access_token": "eyJ...", "refresh_token": "eyJ...", "token_type": "bearer" }
```

### 에러 형식 (FastAPI 표준)
```jsonc
// 일반 에러 (4xx)
{ "detail": "이메일 또는 비밀번호가 올바르지 않습니다." }

// 입력 검증 실패 (422)
{ "detail": [ { "type": "...", "loc": ["body","email"], "msg": "...", "input": "..." } ] }
```

### 공통 상태코드
| 코드 | 의미 |
|---|---|
| 200 | 성공 |
| 201 | 생성됨 |
| 204 | 성공(본문 없음) |
| 401 | 인증 실패/토큰 무효 |
| 404 | 리소스 없음 |
| 409 | 충돌(중복) |
| 422 | 입력 검증 실패 |

### CORS
`FRONTEND_URL` 환경변수의 오리진 + `localhost`/`127.0.0.1`(임의 포트) 허용. credentials 허용.

---

## 2. 인증 — 이메일 (`/auth`)

### 2.1 회원가입 — `POST /auth/register`
가입 후 즉시 로그인(토큰 발급).

**Request**
```jsonc
{ "email": "user@example.com", "password": "비밀번호(8자 이상)", "name": "홍길동" }  // name 선택
```
**Response** `201` → `TokenResponse`
**에러**: `409` 이미 가입된 이메일 · `422` 이메일 형식/비밀번호 길이

> 주의: `email`은 예약 도메인(`.local`, `.test`, `example.com` 등) 불가(email-validator). 실제 도메인 사용.

### 2.2 로그인 — `POST /auth/login`
```jsonc
{ "email": "user@example.com", "password": "비밀번호" }
```
**Response** `200` → `TokenResponse`
**에러**: `401` 이메일/비밀번호 불일치

### 2.3 로그아웃 — `POST /auth/logout`
리프레시 토큰 폐기.
```jsonc
{ "refresh_token": "eyJ..." }
```
**Response** `204`

### 2.4 토큰 갱신 — `POST /auth/refresh`
리프레시 토큰으로 새 토큰 발급(**회전**: 기존 리프레시 토큰은 폐기됨).
```jsonc
{ "refresh_token": "eyJ..." }
```
**Response** `200` → `TokenResponse` (access·refresh 모두 새 값)
**에러**: `401` 무효/만료/폐기된 토큰

### 2.5 내 정보 — `GET /auth/me` 🔒
Bearer access 필요.
**Response** `200`
```jsonc
// UserResponse
{
  "id": "uuid", "email": "user@example.com", "name": "홍길동",
  "phone": null, "role": "user", "verified": false,
  "created_at": "2026-06-17T00:00:00Z"
}
```
**에러**: `401`/`403` 토큰 없음·무효

### 2.6 비밀번호 변경 — `POST /auth/change-password` 🔒
Bearer access 필요.
```jsonc
{ "current_password": "현재비번", "new_password": "새비번(8자 이상)" }
```
**Response** `204`
**에러**: `400` 현재 비밀번호 불일치 · `422` 새 비밀번호 길이

### 2.7 비밀번호 재설정 요청 — `POST /auth/password-reset/request`
```jsonc
{ "email": "user@example.com" }
```
**Response** `200`
```jsonc
{ "reset_token": "xxxx" }   // 미가입 이메일이면 null
```
> ⚠️ **개발 스텁**: 현재 토큰을 응답으로 직접 반환한다. 운영에서는 이메일 발송으로 전환 예정 → 프론트는 이 토큰을 화면에 노출하지 말 것(연동 시 정책 확인).

### 2.8 비밀번호 재설정 확정 — `POST /auth/password-reset/confirm`
```jsonc
{ "token": "xxxx", "new_password": "새비번(8자 이상)" }
```
**Response** `204` (성공 시 해당 사용자의 모든 리프레시 토큰 폐기)
**에러**: `400` 무효/만료/이미 사용된 토큰

---

## 3. 인증 — 소셜 로그인 (`/auth/sns`)

지원 provider: **`kakao`**, **`naver`**. (`google`은 미지원 → 404)

### 3.1 인가 URL 발급 — `GET /auth/sns/{provider}`
**Response** `200`
```jsonc
{ "url": "https://kauth.kakao.com/oauth/authorize?..." }
```
프론트는 이 `url`로 리다이렉트한다. **에러**: `404` 미지원 provider

### 3.2 콜백 — `GET /auth/sns/{provider}/callback?code=...&state=...`
provider redirect_uri 가 이 콜백을 호출한다. 코드 교환 → 프로필 조회 → 회원 연동/자동가입 → 토큰 발급.
**Response** `200` → `TokenResponse`
**에러**: `401` 토큰 교환/프로필 조회 실패

**플로우**
```
[프론트] GET /auth/sns/kakao  →  { url }
[프론트] location = url        →  카카오 로그인/동의
[카카오] redirect_uri(=/auth/sns/kakao/callback?code=...) 호출
[백엔드] 콜백 처리 → TokenResponse 반환
```
> 비고: redirect_uri 는 백엔드 `.env`(`KAKAO_REDIRECT_URI`/`NAVER_REDIRECT_URI`)와 provider 콘솔에 등록된 값이 일치해야 함. 현재 콜백은 `TokenResponse`(JSON) 반환 — 프론트로 리다이렉트(쿼리에 토큰) 방식이 필요하면 별도 협의. state CSRF 검증은 현재 미적용.

---

## 4. FAQ (`/faqs`)

> 현재 **쓰기(생성/수정/삭제)에 인증 가드 없음** (admin 로그인 구현 후 추가 예정).

### 공통 — `FaqResponse`
```jsonc
{
  "id": "uuid",
  "faq_type": "배송",          // null 가능
  "title": "배송 문의",
  "content": "3일 내 발송됩니다.",
  "sort_order": 0,
  "is_published": true,
  "created_by": null,           // 작성 admin id (uuid|null)
  "created_at": "2026-06-17T00:00:00Z",
  "updated_at": "2026-06-17T00:00:00Z"
}
```

### 4.1 생성 — `POST /faqs`
```jsonc
{
  "faq_type": "배송",          // 선택
  "title": "배송 문의",         // 필수 (1~300자)
  "content": "3일 내 발송",     // 필수 (1자 이상)
  "sort_order": 0,              // 선택, 기본 0
  "is_published": true,         // 선택, 기본 true
  "created_by": null            // 선택 (uuid)
}
```
**Response** `201` → `FaqResponse` · **에러**: `422`

### 4.2 목록 — `GET /faqs`
**Query**
| 파라미터 | 타입 | 기본 | 설명 |
|---|---|---|---|
| `faq_type` | string | - | 유형 필터 |
| `published_only` | bool | false | true 면 노출(is_published=true)만 |

정렬: `sort_order` → `created_at`.
**Response** `200` → `FaqResponse[]`
```
// 공개 페이지용 예: GET /faqs?published_only=true
```

### 4.3 단건 — `GET /faqs/{faq_id}`
**Response** `200` → `FaqResponse` · **에러**: `404`

### 4.4 수정(부분) — `PATCH /faqs/{faq_id}`
전달한 필드만 수정(미전달 필드는 유지).
```jsonc
{ "title": "배송 안내", "is_published": false }   // 모두 선택
```
**Response** `200` → `FaqResponse` · **에러**: `404` · `422`

### 4.5 삭제 — `DELETE /faqs/{faq_id}`
**Response** `204` · **에러**: `404`

---

## 5. 연동 예시

### 로그인 후 인증 호출 (fetch)
```ts
const { access_token, refresh_token } = await (await fetch(`${BASE}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
})).json();

// 보호 API 호출
const me = await (await fetch(`${BASE}/auth/me`, {
  headers: { Authorization: `Bearer ${access_token}` },
})).json();
```

### 401 시 토큰 갱신
```ts
const res = await fetch(`${BASE}/auth/refresh`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ refresh_token }),
});
// 200 → 새 access/refresh 저장, 401 → 재로그인
```

> 토큰 저장 위치(쿠키 vs 스토리지), 자동 갱신 인터셉터 정책은 프론트 합의 필요. refresh 는 회전식이라 갱신 응답의 새 refresh_token 으로 반드시 교체할 것.

---

## 6. 아직 없는 것 (연동 시 참고)

- **admin 로그인 API** 미구현 → FAQ 쓰기 가드/`created_by` 자동주입 보류.
- **아이디/비밀번호 찾기 UI 흐름**, 비밀번호 재설정 **이메일 발송** 미구현(현재 토큰 직접 반환 스텁).
- 소셜 콜백의 **프론트 리다이렉트(토큰 전달) 방식** 미정 — 현재 JSON 반환.
- 매체(media) 추천/조회 API는 별도 라우터(`/recommend`, `/chat/graph`)로 이 문서 범위 밖.
