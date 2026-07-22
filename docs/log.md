# 🗓️ 작업 로그 (Log)

> append-only 시간순 기록. 새 자료 ingest / 주요 결정 / 작업 완료를 **최신이 위로** 쌓는다.
> 형식: `## YYYY-MM-DD — 제목` + 한두 줄 요약 + 관련 문서 링크.
> 관리 규칙은 루트 [CLAUDE.md](../CLAUDE.md) 참조.

## 2026-07-22 — 제안서 이름 중복검사 (생성·이름변경)

- 같은 소유자(회원/세션)가 동일 이름 제안서를 만들거나 그 이름으로 변경 못 하게 차단. 백엔드 `proposal_service.title_exists`(삭제제외·`lower(trim)`·`exclude_id`) + 라우터 `POST /proposals`·`PATCH /proposals/{id}`에서 409 `{reason:"duplicate_name"}`. 챗봇(`recommend_v2` 직접 호출)·게스트 승계는 의도적 미적용. 프런트: `proposalErrorReason` 헬퍼 + AddToProposalModal·NewProposalModal 인라인에러 / ProposalDetailView 토스트. 문구 "이미 사용 중인 제안서 이름입니다. 다른 이름을 입력해 주세요.". 테스트 22개(단위5+API2 신규) 통과, tsc/eslint 통과.
- **한도 도달 다이얼로그 통일**: `ProposalsView`에만 있던 `showLimitDialog`를 `hooks/proposals/useProposalLimitDialog` 공유 훅으로 추출 + `proposalLimitTier` 헬퍼. `AddToProposalModal`(담기 생성)도 한도 초과 시 동일 안내 다이얼로그 노출. Figma 2종은 여전히 보류(scrim만이라 재공유 필요, 문구는 기존 카피 유지). 상세: [proposal-name-duplicate-check](plans/2026-07-22-proposal-name-duplicate-check.md).

## 2026-07-22 — QA #4: fixed 지도 채팅 패널 접기 시 relayout 누락

- fixed 페이지에서 채팅 패널 접기(`chatOpen=false`) 시 넓어진 영역이 지도로 안 채워지고 회색으로 남던 버그. 원인: `useKakaoMap.ts` ResizeObserver가 `becameVisible`(숨김→표시)에만 `map.relayout()` 호출 → 일반 너비 변경(패널 토글)엔 누락. 수정: 크기 변경(`sizeChanged`, 양수 유지)이면 항상 relayout, 재센터링/fit은 becameVisible에만. relayout이 중심·줌 보존해 지도 안 튐. `tsc`/eslint 통과. 브라우저 통합 동작이라 단위테스트 미작성. 상세: [qa-fixes](reviews/2026-07-22-qa-fixes.md) #4.

## 2026-07-22 — QA 픽스 시작 (사이드바 로그인/프로필 버튼)

- QA 지적 픽스 착수. #1 LNB 로그인/회원가입 버튼 아이콘–텍스트 gap `6→8px`, #2 로그인 이후 프로필 버튼 hover `primary-50→platinum-50`(다른 nav row와 통일). #3 사이드바 버튼 공통화(Option A) — `SIDEBAR_ROW_BASE` 상수 + `SidebarNavRow` 컴포넌트 추출(nav+help 사용), 프로필 버튼 base 공유, 로그인 버튼은 filled CTA 예외 유지. 전면 공통화·shadcn Button 재사용은 leaky/체계 불일치로 지양. 전부 behavior-preserving, `tsc`/`eslint` 통과. 프론트 테스트 인프라 없음 → CSS/구조 건은 lint/tsc 검증으로 갈음(브리틀 className 테스트 지양). 누적 로그: [qa-fixes](reviews/2026-07-22-qa-fixes.md).

## 2026-07-16 — 제안서 상태 라벨 개편 + 유저 삭제 논리삭제(soft delete)

- **상태 라벨 붙여쓰기 + 고객/관리자 분리**: 고객은 작성중/제출완료/맞춤제안/계약완료(`StatusChip`), 관리자는 신규(=`execution_requested`)/맞춤제안/계약완료/취소. "집행 요청" 라벨 제거. 고객 목록 탭 5종(전체/작성중/제출완료/맞춤제안/계약완료)으로 분리(기존 `execution_requested`가 "맞춤제안" 탭에 섞이던 문제 해소).
- **관리자 목록에서 작성중(`new`) 제외** — 고객이 제출해야 "신규"로 노출.
- **유저 삭제 = 상태별 분기**: `new`=완전삭제 / `execution_requested`·`custom`=`cancelled`(취소) 전환 / `contracted`=상태 유지 + `deleted_at` 기록(관리자 "계약완료 + 삭제됨" 배지, 성사 계약 이력 보존). 삭제 건은 유저 목록·상세(`get_owned` 404)·생성 한도에서 제외. `proposal.deleted_at` 컬럼 추가(마이그레이션 `034_proposal_deleted_at`). 백엔드 테스트 8건 추가(`test_proposal_service.py`, 전체 15 통과). 상세: [proposals](policies/proposals.md) · [proposal-detail](policies/proposal-detail.md) · [admin-proposals](policies/admin-proposals.md).

