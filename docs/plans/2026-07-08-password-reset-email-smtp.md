# 비밀번호 재설정 이메일(SMTP) + 재설정 플로우 (2026-07-08)

비밀번호 재설정 토큰을 응답으로 노출하던 문제(코드리뷰 CRITICAL)를 해소하고, **SMTP 이메일 발송 + 재설정 UI(요청/재설정 페이지)**를 구현. 인증 배경은 [FastAPI 인증/로그인](2026-06-16-fastapi-auth-login.md)·[로그인 정책서](../policies/login.md), 신규 계정/배포 배경은 [SQS+Lambda 비동기 전환](2026-07-07-sqs-lambda-async-ai-recommend.md) 참조.

---

## 1. SMTP 발송 (Gmail 앱 비밀번호)

- 유틸 `backend/src/utils/mailer.py` — `smtplib` STARTTLS 발송. SMTP 미설정이면 발송 생략(False, 요청 실패 안 시킴). 예외는 로깅만.
- `config.py` 신설 필드: `smtp_host` / `smtp_port`(587) / `smtp_user` / `smtp_password` / `smtp_from`(미설정 시 user) / `web_base_url`(이메일 링크용 공개 프론트 URL) + `email_link_base` 프로퍼티(web_base_url 우선, 없으면 FRONTEND_URL 첫 항목).
- 운영값: `smtp.gmail.com:587`, from `admix.support@gmail.com`, 앱 비밀번호(16자, 공백 포함 붙여넣어도 로그인 OK). `WEB_BASE_URL=https://main.d5zpc903rfz5q.amplifyapp.com`.

### ⚠️ EC2 `.env`에 SMTP 넣을 때 — 병합만 (통째 복사 금지)
로컬 `.env`를 **그대로 EC2에 올리면 RDS 비번·SQS URL·CORS(FRONTEND_URL)가 로컬값으로 덮여 백엔드가 깨진다**(실제 사고 있었음). SMTP 키만 뽑아 EC2 `.env`에 **key 단위 병합**할 것. 배포는 rsync 후 `--build` 재빌드 필요(새 mailer 코드 반영).

### ⚠️ 전달률 — 초기 스팸
Gmail 앱비번 발신은 초기에 **스팸함으로 분류**되기 쉽다(테스트 메일도 스팸에 도착). 운영 전 발신 도메인 SPF/DKIM(또는 SES 등) 도입 권장.

---

## 2. 비밀번호 재설정 API

- `POST /auth/password-reset/request` `{email}` — 토큰을 **응답에 노출하지 않고** 이메일로만 발송(`BackgroundTasks`). 링크 = `{email_link_base}/reset-password?token=…` (TTL 60분).
  - **미등록 이메일 → `404 "가입되지 않은 이메일입니다."`** (등록 시 200 + 발송).
  - ⚠️ **결정(UX 우선)**: 미등록 404로 알려주면 **이메일 가입 여부가 노출(enumeration)**된다. UX 위해 감수. 열거 방지로 되돌리려면 항상 동일 응답(발송 성공 취급)으로.
- `POST /auth/password-reset/confirm` `{token, new_password}` → 204. (기존 존재, UI만 신설)

---

## 3. 프론트 재설정 플로우

- **요청 화면**: `app/(client)/(auth)/find-account/page.tsx` — signup 페이지 스타일 풀페이지(반응형 `sm:` 카드). 이메일 입력 → `requestPasswordReset` → 미등록 404 인라인 에러 / 성공 시 "전송했습니다" 상태. (초기엔 모달로 구현했다가 **페이지로 전환** — signup과 동일 구조 요구.) 로그인 모달 "비밀번호 재설정" → `router.push("/find-account")`.
- **재설정 화면**: `app/(client)/reset-password/page.tsx`(+`_components/ResetPasswordView`) — 이메일 링크 착지. `useSearchParams`로 token 읽기(**Next 16 → `<Suspense>` 경계 필수**). 새 비번 입력 → `confirmPasswordReset` → 완료.
- API/훅: `hooks/auth`의 `requestPasswordReset`/`confirmPasswordReset` + `useRequestPasswordReset`/`useConfirmPasswordReset`. confirm payload = `{token, new_password}`(백엔드 스키마 일치).

---

## 4. 컷오버 (완료)

- 구 계정 Amplify(`main.d5zpc903rfz5q.amplifyapp.com`) `NEXT_PUBLIC_API_URL` → **`https://43-201-172-34.sslip.io`(새 백엔드)**로 전환 완료(사용자).
- 새 백엔드 CORS(`FRONTEND_URL`)에 Amplify 도메인 + `localhost:3000/3001` 포함 — 프리플라이트 200·ACAO 확인.
- **E2E 검증**: 배포 프론트 → 새 백엔드 재설정 요청 → 메일 발송(스팸함) → 링크 → `/reset-password` 재설정. 정상.

> 컷오버로 **모든 API가 새 백엔드**를 본다. 새 RDS엔 구 시스템 회원 데이터 미이관(테스트 가입분만 존재).

---

## 5. 운영 전 남은 것
- 발신 SPF/DKIM(스팸 개선) · JWT 시크릿 설정 · 계정 유료 업그레이드+RDS 백업 · RDS 인터넷 노출 조이기 · Amplify+Git 이전. (상세 [SQS+Lambda 문서](2026-07-07-sqs-lambda-async-ai-recommend.md) §7)
