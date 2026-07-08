# GA4 애널리틱스 연동 계획 (2026-07-07)

Google Analytics 4(GA4)를 프론트엔드에 연동하기 위한 계획. **코드는 아직 미구현 — 이 문서는 방식·이벤트 설계·운영/동의 처리를 확정하기 위한 설계 문서다.** 배포/env 운영 배경은 [소셜 로그인·배포/운영](2026-07-04-social-login-deploy-ops.md) §3, 도메인/화면은 [CONTEXT.md](../../CONTEXT.md)·[고정매체 정책](../policies/fixed.md)·[AI 매체추천 정책](../policies/ai-media-recommend.md) 참조.

---

## 1. 현황 (검토 결과: 미연동)

레포 전수 확인 결과 GA4는 **전혀 붙어있지 않다.**

| 항목 | 상태 |
|------|------|
| 스크립트 (`gtag`/`dataLayer`/GTM) | 없음 |
| 의존성 (`@next/third-parties`, `react-ga` 등) | 없음 (`frontend/package.json`) |
| 환경변수 (measurement ID) | 없음 (`frontend/.env.local`, `.env.local.example`) |
| 루트 `app/layout.tsx` | analytics 주입 없음 |
| 문서/백엔드 | GA4 계획·정책 없음 |

즉 "기존 구현 검토"가 아니라 **신규 연동**이다. 스택: Next.js **16.2.4** (App Router), React 19.2.4.

---

## 2. 목표 / 범위

- **목표**: 사용자 페이지 이동 + 핵심 전환 행동(검색·AI추천·매체상세·매체담기·제안서·가입/로그인)을 GA4로 계측.
- **범위(포함)**: `app/(client)/**` — 일반 사용자 화면.
- **범위(제외)**: `app/admin/**`(관리자), `app/deck/**`(제안서 뷰어) — 내부/외부공유용이라 사용자 행동 분석 대상 아님. → 스크립트 로드 자체를 client 그룹으로 한정.
- **비목표**: 서버사이드(Measurement Protocol) 전송, GTM 컨테이너 도입은 이번 범위 밖(필요 시 후속).

---

## 3. 연동 방식 (Next.js 16 App Router)

### 3.1 라이브러리
`@next/third-parties/google`의 `<GoogleAnalytics>` 사용 (Next 공식, gtag 로드를 `next/script`로 최적화). 수동 `<Script>` 삽입보다 이 방식 우선.

```bash
npm i @next/third-parties
```

### 3.2 배치 — client 그룹 layout에만
전역 `app/layout.tsx`가 아니라 **`app/(client)/layout.tsx`** 에 넣어 admin/deck 제외. 측정 ID가 있을 때만 렌더(로컬/미설정 환경 자동 비활성).

```tsx
// app/(client)/layout.tsx (개념)
import { GoogleAnalytics } from "@next/third-parties/google";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
// ...
{GA_ID && <GoogleAnalytics gaId={GA_ID} />}
```

### 3.3 page_view (SPA 라우트 이동)
App Router는 클라이언트 네비게이션이라 최초 로드 외 페이지 전환에서 문서 재요청이 없다. 두 가지 중 택1:
- **(A) GA4 향상된 측정(Enhanced Measurement)의 "페이지 변경(브라우저 기록 기반)"에 위임** — 설정만으로 History API pushState를 잡아 SPA page_view 자동 집계. 코드 최소. **1차 권장.**
- (B) `usePathname`+`useSearchParams` 변화 시 수동 `page_view` 전송 — 정밀 제어 필요할 때. (A)로 누락/중복이 관측되면 (B)로 전환.

### 3.4 환경변수
- 신규: `NEXT_PUBLIC_GA_ID` (형식 `G-XXXXXXXXXX`). 기존 `NEXT_PUBLIC_*` 네이밍 컨벤션 준수.
- `.env.local.example`에 키만 추가(값 없이).
- **운영은 Amplify env**에 설정 — 로컬 `.env`에만 넣으면 반영 안 됨([배포/운영](2026-07-04-social-login-deploy-ops.md) §3와 동일 규칙). 로컬은 미설정 → GA 비활성이 기본.