## 2026-07-15 — 회원 제재 추가/상세 모달 + 날짜 기반 로그인 차단

- admin 회원 상세 "제재 관리" 탭에 제재 추가/상세(수정·삭제) 모달 구현(추가·상세 동일 `SanctionModal`): 정지 사유 Select(5종, 기타 직접입력) + 상세 사유 textarea(`member_sanction.detail` 컬럼 신설, 마이그레이션 033) + 제재 기간(shadcn `react-day-picker` 캘린더, 오늘 이후·시작≤종료, 활성색 primary). `POST/PATCH/DELETE /admin/members/{id}/sanctions`. 상세 탭은 `?tab=` URL 구동. **로그인 차단은 `status` 플래그가 아니라 제재 기간(날짜)으로 판정**(`auth_service`) — 오늘이 활성 제재(start~end, 종료없음=무기한) 안일 때만 403 + 제한 모달, 미래·종료 제재는 허용. `status`는 제재 CRUD 시 `active↔sanctioned` 재계산(표시용). 배포 완료(`b0dbca1`/`3b6712e`). 상세: [admin-members](policies/admin-members.md) §3.10, [login](policies/login.md) §7.

## 2026-07-14 — 인증 이메일 브랜디드 HTML (인증코드·비밀번호 재설정)

- 텍스트/최소 HTML로 나가던 이메일 인증코드·비밀번호 재설정 메일을 Figma 다크 브랜디드 템플릿(로고·제목·본문·CTA)으로 교체(`auth_service.py`). 인증코드: 코드 블록 + TTL `EMAIL_CODE_TTL_SECONDS` 300→600(10분). 재설정: `비밀번호 재설정` 버튼(reset 링크) + TTL 1시간 **유지**(디자인 24시간이지만 보안상 미채택, 문구는 TTL 기준 동적). 로고는 기존 `admix-logo-email.png` 재사용. 상세: [auth-email-html-branding](plans/2026-07-14-auth-email-html-branding.md).

## 2026-07-14 — 제안서·문의 이메일 알림 + 딥링크 로그인 처리 (PRD)

- 맞춤제안 전송(`status=custom`)·문의 답변(`status=answered`) 시 회원 연락 이메일로 Figma 다크 템플릿 알림 발송(`send_email` 재사용, BackgroundTasks). 이메일 로고는 PNG(`frontend/public/service/admix-logo-email.png`, Amplify 서빙). CTA 딥링크: 문의=`/contact?tab=history`(비로그인 시 로그인 모달), 제안서=`/proposals/{id}`(상세 3-상태: 소유자 표시 / 비로그인 모달 / 타계정 권한없음+목록이동). 제안서 알림 발송·문의 알림·문의 CTA 수정·문의내역 모달까지 배포 완료(`d28f720`/`1d7a53e`/`e131b77`/`594ba82`), 제안서 상세 딥링크+3-상태 진행 예정. 상세: [proposal-inquiry-email-notify](plans/2026-07-14-proposal-inquiry-email-notify.md).

## 2026-07-14 — 챗봇이 '내 제안서'에서 만든 세션 제안서 인식 (버그 수정)

- 비회원이 "내 제안서" 페이지에서 만든 제안서를 챗봇이 못 찾고 "보유중인 제안서가 없어요"만 반복하던 버그. 원인: 챗봇 담기가 `active_proposal_id`(챗봇이 직접 담은 제안서)에만 의존 → 챗봇 밖에서 만든 제안서(session_id 소유, member_id 없음)는 인식 못 함. `resolve_proposal_via_tools`도 `bool(active_proposal_id)`로 판단이 갈림. 수정: PROPOSAL 처리 진입 시 소유자 계산 후 `active_proposal_id`가 없으면 `_get_active_or_latest`로 **현재 세션 최근 제안서를 활성으로 보충**(`recommend_v2.py` 1160~). DB 검증: 제안서·챗세션 session_id 일치 확인(비회원=member_id 없이 session_id 소유). 관련: [guest-proposal-session-claim](plans/2026-07-14-guest-proposal-session-claim.md).

## 2026-07-14 — 챗봇 담기 active_proposal_id 잔재 폴백 (버그 수정)

- 게스트가 "내 제안서" 페이지에서 만든 제안서를 챗봇이 담지 못하고 "제안서를 찾지 못했어요. 다시 시도해주세요."만 반복하던 버그. 원인: 챗봇이 세션 `filter_context.active_proposal_id`(현재 작업 제안서)로만 담는데, 그 값이 잔재/무효(다른 소유·삭제, 예: 회원으로 승계된 제안서를 게스트 세션이 계속 가리킴)면 폴백 없이 바로 에러(`recommend_v2.py` add_media 1191, 확인 후 담기 1034 경로). 수정: 두 경로 모두 `_get_active_or_latest`로 **현재 세션 최근 제안서 폴백** 후 담기. active 무효여도 게스트가 방금 만든 제안서로 정상 담김. 실측 검증(무효 active→게스트 제안서 폴백 확인).

