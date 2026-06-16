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

→ 디자인 시스템에서 중립/시맨틱 팔레트 확정되면 교체.

## 소스 데이터 이상치 (참고)

- `text-xl/Light` 한 행만 Figma weight 셀이 Thin/100 (다른 Light 행은 Light/300). 소스 디자인 오류로 보여 토큰은 Light=300 적용.
- letterSpacing 단위가 Figma에 혼재(xs/sm/base는 %, lg 이상은 px). px 값 그대로 반영.

## 제거된 더미

기존 globals.css의 Cosmos 다크 테마 토큰·데코 CSS(`.cosmos-bg`, `.orb`, `.stream-caret`, `--bg-void` 등)와 Instrument Serif/JetBrains Mono 폰트는 새 라이트 디자인과 무관해 제거. 더미 페이지의 해당 스타일은 빠짐(더미는 삭제 예정).
