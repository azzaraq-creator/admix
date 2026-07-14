# 인증 이메일 브랜디드 HTML 적용 (인증코드·비밀번호 재설정) (2026-07-14)

기존에 단순 텍스트/최소 HTML로 나가던 **이메일 인증코드**·**비밀번호 재설정** 메일을 Figma 디자인의 **다크 브랜디드 템플릿**으로 교체한다. 템플릿·로고는 [제안서·문의 이메일 알림](2026-07-14-proposal-inquiry-email-notify.md)과 동일 스타일을 재사용한다. 발송 인프라·재설정 플로우 배경은 [비밀번호 재설정 이메일(SMTP)](2026-07-08-password-reset-email-smtp.md) 참조.

---

## 1. 공통 템플릿

- 검정 배경(#000)·흰 텍스트·포인트 #00AAA4, ADMIX 로고 PNG(`frontend/public/service/admix-logo-email.png`)를 `{email_link_base}/service/admix-logo-email.png`로 참조. `email_link_base` 미설정 시 텍스트 워드마크 폴백.
- 발송은 기존 `mailer.send_email(to, subject, text, html)` — `text`(폴백)·`html` 동시 제공.
- 두 메일 모두 `auth_service` 모듈. 제안서/문의 이메일과 껍데기는 유사하나 본문·CTA가 달라 자기완결 함수로 유지(공통 추상화는 알림이 더 늘면 검토).

## 2. 이메일 인증코드 — `send_email_verification_code`

- **제목**: `[ADMIX] 이메일 인증코드를 확인해주세요`
- **본문**: 안녕 인사 + `인증코드` 라벨 + 코드(24px Bold) 블록 + 만료 안내.
- **만료(TTL)**: `EMAIL_CODE_TTL_SECONDS` **300 → 600(10분)** 으로 변경. 만료 문구는 하드코딩이 아니라 이 값 기준 동적(`{minutes}분`) — 디자인의 "10분"과 일치.
- 코드는 6자리 숫자(생성값)라 이스케이프 불필요.

## 3. 비밀번호 재설정 — `send_password_reset_email`

- **제목**: `[ADMIX] 새로운 비밀번호를 재설정해주세요`
- **본문**: 안녕 인사 + **`비밀번호 재설정` CTA 버튼**(teal, 이메일 클라이언트 호환 table 버튼) → `{email_link_base}/reset-password?token={token}` + 만료 안내. 텍스트 폴백엔 링크 원문 포함.
- **만료(TTL)**: `PASSWORD_RESET_TTL_SECONDS = 3600`(**1시간 유지**). 만료 문구는 TTL 기준 동적 포맷(3600의 배수면 "N시간", 아니면 "N분") → 현재 "1시간 후 만료".
  - ⚠️ **결정**: 디자인 목업은 "24시간"이지만 **1시간 유지**. 재설정 토큰 유효기간을 24시간으로 늘리면 공격 노출 창이 커져(보안 tradeoff) 채택하지 않음. 24시간이 필요하면 `PASSWORD_RESET_TTL_SECONDS=86400`으로 값만 바꾸면 문구도 자동 반영(코드 수정 불필요).

## 4. 배포 범위

| 영역 | 파일 | 배포 |
|---|---|---|
| 인증코드/재설정 메일 HTML + TTL | `backend/src/services/auth_service.py` | EC2 재배포 |

- 백엔드 EC2 동기 로직 → Lambda 재배포·마이그레이션 불필요. 로고 PNG는 이미 프론트(Amplify)에 배포됨.

## 5. 진행 상태 / 결정

- [x] 이메일 인증코드 메일 브랜디드 HTML 교체 + TTL 600(10분)
- [x] 비밀번호 재설정 메일 브랜디드 HTML 교체 + `비밀번호 재설정` 버튼
- [ ] 커밋 후 EC2 재배포

**결정 메모**
- 인증코드 TTL은 디자인(10분)에 맞춰 600으로 상향.
- 재설정 TTL은 보안상 1시간 유지(디자인 24시간 미채택) — 문구는 동적이라 값만 바꾸면 일치 가능.