---

## 4. 이벤트 추적 설계

`@next/third-parties/google`의 `sendGAEvent`로 커스텀 이벤트 전송. 이름은 GA4 스네이크케이스, 가능한 곳은 GA4 추천 이벤트명을 재사용.

| 사용자 행동 | 이벤트명 | 주요 파라미터 | 발생 위치(코드) |
|------------|---------|--------------|----------------|
| 위치/필터 검색 | `search` | `search_term`, `filters` | `fixed/_components/MediaSearchPanel.tsx`, `_components/LocationSearchInput.tsx` |
| AI 추천 요청 | `ai_recommend_request` | `session_id`, `query` | `fixed/_components/ChatPanel.tsx` / `AiChatPanel.tsx` |
| AI 추천 결과 노출 | `ai_recommend_result` | `result_count` | 추천 응답 렌더 시 |
| 매체 상세 조회 | `view_item` | `media_id`, `media_name`, `source`(drawer/page/chat) | `common/MediaDetailDrawer.tsx`, `media/[id]` |
| 매체 담기 | `add_to_proposal` | `media_id` | `common/AddToProposalModal.tsx` |
| 제안서 생성 | `create_proposal` | `proposal_id`, `media_count` | `proposals/_components/NewProposalModal.tsx` |
| 회원가입 | `sign_up` | `method`(email/kakao/naver) | `(auth)/signup/_components/SignupForm.tsx` |
| 로그인 | `login` | `method`(email/kakao/naver) | `(main)/_components/LoginModal.tsx`, `oauth/[provider]/callback` |
| 문의 등록 | `submit_inquiry` | `category` | `contact/_components/InquiryModal.tsx` |

> 이벤트/파라미터 최종안은 마케팅·기획과 확정 후 GA4 관리화면에 **맞춤 정의(커스텀 측정기준)** 등록 필요. 위는 코드 기준 초안.

---

## 5. 개인정보 동의 (Consent)

- 한국 PIPA 기준, GA4는 개인정보로 볼 소지가 있는 식별자를 다루므로 **개인정보처리방침에 GA 수집·위탁(구글) 고지** 필요.
- GA4는 IP를 저장하지 않음(기본). `user_id` 등 식별자 전송은 하지 않는 것을 기본으로 한다.
- **Consent Mode v2**: 동의 배너를 도입할지 결정 필요. 도입 시 기본 `denied`→동의 시 `granted`로 `gtag('consent', ...)` 갱신. 미도입(고지만)으로 갈지는 아래 §8 미결정 항목.

---

## 6. 검증 방법

- **GA4 DebugView**: 개발 중 `debug_mode` 파라미터로 실시간 확인.
- **Realtime 보고서**: 배포 후 페이지뷰/이벤트 유입 확인.
- 네트워크 탭에서 `google-analytics.com/g/collect` 요청과 파라미터(`en=이벤트명`) 확인.
- 확인 목록: ①최초 로드 page_view ②SPA 이동 page_view ③각 커스텀 이벤트 1건 이상 ④admin/deck에서 미발생.

---

## 7. 구현 체크리스트 (후속 코드 단계)

1. `@next/third-parties` 설치 → 검증: `package.json` 반영.
2. `app/(client)/layout.tsx`에 `GoogleAnalytics` 조건부 삽입 → 검증: prod 빌드에서 GA_ID 있을 때만 스크립트 로드.
3. `NEXT_PUBLIC_GA_ID` — `.env.local.example` 추가 + Amplify env 설정 → 검증: 로컬 미설정 시 비활성.
4. §4 이벤트 헬퍼(`lib/analytics.ts` 등)로 `sendGAEvent` 래핑 → 각 발생 위치 배선.
5. GA4 향상된 측정 ON(§3.3-A) → DebugView로 page_view 확인.
6. 개인정보처리방침 문구 반영(§5).

