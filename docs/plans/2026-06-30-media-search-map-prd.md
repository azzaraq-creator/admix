# 매체검색 지도 영역 검색 + 서버 줌 클러스터링 (PRD)

> ⚠️ **2026-07-28 갱신: 뷰포인트(지도 영역/bbox) 필터 폐지.** 리스트·지도는 이제 **전체 고정매체**를 대상으로 하며, 클러스터링은 `zoom_level`만으로 동작한다. 아래 §2·§3.1·§3.2·§4·§6의 "지도 영역=결과 영역", "현재 위치 검색 버튼", bbox 종속/필수 서술은 **더 이상 유효하지 않다**(역사적 기록으로 보존). 유지된 것: 서버 줌 클러스터링, 강남역 초기 진입, 무한스크롤, 리스트 클릭 줌 포커싱. 현행 정책은 [고정매체 화면 정책서](../policies/fixed.md) §3.4/§3.6 참조.
>
> 2026-06-30 / PRD (구현 완료 기록, 동일자 업데이트: 강남역 기본 진입 · 리스트 클릭 줌 포커싱 · 재검색 선택 해제 · 프로그램 이동 idle debounce)

매체검색(고정, `/fixed` search 모드) 화면에서 지도 기반으로 매체를 탐색하는 기능. 검색어로 지역을 이동하고, 그 지역의 매체를 지도/리스트에 함께 보여주며, 서버 측 줌 클러스터링으로 마커 밀도를 관리한다.

## 1. 목적 / 배경

- 매체검색 모드는 좌측 리스트(매체 카드)와 우측 지도로 구성된다.
- 기존엔 AI 추천 모드에서만 지도 마커가 그려졌고, 검색 모드는 리스트만 있었다.
- 옥외광고 매체는 위치가 핵심 선택 기준이므로, **"특정 지역에서 노출 가능한 매체"를 지도로 탐색**하는 경험이 필요하다.
- 네이버 부동산식 "지도 영역 = 결과 영역" 패턴을 채택하되, **검색으로 정한 영역이 줌으로 흔들리지 않도록** 한다.

## 2. 핵심 사용자 시나리오

0. `/fixed?mode=search`로 **직접 진입** 시 기본 위치(**강남역**)로 지도가 잡히고 그 영역 매체가 표시된다.
1. 사용자가 매체검색 모드에서 검색창에 **"강남역"**(주소/지역/장소명) 입력 → 지도가 강남역으로 이동하고, **그 영역의 매체만** 리스트·지도에 표시된다.
2. 지도를 **줌 인/아웃** → 검색 영역은 그대로 유지된 채 **클러스터 묶음 단위만** 줌에 맞게 재조정된다(결과가 전국으로 확장되지 않는다).
3. 충분히 확대하면 클러스터가 풀려 **개별 핀**으로 표시된다.
4. 클러스터를 **클릭** → 그 클러스터로 줌인하며 하위 영역으로 드릴인된다.
5. 지도를 **드래그(이동)** → **"현재 위치 검색" 버튼**이 떠서, 누르면 현재 보이는 영역으로 결과를 다시 가져온다.
6. 칩 필터(카테고리/가격/매체타입 등)는 지도 영역과 **AND 조건**으로 함께 적용된다.
7. **리스트 아이템 클릭** → 그 매체 위치로 지도가 줌인(레벨 3)되어 포커싱된다. 이때 **리스트(검색 영역)는 고정**되고 지도만 이동한다.
8. 리스트 아이템 선택 상태에서 **재검색**하면 기존 선택/포커스가 해제된 뒤 새 영역으로 검색된다.

## 3. 기능 요구사항

