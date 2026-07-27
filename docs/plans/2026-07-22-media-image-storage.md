# 매체 이미지 저장 아키텍처 — media_image 단일소스 + 외부 URL 삭제 + S3 전환

- 날짜: 2026-07-22
- 상태: 운영 배포·검증 완료
- 관련: [database-design.md §2.4](../policies/database-design.md) · [admin-media.md](../policies/admin-media.md) · 설계/구현 상세 [spec](../superpowers/specs/2026-07-22-media-image-unification-design.md) · [plan](../superpowers/plans/2026-07-22-media-image-unification.md)

매체 이미지의 저장·서빙을 세 단계로 정비했다: (1) `media_image`를 **단일 이미지 소스**로 통합, (2) 타사(houseofooh) **외부 URL 전량 삭제**, (3) 업로드 저장소를 로컬 디스크 → **S3 전환**.

---

## 배경 (이전 상태)

이미지가 세 곳에 흩어져 있었다.
- `media.thumbnail_url`(대표 캐시) + `media_image.image_url`(정규화 1:N) — 지도/리스트/상세·관리자
- `media_items.thumbnail_url` + `all_image_urls`("url1 | url2") — V2 추천(챗봇). **`media_items`↔`media`가 FK 없이 `thumbnail_url` 문자열로만 조인**되던 취약점.
- 실제 이미지 파일은 **타사 CDN `attachments.houseofooh.com`** 에 존재 → "다른 회사 자원 사용 불가".

## Phase 1 — media_image 단일소스 통합 (비파괴)

- **`media_items.media_id` FK 신설 + 백필**(Alembic `035`, `thumbnail_url` 일치로 매핑, 913/913). 문자열 조인 → `media_id` 조인으로 이관(조인키 소실 방지 = 이후 삭제의 하드 선행조건).
- 백엔드 이미지 소스를 `media_image`로 컷오버: `recommend_v2`(media_id 조인 + media_image 이미지), `media_service`(검색리스트/지도마커), `proposal_service`(스냅샷 대표값). `media.thumbnail_url`은 이미지 소스에서 제외(미사용/deprecated, 컬럼은 유지).
- 프런트 매체 이미지 `<img>` → **Next `<Image>`**(리스트 소형/상세 대형 최적화). `lib/media.ts`의 `mediaSrc()`로 상대 `/uploads` 경로를 백엔드 절대 URL로 해석.
- 배포: EC2 백엔드 + RDS 마이그레이션, Lambda `admix-ai-agent`(recommend_v2가 Lambda에서 실행됨), Amplify 프런트.

## Phase 2 — 외부 URL 삭제 (파괴)

Phase 1 운영 검증 후 실행. **하드 순서: media_id 백필 완료 후에만.** 안전장치 5단: 서베이 → RDS 스냅샷(`pre-external-image-delete-20260722`) → 덤프(`phase2_dump.json`, 1.2MB) → 트랜잭션 삭제 → 전후 리포트.

삭제 결과(운영):
- `media_image` houseofooh 행 **1760 DELETE**(로컬 `/uploads` 보존)
- `media.thumbnail_url` 913 NULL, `media_items.thumbnail_url` 913 NULL, `media_items.all_image_urls` 913 NULL
- 삭제 후 외부 URL 잔여 0. 이미지 손실(재업로드 전까지)은 합의된 사항.

스크립트: `backend/scripts/survey_external_image_hosts.py` · `dump_external_images.py` · `delete_external_images.py`. 실행은 EC2 backend 컨테이너에 stdin 파이프(`ssh … "docker exec -i ooh-backend python" < script`).

## S3 전환 — 업로드 저장소

- 버킷 **`ooh-image-public`**(ap-northeast-2, 퍼블릭 read 정책 `PublicReadGetObject`).
- `add_media_image`(`media_service.py`): 로컬 디스크 쓰기 → **S3 `put_object`**. key=`media/{media_id}/{uuid}.ext`, **ContentType 정확 지정**(`.jpg→image/jpeg` 등, 브라우저 렌더 보장). `image_url = https://ooh-image-public.s3.ap-northeast-2.amazonaws.com/{key}` 를 `media_image`에 저장.
- `delete_media_image`: DB 행 삭제 + **S3 객체도 정리**(legacy `/uploads`·외부 URL은 스킵, best-effort).
- 인증: EC2 인스턴스 역할 `admix-ec2-role`(액세스키 불필요). 인라인 정책 `admix-s3-image-write`(`s3:PutObject`/`s3:DeleteObject` on `ooh-image-public/*`) 추가.
- 프런트: `next.config.ts` remotePatterns + `lib/media.ts` `isOptimizable`에 S3 호스트 추가 → S3 이미지도 next/image 최적화.
- 기존 로컬 `/uploads` 이미지 1건은 유지(mediaSrc가 계속 서빙). **DB 마이그레이션 불필요**(image_url 문자열만 S3 URL로 바뀜).

---

## 현재 상태 (운영)

- **단일 이미지 소스**: `media_image.image_url`. 대표는 `is_thumbnail` 우선, 없으면 `sort_order` 최소.
- **저장/서빙**: 신규 업로드 → S3 `ooh-image-public` 퍼블릭 URL. (레거시 로컬 `/uploads` 1건 잔존.)
- **조인**: `media_items.media_id` → `media.media_id`(FK). `media.thumbnail_url`은 이미지 소스 아님(deprecated).
- **프런트 렌더**: `mediaSrc()`(상대 `/uploads`→백엔드 절대화, S3/외부는 그대로) + `isOptimizable()`(우리 `/uploads`·S3 호스트만 최적화, 그 외 unoptimized). leaf: `MediaThumbnail`(리스트) · `MediaDetailContent`/`MobileMediaDetail`(상세) · `MediaDetailImages`/`ImageLightbox`(map drawer) · `MediaPhotoSection`(관리자).

## 배포 메모

- 백엔드/Lambda 로직 변경 시 **EC2 재배포(`deploy/redeploy.sh`) + Lambda 재배포 둘 다** 필요(recommend 로직은 Lambda 실행). 프런트는 main push → Amplify 자동배포.
- 운영 이미지 호스트(next.config): 백엔드 `43-201-172-34.sslip.io`(레거시 `/uploads`) + S3 `ooh-image-public.s3.ap-northeast-2.amazonaws.com`.
