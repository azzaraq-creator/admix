# 소셜 로그인 · 배포/운영 설정 · 스키마 운영 (2026-07-04)

카카오/네이버 소셜 로그인 연동, 회원 탈퇴, 배포 환경(EC2 + Amplify) 설정, `create_all → alembic` 전환, Geoapify PPT 지도, 한글 IME 버그 수정까지 이번 작업에서 정리된 지식. 인증 배경은 [FastAPI 인증/로그인](2026-06-16-fastapi-auth-login.md)·[로그인 정책서](../policies/login.md), 전체 개요는 [CONTEXT.md](../../CONTEXT.md) 참조.

---

## 1. 소셜 로그인 (카카오/네이버)

### 흐름 — "프론트 리다이렉트" 방식 (Option A)
백엔드는 소셜 OAuth 로직 완비(`oauth.py` 라우터 + `oauth_service.py`, `_PROVIDERS`에 kakao/naver). redirect_uri를 **프론트 콜백 페이지**로 두는 방식.

1. 로그인/회원가입 버튼 클릭 → `GET /auth/sns/{provider}` 로 authorize URL 받아 `window.location` 이동
2. 제공자 로그인 → `{FRONT}/oauth/{provider}/callback?code=…` 로 복귀
3. 콜백 페이지가 `GET /auth/sns/{provider}/callback?code=…` 호출 → 백엔드가 토큰 교환 + user 연동(`social_accounts`) + 자체 JWT 발급
4. 프론트가 토큰을 쿠키에 저장(`setTokens`) → 홈 이동

### 프론트 배선
- `frontend/hooks/auth/apis.ts`: `snsAuthorizeUrl(provider)`, `snsExchange(provider, code, state)`
- `frontend/app/(client)/oauth/[provider]/callback/page.tsx`: kakao/naver 공용 동적 콜백 (`useSearchParams` → `Suspense` 필요)
- `LoginModal.tsx` / `signup/page.tsx`: `handleSnsLogin(provider)` 로 카카오·네이버 버튼 배선

### 백엔드 env (환경별)
`config.py` 필드 → env 변수 (kakao 예시, naver 동형):
```
KAKAO_CLIENT_ID       # ⚠️ REST API 키 (JavaScript 키 아님)
KAKAO_CLIENT_SECRET   # 콘솔에서 secret "사용함"일 때만 필수
KAKAO_REDIRECT_URI    # 프론트 콜백 경로와 정확히 일치
```
- 로컬: `http://localhost:3001/oauth/kakao/callback` (프론트 dev 포트 3001)
- 운영: `https://main.d5zpc903rfz5q.amplifyapp.com/oauth/kakao/callback`
- `state` CSRF 검증은 미구현(MVP). 운영 전 보강 권장.

### 콘솔 설정
- **카카오**: 카카오 로그인 활성화 ON, Redirect URI 등록(로컬+운영 둘 다), 플랫폼 Web 사이트 도메인 등록, 동의항목(닉네임/이메일).
- **네이버**: 로그인 오픈API, Callback URL 등록, PC웹 서비스 URL. 네이버 지도(Static Map)는 로그인 키가 아닌 **NCP 별도 가입** 필요.

### 자주 나는 에러
| 코드 | 의미 | 원인/해결 |
|------|------|-----------|
| KOE101 | 앱 설정 오류 | client_id 비었거나 틀림(REST 키 확인), 카카오 로그인 비활성 |
| KOE006 | 미등록 Redirect URI | 콘솔 Redirect URI ≠ 백엔드가 보내는 값. 포트/슬래시/http(s)/앱 일치 확인 |

---

## 2. 회원 탈퇴 (본인)

- `DELETE /auth/me` → `auth_service.withdraw()`: `status='withdrawn'` + `withdrawn_at` + **refresh token 전체 폐기**(전 기기 로그아웃). soft-delete(레코드 유지).
- 재로그인 차단: `authenticate`(이메일)와 `oauth_service`(소셜) 양쪽에서 withdrawn → 403.
- 프론트: `useWithdraw` → 성공 시 토큰 삭제·me 캐시 제거·홈 이동.

---

## 3. 배포 환경 / env 관리