### 3.1 검색 영역(bounding box) 모델
- 결과 영역(bbox)은 **명시적 행동으로만** 설정/변경된다:
  - 검색창 지오코딩(지역 이동)
  - "현재 위치 검색" 버튼(드래그 후 현재 뷰로 재설정)
  - 클러스터 클릭(해당 클러스터 영역으로 드릴인)
  - **`/fixed?mode=search` 직접 진입 시 기본 위치(강남역)로 1회 자동 스코프** (URL에 bbox가 없을 때). AI→검색 토글은 현재 지도 뷰를 초기 영역으로.
- **리스트와 지도 모두** 동일 bbox에 종속된다(리스트=지도 영역).
- **리스트 클릭/줌은 bbox(=리스트)를 바꾸지 않는다** — 영역 변경은 위 명시적 행동만.

### 3.2 줌 동작
- 줌은 **bbox를 바꾸지 않는다.** `zoom_level`만 갱신해 같은 영역을 다시 클러스터링한다.
- 따라서 **줌아웃해도 결과가 검색 영역 밖으로 확장되지 않는다.**
- 줌은 자동 반영(버튼 불필요). 드래그(이동)만 "현재 위치 검색" 버튼으로 처리.

### 3.3 클러스터링
- 서버가 `zoom_level` 기반 그리드로 매체를 묶는다. 셀이 크면(축소) 더 많이 묶이고, 작으면(확대) 잘게 나뉜다.
- 한 셀에 1개면 **개별 마커(핀)**, 2개 이상이면 **클러스터(중심점 + 개수)**.
- **확대 임계 레벨(현재 kakao level 1) 이하**에선 클러스터 없이 개별 핀만 표시.

### 3.4 검색창
- 입력값을 **지오코딩**(장소 키워드 검색 우선 → 주소 검색 fallback)해 지도를 이동시킨다.
- (2026-07-28 갱신) 검색창은 **통합 자동완성**: 입력 시 드롭다운에 장소(카카오 keywordSearch)와 매체(매체명+주소 매칭, `keyword` API) 후보를 함께 노출. `keyword`는 name+second_name+주소(accurate_address/address/full_address_jibun/loc_label)를 합친 문자열에 **공백 토큰별 AND ilike** — 주소가 여러 단어여도 견고하게 매칭.
  - **장소 선택** = 지도 이동 **+ 그 좌표 ±0.02° bbox(neLat/swLat/neLng/swLng)로 리스트·지도 스코프**. 뷰포인트(지도 드래그)로는 스코프가 바뀌지 않고, **오직 장소 선택**으로만 bbox가 설정된다.
  - **매체 선택** = 그 매체 1개로 이동+선택.
  - **초기화(필터바)** = bbox·칩 해제 → 전체 복귀(칩이 남으면 bbox 유지). `applyFilter`가 빈 필터일 때 bbox를 안 싣는 방식.

### 3.5 마커/클러스터 인터랙션
- 개별 마커 클릭 → 매체 팝업(`MarkerMediaPopup`), 카테고리별 마커 아이콘.
- 클러스터 클릭 → 2단계 줌인 + 중심 이동 → 자동 재조회로 분해.

### 3.6 리스트 아이템 클릭 → 줌 포커싱 (리스트 고정)
- 리스트 아이템 클릭 시 그 매체 좌표로 지도를 **줌인(레벨 3) + 센터 이동**.
  - 그 줌에서 개별 핀이면 **확대 포커싱**, 여전히 클러스터면 그 위치(클러스터)가 가운데로.
- **검색 영역(bbox)은 고정** → 리스트는 그대로 유지(`zoom_level`만 갱신해 클러스터 재조정). 리스트가 클릭으로 바뀌지 않는다.
- 이를 위해 리스트 응답(`MediaCardRow`)에 `lat`/`lng` 포함.

### 3.7 재검색 시 선택 해제
- 검색창 지오코딩(재검색) 시 기존 선택 상태(상세 drawer/핀 포커스/마커 팝업)를 **먼저 해제**한 뒤 새 영역으로 이동·커밋.

## 4. 동작 명세 (이동 유형별)

