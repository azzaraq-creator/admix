# 관리자 인증·권한 정책

> 구현 상태 기준 문서 (2026-07-06, 자동로그인·refresh는 2026-07-27 갱신). 관련: [로그인 정책](login.md) · [백엔드/DB 코드리뷰](../reviews/2026-07-06-backend-db-code-review.md) · [CONTEXT.md](../../CONTEXT.md)
> 커밋: `59ad3f1`(관리자 권한 체계), `cf48252`(로그아웃 폐기), `ac23a29`(로그인 토큰 보안), 자동로그인·admin refresh(§1, 마이그 038)

관리자(admin)는 회원(user)과 **별도 테이블·별도 토큰**이다. 소셜 로그인 포함 회원 인증은 [login.md](login.md) 참조. 이 문서는 admin 쪽 인증·인가와, 연계된 로그인 토큰 보안을 다룬다.

---

## 1. 관리자 인증 (베이스)

- admin 로그인(`POST /admin/auth/login`)은 `admin` 타입 access JWT + `admin_refresh` 타입 refresh 토큰을 발급. 프론트는 쿠키 `admin_token`/`admin_refresh_token`/`admin_persist`에 저장, axios 인터셉터가 `/admin/*` 요청에 access를 자동 첨부.
- 백엔드 가드 `get_current_admin`(`utils/deps.py`): 토큰 서명·만료·`type=="admin"` 검증 → DB 존재 → `status=="active"` 확인.
- **access 토큰**: 만료 `admin_token_expires`(2026-07-27부터 24h→**1h**). 만료 시 인터셉터(`lib/api.ts`)가 `/admin/auth/refresh`로 자동 재발급 후 원요청 재시도, 실패 시에만 `/admin/login`으로.

### 자동로그인·refresh (2026-07-27 추가)

회원(user) 인증과 동일 패턴을 admin에 미러링. **refresh 토큰은 `admin_refresh_tokens` 테이블에 SHA-256 해시로 저장**(마이그레이션 038), FK는 `admin.id` CASCADE.

- **자동로그인 체크(remember=true)**: refresh 만료 `admin_refresh_expires_remember`(**30일**), 프론트는 access·refresh·persist 쿠키를 30일 `max-age`로 저장. refresh 때마다 30일이 갱신되는 **슬라이딩(마지막 활동 기준)** → 30일 내 재접속하면 계속 유지.
- **미체크(remember=false)**: refresh 만료 `admin_refresh_expires`(1일), 프론트는 **세션 쿠키**(`max-age` 없음)로 저장 → 브라우저 종료 시 폐기.
- **회전(rotation)**: `/admin/auth/refresh`(`rotate_admin_refresh_token`)는 기존 refresh를 revoke하고 새 access+refresh 쌍 발급.
- **재사용 감지**: 이미 revoke된 refresh 재사용(탈취 정황) 시 해당 관리자 **전체 refresh 무효화**(RFC 6819).
- **로그아웃**: 프론트(`AdminSidebar`)가 쿠키 삭제 전 `POST /admin/auth/logout`(`revoke_admin_refresh_token`) best-effort 호출로 서버 측 refresh revoke.
- SSR 가드(`admin/(main)/layout.tsx`)는 `admin_token` 쿠키 **존재만** 확인 → 유효성은 클라이언트 인터셉터의 refresh로 처리(회원 측과 동일 방식).
- 배포 유의: `admin_token_expires` 24h→1h 변경으로 **배포 시점에 이미 로그인 중이던 관리자**는 refresh 쿠키가 없어 기존 access 만료 시 1회 강제 재로그인(이후 정상).

## 2. 마스터 계정

- **마스터 = `admin.account_type == "마스터 계정"`** (상수 `MASTER_ACCOUNT_TYPE`, 프론트 roles 폼과 동일 문자열). 별도 필드/마이그레이션 없음.
- 가드 `get_current_master_admin`: `get_current_admin` + 마스터 여부 확인(아니면 403).
- **관리자 계정 CRUD(`/admin/accounts`) 정책**(2026-07-27 변경 — 이전엔 조회 `get_current_admin`·쓰기 마스터 전용이었음):
  - 조회/생성/수정/삭제 **전부 `require_permission("account")`** — 마스터는 권한 무관 허용.
  - **마스터 티어 봉인**(`routers/admin._guard_master_tier`): `account` 권한만 가진 비마스터는 마스터 계정 생성·마스터 승격(자기 포함)·마스터 대상 수정/삭제 시 403(권한 상승 방지).
- **마지막 마스터 보호**(`admin_service._other_active_masters`): 활성 마스터가 자기 하나뿐이면 삭제/강등(account_type 변경)/비활성화 시 400 차단.

## 3. 메뉴별 권한 (admin_permission)