- **프론트**: AWS Amplify (`https://main.d5zpc903rfz5q.amplifyapp.com`). `main` push 시 자동 빌드/배포.
- **백엔드**: EC2 + nginx + certbot (`https://13-125-7-82.sslip.io`, Public IP 13.125.7.82). `deploy/redeploy.sh` = 로컬 → EC2 rsync + `docker compose up -d --build` + `alembic upgrade head` + health.

### ⚠️ EC2 `.env`는 rsync에서 제외 — 서버에서 직접 관리
`redeploy.sh`가 `backend/.env`를 exclude. **새 시크릿은 EC2에서 직접 넣어야** 함(로컬 .env에만 넣으면 운영 반영 안 됨). 값 노출 없이 로컬→EC2 복사:
```bash
grep -E '^KEY=' backend/.env | ssh -i ~/.ssh/ooh-key.pem ubuntu@13.125.7.82 '
  f=/home/ubuntu/ooh-recommend/backend/.env
  while IFS= read -r l; do k="${l%%=*}"; grep -q "^$k=" "$f" && sed -i "s|^$k=.*|$l|" "$f" || printf "%s\n" "$l" >> "$f"; done'
# 반영: docker compose --env-file backend/.env -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate backend
```
- 소셜 로그인/지도 키가 운영에서 안 될 때 1순위 의심: **EC2 .env 누락**.
- 환경별로 달라야 하는 것: `KAKAO/NAVER_REDIRECT_URI`(운영 도메인), `FRONTEND_URL`(CORS, Amplify 도메인 포함), 프론트 `NEXT_PUBLIC_API_URL`(=백엔드 sslip.io, Amplify env에 설정).

---

## 4. 스키마 운영 — create_all 제거, alembic 전용

`main.py` lifespan의 `Base.metadata.create_all` **제거**. 이유:
- `create_all`은 **없는 테이블만 생성**하고 기존 테이블 컬럼 추가는 못 함 → 모델에 컬럼 추가 시 운영 스키마가 안 따라옴.
- `create_all` + alembic **병행 시 충돌**: create_all이 새 테이블을 먼저 만들어두면, 그 테이블을 만드는 마이그가 `DuplicateTable`로 실패 → (단일 트랜잭션이라) 전체 롤백 → 컬럼 마이그도 미적용 → 500.

실제 사고(2026-07-04): 운영 재배포 후 `proposal.counter_proposal_file_name` 없음으로 proposals/export-ppt 500. 원인은 위 충돌로 alembic이 017에 멈춤. 복구: 빈 `proposal_counter_file` 테이블 DROP → `alembic upgrade head`(018~026 적용).

**규칙**: 스키마 생성/변경은 `alembic upgrade head`로 일원화. 새 DB 셋업은 반드시 alembic 실행(자동생성 없음). `redeploy.sh`가 배포 시 alembic을 돌림.

---

## 5. Geoapify PPT 지도

- PPT 매체 슬라이드 지도는 **Geoapify Static Maps**(서버사이드 fetch, `ppt_builder.py`). 이전 구글 → Geoapify로 교체(카드 등록 없이 무료 키).
- ⚠️ Geoapify는 좌표 순서가 **lonlat(경도 먼저)**. `config.geoapify_api_key` 없으면 지도 URL 안 만들고 placeholder.
- **운영 지도 안 나옴 = EC2 .env에 `GEOAPIFY_API_KEY` 누락**(3번 참조). 로컬엔 있고 운영엔 없던 케이스.
- 참고: 프론트 인터랙티브 지도(고정매체)는 별개로 **카카오 지도**(`NEXT_PUBLIC_KAKAO_MAP_KEY`) 사용.

---

## 6. 한글 IME Enter 이중 입력 버그

- 증상: 한글 이름 입력 후 **Enter로 제안서 생성 시 2번 생성**(클릭은 1번). 프로덕션 빌드에서 재현.
- 원인: 한글 조합 확정 시 `keydown`이 2회 발생하는데 `onKeyDown`이 `e.key === "Enter"`만 보고 **`e.nativeEvent.isComposing`(조합중)을 안 걸러서** 핸들러 2회 실행. `isPending` state 가드는 동기 재호출을 못 막음.
- 수정 패턴(모든 Enter-submit 입력에 적용):
```js
if (e.key === "Enter" && !e.nativeEvent.isComposing) { … }
```
- 생성처럼 부작용 큰 액션은 **`useRef` 동기 락**을 추가해 이중호출을 확실히 차단(idempotent).
