# PPT 업로드 + 자동 변환 미리보기

**작성일**: 2026-06-02
**범위**: 사용자가 PPT(.pptx/.ppt) 파일을 업로드하면 자동으로 슬라이드 이미지로 변환하여 `/deck/<id>` 페이지에서 미리보기로 표시
**관련 작업 (선행)**:
- `scripts/convert-ppt.sh` (로컬 변환, 작성 완료)
- `frontend/components/common/PptDeckViewer.tsx` (뷰어 컴포넌트, 작성 완료)
- `frontend/app/deck/[id]/page.tsx` (deck 페이지, 작성 완료, 현재는 `frontend/public/decks/` 읽음)

---

## 0. 전제 / 결정사항 (기본값)

트래픽 낮음 + 변환 자주 안 일어남 가정 → **MVP는 최대한 단순하게**.

| 항목 | 결정 | 근거 |
|---|---|---|
| 변환 위치 | 백엔드(FastAPI) | Vercel 같은 serverless 불가, 자체 컨테이너 있음 |
| 변환 방식 | **동기** (request 안에서 직접 변환) | 큐 불필요 (트래픽 낮음), 단순함 우선 |
| 저장 위치 | **백엔드 컨테이너 볼륨** `/data/decks/<deck_id>/` | S3/Supabase 도입 비용 회피, 추후 이전 가능 |
| 정적 파일 서빙 | FastAPI `StaticFiles` mount | 외부 CDN 불필요 |
| DB | **없음** (파일시스템이 상태) | MVP. 메타 필요해지면 그때 `decks` 테이블 추가 |
| 인증 | **없음** (기존 라우트와 동일) | 필요해지면 그때 |
| deck 목록 페이지 | **없음** (MVP에서 빠짐) | 업로드 후 응답으로 받은 ID로 직접 이동 |
| 한글 폰트 | `fonts-nanum` 설치 | 한글 PPT 안 깨짐 위해 필수 |
| HTTP 타임아웃 | 클라이언트/프록시 모두 600초 | 큰 PPT 변환 대비 |

추후 확장 시 마이그레이션 비용이 낮도록 **deck_id를 UUID로** 발급, **응답 형태는 향후 jobId 기반으로 바꿀 수 있게** 구조화.

---

## 1. 아키텍처

```
[브라우저: /deck/upload]
  ├─ 사용자가 .pptx 선택 + 업로드 버튼
  └─ POST /api/decks/upload (multipart, file=.pptx, title?)
       ↓
[FastAPI backend]
  ├─ deck_id = uuid4().hex
  ├─ /tmp/<deck_id>.pptx 에 저장
  ├─ subprocess: soffice --headless --convert-to pdf
  ├─ subprocess: pdftoppm -png -r 150 (본문) / -r 50 (썸네일)
  ├─ /data/decks/<deck_id>/meta.json 작성
  ├─ /tmp 정리
  └─ 응답: { deck_id, total_slides, title }
       ↓
[브라우저]
  └─ router.push(`/deck/${deck_id}`)
       ↓
[/deck/<deck_id> 페이지]
  ├─ 서버 컴포넌트가 GET /api/decks/<deck_id>/meta.json fetch
  └─ <PptDeckViewer> 에 slides 전달, 이미지 URL은 /api/decks/<deck_id>/slide-N.png
```

---

## 2. 변경 파일 목록

### 2-1. 백엔드 (FastAPI)

**`backend/Dockerfile`** (수정)
- `apt-get install`에 `libreoffice poppler-utils fonts-nanum` 추가
- 이미지 크기 +500MB 정도. 빌드 시간 +1~2분 (한 번만)

**`backend/src/routers/decks.py`** (신규)
- `POST /api/decks/upload`: multipart 받아 변환 후 `deck_id` 응답
- `GET /api/decks/{deck_id}/meta.json`: 메타 반환 (또는 StaticFiles로 처리)

**`backend/src/services/deck_converter.py`** (신규)
- `convert_ppt_to_slides(pptx_path: str, out_dir: str, title: str) -> DeckMeta`
- subprocess로 soffice + pdftoppm 실행
- meta.json 작성 (기존 shell 스크립트 로직을 Python으로 이식)
- 슬라이드 수, 파일명 목록 반환

