# SQS + Lambda 비동기 AI 추천 아키텍처 전환 (2026-07-07)

AWS 계정 이전을 계기로, **AI 매체추천의 LLM 호출을 EC2 동기 처리에서 SQS + Lambda 비동기 처리로 분리**하는 전환 계획. **모든 인프라는 기존 EC2가 올라가 있는 계정이 아니라 신규 AWS 계정에서 그린필드로 구축**한다(§6). 배포/EC2/Amplify 운영 배경은 [소셜로그인·배포/운영](2026-07-04-social-login-deploy-ops.md)·[deploy/README](../../deploy/README.md), 추천 파이프라인 배경은 [recommend-v2](2026-05-27-recommend-v2-plan.md), 전체 개요는 [CONTEXT.md](../../CONTEXT.md) 참조.

> ⚠️ 이 문서는 **설계 계획**이다. 아직 코드/인프라 미구현. 구현 시작하면 각 단계 체크.

---

## 1. 배경 / 목표

- 현재 AI 추천은 EC2 위 FastAPI가 **요청 안에서 직접 OpenAI를 호출**하는 동기 방식. LLM 응답 시간만큼 EC2 워커/커넥션이 붙잡히고, 동시 요청이 몰리면 OpenAI 분당 호출 한도(RPM/TPM)에 그대로 노출된다.
- 목표: **LLM 호출 구간만 떼어내 SQS + Lambda 비동기 레이어로 이동**. EC2는 지도/기본 CRUD/공간쿼리 같은 빠른 동기 요청만 담당하고, 느리고 rate-limit에 민감한 LLM 작업은 큐 뒤로 밀어 **동시성으로 분당 콜 수를 조절**한다.

---

## 2. 현재(동기) 구조 — 코드 기준

진입점: `POST /recommend/v2/stream` → `StreamingResponse`(SSE) — [recommend_v2 라우터](../../backend/src/routers/recommend_v2.py) `:103`, 서비스 `recommend_v2_stream` [recommend_v2 서비스](../../backend/src/services/recommend_v2.py) `:1437`. 비스트림 단발 버전은 `recommend_v2()` `:402`.

**LLM 호출 지점** (전부 `get_chat()` = ChatOpenAI, 모델 `gpt-4o-mini`, 동기 `.invoke()` — [graph/llm.py](../../backend/src/services/graph/llm.py)):

| 함수 | 위치 | 역할 (다이어그램 "5. 정성적 요구사항 분석") |
|------|------|------|
| `extract_keywords` | `recommend_v2.py:216` | 사용자 문장 → 키워드 코드 구조화 추출 (핵심) |
| `_resolve_media_question` | `:703` | 매체 상세 질문 의도 판별 |
| `_explain_with_llm` | `:728` (temp 0.3) | 개별 매체 추천 사유 설명 생성 |
| `_resolve_proposal_intent` | `:816` | 제안서 생성 의도 판별 |

**DB 파라미터 매칭 지점** (LLM 아님, 순수 SQL — 다이어그램 "6. 파라미터 매칭 쿼리"):
- `filter_media_items(db, codes)` `:233` — 추출된 코드로 `MediaItem` 필터.
- 부가 조회: `load_keyword_catalog` `:107`, `load_keyword_descriptions` `:116`, `_media_meta_by_thumbnail` `:305`, `sort_by_price_desc` `:291`.

**핵심**: `extract_keywords`(LLM) → `filter_media_items`(DB) → 정렬/enrich → 응답. LLM과 DB 매칭이 함수 단위로 이미 분리돼 있어 **LLM 구간을 Lambda로 떼기 쉬운 구조**.

**상태 저장**: 멀티턴 필터 컨텍스트는 `AdSession.filter_context`(JSON)에 저장 — `_save_filter_context` `recommend_v2.py:61`. 별도 새 DB 세션으로 커밋(thread-safe). LangGraph 체크포인트(PostgresSaver)는 chat_graph 세션 CRUD와만 엮임.