지도 idle 시 이동 유형을 구분해 처리한다.

| 이동 유형 | 트리거 | bbox | zoom | 버튼 |
|---|---|---|---|---|
| `program` | 지오코딩 재검색/클러스터 클릭/기본 진입(프로그램 이동) | 새로 설정(예약된 경우) | 갱신 | 숨김 |
| `zoom` | 사용자 줌 | **고정** | 갱신 → 클러스터 재조정 | 숨김 |
| `drag` | 사용자 드래그(이동) | 변경 안 함 | 변경 안 함 | **노출** |
| 리스트 클릭 | 리스트 아이템 클릭 (program 이동, `rescope=false`) | **고정** | 갱신(레벨3) → 클러스터 재조정 | 숨김 |

**프로그램 이동 idle debounce**: `setCenter`+`setLevel`은 idle을 여러 번(중간 상태 → 최종) 발생시킨다. 프로그램 이동의 연속 idle은 **180ms debounce**해 **최종 settled 상태만** `program`으로 통지한다(중간 상태 오커밋 방지). 사용자 줌/드래그는 즉시 통지(반응성 유지).

## 5. 파라미터 명세

기존 컨벤션대로 2-레이어(브라우저 URL camelCase ↔ API snake_case).

| 브라우저 URL | API 쿼리 | 의미 |
|---|---|---|
| `neLat` | `north_east_latitude` | 북동 위도 |
| `swLat` | `south_west_latitude` | 남서 위도 |
| `neLng` | `north_east_longitude` | 북동 경도 |
| `swLng` | `south_west_longitude` | 남서 경도 |
| `zoom` | `zoom_level` | kakao 지도 레벨(1=최대확대 … 14=최대축소) |

칩 필터: `category`, `oohType`/`ooh_type`, `exposureType`/`exposure_type`, `mediaShape`/`media_shape`, `saleType`/`product_master_type`, `priceMin`/`price_min`, `priceMax`/`price_max`.

## 6. 백엔드 API

### `GET /media/fixed/clusters`
- 필수: `north_east_latitude`, `south_west_latitude`, `north_east_longitude`, `south_west_longitude`, `zoom_level`
- 선택: 칩 필터 일체
- 응답:
  ```json
  {
    "clusters": [{ "lat": 37.50, "lng": 127.01, "count": 75 }],
    "markers": [{ "id": "SB-0002", "lat": 37.50, "lng": 127.04,
                  "name": "...", "categoryLarge": "지하철",
                  "minAdvertisementFeeKrw": 2800000 }]
  }
  ```
- 알고리즘: bbox + 필터로 FIXED 매체 조회 → `zoom_level ≤ 임계치`면 전부 개별 마커 → 아니면 `floor(lat/cell), floor(lng/cell)` 그리드 버킷팅(셀 1개=마커, 2개↑=클러스터 중심점+개수). 페이지네이션 없음(영역 전체).

### `GET /media/fixed` (확장)
- 기존 리스트(페이지네이션) 엔드포인트에 bbox 파라미터(선택) 추가 → 리스트도 지도 영역 종속.
- 응답 `MediaCardRow`에 `lat`/`lng` 추가 → 리스트 클릭 시 그 좌표로 지도 줌인(§3.6)에 사용.

## 7. 클러스터링 튜닝 상수 (backend `media_service.py`)

- `_CLUSTER_CELL_DEG_BASE = 0.0003` — 그리드 셀 기준 크기(도). (2026-07-28 0.0006→0.0003으로 완화: 클러스터가 한 줌 단계 더 일찍 풀림)
- 셀 크기 = `_CLUSTER_CELL_DEG_BASE × 2^(zoom_level − 1)` — 축소(level↑)일수록 셀 커져 더 많이 묶임.
- `_CLUSTER_DECLUSTER_LEVEL = 1` — 이 레벨 이하(최대 확대)에선 클러스터 없이 개별 핀.

