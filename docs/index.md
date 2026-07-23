# 📚 문서 인덱스 (Wiki Catalog)

> 이 레포의 모든 문서 카탈로그. 새 문서를 추가/삭제하면 **여기부터 갱신**한다.
> 관리 규칙은 루트 [CLAUDE.md](../CLAUDE.md) 참조.

## 개요 / 스키마

| 문서 | 요약 |
|------|------|
| [CONTEXT.md](../CONTEXT.md) | 프로젝트 전체 개요 — 도메인, 아키텍처(백/프런트), 그래프 흐름, DB 스키마, 배포 계획, 사용자 결정 메모 |
| [README.md](../README.md) | 스택 요약 + 로컬 셋업 절차 |
| [log.md](log.md) | 시간순 작업 로그 (ingest/결정/작업 기록) |

## 정책서 (policies/) — "이 화면이 어떤 규칙으로 동작하는가"

| 문서 | 요약 |
|------|------|
| [admin-auth-permissions.md](policies/admin-auth-permissions.md) | 관리자 인증·권한 정책 (마스터 계정 · 메뉴별 권한 · 로그인 토큰 보안) |
| [ai-media-recommend.md](policies/ai-media-recommend.md) | AI 매체추천 탭 정책서 |
| [database-design.md](policies/database-design.md) | ADMIX 옥외광고 추천 플랫폼 데이터베이스 설계서 |
| [fixed.md](policies/fixed.md) | 고정매체 화면 정책서 (UI중심) |
| [home.md](policies/home.md) | 홈 화면 정책서 (UI중심) |
| [login.md](policies/login.md) | 로그인 정책서 |

## API (api/)

| 문서 | 요약 |
|------|------|
| [api-spec.md](api/api-spec.md) | API 정의서 (인증 · FAQ) |

## 프런트 (design/structure)

| 문서 | 요약 |
|------|------|
| [design-tokens.md](design-tokens.md) | cosmos 디자인 토큰 정의 |
| [frontend-structure.md](frontend-structure.md) | 프런트엔드 폴더/파일 구조 |
| [overview.html](overview.html) · [v2-overview.html](v2-overview.html) | 기획 개요 HTML (v1 / v2) |

## 계획 / PRD (plans/) — 날짜순

