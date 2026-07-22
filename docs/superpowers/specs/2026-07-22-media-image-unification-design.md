# media_image 완전 통합 + Next Image 최적화 + 외부 URL 삭제 — 설계

- 작성일: 2026-07-22
- 상태: 설계 승인됨(옵션 B, 완전 통합), 구현 계획 대기
- 관련 모델: `media`, `media_image`, `media_items`, `proposal_item`

---

## 1. 목표 & 성공 기준

1. **`media_image`를 모든 매체 이미지의 단일 소스로 만든다.** 이미지 URL은 `media_image.image_url`에서만 읽는다.
2. **`media_items`(V2/챗봇 파이프라인)에 `media_id` FK를 신설**해, 현재의 `thumbnail_url` 문자열 조인을 제거한다.
3. **프론트 `<img>` → Next.js `<Image>`로 전환**하고, 리스트=소형/상세=대형으로 크기별 최적화한다.
4. **운영 DB의 houseofooh/attachments 외부 URL을 세 테이블에서 일괄 삭제**한다(이미지 손실 감수 확정).

### 검증 가능한 성공 기준
- `tsc`/`lint` 통과 (Playwright MCP 미사용 — 검증은 정적 도구·쿼리로).
- `recommend_v2`가 `media_id` 조인으로 이미지를 반환(스테이징 쿼리로 확인).
- `media_id` 백필 매칭 리포트 산출(매칭/미매칭 건수).
- 매체 이미지를 렌더하는 `<img>` 잔존 0건(grep).
- (Phase 2) 삭제 전/후 카운트 리포트 + 삭제 대상 덤프파일 보존.

---

## 2. 현재 상태 (근거 포함)

### 이미지 공급 경로 2개 (둘 다 운영)

| 테이블 | 역할 | 이미지 컬럼 | media와 링크 |
|---|---|---|---|
| `media_items` | V2 추천(챗봇). xlsx Sheet1 import | `thumbnail_url`, `all_image_urls`(`"url1 \| url2"`) | **FK 없음** |
| `media`(마스터) | 주소·등급·가격·지도. 고정매체 지도/리스트/상세 + 관리자 | `thumbnail_url`(캐시) | `media_image`와 media_id FK |
| `media_image` | media 정규화 자식(1:N) | `image_url` | media_id FK ✅ |

### 조인키 지뢰
`recommend_v2.py:308-326` `_media_meta_by_thumbnail`: `media_items.thumbnail_url = media.thumbnail_url` **문자열 일치**로만 조인("913개 동일 매체, thumbnail_url 1:1 키"). `media_items`에는 `media_id`/`source_id`가 없음(확인). → 이 URL을 지우면 챗봇↔지도/Drawer 연동이 영구 소실.

### houseofooh URL이 있는 곳 — 세 테이블 전부
- `media_items.thumbnail_url`, `media_items.all_image_urls` ← `import_media.py:106-107`
- `media.thumbnail_url` ← `import_media_master.py:187`
- `media_image.image_url` ← `import_media_images.py:107` (`detail.mediaItemImages` 분해)
- 관리자 업로드분만 로컬 `/uploads/media/{media_id}/{uuid}.ext` (`media_service.py:846-852`)

### 직렬화 현황 (변경 대상)
- `media_service.py:73-82, 247-260`: `[m.thumbnail_url, *media_image.image_url]` 병합 → `images[:3]`, `thumbnailUrl=m.thumbnail_url`.
- `recommend_v2.py:88-89, 302, 343-352`: `MediaItemResponse.thumbnail_url` = `item.thumbnail_url`, `detail_images` = `_split_image_urls(item.all_image_urls)`.
- `proposal_service.py:535, 655`: 제안서 스냅샷이 `media.thumbnail_url` / `it.thumbnail_url` 복사.

