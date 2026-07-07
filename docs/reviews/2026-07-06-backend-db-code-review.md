# 백엔드 & DB 코드리뷰 (2026-07-06)

> 범위: `backend/src` 전체(약 7,476줄) + Alembic 26개 마이그레이션.
> 방법: 도메인별 4개 리뷰 에이전트 병렬 실행(추천엔진 / 제안서·PPT·매체 / 인증·인가 / DB스키마) + 최고위험 항목 직접 코드 확인.
> 관련: [CONTEXT.md](../../CONTEXT.md) · [login 정책](../policies/login.md) · [DB 설계서](../policies/database-design.md) · [social-login-deploy-ops](../plans/2026-07-04-social-login-deploy-ops.md) · [api-spec](../api/api-spec.md)

**상태 표기**: ✅직접확인 = 리뷰어가 원본 코드로 직접 검증 / (표기없음) = 에이전트 리포트 기반.

이 프로젝트는 MVP/프로토타입 단계라 일부 항목은 "인지된 채 미룬 것"(주석에 명시됨)입니다. 아래는 **프로덕션 배포 전 관점**의 우선순위입니다.

---

## ✅ 수정 이력 (2026-07-06)

로그인/인증·권한 계열은 후속 작업으로 해소됨. 상세는 [관리자 인증·권한 정책](../policies/admin-auth-permissions.md).

| 항목 | 상태 | 커밋 |
|---|---|---|
| CRITICAL #1 admin 계정 CRUD 무인증 | ✅ 수정 (마스터/관리자 가드) | `59ad3f1` |
| CRITICAL #2 FAQ 쓰기 무인증 | ✅ 수정 (`require_permission("faq")`) | `59ad3f1` |
| HIGH refresh 토큰 평문 저장 | ✅ 수정 (SHA-256 해시) | `ac23a29` |
| HIGH refresh 재사용 감지 없음 | ✅ 수정 (전체 세션 무효화) | `ac23a29` |
| HIGH 탈퇴/제재 access 토큰 미차단 | ✅ 수정 (`_user_from_token` status 체크) | `ac23a29` |
| MEDIUM admin 권한별 접근제어 미구현 | ✅ 수정 (`require_permission` + admin_permission) | `59ad3f1` |
| (신규 발견) 로그아웃 시 서버 refresh 미폐기 | ✅ 수정 (`POST /auth/logout` 연동) | `cf48252` |
| HIGH `GET /media` 관리자 데이터 공개경로 노출 | ✅ 수정 (`/admin/media` 이전 + `media` 권한) | `53cb7a5` |

**미해결(주요)**: CRITICAL #3(비번 재설정 토큰 응답 노출), #4(OAuth state CSRF), #5(`ad_sessions` 마이그레이션 누락), #6(recommend_v2 스레드 세션), HIGH JWT 시크릿 분리/기본 시크릿/SSRF·Geoapify 키/LLM timeout 등.

---

## 🔴 CRITICAL — 배포 전 반드시 수정

| # | 위치 | 문제 | 상태 |
|---|------|------|------|
| 1 | `routers/admin.py:24-50` | 관리자 계정 CRUD 5개(list/create/get/update/delete)에 **인증 가드 전무**. 누구나 `POST /admin/accounts`로 관리자 생성, `DELETE`로 삭제 가능 → 시스템 장악 | ✅직접확인 |
| 2 | `routers/faq.py:19,38,43` | FAQ **쓰기(create/update/delete) 인증 없음**. 공지 변조·피싱 삽입 가능 (GET은 공개 OK) | ✅직접확인 |
| 3 | `routers/auth.py:109` | 비밀번호 재설정 토큰을 `{"reset_token": token}`로 **HTTP 응답에 직접 반환**. 피해자 이메일만 알면 즉시 계정 탈취 | ✅직접확인 |
| 4 | `oauth_service.py` + `routers/oauth.py:25` | **OAuth state CSRF 검증 완전 부재** (state 저장 안 함, callback 기본값 `""` 허용) → 계정 연결 하이재킹 | ✅직접확인 |
| 5 | `alembic/versions/` | `ad_sessions`/`ad_messages` **생성 마이그레이션 부재**. 002가 곧바로 `add_column` 호출 → 빈 DB에 `alembic upgrade head` 시 `UndefinedTable`로 실패. **신규 환경/CI/재해복구 전부 불가** (기존 운영 DB는 과거 `create_all` 덕에 안 터짐 = 스키마·이력 불일치) | ✅직접확인 |
| 6 | `services/recommend_v2.py:588` | `_run_sync_in_thread`가 요청의 SQLAlchemy `Session`을 executor 워커 스레드에 그대로 전달(615/636/778/975/1010/1324/1496). **Session은 thread-safe 아님** → 부하 시 커넥션 풀 오염·데이터 레이스 | ✅패턴확인 |