---

## 8. 미결정 / 확인 필요

- **측정 ID(G-XXXX) 발급 주체/속성**: GA4 속성이 이미 있는지, 신규 생성인지.
- **동의 배너 필요 여부**: 고지만 vs Consent Mode v2 배너 도입.
- **admin 트래킹 제외 확정**: 관리자 사용성 분석이 필요하면 별도 속성으로 분리할지.
- **이벤트/파라미터 최종 스키마**: 기획/마케팅과 §4 확정.

---

## 9. 확정 결정 (2026-07-08) — 1차 범위 축소

사용자 결정으로 **1차는 "홈 진입 수"만** 계측해 admin 대시보드에 표시. (§4 전체 이벤트 맵은 후속.)

- **지표**: 진입 수 = **홈 방문 카운트**. GA4 메트릭 `screenPageViews`, 필터 `pagePath == "/"`, 월별(`yearMonth`) 집계. (엄밀한 세션 진입 수를 원하면 `entrances`로 교체 가능.)
- **수집**: §3 방식(`@next/third-parties`, `app/(client)/layout.tsx`, `NEXT_PUBLIC_GA_ID`).
- **표출**: **GA4 Data API**(`google-analytics-data`, python)로 백엔드가 월별 홈 진입 수 조회 → `dashboard_service`에 합류 → `VisitorLineChart` 목데이터(`VALUES=[150,300,…]`, 범례 "문의" 오기) 실데이터로 교체.
- **진행 순서**: 크리덴셜(측정 ID·속성 ID·서비스계정 키) 다 준비된 뒤 **프론트+백엔드+대시보드 한 번에** 구현·검증. 코드 미착수.
- ⚠️ GA4 Data API 코어 리포트는 실시간 아님(수 시간 지연). 연간 월별 차트엔 무방, "오늘" 수치는 지연.

### 9.1 셋업 가이드 (사용자 수행 — 콘솔)

**① GA4 속성 생성** (analytics.google.com → 관리)
1. 계정 없으면 계정 만들기 → **속성 만들기**: 이름 `ADMIX`, 시간대 대한민국(GMT+9), 통화 KRW.
2. 데이터 스트림 → **웹** → URL = 현재 운영 Amplify 도메인(`https://main.d5zpc903rfz5q.amplifyapp.com`), 스트림 이름 입력 → 만들기.
   - ℹ️ **도메인 독립**: 스트림 URL은 표시용일 뿐 수집을 막지 않는다. 나중에 커스텀 도메인을 붙여도 **같은 측정 ID·속성 그대로** 동작하고 기존 데이터도 이어진다(재설정 불필요). 도메인 전환 시엔 스트림 URL만 갱신(선택), 두 도메인이 동시 운영될 때만 교차도메인/추천 제외 설정. 우리 지표는 `pagePath` 기반이라 도메인 변경 영향 없음.
3. 스트림 세부정보에서 **측정 ID `G-XXXXXXXXXX`** 확인 → (프론트 env용).
4. **향상된 측정** ON 확인(기본 ON) — SPA page_view 자동.
5. 관리 → **속성 설정**에서 **속성 ID(숫자)** 확인 → (Data API용).

**② GCP 서비스 계정 생성** (console.cloud.google.com — Data API 조회용)
1. 프로젝트 생성/선택 → API 및 서비스 → 라이브러리 → **"Google Analytics Data API" 사용 설정**.
2. IAM 및 관리자 → 서비스 계정 → 만들기(예: `admix-ga4-reader`) → 완료.
3. 해당 서비스 계정 → **키 → 키 추가 → JSON** 다운로드. (백엔드 시크릿용)
4. 서비스 계정 이메일(`...@....iam.gserviceaccount.com`) 복사.

**③ GA4에 서비스 계정 권한 부여**
- GA4 관리 → 속성 → **속성 액세스 관리** → `+` → 서비스 계정 이메일 추가 → 역할 **뷰어** → 추가.

