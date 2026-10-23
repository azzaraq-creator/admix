/**
 * 프로필 아바타 배경색(글자색 클래스) — 가입 방법마다 다르게 보인다.
 * 카카오는 노랑, 네이버는 초록, 이메일 가입은 연보라(보라 40%를 흰 바탕에 얹은 색, 다크 모드는 기본 보라).
 */
const AVATAR_COLOR: Record<string, string> = {
  kakao: "text-[#FEE500]",
  naver: "text-[#03C75A]",
};

export function avatarColorClass(snsProvider: string | null | undefined) {
  return (
    AVATAR_COLOR[snsProvider ?? ""] ?? "text-[#cab2f3] dark:text-primary-500"
  );
}
