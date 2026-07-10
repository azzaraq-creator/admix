# ADMIX 옥외광고 추천 플랫폼 — 데이터베이스 설계서

| | |
|---|---|
| **DB** | PostgreSQL (AWS RDS) |
| **백엔드** | Python |
| **데이터 출처** | `ADMIX_최종본_v3.xlsx` (913 매체 × 276 컬럼, 기준일 2026-06) |
| **상태/작성자** | draft · LaLa · 2026-06-16 |
| **다이어그램** | [`admix-erd.mermaid`](./admix-erd.mermaid) |

이 문서는 두 도메인을 다룬다. **매체 도메인**은 엑셀(`ADMIX_최종본_v3.xlsx`)을 정규화한 추천 데이터이고, **플랫폼 도메인**은 홈 화면 정책서(`docs/policies/home.md`)에서 도출한 서비스 운영 데이터(회원·관리자·AI채팅·제안서·FAQ)다.

---

## 1. 설계 원칙

- **엑셀 276컬럼은 한 행(매체) 기준으로 펼쳐져 있다.** 그중 `plan1~plan5`(124컬럼)와 `prop1~prop5`(40컬럼)는 반복 그룹이므로 각각 `media_plan`, `media_property` 자식 테이블로 정규화한다.
- **라벨 5종(IND·PRD·TGT·OBJ·LOC)** 은 사전 시트(`03_사전`, `04_상권프로필`)에 코드 체계가 정의돼 있다. 사전을 마스터 테이블로 두고, 매체와는 우선순위(rank)를 가진 M:N 조인 테이블로 연결한다.
- **파생 컬럼**(`final_grade`, `quality_score`, `execution_status` 등)은 추천 엔진 산출 결과이므로 매체 테이블에 그대로 보존하되, 산식은 `02_기준` 시트 기준으로 배치 재계산한다(테이블화하지 않음).
- **자연키 사용**: `media.media_id`(예 `BB-0001`), 라벨 코드(`IND-01`)는 의미 있는 자연키이므로 PK로 사용한다. 원천 연동키 `detail.id`는 `source_detail_id`로 별도 보존(UNIQUE).
- **타입**: PostgreSQL 기준. 금액은 `BIGINT`(원, KRW 단일), 비율/좌표/점수는 `NUMERIC`, 다값·중첩 원천 필드는 `JSONB`, Y/N 플래그는 `BOOLEAN`.

---

## 2. 매체 도메인

### 2.1 `media` — 매체 마스터 (중심 테이블)

엑셀 한 행 = 한 매체. 반복그룹·다값 라벨·유동인구를 제외한 단일값 컬럼을 보관한다.

