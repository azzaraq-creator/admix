# 디자인 토큰 (globals.css)

> 출처: Figma "옥외광고플랫폼" — 컬러 node 1036:79537, 폰트 node 1041:93156.
> 적용 위치: `frontend/app/globals.css` (Tailwind v4 `@theme`).

## 컬러 (Figma 확정)

Primary 스케일 + 베이직. `bg-primary-700`, `text-black`, `border-stroke` 등으로 사용.

| 토큰 | HEX | Figma 이름 |
|---|---|---|
| `primary-900` | `#004240` | Primary/900 |
| `primary-800` | `#007571` | Primary/800 |
| `primary-700` | `#00AAA4` | Primary/700 (= **Primary 기본**) |
| `primary-600` | `#00DBD4` | Primary/600 |
| `primary-500` | `#0FFFF7` | Primary/500 |
| `primary-400` | `#42FFF8` | Primary/400 |
| `primary-300` | `#75FFFA` | Primary/300 |
| `primary-200` | `#A8FFFC` | Primary/200 |
| `primary-100` | `#DBFFFE` | Primary/100 |
| `primary-50`  | `#E5F6F6` | Primary/Opacity |
| `black` | `#2F3442` | Black |
| `white` | `#FFFFFF` | White |
| `stroke` | `#E4E5EE` | Stroke |

## 타이포그래피 (Figma 확정)

fontFamily 전 단계 **Pretendard**. `text-{size}` 유틸이 fontSize + lineHeight + letterSpacing을 함께 적용.

| `text-` | fontSize | lineHeight | letterSpacing |
|---|---|---|---|
| `xs`   | 12px | 16px | 0 (Figma 0.04% ≈ 0) |
| `sm`   | 14px | 20px | 0 |
| `base` | 16px | 24px | 0 |
| `lg`   | 18px | 28px | -0.04px |
| `xl`   | 20px | 28px | -0.08px |
| `2xl`  | 24px | 32px | -0.1px |
| `3xl`  | 28px | 36px | -0.12px |
| `4xl`  | 32px | 40px | -0.16px |
| `5xl`  | 40px | 48px | -0.4px |

weight: Light=300, Regular=400, Medium=500, Semi Bold=600, Bold=700 (`font-light`~`font-bold`).

## shadcn 시맨틱 매핑 (light)

| shadcn 토큰 | 값 | 출처 |
|---|---|---|
| `background` / `card` / `popover` | `#FFFFFF` | White |
| `foreground` / `*-foreground` | `#2F3442` | Black |
| `primary` | `#00AAA4` | Primary/700 |
| `primary-foreground` | `#FFFFFF` | White |
| `secondary` / `accent` | `#E5F6F6` | Primary/Opacity |
| `secondary-foreground` / `accent-foreground` | `#004240` | Primary/900 |
| `border` / `input` | `#E4E5EE` | Stroke |
| `ring` | `#00AAA4` | Primary/700 |

## Figma에 없어 파생한 값 (확인/교체 필요)

디자인 컬러 시트에 중립 그레이 스케일과 시맨틱(에러 등) 색이 정의돼 있지 않음("Other Color" 비어있고 "[아우라웍스] Design System 참고" 링크만 존재). shadcn 동작에 필요해 임시 파생값 사용:

- `muted` `#F4F5F7`, `muted-foreground` `#6B7280` — 파생 그레이.
- `destructive` `#EF4444` — 표준 red, **Figma 출처 아님**.
- `disabled` `#737586` — 보조/비활성 텍스트. 코드리뷰 M8에서 하드코딩 최다(74건)라 토큰 신설(`--color-disabled`). `text-disabled`/`bg-disabled` 로 사용. **Figma 출처 아님** → 팔레트 확정 시 grey 스케일로 편입 검토.
- `placeholder` `#C9CAD3` — 입력 placeholder 색. M8에서 토큰 신설(`--color-placeholder`), `placeholder:text-placeholder` 로 사용(10건 치환). **Figma 출처 아님**.

→ 디자인 시스템에서 중립/시맨틱 팔레트 확정되면 교체.

## 미토큰화 하드코딩 색상 (후속 정리 대상)

