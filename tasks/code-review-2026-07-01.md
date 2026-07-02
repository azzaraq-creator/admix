# 프론트엔드 코드 리뷰 — 리팩토링 체크리스트

> 2026-07-01 리뷰. 4개 영역(데이터레이어/전역컴포넌트/클라이언트페이지/어드민) 병렬 리뷰 + 핵심 주장 직접 검증.
> 하나씩 수정하며 체크. 경로는 `frontend/` 기준.

## 전반 상태
- 기본 위생 양호: `any` 0개, `console.log` 2개, TODO 0개
- keys 팩토리 패턴 / 서버·클라이언트 경계 / 목록 페이지(CommonTable) 표준화 일관
- 문제는 **거대 컴포넌트**, **전역 에러 처리 부재**, **반복 복붙**에 집중

---

## 🔴 높음

- [x] **H1. 데이터 페칭 에러·로딩 처리** ✅ 2026-07-01 (라우트 error.tsx/loading.tsx 방식)
  - 공용 `components/common/RouteStates.tsx` (`ErrorState`/`LoadingState`)
  - `app/(client)/error.tsx`+`loading.tsx` (main·mypage·auth 커버), `app/admin/(main)/error.tsx`+`loading.tsx`
  - `providers.tsx` QueryClient에 `throwOnError` 술어 추가 — **네트워크 오류·5xx에만 throw**(4xx·401은 인터셉터/기존 처리 유지, 백그라운드 refetch 무분별 폭발 방지)
  - ⚠️ 한계: `loading.tsx`는 라우트 전환/초기 suspense만 커버. 클라이언트 react-query 로딩 스피너는 미포함 — 필요 시 뷰별 isLoading 또는 Suspense 도입(후속). 레이아웃(Sidebar) 내부 에러는 상위 경계로 버블(현재 미배치)

- [x] **H2. `MapArea.tsx` 782줄 분해 완료** ✅ 2026-07-02 (컴포넌트 본문 118줄)
  - Kakao SDK 타입 12개 + `declare global` + `loadKakaoSdk`(services 통합) + `geocodeAddress` → `lib/kakaoMap.ts`
  - 도메인 타입 5개(MapMarker/MapMoveType/MapBoundsPayload/MapCluster/MoveTarget) → `fixed/_components/mapTypes.ts`
  - MapArea가 재export(`geocodeAddress` + 도메인 타입) → importer 4곳(FixedMediaView/MediaSearchPanel/ChatPanel/AiChatPanel) 무변경
  - 부수효과: 로더 통합으로 잠재버그 해소(StaticKakaoMap이 먼저 SDK 로드 시 지오코딩 services 누락되던 케이스)
  - ✅ 2단계 완료 2026-07-02: effect 10개 → 3개 훅으로 그룹핑
    - `useKakaoMap`(SDK init+resize), `useMapMarkers`(마커/클러스터/포커스+moveTarget), `useMapPopup`(팝업 3종)
    - MapArea 컴포넌트 본문 585→118줄, 훅 호출 3줄 + render만 남김
    - effect 실행 순서 보존(markers→moveTarget 순서 유지), ref-sync는 훅별 분리(write-only라 순서 무관)
    - `markerObjsRef`만 컴포넌트가 소유해 useKakaoMap(resize)·useMapMarkers 공유

- [~] **H3. `ProposalDetailView.tsx`(client) 881→688줄 분해** ✅(부분) 2026-07-02
  - `SlideLightbox.tsx`(125줄): 전체보기 오버레이 + 키보드/스크롤 effect. `renderSlide` 콜백으로 데이터 의존 차단
  - `SlideSidebar.tsx`(130줄): 좌측 슬라이드 목록. 드래그는 내부 소유, reorder/delete/thumb는 콜백(`renderThumb`)
  - effect 순서·동작 보존, tsc/lint 통과
  - ⏭️ 미착수(사용자 판단): 팬/드래그는 훅으로 안 뺌(미리보기와 응집, 이득 적음). "브레인"(파생데이터+핸들러)도 유지
  - ⚠️ 검증 한계: 브라우저 미검증 → dev 서버에서 제안서 상세(슬라이드 선택/드래그/전체보기) 눈으로 확인 권장

> 철회/재분류: SSE 인증헤더(백엔드 session_id 식별로 무관, 철회), 토큰 쿠키 저장(SSR guard 아키텍처상 불가피)

---

## 🟡 중간

- [x] **M4-b. `fmtDateTime` 3중 중복 → `lib/date.ts`** ✅ 2026-07-02 — `formatDateTime`(시각)=client ProposalDetailView·ProposalsView 통합, `formatDate`(날짜만)=admin. 형식 다른 걸 확인해 2함수로 분리. (참고: admin `API_BASE` 미사용+baseURL 중복 — 별도 정리 대상)

- [x] **M1. 하드코딩 가짜 데이터** — `proposals/[id]/ProposalDetailView.tsx:669` "2024.05.20 15:30" → `{fmtDateTime(proposal?.updated_at)}` ✅ 2026-07-01
- [x] **M2. `extractError` 단일화** ✅ 2026-07-01 — `lib/apiError.ts`의 `extractApiError(err, fallback?)` 신규. admin 5곳(`AccountFormView`/`FaqFormView`/`BasicInfoTab`/`InquiryDetailView`/`login`) 통합. BasicInfoTab("저장 중..")·InquiryDetailView("처리 중..")·login은 원래 fallback 문구를 인자로 보존.
  - ※ client 3곳(`PasswordChangeModal` status분기, `ProposalsView` 타입 detail, `SignupForm` 409분기)은 **의미가 달라 제외** — 억지 통합 시 동작 변경됨