## 2026-07-14 — docker-compose GA4 secrets 마운트 운영 전용 분리

- GA4 서비스계정 키(`./backend/secrets:/app/secrets:ro`) 마운트가 base `docker-compose.yml`(로컬 공용)에 있어 macOS Docker Desktop file sharing 권한으로 로컬 backend 기동 실패(`operation not permitted`). GA4는 운영 대시보드 전용이므로 base에서 제거하고 `docker-compose.prod.yml`(운영 override)로 이동 — base 로컬 기동은 secrets 없이 정상(미설정 시 0 집계 graceful), 운영은 `-f docker-compose.yml -f docker-compose.prod.yml`로 병합 시 마운트됨. 앞선 GA4 커밋의 마운트 위치 정정.

## 2026-07-14 — 게스트 제안서 세션 안정화 + 회원 승계 (PRD)

- 비회원 제안서 담기에서 "이미 제안서가 있는데 없다고 판단 → 생성 플로우"로 빠지는 버그. 근본 원인: 게스트 제안서 소유가 휘발성 챗 세션 id(`proposal.session_id` → `ad_sessions` FK)에 묶임 + `useV2Chat` 복원 실패 시 네트워크/5xx에도 `localStorage` 세션을 영구 삭제(`useV2Chat.ts:242-245`) → 제안서 고아. 해결: ①핫픽스(404/410만 세션 삭제, 일시오류엔 유지) ②게스트 세션 안정화(`ensureGuestSession`으로 담기 전 세션 보장, 단일 세션 정책 유지) ③**회원가입(이메일/소셜 신규)** 시 `POST /proposals/claim`으로 게스트 제안서+챗 세션을 회원으로 승계 — **로그인은 제외**(잔여 게스트 세션 오병합 방지, SnsSignupForm 신규 가입 완료 지점에서만 소셜 승계). 스펙: [guest-proposal-session-claim](plans/2026-07-14-guest-proposal-session-claim.md).

## 2026-07-13 — 챗봇 대화 횟수 티어별 제한 (PRD)

- AI 추천 챗봇을 티어별로 제한: **비회원 10회 / 일반회원(사업자 미승인) 30회 / 사업자(verified) 무제한**. 카운트=user 발화 수(총 누적), 리셋 없음. 티어 판별은 `/recommend/v2/jobs`가 인증을 안 받으므로 `session_id → AdSession.user_id → business_registration`로 수행. 한도 도달 시 `enqueue_recommend_job`에서 파이프라인 스킵하고 `limit_reached` 이벤트 반환 → 프론트 입력창 비활성 + 안내 버블 + CTA(로그인/사업자등록). 스펙: [chat-usage-tier-limit](plans/2026-07-13-chat-usage-tier-limit.md).

## 2026-07-10 — 챗봇 앞단 의도 분류기 + Tool Calling 라우터 (설계 스펙)

- V2 챗봇의 발화 분기(현재: 정규식 힌트 + 의도별 structured-output 프로브 순차 캐스케이드)를 **통일된 앞단 의도 분류기(Stage1) + `.bind_tools()` 라우터(Stage2)** 로 재설계. 의도 4종(RECOMMEND/EXPLAIN/PROPOSAL/GENERAL), 전부 Lambda(`_event_stream`) 실행, 기존 실행 로직 보존·재사용. GENERAL(인사·페르소나·첫입력 가이드)은 하이브리드 생성. 스펙: [intent-classifier-tool-calling](plans/2026-07-10-intent-classifier-tool-calling.md) · TDD 구현 계획: [intent-classifier-tool-calling-plan](plans/2026-07-10-intent-classifier-tool-calling-plan.md).

## 2026-07-10 — 사업자등록증 상태 UI 정교화 + 파일 미리보기/다운로드 + 공용 컴포넌트

- 위 end-to-end 구현의 후속 UI/UX 정교화([profile §3.4](policies/profile.md) · [admin-members §3.7](policies/admin-members.md)).
- **원본 파일명·업로드 시각 저장**: 마이그 032로 `business_registration.license_file_name`/`license_uploaded_at` 추가, 업로드 시 기록 후 표시.
- **admin 회원 상세**: 등록증 **미리보기**(이미지 `<img>`/PDF `<iframe>`) + **다운로드 버튼** 추가. 다운로드는 인증 엔드포인트 `GET /admin/members/{id}/business-registration/download`(`FileResponse`, 원본 파일명 attachment)로 CORS 무관하게 원본명 저장(Figma 1198:26350).
- **유저 프로필 상태별 UI**(Figma 1100:27796/28626, 1115:36415): 검토중(주황 뱃지 + 안내문 + "취소")·인증 반려(빨강 뱃지 + "인증 반려 사유 : …")·검토 완료(민트 뱃지). "취소" → `DELETE /auth/me/business-registration`(파일 삭제·미등록 복귀). 유저단 reviewing 뱃지="검토중"(admin="검토 대기").
- **공용 컴포넌트화**: 파일 표시(아이콘+원본파일명+업로드시각)를 `components/common/LicenseFileInfo` + 공용 `FileIcon`으로 추출, 가입·프로필·모달·admin 4곳 중복 제거(로컬 아이콘 4벌·시간포맷 3벌 통합, `lib/date.formatDateTime` 재사용).
- **검토완료(verified) 혜택 확인**: 별도 등급 플래그 컬럼 없이 `business_registration.status=='verified'`로 판정 → 제안서 생성 **무제한**(guest 1/member 5), AI 채팅 **무제한**(비회원 5·개인 30·기업 미등록 100). 이미 문서화됨([proposals §2](policies/proposals.md) · [ai-media-recommend](policies/ai-media-recommend.md)), profile §3.4에 교차링크 추가.