> 2026-07-06 프론트 코드리뷰 M8 후속. **1차(토큰 이미 있는 hex)는 `[#hex]` arbitrary → 토큰 클래스로 치환 완료**(예: `text-[#2f3442]`→`text-black`, `bg-[#f6f6f6]`→`bg-grey-50`, `[#00aaa4]`→`primary`, `[#e4e5ee]`→`stroke`, `[#e2e2e2]`→`grey-200` 등, 약 244건/56파일).
> 아래는 **토큰이 없어 남은 색**(약 70여 종). 그룹별로 수렴/신설 후보. 디자인 시스템 확정 후 토큰화 → 치환 권장. (SVG `fill="#hex"` 속성은 대상 아님)

### 1. 중립 그레이 — 텍스트 (grey 스케일 확장 필요)
현재 grey 스케일이 50/100/200/300/500 뿐이라 중간톤 텍스트 회색이 하드코딩됨.

| hex | 사용 | 비고 |
|---|---|---|
| ~~`#737586`~~ | ~~74~~ | ✅ `disabled` 토큰으로 신설·치환 완료 (2026-07-06) |
| `#545454` | 24 | 진한 회색 텍스트 |
| `#767676` `#6d6d6d` `#6e6e6e` `#494a4a` `#717182` | 6·3·2·2·2 | 유사 진회색 → 소수 토큰으로 수렴 |
| `#9ca3af` `#a1a1a1` `#8f8f8f` `#a9aab5` `#a0a0a0` | 5·3·2·2·1 | 연회색 placeholder/보조 |

### 2. 근-검정 (black `#2f3442` 수렴 검토)
| hex | 사용 |
|---|---|
| `#2a2a2a` | 17 |
| `#0a0a0a` | 9 |
| `#364153` `#4a5565` `#101828` `#000000` | 4·1·1·1 |

### 3. 중립 그레이 — 경계/배경 (stroke·grey-50~200 수렴)
유사 회색이 난립. `#cdcdcd`(19) `#e8e8e8`(11) `#ebebeb`(9) `#d9d9d9`(6) `#e6e6e6`(4) `#d3d4d6`(4) `#f0f0f3`(4) `#fafafa`(4) `#f9fafc`(4) `#f2f2f2`(2) `#e5e5e5`(2) `#f5f5f5`(2) `#eee`(3) `#d1d5dc`(2) + 단발 다수 → stroke/grey 스케일로 수렴.

### 4. 에러 / danger (red) — `danger`·`danger-bg` 신설 권장
| hex | 사용 | 용도 |
|---|---|---|
| `#ff2c20` | 24 | 폼 에러 텍스트 |
| `#fff2f1` | 12 | 에러 입력 배경(연빨강) |
| `#d65856` `#ef4444` `#fef2f2` `#ed2115` | 7·4·4·2 | 유사 red (참고: `destructive`=`#ef4444` 이미 시맨틱 존재) |

### 5. 경고 / warning (yellow·orange) — `warning` 신설 후보
`#ff920a`(6) `#fff3d3`(5) `#fdf6e3`(5) `#c99a2e`(5) `#ff7a00`(1) `#ffe0a3`(1) `#fff8ec`(1) `#fddc37`(1)

### 6. 성공 / success (green) — `success` 신설 후보
`#4ca452`(2) `#22c55e`(1) `#16c60c`(1) `#dcefdf`(1) `#f0f8f1`(1)

### 7. 블루/info & 기타
`#0689ff`(2) `#d6f1ff`(2) `#64748b`(2) `#f0f5f9`(3) `#ebf8f8`(2) `#4f6bed`(1) `#eef2ff`(1) `#cbd5e1`(1)

### 8. 브랜드 고정색 — 토큰화 제외
`#ffe400`(카카오) `#00c300`·`#00cb4b`(네이버) — 소셜 버튼/브랜드 고정색이라 토큰 대상 아님(그대로 유지).

## 소스 데이터 이상치 (참고)

- `text-xl/Light` 한 행만 Figma weight 셀이 Thin/100 (다른 Light 행은 Light/300). 소스 디자인 오류로 보여 토큰은 Light=300 적용.
- letterSpacing 단위가 Figma에 혼재(xs/sm/base는 %, lg 이상은 px). px 값 그대로 반영.

## 제거된 더미

기존 globals.css의 Cosmos 다크 테마 토큰·데코 CSS(`.cosmos-bg`, `.orb`, `.stream-caret`, `--bg-void` 등)와 Instrument Serif/JetBrains Mono 폰트는 새 라이트 디자인과 무관해 제거. 더미 페이지의 해당 스타일은 빠짐(더미는 삭제 예정).
