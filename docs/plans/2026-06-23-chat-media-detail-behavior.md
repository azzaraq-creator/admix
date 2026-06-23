# 챗 매체 상세 질문 동작 변경 (media_detail)

> 2026-06-23 / 스펙 (구현 전 정의)

## Context / 이유

챗에서 특정 매체 상세를 물으면(`media_detail` 응답) 현재는 `MediaDetailDrawer`가 자동으로 열린다.
하지만 **모바일에서는 drawer가 아니라 매체 상세 페이지(`/media/[id]`)로 바로 이동**해야 한다.
따라서 자동 drawer 오픈을 없애고, 사용자가 명시적으로 "상세보기"를 눌렀을 때 기기별로 분기한다.

## As-is

- `media_detail` 응답 도착 → ChatPanel effect가 `onSelectMedia(...)` 호출 → 데스크탑 `MediaDetailDrawer` 자동 활성화.
- 관련 코드: `frontend/app/(client)/(main)/fixed/_components/ChatPanel.tsx` 의 "media_detail 응답이 오면 Drawer 자동 오픈" effect.

## To-be

`media_detail` 응답 시:
1. **지도: 해당 마커만 지도 가운데로 포커싱** (drawer 자동 오픈 X).
   - 단일 매체 포커싱이므로 fit-bounds가 아니라 `setCenter` + 적정 `level`.
2. **상세 설명 말미에 "상세보기" 버튼** 노출.
3. **"상세보기" 클릭 시 기기별 분기**:
   - **데스크탑(≥640px)**: 기존 `MediaDetailDrawer` 활성화 (현재 `onSelectMedia` 경로).
   - **모바일(<640px)**: `/media/{media_id}` 상세 페이지로 이동 (`router.push`).
   - 분기 기준: 프로젝트 반응형 기준 **640px**(Tailwind `sm`).

## 영향 범위 / 구현 노트

- **ChatPanel.tsx**
  - 기존 "media_detail → Drawer 자동 오픈" effect **제거**.
  - 대신 media_detail 도착 시 **지도 포커싱 트리거**: 상위로 `onFocusMedia(media_id)` 같은 콜백 전달 → FixedMediaView가 MapArea에 포커스 지시.
  - AssistantBubble 의 media_detail 렌더에 **"상세보기" 버튼** 추가. 클릭 핸들러는 ChatPanel→상위에서 받은 `onOpenDetail(media)` 호출.
- **MapArea.tsx**
  - 단일 마커 포커싱용 `focusId?: string`(또는 `focusLatLng`) prop 추가 → 해당 위치 `setCenter`+`setLevel`. (마커 자체는 직전 리스트 마커 유지)
- **FixedMediaView.tsx**
  - `onFocusMedia`: 포커스할 media_id를 MapArea로 전달.
  - `onOpenDetail(media)`: **기기 분기** — 데스크탑은 `setSelectedMedia`(Drawer), 모바일은 `router.push('/media/'+id)`.
  - 기기 판별: 640px 미디어쿼리 (기존 패턴 재사용; FixedMediaView는 이미 `mobileMap` 등 반응형 상태 보유).
- 백엔드 변경 없음 (media_detail 응답에 media_id/좌표 이미 포함).

## 검증

- 데스크탑 `/fixed`: "1번 자세히" → 설명 + 지도 마커 가운데 포커싱(자동 drawer 없음) → "상세보기" 클릭 → Drawer 활성화.
- 모바일(<640px): 동일 발화 → "상세보기" 클릭 → `/media/{id}` 페이지 이동.
- tsc/eslint 통과.
