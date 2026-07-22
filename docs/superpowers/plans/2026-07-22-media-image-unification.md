# media_image 완전 통합 + Next Image + 외부 URL 삭제 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 매체 이미지를 `media_image` 단일 소스로 통합하고, 프론트를 Next `<Image>`로 최적화하며, 운영 DB의 houseofooh/attachments 외부 URL을 삭제한다.

**Architecture:** Phase 1(비파괴)에서 `media_items`에 `media_id` FK를 신설·백필하고 백엔드 이미지 소스를 `media_image`로 컷오버, 프론트를 Next Image로 전환한다. Phase 2(파괴, Phase 1 검증 후)에서 AWS MCP/SSM으로 운영 DB의 외부 URL을 삭제한다. media_id 백필은 삭제의 하드 선행조건이다(조인키 소실 방지).

**Tech Stack:** FastAPI + SQLAlchemy + Alembic + PostgreSQL(로컬 5433), Next.js 16 + React Query, pytest(실 postgres, throwaway 레코드), 프론트 검증은 tsc/eslint.

**설계 근거:** [2026-07-22-media-image-unification-design.md](../specs/2026-07-22-media-image-unification-design.md)

**전제:**
- 백엔드 테스트는 `SessionLocal()`(로컬 5433)에 throwaway 레코드를 만들고 teardown에서 정리한다(`test_proposal_service.py` 패턴). 실제 운영 데이터 건드리지 않음.
- 커밋은 각 Task 끝에서 수행(프로젝트 규칙: 사용자 지시 시 커밋 — 본 계획 실행 자체가 지시로 간주. 불명확하면 커밋 전 확인).
- Phase 2는 Phase 1 운영 배포·검증 완료 전까지 실행 금지.

---

## 파일 구조 (생성/수정)

**Phase 1**
- Create: `backend/alembic/versions/035_media_items_media_id_fk.py` — media_items.media_id 추가+백필
- Modify: `backend/src/models/media.py` — MediaItem.media_id 컬럼/관계
- Modify: `backend/src/services/recommend_v2.py:302-358, 455, 459, 679, 683` — media_id 조인 + media_image 이미지
- Modify: `backend/src/services/media_service.py:70-86, 236-262` — 이미지 소스 media_image 단일화
- Modify: `backend/src/services/proposal_service.py:535, 655` — 스냅샷 소스 media_image
- Modify: `frontend/next.config.ts` — images.remotePatterns
- Modify: 프론트 렌더 컴포넌트 6개(아래 Task 6) — `<img>`→`<Image>`
- Test: `backend/tests/test_recommend_v2.py`, `test_media_service_images.py`(신규), `test_proposal_service.py`

**Phase 2**
- Create: `backend/scripts/survey_external_image_hosts.py` — 읽기 전용 서베이
- Create: `backend/scripts/delete_external_images.py` — 덤프+트랜잭션 삭제+리포트

---

# PHASE 1 — 비파괴 (코드 + 스키마)

## Task 1: Alembic 035 — media_items.media_id FK + 백필

**Files:**
- Create: `backend/alembic/versions/035_media_items_media_id_fk.py`
- Modify: `backend/src/models/media.py:48-57`

- [ ] **Step 1: 백필 전 thumbnail_url 중복 사전점검 (로컬 DB)**

Run:
```bash
cd backend && .venv/bin/python -c "
from src.database import SessionLocal
from sqlalchemy import text
db = SessionLocal()
dup = db.execute(text('SELECT thumbnail_url, COUNT(*) c FROM media WHERE thumbnail_url IS NOT NULL GROUP BY thumbnail_url HAVING COUNT(*)>1')).fetchall()
print('media thumbnail_url 중복 그룹:', len(dup))
for r in dup[:10]: print(r)
db.close()
"
```
Expected: 중복 그룹 0이면 thumbnail_url 단순 매칭 안전. >0이면 Step 3 백필에 name 병행 조건 추가 필요(그 경우 이 계획 실행자는 STOP 후 보고).

- [ ] **Step 2: MediaItem 모델에 media_id 추가**

`backend/src/models/media.py`의 `MediaItem` 클래스에서 `all_image_urls` 줄(현재 57) 바로 아래에 추가:

```python
    media_id = Column(
        String(20),
        ForeignKey("media.media_id"),
        nullable=True,
        index=True,
    )
```

상단 import에 `ForeignKey`가 없으면 `from sqlalchemy import (...)` 에 추가:
```python
from sqlalchemy import Column, DateTime, Enum, ForeignKey, Index, String, Text
```

- [ ] **Step 3: 마이그레이션 파일 작성**

`backend/alembic/versions/035_media_items_media_id_fk.py`:

```python
"""media_items.media_id FK + thumbnail_url 백필

Revision ID: 035_media_items_media_id_fk
Revises: 034_add_proposal_deleted_at
"""
from alembic import op
import sqlalchemy as sa

revision = "035_media_items_media_id_fk"
down_revision = "034_add_proposal_deleted_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("media_items", sa.Column("media_id", sa.String(length=20), nullable=True))
    op.create_index("ix_media_items_media_id", "media_items", ["media_id"])
    op.create_foreign_key(
        "fk_media_items_media_id", "media_items", "media",
        ["media_id"], ["media_id"],
    )
    # 백필: URL 이 아직 일치하는 시점에 media_id 채움
    op.execute(
        """
        UPDATE media_items mi
        SET media_id = m.media_id
        FROM media m
        WHERE mi.thumbnail_url = m.thumbnail_url
          AND mi.thumbnail_url IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_constraint("fk_media_items_media_id", "media_items", type_="foreignkey")
    op.drop_index("ix_media_items_media_id", table_name="media_items")
    op.drop_column("media_items", "media_id")
```

- [ ] **Step 4: 마이그레이션 적용**

Run:
```bash
cd backend && .venv/bin/alembic upgrade head
```
Expected: `Running upgrade 034_add_proposal_deleted_at -> 035_media_items_media_id_fk` 출력, 에러 없음.

- [ ] **Step 5: 백필 매칭 리포트 확인**

Run:
```bash
cd backend && .venv/bin/python -c "
from src.database import SessionLocal
from sqlalchemy import text
db = SessionLocal()
total = db.execute(text('SELECT COUNT(*) FROM media_items')).scalar()
matched = db.execute(text('SELECT COUNT(*) FROM media_items WHERE media_id IS NOT NULL')).scalar()
print(f'media_items total={total} matched={matched} unmatched={total-matched}')
db.close()
"
```
Expected: matched 가 대다수(설계상 ~913). unmatched 건수 기록. matched=0 이면 STOP(백필 실패).

- [ ] **Step 6: Commit**

```bash
git add backend/alembic/versions/035_media_items_media_id_fk.py backend/src/models/media.py
git commit -m "feat: media_items.media_id FK 신설 + thumbnail_url 백필"
```

---

## Task 2: recommend_v2 — media_id 조인 + media_image 이미지 소스

**Files:**
- Modify: `backend/src/services/recommend_v2.py:308-358, 455, 459, 679, 683`
- Test: `backend/tests/test_recommend_v2.py`

- [ ] **Step 1: 실패 테스트 작성**

`backend/tests/test_recommend_v2.py` 하단에 추가(파일 상단 import 에 필요한 것 함께 추가):

```python
def test_response_item_images_from_media_image():
    import uuid
    from src.database import SessionLocal
    from src.models.media_master import Media
    from src.models.media_image import MediaImage
    from src.models.media import MediaItem
    from src.services.recommend_v2 import (
        _media_meta_by_media_id,
        _images_by_media_id,
        _to_response_item,
    )

    db = SessionLocal()
    mid = f"TESTM-{uuid.uuid4().hex[:8]}"
    try:
        m = Media(media_id=mid, name="테스트매체", latitude=37.5, longitude=127.0,
                  category_large="옥외", category_small="빌보드")
        db.add(m)
        db.add(MediaImage(media_id=mid, image_url="/uploads/media/x/a.jpg",
                          sort_order=0, is_thumbnail=True))
        db.add(MediaImage(media_id=mid, image_url="/uploads/media/x/b.jpg",
                          sort_order=1, is_thumbnail=False))
        it = MediaItem(name="테스트매체", media_source="FIXED",
                       thumbnail_url="https://attachments.houseofooh.com/old.jpg",
                       all_image_urls="https://attachments.houseofooh.com/old.jpg",
                       media_id=mid)
        db.add(it)
        db.commit()
        db.refresh(it)

        meta = _media_meta_by_media_id(db, [it])
        imgs = _images_by_media_id(db, [it.media_id])
        resp = _to_response_item(it, meta, imgs)

        assert resp.thumbnail_url == "/uploads/media/x/a.jpg"
        assert resp.detail_images == ["/uploads/media/x/a.jpg", "/uploads/media/x/b.jpg"]
        assert resp.media_id == mid
        assert resp.latitude == 37.5
    finally:
        db.query(MediaItem).filter(MediaItem.media_id == mid).delete()
        db.query(MediaImage).filter(MediaImage.media_id == mid).delete()
        db.query(Media).filter(Media.media_id == mid).delete()
        db.commit()
        db.close()
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && .venv/bin/pytest tests/test_recommend_v2.py::test_response_item_images_from_media_image -v`
Expected: FAIL — `ImportError: cannot import name '_media_meta_by_media_id'` (아직 미구현).