### 프론트 렌더 필드 (변경 대상)
- 챗 리스트: `it.thumbnail_url` + `it.detail_images` (`chat/ChatMediaList.tsx:34`).
- 고정 리스트/상세: `detail.thumbnailUrl` + `detail.imageUrls` (`FixedMediaView.tsx:34,218,254`).
- 상세: `<img src={imageUrl}>` (`MediaDetailContent.tsx:144`).
- 관리자: `MediaPhotoSection.tsx` `<img>` + `toSrc()`(`:16-17`).
- 그 외 사용처: `MovingView.tsx`, `MediaSearchPanel.tsx`, `AssistantBubble.tsx`, `mapTypes.ts`.

### 인프라
- `/uploads`는 백엔드 StaticFiles로 서빙(`main.py:61`).
- 마이그레이션: **Alembic** 사용(`backend/alembic/versions/`, 최신 `034`). 다음은 `035`.
- 로컬 `DATABASE_URL` = `localhost:5433` (운영 아님). 운영 RDS는 사설망 추정.
- AWS 접근: AWS MCP 연결됨, IAM 유저 `mcp-cli-ssm`(SSM 실행용). describe 권한/리전 불명 → 운영 EC2 인스턴스ID·리전은 Phase 2에서 사용자가 제공.

---

## 3. 타깃 아키텍처

```
media_items ──(media_id FK)──▶ media ──(media_id FK)──▶ media_image [단일 이미지 소스]
   [챗봇]                        [지도/상세/관리자]         image_url / is_thumbnail / sort_order
```

- 모든 화면·API의 이미지는 `media_image`에서 조회.
- `media.thumbnail_url`, `media_items.thumbnail_url`, `media_items.all_image_urls`는 **이미지 소스에서 제외**(컬럼은 드롭하지 않고 미사용/deprecated로 방치 — 컬럼 드롭은 별도 파괴 마이그레이션, YAGNI).

---

## 4. Phase 1 — 비파괴 (코드 + 스키마)

URL은 그대로 둔 채 구조만 이관. 문제 시 롤백 가능. 배포·검증까지 완료해야 Phase 2 진입.

### 4.1 스키마 마이그레이션 (Alembic `035`)
- `media_items.media_id` 추가: `String(20)`, `ForeignKey("media.media_id")`, `nullable=True`, `index=True`.
- 백필(같은 마이그레이션 또는 데이터 스크립트, **URL이 아직 일치하는 시점에 실행**):
  ```sql
  UPDATE media_items mi
  SET media_id = m.media_id
  FROM media m
  WHERE mi.thumbnail_url = m.thumbnail_url;
  ```
- 매칭 리포트: 전체/매칭/미매칭 건수. `thumbnail_url` 중복으로 다중 매칭이 생기는지 사전 점검(중복 시 매칭 규칙 보강 — 예: name 병행).
- 미매칭(`media_id IS NULL`)은 현재도 조인 실패 상태이므로 회귀 아님. 리포트에만 남김.

### 4.2 백엔드 컷오버 — 이미지를 media_image에서만 읽기
- `recommend_v2.py`
  - `_media_meta_by_thumbnail` → `_media_meta_by_media_id`(media_items.media_id → media.media_id 조인).
  - 이미지 배치 로더 신설(또는 `media_service._images_by_media` 패턴 재사용): media_id 목록 → `media_image` 조회.
  - `MediaItemResponse.thumbnail_url` = media_image 대표행(`is_thumbnail` 우선, 없으면 `sort_order` 최소), `detail_images` = media_image 전체 URL.
  - **필드명 유지** → 프론트 무영향, 소스만 교체.
- `media_service.py`
  - 직렬화에서 `m.thumbnail_url` 병합 제거. `images`/`thumbnailUrl`은 `media_image`에서만.
  - `thumbnailUrl` = media_image 대표행.
- `proposal_service.py:535, 655`
  - 스냅샷 소스를 media_image 대표값으로 변경(제안서 스냅샷은 계속 값 복사 유지).
- 관리자 업로드(`add_media_image`)는 이미 media_image에 씀 — 변경 없음.