**설정** ([config.py](../../backend/src/config.py)): `openai_api_key`, `llm_model=gpt-4o-mini`, `database_url`. **현재 redis/aws/sqs 관련 설정 없음** → 신규 추가 필요.

---

## 3. 목표 아키텍처

```
사용자/브라우저
  │ 1. 웹 접속·SSR                    2. 지도데이터·API요청
  ▼                                   ▼
AWS Amplify (Next.js)          EC2 / FastAPI (Public Subnet)
                                   │            │ 기본 CRUD·공간쿼리
                                   │ 3. AI 추천 요청 push     │
                                   ▼                          │
                          AWS SQS (AI Job Queue)              │
                                   │ 4. 이벤트 폴링/트리거     │
                                   ▼                          │
                          AWS Lambda (AI Agent Tool)          │
                                   │ 5. 정성 분석  │ 6. 파라미터 매칭 쿼리
                                   ▼              ▼           ▼
                          OpenAI/Gemini      RDS PostgreSQL/PostGIS (Private Subnet)
```

**책임 분리**
- **EC2 FastAPI**: 세션 CRUD, 매체 목록/상세, 지도(공간쿼리), 제안서 등 빠른 동기 요청은 그대로 RDS 직접. AI 추천만 SQS에 enqueue하고 job id 반환.
- **SQS**: AI Job Queue. EC2가 job(메시지: session_id, user_text, top_k, filter_context 등)을 push.
- **Lambda**: SQS 이벤트 소스 매핑으로 트리거. 현재 `extract_keywords`~`filter_media_items`~응답 조립 로직을 이식 → OpenAI 호출 + RDS 파라미터 매칭 → 결과를 RDS에 저장.
- **RDS(Private)**: EC2·Lambda 양쪽에서 접근. Lambda는 VPC 내(Private Subnet 접근 가능한 서브넷)에 배치 필요.

---

## 4. 핵심 결정 (논의 확정분)

### 4-1. 동시성 제한으로 분당 콜 수 조절 (Redis rate limiter 대신)
- OpenAI 분당 호출 한도를 동시성으로 근사 제어. **실제 구현(2026-07-08)**: Free Plan 계정 총 동시성 한도가 **10**이라 Lambda *reserved* concurrency는 설정 불가(unreserved 최소 10 위반) → **SQS 이벤트 소스 매핑의 `ScalingConfig.MaximumConcurrency=5`**로 대체(동시 처리 5개 상한). 목적(분당 콜 제어) 동일 달성, 계정 한도 문제 없음.
- **Redis 기반 정밀 rate limiter는 보류**. 필요성은 인지했으나(토큰 버킷 등), 초기엔 동시성 제한만으로 비슷하게 맞춰보고, 한도 초과(429)가 잦으면 그때 도입 재검토.
- SQS가 버퍼 역할 → 순간 폭주해도 Lambda 동시성 상한에서 자연 큐잉. 처리 실패분은 재시도 + DLQ.

### 4-2. SSE 스트리밍 불가 → 프론트 "가짜 스트리밍" 로딩 텍스트
- 요청이 비동기(즉시 job id 반환)로 바뀌므로 **현재의 SSE `StreamingResponse`(recommend_v2.py:103) 방식은 그대로 못 씀** — 확인 완료. (Lambda가 브라우저로 직접 토큰 스트림을 밀 수 없음.)
- 대체: 최종 응답이 올 때까지 **프론트에서 스트리밍처럼 보이는 로딩 텍스트**를 순차 노출(예: "요구사항 분석 중… → 매체 매칭 중… → 결과 정리 중…"). 실제 토큰 스트림이 아니라 UX용 연출.
- 결과 전달 방식은 **폴링으로 확정**(§5 참조): Lambda가 결과를 RDS에 저장하고 프론트가 job_id로 조회해 표기. WebSocket/푸시는 SSE와 같은 이유로 범위 제외.

---

## 5. 요청 → 응답 흐름 (확정 — 폴링)

