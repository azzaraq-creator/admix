# 제안서·문의 이메일 알림 + 딥링크 로그인 처리 (2026-07-14)

admin이 **맞춤제안을 전송**하거나 **문의에 답변을 등록**하면, 해당 리소스를 만든 **회원의 연락받을 이메일**로 알림 메일을 발송한다. 메일 본문의 CTA로 서비스에 진입할 때 **비로그인/타계정 상황**을 안전하게 처리한다. 이메일 인프라(SMTP)는 [비밀번호 재설정 이메일](2026-07-08-password-reset-email-smtp.md)에서 구축한 `mailer`를 재사용한다. 회원 이메일 구분(로그인 아이디 vs 연락받을 이메일)은 [SNS 이메일 인증/아이디 분리](2026-07-09-sns-email-verification-login-id.md) 참조.

---

## 1. 발송 인프라 (재사용)

- `backend/src/utils/mailer.py` `send_email(to, subject, text, html)` — SMTP STARTTLS. 미설정 시 발송 생략(False, 요청 실패 안 시킴).
- 모든 알림은 라우터에 `BackgroundTasks` 주입 → 저장 커밋 후 백그라운드 발송(응답 지연 없음).
- 메일 내 링크는 `settings.email_link_base`(= `WEB_BASE_URL` 우선, 없으면 `FRONTEND_URL` 첫 항목) 기준.
- 공통 디자인: 검정 배경(#000)·흰 텍스트·포인트 #00AAA4, ADMIX 로고 PNG(`frontend/public/service/admix-logo-email.png`, Figma 로고 480×120 export)를 `{email_link_base}/service/admix-logo-email.png`로 참조. 제목·본문·bullet·CTA 버튼 구성. **로고는 프론트(Amplify)가 서빙**하므로 로고 표시는 프론트 배포(main) 필요.

> ⚠️ SVG 로고는 Gmail/Outlook이 렌더 안 함 → PNG 사용. 제목 등 사용자 입력은 `html.escape`로 이스케이프.

## 2. 맞춤제안 도착 알림 (제안서)

- **트리거**: `POST /admin/proposals/{id}/counter-proposal`(맞춤제안 PPT 업로드) → `proposal_service.save_counter_proposal_file`가 `status="custom"` 갱신. 성공 후 발송.
- **수신자**: 제안서 소유 회원의 연락받을 이메일 `proposal.member.email`. 게스트(member 없음)·이메일 없음 → 스킵.
- **본문**: 제목 `[ADMIX] 새로운 맞춤제안이 도착했습니다.` / `제안서명 : {title}` bullet / `[내 제안서]` 안내 + CTA 버튼.
- **CTA URL**: **`{email_link_base}/proposals/{id}`** (제안서 상세 딥링크 — §4 참조).
- 구현: `proposal_service.send_custom_proposal_email(email, proposal_id, title)`, 라우터에서 id 전달.

## 3. 문의 답변 알림

- **트리거**: `PATCH /admin/inquiries/{id}/answer` → `inquiry_service.answer_inquiry`가 `status="answered"` 갱신. 성공 후 발송.
- **수신자**: 문의 작성 회원의 연락받을 이메일 `inquiry.member.email`, 없으면 문의 시 입력한 `inquiry.email` 폴백. 둘 다 없으면 스킵.
- **본문**: 제목 `[ADMIX] 문의하신 내용에 대한 답변이 등록되었습니다.` / `문의 제목 : {subject}` bullet / `[고객지원 > 문의내역]` 안내 + CTA 버튼.
- **CTA URL**: `{email_link_base}/contact?tab=history` (문의내역 탭).
- 구현: `inquiry_service.send_inquiry_answered_email(email, subject)`, `answer_inquiry`에 `BackgroundTasks` 주입.

## 4. 딥링크 로그인 처리 (핵심)

메일 CTA로 진입한 사용자가 **로그인 안 됐거나 다른 계정으로 로그인**한 경우, 대상 리소스가 안 보인다(백엔드가 소유자 스코프로 막음). 각 화면에서 상태별로 안내한다.

### 4.1 문의내역 — `/contact?tab=history`

- `contact/page.tsx`는 서버 쿠키로 `member` 판정. `ContactView`는 `member`(서버) + `useMe()`(클라이언트)를 합쳐 **`isMember`** 산출(SSR 초기값 깜빡임 방지 + 모달 로그인 후 반응형).
- **비로그인 + `tab=history` 진입 → 로그인 모달 자동 노출**(`setLoginModalOpen(true)`). 로그인 성공 시 `me` 캐시가 채워져 `isMember→true` → `TABS_MEMBER`에 history 포함 → **문의내역 탭 자동 표시**(리다이렉트 불필요, URL 파라미터 유지됨).
- `/contact` 일반 진입은 게스트도 쓰므로 모달 안 띄움 — `tab=history` 의도가 명확할 때만.

### 4.2 제안서 상세 — `/proposals/[id]` (3-상태)

`/proposals` 목록은 게스트도 세션 제안서로 쓰므로 로그인 강제 불가 → **특정 제안서 상세로 딥링크**하고 상태별 처리(마커 파라미터 불필요, 로그인 게이팅이 리소스에 내재).

| 상태 | 조건 | 처리 |
|---|---|---|
| ① 소유자 로그인 | 로그인 + `useProposalDetail(id)` 성공 | 제안서 표시(맞춤제안이면 `CounterProposalDeckView`) |
| ② 비로그인 | `!me`(토큰 없음) + 조회 실패 | `/proposals/[id]` 머무른 채 **로그인 모달**. 성공 시 `proposalsKeys.detail(id)` 무효화 → 자동 표시 |
| ③ 타계정 로그인 | 로그인 + 조회 실패(403/404) | **"접근 권한이 없습니다" 에러 안내 + `/proposals`(내 제안서 목록)로 이동**(`router.replace`) |

- ②/③ 구분은 `useMe()`(로그인 여부)로. **자동 모달은 `!me`일 때만** 발동 → 로그인 후 재발동 없음(잘못된 계정으로 로그인해도 ③으로 떨어져 루프 없음).
- 로딩 중(`isLoading`)엔 판단 보류, 조회 settle 후 데이터 없을 때만 ②/③ 분기.
- **보안**: 백엔드가 비소유자에게 404를 주므로 내용 노출 없음. 존재/삭제/타계정 모두 ③으로 **동일 처리**(제안서 존재 여부 노출 방지).

> ⚠️ **로그인 후 refetch**: `proposalsKeys.detail(id)`/`myList()` 키는 정적이고 로그인 모달이 이를 무효화하지 않는다 → 로그인 후 자동 refetch가 안 됨. auth 전환 시(`me` 등장) 해당 쿼리 무효화 필요.

## 5. 구현/배포 범위

| 영역 | 파일 | 배포 |
|---|---|---|
| 백엔드 — 제안서 알림 | `services/proposal_service.py`, `routers/proposals.py` | EC2 재배포 |
| 백엔드 — 문의 알림 | `services/inquiry_service.py`, `routers/inquiries.py` | EC2 재배포 |
| 프론트 — 로고 에셋 | `frontend/public/service/admix-logo-email.png` | Amplify(main) |
| 프론트 — 문의내역 로그인 | `contact/_components/ContactView.tsx` | Amplify(main) |
| 프론트 — 제안서 상세 3-상태 | `proposals/[id]/_components/ProposalDetailView.tsx` | Amplify(main) |

- 백엔드 변경은 EC2 동기(REST) 엔드포인트 → Lambda 재배포 불필요. 모델 변경 없음 → 마이그레이션 no-op.
- 배포는 [deploy/README.md](../../deploy/README.md) "운영" 참조: 백엔드 `bash deploy/redeploy.sh`, 프론트 `git push origin main`(Amplify 자동).

## 6. 진행 상태 / 결정

- [x] 제안서 알림 발송 (커밋 `d28f720`) — EC2 배포 완료
- [x] 문의 답변 알림 발송 (커밋 `1d7a53e`) — EC2 배포 완료
- [x] 문의 답변 CTA `/contact/inquiries` → `/contact?tab=history` 수정 (커밋 `e131b77`) — EC2 배포 완료
- [x] 문의내역 비로그인 로그인 모달 유도 (커밋 `594ba82`) — Amplify 배포
- [ ] 제안서 알림 CTA를 `/proposals/{id}`로 변경 (백엔드) + EC2 재배포
- [ ] 제안서 상세 `/proposals/[id]` 3-상태 처리 (프론트) + Amplify 배포

**결정 메모**
- 제안서 딥링크는 목록이 아닌 **상세(`/proposals/{id}`)** — 이메일이 특정 1건 알림이고, 상세는 회원 소유 리소스라 로그인 게이팅이 자연스럽고 게스트 플래닝 흐름을 안 깨서(마커 불필요). 목록+`?login=1` 마커 방식은 반려.
- 타계정 로그인(③)은 로그인 재유도 대신 **권한 없음 안내 + 목록 이동**으로 처리(무한 모달 루프 방지 + 존재 여부 비노출).