### 9.2 나에게 넘길 값 (준비되면)
| 값 | 확보값 | 용도 | 저장 위치 |
|----|--------|------|-----------|
| 측정 ID | `G-J3BPLSXTDX` ✅ | 프론트 gtag | **Amplify env** `NEXT_PUBLIC_GA_ID` (로컬 미설정=비활성) |
| 속성 ID | `544621425` ✅ | Data API 대상 `properties/544621425` | 백엔드 env `GA4_PROPERTY_ID` |
| 서비스 계정 JSON | ⏳ 미발급 | Data API 인증 | 백엔드 시크릿 — **커밋 금지**. EC2 `.env` 직접 관리([배포/운영](2026-07-04-social-login-deploy-ops.md) §3) |

> 참고: 스트림 ID `15219258274`(11자리)는 측정 ID 옆에 뜨는 값으로 Data API엔 사용하지 않음.

> ⚠️ 서비스 계정 JSON은 자격증명이다. 레포에 커밋 금지, 채팅에 원문 붙여넣기 금지. 파일 경로(`GOOGLE_APPLICATION_CREDENTIALS`) 또는 시크릿 매니저로 주입.

### 9.3 구현 체크리스트 (크리덴셜 확보 후)
1. 프론트: `@next/third-parties` 설치 + `(client)/layout.tsx` 조건부 `GoogleAnalytics` + `NEXT_PUBLIC_GA_ID`(.env.local.example/Amplify).
2. 백엔드: `google-analytics-data` 추가 + `GA4_PROPERTY_ID`/자격증명 config + `ga4_service`(월별 홈 `screenPageViews` 조회) + `dashboard_service` 합류.
3. 대시보드: `VisitorLineChart` 목데이터 → 실데이터 배선(제목/범례 정합), `hooks/dashboard`에 필드 추가.
4. 검증: GA4 DebugView로 홈 page_view 확인 → 대시보드 월별 수치가 GA4 Realtime/보고서와 대조 일치.

### 9.4 구현 완료 (2026-07-08) — 런타임 env만 남음

코드 구현·검증 완료(tsc·eslint·백엔드 임포트·graceful 0 경로). **아직 값(측정 ID/속성 ID/JSON)이 env에 안 들어가 실데이터는 0.**

- 프론트: `@next/third-parties` 설치, `app/(client)/layout.tsx`에 `GoogleAnalytics`(NEXT_PUBLIC_GA_ID 있을 때만), `.env.local.example`에 키.
- 백엔드: `google-analytics-data` 추가, `config`에 `GA4_PROPERTY_ID`·`GA4_CREDENTIALS_PATH`, `ga4_service.get_home_visits(year)`(date 차원 1회 → today/total/monthly, 실패·미설정 시 0), `dashboard_service` 합류.
- 대시보드: `visitors`(오늘/누적 카드) + `visitorMonthly`(`VisitorLineChart` 실데이터, 범례 "문의"→"방문자 수" 정정).
- `.gitignore`: `backend/secrets/`, `*.sa.json`.

**동작시키려면 env 설정(값은 §9.2):**
| 환경 | 변수 | 값 |
|------|------|----|
| 프론트(로컬 `.env.local` / 운영 Amplify) | `NEXT_PUBLIC_GA_ID` | `G-J3BPLSXTDX` (운영만 권장 — 로컬 트래픽 오염 방지) |
| 백엔드(`.env` / EC2 `.env`) | `GA4_PROPERTY_ID` | `544621425` |
| 백엔드 | `GA4_CREDENTIALS_PATH` | 서비스 계정 JSON 경로 — **backend/ 실행 cwd 기준 상대경로** `secrets/xxx.sa.json` 또는 절대경로 (⚠️ `backend/secrets/...`로 쓰면 `backend/backend/...`로 오해석) |