1. 프론트 → `POST /recommend/v2` (또는 `/v2/async`): EC2가 job 메시지를 SQS에 push, **`job_id` 즉시 반환**(202 Accepted). 프론트는 가짜 스트리밍 로딩 시작.
2. SQS → Lambda 트리거. Lambda가 OpenAI 호출 + RDS 파라미터 매칭 → 결과(items/message/extracted)를 **RDS 결과 테이블에 job_id로 저장**(status: pending→done/failed).
3. 프론트 → `GET /recommend/v2/jobs/{job_id}` 폴링(예: 1~2초 간격). EC2는 RDS 결과 테이블 조회만.
4. status=done이면 결과 렌더 + 로딩 텍스트 종료. failed면 에러 메시지.

> 결과 저장소는 신규 테이블(예: `ai_recommend_jobs`: job_id, session_id, status, request_json, result_json, error, created_at, updated_at) 안. 멀티턴 `filter_context` 갱신은 Lambda가 §2의 `_save_filter_context`와 동일 규칙으로 `AdSession`에 기록.

---

## 6. 컴포넌트별 변경 작업

### 백엔드 (EC2 / FastAPI) — ✅ 완료 (2026-07-07, 검증됨)
- [x] `config.py`에 `aws_region`, `sqs_queue_url` 추가 (자격증명은 EC2 instance role). `.env`에 `AWS_REGION`·`SQS_QUEUE_URL` 세팅. IMDS hop limit 2로 컨테이너가 역할 사용.
- [x] `ai_recommend_job.py` 모델(status/request/result/error, session FK SET NULL) + alembic **028** + `models/__init__` 등록. requirements에 `boto3` 추가.
- [x] enqueue 서비스 `ai_job_service.py`(SQS FIFO `send_message`, `MessageGroupId=session_id`, dedup=job_id) + `POST /recommend/v2/jobs`(202+job_id) + `GET /recommend/v2/jobs/{job_id}`(폴링).
- [x] 검증: POST→202 pending, GET→폴링, SQS 메시지 1건 enqueue 확인.
- [ ] 기존 SSE 엔드포인트(`/v2/stream`·`/v2/slot/remove`)는 **한시 유지**(프론트 전환 완료 후 제거) — ④에서 정리.

### Lambda (AI Agent Tool) — ✅ 완료 (2026-07-08, E2E 검증)
- [x] 로직 이식: **중복 없이** `_event_stream`(전체 대화 로직)을 구동해 이벤트 수집하는 `collect_recommend_events()`(recommend_v2.py) 추가. Lambda 핸들러 `backend/lambda_handler.py`가 SQS record → `ai_recommend_jobs` 갱신.
- [x] `ai_job_service`에 Lambda용 헬퍼(load/save filter_context, mark_processing, finish_job).
- [x] 컨테이너 이미지: `backend/Dockerfile.lambda`(public.ecr.aws/lambda/python:3.12, `backend/src` 공유, 슬림 `requirements-lambda.txt`) → ECR `admix-ai-agent`. ⚠️ Lambda는 OCI attestation 매니페스트 거부 → `buildx --provenance=false`로 단일 매니페스트 빌드.
- [x] Lambda 함수 `admix-ai-agent`(비-VPC, 이미지, 1024MB/300s, role `admix-lambda-role`) + SQS 이벤트 소스 매핑(batch 1).
- [x] **VPC 없이 오픈 연결**(사용자 결정): Lambda는 VPC 밖 → OpenAI 직결, **RDS `publicly-accessible=on` + `admix-db-sg` 5432←0.0.0.0/0**. ⚠️ **DB 인터넷 노출(비번만 방어) — 운영 전 조이기 필수**(VPC+NAT 또는 EC2 워커 전환).
- [x] E2E: enqueue→SQS FIFO→Lambda→OpenAI(키워드 추출)+RDS(매칭)→`ai_recommend_jobs` done→폴링 확인.