- [x] **M3. 비밀번호 필드 `type="text"` 노출** — `roles/AccountFormView.tsx:246` → `type="password"` ✅ 2026-07-01 (※임시 비번을 관리자가 눈으로 확인해야 한다면 눈 아이콘 토글로 되돌릴 수 있음)
- [x] **M4. 어드민 필터 옵션 누락** — proposals "집행 요청", members "휴면" 옵션 추가 ✅ 2026-07-01
- [ ] **M5. `CommonTable.tsx`(566줄) 책임 혼합** — 서버검색+클라이언트페이징. `DateField`/`PageSizeSelect`/`Pagination`/`getPageItems` 분리 (20곳 사용)
- [ ] **M6. `MediaDetailDrawer` ↔ `MobileMediaDetail` 중복** — 설명더보기/유동인구/스탯카드 뷰포트별 이중 구현 → 공용 하위 컴포넌트
- [ ] **M7. `MobileMediaDetail.tsx:23-70` 하드코딩 목업 기본값** — `name="서울 버스 TV"` 등 → 필수 prop/빈 상태
- [ ] **M8. 색상 토큰 우회 하드코딩** — `#00aaa4`(=primary) 13곳, grey/secondary 52곳. 특히 `AddToProposalModal.tsx`
- [x] **M9. 데이터레이어 정리** ✅ 2026-07-01
  - 세션키 3중 중복 → `lib/session.ts` (`SESSION_KEY`+`getSessionId`). auth/proposals는 `getSessionId` import, useV2Chat은 `SESSION_KEY` 재사용(읽기/쓰기 유지)
  - baseURL 이중 하드코딩 → `lib/api.ts`에서 `API_BASE_URL` export, useV2Chat이 import
  - `useUpdateProfile` → `onSuccess`에서 `authKeys.me` invalidate 추가
  - ~~mutation `onError` 공통 핸들러~~ → 별도 판단 필요(각 도메인 에러 UX가 달라 보류, H1 에러 인프라와 함께 논의)

---

## 🟢 낮음

- [x] **L1. `.omc` 잔여물 삭제** — `app/admin/(main)/proposals/[id]/.omc` 2곳 삭제 ✅ 2026-07-01
- [ ] **L2. 접근성** — CommonTable 검색 label 미연결·체크박스 aria-label, `ProposalDetailView:628` span→button, 폼 에러 role="alert", prefers-reduced-motion
- [ ] **L3. `FixedMediaView` useMemo 0개** — 배열 참조 불안정 → MapArea 마커 재생성. 팝업 상세 불필요 재요청(225-239)
- [ ] **L4. Contact 상세 state 라우팅** — `ContactView.tsx:121` 뒤로가기 미동작 → URL 라우트
- [ ] **L5. 기타 중복** — 상태배지 3종, 날짜 포맷, INPUT_CLASS 파일별 재정의, Media 죽은 버튼 3개, `useV2Chat.ts` 481줄, `PptDeckViewer` 팔레트 불일치

---

## 진행 순서
1. H1 (전역 에러/로딩 인프라)
2. 저비용·고효과: M1, M2, M3, M4, M9(세션키·baseURL·캐시무효화), L1
3. 거대 컴포넌트 분해: H2 → H3 → M5
4. 중복 제거: M6, M7, M8

## 리뷰 섹션 (진행하며 기록)

### 1차 배치 완료 (2026-07-01) — tsc/lint 통과
- **M1** ProposalDetailView 하드코딩 날짜 → 실데이터(`fmtDateTime(proposal?.updated_at)`)
- **M3** 관리자 계정 폼 비번 `type="text"`→`"password"` (※임시비번 노출 UX 의도였다면 눈 토글로 복원 가능)
- **M4** 어드민 필터 옵션 누락 보정 (proposals "집행 요청", members "휴면")
- **L1** `.omc` 잔여물 2곳 삭제
- **M2** `lib/apiError.ts` 신규 `extractApiError(err, fallback?)`, admin 5곳 통합. 검증 중 BasicInfoTab/InquiryDetailView fallback 문구가 서로 달랐음을 발견 → 인자로 보존. client 3곳은 의미 달라 제외
- **M9** `lib/session.ts` 신규(세션키 통합), `API_BASE_URL` export, `useUpdateProfile` 캐시 무효화

### 남은 큰 항목 (설계 결정 필요 — 착수 전 논의)
- **H1** 전역 에러/로딩 인프라: 라우트 error.tsx/loading.tsx 방식 vs 훅 소비측 isError vs QueryCache 전역 에러 토스트 — 방향 결정 필요
- **H2/H3/M5** 거대 컴포넌트 분해(MapArea/ProposalDetailView/CommonTable): 동작 보존 리팩토링, 범위 큼
- **M6~M8** 컴포넌트 중복/토큰: 디자인 QA와 함께 진행 권장
