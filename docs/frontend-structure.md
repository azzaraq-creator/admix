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

## 다음 단계 후보

1. 더미 정리 + `/`·`/ad-recommend` 새 위치로 이전
2. 공통 인프라(세션 컨텍스트 / axios 클라이언트 / proxy.ts·layout 가드)
3. 화면별 구현