| 컬럼 | 타입 | 엑셀 원본 | 비고 |
|---|---|---|---|
| `media_id` | varchar PK | `media_id` | 대분류 접두 2자 + 4자리 일련번호 |
| `source_detail_id` | bigint UNIQUE | `detail.id` | 원천 연동키 |
| `name` | varchar | `detail.name` | |
| `second_name` | varchar | `detail.secondName` | 동일명 매체 구분(표시명 = name + ' ' + second_name) |
| `building_name` | varchar | `detail.buildingName` | |
| `category_small` | varchar | `detail.mediaItemCategory.displayValue` | 소분류 |
| `category_large` | varchar | `…parentCategory.displayValue` | 대분류 |
| `category_id` | int | `detail.mediaItemCategory.id` | |
| `parent_category_code` | varchar | `…parentCategory.code` | |
| `ooh_type` | varchar | `detail.oohType` | |
| `exposure_type` | varchar | `detail.exposureType` | |
| `sales_type` | varchar | `sales_type` | 판매유형 요약(파생) |
| `media_source` | varchar | `media_source` | 매체 출처(파생) |
| `loc_code` | varchar FK | `market_loc_code` | → `location_label` |
| `market_profile_id` | bigint FK | (매핑) | → `market_profile`, `market_area`/별칭 기준 매핑(nullable) |
| `market_area` | varchar | `market_area` | 상권 호칭(파생) |
| `market_dong` | varchar | `market_dong` | |
| `legal_dong` | varchar | `legal_dong` | |
| `accurate_address` | varchar | `accurate_address` | |
| `full_address_jibun` | varchar | `full_address_jibun` | |
| `address` | varchar | `detail.address` | 원천 주소 |
| `address_detail` | varchar | `detail.addressDetail` | |
| `district` | varchar | `detail.district` | 구/군 |
| `city` | varchar | `detail.city` | |
| `latitude` / `longitude` | numeric | `detail.latitude` / `detail.longitude` | |
| `market_keyword` | varchar | `market_keyword` | 원천 상권명 |
| `moving_location_detail` | varchar | `detail.movingLocationDetail` | 이동매체 위치상세 |
| `audience_summary` | text | `audience_summary` | 오디언스 요약(파생) |
| `min_advertisement_fee_krw` | bigint | `min_advertisement_fee_krw` | KRW 단일 |
| `max_advertisement_fee_krw` | bigint | `max_advertisement_fee_krw` | |
| `min_production_fee_krw` | bigint | `min_production_fee_krw` | |
| `max_production_fee_krw` | bigint | `max_production_fee_krw` | |
| `production_fees_summary` | text | `production_fees_summary` | |
| `any_production_fee_yn` | boolean | `any_production_fee_yn` | |
| `plan_count` | int | `plan_count` | `media_plan` 행 수와 일치 |
| `execution_status` | varchar | `execution_status` | 집행가능상태(파생, §02) |
| `lead_time_bizdays` | int | `lead_time_bizdays` | 리드타임(파생, §11) |
| `device_quantity` | int | `detail.deviceQuantity` | |
| `surface_quantity` | int | `detail.surfaceQuantity` | |
| `media_shape` | varchar | `detail.mediaShape` | |
| `media_shape_summary` | text | `detail.mediaShapeSummary` | |
| `properties_count` | int | `properties_count` | `media_property` 행 수 |
| `properties_summary` | text | `properties_summary` | |
| `properties_extra_json` | jsonb | `properties_extra_json` | 6번째 이상 속성 |
| `final_grade` | char(1) | `final_grade` | S/A/B/C/D, 기본 정렬키 |
| `feature` | varchar | `feature` | 분류특성(파생) |
| `quality_score` | numeric | `quality_score` | 0~100 |
| `gangnam_dong_grade` | char(1) | `gangnam_dong_grade` | 강남3구 전광판/빌보드만(nullable) |
| `gangnam_grade_reason` | text | `gangnam_grade_reason` | |
| `grade_method` | varchar | `grade_method` | 등급 산출 방식 태그 |
| `grade_evidence` | text | `grade_evidence` | 등급 근거 |
| `area_evidence` | text | `area_evidence` | 상권 근거 |
| `ind_evidence` | text | `ind_evidence` | 업종 근거 |
| `thumbnail_url` | varchar | `thumbnail_url` | |
| `image_count` | int | `image_count` | `media_image` 행 수 |
| `is_newly_built_yn` | boolean | `detail.isNewlyBuiltYn` | |
| `is_popular_yn` | boolean | `detail.isPopularYn` | |
| `popular_type` | varchar | `detail.popularType` | |
| `special_remarks` | text | `detail.specialRemarks` | |
| `children_count` | int | `detail.childrenCount` | |
| `device_type` | varchar | `detail.deviceType` | |
| `description` | text | `detail.description` | |
| `markers_vo` | jsonb | `detail.markersVo` | |
| `properties_type` | varchar | `detail.propertiesType` | |
| `road_view_heading/latitude/longitude/pitch` | numeric | `detail.roadView*` | 로드뷰 4필드 |
| `map_bounds_vo` | jsonb | `detail.mapBoundsVo.*` | 북동/남서 4좌표 결합 |
| `recommended_media_items` | jsonb | `detail.recommendedMediaItems` | 원천 추천매체 |
| `list_labels` | jsonb | `list.labels` | 원천 라벨(L) |
| `company_media_id` | bigint | `detail.companyMediaId` | |
| `company_mapper_user_id` | bigint | `detail.companyMapperUserId` | |
| `source_created_at` | timestamptz | `detail.createdAt` | 원천 생성 |
| `source_updated_at` | timestamptz | `detail.updatedAt` | 원천 수정 |
| `created_at` / `updated_at` | timestamptz | (시스템) | 적재/갱신 시각 |

> **흡수·보류 컬럼**: `detail.productMaster`, `detail.propertiesVo`, `detail.featureCollectionVo.features`, `detail.mediaItemChildrenQuantitiesSummaryVo`, `detail.mediaItemImages`(→ `media_image`로 분해), `list.*`(building_name·media_item_snapshot·media_shape·product_master_id·product_master_types) 등 원천 중복/스냅샷성 컬럼은 운영상 필요 없으면 적재 생략하거나 `properties_extra_json`/별도 raw 적재로 보존한다. (§6 미정 참조)

### 2.2 `media_plan` — 판매 플랜 (1:N)

엑셀 `plan1~plan5` (124컬럼)를 행으로 정규화. `(media_id, plan_no)` UNIQUE.