**`backend/src/main.py`** (수정)
- `app.include_router(decks_router)` 추가
- `app.mount("/api/decks", StaticFiles(directory="/data/decks"), name="decks")` 추가
  - 또는 라우터에서 `FileResponse`로 직접 서빙

**`backend/requirements.txt`** (수정)
- 추가 필요한 파이썬 패키지 없음 (subprocess + 표준 라이브러리만 사용)
- `python-multipart`는 FastAPI 파일 업로드에 필요 — 없으면 추가

**`docker-compose.yml`** (수정)
- backend 서비스에 볼륨 추가: `- ooh-decks:/data/decks`
- `volumes:` 섹션에 `ooh-decks:` 추가

### 2-2. 프론트엔드 (Next.js)

**`frontend/app/(main)/deck/upload/page.tsx`** (신규)
- 업로드 UI: 파일 드롭존 + 타이틀 입력 + 진행 상태
- 업로드 → API 호출 → 응답 받으면 `/deck/<deck_id>` 이동
- 변환 중 진행 표시 (스피너 + 메시지)

**`frontend/app/deck/[id]/page.tsx`** (수정)
- 현재: `process.cwd()/public/decks/<id>/meta.json` 읽음
- 변경: 백엔드 `GET /api/decks/<id>/meta.json` fetch
- `<PptDeckViewer>`에 넘기는 `deckId` 경로 prefix를 `/api/decks/<id>` 로 변경

**`frontend/components/common/PptDeckViewer.tsx`** (수정)
- 현재: `basePath = /decks/${deckId}` (정적 자산)
- 변경: `basePath` prop을 외부에서 받도록 (혹은 prop으로 절대 URL 받기)
- 이렇게 해두면 로컬 정적 모드 / API 모드 둘 다 지원 가능

**`frontend/lib/api.ts`** (수정 가능)
- `uploadDeck(file, title)` 함수 추가
- 백엔드 baseURL 환경변수 사용 (기존 패턴 따름)

**`frontend/components/cosmos/Sidebar.tsx`** (수정 가능)
- 사이드바에 "Deck 업로드" 메뉴 추가 → `/deck/upload`
- (없어도 직접 URL 접속으로 됨, 편의성용)

---

## 3. API 스펙

### `POST /api/decks/upload`

**Request** (multipart/form-data):
- `file`: .pptx 또는 .ppt (필수, max 100MB)
- `title`: string (선택, 빈 값이면 파일명에서 추출)

**Response 200**:
```json
{
  "deck_id": "a1b2c3d4...",
  "title": "제안서 샘플 양식 v2",
  "total_slides": 12
}
```

**Response 400**:
```json
{ "detail": "지원하지 않는 파일 형식입니다." }
```

**Response 500**:
```json
{ "detail": "변환 실패: <에러 메시지>" }
```

### `GET /api/decks/{deck_id}/meta.json`
정적 파일. `PptDeckViewer`의 `DeckMeta` 형태와 동일.

### `GET /api/decks/{deck_id}/slide-N.png`
정적 파일. 본문 슬라이드.

### `GET /api/decks/{deck_id}/thumb-N.png`
정적 파일. 썸네일.

---

## 4. 단계별 구현 순서

### Phase 1 — 백엔드 변환 + 서빙 (제일 먼저)
1. `Dockerfile`에 LibreOffice/poppler/fonts-nanum 추가
2. `docker-compose.yml`에 볼륨 추가
3. `deck_converter.py` 작성 (subprocess 호출 + meta.json 작성)
4. `decks.py` 라우터 작성 (POST upload + StaticFiles mount)
5. `main.py`에 라우터/마운트 연결
6. **검증**: `curl -F file=@샘플.pptx http://localhost:8001/api/decks/upload` → deck_id 응답 + 디스크에 파일 생성 확인

### Phase 2 — 프론트엔드 페이지 전환
1. `PptDeckViewer` `basePath` prop 추가
2. `app/deck/[id]/page.tsx` 백엔드 fetch로 변경
3. **검증**: 백엔드에 업로드된 deck 페이지 접속 → 정상 렌더 확인

