# 퍼블리싱 QA — 수정 항목

> 2026-06-19 QA. 하나씩 수정하며 체크.

## LNB (사이드바) ✅ 완료
- [x] 1. 네비 항목 hover 시, 페이지명 노출 UI 추가 (collapsed 상태 툴팁)
- [x] 2. 네비 항목 hover 컬러: primary opacity → **platinum-50** (선택=platinum-100)
- [x] 3. 네비 항목 클릭 시, LNB open 상태로 페이지 이동 (localStorage로 open 유지)
- [x] 4. LNB close에서 로고 hover 시 → 드로어 아이콘으로 변경 + platinum-50
- [x] 5. LNB open에서 로고·드로어 아이콘 hover 시 → platinum-50
- [x] 6. LNB open "로그인/회원가입" 버튼 텍스트·아이콘 중앙 정렬

## 홈 화면
- [x] 7. AI 매체 추천 아이콘 disabled일 때 → primary로 변경 (AiSearchArea disabled:opacity-50 제거)

## 고정 매체 — 매체 검색
- [x] 8. 매체 검색 list-item 카드 클릭 시 gray-50 적용 (MediaItem selected→bg-grey-50, FixedMediaView selectedId 전달). ※라이브검증은 faq WIP 빌드에러로 보류
- [~] 9. ~~필터 open UI absolute~~ → 취소(현 상태 유지)
- [x] 10. 연령대 비율 ~10/60~ → 화살표 아이콘(ArrowUpIcon, under=↓/over=↑) 적용 (AgeBarChart, 드로어+매체상세 공용)

## 매체 상세
- [x] 11. 유동 인구 데이터 원형·막대 가로 나열 시 세로 중앙정렬 (컨테이너 items-start→items-center)

## 이동·지역 매체
- [x] 12. 매체 카드 클릭 시 gray-50 적용 (MovingMediaCard selected→bg-grey-50)
- [x] 13. 유동 인구 데이터 삭제 (MediaDetailContent hidePopulation, MovingView 전달)

## 회사 & 서비스 소개
- [x] 14. 경쟁사 비교 외곽 grid grid-cols-2 → flex(items-stretch, 컬럼 flex-1)

## 제안서 상세
- [x] 15. 제안서 삭제 모달 "삭제" 버튼 → 흰 배경+red-400 보더/글자 (useConfirm destructive 옵션 추가, red-400 토큰 추가, Figma 1376-103560)

## 문의하기 — 자주 묻는 질문
- [x] 16. 리스트 디폴트 close (FaqPanel openIds 빈 Set으로 이미 close 상태 — 확인)