`product_name`, `product_display_name`, `product_master_type`, `contractual_duration`, `contractual_duration_type`, `advertisement_fee`, `is_advertisement_fee_yn`, `production_fee`, `is_production_fee_yn`, `exposure_duration_seconds`, `exposure_count`, `broadcasts_count_auto`, `broadcasts_count_manual`, `ooh_type`, `ooh_kind_type`, `default_device_type`, `default_device_quantity`, `default_surface_quantity`, `active_device_type`, `active_device_quantity`, `active_surface_quantity`, `pm_count`, `operation_day_of_week`, `operation_start_time`, `operation_end_time`, `operation_hours`.

> 플랜별 채움률: plan1 913 → plan2 230 → plan3 69 → plan4 34 → plan5 10건. 즉 매체당 1~5개 플랜.

### 2.3 `media_property` — 규격/속성 (1:N)

엑셀 `prop1~prop5` (40컬럼)를 행으로 정규화. `(media_id, prop_no)` UNIQUE.

`property_key`, `display_value`, `property_value`, `property_unit`(METER/CM/MM), `property_width_value`, `property_height_value`, `device_quantity`, `surface_quantity`.

> 면적(㎡) 산출: 가로×세로 후 단위변환 (METER=㎡, CM ÷1e4, MM ÷1e6). 등급 산식의 규격 점수에 사용.

### 2.4 `media_image` — 이미지 (1:N)

`detail.mediaItemImages` / `all_image_urls` / `list.image`를 URL 단위로 분해. 컬럼: `image_url`, `sort_order`, `is_thumbnail`. `media.thumbnail_url`은 대표값 캐시.

### 2.5 `audience_stat` — 유동인구 (1:1)

엑셀 `detail.movingPopulationVo.*` (16컬럼). PK=`media_id`. 서울 열린데이터광장 일평균(06~24시) 기준, 517/913 매체만 보유.

`area_nm`, `forecast_date`, `job_ymd`, `message`, `moving_population_count`, `total_moving_population_count`, `female_population_rate`, `male_population_rate`, `rate_teen_older`, `rate_twenty`, `rate_thirty`, `rate_forty`, `rate_fifty`, `rate_tg_sg_older`(30대 이상 누적), `rate_fg_older`(고령여성), `rate_sg_over`(고령남성).

### 2.6 라벨 마스터 + 조인 (M:N, 우선순위)

엑셀 라벨 컬럼은 `①IND-05 명품·럭셔리 / ②IND-03 화장품·뷰티 …` 형태로 **우선순위가 매겨진 다값**이다. 파싱하여 코드·순위(·티어)로 분해한다.

| 마스터 | 출처 | 조인 테이블 | 비고 |
|---|---|---|---|
| `industry_label` (IND-01~28) | `03_사전` 업종 | `media_industry`(media_id, industry_code, rank) | |
| `product_label` (PRD-01~32) | `03_사전` 제품 | `media_product`(media_id, product_code, rank) | |
| `target_label` (TGT, 30종) | `03_사전` 타깃 | `media_target`(media_id, target_code, rank, **tier**) | tier=[B]행동·[L]라이프·[P]직업·[D]데모 |
| `objective_label` (OBJ, 15종) | `03_사전` 목적 | `media_objective`(media_id, objective_code, rank) | |

마스터 공통 컬럼: `code`(PK), `label`, `search_keywords`(자동 매칭), `examples`(LLM 컨텍스트), `note`.

### 2.7 `location_label` + `market_profile`

- **`location_label`** (LOC-01~50): `loc_code` PK, `label`. 매체 `loc_code` FK 대상인 50개 광역 지역 라벨.
- **`market_profile`** (`04_상권프로필`, ~72행): 상권 단위 프로필. `name`, `region`, `loc_code` FK, `center_lat/lng`, `media_count`, `avg_grade`, `top_industries`(jsonb, 특화업종 top3+배수), `core_targets`, `core_objectives`, `aliases`(jsonb, 검색 매칭용 별칭 목록).
- 다수 상권이 같은 LOC를 공유한다(예: 회현·명동·충무로·을지로 = LOC-17). 매체→상권 매핑은 `market_area`/별칭 기준이라 일부 매칭 누락 가능 → `market_profile_id` nullable.

---

## 3. 플랫폼 도메인

홈 정책서(`home.md`) + 어드민 상세 화면(Figma)에서 도출. 어드민 IA: 대시보드 · 광고매체 관리 · 회원 관리 · AI채팅 관리 · 비즈니스 관리(제안 관리/문의 관리) · FAQ 관리 · 계정 관리.

