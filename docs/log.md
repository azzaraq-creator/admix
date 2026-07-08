# 🗓️ 작업 로그 (Log)

> append-only 시간순 기록. 새 자료 ingest / 주요 결정 / 작업 완료를 **최신이 위로** 쌓는다.
> 형식: `## YYYY-MM-DD — 제목` + 한두 줄 요약 + 관련 문서 링크.
> 관리 규칙은 루트 [CLAUDE.md](../CLAUDE.md) 참조.

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