## 2026-07-10 — 사업자등록증 업로드 end-to-end 구현

- 기존엔 UI만 있고 파일이 저장/조회되지 않던 사업자등록증 플로우를 실제 동작하도록 보강([profile §3.4](policies/profile.md) · [signup §3.2](policies/signup.md) · [admin-members §3.7](policies/admin-members.md)).
- **백엔드**: `POST /auth/me/business-registration`(multipart, 인증) 신설 — PDF/이미지·10MB 검증 후 로컬 디스크(`{upload_dir}/business/{user_id}/…`, proposals와 동일 방식) 저장, 상태 `reviewing` 전환. `GET /auth/me`(`UserResponse`)에 `business_registration` 노출.
- **가입**: 기업 가입 사업자등록증 UI를 Figma 반영(선택 칩 + "파일 업로드" 버튼), 가입 완료 직후 업로드(선택, best-effort).
- **마이페이지**: 하드코딩 "미등록" → 실제 상태 뱃지 + 파일 보기 링크. 업로드 모달을 Figma대로 재구성(register/change 분기: 제목·문구·"등록하기"/"변경하기", 드래그앤드롭, 파일 칩, 빈 상태 원형 배지 아이콘 `public/icons/business-upload.svg`). 유저단 뱃지 reviewing="검토중"(admin은 "검토 대기").
- **admin**: 회원 상세 기본정보 탭에 "등록증 파일" 보기 링크 추가(조회 전용).

## 2026-07-09 — SNS/이메일 인증 정책 정교화 + 이메일 회원가입 인증

- 위 작업의 후속 정교화([sns-email-verification-login-id §9](plans/2026-07-09-sns-email-verification-login-id.md)). 커밋 `60e6c4d`.
- **소셜 매칭 버그 수정**: 소셜 최초 로그인 시 기존 유저 조회 `email`→**`login_id`**. email(연락받을)은 비유니크라 다른 계정 연락 이메일과 제공자 이메일이 같으면 오연결되던 버그(카카오 yuleemin 계정에 네이버 wishmin82가 붙음) → 수정 + 잘못된 링크 1건 수동 삭제.
- **비밀번호 재설정**: 이메일 가입자 전용 → 조회를 `login_id`(가입 이메일)+`password IS NOT NULL`로 한정(SNS·중복 연락 이메일 제외).
- **프로필 조건부**: SNS 계정은 비밀번호 행 미표시(통제 불가), 연락받을 이메일 "변경"은 SNS만(이메일 가입은 login_id=email=식별자).
- **이메일 회원가입 인증 추가**: SNS와 동일 UI(이메일+전송/인증번호+인증완료), 전송 시 **login_id 중복 체크**(`GET /auth/register/email-available`), `register` 이메일 인증 완료 강제. 회원 관리에서 테스트 계정 `sichumin@gmail.com` 하드 삭제(요청).

## 2026-07-09 — SNS 이메일 인증 + 아이디/연락받을 이메일 분리

- 신규 기능([sns-email-verification-login-id](plans/2026-07-09-sns-email-verification-login-id.md)): 카카오/네이버 로그인 시 **수신 가능 이메일 인증**을 거치게 하고 **아이디(login_id)/연락받을 이메일(email)** 분리.
- **데이터 모델**: `users.login_id` 추가(마이그 `030`, 이메일가입=email·SNS=제공자 이메일·백필=email), `users.email` **unique 제거**(마이그 `031`) — 연락 이메일 중복 허용, 식별은 login_id. `email_verifications` 테이블(마이그 `029`, 6자리·5분). `register`/`authenticate` 조회 login_id 기준, `me`에 `login_id`·`sns_provider` 추가.
- **플로우**: 신규 SNS 유저 `verified=False` → 콜백에서 미인증이면 **`/signup/sns`**(이메일 인증+약관)→`POST /auth/sns/complete`. **가입완료 화면 `/signup/complete`**(시작하기→홈). 탈퇴 계정 SNS 재로그인=재활성화. 계정선택은 **카카오 `prompt=select_account`·네이버 `auth_type=reprompt`**(로그아웃-후-재로그인 방식은 UX·콘솔설정 문제로 폐기). `proxy.ts`에 `/signup/sns`·`/signup/complete` 예외(⚠️미들웨어 변경 시 프론트 dev 재시작).
- **이메일 인증 API**: `POST /auth/email/verify/request|confirm`, **이미 가입된 이메일도 통과**(수신 가능만 검증). `PATCH /auth/me/email`(코드확인 후 연락 이메일 변경, login_id 불변).
- **프로필**: 이름 밑 SNS 배지(카카오/네이버)+login_id, "아이디"→"연락받을 이메일", **연락받을 이메일 변경 모달**, 변경/탈퇴 버튼 커서. **admin 회원 목록/상세**: 가입 아이디/연락받을 이메일 컬럼·행 분리.
- 커밋 `3fba341`·`01a2164`·`aa0de97`·`00cf370`(브랜치 `feat/aws-migration-sqs-lambda`). ⚠️ **백엔드 Docker 이미지라 코드 반영은 `docker compose up -d --build backend`**. 카카오/네이버 이메일은 콘솔 "필수 동의" 설정 필요.

