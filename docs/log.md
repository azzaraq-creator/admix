# 🗓️ 작업 로그 (Log)

> append-only 시간순 기록. 새 자료 ingest / 주요 결정 / 작업 완료를 **최신이 위로** 쌓는다.
> 형식: `## YYYY-MM-DD — 제목` + 한두 줄 요약 + 관련 문서 링크.
> 관리 규칙은 루트 [CLAUDE.md](../CLAUDE.md) 참조.

## 2026-07-27 — 계정 관리 `account` 권한 게이팅 전환 (+마스터 티어 봉인)

`account`(계정 관리) 권한을 부여해도 사이드바 메뉴가 활성화 안 되던 문제. 원인은 `account`를 **아무 곳도 참조 안 하는** 설계 불일치 — 사이드바는 `account`를 무조건 숨기고(`return false`) 백엔드 쓰기는 마스터 전용(`get_current_master_admin`)이라 roles UI에서 권한을 줘도 무효. 사용자 결정에 따라 **권한 게이팅으로 전환**: ① 사이드바 특례 제거 → 권한 보유 시 노출 ② `/admin/accounts` 전 엔드포인트(조회 포함)를 `require_permission("account")`로 조임(이전 조회 `get_current_admin`은 정보노출 홀) ③ **마스터 티어 봉인 가드**(`_guard_master_tier`) — 비마스터+account가 마스터 생성/승격/수정/삭제 시 403(권한 상승 방지). 비마스터+account 토큰으로 권한통과·마스터봉인 403 비파괴 검증(도커 리빌드 반영). 정책: [admin-roles](policies/admin-roles.md)·[admin-auth-permissions](policies/admin-auth-permissions.md).

## 2026-07-27 — FAQ 쓰기 403·목록 미갱신·등록폼 정렬 수정

FAQ 3건 수정. ① **생성/수정 403**: 쓰기 API가 공개 `/faqs`에 있어 프론트 인터셉터(`/admin`에만 관리자 토큰 첨부)가 토큰을 안 실어줘 마스터 포함 전원 `HTTPBearer` 403 → 쓰기를 `/admin/faqs`(admin_router)로 이동 + 프론트 호출 경로 변경(도커 백엔드 `--build` 재기동으로 반영, curl 검증). ② **등록/삭제 후 목록 미갱신**: 뮤테이션 invalidate가 `faqsKeys.list()`(`["faqs","list"]`)만 대상이라 관리자 목록 키(`["faqs","admin","list"]`)와 prefix 불일치 → `faqsKeys.all`로 변경. ③ **등록 폼 정렬**(Figma 1258-2849): 별표를 라벨 컬럼 우측 끝으로(`justify-between`), 라벨 `h-[44px]` 밴드 중앙 정렬로 `내용` 라벨이 textarea 첫 줄과 맞도록, 단일행 라벨 `items-center` 통일. 정책: [admin-faq](policies/admin-faq.md).

## 2026-07-27 — 맞춤제안서 명 저장·표시 버그 수정 + 이력 제목 말줄임

`admin/proposals/[id]/write`에서 맞춤제안서 명을 입력해도 제목이 첨부 파일명으로 저장되던 버그. 원인은 입력이 비제어(`defaultValue`)라 전송조차 안 됐고 서버가 파일명에서 제목을 뽑던 것. controlled input + 필수 검증 + `title` 폼 필드 전송으로 바꾸고, `ProposalCounterFile.title` 컬럼 신설(마이그레이션 `037_add_counter_file_title`, nullable). 표시(이력 목록/맞춤제안 상세 "제목")는 `title ?? file_name` 폴백, **다운로드는 원본 파일명 유지**. 더불어 이력 목록 "제목"이 칸을 넘칠 때 `…` 말줄임 안 되던 문제도 수정(flex 셀 `truncate` 직접 지정 미동작 → `min-w-0` + `<span truncate>`). 배포 시 `alembic upgrade head`(037) 필요. 정책: [admin-proposals §3.B.4·3.C](policies/admin-proposals.md).

## 2026-07-27 — 제안 상세 미리보기 확대 아이콘 수정 + 슬라이드 라이트박스

