import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "school-budget-session";
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "school-budget-fallback-secret-2026-key"
);

interface SessionPayload {
  accountId: number;
  schoolId: number | null;
  schoolName: string;
  role: "school" | "admin";
  passwordChanged: boolean;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 정적 파일 및 API 라우트는 미들웨어 검증 제외
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.includes(".") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  let session: SessionPayload | null = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      session = payload as unknown as SessionPayload;
    } catch {
      // 토큰 검증 실패 시 세션을 null로 유지
    }
  }

  // 1. 비로그인 상태 처리
  if (!session) {
    if (pathname !== "/login" && !pathname.startsWith("/api/")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  // 2. 로그인 상태이나 비밀번호를 변경하지 않은 경우 강제화
  if (!session.passwordChanged) {
    const isAuthUpdateApi = pathname === "/api/auth/update-password";
    const isResetPage = pathname === "/reset-password";
    const isLogoutApi = pathname === "/api/auth/logout";

    if (!isResetPage && !isAuthUpdateApi && !isLogoutApi && !pathname.startsWith("/api/")) {
      return NextResponse.redirect(new URL("/reset-password", request.url));
    }
    return NextResponse.next();
  }

  // 3. 로그인 및 비밀번호 변경 완료 후 경로 처리
  if (pathname === "/login" || pathname === "/reset-password" || pathname === "/") {
    const dashboard = session.role === "admin" ? "/admin" : "/school";
    return NextResponse.redirect(new URL(dashboard, request.url));
  }

  // 4. 권한에 따른 접근 제한
  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/school", request.url));
  }

  if (pathname.startsWith("/school") && session.role !== "school") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 아래 경로를 제외한 모든 경로에서 미들웨어 실행:
     * - api/auth/login (로그인 API)
     * - _next/static (정적 파일)
     * - _next/image (이미지 최적화 파일)
     * - favicon.ico (파비콘)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