## 2026-07-08 — 비밀번호 재설정 이메일(SMTP) + 컷오버 완료

- **비밀번호 재설정 이메일**([password-reset-email-smtp](plans/2026-07-08-password-reset-email-smtp.md)): 토큰 응답 노출(코드리뷰 CRITICAL) 해소 → Gmail SMTP(`mailer.py`)로 재설정 링크 발송. `POST /auth/password-reset/request`는 토큰 미노출, **미등록 이메일 404**(UX 우선 — 이메일 열거 노출 감수). 프론트: 요청 화면을 모달→**`/find-account` 페이지(signup 스타일)**로 전환 + `/reset-password`(Suspense+token) 페이지. EC2 `.env`엔 SMTP 키 **병합**(통째 복사 시 RDS/SQS/CORS 덮임 주의). Gmail 앱비번 발신은 초기 **스팸** 분류.
- **컷오버 완료**: 구 Amplify `NEXT_PUBLIC_API_URL` → 새 백엔드(`https://43-201-172-34.sslip.io`). CORS(`FRONTEND_URL`)에 Amplify+localhost 포함, 프리플라이트 확인. 배포 프론트→새 백엔드 재설정 E2E 정상. → **모든 API가 새 백엔드/새 RDS 기준**(구 회원 데이터 미이관).
- 매체 썸네일 빈 슬롯 플레이스홀더(Figma) + 썸네일 개수 상수화(`THUMBNAIL_COUNT`). 커밋 `bc23ec1`. 재설정/SMTP는 `69f5f35`(main 푸시됨).

## 2026-07-08 — GA4 홈 진입 수 구현·런타임 연결 완료 (데이터 지연 확인)

- GA4 연동 코드 구현·검증([ga4-analytics-integration](plans/2026-07-07-ga4-analytics-integration.md) §9.4). 프론트 `@next/third-parties` `GoogleAnalytics`(client 그룹, `NEXT_PUBLIC_GA_ID`), 백엔드 `ga4_service`(GA4 Data API, date 차원 1회로 today/total/monthly, 미설정·실패 시 0) → `dashboard_service` 합류, 대시보드 `visitors` 카드 + `VisitorLineChart` 실데이터화(범례 "문의"→"방문자 수" 정정).
- 확보값: 측정 ID `G-J3BPLSXTDX`, 속성 ID `544621425`. 서비스 계정 JSON은 `backend/secrets/`(gitignore). 검증: tsc·eslint 0, 백엔드 임포트 OK, 미설정 graceful 0 확인.
- **남은 것(사용자)**: env 3개 주입(`NEXT_PUBLIC_GA_ID`/`GA4_PROPERTY_ID`/`GA4_CREDENTIALS_PATH`) + 서비스계정 JSON 배치(EC2는 rsync 제외라 직접 업로드) → 실데이터. 속성 신규라 이전 월 0, Data API 수 시간 지연.
- **런타임 연결(로컬)**: `backend/.env`에 값 주입. **경로 버그 수정**(`GA4_CREDENTIALS_PATH`에 `backend/` 접두사 붙어 오해석 → backend cwd 기준 `secrets/...json`), venv가 **uv라 pip 없음 → `uv pip install google-analytics-data`**, `--reload` 재기동. **실 GA4 호출 성공**(크리덴셜·속성 뷰어 권한·API 정상).
- **대시보드 크래시 수정**: 프론트 `.env.local`이 원격 EC2(구코드, `visitors` 없음)를 봐서 `summary.visitors` undefined → `summary?.visitors?.today` 방어. 로컬 확인은 `NEXT_PUBLIC_API_URL=http://localhost:8001` 리포인트. ⚠️ 프론트가 보는 백엔드에 새 코드+env 없으면 값 안 옴.
- **데이터 지연(시간차) 확인**([§9.6](plans/2026-07-07-ga4-analytics-integration.md)): 대시보드는 GA4 **코어 리포트(`runReport`)** 사용 → 실시간 아님. 실증: 실시간 `activeUsers=1`·`screenPageViews=2`(수집 정상) vs 코어 7일 `0`(미처리). **새 속성은 표준 리포트 반영까지 최대 24~48h**, 이후 수 시간 지연. 즉시 반영 원하면 "오늘"만 `runRealtimeReport` 하이브리드(미구현).