### 인프라 (신규 AWS 계정 — 그린필드)
> 기존 EC2가 올라가 있는 계정에서 이어서 만드는 게 아니라 **신규 계정에서 EC2·RDS·SQS·Lambda·Amplify를 새로 구축**한다. 구 계정 리소스는 컷오버 전까지 유지 후 폐기.
>
> **구축/운영 방식 (확정)**: 1회성 인프라 구축은 **명령형(단계별 `aws` CLI/MCP 실행)**으로 진행하고, **반복되는 백엔드 재배포만 스크립트**(`deploy/redeploy.sh` 스타일)로 고정한다. IaC(CloudFormation/CDK)는 도입하지 않음. 신규 계정: `787418837344` (IAM user `ssm`, 로컬 CLI 프로필 `ooh-new`). 실행은 `aws --profile ooh-new ...`(Bash) — 세션의 aws-mcp는 다른 계정 `896860228345`에 묶여 있어 사용 안 함.
>
> **확정 결정 (2026-07-07)**:
> - **리전**: `ap-northeast-2`(서울). 새 계정은 기본 VPC(`vpc-02bba42cde6f406f6`, 172.31.0.0/16)만 존재, 나머지 리소스 0개.
> - **VPC 토폴로지**: 커스텀 VPC/NAT 안 씀. **기본 VPC 재사용 + 보안그룹(SG)으로 격리**. RDS는 `publicly-accessible=off` + SG로 EC2/Lambda만 허용(진짜 Private Subnet은 아니지만 SG로 사실상 격리, NAT 비용 회피).
> - **진행 순서**: ①**베이스 인프라 이전 먼저**(네트워크→RDS→EC2→Amplify→컷오버 = 현행 서비스를 새 계정에 복구) → ②**async 전환**(백엔드 enqueue/폴링/`ai_recommend_jobs`/Lambda + SQS+Lambda).
> - **리소스 네이밍**: `admix-*` 접두어 (예: SQS `admix-ai-jobs`(+`admix-ai-jobs-dlq`), Lambda `admix-ai-agent`, EC2 Name `admix-backend`, RDS `admix-db`, SG `admix-backend-sg`/`admix-db-sg`/`admix-lambda-sg`). 레포명(`ooh-recommend`)·로컬 프로필(`ooh-new`)은 변경 안 함.
- [x] 네트워크: 기본 VPC(`vpc-02bba42cde6f406f6`) 재사용 + SG 3종 생성 (2026-07-07).
  - `admix-backend-sg` = `sg-0c387c44150231158` — 22/80/443 ← 0.0.0.0/0
  - `admix-lambda-sg` = `sg-0cc540b29d4880012` — egress only
  - `admix-db-sg` = `sg-079eb4042383b661b` — 5432 ← backend-sg + lambda-sg only
- [x] RDS 생성 완료 (2026-07-07): `admix-db`, PostgreSQL 16.14, db.t4g.micro, gp2 20GB, db명 `admix_recommend`, master `postgres`, SG `admix-db-sg`, 서브넷그룹 `admix-db-subnet-group`, 미공개.
  - endpoint: `admix-db.cjuy04k4msd0.ap-northeast-2.rds.amazonaws.com:5432`
  - master 비번: Secrets Manager `rds!db-9bda2030-2673-4ca9-87f8-5adac3774db8`
  - ⚠️ **AWS Free Plan** → 백업 보존 `0`(자동백업 없음)·gp2 강제. **(B) 무료로 셋업, 운영 전 유료 업그레이드 + 백업 활성화** 조건.
  - [x] RDS 초기화 (2026-07-07): EC2에서 인스턴스 역할로 secret 취득→`postgres:16` 컨테이너 psql로 확장 생성. **postgis 3.4.6 + vector 0.8.2** 확인. 네트워크 경로 EC2→RDS 정상.
  - [x] 데이터 이관 완료 (2026-07-07): alembic-only는 **ad_sessions 마이그 누락**(create_all 의존)으로 스키마 생성 불가 → **구 prod `pg_dump --schema-only`로 전체 스키마 복제** + `alembic_version`(head `026_counter_file_slides_url`) + 콘텐츠 테이블 data-only 적재. **회원(users)·chat(ad_sessions/messages/checkpoints)·proposal 계열 제외**. 적재 검증: media 913, media_image 1760, media_plan 1256, ad_media 922, sangwon_population 46184, faq 7, admin 1 등 구 prod과 일치, users=0. (RDS는 `--disable-triggers` 불가 → 트리거 토글 에러는 무해, COPY는 FK순서로 정상.)