- [ ] **Step 3: recommend_v2.py 구현**

`_media_meta_by_thumbnail`(308-339) 전체를 아래로 교체:

```python
def _media_meta_by_media_id(db: Session, items: list[MediaItem]) -> dict[str, dict]:
    """media_items.media_id → media(master) 메타 배치 매핑 (lat/lng·카테고리)."""
    ids = [it.media_id for it in items if it.media_id]
    if not ids:
        return {}
    rows = (
        db.query(
            Media.media_id,
            Media.latitude,
            Media.longitude,
            Media.category_large,
            Media.category_small,
        )
        .filter(Media.media_id.in_(ids))
        .all()
    )
    return {
        mid: {
            "latitude": float(lat) if lat is not None else None,
            "longitude": float(lng) if lng is not None else None,
            "category_large": cl,
            "category_small": cs,
        }
        for mid, lat, lng, cl, cs in rows
    }


def _images_by_media_id(db: Session, media_ids: list[str]) -> dict[str, list[str]]:
    """media_id → media_image url 목록(대표 우선 → sort_order)."""
    ids = [i for i in media_ids if i]
    if not ids:
        return {}
    rows = (
        db.query(MediaImage.media_id, MediaImage.image_url)
        .filter(MediaImage.media_id.in_(ids))
        .order_by(
            MediaImage.media_id,
            MediaImage.is_thumbnail.desc(),
            MediaImage.sort_order,
        )
        .all()
    )
    out: dict[str, list[str]] = {}
    for mid, url in rows:
        out.setdefault(mid, []).append(url)
    return out
```

파일 상단 import 에 MediaImage 추가:
```python
from src.models.media_image import MediaImage
```

`_to_response_item`(342-358) 전체를 아래로 교체:

```python
def _to_response_item(
    item: MediaItem,
    meta_map: dict[str, dict] | None = None,
    images_map: dict[str, list[str]] | None = None,
) -> MediaItemResponse:
    meta = (meta_map or {}).get(item.media_id or "") or {}
    images = (images_map or {}).get(item.media_id or "") or []
    return MediaItemResponse(
        id=str(item.id),
        media_id=item.media_id,
        name=item.name,
        media_source=item.media_source,
        price=item.advertisement_fee or None,
        thumbnail_url=images[0] if images else None,
        detail_images=images,
        latitude=meta.get("latitude"),
        longitude=meta.get("longitude"),
        category_large=meta.get("category_large"),
        category_small=meta.get("category_small"),
    )
```

- [ ] **Step 4: 호출부 4곳 갱신**

455-459 블록:
```python
    media_meta = _media_meta_by_media_id(db, selected)
    images_map = _images_by_media_id(db, [it.media_id for it in selected])
    # ... (기존 items= 라인)
        items=[_to_response_item(it, media_meta, images_map) for it in selected],
```

679-683 블록:
```python
    media_meta = await _run_sync_in_thread(_media_meta_by_media_id, db, selected)
    images_map = await _run_sync_in_thread(
        _images_by_media_id, db, [it.media_id for it in selected]
    )
    # ...
        "items": [_to_response_item(it, media_meta, images_map).model_dump() for it in selected],
```

- [ ] **Step 5: 테스트 통과 확인 + 회귀 없음**

