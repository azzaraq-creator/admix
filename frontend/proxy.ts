import { NextResponse, type NextRequest } from "next/server";

import { USER_TOKEN_COOKIE } from "@/lib/userToken";

const AUTH_ROUTES = ["/login", "/signup", "/find-account"];
const PROTECTED_ROUTES = ["/profile"];
// SNS 로그인 직후 거치는 이메일 인증/가입 완료 단계 — 이미 토큰이 발급된
// 상태로 진입하므로 AUTH_ROUTES 리다이렉트에서 제외한다.
const AUTH_ROUTE_EXCEPTIONS = ["/signup/sns", "/signup/complete"];

export default function proxy(request: NextRequest) {
  const token = request.cookies.get(USER_TOKEN_COOKIE)?.value;
  const { pathname } = request.nextUrl;

  const matches = (routes: string[]) =>
    routes.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    );

  if (
    token &&
    matches(AUTH_ROUTES) &&
    !AUTH_ROUTE_EXCEPTIONS.includes(pathname)
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (!token && matches(PROTECTED_ROUTES)) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/signup",
    "/signup/:path*",
    "/find-account",
    "/profile",
    "/profile/:path*",
  ],
};