- [x] EC2 인스턴스 기동 (2026-07-07): `admix-backend` = `i-089cdaf39afd9a31b`, t3.micro, Ubuntu 22.04(`ami-000f737cfeba0c202`), EBS gp3 30GB, SG `admix-backend-sg`, key `admix-key`(`~/.ssh/admix-key.pem`), swap 2GB. **Elastic IP `43.201.172.34`**(alloc `eipalloc-0f7e7dcb49b2b567e`).
  - [x] EC2 셋업 완료: docker/nginx/certbot/ufw. IAM instance role `admix-ec2-role`(+profile `admix-ec2-profile`, Secrets Manager RDS secret 읽기) 연결.
  - [x] backend 기동 완료 (2026-07-07): 구 EC2 `.env` 앱 시크릿 복사 재사용 + `POSTGRES_PASSWORD`만 RDS 비번으로 교체. **override 파일 `docker-compose.newacct.yml`**(`depends_on: !reset []`로 postgres 컨테이너 미기동 + `DATABASE_URL`을 RDS로). `docker compose --env-file backend/.env -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.newacct.yml up -d --build backend`. `/health` 200, `/chat/graph/sessions` 200 `[]`(RDS 쿼리 확인).
    - ⚠️ `.env`에 `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` 없음 → config 기본값(`change-me`) 사용 중(구 prod도 동일). **운영 전 강한 값 설정 필수.**
  - [x] nginx 리버스프록시 + HTTPS (2026-07-07): `43-201-172-34.sslip.io`, certbot 인증서 발급·자동갱신, `http→https` redirect. 외부에서 `https://43-201-172-34.sslip.io/health` 200·cert valid 확인.
  - [ ] SQS send 권한 추가는 2단계(async).
- [x] **2단계 인프라 생성 (2026-07-07)**:
  - SQS FIFO `admix-ai-jobs.fifo` (URL `.../787418837344/admix-ai-jobs.fifo`, visibility 900s, redrive→DLQ maxReceive 3) + DLQ `admix-ai-jobs-dlq.fifo`
  - Lambda 실행역할 `admix-lambda-role` (Basic/VPC 실행 + SQS consume + Secrets RDS read)
  - ECR `787418837344.dkr.ecr.ap-northeast-2.amazonaws.com/admix-ai-agent`
  - EC2 역할 `admix-ec2-role` += SQS `SendMessage`(admix-sqs-send)
  - [x] Lambda `admix-ai-agent`(비-VPC) + 이벤트소스매핑(MaximumConcurrency=5) 생성. (VPC/NAT 안 씀 — RDS 퍼블릭 오픈으로 대체)
- [~] Amplify: **당분간 기존 앱(`main.d5zpc903rfz5q.amplifyapp.com`, 구 계정) 유지**하고 새 백엔드에 연결. Amplify 자체 이전(+GitHub 연동/repo 이전)은 나중에.
- [ ] `deploy/README.md`의 구 계정 리소스(EC2 IP `13.125.7.82`, Amplify `d5zpc903rfz5q`) 신규 계정 값으로 갱신.
- [x] 컷오버 완료 (2026-07-08): 구 Amplify `NEXT_PUBLIC_API_URL` → `https://43-201-172-34.sslip.io`(새 백엔드). CORS(`FRONTEND_URL`)에 Amplify+localhost 포함, 프리플라이트 200 확인. 배포 프론트→새 백엔드 E2E 정상. **모든 API가 새 백엔드/새 RDS 기준**(구 회원 데이터 미이관). 상세 [password-reset-email-smtp](2026-07-08-password-reset-email-smtp.md) §4.