Run: `cd backend && .venv/bin/pytest tests/test_recommend_v2.py tests/test_recommend_v2_tools.py -v`
Expected: 신규 테스트 PASS, 기존 테스트 PASS. (`_split_image_urls`/`all_image_urls` 관련 기존 테스트는 유지 — 함수 자체는 삭제하지 않음.)

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/recommend_v2.py backend/tests/test_recommend_v2.py
git commit -m "feat: recommend_v2 이미지 소스를 media_image로 컷오버(media_id 조인)"
```

---

## Task 3: media_service — 검색 리스트/지도 마커 이미지 media_image 단일화

**Files:**
- Modify: `backend/src/services/media_service.py:70-86, 236-262`
- Test: `backend/tests/test_media_service_images.py` (신규)

- [ ] **Step 1: 실패 테스트 작성**

`backend/tests/test_media_service_images.py` 생성:

```python
"""media_service 카드 이미지 소스가 media_image 단일화됐는지 검증."""
import uuid

import pytest

from src.database import SessionLocal
from src.models.media_master import Media
from src.models.media_image import MediaImage
from src.services.media_service import _media_card


@pytest.fixture
def db():
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


def test_media_card_images_from_media_image_only(db):
    mid = f"TESTM-{uuid.uuid4().hex[:8]}"
    try:
        m = Media(media_id=mid, name="카드매체",
                  thumbnail_url="https://attachments.houseofooh.com/legacy.jpg")
        db.add(m)
        db.add(MediaImage(media_id=mid, image_url="/uploads/media/x/1.jpg",
                          sort_order=0, is_thumbnail=True))
        db.commit()
        db.refresh(m)

        card = _media_card(m)

        assert card["images"] == ["/uploads/media/x/1.jpg"]
        assert card["thumbnailUrl"] == "/uploads/media/x/1.jpg"
        assert "houseofooh" not in str(card)
    finally:
        db.query(MediaImage).filter(MediaImage.media_id == mid).delete()
        db.query(Media).filter(Media.media_id == mid).delete()
        db.commit()
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && .venv/bin/pytest tests/test_media_service_images.py -v`
Expected: FAIL — `thumbnailUrl` 이 `https://...houseofooh...legacy.jpg` 라서 assert 실패.

- [ ] **Step 3: `_media_card` 수정 (74, 81줄)**

74줄 교체:
```python
    for url in (img.image_url for img in m.images):
```
81줄 교체:
```python
        thumbnailUrl=images[0] if images else None,
```

- [ ] **Step 4: `_marker_from_row` 수정 (248줄)**

248줄 교체:
```python
    for url in img_map.get(r.media_id, []):
```
(`thumbnailUrl=images[0] if images else None` 은 이미 그러함 — 변경 없음.)

- [ ] **Step 5: 테스트 통과 + 회귀 없음**

Run: `cd backend && .venv/bin/pytest tests/test_media_service_images.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/media_service.py backend/tests/test_media_service_images.py
git commit -m "feat: 검색 리스트/지도 마커 이미지 소스를 media_image로 단일화"
```

---

## Task 4: proposal_service — 스냅샷 썸네일을 media_image에서

**Files:**
- Modify: `backend/src/services/proposal_service.py:535, 655`
- Test: `backend/tests/test_proposal_service.py`

- [ ] **Step 1: 현재 스냅샷 소스 확인**

Run: `cd backend && sed -n '525,545p;648,660p' src/services/proposal_service.py`
Expected: 535줄 `thumbnail_url=media.thumbnail_url`, 655줄 `thumbnail_url=it.thumbnail_url` 확인. (해당 함수가 받는 `media`/`it` 객체 타입과 media_image 접근 가능 여부를 이 출력으로 판단.)

- [ ] **Step 2: 실패 테스트 작성**

`backend/tests/test_proposal_service.py` 하단에 추가(기존 `db`/`session` fixture 재사용). 담기(add_item)가 media_image 대표 이미지를 스냅샷하는지 검증:

