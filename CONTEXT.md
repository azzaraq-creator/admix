# OOH 광고 매체 추천 — 작업 컨텍스트

> 새 claude 세션이 컨텍스트 빠르게 파악할 수 있도록 정리한 문서.
> 자세한 prototype 단계 (노트북) 는 todolist 레포에 그대로 두고 참조용으로만 씀.

## 프로젝트 개요

- **도메인**: 광고주 자연어 발화 → OOH(옥외광고) 매체 추천 챗봇
- **목적**: 광고 슬롯 (지역/예산/매체/제품/타겟/목적) 수집 → DB 필터 → 상권 인구분포 기반 정렬 → 자연어 설명 + pivot
- **데이터 소스**:
  - House of OOH 전체매체 922건 (광고 매체 카탈로그)
  - 서울시 상권분석서비스 1650 상권 + 분기별 인구분포
- **현재 단계**: 모듈화 + 세션 영속화 + 프런트 통합 완료. **EC2 + Vercel 배포 준비 중**.

## 참고 — todolist 레포 (이 레포의 prototype/공부 원본)

- 경로: `/Users/lala/Documents/GitHub/todolist`
- 노트북 (학습/디버깅 reference, 새 레포로 옮기지 않음):
  - `backend/notebooks/03_ad_media_etl.ipynb` — Excel 922건 → ad_media 테이블 + description 임베딩
  - `backend/notebooks/04_recommend_graph.ipynb` — v1 그래프 (가독성용 보존)
  - `backend/notebooks/05_recommend_graph_v2.ipynb` — v2 그래프 prototype (현재 모듈화의 원본)
- todolist 의 변경은 phase 1 (모듈화) 까지. 이후 모든 개선은 ooh-recommend 에 적용.

## 아키텍처 (ooh-recommend)

### 백엔드 (`backend/`)

- **스택**: FastAPI + LangGraph + PostgreSQL/pgvector + OpenAI
- **DB**: pgvector pg16 (todolist 에서 `pg_dump` 로 `ad_media` / `sangwon_area` / `sangwon_population` 3개 테이블만 옮김)

```
backend/src/
├── main.py                          FastAPI app + CORS + lifespan
├── config.py                        Settings (DATABASE_URL, OPENAI_API_KEY 등)
├── database.py                      SQLAlchemy engine + Base
├── models/ad_session.py             AdSession + AdMessage (payload JSONB)
├── schemas/ad_session.py            Pydantic in/out
├── services/
│   ├── ad_session_service.py        세션 CRUD + add_message (title 자동)
│   └── graph/                       LangGraph 패키지
│       ├── state.py                 RecommendState, Slots, TargetStruct, CompatViolation
│       ├── settings.py              SLOT_WEIGHTS, FINAL_COLS, INITIAL_LIST_LIMIT 등 상수
│       ├── db.py                    psycopg2 raw connection
│       ├── llm.py                   ChatOpenAI / OpenAI lazy factory
│       ├── catalogs.py              MEDIA_TYPE_CATALOG (DB lazy load) + prompt 포맷
│       ├── sql.py                   region/budget/media_type WHERE 빌더 + 통계 헬퍼
│       ├── routing.py               조건부 엣지 라우팅 (단계 분기)
│       ├── builder.py               build_graph()
│       └── nodes/
│           ├── extract_slots.py     ① LLM 슬롯 추출 (한국 단위 변환 표 강화)
│           ├── completeness.py      ② 점수 + clarification
│           ├── compatibility.py     ③④ 호환성 검사 + deterministic 안내 (한국 단위 + fallback)
│           ├── db_filter.py         ⑤ 최종 SELECT (FINAL_COLS, lat/lng 포함)
│           ├── present_initial.py   ⑥-A Stage 1 — 가격순 Top-20 + 인터뷰
│           ├── rerank_vector.py     ⑥-B Method A — description 임베딩 cosine
│           ├── rerank_sangwon.py    ⑥-C2 Method C2 — 상권 인구분포 × LLM weight (기본)
│           └── explain.py           ⑦ Stage 2 — 자연어 summary + Top-3 reason + pivot
└── routers/chat_graph.py            세션 CRUD + SSE stream
```