### 프론트 (Amplify / Next.js)
- [x] AI 추천 호출 enqueue→폴링 전환 (2026-07-08): `hooks/adRecommendV2/useV2Chat.ts` `submit`이 `POST /recommend/v2/jobs`→`GET .../jobs/{id}` 폴링(1.2s, ~60s). `applyEventData`로 SSE/폴링 렌더 로직 공유. `removeSlot`은 SSE 유지(LLM 없음, EC2 동기).
- [x] 가짜 스트리밍 로딩 텍스트 (2026-07-08): 폴링 중 `loadingLabel` 순환, `chat/AssistantBubble.tsx`가 `isLoading` 시 표시. tsc 통과.
- [ ] 반영은 Amplify 재배포 필요 — 기존 Amplify가 새 백엔드(`NEXT_PUBLIC_API_URL`)를 봐야 동작(컷오버).

---

## 6-A. 2단계(async) 착수 설계 — 확정 (2026-07-07)

- **Job 단위**: **챗 메시지 1건 = job 1개**(GPT 호출 사이클 1회). 현재 "메시지 1건 → 응답 1개" 표시 방식 유지. 기존 `recommend_v2_stream` 처리 로직을 **그대로 재사용**하되, SSE 스트림 대신 최종 결과를 모아 `ai_recommend_jobs.result_json`에 저장.
- **EC2 동기 유지**: GPT 불필요한 빠른 작업(세션 CRUD·매체 목록/상세·지도)과 **제안서 생성/PPT export(libreoffice)**는 EC2 동기 그대로. Lambda는 LLM 분석+추천 경로만.
- **Lambda 패키징**: 같은 repo `backend/src`로 **컨테이너 이미지 빌드(ECR)** — 로직 공유(드리프트 없음), deps 슬림(libreoffice 제외).
- **큐**: **SQS FIFO** + `MessageGroupId=session_id` → 세션별 순서 보장(멀티턴 경쟁 해결), 세션 간 병렬 유지.
- (착수하며 확정) `result_json` 스키마 = 현 SSE 최종 이벤트(list/need_more/chat/explain 등) 합집합 / RDS Proxy 초기 생략 / 폴링 1~2s·job TTL.

## 7. 미결정 / 리스크

- **LLM 코드 공유 전략**: EC2와 Lambda가 `recommend_v2.py` 로직을 공유할지(공통 패키지) 복제할지. 복제는 드리프트 위험, 공유는 배포 복잡도.
- **콜드 스타트 + RDS 커넥션**: Lambda 다수 동시 실행 시 RDS 커넥션 폭증 → RDS Proxy 필요 여부.
- **폴링 비용/지연**: 폴링 간격 vs 응답 체감. 길면 답답, 짧으면 요청 증가.
- **Gemini 병행**: 다이어그램은 OpenAI/Gemini 병기 — 실제 멀티 프로바이더 라우팅은 별도 결정(현재 코드는 OpenAI 전용).
- **멀티턴 정합성**: 비동기 처리 중 사용자가 연속 입력 시 job 순서/컨텍스트 경합 처리.
- **동시성 제한의 정밀도 한계**: TPM(토큰 기준) 초과는 동시성만으론 못 막음 → 4-1 보류한 Redis rate limiter 재등판 트리거.

---

## 8. 관련 문서
- [소셜로그인·배포/운영](2026-07-04-social-login-deploy-ops.md) — EC2/Amplify/env 운영, alembic 전용 스키마
- [deploy/README](../../deploy/README.md) — EC2+Amplify 배포 절차 (구 계정 값 → 갱신 대상)
- [recommend-v2](2026-05-27-recommend-v2-plan.md) — 추천 파이프라인 원안
- [CONTEXT.md](../../CONTEXT.md) — 전체 아키텍처/스택