```python
def test_snapshot_thumbnail_from_media_image(db, session):
    import uuid
    from src.models.media_master import Media
    from src.models.media_image import MediaImage
    from src.services import proposal_service as ps

    mid = f"TESTM-{uuid.uuid4().hex[:8]}"
    m = Media(media_id=mid, name="담기매체",
              thumbnail_url="https://attachments.houseofooh.com/legacy.jpg")
    db.add(m)
    db.add(MediaImage(media_id=mid, image_url="/uploads/media/x/rep.jpg",
                      sort_order=0, is_thumbnail=True))
    db.commit()
    try:
        prop = ps.create_proposal(db, session_id=session.id, title="t")
        item = ps.add_item(db, proposal_id=prop.id, media_id=mid, session_id=session.id)
        assert item.thumbnail_url == "/uploads/media/x/rep.jpg"
    finally:
        db.query(MediaImage).filter(MediaImage.media_id == mid).delete()
        db.query(Media).filter(Media.media_id == mid).delete()
        db.commit()
```

> 주: `create_proposal`/`add_item` 의 실제 시그니처는 Step 1 출력과 파일 상단에서 확인해 맞출 것. 시그니처가 다르면 인자명만 조정(로직 동일).

- [ ] **Step 3: 테스트 실패 확인**

Run: `cd backend && .venv/bin/pytest tests/test_proposal_service.py::test_snapshot_thumbnail_from_media_image -v`
Expected: FAIL — thumbnail_url 이 legacy houseofooh URL.

- [ ] **Step 4: 스냅샷 소스 교체**

535줄(및 655줄) 컨텍스트에서 `media.thumbnail_url` / `it.thumbnail_url` 를 media_image 대표값으로 교체. 헬퍼를 추가해 재사용:

```python
def _rep_image_url(media) -> str | None:
    """media_image 대표 이미지 URL (is_thumbnail 우선, 없으면 sort_order 최소)."""
    imgs = sorted(
        media.images, key=lambda i: (not i.is_thumbnail, i.sort_order)
    )
    return imgs[0].image_url if imgs else None
```

535줄:
```python
                    thumbnail_url=_rep_image_url(media),
```
655줄이 `it`(다른 객체)라면 그 객체의 media 관계를 통해 동일 헬퍼 적용. Step 1 출력으로 `it` 이 media 관계를 갖는지 확인 후 `_rep_image_url(it.media)` 또는 이미 로드된 media 객체 사용.

- [ ] **Step 5: 테스트 통과**

Run: `cd backend && .venv/bin/pytest tests/test_proposal_service.py -v`
Expected: 신규 PASS, 기존 PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/proposal_service.py backend/tests/test_proposal_service.py
git commit -m "feat: 제안서 스냅샷 썸네일을 media_image 대표값으로 변경"
```

---

## Task 5: frontend next.config — remotePatterns

**Files:**
- Modify: `frontend/next.config.ts`

- [ ] **Step 1: images 설정 추가**

`frontend/next.config.ts` 를 아래로 교체:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["@/components/icons"],
  },
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8001", pathname: "/uploads/**" },
      // TODO(배포 전): 운영 백엔드 호스트로 교체 — PLACEHOLDER
      { protocol: "https", hostname: "PROD_API_HOST_PLACEHOLDER", pathname: "/uploads/**" },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 2: 빌드 설정 파싱 확인**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: 에러 없음(설정은 타입만 확인; 빌드는 Task 7에서).

- [ ] **Step 3: Commit**

```bash
git add frontend/next.config.ts
git commit -m "feat: next.config에 /uploads 이미지 remotePatterns 추가(운영 호스트 PLACEHOLDER)"
```

---

## Task 6: frontend `<img>` → Next `<Image>` (리스트 소형 / 상세 대형)

**Files (각 파일에서 매체 이미지 렌더 부분):**
- Modify: `frontend/app/(client)/(main)/media/[id]/_components/MediaDetailContent.tsx:144`
- Modify: `frontend/app/admin/(main)/media/_components/MediaPhotoSection.tsx:134`
- Modify: `frontend/app/(client)/(main)/fixed/_components/FixedMediaView.tsx` (이미지 렌더 지점)
- Modify: `frontend/app/(client)/(main)/fixed/_components/chat/ChatMediaList.tsx` (썸네일 렌더)
- Modify: `frontend/app/(client)/(main)/fixed/_components/MediaSearchPanel.tsx`
- Modify: `frontend/app/(client)/(main)/moving/_components/MovingView.tsx`

- [ ] **Step 1: 매체 이미지 `<img>` 사용처 전수 확인**

Run:
```bash
cd frontend && grep -rn "<img" "app/(client)" "app/admin/(main)/media" | grep -viE "icon|logo|avatar"
```
Expected: 위 6개 파일의 매체 이미지 `<img>` 목록. 이 목록을 Task 대상으로 확정(아이콘/로고 제외).

- [ ] **Step 2: 상세 이미지 교체 (대형)**

`MediaDetailContent.tsx:144` `<img src={imageUrl} ... />` 를 교체:

```tsx
import Image from "next/image";
// ...
<Image
  src={imageUrl}
  alt=""
  fill
  sizes="(max-width: 640px) 100vw, 640px"
  className="object-cover"
