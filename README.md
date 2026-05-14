# ooh-recommend

OOH(옥외광고) 매체 추천 챗봇. 광고주 자연어 발화 → LangGraph 그래프 → 매체 리스트 + 자연어 설명 + pivot.

## 스택
- **Backend**: FastAPI + LangGraph + PostgreSQL/pgvector + OpenAI
- **Frontend**: Next.js 16 + React 19 + Tailwind 4 (cosmos 디자인 토큰)
- **DB**: pgvector pg16

## 셋업

```bash
# 1) 백엔드 env
cp backend/.env.example backend/.env
# OPENAI_API_KEY 입력

# 2) postgres 띄우기 + pgvector 확장
docker compose up -d postgres
docker exec ooh-postgres psql -U postgres -d ooh_recommend -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 3) DB 데이터 이전 (소스 → 새 postgres). 소스 컨테이너 이름은 환경에 맞춰 수정.
#    plain SQL 은 COPY \\N 파싱 이슈가 있어서 binary custom format + pg_restore 권장.
docker exec <source_postgres> pg_dump -U postgres -d <source_db> -Fc \
  -t ad_media -t sangwon_area -t sangwon_population --no-owner --no-acl \
  | docker exec -i ooh-postgres pg_restore -U postgres -d ooh_recommend --no-owner --no-acl

# 4) 전체 띄우기
docker compose up -d

# 5) 프런트 (로컬)
cd frontend && npm install && npm run dev
```

API: `http://localhost:8001` · Frontend: `http://localhost:3000`

## 구조
- `backend/src/services/graph/` — LangGraph 노드/라우팅/빌더
- `backend/src/routers/chat_graph.py` — SSE 스트림 + 세션 CRUD
- `frontend/app/(main)/ad-recommend/` — 채팅 형식 UI