### 4.3 프론트 — Next Image 전환
- `next.config.ts`에 `images.remotePatterns` 추가:
  - dev: `http://localhost:8001/uploads/**`
  - prod: **[PLACEHOLDER — 운영 백엔드 호스트]** `https://<PROD_API_HOST>/uploads/**`
    - 배포 전 실제 운영 호스트로 채울 것(TODO).
- `<img>` → `<Image>` 교체 대상: `FixedMediaView.tsx`, `chat/ChatMediaList.tsx`, `MediaSearchPanel.tsx`, `MovingView.tsx`, `MediaDetailContent.tsx`, `MediaPhotoSection.tsx`, (필요 시 `AssistantBubble.tsx`).
- 크기별 최적화:
  - 리스트/썸네일: 소형(대략 `width≈200`, `sizes` 명시) → Next가 작은 변형 srcset 생성.
  - 상세: 대형(뷰포트 기반 `sizes`).
- 절대 URL 처리: 기존 `toSrc()`(상대→`API_BASE_URL` 프리픽스) 유지, `<Image src>`에 절대 URL 전달.

### Phase 1 검증
- `tsc`/`lint` 통과.
- 로컬에서 recommend_v2 응답에 media_image 기반 이미지가 담기는지 쿼리/수동 확인.
- 백필 매칭 리포트 확인.
- 매체 이미지 `<img>` grep 잔존 0.

---

## 5. Phase 2 — 파괴 (외부 URL 삭제)

**전제: Phase 1이 운영에 반영·검증 완료.** 실행: AWS MCP → SSM run-command로 운영 EC2(운영 `DATABASE_URL` 보유)에서 스크립트 실행. 인스턴스ID·리전은 실행 시 사용자 제공.

### 5.1 대상
houseofooh/attachments 도메인은 **확정적으로 전부 삭제**. 로컬 `/uploads`는 보존.
- `media_image`: `image_url` 이 houseofooh/attachments 인 행 **DELETE**.
- `media.thumbnail_url`: 매칭 시 **NULL**.
- `media_items.thumbnail_url`: 매칭 시 **NULL**.
- `media_items.all_image_urls`: 매칭 시 **NULL**.

매칭 패턴(초안): `image_url ILIKE '%houseofooh%' OR image_url ILIKE '%attachments.%'`. 실행 직전 호스트 서베이(`SELECT DISTINCT ... COUNT`)로 대상 재확인.

### 5.2 안전장치 (순서)
1. 호스트 서베이 리포트(도메인별 건수).
2. **RDS 스냅샷** 생성.
3. 삭제 대상 행 전체를 파일로 **덤프**(reversibility).
4. **트랜잭션** 내 삭제.
5. 삭제 전/후 카운트 리포트.

---

## 6. 리스크 & 대응

- **조인키 소실(치명)**: 백필 전 삭제 금지. Phase 순서로 강제. → media_id 백필을 삭제의 하드 선행조건으로 명시.
- **thumbnail_url 중복 매칭**: 백필 정확도 저하. → 사전 중복 점검, 필요 시 name 병행 매칭.
- **운영 데이터 파괴 사고 재발**(메모리 기록): 스냅샷+덤프+트랜잭션+리포트 5단계. 스로어웨이 아닌 실제 운영 데이터이므로 파괴적 정리 원칙 위반 금지.
- **Next Image 운영 호스트 누락**: remotePatterns에 운영 호스트 미기입 시 운영 이미지 최적화 실패. → 배포 전 PLACEHOLDER 치환 TODO.
- **미매칭 매체**: media_id NULL → 챗봇 메타 없음. 현재와 동일(회귀 아님), 리포트로 가시화.

---

## 7. 열린 항목 (PLACEHOLDER)

- 운영 백엔드/이미지 호스트 → remotePatterns 운영 값. (현재 플레이스홀더)
- Phase 2 실행 대상 운영 EC2 인스턴스ID·리전. (Phase 2 시 사용자 제공)
- `thumbnail_url` 중복 여부 실측 결과(백필 규칙 확정 근거).