> **정정 메모**: 제안서 리뷰 에이전트가 `proposals.py:72` path traversal을 "미인증 RCE CRITICAL"로 보고했으나, 확인 결과 admin 라우터 전 엔드포인트에 `get_current_admin`이 걸려 있어 **인증된 관리자 전제**임. 실질 위험은 방어계층 부재(HIGH)로 하향 — 그래도 `proposal_id` UUID 검증은 추가 권장.

---

## 🟠 HIGH

**인증/인가**
- `utils/deps.py:21-35` — 탈퇴/제재 사용자 access 토큰이 만료(1h)까지 유효. `_user_from_token`이 `user.status` 미확인. → 토큰 검증 시 status 차단.
- `auth_service.py:38` + `models/user.py:77` — refresh 토큰 **평문 저장**. DB 유출 시 전 세션 탈취. → SHA-256 해시 저장·비교.
- `auth_service.py:117` — refresh 토큰 **재사용 감지 없음**. revoked 토큰 재사용 시 해당 유저 전체 무효화(RFC 6819) 로직 부재.
- `admin_auth.py:27` + `deps.py:22,61` — admin 토큰과 user access 토큰이 **동일 시크릿**(`jwt_access_secret`), `type` claim으로만 구분. → 별도 `jwt_admin_secret`.
- `config.py:22-23` — JWT 시크릿 기본값 `"change-me-*"` 하드코딩. `.env` 미설정 시 그대로 사용. → 프로덕션 필수 오버라이드 + 부팅 시 검증.
- `routers/media.py:21 (list_media)` — admin 매체 목록에 인증 없음. 원가(adCost)·판매형태 등 내부 데이터 비인증 노출. → `/admin/media` 분리 또는 가드 추가.

**추천 엔진 / 외부 호출**
- `ppt_builder.py:102 (_fetch_image)` — SSRF 방어 없음. DB의 `thumbnail_url`을 그대로 fetch → `169.254.169.254`(클라우드 메타데이터/IAM) 접근 가능. → private IP 대역 차단.
- `ppt_builder.py:348` — Geoapify API 키가 `follow_redirects=True`·예외 traceback 경유로 노출, 그 예외가 `proposals.py:171`에서 클라이언트에 전달됨.
- `recommend_v2.py:216+` — 모든 LLM `invoke()`에 timeout/retry 없음. OpenAI 지연 시 SSE 무한 대기. → `request_timeout=30`.
- `graph/llm.py:15` — `lru_cache(maxsize=1)`인데 temperature 0.0/0.3 교대 호출 → 매 요청 캐시 evict, 인스턴스 재생성. `_llm_cache` 전역 dict도 스레드 비안전.

**DB**
- status/created_at **인덱스 없음** — `proposal.status`, `inquiry.status`, `users.status`, 정렬 키 `created_at`(proposal/inquiry/ad_messages). → 복합 인덱스(`(member_id, created_at)`, `(session_id, created_at)`) 권장.

---

## 🟡 MEDIUM

- `oauth_service.py:119` — 이메일 기반 소셜 계정 자동 연결 시 **이메일 검증 미확인** → 미인증 이메일로 기존 계정 탈취 가능(카카오 `is_email_verified` 확인 필요). 소셜 access/refresh 토큰도 평문 저장.
- `deps.py:57` — **admin 권한(permission) 체크 미구현**. `admin_permission` 테이블(dashboard/media/member/business/faq/account)이 있으나 라우터에서 검사 안 함 → `faq` 권한만 있는 관리자가 `member` API 호출 가능.
- `proposals_client.py:184 (submit)` — **상태 가드 없음**. `contracted`/`cancelled` 제안서도 무조건 `execution_requested`로 되돌림(cancel엔 가드 있음, 비대칭).
- `recommend_v2.py:265` — `advertisement_fee`를 String 저장 후 매 쿼리 `CAST(BigInteger)`. 비숫자 유입 시 500. 정렬도 Python(`_ad_fee_int`). → 정수 컬럼.
- `recommend_v2.py:1433`, `routers/recommend_v2.py:38` — `str(exc)` 내부 에러를 SSE/HTTP 응답에 노출. → generic 메시지 + 서버 로그 분리.
- `proposals.py:65` — 파일 전체를 메모리 로드 후 크기 검증(DoS). → `read(MAX+1)` 방식.
- `deck_converter.py:50` — LibreOffice 동시 실행 시 프로파일 충돌(동시 PPT 업로드 실패). → `-env:UserInstallation` per-request.
- `proposal_service.py:411,166` — to_detail에서 Media IN 쿼리 재조회(단일 제안서 3회 왕복). → joinedload.
- `schemas/member.py`/`admin.py` — status 필드 enum 미제한(`Literal` 없음), 임의 문자열 저장 가능.
- `schemas/auth.py:12` — 비밀번호 `min_length=8`만, 복잡성 규칙 없음.
- `media_master.py` — 좌표 `Numeric()` precision 미지정, `proposal_item` start/end_date를 `String(20)`으로 저장(날짜인데 문자열).
- `requirements.txt` — `python-jose` 유지보수 중단(현재 HS256이라 직접 CVE 영향 없음). → PyJWT 권장.

