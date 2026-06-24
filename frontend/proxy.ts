import { NextResponse, type NextRequest } from "next/server";

import { USER_TOKEN_COOKIE } from "@/lib/userToken";

const AUTH_ROUTES = ["/login", "/signup", "/find-account"];
const PROTECTED_ROUTES = ["/profile"];

export default function proxy(request: NextRequest) {
  const token = request.cookies.get(USER_TOKEN_COOKIE)?.value;
  const { pathname } = request.nextUrl;

  const matches = (routes: string[]) =>
    routes.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    );

  if (token && matches(AUTH_ROUTES)) {
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