## 2026-07-08 — GA4 1차 범위 확정 (홈 진입 수 → 대시보드)

- GA4 연동 방향 확정([ga4-analytics-integration](plans/2026-07-07-ga4-analytics-integration.md) §9): **1차는 "홈 진입 수(홈 방문 카운트)"만** 계측 → admin 대시보드 `VisitorLineChart`(현재 목데이터, 범례 "문의" 오기)를 실데이터로 교체.
- 수집=프론트 gtag(`@next/third-parties`, client 그룹만), 표출=**GA4 Data API**(백엔드가 월별 `screenPageViews` pagePath=`/` 조회 → `dashboard_service` 합류). 자체 집계 대신 GA4 선택(마케팅 분석 병행 목적).
- **GA4 속성 없음 → 신규 생성 필요**. 셋업 가이드(GA4 속성+측정ID/속성ID, GCP 서비스계정 JSON+Data API 사용설정, 속성 뷰어 권한) 문서화(§9.1~9.3). **크리덴셜 확보 후 프론트+백엔드+대시보드 한 번에 구현** — 코드 미착수.
- 대기 중(사용자): 측정 ID·속성 ID·서비스계정 키 3종. 서비스계정 JSON은 자격증명 → 커밋/채팅 금지, EC2 .env로 주입.

## 2026-07-07 — GA4 애널리틱스 연동 검토·계획

- 요청 "ga4 검토" → 전수 확인 결과 **GA4 미연동**(스크립트·의존성·env·layout·문서 모두 없음). 검토가 아닌 신규 연동 이슈로 정리.
- 연동 계획 문서 작성([ga4-analytics-integration](plans/2026-07-07-ga4-analytics-integration.md)): Next 16 App Router라 `@next/third-parties`의 `GoogleAnalytics`를 **`app/(client)/layout.tsx`에만** 두어 admin/deck 제외, `NEXT_PUBLIC_GA_ID`(운영은 Amplify env), SPA page_view는 GA4 향상된 측정 위임(1차), 이벤트 맵(검색·AI추천·view_item·매체담기·제안서·가입/로그인/문의) 초안 + 동의(Consent) 처리. **코드 미구현(설계 단계).**
- 미결정: 측정 ID 발급 주체, 동의 배너(Consent Mode v2) 도입 여부, admin 트래킹 분리, 이벤트 최종 스키마.

## 2026-07-07 — SQS+Lambda 비동기 AI 추천 아키텍처 계획