---

## 🟢 LOW

- `main.py:28` — Swagger/ReDoc 프로덕션 노출.
- 로그인 rate limiting 없음(브루트포스).
- `recommend_v2.py:680` `print()` 사용(→ logging).
- `chat_graph.py` 세션 API 인증 없음(prototype 명시).
- `database.py:8` 커넥션 풀 파라미터(pool_size/max_overflow/pool_recycle) 미설정.
- 만료/사용완료 토큰(PasswordReset/RefreshToken) 정리 배치 없음.

---

## 잘 된 점

- 추천 아키텍처: LLM은 키워드 추출에만, DB 필터링은 결정론적 — 환각이 결과에 직접 영향 없음.
- 클라이언트 제안서 IDOR 방어 일관(`get_owned` + `_get_owned_or_404`).
- 임시파일 정리(`BackgroundTask(shutil.rmtree)`), UUID 저장명, JSONB GIN 인덱스.
- raw SQL은 전부 파라미터 바인딩(SQL injection 안전).
- FK ON DELETE 정책 일관(인증/제안서 CASCADE, 로그·이력 SET NULL).

---

## 권장 조치 순서

1. **인증 3종**(#1 admin, #2 faq, HIGH media.py) — 각 라우트에 `Depends(get_current_admin)` 추가. → [백엔드 인가 개념 메모](#부록-프론트-롤-체크-vs-백엔드-인가) 참조.
2. **비번 재설정 토큰**(#3) — 응답에서 제거, 이메일 발송으로.
3. **마이그레이션 복구**(#5) — `ad_sessions`/`ad_messages` 생성 마이그레이션을 002 이전 체인에 삽입. 안 하면 신규 배포 불가.
4. **OAuth state**(#4) + **탈퇴 토큰 차단**(HIGH) + **스레드 세션**(#6).

가장 시급: **#5(신규 DB 구축 자체가 실패)** 와 **#1~#3(미인증 원격 악용 가능)**.

---

## 부록: 프론트 롤 체크 vs 백엔드 인가

프론트의 `if (user.role === 'admin')`는 **UI를 숨기는 UX일 뿐 보안이 아니다.** API는 HTTP 엔드포인트라 누구나 직접 호출 가능:

```bash
curl -X POST https://api.example.com/admin/accounts \
  -H "Content-Type: application/json" \
  -d '{"email":"attacker@evil.com","password":"1234"}'
```

프론트 코드는 브라우저에 다 내려가므로 숨긴 버튼의 API도 공격자가 그대로 때릴 수 있다. **백엔드에서 반드시 다시 막아야 한다.**

이 프로젝트의 백엔드 인가 메커니즘은 FastAPI `Depends(...)`(핸들러 실행 전 검문소). `utils/deps.py`의 `get_current_admin`이 토큰 서명·만료 검증 → 관리자 타입 확인 → DB 존재 확인 → active 상태 확인을 수행한다. 라우트 인자에 아래 한 줄을 추가하면 미인증 요청이 핸들러 도달 전 401/403으로 차단된다:

```python
@router.post("")
def create_account(
    body: AdminAccountCreate,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),   # ← 이 줄이 검문소
):
    ...
```

`proposals.py`는 전 엔드포인트에 이 패턴이 적용되어 있으나(모범), `admin.py`·`faq.py`에는 누락되어 CRITICAL #1/#2가 발생. 한 단계 더인 **권한(permission) 체크**("이 관리자가 회원관리 권한이 있는가")는 `admin_permission` 테이블이 준비되어 있으나 미사용(MEDIUM).