`admin/proposals/[id]` 미리보기 우상단 아이콘이 Figma(`lucide/fullscreen`)와 달리 `maximize`(코너만)로 오적용돼 있던 것을 `FullscreenIcon`(코너+내부 사각형)으로 교체(`MaximizeIcon`은 타 화면 사용 중이라 유지). 클릭 시 `ProposalSlideLightbox` 오픈 — 맞춤제안 상세 이미지 라이트박스와 동일 UX(오버레이·좌우 이동·인디케이터·하단 썸네일 스트립). 이 화면 슬라이드는 이미지가 아니라 코드 템플릿이라 공용 `ImageLightbox`(이미지 전용) 대신 별도 컴포넌트를 쓰고, 슬라이드 렌더는 `AdminSlideView`로 프리뷰와 공유(`SlideScaler` 스케일). 좌우 이동은 프리뷰 `selected`와 동기화. 정책: [admin-proposals §3.B.3](policies/admin-proposals.md).

## 2026-07-27 — 제재 삭제 confirm 오버레이 노출 수정 (중첩 Dialog backdrop)

`SanctionModal`(제재 상세) 안에서 삭제 confirm Dialog가 중첩될 때 오버레이가 안 뜨던 문제. 원인은 Base UI 1.4.1 `DialogBackdrop`이 **중첩 다이얼로그의 backdrop을 렌더하지 않음**(`enabled: forceRender || !nested`) — z-index 문제가 아니었음. 공통 `ui/dialog`의 `DialogContent`에 `backdropForceRender`·`backdropClassName` prop을 추가하고, `useAdminConfirm`이 `backdropForceRender`+`z-[60]`를 지정해 제재 상세 모달 위로 오버레이가 덮이도록 수정. 정책: [admin-members 제재 관리 탭](policies/admin-members.md).

## 2026-07-27 — 회원 상세 제안/문의 이력 탭 비즈니스 관리 권한 게이팅