## 8. 영향 범위 / 구현

**백엔드**
- `routers/media.py` — `GET /media/fixed/clusters` 신설, `GET /media/fixed`에 bbox 파라미터 추가.
- `services/media_service.py` — `_fixed_base_query`(리스트·클러스터 공통 필터+bbox), `list_fixed_clusters`(그리드 클러스터링 + 확대 임계 declustering), `_media_card`에 `lat`/`lng`.
- `schemas/media.py` — `MediaMarker`, `MediaCluster`, `MediaClusterResponse`, `MediaCardRow`에 `lat`/`lng`.

**프론트엔드** (`app/(client)/(main)/fixed/_components/`, `hooks/media/`)
- `MapArea.tsx` — kakao SDK `libraries=services`(지오코딩), 리스너를 지도 생성과 동시에 부착(첫 idle 포착), `idle`/`zoom_changed`/`dragend`로 이동 유형 판별, **프로그램 이동 idle 180ms debounce(최종 상태만 통지)**, 클러스터 CustomOverlay 렌더(클릭 줌인), `autoFit`(검색 모드 끔), `moveTarget`(이동), `geocodeAddress` 헬퍼(Places→Geocoder fallback), 포커스는 이동·재조회로 늦게 생긴 마커도 잡도록 보강.
- `MediaSearchPanel.tsx` — URL bbox 파싱, 리스트·클러스터 조회를 bbox에 종속, 결과 마커/클러스터 상위 전달, 검색창 제출 시 지오코딩, **리스트 클릭 시 좌표로 줌인(`rescope=false`)**.
- `FixedMediaView.tsx` — 오케스트레이션: 검색 영역 커밋(`commitBounds`), 줌 전용 커밋(`commitZoomOnly` — bbox 고정, 줌/리스트클릭에 사용), 이동 유형별 분기, **기본 진입 강남역 스코프(`scopeDefault`)**, **재검색 시 선택/포커스/팝업 해제**, "현재 위치 검색" 버튼 제어.
- `SearchHereButton.tsx` — "현재 위치 검색" 버튼(Figma).
- `ChatPanel.tsx` — 검색 패널에 `onFocusMedia`/`onMapData`/`onRequestMapMove` 전달, mode controlled.
- `hooks/media/{apis,keys,queries}.ts` — bbox 파라미터, `MediaCardRow` lat/lng, 클러스터 타입/쿼리(`useFixedClusters`).

## 9. 검증

- 백엔드: 작은 bbox(약 200m) → 11건, 전체 → 792건(bbox 필터 동작). 동일 bbox에서 `zoom_level`만 5→7로 바꾸면 클러스터 수 변화(줌 응답성). 필수 bbox 누락 시 422.
- 프론트: tsc/eslint clean.
- 시나리오: "강남역" 검색 → 강남역 영역 매체만 표시, 줌 인/아웃 시 클러스터만 재조정되고 결과는 그 영역에 고정.

## 10. 알려진 한계 / 향후

- ~~검색창은 지역 이동 전용 — 텍스트 키워드 매체 필터(매체명/주소 LIKE)는 추후 옵션.~~ → **2026-07-28 매체명 검색 구현**(장소+매체명 통합 자동완성). 주소→그 주소 매체 활성화는 여전히 추후 옵션.
- 클러스터 버블 비주얼은 기본값(primary teal 원 + 흰 개수). 별도 Figma 디자인 시 교체.
- 리스트 클릭 줌인 레벨(현재 3), 기본 진입 위치(강남역), idle debounce(180ms), 클러스터 셀 크기·확대 임계 레벨은 상수로 튜닝 가능.
- 리스트 클릭 시 그 줌(레벨3)에서도 밀집 지역이면 여전히 클러스터로 묶여 개별 핀 포커싱이 안 될 수 있음(설계상 그 위치 센터링으로 처리).