### Phase 3 — 업로드 UI
1. `app/(main)/deck/upload/page.tsx` 작성 (드롭존 + 진행 상태)
2. `lib/api.ts`에 `uploadDeck` 추가
3. **검증**: 브라우저에서 .pptx 드롭 → 변환 → deck 페이지 자동 이동까지 흐름 확인

### Phase 4 — (옵션) Sidebar 메뉴 추가
1. 사이드바 항목 추가
2. **검증**: 클릭으로 업로드 페이지 접근 가능

---

## 5. 검증 기준 (각 단계 완료 조건)

- [ ] `docker compose up -d --build backend` 가 LibreOffice 포함해서 정상 빌드 (이미지 크기 ~1GB 이내)
- [ ] 컨테이너 안에서 `soffice --version` / `pdftoppm -v` 둘 다 동작
- [ ] curl 업로드 → 5~10초 내 응답 (5장짜리 기준)
- [ ] `/data/decks/<deck_id>/` 안에 slide-*.png, thumb-*.png, meta.json 생성
- [ ] `GET /api/decks/<deck_id>/meta.json` 정상 응답
- [ ] `GET /api/decks/<deck_id>/slide-1.png` 정상 이미지 응답
- [ ] 브라우저 `/deck/<deck_id>` 페이지가 백엔드 fetch로 렌더 (200 + 슬라이드 표시)
- [ ] `/deck/upload` 페이지에서 드롭 → 변환 진행 표시 → 자동 이동 흐름
- [ ] 한글 폰트 깨지지 않음 (NanumGothic으로 대체되든 원본 폰트든, 박스 안 됨)
- [ ] 큰 PPT(20~30장) 변환 중에도 다른 API 응답 정상 (선택적 검증)

---

## 6. 알려진 트레이드오프 / 한계

1. **동기 변환** → 100장 넘는 PPT 업로드 시 HTTP 30~60초+ 대기. 프록시 타임아웃 600초로 설정해서 끊김 방지하지만, UX는 별로. 트래픽 증가하면 큐로 전환 필요.

2. **컨테이너 볼륨 저장** → 컨테이너 재배포 시 데이터 안 날아가도록 named volume 사용. 다만 백업·분산은 직접 처리 필요. 영구 자료성 deck이 늘어나면 S3/Supabase Storage로 이전.

3. **인증 없음** → URL만 알면 누구나 접근. 내부용/데모용으로 OK. 외부 공개 시 인증 또는 만료 URL 도입 필요.

4. **메타데이터 부재** → 누가 언제 올렸는지 추적 불가. 목록 페이지도 없음 (디렉토리 스캔으로는 임시 가능). 필요해지면 `decks` 테이블 (id, owner_id, title, status, created_at).

5. **한글 폰트 차이** → 원본이 윈도우 전용 폰트(예: 맑은고딕)면 LibreOffice가 NanumGothic으로 대체. 자간·줄간격 미세 차이 가능. 완전 동일 폰트 매칭이 필요하면 `fonts-noto-cjk` 등 추가 또는 폰트 파일 임베드.

6. **PPT 애니메이션·동영상** → PDF/PNG로 변환하면 모두 사라짐. 정적 슬라이드로만 표시됨. 사용자에게 명시 필요.

7. **변환 실패 케이스** — 매크로/암호화/손상된 PPT는 LibreOffice가 실패 또는 부분 변환. 에러 메시지 사용자에게 전달.

---

## 7. 향후 확장 시 손볼 곳 (지금 안 함)

- **deck 목록 페이지** + **검색** → `decks` 테이블 + `GET /api/decks` 페이지네이션
- **인증·권한** → 업로더 ID로 필터, 공개/비공개 토글
- **큐 + 워커 분리** → Celery / Dramatiq / RQ. 변환 워커 수평 확장
- **외부 스토리지 + CDN** → Supabase Storage 또는 S3 + CloudFront
- **변환 진행률** → SSE/웹소켓으로 슬라이드별 진행률 (현재는 통째로 완료될 때까지 대기)
- **PPT 원본 다운로드 링크** → 변환 후 원본도 보관·서빙
- **만료 정책** → N일 후 자동 삭제 cron
- **변환 캐시** → 동일 파일 hash 시 재변환 스킵
