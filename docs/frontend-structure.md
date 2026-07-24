# 프론트엔드 라우트 구조 (스켈레톤)

> 더미 프론트 전면 재구성. 현재는 라우트 스켈레톤만 존재(빈 page + layout).
> 디자인/정책은 `docs/policies/`, Figma 참조.

## 라우트 트리

```
frontend/app/
├── (client)/                  # 광고주 영역
│   ├── (auth)/                # login · signup · find-account
│   ├── (main)/                # media/[id] · proposal · [ad-recommend: 폴더만]
│   └── (mypage)/              # profile · business(사업자 등록)
└── admin/                     # 관리자 (URL /admin/*)
    ├── (auth)/login           # /admin/login (가드 제외)
    └── (main)/                # /admin · members · roles · media
```

## URL 매핑

| 경로 | URL |
|---|---|
| `(client)/(auth)/login` | `/login` |
| `(client)/(auth)/signup` | `/signup` |
| `(client)/(auth)/find-account` | `/find-account` |
| `(client)/(main)/media/[id]` | `/media/[id]` |
| `(client)/(main)/proposal` | `/proposal` |
| `(client)/(mypage)/profile` | `/profile` |
| `(client)/(mypage)/business` | `/business` |
| `admin/(auth)/login` | `/admin/login` |
| `admin/(main)` | `/admin` |
| `admin/(main)/members` | `/admin/members` |
| `admin/(main)/roles` | `/admin/roles` |
| `admin/(main)/media` | `/admin/media` |

## 설계 메모

- **등급(비로그인/개인/기업)**: 라우트로 분리하지 않는다. 로그인 화면·서비스 화면은 모든 등급에 동일하고, 등급은 로그인 결과로 런타임 결정(세션/role 컨텍스트 + 가드). 기획서 `docs/policies/login.md`, `ai-media-recommend.md` 기준.
- **admin 가드**: `admin/(main)/layout.tsx`에 둔다(이후 단계). `cookies()` 기반 인증 + role 검사. 로그인 화면은 `admin/(auth)/login`으로 분리해 가드 밖에 둠.
- **client 가드**: `(client)/(mypage)/layout.tsx`(로그인 필요 영역)에 둔다(이후 단계).
- **공통 셸**: 헤더/푸터/세션 컨텍스트, axios API 클라이언트는 이후 단계에서 추가.

## 더미와의 충돌 (보류 라우트)

더미(`app/page.tsx`, `app/(main)/ad-recommend` 등)는 보존 중이며 추후 삭제 예정.
새 구조와 URL이 겹치는 2건은 page를 만들지 않고 보류:

- `/` — 더미 `app/page.tsx` 점유. 더미 삭제 시 `(client)` 홈으로 채움.
- `/ad-recommend` — 더미 `app/(main)/ad-recommend` 점유. `(client)/(main)/ad-recommend/`에 폴더만 잡아둠(`.gitkeep`). 더미 삭제 시 `page.tsx` 추가.

## 반응형 / 뷰포트 규칙

- **전체 높이는 `h-dvh` / `min-h-dvh`를 쓴다 (`h-screen`/`min-h-screen` 금지).**
  - 이유: `h-screen`은 `100vh`로 컴파일되는데, iOS Safari에서 `100vh`는 "URL 바가 접혔을 때 기준" 최대 높이라, URL 바가 화면 하단에 떠 있으면 그 높이만큼 콘텐츠가 툴바 뒤로 잘린다. 특히 화면 하단의 **제출 버튼·챗봇 입력창**이 가려진다.
  - `dvh`(dynamic viewport height)는 URL 바가 떠 있으면 그만큼 뺀 **실제 보이는 높이**를 기준으로 잡아 잘림이 없다. Tailwind v4 기본 내장 유틸이라 config 추가 불필요.
  - 트레이드오프: `dvh`는 스크롤 시 URL 바 접힘/펼침에 따라 높이가 실시간 리사이즈된다. 높이가 고정이어야 하면 `svh`(가장 작은 뷰포트, 접힘 없음)를 쓰되 URL 바 접힌 상태에서 아래 여백이 생긴다.
  - 하단 고정 버튼은 홈 인디케이터 겹침 방지를 위해 `env(safe-area-inset-bottom)`도 함께 고려.

## 다음 단계 후보

1. 더미 정리 + `/`·`/ad-recommend` 새 위치로 이전
2. 공통 인프라(세션 컨텍스트 / axios 클라이언트 / proxy.ts·layout 가드)
3. 화면별 구현