/>
```
(부모가 `position: relative` + 고정 높이여야 `fill` 동작. 기존 컨테이너 클래스에 `relative` 없으면 추가.)

- [ ] **Step 3: 리스트/썸네일 교체 (소형)**

`ChatMediaList.tsx`, `MediaSearchPanel.tsx`, `FixedMediaView.tsx`, `MovingView.tsx`, `MediaPhotoSection.tsx` 의 각 썸네일 `<img>` 를 `<Image>` 로 교체하고 **리스트는 소형 sizes** 지정:

```tsx
import Image from "next/image";
// 200px 썸네일 예:
<Image
  src={toSrc(url)}
  alt=""
  fill
  sizes="200px"
  className="object-cover"
/>
```
- 절대 URL 은 기존 `toSrc()`(상대→API_BASE_URL) 유지.
- `fill` 사용 시 부모에 `relative` 필요. 고정 크기(200px) 컨테이너는 이미 있으므로 `relative` 만 보강.
- `MediaPhotoSection.tsx:134` Thumbnail 컴포넌트의 `<img>` 도 동일하게 `<Image fill sizes="200px">`.

- [ ] **Step 4: 매체 `<img>` 잔존 0 확인**

Run:
```bash
cd frontend && grep -rn "<img" "app/(client)" "app/admin/(main)/media" | grep -viE "icon|logo|avatar"
```
Expected: (빈 출력) — 매체 이미지 `<img>` 없음.

- [ ] **Step 5: 타입/린트**

Run: `cd frontend && npx tsc --noEmit && npx eslint app/`
Expected: 에러 0.

- [ ] **Step 6: Commit**

```bash
git add frontend/app
git commit -m "feat: 매체 이미지 <img>→next/image 전환(리스트 소형/상세 대형 최적화)"
```

---

## Task 7: Phase 1 통합 검증

- [ ] **Step 1: 백엔드 전체 테스트**

Run: `cd backend && .venv/bin/pytest tests/ -q`
Expected: 전부 PASS(외부 API 필요한 테스트가 스킵되는 건 정상).

- [ ] **Step 2: 프론트 프로덕션 빌드**

Run: `cd frontend && npm run build`
Expected: 빌드 성공. next/image 관련 에러 없음.

- [ ] **Step 3: recommend_v2 응답 이미지 소스 수동 확인 (로컬)**

Run:
```bash
cd backend && .venv/bin/python -c "
from src.database import SessionLocal
from src.models.media import MediaItem
from src.services.recommend_v2 import _media_meta_by_media_id, _images_by_media_id, _to_response_item
db=SessionLocal()
items=db.query(MediaItem).filter(MediaItem.media_id.isnot(None)).limit(3).all()
meta=_media_meta_by_media_id(db,items); imgs=_images_by_media_id(db,[i.media_id for i in items])
for it in items:
    r=_to_response_item(it,meta,imgs)
    print(r.media_id, r.thumbnail_url, len(r.detail_images))