### 그래프 흐름

```
START
  ↓ extract_slots                      LLM 슬롯 6축 추출 (region/budget/target/product/goal/media_type)
  ↓ score_completeness                 가중점수 (region/budget=2, 기타=1, 합≥3 PASS)
  ↓ [conditional]
    ├ <3 → clarification_one_slot      한 슬롯만 우선순위로 질문
    └ ≥3 → check_compatibility_db      3 페어 SQL 매칭 (region×budget, budget×type, region×type)
              ↓ [conditional]
              ├ 충돌 → compatibility_llm_message    실측 통계 + 대안 지역 안내 (deterministic)
              └ 통과 → db_filter_final               매체 풀 SELECT (≤500)
                        ↓ [conditional — route_after_db_filter]
                        ├ AI 메시지 없음(첫턴) → present_initial_list   가격순 Top-20 + 인터뷰
                        └ AI 메시지 있음(답변후) → rerank → explain     Method C2 + 자연어 reason
                                                       ↓ END
```

**Stage 분기**: 첫 턴엔 Stage 1 (가격순 + 인터뷰), 답변 받은 후엔 Stage 2 (rerank + explain) 무조건. 슬롯 부족해도 다시 질문 안 함.

### 세션 + SSE

- `AdSession`: `id`, `title`, `thread_id`(langgraph), `created_at`, `updated_at`
- `AdMessage`: `role`, `content`, `payload`(JSONB — slots/matched_media/summary/top_picks/pivots), `created_at`
- POST `/chat/graph/sessions/{id}/stream` — user 저장 → 그래프 → SSE events → assistant 저장

### SSE 이벤트

```
event: thread   {thread_id, session_id}
event: node     {name, update}   ← 노드 1개 끝날 때마다
event: done     {}
event: error    {message}
```

페이로드 slim 룰: `db_filter_final` 의 `matched_media` 는 SSE 에서 제외 (93건 크기 회피), `*_size` 키로 카운트만.

### 프런트 (`frontend/`)

- **스택**: Next 16 + React 19 + Tailwind 4 + shadcn/ui + react-query + axios
- **디자인**: cosmos (다크 우주 테마, `app/globals.css` 토큰)
- **인증 없음** (prototype 단계, 단일 사용자 가정)

```
frontend/
├── app/
│   ├── layout.tsx                 RootLayout + Providers (react-query + Toaster)
│   ├── page.tsx                   "/" → /ad-recommend redirect
│   └── (main)/
│       ├── layout.tsx             cosmos sidebar + CosmosBackground
│       └── ad-recommend/
│           ├── page.tsx           ?id={uuid} 으로 세션 진입
│           └── _components/
│               └── AdRecommendPanel.tsx
├── components/
│   ├── cosmos/{Sidebar,CosmosBackground}.tsx
│   └── ui/{button,input,sonner}.tsx
├── hooks/
│   ├── adRecommend/sse.ts         fetch + ReadableStream SSE 파서 + NODE_LABELS
│   └── adSessions/{apis,keys,queries,mutations,index}.ts   세션 CRUD react-query 훅
└── lib/{api,utils}.ts
```