두 탭이 admin/proposals·admin/inquiries 목록(모두 `business` 권한)을 재사용하게 되면서, 회원 상세에서도 **제안 이력·문의 이력 탭을 비즈니스 관리(`business`) 권한으로 게이팅**. 회원 관리(`member`) 권한만으론 두 탭 비노출(기본 정보·제재 관리만), 마스터 계정은 전체, URL로 숨긴 탭 강제진입 시 기본 정보로 폴백. `MemberDetailView`가 `useAdminMe().permissions`/`account_type`로 판정(사이드바와 동일). 제안/문의는 시스템상 단일 `business` 권한이라 두 탭이 함께 열림/숨김(독립 권한 분리는 키 신설이 필요해 미채택). 정책: [admin-members §3.6](policies/admin-members.md#36-상세--탭-네비게이션).

## 2026-07-27 — 회원 상세 문의 이력 탭을 admin/inquiries 목록 재사용으로 개편

제안 이력 탭과 동일 패턴을 문의 이력 탭에도 적용. 백엔드 `GET /admin/inquiries`에 `member_id` 필터 신설(`list_inquiries`/`list_inquiries_all`), 프론트는 `MemberInquiriesTab`이 `useAdminInquiries({ member_id })` + admin의 `inquiryColumnList`·`InquiryStatusBadge`를 공유(검색 숨김, 행 클릭 시 문의 상세 이동). member 상세 `_components/index.tsx`의 중복 문의 컬럼·`StatusBadge` 제거(이제 제재 컬럼만 남음). 정책: [admin-members §3.9](policies/admin-members.md#39-상세--문의-이력-탭) · [admin-inquiries §3.1](policies/admin-inquiries.md).

## 2026-07-27 — 회원 상세 제안 이력 탭을 admin/proposals 목록 재사용으로 개편

회원 상세의 제안 이력 탭이 member 전용 매핑(상태 "집행요청"·"계약 완료"(공백), 자체 색상)을 쓰던 것을 폐기하고 **admin/proposals 목록을 그대로 재사용**. 백엔드 `GET /admin/proposals`에 `member_id` 필터 신설(`list_proposals`/`list_proposals_all`), 프론트는 `MemberProposalsTab`이 `useAdminProposals({ member_id })` + admin의 `proposalColumnList`·`ProposalStatusBadge`를 공유(컬럼에 "매체 수" 추가, 검색 숨김, 행 클릭 시 제안서 상세 이동). 결과로 상태 색·라벨이 admin/proposals와 완전 일치하고 "집행요청" 배지 색 미정의 문제 해소. 작성중(`new`)은 admin 규칙대로 탭에서 제외. 정책: [admin-members §3.8](policies/admin-members.md#38-상세--제안-이력-탭) · [admin-proposals §3.A.1](policies/admin-proposals.md).

## 2026-07-27 — admin 배지 정리: 사업자 인증 상태 공통화 · 제안서 "삭제됨" 제거

- **사업자 인증 상태 배지 lib 공통화**(`a664626`): 목록의 상태별 색상 배지를 `lib/bizStatus.tsx`(`BizStatusBadge`·`bizStatusLabel`·en코드→한글 라벨)로 분리. 회원 상세 헤더의 "사업자정보" 배지가 회색 고정이던 것을 목록과 동일한 상태별 색상 배지로 교체. 정책: [admin-members §3.4·§3.5](policies/admin-members.md).
- **제안서 목록 "삭제됨" 보조 배지 제거**(`8d665c0`): 상태 컬럼에서 삭제됨 표시만 제거. `deleted` 데이터 필드·삭제 처리 로직은 유지. 정책: [admin-proposals §3.A.3](policies/admin-proposals.md).

## 2026-07-24 — 모바일 뷰포트 대응 h-screen→h-dvh 통일 (`0cc8f0a`)

iOS Safari 하단 URL 바가 떠 있을 때 `h-screen`(=100vh)이 콘텐츠·제출버튼을 툴바 뒤로 자르는 문제. 전체 높이 유틸 `h-screen`/`min-h-screen` 20곳(16개 파일)을 `h-dvh`/`min-h-dvh`로 통일. 규칙: [frontend-structure.md 반응형/뷰포트 규칙](frontend-structure.md#반응형--뷰포트-규칙).

## 2026-07-24 — 프론트 QA 픽스 #10~#12 (service 정렬·토스트 통일·전화번호 lib)

QA 지적 3건 수정. 상세: [qa-fixes #10~#12](reviews/2026-07-22-qa-fixes.md).
- **#10 service 비교표 높이**(`05bfacb`): 타사/ADMIX 좌우 컬럼을 단일 `grid grid-cols-2`로 통합 → 대응 행이 한쪽만 개행돼도 높이 동일. 타사 이미지 박스도 `sm:h-[220px]`로 ADMIX와 통일.
- **#11 토스트 모바일 개행 + useSonner 통일**(`4e9193a`): `useSonner`에 `max-[600px]:w-full`(Sonner 경계 600px 일치)로 넓은 폰 개행 해소. `ContactView` 로컬 토스트·`AiChatPanel`·`useReactChat`(react)를 useSonner로 통일(v2 챗훅은 제거 예정 미변경). useSonner 함수 `useCallback` 안정화.
- **#12 전화번호 9~11자리(02) lib**(`f126dcc`): `lib/phone.ts` 신설(`PHONE_PATTERN`·`isValidPhone`·`formatPhone`), SignupForm·ProfileView 공통 적용. 백엔드는 제약 없어 수정 불필요.

## 2026-07-24 — recommend_react 운영 배포 (신버전 챗봇 전환)

슬롯머신 v2 → **ReAct 챗봇(recommend_react)으로 운영 전환**. 프론트 fixed 챗패널이 `/recommend/react/jobs`(비동기 잡→폴링) 사용.
- **배포 순서(유저 대면 프론트를 마지막)**: ① Lambda `admix-ai-agent` 재빌드/ECR push/갱신(react 처리기) → ② EC2 `deploy/redeploy.sh`(enqueue 라우트) → ③ **prod react E2E 게이트**(EC2에서 enqueue→폴링 `done` 확인) → ④ `git push origin main`→Amplify 자동배포(빌드 SUCCEED). Amplify 앱 `d5zpc903rfz5q`는 **구 계정**(CLI `--profile default`), 백엔드는 신 계정 `ooh-new`.
- **additive**: v2 라우터/경로는 그대로 유지. `ai_job_service`/`lambda_handler`가 job `version`("react"|"v2")로 분기. 롤백 레버 = 프론트만 v2 훅 되돌려 push(Lambda/EC2 무수정).
- **배포 중 버그 수정(07c42f3)**: react job이 status 갱신 없이 pending 고착 → CloudWatch에서 `Runtime.ImportModuleError: openpyxl` 확인. `media_service.py`가 openpyxl을 **모듈 최상위** import(다른 서비스는 함수내부 lazy)해 Lambda 슬림 의존성(`requirements-lambda.txt`, openpyxl 제외) 환경에서 크래시. 사용 함수 내부 lazy import로 전환 + 이미지 import 스모크테스트 후 재배포. 설계: [spec](superpowers/specs/2026-07-22-recommend-react-design.md).

## 2026-07-24 — recommend_react 제안서 도구 UX 완성 + 버그 수정

챗 제안서 도구(CreateProposal/AddMedia/RenameProposal)를 **member 토큰 E2E로 전부 검증**(DB 영속 확인)하고 UX·버그 다수 수정.
- **제안서 선택 인라인 카드**(`proposal_choices` 이벤트 + `action` add/rename): 담을/바꿀 제안서가 여러 개면 "이름 대라"는 텍스트 대신 **클릭 가능한 제안서 목록**을 챗에 노출. Figma [1058:31220] 폴더행 스타일(아이콘색 `platinum-300` 신설). 클릭 시 `useAddProposalItems`/`useRenameProposal`로 직접 처리.
- **AddMedia**: `proposal_name`(대상 지목) + 제안서 없을 때 자동생성 대신 생성 안내 + `media_names`(이름으로 매체 지목, 목록에 없으면 추측 금지 → 엉뚱한 매체 담기 방지). 티어 한도(비회원1/일반5/사업자무제한) 적용 확인.
- **RenameProposal**: `target_name`(대상 지목) + 여러 개면 선택 목록(action=rename) + **새 이름 없이도 목록 먼저** 노출(클릭 시 이름 입력).
- **버그 수정**: (1) 담기 실패(404 등)해도 "✓ 담았어요" 뜨던 swallowed error → **성공 시에만** 완료 표시. (2) LLM이 도구를 안 부르고 "제안서 없어요"/"목록 보여줄게요"를 **지어내던** 문제 → 프롬프트로 매번 도구 호출 강제(이전 stale 답 재사용 금지). (3) 소유자 판정 오진(잡 경로는 토큰 없이 `AdSession.user_id`로 판정, 로그인 유저는 세션 생성 시 연결)했던 소유권 코드는 되돌림.
- **제안서 삭제**: 챗 도구 미구현(의도적) — LLM이 "삭제 기능 없음" 정직 안내.
- 백엔드 20 react tests·프런트 tsc·eslint 통과. 설계: [spec](superpowers/specs/2026-07-22-recommend-react-design.md).

## 2026-07-23 — 탈퇴 회원 hard delete + 제안서 제출자 스냅샷 보존 (QA #9)

탈퇴 회원 로그인 시 제재 모달이 뜨던 버그(soft delete 잔존 → 403, 프런트가 403을 제재로 단정). "탈퇴 즉시 파기" 방침에 맞춰 hard delete로 전환. 제안서는 CASCADE 삭제 대신 제출 당시 신청자 스냅샷 5필드(회원유형·회사명·이름·이메일·전화) 보존 — proposal 스냅샷 컬럼 + member_id FK SET NULL + `User.proposals` passive_deletes(ORM delete-orphan 함정 회피) + Alembic 036 백필. `withdraw()` hard delete, oauth 재로그인 복구 제거, 기존 withdrawn 삭제 스크립트. 로그인 가드는 안전망으로 유지, 프런트 수정 불필요. backend 97 passed. **운영 배포 완료(2026-07-23)** — redeploy.sh로 코드+Alembic 036 + 기존 withdrawn 1건 삭제, 탈퇴 계정 로그인 401 정상화. 잔여: 컴플라이언스(영구보존 vs 즉시파기) 법무 확인. 설계: [account-withdrawal-hard-delete](plans/2026-07-23-account-withdrawal-hard-delete.md) · [qa-fixes #9](reviews/2026-07-22-qa-fixes.md).

## 2026-07-23 — 문의하기 제출 성공 토스트 + 토스트 배경 Figma 정렬 (QA #8)

`InquiryModal` 제출 성공 시 "제출이 완료되었습니다." 토스트 추가. Figma 토스트 디자인(1036-26916)은 이미 `useSonner`로 구현된 프로젝트 표준이라, sonner 기본 `toast.success` 대신 `useSonner().success`로 교체. 배경 투명도만 Figma와 달라(`0.8`→`0.7`) `useSonner`에서 정렬(앱 전체 토스트 반영). warning/error색/챗봇 toast.error는 스코프 밖. tsc/eslint 통과. 정리: [qa-fixes #8](reviews/2026-07-22-qa-fixes.md).

## 2026-07-23 — 로그인 시 사이드바 도움말 중복 제거 (QA #7)

로그인하면 도움말이 프로필 팝업 안으로 들어가는데, 사이드바 독립 도움말 행이 로그인 여부 무관하게 항상 렌더돼 중복 표시됐다. `Sidebar.tsx` 독립 도움말을 `{!me && ...}`로 감싸 비로그인일 때만 노출. tsc/eslint 통과. 정리: [qa-fixes #7](reviews/2026-07-22-qa-fixes.md).

## 2026-07-23 — 로그아웃 후 이전 사용자 세션·제안서 잔존 수정 (QA #6)

로그아웃 핸들러(Sidebar·ProfileView 복붙 2곳)가 토큰+`me` 쿼리만 지우고, localStorage `SESSION_KEY`(채팅 복원+게스트 제안서 소유 공용)와 제안서 캐시를 안 지워 이전 사용자의 채팅/제안서가 복원됐다. `lib/session.ts`에 `clearSessionId()` 추가, `hooks/auth`에 `useLogout()` 훅 신설(토큰폐기→clearUserToken+clearSessionId+`queryClient.clear()`+홈이동)로 두 핸들러 통합. tsc/eslint 통과, 브라우저 미검증. 스코프 밖: 로그인 마이그레이션·`handleWithdraw` 동일 패턴은 미변경. 정리: [qa-fixes #6](reviews/2026-07-22-qa-fixes.md).

## 2026-07-23 — fixed 검색 지오코딩 실패 시 결과없음 표시 (QA #5)

fixed 검색바는 매체를 검색하는 게 아니라 지도 위치를 옮기는 입력(리스트는 bbox로 조회)이라, 존재하지 않는 주소 검색 시 `geocodeAddress`가 `null`을 반환해도 지도가 안 움직여 직전 bbox 기본 리스트가 그대로 남았다. `MediaSearchPanel`에 `searchNotFound` 상태 추가 — 제출 시 지오코딩 실패면 `true`로 두고 `MediaEmptyResults` 표시(재입력·필터 변경으로는 리셋 안 함, 다음 제출 때만). 지도 마커는 이전 영역 유지(사용자 결정). 커밋 `fc32ae3`. 정리: [qa-fixes #5](reviews/2026-07-22-qa-fixes.md).

## 2026-07-22 — 매체 이미지 저장: 외부 URL 삭제(Phase 2) + S3 전환

Phase 1(media_image 단일소스 통합) 운영 검증 후 **Phase 2 실행**: 운영 DB의 타사(houseofooh/attachments) 외부 URL 전량 삭제(스냅샷 `pre-external-image-delete-20260722`+덤프 `phase2_dump.json` 1.2MB 보관 → 트랜잭션 삭제). media_image 1760행 DELETE, media/media_items thumbnail_url·all_image_urls 913 NULL, 잔여 0. media_id 백필 913/913 확인 후 실행. 이어 **업로드 저장소 S3 전환**: `add_media_image`가 로컬 디스크→S3(`ooh-image-public`, 퍼블릭 read) put_object 후 퍼블릭 URL을 `image_url`에 저장(ContentType 지정), `delete_media_image`는 S3 객체도 정리. EC2 역할 `admix-ec2-role`에 `admix-s3-image-write` 정책 추가, 프런트 next.config remotePatterns+isOptimizable에 S3 호스트 반영. 운영 배포·확인 완료. 정리: [media-image-storage](plans/2026-07-22-media-image-storage.md) · [database-design §2.4](policies/database-design.md).

## 2026-07-22 — recommend_react (ReAct 추천 챗봇) 신설

`ai_agent_re_Act_Pattern` 레퍼런스 기반으로 정식 LangGraph ReAct 그래프(`chatbot ⇄ tools` 순환 + NOT_FOUND `route_after_tools` fallback)를 신규 패키지 `backend/src/services/recommend_react/`(domain/tools/graph/persist)로 구현. **recommend_v2는 무변경 폴백으로 유지**(검증 후 삭제 예정). 슬롯 머신(need_more/confirmation/충돌판정) 제거 — 조건 누적·교체는 LLM이 DB 대화이력 맥락으로 판단(langgraph checkpointer 미사용). 도구 5종(SearchMedia/ExplainMedia/CreateProposal/AddMedia/RenameProposal)이 기존 이벤트 계약(list/proposal/media_detail/chat)을 그대로 방출 → 매체카드/제안서카드 재사용. 비교·최저가·예산플랜은 전용 도구 없이 추론으로 커버(§5.1). 잡 경로에 `version` 분기 추가(`ai_job_service`·`lambda_handler`, v2 로직 무변경), 새 라우터 `/recommend/react/jobs`, Lambda 의존성에 `langgraph` 추가. 프런트 `hooks/adRecommendReact`(useV2Chat 최소 diff 복제, 엔드포인트만 react) + `AiChatPanel` 스위치. 백엔드 86 tests 통과(v2 회귀 없음)·프런트 tsc 통과. **라이브 E2E(OpenAI+DB)는 사용자 환경에서 미검증**. 설계·계획: [spec](superpowers/specs/2026-07-22-recommend-react-design.md) · [plan](superpowers/plans/2026-07-22-recommend-react.md)

## 2026-07-22 — media_image 통합 Phase 1 완료

`media_image`를 매체 이미지 단일 소스로 컷오버. `media_items.media_id` FK 신설+백필(913/913 매칭, Alembic 035). recommend_v2/media_service/proposal_service 이미지 소스를 media_image로 전환, 프론트 매체 이미지 `<img>`→next/image(리스트 소형/상세 대형) + `mediaSrc` 헬퍼로 `/uploads` 절대화. 백엔드 72 tests·프론트 build 통과. 외부(houseofooh) URL 삭제(Phase 2)는 운영 배포·검증 후. 설계·계획: [spec](superpowers/specs/2026-07-22-media-image-unification-design.md) · [plan](superpowers/plans/2026-07-22-media-image-unification.md)

## 2026-07-22 — 매체 검색 빈 결과 화면 (fixed 검색패널 · moving)

- 필터/검색 후 결과 0건일 때 빈 상태 노출. 중앙 정렬 회색 로고(42px, `grayscale`) + 2줄 안내("조건에 맞는 광고 매체를 찾지 못했어요." / "지역이나 검색 조건을 변경해 다시 찾아보세요.", grey-500 text-sm). 공유 컴포넌트 `components/common/MediaEmptyResults.tsx` 신설 → `MediaSearchPanel`(fixed)·`MovingView`(moving) 공용. 로딩 중 깜빡임 방지로 `!isLoading && length===0`에만 표시. Figma 2086:34689 기반(로고는 asset 만료URL이라 기존 `Logo`에 grayscale 필터로 대체). tsc/eslint 통과.
- moving **상세 패널**도 선택 매체 없을 때(결과 0건 등) 빈 상태 노출 — 텍스트 없이 **로고만**(`MediaEmptyResults iconOnly`). Figma 2089:39235 기반.

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