db.close()
"
```
Expected: thumbnail_url 이 `/uploads/...`(로컬 업로드분이 있는 매체) 또는 아직 houseofooh(삭제 전이므로 정상). **핵심: media_image에서 온다는 것** — media_image가 없는 매체는 None.

- [ ] **Step 4: 검증 결과 기록**

`docs/log.md` 최상단에 한 줄 추가:
```
- 2026-07-22 Phase 1 완료: media_image 단일 소스 컷오버 + media_items.media_id 백필(matched=NNN) + Next Image 전환. 외부 URL 삭제(Phase 2)는 운영 검증 후.
```
(NNN 은 Task 1 Step 5 실측값.)

- [ ] **Step 5: Commit**

```bash
git add docs/log.md
git commit -m "docs: Phase 1(media_image 통합) 완료 로그"
```

**⛔ 여기서 멈춤. Phase 2는 Phase 1이 운영에 배포·검증된 뒤에만 진행.**

---

# PHASE 2 — 파괴 (운영 외부 URL 삭제)

> **전제:** Phase 1 운영 배포·검증 완료. 실행자는 운영 EC2 인스턴스ID·리전을 확보한다. 스크립트는 AWS MCP → SSM run-command 로 운영 EC2(운영 `DATABASE_URL` 보유)에서 실행한다. 로컬에서 운영 DB에 직접 붙지 않는다.

## Task 8: 운영 외부 이미지 호스트 서베이 (읽기 전용)

**Files:**
- Create: `backend/scripts/survey_external_image_hosts.py`

- [ ] **Step 1: 서베이 스크립트 작성**

```python
"""운영 외부 이미지 호스트 서베이 (읽기 전용). EC2에서 실행."""
from sqlalchemy import text
from src.database import SessionLocal

PAT = "(image_url ILIKE '%houseofooh%' OR image_url ILIKE '%attachments.%')"


def main():
    db = SessionLocal()
    q = [
        ("media_image rows", f"SELECT COUNT(*) FROM media_image WHERE {PAT}"),
        ("media.thumbnail_url", "SELECT COUNT(*) FROM media WHERE thumbnail_url ILIKE '%houseofooh%' OR thumbnail_url ILIKE '%attachments.%'"),
        ("media_items.thumbnail_url", "SELECT COUNT(*) FROM media_items WHERE thumbnail_url ILIKE '%houseofooh%' OR thumbnail_url ILIKE '%attachments.%'"),
        ("media_items.all_image_urls", "SELECT COUNT(*) FROM media_items WHERE all_image_urls ILIKE '%houseofooh%' OR all_image_urls ILIKE '%attachments.%'"),
    ]
    for label, sql in q:
        print(label, db.execute(text(sql)).scalar())
    hosts = db.execute(text(
        "SELECT split_part(split_part(image_url,'://',2),'/',1) host, COUNT(*) c "
        "FROM media_image WHERE image_url LIKE 'http%' GROUP BY 1 ORDER BY 2 DESC"
    )).fetchall()
    print("media_image hosts:", [tuple(r) for r in hosts])
    db.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 운영에서 서베이 실행 (AWS MCP/SSM)**

AWS MCP `call_aws` 로 SSM send-command 실행(인스턴스ID·리전은 사용자 제공):
```
aws ssm send-command --region <REGION> --instance-ids <INSTANCE_ID> \
  --document-name "AWS-RunShellScript" \
  --parameters commands='cd /path/to/backend && .venv/bin/python scripts/survey_external_image_hosts.py'
```
그 뒤 `aws ssm get-command-invocation` 으로 출력 확인.
Expected: 도메인별 건수 확보. houseofooh/attachments 외의 예상치 못한 외부 호스트가 있으면 사용자에게 보고 후 삭제 패턴 확정.

- [ ] **Step 3: Commit**

```bash
git add backend/scripts/survey_external_image_hosts.py
git commit -m "chore: 운영 외부 이미지 호스트 서베이 스크립트"
```

---

## Task 9: 운영 외부 URL 삭제 (스냅샷+덤프+트랜잭션+리포트)

**Files:**
- Create: `backend/scripts/delete_external_images.py`

- [ ] **Step 1: RDS 스냅샷 생성 (AWS MCP)**

```
aws rds create-db-snapshot --region <REGION> \
  --db-instance-identifier <DB_ID> \
  --db-snapshot-identifier pre-external-image-delete-2026-07-22
```
Expected: 스냅샷 available 될 때까지 대기 후 다음 단계.

- [ ] **Step 2: 삭제 스크립트 작성 (덤프 우선 + 트랜잭션 + 리포트)**

