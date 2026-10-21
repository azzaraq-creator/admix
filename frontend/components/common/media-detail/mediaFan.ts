// 지도 위 매체 표시(동그라미 + 방향 부채꼴) — 매체 정보 팝업의 위치 지도와 어드민 "매체 방향" 편집 지도가 같이 쓴다.

// 그림 크기(px) — 가운데 동그라미, 바깥으로 방향 부채꼴.
const MARK_SIZE = 128;
// 점·부채꼴 색 — 지도 위에서 눈에 띄게 빨강(라이트·다크 같은 색).
const MARK_COLOR = "var(--color-red-500)";
const FAN_RADIUS = 60;

/** 부채꼴 너비(전체 각도, 도) — 어드민에서 정하지 않았으면 이 너비로 그린다. */
export const DEFAULT_FACING_SPREAD = 64;
export const MIN_FACING_SPREAD = 10;
/** 360° — 사방에서 보이는 매체(부채꼴 대신 동그랗게 그린다). */
export const MAX_FACING_SPREAD = 360;

const DIRECTION_NAMES = [
  "북",
  "북동",
  "동",
  "남동",
  "남",
  "남서",
  "서",
  "북서",
] as const;

/** 방위각(도) → "북동" 같은 8방향 이름. */
export function directionName(deg: number): string {
  return DIRECTION_NAMES[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

let gradientSeq = 0;

/** 매체 표시를 담을 빈 칸 — drawMediaMark 로 그린다(값이 바뀌면 같은 칸에 다시 그린다). */
export function createMarkElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = `width:${MARK_SIZE}px;height:${MARK_SIZE}px;pointer-events:none;`;
  el.dataset.gradientId = `media-fan-${++gradientSeq}`;
  return el;
}

/**
 * 동그라미(가운데가 매체 자리)와, 방향이 있으면 그쪽으로 spread 만큼 펼친 부채꼴을 그린다.
 * 방향은 방위각(도, 북쪽 0·시계 방향) — 카카오 지도는 늘 북쪽이 위라 그대로 돌리면 된다.
 */
export function drawMediaMark(
  el: HTMLElement,
  direction: number | null,
  spread: number | null = null,
) {
  const c = MARK_SIZE / 2;
  const half =
    (Math.min(
      MAX_FACING_SPREAD,
      Math.max(MIN_FACING_SPREAD, spread ?? DEFAULT_FACING_SPREAD),
    ) /
      2) *
    (Math.PI / 180);
  const dx = FAN_RADIUS * Math.sin(half);
  const dy = FAN_RADIUS * Math.cos(half);
  const gid = el.dataset.gradientId ?? "media-fan";
  // 북쪽(위)을 향한 부채꼴을 그린 뒤 방위각만큼 돌린다. 테두리 없이 매체 쪽이 진하고 바깥으로 흐려지는 빛줄기.
  // 180°를 넘으면 큰 호(large-arc)로, 360°면 부채꼴 대신 동그라미 전체를 칠한다.
  const full = half >= Math.PI;
  const largeArc = half > Math.PI / 2 ? 1 : 0;
  const fan =
    direction == null
      ? ""
      : full
        ? `<circle cx="${c}" cy="${c}" r="${FAN_RADIUS}" fill="url(#${gid})" />`
        : `<g transform="rotate(${direction} ${c} ${c})">
          <path d="M${c},${c} L${c - dx},${c - dy} A${FAN_RADIUS},${FAN_RADIUS} 0 ${largeArc} 1 ${c + dx},${c - dy} Z"
            fill="url(#${gid})" />
        </g>`;
  // 점 — 흰 테두리를 두른 진한 점과 옅은 번짐(부채꼴은 테두리 없음). 그림자로 지도 위에서 떠 보이게.
  el.innerHTML = `<svg width="${MARK_SIZE}" height="${MARK_SIZE}" viewBox="0 0 ${MARK_SIZE} ${MARK_SIZE}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="${gid}" cx="${c}" cy="${c}" r="${FAN_RADIUS}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="${MARK_COLOR}" stop-opacity="0.6" />
        <stop offset="0.6" stop-color="${MARK_COLOR}" stop-opacity="0.28" />
        <stop offset="1" stop-color="${MARK_COLOR}" stop-opacity="0" />
      </radialGradient>
    </defs>
    ${fan}
    <circle cx="${c}" cy="${c}" r="13" fill="${MARK_COLOR}" fill-opacity="0.18" />
    <circle cx="${c}" cy="${c}" r="6" fill="${MARK_COLOR}" stroke="#fff" stroke-width="2"
      style="filter:drop-shadow(0 1px 3px rgba(0,0,0,0.35))" />
  </svg>`;
}

/** a → b 방위각(도, 북쪽 0·시계 방향, 정수). 지도를 누른 쪽으로 방향을 정할 때 쓴다. */
export function bearingDeg(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const dx = (bLng - aLng) * Math.cos((aLat * Math.PI) / 180);
  const dy = bLat - aLat;
  return Math.round(((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360) % 360;
}