- AWS 계정 이전 계기로 **AI 추천 LLM 호출을 EC2 동기 → SQS+Lambda 비동기**로 분리하는 설계 계획 작성([sqs-lambda-async-ai-recommend](plans/2026-07-07-sqs-lambda-async-ai-recommend.md)). 현재 코드(`recommend_v2.py`의 `extract_keywords`→`filter_media_items`) 흐름 기반.
- 확정 결정: ①분당 콜수는 **Lambda reserved concurrency**로 제어(Redis rate limiter 보류), ②**SSE 불가** 확인 → 프론트 **가짜 스트리밍 로딩 텍스트**로 대체, ③결과는 **폴링 확정** — Lambda가 RDS `ai_recommend_jobs`에 저장, 프론트가 job_id로 조회해 표기.
- **신규 AWS 계정에서 그린필드 구축**(기존 EC2 계정 아님): EC2·RDS·SQS·Lambda·Amplify 새로 만들고 데이터 이관 후 컷오버. 미구현(설계 단계).
- **구축 방식 확정**: 1회성 인프라는 명령형(단계별 `aws` CLI/MCP 실행), 반복 재배포만 스크립트(`redeploy.sh` 스타일). IaC 미도입. 신규 계정 `787418837344`(IAM user `ssm`, 로컬 프로필 `ooh-new`, `aws --profile ooh-new`로 실행).
- **인프라 결정 확정**: 리전 `ap-northeast-2`, **기본 VPC + SG 격리**(커스텀 VPC/NAT 미사용, RDS 미공개+SG), 순서는 **베이스 인프라 이전 먼저→async 2단계**, 리소스 네이밍 **`admix-*`**(레포/프로필명은 유지). 새 계정 현재 리소스 0개(기본 VPC만).
- **새 계정이 AWS Free Plan** 확인 → **(B) 무료 플랜으로 셋업/테스트 진행, 운영 전환 전 유료 업그레이드 + RDS 백업 활성화** 조건으로 결정. 업그레이드는 리소스 재구축 없이 billing 토글 + `modify-db-instance`(backup-retention, gp3)로 온라인 처리 가능.
- **구축 착수(2026-07-07)**: SG 3종(`admix-backend/lambda/db-sg`) 생성 완료. RDS `admix-db`(PG16.14, t4g.micro, gp2 20GB, db명 `admix_recommend`, 비번 Secrets Manager) 생성 완료.
- **베이스 인프라 + 데이터 이관 완료(2026-07-07)**: EC2 `admix-backend`(t3.micro, EIP `43.201.172.34`, docker/nginx/certbot, swap 2GB, IAM역할로 Secrets 접근) + RDS(postgis 3.4.6/vector 0.8.2). 데이터는 **구 prod 스키마 전체 복제(alembic-only는 ad_sessions 마이그 누락으로 불가) + 콘텐츠 테이블만 적재**(회원·chat·proposal 제외). alembic head `026`.
- **backend 기동 완료(2026-07-07)**: override `docker-compose.newacct.yml`(postgres 컨테이너 미사용, `DATABASE_URL`→RDS)로 backend 컨테이너 기동. `/health` 200 + `/chat/graph/sessions` 200(RDS 쿼리 확인). 앱 시크릿은 구 EC2 `.env` 복사 재사용. ⚠️ JWT 시크릿 미설정(기본값)·운영 전 설정 필요. 남은 것: nginx+HTTPS(도메인)·Amplify(+Git 이전)·컷오버·(2단계)async.
- **backend HTTPS 공개(2026-07-07)**: nginx 리버스프록시 + certbot으로 `https://43-201-172-34.sslip.io` 발급(자동갱신). 외부 접근·cert 검증 OK. Amplify는 기존 앱(`main.d5zpc903rfz5q`) 유지 결정 → CORS·redirect URI 변경 불필요, **기존 Amplify `NEXT_PUBLIC_API_URL`만 새 백엔드로 변경(구 계정 콘솔, 사용자)** 하면 연결 완료. 남은 것: Amplify+Git 이전(나중)·JWT 시크릿·(2단계)async.
- **2단계 착수 설계 확정(2026-07-07)**: job 단위 = 챗 메시지 1건(기존 `recommend_v2_stream` 로직 재사용, 결과를 `ai_recommend_jobs`에 저장) / 세션·매체·제안서(PPT)는 EC2 동기 유지 / Lambda = `backend/src` 공유 컨테이너 이미지(ECR) / SQS FIFO(`MessageGroupId=session_id`)로 세션 순서보장. 계획서 §6-A.
- **2단계 ① 인프라 착수(2026-07-07)**: SQS FIFO `admix-ai-jobs.fifo`(+DLQ, redrive 3), Lambda역할 `admix-lambda-role`, ECR `admix-ai-agent`, EC2역할에 SQS Send 추가. 다음: ② 백엔드(`ai_recommend_jobs` 테이블+enqueue/폴링) → ③ Lambda 컨테이너 → ④ 프론트.
- **2단계 ② 백엔드 완료·검증(2026-07-07)**: `ai_recommend_jobs` 모델+alembic 028, `ai_job_service`(SQS FIFO enqueue), `POST/GET /recommend/v2/jobs`, config+boto3. EC2 배포 후 POST→202·SQS 메시지 1건·폴링 확인. IMDS hop limit 2로 컨테이너 역할 사용. 다음: ③ Lambda(recommend 로직 결과-반환형 리팩터 + 컨테이너 이미지→ECR + 이벤트소스매핑).
- **2단계 ③ Lambda 완료·E2E 검증(2026-07-08)**: `collect_recommend_events`(_event_stream 구동해 이벤트 수집, 로직 중복 없음) + `lambda_handler.py` + `Dockerfile.lambda`(슬림). Lambda `admix-ai-agent`(비-VPC, 컨테이너 이미지) + SQS 이벤트매핑. **결정 변경 2건**: ①**VPC 없이 오픈 연결**(사용자 결정) — Lambda VPC 밖(OpenAI 직결) + RDS `publicly-accessible=on`+SG 5432 오픈(⚠️운영 전 조이기 필수), ②reserved concurrency는 Free Plan 계정 한도(10) 때문에 불가 → **이벤트매핑 `MaximumConcurrency=5`**로 대체. 이미지 빌드 시 Lambda가 OCI attestation 매니페스트 거부 → `buildx --provenance=false`. E2E: enqueue→SQS→Lambda→OpenAI+RDS→job done 확인. 남은 것: ④ 프론트(폴링+가짜 스트리밍).
- **2단계 ④ 프론트 완료(2026-07-08)**: `useV2Chat.submit`을 SSE→**enqueue+폴링**(`/recommend/v2/jobs`) 전환, `applyEventData`로 렌더 공유, **가짜 스트리밍 loadingLabel 순환**(`AssistantBubble`), `removeSlot`은 SSE 유지. tsc 통과. **2단계(SQS+Lambda 비동기 추천) 코드 4단계 전부 완료.** 반영은 Amplify가 새 백엔드를 보도록 컷오버(`NEXT_PUBLIC_API_URL`) 필요. 운영 전 필수: JWT 시크릿·계정 유료+RDS 백업·RDS 노출 조이기·Amplify+Git 이전.

## 2026-07-06 — 관리자 권한 체계 + 로그인 토큰 보안