```python
"""운영 외부(houseofooh/attachments) 이미지 URL 삭제. EC2에서 실행.

절차: 대상 덤프(파일) → 트랜잭션 삭제 → before/after 리포트.
로컬 /uploads 는 보존.
"""
import json
from datetime import datetime, timezone

from sqlalchemy import text
from src.database import SessionLocal

MATCH_IMG = "(image_url ILIKE '%houseofooh%' OR image_url ILIKE '%attachments.%')"
MATCH_THUMB = "(thumbnail_url ILIKE '%houseofooh%' OR thumbnail_url ILIKE '%attachments.%')"
MATCH_ALL = "(all_image_urls ILIKE '%houseofooh%' OR all_image_urls ILIKE '%attachments.%')"


def main():
    db = SessionLocal()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dump = {}
    dump["media_image"] = [dict(r._mapping) for r in db.execute(text(
        f"SELECT id, media_id, image_url FROM media_image WHERE {MATCH_IMG}"))]
    dump["media"] = [dict(r._mapping) for r in db.execute(text(
        f"SELECT media_id, thumbnail_url FROM media WHERE {MATCH_THUMB}"))]
    dump["media_items"] = [dict(r._mapping) for r in db.execute(text(
        f"SELECT id, thumbnail_url, all_image_urls FROM media_items WHERE {MATCH_THUMB} OR {MATCH_ALL}"))]
    path = f"/tmp/external_images_dump_{stamp}.json"
    with open(path, "w") as f:
        json.dump(dump, f, default=str, ensure_ascii=False, indent=2)
    print("DUMP:", path,
          "counts:", {k: len(v) for k, v in dump.items()})

    try:
        d1 = db.execute(text(f"DELETE FROM media_image WHERE {MATCH_IMG}")).rowcount
        d2 = db.execute(text(f"UPDATE media SET thumbnail_url=NULL WHERE {MATCH_THUMB}")).rowcount
        d3 = db.execute(text(f"UPDATE media_items SET thumbnail_url=NULL WHERE {MATCH_THUMB}")).rowcount
        d4 = db.execute(text(f"UPDATE media_items SET all_image_urls=NULL WHERE {MATCH_ALL}")).rowcount
        db.commit()
        print("DELETED media_image:", d1, "| NULLed media.thumbnail_url:", d2,
              "| media_items.thumbnail_url:", d3, "| media_items.all_image_urls:", d4)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: 운영 실행 (AWS MCP/SSM)**

SSM send-command 로 `scripts/delete_external_images.py` 실행(Task 8 Step 2 형식). 출력에서 DUMP 경로·삭제 카운트 확보.
Expected: media_image 삭제 건수 + media/media_items NULL 건수가 Task 8 서베이 카운트와 일치.

- [ ] **Step 4: 삭제 후 검증**

SSM 으로 `survey_external_image_hosts.py` 재실행.
Expected: 4개 카운트 전부 0. media_image hosts 에 houseofooh/attachments 없음.

- [ ] **Step 5: 덤프 파일 회수/보관**

EC2 `/tmp` 의 덤프 JSON 을 안전한 위치(S3 등)로 이동해 보관(reversibility).

- [ ] **Step 6: 로그 + Commit**

`docs/log.md` 최상단:
```
- 2026-07-22 Phase 2 완료: 운영 DB houseofooh/attachments 외부 URL 삭제(media_image N행 DELETE, media/media_items NULL). RDS 스냅샷 pre-external-image-delete-2026-07-22 + 덤프 보관.
```
```bash
git add backend/scripts/delete_external_images.py docs/log.md
git commit -m "chore: 운영 외부 이미지 URL 삭제 스크립트 + Phase 2 완료 로그"
```

---

## 검증 요약 (성공 기준 대조)

| 성공 기준 | 검증 위치 |
|---|---|
| media_image 단일 소스 | Task 2/3/4 테스트 + Task 7 Step 3 |
| media_items.media_id FK+백필 | Task 1 Step 4-5 |
| Next Image 크기별 최적화 | Task 6 Step 3, Task 7 Step 2(build) |
| 매체 `<img>` 잔존 0 | Task 6 Step 4 |
| 외부 URL 삭제 | Task 9 Step 4(카운트 0) |
| tsc/lint | Task 6 Step 5 |
| 삭제 안전(스냅샷+덤프) | Task 9 Step 1, 2, 5 |
