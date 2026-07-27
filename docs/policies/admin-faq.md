# 관리자 FAQ 관리 화면 정책서 (UI중심)

> **이 문서는 "이 화면이 어떤 규칙으로 동작하는가"를 정의합니다.**
> 화면을 위→아래 **UI 블록 순서**로 읽습니다. 각 블록은 **"무엇 + 동작 규칙"**만 적고, 디자인(색·여백·컴포넌트 모양)은 Figma에 둡니다. 미정은 줄 안에 `❓`로 표시하고 맨 아래 "미정" 섹션에 한 번 더 모읍니다.

| | |
|---|---|
| **화면** | 관리자 FAQ 관리 (목록 + 등록/상세) · 목록 `/admin/faq` · 상세 `/admin/faq/[id]` · 등록 `/admin/faq/create` |
| **진입** | 관리자 사이드바(LNB) "FAQ" 메뉴 → 목록 · 목록 행 클릭 → 상세 · 목록 우상단 `FAQ 등록` → 등록 |
| **Figma** | [등록 폼 node 1258-2849](https://www.figma.com/design/z4QnuGbOaDJzqd5kyx5Udv/%EC%98%A5%EC%99%B8%EA%B4%91%EA%B3%A0%ED%94%8C%EB%9E%AB%ED%8F%BC?node-id=1258-2849) |
| **상태/작성자** | `draft` · (코드 기반 자동생성) · 2026-07-09 |
| **관련 화면/문서** | [관리자 인증·권한 정책](admin-auth-permissions.md) — `faq` 권한 게이팅 근거 |

---

## 1. 목적
관리자가 사용자용 FAQ(자주 묻는 질문) 콘텐츠를 목록으로 관리하고, 등록·수정·삭제하는 화면이다. FAQ는 문의(inquiry)와 별개인 **정적 콘텐츠**로, 관리자가 직접 입력한다.

- 핵심 사용자: `faq` 권한을 가진 관리자(및 마스터 계정).
- 성공 기준: ❓(미정)

## 2. 권한
조회(목록·상세)는 백엔드에서 **공개 GET**(`GET /faqs`, `GET /faqs/{id}`, 가드 없음)이나, 이 관리자 화면 자체는 관리자 영역(`/admin/*`)에 있어 사이드바 노출·진입이 관리자 인증에 종속된다. 쓰기(등록/수정/삭제)는 **`faq` 권한** 관리자 전용이며 마스터는 권한과 무관하게 전체 허용. **쓰기 엔드포인트는 `/admin/faqs` prefix에 둔다** — 프론트 axios 인터셉터(`lib/api.ts`)가 URL이 `/admin`으로 시작할 때만 관리자 토큰을 실어주기 때문. (2026-07-27 이전엔 쓰기가 공개 `/faqs`에 얹혀 있어 토큰 미첨부 → `HTTPBearer`가 403을 내는 버그가 있었음. 아래 결정 로그 참조.)

| 사용자 | 목록/상세 조회 | 등록/수정/삭제 |
|---|---|---|
| 마스터 계정 | 가능 | 가능(권한 무관) |
| `faq` 권한 보유 관리자 | 가능 | 가능 |
| `faq` 권한 없는 관리자 | 화면상 조회는 가능하나 사이드바에 메뉴 미노출 | API 직접 호출 시 **403** |

- 백엔드 근거: `create_faq`(`POST /admin/faqs`)·`update_faq`(`PATCH /admin/faqs/{id}`)·`delete_faq`(`DELETE /admin/faqs/{id}`)는 `admin_router`에 있고 `Depends(require_permission("faq"))`. 공개 `list_faqs`(`GET /faqs`)·`get_faq`(`GET /faqs/{id}`)는 가드 없음. 관리자 목록 `GET /admin/faqs`도 `faq` 권한 필요.
- 프론트 게이팅은 UX일 뿐 실제 방어는 백엔드 `require_permission`. 상세 규칙은 [관리자 인증·권한 정책](admin-auth-permissions.md) §3 참조.

---

## 3. UI

화면은 **① 목록(`/admin/faq`)** 과 **② 등록/상세 폼(`/admin/faq/create`·`/admin/faq/[id]`)** 두 화면으로 나뉜다. 등록/상세는 같은 `FaqFormView` 컴포넌트를 `mode`(create/edit)로 공유한다.

### 3.0 목록 — 페이지 헤더
- **기능**: 화면 제목 `FAQ 관리` 표시.
- **규칙**: 정적 텍스트.

### 3.1 목록 — 검색/필터 바
- **기능**: 목록을 유형·제목 키워드·기간으로 필터링.
- **규칙**:
  - 검색 옵션 3개: `기간`(dateRange) · `유형`(select) · 키워드(text, placeholder "검색조건을 입력해주세요").
  - **유형 select 옵션**: `이용 안내`, `매체검색&제안서` (프론트 `FAQ_TYPE_OPTIONS` 고정 2종).
  - 필터링은 **클라이언트 측**에서 수행: `useFaqs()`가 전체 FAQ를 한 번에 조회하고, 유형 완전일치 + 제목 부분일치(`title.includes(keyword)`)로 거른다. 서버 쿼리 파라미터(`faq_type`) 재조회는 사용하지 않는다.
  - **`기간`(dateRange) 필터는 UI에만 있고 실제 필터 로직에 적용되지 않는다** ❓ — 선언되어 있으나 `filtered` 계산에서 사용 안 함.
  - 키워드는 **제목만** 검색(내용·작성자 미포함).

### 3.2 목록 — 상단 바 + 등록 버튼
- **기능**: 총 건수/페이지 크기 컨트롤 + 우상단 `FAQ 등록` 진입 버튼(CommonTable `topRightContent`).
- **규칙**:
  - 총건수는 필터 후 행 수(`filtered.length`).
  - `usePageSizeSelect` + `pageSize={10}` — 기본 10개씩 보기, 페이지 크기 select 제공.
  - `FAQ 등록` 클릭 시 `/admin/faq/create`로 이동.

### 3.3 목록 — 표(CommonTable)
- **기능**: FAQ 목록을 표로 표시, 행 클릭 시 상세 이동.
- **규칙**:
  - 컬럼: `No` · `유형` · `제목` · `작성자` · `작성일`.
  - **`No`는 저장 값이 아니라 현재 필터된 목록의 1-based 순번**(`String(i + 1)`). 정렬/필터에 따라 변동.
  - **작성일**: `created_at`의 앞 10자(`YYYY-MM-DD`)만 표시.
  - **작성자**: `author` 값, 없으면 `-`.
  - 정렬: 서버가 `sort_order` → `created_at` 순으로 반환(프론트는 그 순서를 그대로 사용, 별도 재정렬 없음).
  - 행 클릭 시 `/admin/faq/{id}`로 이동.

### 3.4 등록/상세 — 페이지 헤더
- **기능**: 화면 제목 표시.
- **규칙**: 등록(create) 모드 `FAQ 등록`, 상세(edit) 모드 `FAQ 상세`.
- 상세 모드에서 상세 데이터 로딩 중에는 본문 대신 `불러오는 중...` 표시.

### 3.5 등록/상세 — 메타 정보(작성자·작성일)
- **기능**: 작성자/작성일을 읽기 전용으로 표시.
- **규칙**:
  - 2개 항목: `작성자`, `작성일`. 둘 다 값 없으면 `-`.
  - **등록(create) 모드에서는 detail이 없어 둘 다 `-`.**
  - 작성일은 `created_at` 앞 10자.
  - **작성자는 생성 시점 관리자 이름 스냅샷**: 서버가 `create_faq`에서 `admin.name`을 `created_by_name` 컬럼에 저장. 응답의 `author`는 `created_by_name`을 우선하고, 비어 있으면 현재 연결된 `creator.name`(라이브 조회)을 fallback으로 사용. → 작성자 이름은 계정명이 바뀌어도 등록 당시 이름이 유지되는 것이 기본.

### 3.6 등록/상세 — 입력 폼
- **기능**: FAQ 제목·유형·내용 입력.
- **규칙**:
  - 필드 3개 모두 **필수(라벨에 `*`)**: `제목`(text) · `유형`(select) · `내용`(textarea).
  - **라벨 정렬**(Figma node 1258-2849 기준): 라벨 텍스트는 왼쪽, `*`는 라벨 컬럼 **오른쪽 끝(입력란 직전)**에 우측 정렬(`FieldLabel`은 `justify-between`). 라벨은 필드 높이 밴드(`h-[44px]`)에 수직 중앙 정렬 → `내용`처럼 필드가 tall(textarea)이어도 라벨이 첫 줄과 맞음. 제목·유형·내용의 `*`가 세로로 정렬됨.
  - **유형 select**: 옵션 `이용 안내`, `매체검색&제안서` (목록 필터와 동일 `FAQ_TYPE_OPTIONS`), placeholder "유형 선택".
  - **제목**: 서버 검증 `min_length=1`, `max_length=300`(프론트는 별도 maxlength 미지정 ❓).
  - **내용**: textarea, 서버 검증 `min_length=1`, 최대 길이 제한 없음(Text 컬럼).
  - 상세(edit) 모드는 기존 값으로 초기화, 등록(create) 모드는 빈 값.
  - **`is_published`(노출 여부)와 `sort_order`(정렬 순서)는 이 폼에 입력 UI가 없다.** 백엔드/DB에는 존재(기본 `is_published=true`, `sort_order=0`)하나 관리자 화면에서 노출/순서를 조절하는 수단이 없음 → 등록되는 FAQ는 항상 공개(true)·순서 0. ❓ (노출 토글·순서 조정 UI 필요 여부 미정)

### 3.7 등록/상세 — 액션 버튼
- **기능**: 목록 이동 / 등록·저장 / 삭제.
- **규칙**:
  - 좌측 `목록` 버튼: `/admin/faq`로 이동.
  - **등록(create) 모드**: 우측 `등록` 버튼 1개.
    - 필수값(제목·유형·내용 trim 후) 누락 시 alert "제목·유형·내용은 필수입니다." 후 중단.
    - 성공 시 `POST /admin/faqs`(payload: title·faq_type·content·`created_by=me?.id`), alert "등록이 완료되었습니다." **후 목록으로 이동**.
  - **상세(edit) 모드**: 우측에 `삭제` + `저장` 버튼.
    - `저장`: `PATCH /admin/faqs/{id}`(title·faq_type·content), alert "저장이 완료되었습니다." **후 목록으로 이동하지 않고 현재 화면 유지**.
    - `삭제`: confirm("삭제하시겠습니까? / 삭제된 FAQ는 복구할 수 없습니다.") → 확인 시 `DELETE /admin/faqs/{id}` → alert "삭제가 완료되었습니다." → 목록으로 이동.
  - 저장/등록 진행 중(`isPending`) 버튼 disabled.
  - 실패 시 alert에 `extractApiError(err)` 메시지 표시(예: 권한 없는 관리자 403).
  - **payload에 `created_by`만 보내고 작성자 이름은 서버가 토큰의 `admin.name`으로 스냅샷**하므로, 프론트가 보낸 `created_by`(=me.id)와 무관하게 실제 이름 저장은 서버 주도.

---

## 4. 화면 상태

| 상태 | 발생 조건 | 노출 / 동작 |
|---|---|---|
| 목록 로딩 | `useFaqs()` 대기 | `data` undefined → 빈 목록으로 처리(별도 로딩 UI ❓) |
| 목록 성공 | 데이터 있음 | 표에 행 렌더 |
| 목록 결과 없음 | 필터 결과 0건 / 데이터 0건 | 표 빈 상태(CommonTable 기본, 별도 카피 ❓) |
| 상세 로딩 | edit 모드, `useFaq` 대기 | `불러오는 중...` 텍스트 |
| 등록 폼 | create 모드 | 빈 폼, 메타는 `-` |
| 저장/등록 중 | mutation `isPending` | 제출 버튼 disabled |
| 처리 실패 | mutation 예외 | alert에 API 에러 메시지 |

---

## 5. 데이터 & 연동

| 항목 | 출처 / 연동 | 트리거 · 비고 |
|---|---|---|
| FAQ 목록 | `GET /faqs` (`useFaqs`, staleTime 30s) | 목록 진입 시 전체 조회, 필터는 클라이언트 |
| FAQ 상세 | `GET /faqs/{id}` (`useFaq`, `enabled: !!id`) | edit 모드 진입 시 |
| 등록 | `POST /admin/faqs` (`useCreateFaq`) | `require_permission("faq")` · 작성자 이름 = 토큰 `admin.name` 스냅샷 |
| 수정 | `PATCH /admin/faqs/{id}` (`useUpdateFaq`) | `require_permission("faq")` · 부분 업데이트(`exclude_unset`) |
| 삭제 | `DELETE /admin/faqs/{id}` (`useDeleteFaq`) | `require_permission("faq")` · 204 |
| 현재 관리자 | `useAdminMe()` | 등록 시 `created_by`에 `me.id` 전달 |

- 뮤테이션 성공 시 `faqsKeys.all`(`["faqs"]`)을 invalidate → 목록·상세 모두 자동 갱신. **주의**: 관리자 목록 쿼리 키는 `["faqs","admin","list",params]`(`adminList`)라, 과거처럼 `faqsKeys.list()`(`["faqs","list"]`)만 무효화하면 prefix 불일치로 관리자 목록이 리패치되지 않는다(등록/삭제 후 목록 미갱신 버그의 원인). 반드시 `all`로 무효화.
- DB 모델(`faq`): `created_by`는 admin FK(**admin 삭제 시 SET NULL**), `created_by_name`은 이름 스냅샷 컬럼.

---

## 6. 미정 (Open Questions / 결정 로그)

**미결정**
- [ ] Figma 노드 링크(목록·상세) — 등록 폼(1258-2849)만 확인됨.
- [ ] `기간`(dateRange) 검색이 UI에만 있고 실제 필터에 적용되지 않음 — 의도된 미구현인지, 서버/클라이언트 어디서 적용할지.
- [ ] `is_published`(노출 여부)·`sort_order`(정렬 순서) 관리 UI 부재 — 관리자가 FAQ 비공개 처리/순서 조정을 해야 하는지, 필요하면 폼에 컨트롤 추가 여부.
- [ ] 저장(edit) 후 화면 유지 vs 목록 이동 — 등록은 목록 이동, 수정은 현재 화면 유지로 동작 상이. 의도 확인 필요.
- [ ] 제목 프론트 입력 길이 제한(서버 300자와 일치시킬지) 및 목록 로딩/빈 상태 카피.
- [ ] 목록 키워드 검색 범위(현재 제목만) — 내용/작성자 포함 여부.

**결정됨**
- 2026-07-27 — **쓰기 API를 `/admin/faqs`로 이동**(등록/수정/삭제). 기존 공개 `/faqs`에 얹혀 있어 프론트 인터셉터가 관리자 토큰을 안 실어줘 마스터 포함 전원 403(HTTPBearer "Not authenticated")이 나던 버그 수정. 백엔드 `admin_router`로 이동 + 프론트 `faqsApi` 호출 경로 변경. §2·§3.7·§5 참조.
- 2026-07-27 — **등록/삭제 후 목록 미갱신 수정**. 뮤테이션 invalidate 대상을 `faqsKeys.list()`→`faqsKeys.all`로 변경(관리자 목록 키 `["faqs","admin","list"]`가 prefix 불일치로 무효화 안 되던 문제). §5 참조.
- 2026-07-27 — **등록 폼 라벨 정렬 Figma 반영**(node 1258-2849). `*`를 라벨 컬럼 우측 끝으로 정렬(`FieldLabel` `justify-between`), 라벨을 `h-[44px]` 밴드 중앙 정렬해 `내용` 라벨이 textarea 첫 줄과 맞도록 수정. 단일행 필드 라벨 정렬은 `items-center`로 통일(형제 폼 AccountFormView 관례 일치). §3.6 참조.