### 3.1 `member` — 회원 (회원 상세 > 기본 정보)
이메일/비번 + 소셜(카카오·네이버). `membership_type`은 `individual`(개인) / `corporate`(기업) 2종이고, 기업의 사업자 등록 여부·검증 상태는 `business_registration`(3.2)으로 분리한다.

| 채팅 토큰 한도 | 대상 | 판정 기준 |
|---|---|---|
| 5 | 비회원 | `member` 없이 `chat_session.guest_token`으로 추적 |
| 30 | 개인회원 | `membership_type='individual'` |
| 100 | 기업(사업자 미등록) | `corporate` + `business_registration.status≠'verified'` |
| 무제한 | 기업(사업자 등록 완료) | `corporate` + `business_registration.status='verified'` |

컬럼: `email`(UK), `password_hash`(소셜시 null), `name`, `phone`, `membership_type`, **`company_name`(회사명)**, **`position`(직책)**, **`industry`(업종)**, **`marketing_consent`(마케팅 수신 동의)**, `chat_tokens_used`, `chat_tokens_reset_at`, `social_provider`, `social_id`, `status`(active/dormant/sanctioned/withdrawn), **`admin_memo`(운영자 메모)**, **`withdrawn_at`(탈퇴일)**, `last_login_at`, `created_at`(가입일), `updated_at`.

> 회원 상세 헤더의 **제안 건수 / 문의 건수**는 `proposal` / `inquiry` count로 집계(저장 컬럼 불필요).

### 3.2 `business_registration` — 사업자 등록 정보 (1:1, 회원 상세 우측)
기업 회원의 사업자 정보. `member_id` FK(UNIQUE). `status`(unregistered 미등록 / reviewing 심사중 / verified 등록 / rejected 반려), `business_name`(사업자명), `business_registration_no`(사업자등록번호), `address`(주소), `business_type`(사업의 종류=업태/종목), `reject_reason`(반려 사유), `license_file_url`(사업자등록증 저장 경로), `license_file_name`(업로드 원본 파일명), `license_uploaded_at`(업로드 시각), `verified_at`. (파일명·업로드시각 컬럼은 마이그 032 추가.)

### 3.3 `member_sanction` — 회원 제재 (회원 상세 > 제재 관리 탭)
제재 이력. `member_id` FK, `reason`(제재 사유, 예: "서비스 규제 위반"), `start_date`(제재 일자), `end_date`(제재 종료, 영구시 null), `created_by` FK→`admin`(처리 관리자), `created_at`. 활성 제재가 있으면 `member.status='sanctioned'`.

### 3.4 `admin` — 관리자 + `admin_permission` (계정 관리 > 계정 생성)
- **`admin`**: `email`(UK, 로그인 ID), `password_hash`, `name`, `account_type`(계정 유형/role), `department`(부서/역할), `phone`, `status`(active/disabled), `last_login_at`.
- **`admin_permission`**: 메뉴 단위 접근 권한 체크박스. `(admin_id, menu_key)` 복합 PK. `menu_key` ∈ `dashboard` · `media` · `member` · `business` · `faq` · `account`.

### 3.5 AI 채팅 — `chat_session` / `chat_message` / `chat_recommendation` (AI채팅 관리)
어드민 AI채팅 관리는 회원별로 **대화방 수 · 메시지 수 · 마지막 사용일**을 집계해 보여주고, 상세에서 회원의 세션 목록 → 세션 클릭 시 채팅 전문을 표시한다.

- **`chat_session`**: `member_id`(nullable, 비회원), `guest_token`, `mode`(ai_recommend/search), `title`, **`last_used_at`(마지막 사용일)**, 타임스탬프. → 회원별 대화방 수 = 세션 count.
- **`chat_message`**: `session_id` FK, `sender`(user/ai), `content`(채팅 전문), `token_cost`(발화 1회=1 차감), `status`(ok/error/blocked). → 메시지 수 = 메시지 count.
- **`chat_recommendation`**: AI 응답 메시지가 추천한 매체(M:N). `message_id` FK, `media_id` FK, `rank`, `reason`.

### 3.6 제안서 — `proposal` / `proposal_item` (제안 관리 + 내 제안서)
어드민 제안 관리/회원 상세 제안 이력 공용. 상태: `cancelled`(취소) / `new`(신규) / `custom`(맞춤제안=역제안) / `execution_requested`(집행요청) / `contracted`(계약완료).