UI 동작:
- 사용자 버블 (오른쪽) + assistant 버블 (왼쪽 카드)
- 진행 중: 스피너 + "슬롯 추출 중..." 같은 활성 step + 완료 step ✓ 표시
- 결과: slots chips → 매체 list (썸네일 + #id-매체명 + 위치/카테고리 + reason) → 자연어 안내 → summary/top_picks → pivots 칩
- pivot 클릭 → 자연어 슬롯 변경 입력창에 채워줌
- 사이드바 좌측 list — adSessions (최근순), "+ 새 대화"

## DB 스키마 (요약)

- `ad_media` (922): media_id PK, city/district/latitude/longitude/media_name/product_display_name, ad_price, parent_category/category, thumbnail/detail_url, demo_age_*_pct/demo_*_pct (0~100 스케일), embedding vector(1536), sangwon_code, sangwon_distance_m
- `sangwon_area` (1650): sangwon_code PK, sangwon_name, latitude/longitude (WGS84)
- `sangwon_population` (46184): (quarter_code, sangwon_code) PK, total_foot_traffic, age_10/20/30/40/50/60_foot, male/female_foot, hour_*_foot, mon/tue/.../sun_foot
- `ad_sessions` / `ad_messages` (Phase B 신규)

최신 분기: `SANGWON_QUARTER = '20254'` (2025 Q4)

## 환경/포트

- 호스트 포트: postgres **5433**, backend **8001** (todolist 5432/8000 회피)
- 컨테이너 내부: postgres 5432, backend 8000
- 프런트 dev: 3000 (`NEXT_PUBLIC_API_URL=http://localhost:8001`)

## 완료된 단계

| Phase | 내용 |
|---|---|
| **A** | 백엔드 단독 동작 — 그래프 모듈화 + DB 이전 + curl 검증 |
| **B** | 세션 영속화 — AdSession/AdMessage 모델 + 라우터 CRUD + payload JSONB |
| **C** | 프런트 — cosmos 디자인 + 채팅 UI + adSessions 사이드바 + 멀티턴 SSE |
| 미세조정 | 호환성 안내 (한국 단위 + fallback + deterministic), Stage 라우팅 단순화 (답변 후 더 질문 X), Top-3 reason 매체에 첨부, REGION_COLS 정화 (성수기 false positive 제거), 한국어 budget 단위 강화 (천오백만원=15000000) |

## 다음 단계 — **배포**

선택: **Vercel + EC2** (옵션 B).
- Frontend → Vercel (git push 자동 배포, Next 16 SSR, 무료)
- Backend → EC2 단일 VM (postgres + backend 같은 인스턴스, docker compose 그대로)
- DB → EC2 안 postgres 컨테이너 (RDS 분리 안 함, prototype 단계)
- 도메인 + Let's Encrypt 무료 HTTPS

작업 예정:
1. EC2 인스턴스 (t3.small Ubuntu 22.04) 생성 + Elastic IP
2. SG: 22/80/443 오픈, 5432/8000 내부 only
3. Docker + docker compose 설치 + 레포 clone
4. todolist DB → EC2 postgres 로 데이터 이전 (`pg_dump -Fc | pg_restore`)
5. nginx reverse proxy + certbot HTTPS
6. Vercel: GitHub 연동, root=`frontend`, env `NEXT_PUBLIC_API_URL=https://api.your-domain.com`
7. backend `.env` `FRONTEND_URL` 에 Vercel 도메인 추가 (CORS)

옵션: `docker-compose.prod.yml` override 파일 추가 — postgres 외부 노출 제거, uvicorn `--reload` 빼기.

## 사용자 결정 메모

- 인증: 없음 (prototype)
- DB: pg_dump 로 todolist 에서 3개 테이블 옮김
- 노트북: todolist 에 그대로 (학습/디버깅 reference)
- 프런트: 채팅 형식 누적 (`/chat` 스타일)
- SSE: `stream_mode="updates"` (노드 단위)
- 가격 표기: 한국 단위 (백만/천만/억)
- 호환성 안내: deterministic 빌드 (LLM 환각 방지)
- Top-3 reason 만 매체에 첨부 (Top-10 전체 reason 안 함)
- 매체 list 표기: `#media_id - media_name` 메인
- Stage 1 → Stage 2 라우팅: 답변 받은 후엔 무조건 Stage 2 (슬롯 부족해도)

## 알려진 미세 이슈 (나중에 손볼 수 있음)

- `cheapest_regions_for_type` 정렬이 count 내림차순 → min_price ASC 가 더 자연 (예: 빌보드 가장 저렴 = 중구 350만원~ 인데 list 첫번째가 강남구 500만원~)
- REGION_COLS 좁힘 부작용 — description 에만 지역명 있는 매체 매칭 안 됨 (단 media_name 이 대부분 지역 포함이라 실손해 적음)
- explain 노드 LLM Top-3 reason — 가끔 추측성 표현 (전체적으로 사실 기반 prompt 강화 했지만)