| 날짜 | 문서 | 요약 |
|------|------|------|
| 2026-05-26 | [postgres-saver](plans/2026-05-26-postgres-saver.md) | PostgresSaver 도입 구현 계획 |
| 2026-05-26 | [checkpoint-pruning-state-trimming](plans/2026-05-26-checkpoint-pruning-state-trimming.md) | 체크포인트 pruning + state 메시지 트리밍 |
| 2026-05-26 | [session-delete-checkpoint-cleanup](plans/2026-05-26-session-delete-checkpoint-cleanup.md) | 세션 삭제 시 체크포인트 정리 |
| 2026-05-26 | [slot-change-semantics-plan](plans/2026-05-26-slot-change-semantics-plan.md) | 슬롯 변경 시맨틱 (초안) |
| 2026-05-27 | [recommend-v2-plan](plans/2026-05-27-recommend-v2-plan.md) | Recommend V2 — 새 추천 파이프라인 |
| 2026-05-27 | [slot-change-semantics-plan (final)](plans/2026-05-27-slot-change-semantics-plan.md) | 슬롯 변경 시맨틱 최종안 |
| 2026-05-28 | [2026-05-28](plans/2026-05-28.md) | 기획내용 추가 |
| 2026-06-01 | [v2-chat-messages-catalog](plans/2026-06-01-v2-chat-messages-catalog.md) | V2 챗봇 문구 카탈로그 (초안) |
| 2026-06-01 | [v2-chat-messages-for-pm](plans/2026-06-01-v2-chat-messages-for-pm.md) | V2 챗봇 문구 일람 (기획 전달용) |
| 2026-06-02 | [ppt-upload-and-rendering](plans/2026-06-02-ppt-upload-and-rendering.md) | PPT 업로드 + 자동 변환 미리보기 |
| 2026-06-16 | [fastapi-auth-login](plans/2026-06-16-fastapi-auth-login.md) | FastAPI 인증/로그인 구현 정리 |
| 2026-06-22 | [v2-chatbot-port](plans/2026-06-22-v2-chatbot-port.md) | V2 챗봇 현재 구조로 포팅 + 기능 확장 |
| 2026-06-23 | [chat-media-detail-behavior](plans/2026-06-23-chat-media-detail-behavior.md) | 챗 매체 상세 질문 동작 변경 (media_detail) |
| 2026-06-30 | [media-search-map-prd](plans/2026-06-30-media-search-map-prd.md) | 매체검색 지도 영역 검색 + 서버 줌 클러스터링 (PRD) |
| 2026-07-04 | [social-login-deploy-ops](plans/2026-07-04-social-login-deploy-ops.md) | 카카오/네이버 소셜로그인 · 배포/env 운영 · create_all→alembic · Geoapify 지도 · IME 버그 |
| 2026-07-07 | [sqs-lambda-async-ai-recommend](plans/2026-07-07-sqs-lambda-async-ai-recommend.md) | AI 추천 LLM 호출을 SQS+Lambda 비동기로 전환 (동시성 제한·SSE불가→가짜스트리밍) |
| 2026-07-07 | [ga4-analytics-integration](plans/2026-07-07-ga4-analytics-integration.md) | GA4 홈 진입 수 연동 (계획→구현·런타임 연결 완료 · gtag/Data API/대시보드 · 코어 리포트 지연 24~48h 설명) |
| 2026-07-08 | [password-reset-email-smtp](plans/2026-07-08-password-reset-email-smtp.md) | 비밀번호 재설정 이메일(Gmail SMTP) + 요청/재설정 페이지 + 컷오버 완료 |
| 2026-07-09 | [sns-email-verification-login-id](plans/2026-07-09-sns-email-verification-login-id.md) | SNS 로그인 이메일 인증(/signup/sns)·가입완료 화면·계정선택 + 아이디(login_id)/연락받을 이메일 분리(마이그 029~031) + 프로필/admin 반영 |
| 2026-07-10 | [intent-classifier-tool-calling](plans/2026-07-10-intent-classifier-tool-calling.md) | 챗봇 앞단 의도 분류기(RECOMMEND/EXPLAIN/PROPOSAL/GENERAL) + bind_tools 라우터 재설계 (스펙) |
| 2026-07-10 | [intent-classifier-tool-calling-plan](plans/2026-07-10-intent-classifier-tool-calling-plan.md) | 위 스펙의 TDD 구현 계획 (tools/classifier/welcome 모듈 + _event_stream 배선, 8 태스크) |
| 2026-07-13 | [chat-usage-tier-limit](plans/2026-07-13-chat-usage-tier-limit.md) | 챗봇 대화 횟수 티어별 제한 (비회원 10 / 일반회원 30 / 사업자 무제한, session_id 티어 판별, limit_reached 이벤트) |
| 2026-07-14 | [guest-proposal-session-claim](plans/2026-07-14-guest-proposal-session-claim.md) | 게스트 제안서가 휘발성 챗 세션에 묶여 소실되는 버그 — 세션 안정화(핫픽스+담기 세션 보장) + 회원가입(로그인 제외) 시 회원 승계 API |
| 2026-07-14 | [proposal-inquiry-email-notify](plans/2026-07-14-proposal-inquiry-email-notify.md) | 맞춤제안 전송·문의 답변 시 회원 연락 이메일 알림(Figma 다크 템플릿) + 메일 CTA 딥링크 로그인 처리(문의내역 모달 / 제안서 상세 3-상태) |
| 2026-07-14 | [auth-email-html-branding](plans/2026-07-14-auth-email-html-branding.md) | 이메일 인증코드·비밀번호 재설정 메일을 Figma 다크 브랜디드 HTML로 교체(로고·CTA 버튼) + 인증코드 TTL 10분(600), 재설정 TTL 1시간 유지(보안) |
| 2026-07-22 | [proposal-name-duplicate-check](plans/2026-07-22-proposal-name-duplicate-check.md) | 제안서 이름 중복검사(생성·이름변경) — 소유자별·삭제제외·대소문자무시, 라우터 409 `duplicate_name`, 챗봇/승계 미적용. 한도경고·Figma는 보류 |
| 2026-07-22 | [media-image-storage](plans/2026-07-22-media-image-storage.md) | 매체 이미지 저장 아키텍처 — `media_image` 단일소스 통합(media_id FK 035) + 타사 외부 URL 전량 삭제(Phase 2) + 업로드 S3 전환(`ooh-image-public`). 운영 배포 완료 |

## 리뷰 (reviews/) — 코드리뷰·감사 기록

| 날짜 | 문서 | 요약 |
|------|------|------|
| 2026-07-06 | [backend-db-code-review](reviews/2026-07-06-backend-db-code-review.md) | 백엔드/DB 전면 코드리뷰 — CRITICAL 6건(admin·FAQ 인증부재, 재설정토큰 노출, OAuth state 부재, ad_sessions 마이그레이션 누락, 추천엔진 스레드 세션공유) 외 심각도별 정리 + 백엔드 인가 개념 |
| 2026-07-22 | [qa-fixes](reviews/2026-07-22-qa-fixes.md) | QA 지적사항 픽스 누적 로그 — #1 LNB 로그인 버튼 gap 6→8px, #2 프로필 버튼 hover primary→platinum 통일, #3 사이드바 버튼 공통화(SidebarNavRow/SIDEBAR_ROW_BASE), #4 fixed 지도 패널 접기 시 relayout 누락, #5 fixed 검색 지오코딩 실패 시 결과없음 표시, #6 로그아웃 후 이전 사용자 세션·제안서 잔존(useLogout 훅+clearSessionId) |

## 스킬 (skills/)

| 문서 | 요약 |
|------|------|
| [prd-policy-writer/SKILL.md](skills/prd-policy-writer/SKILL.md) | 화면 단위 정책서/PRD 작성 스킬 |
