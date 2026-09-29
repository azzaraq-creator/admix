/**
 * 프로필 아바타 배경색(글자색 클래스) — 가입 방법마다 다르게 보인다.
 * 카카오는 연노랑, 네이버는 연초록, 이메일 가입은 기본 보라. 아이콘이 배경을 40% 불투명도로 칠해 연하게 보인다.
 */
const AVATAR_COLOR: Record<string, string> = {
  kakao: "text-[#FEE500]",
  naver: "text-[#03C75A]",
};

export function avatarColorClass(snsProvider: string | null | undefined) {
  return AVATAR_COLOR[snsProvider ?? ""] ?? "text-[#A33BD1]";
}