- **`proposal`**: `member_id` FK, `title`(제안서명), `status`, `media_count`(매체 수 캐시), `total_amount`(전체 금액 합계), `memo`, **`counter_proposal_file_url`(역제안 PPT 첨부)**, `counter_proposal_by` FK→`admin`, `counter_proposal_at`, `created_at`(등록일).
  - **역제안 처리**: 관리자가 회원 제안에 대해 맞춤제안을 올릴 때, 별도 항목 편집 없이 **PPT 파일 첨부**(`counter_proposal_file_url`)로 대체. 상태는 `custom`.
- **`proposal_item`**: `proposal_id` FK, `media_id` FK, `media_plan_id` FK(선택 플랜, nullable), `quantity`, `price_snapshot`(담을 당시 광고비), `sort_order`.

### 3.7 `faq` — 자주 묻는 질문 (FAQ 관리 > FAQ 등록)
`faq_type`(유형), `title`(제목), `content`(내용), `sort_order`, `is_published`(노출 여부), `created_by` FK→`admin`(작성자), `created_at`(작성일), `updated_at`. **문의(`inquiry`)와는 완전 별개**의 정적 콘텐츠.

### 3.8 `inquiry` — 문의 (문의 관리 > 문의 상세, 고객↔관리자 문답)
고객이 남긴 문의에 관리자가 답변. `member_id`(nullable, 비회원), `name`(문의자), `email`, `phone`(전화번호), `company`(회사), `subject`(문의 제목), `content`(문의 내용), `status`(pending 답변대기 / answered 답변완료), `answer`(답변 내용), `answered_by` FK→`admin`(답변자), `answered_at`(답변 일시), `created_at`(제출일).

---

## 4. 관계 요약

```
media 1—N media_plan / media_property / media_image
media 1—1 audience_stat
media N—1 location_label · N—1 market_profile (nullable)
media N—M industry_label/product_label/target_label/objective_label (rank, tier)
location_label 1—N market_profile

member 1—1 business_registration · 1—N member_sanction
member 1—N chat_session 1—N chat_message 1—N chat_recommendation N—1 media
member 1—N proposal 1—N proposal_item N—1 media (선택 plan N—1 media_plan)
member 1—N inquiry
admin 1—N admin_permission · 1—N member_sanction(처리) · 1—N proposal(역제안) · 1—N faq · 1—N inquiry(답변)
```

---

## 5. 컬럼 매핑 정합성

엑셀 276컬럼 = 기본 단일값 96 + 플랜 반복 124(→ `media_plan`) + 규격 반복 40(→ `media_property`) + 유동인구 16(→ `audience_stat`). 96개 단일값은 `media`(다수) / 라벨 5종(→ 마스터+조인) / 이미지(→ `media_image`)로 배분 완료. 누락 없음.

---

## 6. 미정 (Open Questions)

- [ ] **채팅 토큰 리셋 주기**(누적/월/일)와 비회원→회원 전환 시 잔여 횟수 처리 — `chat_tokens_reset_at` 운영 규칙 확정 필요.
- [ ] **비회원 식별 방식**: `guest_token`을 쿠키/디바이스/세션 중 무엇으로 발급·유지할지.
- [ ] **`market_profile_id` 매핑 정확도**: `market_area` 문자열 매칭 실패분 처리(수동 보정 vs nullable 유지).
- [ ] **원천 스냅샷·중복 컬럼**(`detail.productMaster`, `list.*`, `featureCollectionVo` 등) 적재 여부 — 운영 화면에서 실제 사용되면 컬럼/테이블 추가.
- [ ] **파생 컬럼 재계산 파이프라인**: `final_grade`/`quality_score`/`execution_status`/`lead_time_bizdays` 배치 주기와 트리거(`02_기준` 산식 기준).
- [ ] **소셜 로그인 콜백·회원가입 단계** 데이터(약관 동의 이력 등) 추가 테이블 필요 여부.
- [ ] **제안서 PDF/공유** 산출물 저장 여부(별도 `proposal_export` 테이블).
- [ ] **`admin_permission` 메뉴 키 확정**: 6개(dashboard/media/member/business/faq/account) 외 세부 권한(읽기/쓰기 구분) 필요 여부.
- [ ] **회원 제재 정책**: 영구/기간 제재 구분, 제재 중 로그인·기능 차단 범위, 자동 해제 처리.
- [ ] **역제안(맞춤제안) PPT**: 파일 저장소(S3 등)·버전 관리, 회원 다운로드 노출 규칙.
- [ ] **사업자 등록 심사 플로우**: `reviewing`→`verified/rejected` 전이 주체(자동 검증 vs 관리자 수동)와 `business_type` 입력 형식(업태/종목 분리 여부).