- 서비스 계정 JSON은 `backend/secrets/`(gitignore됨)에 두고 경로 지정. **EC2 배포 시**: `.env`처럼 rsync에서 제외되므로 서버에 직접 업로드해야 함([배포/운영](2026-07-04-social-login-deploy-ops.md) §3 규칙).
- ⚠️ 속성이 2026-07 신규라 그 이전 월은 0. Data API 코어 리포트는 수 시간 지연 → "오늘" 값은 늦게 반영.
- 검증(값 넣은 뒤): 백엔드 재기동 → `GET /admin/dashboard`의 `visitors`/`visitorMonthly` 확인, GA4 DebugView/Realtime과 대조.

### 9.5 실동작 확인 (2026-07-08)

- 로컬 `backend/.env`에 `GA4_PROPERTY_ID=544621425` + `GA4_CREDENTIALS_PATH=secrets/admix-501806-5f60091f5b18.json`(JSON은 `backend/secrets/`) 주입.
- **실제 GA4 Data API 호출 성공** — 크리덴셜·속성 뷰어 권한·API 정상. 현재 `rows=0`(홈 방문 아직 없음: 프론트 gtag 미배포/무트래픽). 백엔드 파이프라인은 end-to-end 동작.
- uvicorn `--reload` 재기동으로 새 env 반영, `/health` 200.
- **운영 환경 gotchas**:
  - venv가 **uv 관리**라 `pip` 바이너리 없음 → `uv pip install --python .venv/bin/python "google-analytics-data>=0.18,<1"`.
  - `GA4_CREDENTIALS_PATH`는 **backend/ 실행 cwd 기준**(절대경로 권장). `backend/` 접두사 붙이면 오해석.
  - 실데이터는 **프론트 `NEXT_PUBLIC_GA_ID` 배포 + 실 방문**부터 쌓임. EC2/Amplify env + EC2에 JSON 직접 업로드는 아직 남음.
- **대시보드 크래시 수정(2026-07-08)**: 프론트 `.env.local`이 원격 EC2(구코드, `visitors` 없음)를 보고 있어 `summary.visitors`가 undefined → `DashboardView`에서 `.today` 읽다 크래시. 방어적 옵셔널 체이닝(`summary?.visitors?.today`)으로 수정. 로컬 확인은 `NEXT_PUBLIC_API_URL=http://localhost:8001`로 리포인트(제가 GA4 붙인 백엔드). ⚠️ 프론트가 보는 백엔드에 새 코드+env 없으면 값이 안 옴.

### 9.6 데이터 지연(시간차) — "방문자 수가 바로 안 오르는" 이유

대시보드는 GA4 **코어 리포트**(`runReport`)를 읽는데 이건 **실시간이 아니다**. 수집→표시 흐름:

```
홈(/) 방문 → gtag page_view 전송 → GA4 수신
  → 실시간 리포트: 즉시(초 단위)              ← 수집 확인용
  → 표준/코어 리포트로 처리: 지연             ← 대시보드가 읽는 곳
  → 백엔드 runReport(screenPageViews, path=/) → 대시보드 "방문자 수" 상승
```

- **새로 만든 속성은 첫 데이터가 표준 리포트에 뜨기까지 최대 24~48시간**, 이후엔 보통 수 시간 지연.
- **실증(2026-07-08)**: GA4 직접 조회 → 실시간 `activeUsers=1`·`screenPageViews=2`(수집 정상) vs 코어 7일 `screenPageViews=0`(아직 미처리). → 대시보드 0은 **정상**, 처리되면 상승.
- **수집 확인법**: GA4 UI 실시간 보고서에 접속이 바로 보이면 gtag/수집 OK(지연 문제일 뿐).
- (옵션·미구현) "오늘" 값만 `runRealtimeReport`로 바꾸면 접속 즉시 반영 가능. 단 실시간 API는 최근 30분/당일 위주·히스토리 없음 → **월별/누적은 코어 리포트 유지하는 하이브리드** 필요.