- 코드리뷰([backend-db-code-review](reviews/2026-07-06-backend-db-code-review.md)) 후속 수정 착수. 신설 [관리자 인증·권한 정책](policies/admin-auth-permissions.md).
- **관리자 권한 체계**(커밋 `59ad3f1`): 마스터 계정(account_type) + 계정 CRUD 마스터 전용 + 마지막 마스터 보호, `require_permission` 메뉴별 가드(members/proposals/inquiries/chat/faq, FAQ 무인증 해소), chat 키 신설, 사이드바/roles 폼 권한 게이팅(대시보드 상시·마스터 권한박스 숨김).
- **로그인 토큰 보안**(커밋 `ac23a29`): refresh 해시 저장·재사용 감지·탈퇴/제재 access 차단. **로그아웃 서버 폐기**(커밋 `cf48252`): `POST /auth/logout` 연동.
- 리뷰 문서에 수정 이력 반영. 미해결: OAuth state·비번재설정 토큰 노출·`ad_sessions` 마이그레이션·recommend_v2 스레드 세션 등.

## 2026-07-06 — 프론트 색상 토큰 정리 (M8)

- 프론트 코드리뷰([code-review-2026-07-01](../tasks/code-review-2026-07-01.md)) M8: 하드코딩 hex → 토큰 클래스. **1차(토큰 존재) `[#hex]`→토큰 치환 약 244건/56파일**(tsc 통과). 토큰 없는 미정의 색 70여 종은 [design-tokens.md](design-tokens.md) "미토큰화 하드코딩 색상" 섹션에 그룹별(그레이/danger/warning/success/브랜드) 정리 — 후속 토큰 신설·수렴 대상.

## 2026-07-06 — 백엔드/DB 코드리뷰

- [backend-db-code-review](reviews/2026-07-06-backend-db-code-review.md): `backend/src` 전체 + Alembic 26개 마이그레이션 리뷰(도메인별 4에이전트 병렬 + 최고위험 직접검증). CRITICAL 6건 — admin/FAQ 인증가드 부재, 비번 재설정 토큰 응답노출, OAuth state 미검증, `ad_sessions`/`ad_messages` 생성 마이그레이션 누락(신규 DB 구축 실패), recommend_v2 스레드 간 SQLAlchemy Session 공유. `docs/reviews/` 카테고리 신설.

## 2026-07-04 — 소셜 로그인 · 배포/운영 · 스키마 정리

- [social-login-deploy-ops](plans/2026-07-04-social-login-deploy-ops.md): 카카오/네이버 소셜 로그인 연동 + 회원 탈퇴, 배포(EC2+Amplify) env 관리, `create_all` 제거 → alembic 전용 전환(DuplicateTable 사고 복구), Geoapify PPT 지도 운영 반영, 한글 IME Enter 이중생성 버그 수정.

## 2026-07-02 — LLM Wiki 패턴 적용

- `docs/`를 LLM Wiki로 위키화: [index.md](index.md)(카탈로그) + `log.md`(본 파일) 신설, 루트 [CLAUDE.md](../CLAUDE.md)에 ingest/query/lint 워크플로우 스키마 추가.
- 기존 문서는 변경 없음. [CONTEXT.md](../CONTEXT.md)를 개요 페이지로 참조.

---

<!-- 아래는 기존 docs/plans 기준으로 시드한 과거 기록. 상세는 각 링크 참조. -->

## 2026-06-30 — 매체검색 지도 PRD

- [media-search-map-prd](plans/2026-06-30-media-search-map-prd.md): 지도 영역 검색 + 서버 줌 클러스터링 PRD.

## 2026-06-23 — 챗 매체 상세 동작 변경

- [chat-media-detail-behavior](plans/2026-06-23-chat-media-detail-behavior.md): media_detail 질문 동작 변경.

## 2026-06-22 — V2 챗봇 포팅

- [v2-chatbot-port](plans/2026-06-22-v2-chatbot-port.md): V2 챗봇을 현재 구조로 포팅 + 3개 기능 확장.

## 2026-06-16 — FastAPI 인증/로그인

- [fastapi-auth-login](plans/2026-06-16-fastapi-auth-login.md): 인증/로그인 구현 정리.

## 2026-06-02 — PPT 업로드

- [ppt-upload-and-rendering](plans/2026-06-02-ppt-upload-and-rendering.md): PPT 업로드 + 자동 변환 미리보기.

## 2026-06-01 — V2 챗봇 문구

- [catalog](plans/2026-06-01-v2-chat-messages-catalog.md) / [for-pm](plans/2026-06-01-v2-chat-messages-for-pm.md): V2 챗봇 챗 문구 카탈로그 및 기획 전달용 일람.

## 2026-05-27~28 — Recommend V2 + 슬롯 변경 시맨틱

- [recommend-v2-plan](plans/2026-05-27-recommend-v2-plan.md): 새 추천 파이프라인.
- [slot-change-semantics (final)](plans/2026-05-27-slot-change-semantics-plan.md), [2026-05-28](plans/2026-05-28.md).

## 2026-05-26 — 세션 영속화 기반 작업

- [postgres-saver](plans/2026-05-26-postgres-saver.md), [checkpoint-pruning](plans/2026-05-26-checkpoint-pruning-state-trimming.md), [session-delete-cleanup](plans/2026-05-26-session-delete-checkpoint-cleanup.md), [slot-change-semantics (초안)](plans/2026-05-26-slot-change-semantics-plan.md).