`admin_permission`(admin 1:N, `menu_key`)로 일반 관리자의 메뉴 접근을 통제. **마스터는 권한 설정과 무관하게 전체 허용**.

- 가드 팩토리 `require_permission(menu_key)`(`utils/deps.py`): 마스터면 통과, 아니면 `menu_key`가 admin의 권한 집합에 없으면 403.
- `menu_key` 목록(`admin_service.VALID_MENU_KEYS`): `media` · `member` · `business` · `faq` · `account` · `chat` (+ `dashboard`는 하위호환용으로 허용값에만 잔존, 실제 게이팅 안 함).

### 라우터 ↔ 권한 매핑

| 라우터 | 권한 | 비고 |
|---|---|---|
| `/admin/members` | `member` | 전체 |
| `/admin/proposals` | `business` | 전체 |
| `/admin/inquiries` | `business` | 전체 |
| `/admin/media` | `media` | 관리자 매체 목록. 공개 `/media/*`(moving/fixed/상세)와 분리 |
| `/admin/chat` | `chat` | 신규 키 |
| `/admin/faqs` (GET목록/POST/PATCH/DELETE) | `faq` | 공개 GET은 `/faqs`·`/faqs/{id}`. 쓰기가 `/admin/faqs`에 있는 이유는 인터셉터 토큰 첨부(§ 아래) |
| `/admin/accounts` (전체) | `account` | 조회 포함 전 엔드포인트. + 마스터 티어 봉인 가드. §2 참조 |
| 대시보드(`/admin`) | 없음 | 로그인 기본 페이지, 상시 노출 |

### 매체 라우터 분리

관리자 전체 매체 목록은 원래 공개 프리픽스 `GET /media`에 있어 프론트 인터셉터가 user 토큰을 실었다(admin 가드 불가, 리뷰 HIGH). 이를 **`GET /admin/media`(`require_permission("media")`)로 이전**하고, 공개 클라이언트 조회(`/media/moving`·`/media/fixed`·`/media/{id}`·filter-options·clusters)는 `routers/media.py`에 그대로 뒀다. 프론트 `mediaApi.list`도 `/admin/media` 호출로 변경(인터셉터가 admin 토큰 자동 첨부).

## 4. 프론트 연동

- **사이드바**(`AdminSidebar.tsx`): `useAdminMe()`로 현재 관리자 조회 → `canSee(permKey)`로 메뉴 노출. 대시보드 상시, 마스터 전체, 나머지는 권한 보유 시(`account`=계정 관리 포함, 2026-07-27부터 특례 제거 — 이전엔 마스터 전용).
- **roles 폼**(`AccountFormView.tsx` / `roles/_components/index.tsx`): 권한 체크박스는 `PERMISSIONS`/`PERMISSION_KEYS` 기반. 대시보드는 목록에서 제외. **마스터 계정 선택 시 권한 설정 박스 숨김**(마스터는 전체 권한이라 무의미).
- 프론트 게이팅은 UX일 뿐 실제 방어는 백엔드 `require_permission`. 권한 없는 관리자가 API 직접 호출 시 403.

### 운영 유의

- DB에 **마스터 계정(`account_type="마스터 계정"`) 최소 1개** 필수. 없으면 계정 관리 진입 불가.
- 일반 관리자는 권한이 부여된 메뉴만 보이고 없는 API는 403 → 신규/기존 관리자에게 권한 배정 필요.

## 5. 로그인 토큰 보안 (회원, 연계)

[login.md](login.md)의 회원 인증에 적용된 토큰 보안(커밋 `ac23a29`, `cf48252`):

- **refresh 토큰 해시 저장**: DB에는 원본이 아닌 SHA-256 해시 저장(`security.hash_token`), 조회도 해시로. DB 유출 시 세션 탈취 방지.
- **refresh 재사용 감지**: 이미 폐기된 refresh 토큰이 재사용되면(탈취 정황) 해당 유저 전체 refresh 무효화(RFC 6819).
- **탈퇴/제재 access 차단**: `_user_from_token`에서 `status`가 `withdrawn`/`sanctioned`면 403 — 기발급 access 토큰도 다음 요청부터 차단(이메일·소셜 공통).
- **로그아웃 서버 폐기**: 프론트 로그아웃 시 쿠키 삭제 전 `POST /auth/logout` 호출 → 해당 refresh 토큰 revoke. (기존엔 쿠키만 삭제되고 서버 세션이 만료까지 유효하던 문제 해소.)

## 6. 미해결 (리뷰 참조)

로그인/권한과 별개로 [코드리뷰](../reviews/2026-07-06-backend-db-code-review.md)의 다음 항목은 미해결: OAuth state CSRF(#4), 비번 재설정 토큰 응답 노출(#3), `ad_sessions` 마이그레이션 누락(#5), recommend_v2 스레드 세션(#6), admin/user JWT 시크릿 분리, 기본 시크릿, media 경로 이전 등.
