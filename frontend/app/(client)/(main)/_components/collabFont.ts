import localFont from "next/font/local";

/**
 * 콜라보 글꼴 — HS활공명조(app/fonts, 사용자가 받은 파일). next/font 가 빌드에 넣어 자체 호스팅한다.
 * 사이드바 "Collaboration" 메뉴와 /partners 사이드바 로고 옆 글자가 함께 쓴다.
 */
export const collabScript = localFont({
  src: "../../../fonts/HSHwalkongSerif-Regular.woff2",
  display: "swap",
});
